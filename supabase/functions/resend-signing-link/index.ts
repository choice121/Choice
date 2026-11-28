/**
 * resend-signing-link -- Phase 05 + Multi-Applicant -- ADMIN ONLY
 *
 * Mints a fresh signing token for an existing application (tenant,
 * specific co-applicant via applicant_id, or amendment) and emails the new
 * signing URL to the signer. Any existing active token for the same
 * (app_id, role[, applicant_id][, amendment_id]) is revoked atomically.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { signingEmailHtml, coApplicantInviteHtml } from '../_shared/email.ts';
import { getSiteUrl } from '../_shared/config.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function logEmail(
  appId: string,
  type: string,
  recipient: string,
  status: string,
  provider = 'gas',
  errorMsg: string | null = null,
) {
  try {
    await supabase.from('email_logs').insert({
      app_id: appId,
      type,
      recipient,
      status,
      provider,
      error_msg: errorMsg,
    });
  } catch (_) {}
}

async function verifyAdmin(req: Request): Promise<{ ok: boolean; userId?: string; userEmail?: string; error?: string }> {
  const auth = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!auth) return { ok: false, error: 'Missing authorization header' };
  const { data: { user }, error } = await supabase.auth.getUser(auth);
  if (error || !user) return { ok: false, error: 'Invalid or expired token' };
  const { data: role } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).single();
  if (!role) return { ok: false, error: 'Not an admin' };
  return { ok: true, userId: user.id, userEmail: user.email };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const auth = await verifyAdmin(req);
  if (!auth.ok) return jsonErr(401, auth.error || 'Unauthorized');

  let body: { app_id?: string; role?: string; amendment_id?: string | null; applicant_id?: string | null; send_email?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonErr(400, 'Invalid JSON body');
  }

  const { app_id, role, amendment_id, applicant_id } = body;
  const sendNow = body.send_email !== false;

  if (!app_id) return jsonErr(400, 'Missing app_id');
  if (!role) return jsonErr(400, 'Missing role');
  if (!['tenant', 'co_applicant', 'amendment'].includes(role)) return jsonErr(400, 'Invalid role');
  if (role === 'amendment' && !amendment_id) return jsonErr(400, 'amendment_id required when role=amendment');

  // Resolve target co-applicant id if role=co_applicant and applicant_id omitted
  let targetApplicantId: string | null = applicant_id || null;
  if (role === 'co_applicant' && !targetApplicantId) {
    const { data: coList } = await supabase
      .from('application_applicants')
      .select('id, lease_signature')
      .eq('app_id', app_id)
      .eq('is_primary', false)
      .order('applicant_index', { ascending: true });
    if (coList && coList.length > 0) {
      const unsigned = coList.find((c: { lease_signature?: string | null }) => !c.lease_signature);
      targetApplicantId = unsigned?.id || coList[0].id;
    }
  }

  const { data: newTokenRaw, error: rpcErr } = await supabase.rpc('reissue_signing_token', {
    p_app_id:       app_id,
    p_role:         role,
    p_by:           auth.userEmail || 'admin',
    p_amendment_id: amendment_id || null,
    p_applicant_id: targetApplicantId,
  });
  if (rpcErr || !newTokenRaw) return jsonErr(500, 'Reissue failed: ' + (rpcErr?.message || 'unknown'));
  const newToken = String(newTokenRaw);

  const signingUrl = `${getSiteUrl()}/lease-sign.html?` +
    (role === 'amendment' ? `amendment_token=${newToken}` : `token=${newToken}`);

  const { data: app } = await supabase
    .from('applications')
    .select('first_name, last_name, email, property_address, has_co_applicant, current_lease_id')
    .eq('app_id', app_id)
    .single();

  if (app?.current_lease_id) {
    await supabase
      .from('lease_signing_tokens')
      .update({ lease_id: app.current_lease_id })
      .eq('token', newToken)
      .is('lease_id', null);
  }

  let toEmail = '';
  let toName  = '';
  let coRoleLabel = 'Co-Applicant';
  if (role === 'tenant' || role === 'amendment') {
    toEmail = app?.email || '';
    toName  = app?.first_name || 'Applicant';
  } else if (role === 'co_applicant') {
    if (targetApplicantId) {
      const { data: coApp } = await supabase
        .from('application_applicants')
        .select('first_name, last_name, email, applicant_type, role')
        .eq('id', targetApplicantId)
        .maybeSingle();
      toEmail = coApp?.email || '';
      toName  = coApp?.first_name || 'Applicant';
      if (coApp?.applicant_type === 'guarantor') coRoleLabel = 'Guarantor';
      else if (coApp?.applicant_type === 'co_signer') coRoleLabel = 'Co-Signer';
      else if (coApp?.role) coRoleLabel = coApp.role;
    }
    if (!toEmail) {
      const { data: co } = await supabase
        .from('co_applicants')
        .select('first_name, last_name, email')
        .eq('app_id', app_id)
        .maybeSingle();
      toEmail = co?.email || '';
      toName  = co?.first_name || 'Co-Applicant';
    }
  }

  let emailed = false;
  if (sendNow && toEmail) {
    try {
      const subject = role === 'co_applicant'
        ? `\u{1F4DD} New ${coRoleLabel} Signing Link -- Choice Properties (Ref: ${app_id})`
        : role === 'amendment'
          ? `\u{1F4DD} New Amendment Signing Link -- Choice Properties (Ref: ${app_id})`
          : `\u{1F4DD} New Lease Signing Link -- Choice Properties (Ref: ${app_id})`;
      const html = role === 'co_applicant'
        ? coApplicantInviteHtml(
            toName,
            `${app?.first_name || ''} ${app?.last_name || ''}`.trim() || 'the primary applicant',
            app?.property_address || '',
            signingUrl,
            app_id,
            coRoleLabel,
          )
        : signingEmailHtml(toName, app?.property_address || '', signingUrl, app_id);

      const resendResult = await sendEmail({ to: toEmail, subject, html });
      await logEmail(
        app_id,
        `resend_signing_link_${role}`,
        toEmail,
        resendResult.ok ? 'sent' : 'failed',
        resendResult.provider,
        resendResult.ok ? null : resendResult.error || 'failed',
      );
      emailed = resendResult.ok;
    } catch (e) {
      console.error('resend-signing-link email failed:', (e as Error).message);
    }
  }

  try {
    await supabase.from('admin_actions').insert({
      user_id:     auth.userId || null,
      action:      'signing_link_reissued',
      target_type: 'application',
      target_id:   app_id,
      metadata:    {
        actor:        auth.userEmail || 'admin',
        signer_role:  role,
        applicant_id: targetApplicantId,
        amendment_id: amendment_id || null,
        emailed,
        to_email:     toEmail || null,
      },
    });
  } catch (_) { /* non-fatal */ }

  return jsonOk({
    success:      true,
    new_token:    newToken,
    applicant_id: targetApplicantId,
    signing_url:  signingUrl,
    emailed,
  });
});
