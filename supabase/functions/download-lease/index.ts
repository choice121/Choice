import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function getAuthUser(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const user = await getAuthUser(req);
  if (!user) return jsonErr(401, 'Please sign in again to download your lease.');

  let app_id: string | null = null;
  if (req.method === 'POST') {
    try { const b = await req.json(); app_id = b.app_id; } catch { return jsonErr(400, 'Invalid JSON'); }
  } else {
    app_id = new URL(req.url).searchParams.get('app_id');
  }
  if (!app_id) return jsonErr(400, 'Missing app_id');

  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('app_id, applicant_user_id, email, co_applicant_email, lease_pdf_url')
    .eq('app_id', app_id)
    .single();
  if (appErr || !app) return jsonErr(404, 'Application not found');
  if (!app.lease_pdf_url) return jsonErr(404, 'Lease PDF not found for this application');

  const { data: role } = await supabase
    .from('admin_roles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  const { data: coapp } = await supabase
    .from('co_applicants')
    .select('email')
    .eq('app_id', app_id)
    .maybeSingle();
  const userEmail = (user.email || '').toLowerCase();
  const allowed = !!role
    || app.applicant_user_id === user.id
    || (app.email || '').toLowerCase() === userEmail
    || (app.co_applicant_email || '').toLowerCase() === userEmail
    || (coapp?.email || '').toLowerCase() === userEmail;

  if (!allowed) return jsonErr(403, 'This lease is not linked to your signed-in email.');

  const { data: signed, error: signErr } = await supabase.storage
    .from('lease-pdfs').createSignedUrl(app.lease_pdf_url, 3600);
  if (signErr) return jsonErr(500, 'Could not generate download link: ' + signErr.message);

  return jsonOk({ signed_url: signed.signedUrl, signedUrl: signed.signedUrl });
});