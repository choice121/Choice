import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { issuePaymentReceipt, type ReceiptType } from '../_shared/payment-receipts.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonErr(405, 'POST required');

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return jsonErr(401, 'Unauthorized');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return jsonErr(401, 'Unauthorized');
  const { data: role } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).maybeSingle();
  if (!role) return jsonErr(403, 'Administrator access required');

  let body: { app_id?: string; receipt_type?: ReceiptType };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }
  if (!body.app_id || !['application_fee', 'holding_deposit'].includes(body.receipt_type || '')) {
    return jsonErr(400, 'Valid app_id and receipt_type are required');
  }

  const { data: app, error: appError } = await supabase.from('applications')
    .select('*').eq('app_id', body.app_id).maybeSingle();
  if (appError || !app) return jsonErr(404, 'Application not found');

  try {
    const receipt = await issuePaymentReceipt(supabase, app as Record<string, unknown>, body.receipt_type!, user.id);
    await supabase.from('admin_actions').insert({
      action: 'issue_payment_receipt',
      target_type: 'application',
      target_id: body.app_id,
      metadata: { app_id: body.app_id, receipt_id: receipt.id, receipt_number: receipt.receipt_number, actor: user.email },
    });
    return jsonOk({ receipt });
  } catch (error) {
    return jsonErr(500, (error as Error).message || 'Could not issue receipt');
  }
});