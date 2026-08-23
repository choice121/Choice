/**
 * download-lease -- Phase 10
 *
 * Returns a signed URL to a lease PDF after verifying the signed-in user
 * has access. Phase 10 accepts EITHER lease_id (preferred, addresses one
 * specific lease in the application's history) or app_id (legacy --
 * resolves to applications.current_lease_id, then most-recent fallback).
 *
 * Auth rules unchanged from Phase 04:
 *   * any admin
 *   * the application's owning auth user (applications.applicant_user_id)
 *   * any auth user whose email matches the primary applicant
 *   * any auth user whose email matches the co-applicant
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { resolveLease } from '../_shared/lease-resolve.ts';

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

  let lease_id: string | null = null;
  let app_id: string | null = null;
  if (req.method === 'POST') {
    try {
      const b = await req.json();
      lease_id = b.lease_id || null;
      app_id   = b.app_id   || null;
    } catch { return jsonErr(400, 'Invalid JSON'); }
  } else {
    const url = new URL(req.url);
    lease_id = url.searchParams.get('lease_id');
    app_id   = url.searchParams.get('app_id');
  }
  if (!lease_id && !app_id) return jsonErr(400, 'Missing lease_id or app_id');

  // Phase 10 -- resolve to the lease + app pair via the shared resolver.
  const resolved = await resolveLease(supabase, { lease_id, app_id });
  if (!resolved.ok) return jsonErr(resolved.status, resolved.error);
  const { lease, app } = resolved;

  // Lease PDF lives on leases.lease_pdf_url; for unbackfilled callers we
  // fall back to applications.lease_pdf_url so older flows still work.
  const pdfPath = lease.lease_pdf_url || (app as any).lease_pdf_url || null;
  if (!pdfPath) return jsonErr(404, 'Lease PDF not found for this application');

  // Auth check
  const { data: role } = await supabase
    .from('admin_roles').select('id').eq('user_id', user.id).maybeSingle();
  const { data: coapp } = await supabase
    .from('co_applicants').select('email').eq('app_id', app.app_id).maybeSingle();
  const userEmail = (user.email || '').toLowerCase();
  const allowed = !!role
    || app.applicant_user_id === user.id
    || (app.email || '').toLowerCase() === userEmail
    || (app.co_applicant_email || '').toLowerCase() === userEmail
    || (coapp?.email || '').toLowerCase() === userEmail;

  if (!allowed) return jsonErr(403, 'This lease is not linked to your signed-in email.');

  const { data: signed, error: signErr } = await supabase.storage
    .from('lease-pdfs').createSignedUrl(pdfPath, 3600);
  if (signErr) return jsonErr(500, 'Could not generate download link: ' + signErr.message);

  return jsonOk({
    signed_url: signed.signedUrl,
    signedUrl:  signed.signedUrl,
    lease_id:   lease.id,
    app_id:     app.app_id,
    lease_status: lease.lease_status,
    storage_path: pdfPath,
  });
});
