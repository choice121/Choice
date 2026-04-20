/**
 * request-upload-url — Phase 8
 * Generates a signed Supabase Storage upload URL for post-approval
 * document submission by authenticated tenants.
 * The browser then uploads directly to storage using the signed URL.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';

const BUCKET = 'application-docs';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ALLOWED_DOC_TYPES = ['government_id', 'pay_stub', 'bank_statement', 'other'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Verify authenticated session (tenant must be logged in)
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return jsonErr(401, 'You must be signed in to upload documents.');

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return jsonErr(401, 'Invalid or expired session. Please sign in again.');

  let body: { app_id: string; file_name: string; file_type: string; doc_type: string };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }

  const { app_id, file_name, file_type, doc_type } = body;
  if (!app_id)    return jsonErr(400, 'Missing app_id');
  if (!file_name) return jsonErr(400, 'Missing file_name');
  if (!file_type) return jsonErr(400, 'Missing file_type');
  if (!doc_type)  return jsonErr(400, 'Missing doc_type');

  if (!ALLOWED_DOC_TYPES.includes(doc_type)) {
    return jsonErr(400, `Invalid doc_type. Allowed: ${ALLOWED_DOC_TYPES.join(', ')}`);
  }
  if (!ALLOWED_MIME_TYPES.includes(file_type)) {
    return jsonErr(400, `Invalid file_type. Allowed: JPEG, PNG, WEBP, or PDF`);
  }

  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('id, app_id, applicant_user_id, email, co_applicant_email, status')
    .eq('app_id', app_id)
    .single();

  if (appErr || !app) return jsonErr(404, 'Application not found');

  const { data: coapp } = await supabase
    .from('co_applicants')
    .select('email')
    .eq('app_id', app_id)
    .maybeSingle();
  const userEmail = (user.email || '').toLowerCase();
  const allowed = app.applicant_user_id === user.id
    || (app.email || '').toLowerCase() === userEmail
    || (app.co_applicant_email || '').toLowerCase() === userEmail
    || (coapp?.email || '').toLowerCase() === userEmail;

  if (!allowed) {
    return jsonErr(403, 'You do not have permission to upload documents for this application.');
  }

  const uploadableStatuses = ['approved', 'lease_sent', 'lease_signed', 'move_in_scheduled', 'move_in_confirmed'];
  if (!uploadableStatuses.includes(app.status)) {
    return jsonErr(403, 'Documents can only be uploaded after your application has been approved.');
  }

  // Sanitize filename (remove path traversal and special chars)
  const safeFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const storagePath  = `${app_id}/${doc_type}/${Date.now()}_${safeFileName}`;

  // Generate signed upload URL (valid for 10 minutes)
  const { data: signedData, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signErr || !signedData?.signedUrl) {
    return jsonErr(500, 'Could not generate upload URL: ' + (signErr?.message || 'unknown error'));
  }

  const { data: documentRow, error: documentErr } = await supabase
    .from('application_documents')
    .insert({
      app_id,
      application_id: app.id,
      user_id: user.id,
      bucket: BUCKET,
      storage_path: storagePath,
      original_file_name: safeFileName,
      mime_type: file_type,
      doc_type,
      status: 'pending_upload',
      uploaded_by_email: user.email,
    })
    .select('id')
    .single();

  if (documentErr) {
    return jsonErr(500, 'Could not record document metadata: ' + documentErr.message);
  }

  // Log upload request to admin_actions
  try {
    await supabase.from('admin_actions').insert({
      action:      `doc_upload_requested_${doc_type}`,
      target_type: 'application',
      target_id:   app_id,
      metadata:    { app_id, actor: user.email, doc_type, storage_path: storagePath, document_id: documentRow?.id },
    });
  } catch (_) {}

  return jsonOk({
    success:     true,
    signed_url:  signedData.signedUrl,
    storage_path: storagePath,
    document_id: documentRow?.id,
    bucket:      BUCKET,
  });
});
