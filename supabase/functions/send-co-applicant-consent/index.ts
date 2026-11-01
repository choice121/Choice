/// <reference lib="deno.ns" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';
import { coApplicantScreeningConsentHtml } from '../_shared/email.ts';
import { getSiteUrl } from '../_shared/config.ts';
import { sendEmail } from '../_shared/send-email.ts';

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
  const applicationId = typeof body.application_id === 'string' ? body.application_id : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)) {
    return response(req, 400, { error: 'A valid application ID is required.' });
  }

  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .select('id, app_id, has_co_applicant, co_applicant_consent, co_applicant_email, co_applicant_first_name')
    .eq('id', applicationId)
    .maybeSingle();
  if (applicationError) {
    console.error('Application lookup failed for co-applicant consent invitation:', applicationError.message);
    return response(req, 500, { error: 'Could not load the application.' });
  }
  if (!application?.has_co_applicant || application.co_applicant_consent === true || !application.co_applicant_email) {
    return response(req, 409, { error: 'This application has no pending additional-adult screening consent.' });
  }

  const { error: revokeError } = await supabase
    .from('co_applicant_consent_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('application_id', applicationId)
    .is('consumed_at', null);
  if (revokeError) {
    console.error('Unable to revoke prior co-applicant consent links:', revokeError.message);
    return response(req, 500, { error: 'Could not prepare a new authorization link.' });
  }

  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...tokenBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const tokenHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const { error: tokenError } = await supabase.from('co_applicant_consent_tokens').insert({
    application_id: applicationId,
    token_hash: tokenHash,
    recipient_email: application.co_applicant_email,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (tokenError) {
    console.error('Co-applicant consent token insert failed:', tokenError.message);
    return response(req, 500, { error: 'Could not prepare a new authorization link.' });
  }

  const consentLink = `${getSiteUrl()}/co-applicant-consent.html#token=${token}`;
  const emailResult = await sendEmail({
    to: application.co_applicant_email,
    subject: `Action required: authorize screening for Choice Properties application ${application.app_id}`,
    html: coApplicantScreeningConsentHtml(application.co_applicant_first_name || 'Applicant', application.app_id, consentLink),
  });
  const { error: emailLogError } = await supabase.from('email_logs').insert({
    app_id: application.app_id,
    type: 'co_applicant_consent_invitation',
    recipient: application.co_applicant_email,
    status: emailResult.ok ? 'sent' : 'failed',
    provider: emailResult.provider,
    error_msg: emailResult.ok ? null : (emailResult.error || 'send failed'),
  });
  if (emailLogError) console.error('Consent invitation email log insert failed:', emailLogError.message);
  if (!emailResult.ok) {
    console.error('Co-applicant consent invitation email failed:', emailResult.error);
    return response(req, 502, { error: 'A new link was created, but the authorization email could not be sent. Please retry.' });
  }

  return response(req, 200, { success: true });
});
