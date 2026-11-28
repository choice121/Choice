/// <reference lib="deno.ns" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';
import { coApplicantScreeningConsentHtml } from '../_shared/email.ts';
import { getSiteUrl } from '../_shared/config.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { getRoleDisplayLabel, normalizeApplicantType, normalizeSubmissionMethod } from '../_shared/application-rules.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function response(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req.headers.get('origin')),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return response(req, 405, { error: 'Method not allowed.' });

  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return response(req, 401, { error: 'Administrator sign-in is required.' });

  const { data: authData, error: authError } = await supabase.auth.getUser(bearer);
  if (authError || !authData.user) return response(req, 401, { error: 'Your administrator session is invalid or expired.' });

  const { data: adminRole, error: roleError } = await supabase
    .from('admin_roles')
    .select('user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (roleError) {
    console.error('Admin role lookup failed for co-applicant consent invitation:', roleError.message);
    return response(req, 500, { error: 'Could not verify administrator permissions.' });
  }
  if (!adminRole) return response(req, 403, { error: 'Administrator access is required.' });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return response(req, 400, { error: 'An application ID is required.' });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return response(req, 400, { error: 'Invalid request body.' });
  }

  const applicationId = typeof body.application_id === 'string' ? body.application_id.trim() : '';
  const targetApplicantId = typeof body.applicant_id === 'string' && UUID_RE.test(body.applicant_id.trim())
    ? body.applicant_id.trim()
    : null;

  if (!UUID_RE.test(applicationId)) {
    return response(req, 400, { error: 'A valid application ID is required.' });
  }

  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .select('id, app_id, first_name, last_name, property_address, preferred_language, has_co_applicant, co_applicant_consent, co_applicant_email, co_applicant_first_name, household_payment_mode, application_fee_per_adult')
    .eq('id', applicationId)
    .maybeSingle();
  if (applicationError) {
    console.error('Application lookup failed:', applicationError.message);
    return response(req, 500, { error: 'Could not load the application.' });
  }
  if (!application) return response(req, 404, { error: 'Application not found.' });

  // Fetch unconsented additional adults from normalized table
  let query = supabase
    .from('application_applicants')
    .select('id, email, first_name, role, applicant_type, submission_method, screening_consent')
    .eq('application_id', applicationId)
    .eq('is_primary', false)
    .neq('screening_consent', true);

  if (targetApplicantId) query = query.eq('id', targetApplicantId);

  const { data: pendingRows } = await query;
  const targets: Array<{ id: string | null; email: string; first_name: string; applicant_type: string; submission_method: string }> = (pendingRows || [])
    .filter(r => r.email)
    .map(r => ({
      id: r.id as string,
      email: String(r.email),
      first_name: String(r.first_name || 'Applicant'),
      applicant_type: normalizeApplicantType(r.applicant_type || r.role, false),
      submission_method: normalizeSubmissionMethod(r.submission_method),
    }));

  // Legacy fallback if normalized table had no pending rows
  if (targets.length === 0 && !targetApplicantId && application.has_co_applicant && application.co_applicant_consent !== true && application.co_applicant_email) {
    targets.push({
      id: null,
      email: application.co_applicant_email,
      first_name: application.co_applicant_first_name || 'Applicant',
      applicant_type: 'co_applicant',
      submission_method: 'primary_completed',
    });
  }

  if (targets.length === 0) {
    return response(req, 409, { error: 'This application has no pending additional member authorization.' });
  }

  const locale: 'en' | 'es' = String(application.preferred_language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
  const primaryName = `${application.first_name || ''} ${application.last_name || ''}`.trim();
  let sentCount = 0;
  const failures: string[] = [];

  for (const t of targets) {
    // Revoke prior unconsumed tokens for this recipient/applicant
    let revokeQ = supabase
      .from('co_applicant_consent_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('application_id', applicationId)
      .is('consumed_at', null);

    if (t.id) {
      revokeQ = revokeQ.eq('applicant_id', t.id);
    } else {
      revokeQ = revokeQ.ilike('recipient_email', t.email);
    }
    await revokeQ;

    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = btoa(String.fromCharCode(...tokenBytes))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const tokenHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    const { error: tokenError } = await supabase.from('co_applicant_consent_tokens').insert({
      application_id: applicationId,
      applicant_id: t.id,
      token_hash: tokenHash,
      recipient_email: t.email,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (tokenError) {
      failures.push(`${t.email}: ${tokenError.message}`);
      continue;
    }

    const appType = normalizeApplicantType(t.applicant_type, false);
    const subMethod = normalizeSubmissionMethod(t.submission_method);
    const consentLink = `${getSiteUrl()}/co-applicant-consent.html#token=${token}`;
    const subject = locale === 'es'
      ? (subMethod === 'invited'
          ? `Acción requerida: complete sus datos y autorice evaluación (${application.app_id})`
          : `Acción requerida: autorice su evaluación de alquiler (${application.app_id})`)
      : (subMethod === 'invited'
          ? `Action required: complete your details & authorize screening (${application.app_id})`
          : `Action required: authorize screening for Choice Properties application ${application.app_id}`);

    const emailResult = await sendEmail({
      to: t.email,
      subject,
      html: coApplicantScreeningConsentHtml(t.first_name, application.app_id, consentLink, {
        applicantType: appType,
        roleLabel: getRoleDisplayLabel(appType, locale),
        submissionMethod: subMethod,
        primaryName,
        propertyAddress: application.property_address || '',
        locale,
      }),
    });
    await supabase.from('email_logs').insert({
      app_id: application.app_id,
      type: 'co_applicant_consent_invitation',
      recipient: t.email,
      status: emailResult.ok ? 'sent' : 'failed',
      provider: emailResult.provider,
      error_msg: emailResult.ok ? null : (emailResult.error || 'send failed'),
    });

    if (emailResult.ok) sentCount++;
    else failures.push(`${t.email}: ${emailResult.error || 'send failed'}`);
  }

  if (sentCount === 0 && failures.length > 0) {
    return response(req, 502, { error: 'Could not send the authorization email(s): ' + failures.join('; ') });
  }

  return response(req, 200, { success: true, sent_count: sentCount, failures });
});
