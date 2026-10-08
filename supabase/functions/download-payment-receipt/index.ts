import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonErr(405, 'POST required');

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return jsonErr(401, 'Please sign in to view this receipt.');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return jsonErr(401, 'Please sign in to view this receipt.');

  let body: { receipt_id?: string; app_id?: string; receipt_type?: string };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }
  if (!body.receipt_id && !(body.app_id && ['application_fee', 'holding_deposit'].includes(body.receipt_type || ''))) {
    return jsonErr(400, 'Provide a receipt_id or a valid app_id and receipt_type');
  }

  let appId = body.app_id || '';
  if (body.receipt_id) {
    const { data: receiptForApp, error: lookupError } = await supabase.from('payment_receipts')
      .select('app_id').eq('id', body.receipt_id).maybeSingle();
    if (lookupError || !receiptForApp) return jsonErr(404, 'Receipt not found');
    appId = receiptForApp.app_id;
  }

  const { data: app, error: appError } = await supabase.from('applications')
    .select('app_id,applicant_user_id,email,co_applicant_email,first_name,last_name,property_address')
    .eq('app_id', appId)
    .maybeSingle();
  if (appError || !app) return jsonErr(404, 'Receipt application not found');

  const { data: role } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).maybeSingle();
  const { data: coApplicant } = await supabase.from('co_applicants')
    .select('email').eq('app_id', app.app_id).maybeSingle();
  const userEmail = (user.email || '').toLowerCase();
  const allowed = !!role
    || app.applicant_user_id === user.id
    || (app.email || '').toLowerCase() === userEmail
    || (app.co_applicant_email || '').toLowerCase() === userEmail
    || (coApplicant?.email || '').toLowerCase() === userEmail;
  if (!allowed) return jsonErr(403, 'This receipt is not linked to the signed-in account.');

  let receiptQuery = supabase.from('payment_receipts')
    .select('id,app_id,receipt_type,receipt_number,amount,currency,payment_method,transaction_ref,paid_at,storage_path,status,issued_at')
    .eq('app_id', app.app_id)
    .eq('status', 'issued');
  if (body.receipt_id) receiptQuery = receiptQuery.eq('id', body.receipt_id);
  else receiptQuery = receiptQuery.eq('receipt_type', body.receipt_type!);
  const { data: receipt, error: receiptError } = await receiptQuery
    .order('issued_at', { ascending: false }).limit(1).maybeSingle();
  if (receiptError || !receipt) return jsonErr(404, 'Issued receipt not found');

  const { data: signed, error: signedError } = await supabase.storage.from('lease-pdfs')
    .createSignedUrl(receipt.storage_path, 900);
  if (signedError || !signed?.signedUrl) return jsonErr(500, 'Could not create a receipt download link.');

  return jsonOk({
    receipt,
    application: { app_id: app.app_id, first_name: app.first_name, last_name: app.last_name, property_address: app.property_address },
    signed_url: signed.signedUrl,
  });
});