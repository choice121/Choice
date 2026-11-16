import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { buildReceiptPDF, type ReceiptLineItem } from './receipt-render.ts';
import { calculateHouseholdApplicationFee } from './application-rules.ts';

export type ReceiptType = 'application_fee' | 'holding_deposit';

export interface IssuedReceipt {
  id: string;
  receipt_number: string;
  storage_path: string;
  amount: number;
  paid_at: string;
  status: string;
  applicant_id?: string | null;
}

export async function issuePaymentReceipt(
  supabase: SupabaseClient,
  app: Record<string, unknown>,
  receiptType: ReceiptType,
  actorId: string | null = null,
  opts?: { applicant?: Record<string, unknown> | null },
): Promise<IssuedReceipt> {
  const appId = String(app.app_id || '');
  const isHolding = receiptType === 'holding_deposit';
  const targetApplicant = !isHolding && opts?.applicant ? opts.applicant : null;
  const targetApplicantId = targetApplicant?.id ? String(targetApplicant.id) : null;
  const isIndividualMode = String(app.household_payment_mode || 'centralized') === 'individual';

  const paid = targetApplicant
    ? targetApplicant.payment_status === 'paid'
    : (isHolding ? app.holding_fee_paid === true : app.payment_status === 'paid');
  if (!appId || !paid) throw new Error('Receipt requires a confirmed payment record.');

  const rawPaidAt = targetApplicant
    ? (targetApplicant.payment_confirmed_at || app.payment_confirmed_at || app.payment_date)
    : (isHolding
        ? app.holding_fee_paid_at || app.payment_confirmed_at || app.payment_date
        : app.payment_confirmed_at || app.payment_date);
  const paidAt = rawPaidAt ? new Date(String(rawPaidAt)).toISOString() : '';
  if (!paidAt) throw new Error('Payment confirmation timestamp is missing.');

  const rawAmount = targetApplicant
    ? (targetApplicant.payment_amount ?? targetApplicant.screening_fee_amount ?? 50)
    : (isHolding
        ? app.holding_fee_amount
        : app.payment_amount_collected ?? app.payment_amount_recorded ?? app.application_fee);
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount is missing or invalid.');

  let lineItems: ReceiptLineItem[] | undefined;
  let jurisdictionNote: string | null = app.jurisdiction_fee_note ? String(app.jurisdiction_fee_note) : null;
  if (receiptType === 'application_fee') {
    if (targetApplicant) {
      const mName = [targetApplicant.first_name, targetApplicant.last_name].filter(Boolean).join(' ') || 'Applicant';
      const mRole = String(targetApplicant.role || targetApplicant.applicant_type || 'Applicant');
      lineItems = [{
        name: mName,
        role: mRole,
        fee: amount,
        note: 'Applicant screening fee',
      }];
    } else if (Array.isArray(app.fee_breakdown) && app.fee_breakdown.length > 0) {
      lineItems = (app.fee_breakdown as Array<Record<string, unknown>>).map((item) => ({
        name: String(item.name || 'Applicant'),
        role: String(item.role_label || item.applicant_type || 'Applicant'),
        fee: Number(item.fee ?? item.standard_fee ?? 0),
        note: item.note ? String(item.note) : undefined,
      }));
    } else {
      const { data: applicants } = await supabase
        .from('application_applicants')
        .select('applicant_index,is_primary,applicant_type,role,submission_method,first_name,last_name')
        .eq('app_id', appId)
        .order('applicant_index', { ascending: true });
      if (applicants && applicants.length > 0) {
        const feeSummary = calculateHouseholdApplicationFee(applicants, {
          perPersonFee: Number(app.application_fee_per_adult) || 50,
          creditApplied: Boolean(app.credit_applied_id),
          stateCode: String(app.lease_state_code || app.property_state_code || ''),
        });
        lineItems = feeSummary.feeBreakdown.map((item) => ({
          name: item.name,
          role: item.role_label,
          fee: item.fee,
          note: item.note,
        }));
        if (!jurisdictionNote) jurisdictionNote = feeSummary.jurisdictionFeeNote;
      }
    }
  }

  const memberSuffix = targetApplicant ? `-M${Number(targetApplicant.applicant_index ?? 0) + 1}` : '';
  const receiptNumber = `CP-REC-${isHolding ? 'HOLD' : 'APP'}-${appId}${memberSuffix}-${Date.parse(paidAt)}`;

  let existingQuery = supabase.from('payment_receipts')
    .select('id,receipt_number,storage_path,amount,paid_at,status,applicant_id')
    .eq('app_id', appId)
    .eq('receipt_type', receiptType);
  if (targetApplicantId) {
    existingQuery = existingQuery.eq('applicant_id', targetApplicantId);
  } else {
    existingQuery = existingQuery.eq('paid_at', paidAt);
  }
  let { data: receipt, error } = await existingQuery.maybeSingle();
  if (error) throw new Error(`Receipt lookup failed: ${error.message}`);

  if (receipt?.status === 'issued' && receipt.storage_path) return receipt as IssuedReceipt;

  const paymentMethodLabel = targetApplicant
    ? ([targetApplicant.payment_card_brand || 'Card', targetApplicant.payment_card_last4 ? `•••• ${targetApplicant.payment_card_last4}` : ''].filter(Boolean).join(' '))
    : String(app.payment_method_confirmed || app.payment_method_recorded || '');
  const txRefLabel = targetApplicant
    ? String(targetApplicant.payment_transaction_ref || app.payment_transaction_ref || '')
    : String(app.payment_transaction_ref || app.payment_notes || '');

  if (!receipt) {
    const baseInsert = {
      app_id: appId,
      applicant_id: targetApplicantId,
      receipt_type: receiptType,
      receipt_number: receiptNumber,
      amount,
      payment_method: paymentMethodLabel,
      transaction_ref: txRefLabel,
      paid_at: paidAt,
      fee_breakdown: lineItems || [],
      status: 'pending',
      created_by: actorId || null,
    };
    let { data: inserted, error: insertError } = await supabase.from('payment_receipts')
      .insert(baseInsert)
      .select('id,receipt_number,storage_path,amount,paid_at,status,applicant_id')
      .single();
    if (insertError && (insertError.code === '23503' || /created_by/i.test(insertError.message || '')) && baseInsert.created_by) {
      const retryNullActor = await supabase.from('payment_receipts')
        .insert({ ...baseInsert, created_by: null })
        .select('id,receipt_number,storage_path,amount,paid_at,status,applicant_id')
        .single();
      inserted = retryNullActor.data;
      insertError = retryNullActor.error;
    }
    if (insertError) {
      let retryQ = supabase.from('payment_receipts')
        .select('id,receipt_number,storage_path,amount,paid_at,status,applicant_id')
        .eq('app_id', appId)
        .eq('receipt_type', receiptType);
      retryQ = targetApplicantId ? retryQ.eq('applicant_id', targetApplicantId) : retryQ.eq('paid_at', paidAt);
      const { data: existing, error: retryError } = await retryQ.maybeSingle();
      if (retryError || !existing) throw new Error(`Receipt reservation failed: ${insertError.message}`);
      receipt = existing;
    } else {
      receipt = inserted;
    }
  }

  const issuedAt = new Date().toISOString();
  const payerName = targetApplicant
    ? ([targetApplicant.first_name, targetApplicant.last_name].filter(Boolean).join(' ') || 'Applicant')
    : ([app.first_name, app.last_name].filter(Boolean).join(' ') || 'Resident');
  const arrangementNote = receiptType === 'application_fee'
    ? 'Household Application Screening Fee ($50 Primary · $0 1st Occupying Co-Applicant · $50 Each Additional Adult)'
    : undefined;

  const bytes = await buildReceiptPDF({
    receiptNumber: String(receipt.receipt_number),
    receiptType,
    tenantName: payerName,
    propertyAddress: String(app.property_address || 'Property address not recorded'),
    applicationId: appId,
    amount,
    paymentMethod: paymentMethodLabel || 'Not recorded',
    transactionReference: txRefLabel || 'Not provided',
    paidAt,
    issuedAt,
    lineItems,
    arrangementNote,
    jurisdictionNote,
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
    .update({
      storage_path: storagePath,
      size_bytes: bytes.byteLength,
      sha256: sha256,
      fee_breakdown: lineItems || [],
      status: 'issued',
      issued_at: issuedAt,
    })
    .eq('id', receipt.id)
    .select('id,receipt_number,storage_path,amount,paid_at,status,applicant_id')
    .single();
  if (saveError || !saved) throw new Error(`Receipt record update failed: ${saveError?.message || 'No record returned'}`);
  return saved as IssuedReceipt;
}

function uint8ToB64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function mintReceiptAccessToken(
  appId: string,
  applicantId: string | null = null,
  ttlSeconds = 90 * 24 * 3600,
): Promise<string | null> {
  const serviceKey = typeof Deno !== 'undefined' && Deno.env ? (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '') : '';
  if (!serviceKey || !appId) return null;
  try {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = {
      app_id: String(appId),
      ...(applicantId ? { applicant_id: String(applicantId) } : {}),
      exp,
    };
    const payloadB64 = uint8ToB64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(serviceKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
    return `${payloadB64}.${uint8ToB64Url(new Uint8Array(mac))}`;
  } catch {
    return null;
  }
}