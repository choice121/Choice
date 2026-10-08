import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { buildReceiptPDF } from './receipt-render.ts';

export type ReceiptType = 'application_fee' | 'holding_deposit';

export interface IssuedReceipt {
  id: string;
  receipt_number: string;
  storage_path: string;
  amount: number;
  paid_at: string;
  status: string;
}

export async function issuePaymentReceipt(
  supabase: SupabaseClient,
  app: Record<string, unknown>,
  receiptType: ReceiptType,
  actorId: string,
): Promise<IssuedReceipt> {
  const appId = String(app.app_id || '');
  const isHolding = receiptType === 'holding_deposit';
  const paid = isHolding ? app.holding_fee_paid === true : app.payment_status === 'paid';
  if (!appId || !paid) throw new Error('Receipt requires a confirmed payment record.');

  const rawPaidAt = isHolding
    ? app.holding_fee_paid_at || app.payment_confirmed_at || app.payment_date
    : app.payment_confirmed_at || app.payment_date;
  const paidAt = rawPaidAt ? new Date(String(rawPaidAt)).toISOString() : '';
  if (!paidAt) throw new Error('Payment confirmation timestamp is missing.');

  const rawAmount = isHolding
    ? app.holding_fee_amount
    : app.payment_amount_collected ?? app.payment_amount_recorded ?? app.application_fee;
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount is missing or invalid.');
  if (receiptType === 'application_fee' && amount !== 50) {
    throw new Error('Application fee receipt amount must be exactly $50.00.');
  }

  const receiptNumber = `CP-REC-${isHolding ? 'HOLD' : 'APP'}-${appId}-${Date.parse(paidAt)}`;
  let { data: receipt, error } = await supabase.from('payment_receipts')
    .select('id,receipt_number,storage_path,amount,paid_at,status')
    .eq('app_id', appId)
    .eq('receipt_type', receiptType)
    .eq('paid_at', paidAt)
    .maybeSingle();
  if (error) throw new Error(`Receipt lookup failed: ${error.message}`);

  if (receipt?.status === 'issued' && receipt.storage_path) return receipt as IssuedReceipt;

  if (!receipt) {
    const { data: inserted, error: insertError } = await supabase.from('payment_receipts')
      .insert({
        app_id: appId,
        receipt_type: receiptType,
        receipt_number: receiptNumber,
        amount,
        payment_method: String(app.payment_method_confirmed || app.payment_method_recorded || ''),
        transaction_ref: String(app.payment_transaction_ref || app.payment_notes || ''),
        paid_at: paidAt,
        status: 'pending',
        created_by: actorId,
      })
      .select('id,receipt_number,storage_path,amount,paid_at,status')
      .single();
    if (insertError) {
      const { data: existing, error: retryError } = await supabase.from('payment_receipts')
        .select('id,receipt_number,storage_path,amount,paid_at,status')
        .eq('app_id', appId)
        .eq('receipt_type', receiptType)
        .eq('paid_at', paidAt)
        .maybeSingle();
      if (retryError || !existing) throw new Error(`Receipt reservation failed: ${insertError.message}`);
      receipt = existing;
    } else {
      receipt = inserted;
    }
  }

  const issuedAt = new Date().toISOString();
  const appName = [app.first_name, app.last_name].filter(Boolean).join(' ') || 'Resident';
  const bytes = await buildReceiptPDF({
    receiptNumber: String(receipt.receipt_number),
    receiptType,
    tenantName: appName,
    propertyAddress: String(app.property_address || 'Property address not recorded'),
    applicationId: appId,
    amount,
    paymentMethod: String(app.payment_method_confirmed || app.payment_method_recorded || 'Not recorded'),
    transactionReference: String(app.payment_transaction_ref || app.payment_notes || 'Not provided'),
    paidAt,
    issuedAt,
  });
  const storagePath = `${appId}/receipts/${receipt.id}.pdf`;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const { error: uploadError } = await supabase.storage.from('lease-pdfs').upload(storagePath, bytes, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploadError) throw new Error(`Receipt PDF upload failed: ${uploadError.message}`);

  const { data: saved, error: saveError } = await supabase.from('payment_receipts')
    .update({ storage_path: storagePath, size_bytes: bytes.byteLength, sha256: sha256, status: 'issued', issued_at: issuedAt })
    .eq('id', receipt.id)
    .select('id,receipt_number,storage_path,amount,paid_at,status')
    .single();
  if (saveError || !saved) throw new Error(`Receipt record update failed: ${saveError?.message || 'No record returned'}`);
  return saved as IssuedReceipt;
}