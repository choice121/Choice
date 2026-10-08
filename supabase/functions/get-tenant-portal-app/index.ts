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

  let body: { app_id?: string };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }

  const appId = (body.app_id || '').trim();
  if (!appId) return jsonErr(400, 'Missing app_id');

  // Pull application record using service role client
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select(
      'id,app_id,created_at,updated_at,status,payment_status,payment_date,application_fee,' +
      'payment_amount_recorded,payment_method_recorded,payment_notes,' +
      'holding_fee_requested,holding_fee_amount,holding_fee_due_date,holding_fee_paid,holding_fee_paid_at,' +
      'payment_confirmed_at,payment_amount_collected,payment_method_confirmed,' +
      'first_name,last_name,email,property_address,property_id,' +
      'lease_status,lease_sent_date,lease_signed_date,monthly_rent,' +
      'tenant_sign_token,has_co_applicant,admin_notes,move_in_status,move_in_date_actual,move_in_notes'
    )
    .eq('app_id', appId)
    .maybeSingle();

  if (appErr || !app) {
    return jsonErr(404, 'Application not found');
  }

  // Pull property details & photos if available
  let property = null;
  if (app.property_id) {
    const { data: propData } = await supabase
      .from('properties')
      .select('id,address,city,state,zip,bedrooms,bathrooms,property_type,property_photos(url,display_order)')
      .eq('id', app.property_id)
      .maybeSingle();
    property = propData;
  }

  // Pull uploaded documents for this application
  const { data: docs } = await supabase
    .from('application_documents')
    .select('id,doc_type,status,file_name,created_at')
    .eq('app_id', appId);

  // Pull payment receipts issued for this application
  const { data: receipts } = await supabase
    .from('payment_receipts')
    .select('id,receipt_type,receipt_number,amount,currency,payment_method,transaction_ref,paid_at,issued_at,status')
    .eq('app_id', appId)
    .eq('status', 'issued')
    .order('issued_at', { ascending: false });

  return jsonOk({
    success: true,
    app,
    property,
    docs: docs || [],
    receipts: receipts || [],
  });
});
