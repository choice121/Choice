/**
 * request-upload-url — Phase 8
 * Generates a signed Supabase Storage upload URL for post-approval
 * document submission by authenticated tenants.
 * The browser then uploads directly to storage using the signed URL.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { verifyPortalUploadToken, type PortalUploadClaims } from '../_shared/upload-token.ts';

const BUCKET = 'application-docs';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ALLOWED_DOC_TYPES = ['government_id', 'pay_stub', 'bank_statement', 'proof_of_income', 'guarantor_support', 'applicant_upload', 'other'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const CONSENT_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

async function sha256Hex(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  let body: {
    action?: string;
    app_id?: string;
    file_name?: string;
    file_type?: string;
    doc_type?: string;
    doc_side?: string;
    applicant_id?: string;
    applicant_index?: number;
    document_id?: string;
    consent_token?: string;
    portal_upload_token?: string;
  };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body', req); }

  const bearer = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  const consentToken = String(body.consent_token || '').trim();
  const portalUploadToken = String(body.portal_upload_token || '').trim();

  let user: { id: string; email?: string } | null = null;
  let tokenRec: { application_id: string; applicant_id: string | null; recipient_email: string } | null = null;
  let portalClaims: PortalUploadClaims | null = null;

  if (bearer) {
    const { data, error: authErr } = await supabase.auth.getUser(bearer);
    if (!authErr && data?.user) user = data.user;
  }

  if (!user && consentToken) {
    if (!CONSENT_TOKEN_RE.test(consentToken)) return jsonErr(401, 'Invalid consent token.', req);
    const hash = await sha256Hex(consentToken);
    const { data: tok } = await supabase
      .from('co_applicant_consent_tokens')
      .select('application_id, applicant_id, recipient_email, expires_at, consumed_at, revoked_at')
      .eq('token_hash', hash)
      .maybeSingle();
    if (!tok || tok.revoked_at || tok.consumed_at || new Date(tok.expires_at).getTime() <= Date.now()) {
      return jsonErr(401, 'Your private link is invalid or expired.', req);
    }
    tokenRec = tok;
  }

  if (!user && !tokenRec && portalUploadToken) {
    portalClaims = await verifyPortalUploadToken(portalUploadToken);
    if (!portalClaims) {
      return jsonErr(401, 'Upload session expired. Please refresh your portal and try again.', req);
    }
  }

  if (!user && !tokenRec && !portalClaims) {
    return jsonErr(401, 'You must be signed in or provide a valid upload link.', req);
  }

  if (body.action === 'mark_uploaded') {
    if (!body.document_id) return jsonErr(400, 'Missing document_id', req);
    const { data: docRow } = await supabase
      .from('application_documents')
      .select('id, app_id, application_id, applicant_id, uploaded_by_email')
      .eq('id', body.document_id)
      .maybeSingle();
    if (!docRow) return jsonErr(404, 'Document not found', req);

    if (tokenRec) {
      if (docRow.application_id !== tokenRec.application_id) return jsonErr(403, 'Forbidden', req);
      if (tokenRec.applicant_id && docRow.applicant_id !== tokenRec.applicant_id) return jsonErr(403, 'Forbidden', req);
    } else if (portalClaims) {
      if (String(docRow.app_id || '').toUpperCase() !== portalClaims.app_id.toUpperCase()) {
        return jsonErr(403, 'Forbidden', req);
      }
    } else if (user) {
      const { data: applicantRows } = await supabase
        .from('application_applicants')
        .select('email')
        .eq('app_id', docRow.app_id);
      const userEmail = (user.email || '').toLowerCase();
      const isHousehold = (applicantRows || []).some((a: { email?: string }) => (a.email || '').toLowerCase() === userEmail);
      const { data: appOwner } = await supabase
        .from('applications')
        .select('applicant_user_id, email')
        .eq('app_id', docRow.app_id)
        .maybeSingle();
      if (!isHousehold && appOwner?.applicant_user_id !== user.id && (appOwner?.email || '').toLowerCase() !== userEmail) {
        return jsonErr(403, 'Forbidden', req);
      }
    }

    await supabase
      .from('application_documents')
      .update({ status: 'uploaded' })
      .eq('id', docRow.id);
    return jsonOk({ success: true, document_id: docRow.id, status: 'uploaded' }, req);
  }

  const { app_id, file_name, file_type, doc_type, applicant_id, applicant_index, doc_side } = body;
  const resolvedAppIdParam = app_id || portalClaims?.app_id || '';
  if (!resolvedAppIdParam && !tokenRec) return jsonErr(400, 'Missing app_id', req);
  if (!file_name) return jsonErr(400, 'Missing file_name', req);
  if (!file_type) return jsonErr(400, 'Missing file_type', req);
  if (!doc_type)  return jsonErr(400, 'Missing doc_type', req);

  if (!ALLOWED_DOC_TYPES.includes(doc_type)) {
    return jsonErr(400, `Invalid doc_type. Allowed: ${ALLOWED_DOC_TYPES.join(', ')}`, req);
  }
  if (!ALLOWED_MIME_TYPES.includes(file_type)) {
    return jsonErr(400, 'Invalid file_type. Allowed: JPEG, PNG, WEBP, or PDF', req);
  }

  const appQuery = supabase
    .from('applications')
    .select('id, app_id, applicant_user_id, email, co_applicant_email, status');
  const { data: app, error: appErr } = tokenRec
    ? await appQuery.eq('id', tokenRec.application_id).single()
    : await appQuery.eq('app_id', resolvedAppIdParam).single();

  if (appErr || !app) return jsonErr(404, 'Application not found', req);

  const [{ data: coapp }, { data: applicantRows }] = await Promise.all([
    supabase.from('co_applicants').select('email').eq('app_id', app.app_id).maybeSingle(),
    supabase.from('application_applicants').select('id, applicant_index, email, is_primary').eq('app_id', app.app_id),
  ]);

  let resolvedApplicantId: string | null = null;
  let resolvedApplicantIndex = 0;
  let actorEmail = '';

  if (tokenRec) {
    actorEmail = tokenRec.recipient_email;
    const matched = tokenRec.applicant_id
      ? (applicantRows || []).find((a: { id: string }) => a.id === tokenRec!.applicant_id)
      : (applicantRows || []).find((a: { email?: string }) => (a.email || '').toLowerCase() === tokenRec!.recipient_email.toLowerCase());
    if (!matched) return jsonErr(403, 'Invitation link does not match an applicant record.', req);
    resolvedApplicantId = matched.id;
    resolvedApplicantIndex = Number(matched.applicant_index ?? 1);
  } else if (portalClaims) {
    if (String(app.app_id || '').toUpperCase() !== portalClaims.app_id.toUpperCase()) {
      return jsonErr(403, 'Upload token does not match this application.', req);
    }
    actorEmail = portalClaims.email || app.email || '';
    if (applicant_id) {
      const requestedApplicant = (applicantRows || []).find((a: { id: string }) => a.id === applicant_id);
      if (!requestedApplicant) return jsonErr(400, 'Invalid applicant_id for this application.', req);
      resolvedApplicantId = requestedApplicant.id;
      resolvedApplicantIndex = Number(requestedApplicant.applicant_index ?? 0);
    } else if (typeof applicant_index === 'number' && Number.isFinite(applicant_index)) {
      const byIdx = (applicantRows || []).find((a: { applicant_index?: number }) => Number(a.applicant_index) === applicant_index);
      const primaryApplicant = (applicantRows || []).find((a: { id: string; is_primary?: boolean }) => a.is_primary);
      resolvedApplicantId = byIdx?.id || primaryApplicant?.id || null;
      resolvedApplicantIndex = Number(byIdx?.applicant_index ?? applicant_index);
    } else {
      const primaryApplicant = (applicantRows || []).find((a: { id: string; is_primary?: boolean }) => a.is_primary);
      resolvedApplicantId = primaryApplicant?.id || null;
      resolvedApplicantIndex = Number(primaryApplicant?.applicant_index ?? 0);
    }
  } else if (user) {
    actorEmail = user.email || '';
    const userEmail = actorEmail.toLowerCase();
    const matchedApplicant = (applicantRows || []).find((a: { id: string; email?: string }) =>
      (a.email || '').toLowerCase() === userEmail
    );
    const allowed = app.applicant_user_id === user.id
      || (app.email || '').toLowerCase() === userEmail
      || (app.co_applicant_email || '').toLowerCase() === userEmail
      || (coapp?.email || '').toLowerCase() === userEmail
      || !!matchedApplicant;

    if (!allowed) {
      return jsonErr(403, 'You do not have permission to upload documents for this application.', req);
    }

    if (applicant_id) {
      const requestedApplicant = (applicantRows || []).find((a: { id: string }) => a.id === applicant_id);
      if (!requestedApplicant) return jsonErr(400, 'Invalid applicant_id for this application.', req);
      resolvedApplicantId = requestedApplicant.id;
      resolvedApplicantIndex = Number(requestedApplicant.applicant_index ?? 0);
    } else if (matchedApplicant) {
      resolvedApplicantId = matchedApplicant.id;
      resolvedApplicantIndex = Number(matchedApplicant.applicant_index ?? 0);
    } else {
      const primaryApplicant = (applicantRows || []).find((a: { id: string; is_primary?: boolean }) => a.is_primary);
      resolvedApplicantId = primaryApplicant?.id || null;
      resolvedApplicantIndex = Number(primaryApplicant?.applicant_index ?? 0);
    }
  }

  const uploadableStatuses = ['pending', 'under_review', 'additional_info_required', 'waitlisted', 'approved', 'lease_sent', 'lease_signed', 'move_in_scheduled', 'move_in_confirmed'];
  if (!uploadableStatuses.includes(app.status)) {
    return jsonErr(403, 'Documents cannot be uploaded for this application status.', req);
  }

  const safeFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const storagePath  = `${app.app_id}/applicant_${resolvedApplicantIndex}/${Date.now()}_${safeFileName}`;

  const { data: signedData, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signErr || !signedData?.signedUrl) {
    return jsonErr(500, 'Could not generate upload URL: ' + (signErr?.message || 'unknown error'), req);
  }

  const cleanSide = doc_side === 'front' || doc_side === 'back' ? doc_side : null;
  const { data: documentRow, error: documentErr } = await supabase
    .from('application_documents')
    .insert({
      app_id: app.app_id,
      application_id: app.id,
      applicant_id: resolvedApplicantId,
      user_id: user?.id || null,
      bucket: BUCKET,
      storage_path: storagePath,
      original_file_name: safeFileName,
      mime_type: file_type,
      doc_type,
      status: 'pending_upload',
      uploaded_by_email: actorEmail,
      metadata: {
        ...(cleanSide ? { doc_side: cleanSide } : {}),
        upload_channel: tokenRec ? 'consent_link' : (portalClaims ? 'portal_guest' : 'authenticated'),
      },
    })
    .select('id')
    .single();

  if (documentErr) {
    return jsonErr(500, 'Could not record document metadata: ' + documentErr.message, req);
  }

  try {
    await supabase.from('admin_actions').insert({
      action:      `doc_upload_requested_${doc_type}`,
      target_type: 'application',
      target_id:   app.app_id,
      metadata:    { app_id: app.app_id, actor: actorEmail, doc_type, storage_path: storagePath, document_id: documentRow?.id },
    });
  } catch (_) {}

  return jsonOk({
    success:      true,
    signed_url:   signedData.signedUrl,
    storage_path: storagePath,
    document_id:  documentRow?.id,
    applicant_id: resolvedApplicantId,
    bucket:       BUCKET,
  }, req);
});
