/**
 * sign-lease-co-applicant -- Phase 3 + Phase 05
 *
 * Co-applicant counterpart to sign-lease.  Phase 05 adds:
 *   * per-IP and per-token rate limiting (20/hr/IP, 5/hr/token)
 *   * E-SIGN consent gating (412 if no recent consent on file)
 *   * structured token-error mapping (410 expired/revoked/used)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { coApplicantSignedHtml } from '../_shared/email.ts';
import { getAdminEmails, getAdminUrl, getSiteUrl } from '../_shared/config.ts';

import { resolveLeaseTemplate, finalizeAndStorePdf } from '../_shared/lease-render.ts';
import { fetchAttachedAddenda } from '../_shared/lease-addenda.ts';
import { isDbRateLimited } from '../_shared/rate-limit.ts';
import { ESIGN_DISCLOSURE_VERSION } from '../_shared/esign-consent.ts';
import { mirrorAppToLease } from '../_shared/lease-mirror.ts';

const ADMIN_EMAILS = getAdminEmails();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function logEmail(appId: string, type: string, recipient: string, status: string, provider = 'gas', errorMsg: string | null = null) {
  try { await supabase.from('email_logs').insert({ app_id: appId, type, recipient, status, provider, error_msg: errorMsg }); } catch (_) {}
}

function mapTokenError(message: string): { status: number; body: string; already_signed?: boolean } {
  if (/TOKEN_EXPIRED/.test(message))       return { status: 410, body: message.replace(/^TOKEN_EXPIRED:?\s*/, '') || 'This signing link has expired.' };
  if (/TOKEN_REVOKED/.test(message))       return { status: 410, body: message.replace(/^TOKEN_REVOKED:?\s*/, '') || 'This signing link has been revoked.' };
  if (/TOKEN_ALREADY_USED/.test(message))  return { status: 409, body: 'This lease has already been signed.', already_signed: true };
  if (/TOKEN_NOT_FOUND/.test(message))     return { status: 404, body: 'This signing link is not recognized.' };
  if (/TOKEN_WRONG_ROLE/.test(message))    return { status: 400, body: 'This signing link is for a different signer.' };
  if (/TOKEN_IP_MISMATCH/.test(message))   return { status: 403, body: 'This signing link can only be used from the original network.' };
  return { status: 400, body: message || 'Signing failed. The link may have expired.' };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  let body: {
    token: string;
    signature: string;
    signature_image?: string;
    applicant_email?: string;
    user_agent?: string;
  };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }

  const { token, signature, signature_image, applicant_email, user_agent } = body;
  if (!token)     return jsonErr(400, 'Missing token');
  if (!signature) return jsonErr(400, 'Missing signature');
  if (signature.trim().length < 5) {
    return jsonErr(400, 'Signature must be at least 5 characters. Please type your full legal name.');
  }

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'unknown';
  if (await isDbRateLimited(ip, 'sign-lease-co-applicant', 20, 60 * 60 * 1000)) {
    return jsonErr(429, 'Too many signing attempts from this network. Please wait an hour and try again.');
  }
  if (await isDbRateLimited(ip, 'sign-lease-co-applicant:tok:' + token.slice(0, 16), 5, 60 * 60 * 1000)) {
    return jsonErr(429, 'This signing link has been used too many times in the last hour. Please wait and retry.');
  }

  // Look up token in lease_signing_tokens first, then fall back to legacy applications.co_applicant_lease_token
  const { data: tokRow } = await supabase
    .from('lease_signing_tokens')
    .select('app_id, applicant_id, signer_role')
    .eq('token', token)
    .maybeSingle();

  let preApp: Record<string, any> | null = null;
  if (tokRow?.app_id) {
    if (tokRow.signer_role !== 'co_applicant') {
      return jsonErr(400, 'This signing link is not a co-applicant signing link.');
    }
    const { data } = await supabase
      .from('applications')
      .select('id, app_id, first_name, last_name, property_address, lease_pdf_url, lease_template_version_id, has_co_applicant, tenant_signature')
      .eq('app_id', tokRow.app_id)
      .maybeSingle();
    preApp = data;
  } else {
    const { data } = await supabase
      .from('applications')
      .select('id, app_id, first_name, last_name, property_address, lease_pdf_url, lease_template_version_id, has_co_applicant, tenant_signature')
      .eq('co_applicant_lease_token', token)
      .maybeSingle();
    preApp = data;
  }

  if (!preApp) {
    return jsonErr(400, 'This signing link is invalid or has already been used.');
  }
  if (!preApp.tenant_signature) {
    return jsonErr(400, 'The primary applicant must sign first before co-applicants can sign.');
  }

  // Resolve specific additional signer record from application_applicants (fallback to legacy co_applicants)
  let co: { id?: string; first_name: string | null; last_name: string | null; email: string | null; role?: string | null; applicant_type?: string | null } | null = null;
  if (tokRow?.applicant_id) {
    const { data: appApplicant } = await supabase
      .from('application_applicants')
      .select('id, first_name, last_name, email, role, applicant_type')
      .eq('id', tokRow.applicant_id)
      .eq('app_id', preApp.app_id)
      .maybeSingle();
    co = appApplicant;
  }
  if (!co) {
    const { data: legacyCo } = await supabase
      .from('co_applicants').select('first_name, last_name, email')
      .eq('app_id', preApp.app_id).maybeSingle();
    co = legacyCo;
  }
  if (!co?.email) {
    return jsonErr(400, 'Co-applicant record not found for this application.');
  }
  if (!applicant_email || applicant_email.trim().toLowerCase() !== co.email.toLowerCase()) {
    return jsonErr(403, 'The email you entered does not match our records. Please use the email this co-applicant was contacted at.');
  }

  // Phase 05 -- E-SIGN consent must be on file for THIS specific co-applicant
  const { data: hasConsent } = await supabase.rpc('has_recent_esign_consent', {
    p_app_id:  preApp.app_id,
    p_email:   co.email,
    p_version: ESIGN_DISCLOSURE_VERSION,
  });
  if (!hasConsent) {
    return jsonErr(412, 'E-SIGN consent has not been recorded for this signer. Please complete the consent step before signing.');
  }

  const { error: signErr } = await supabase.rpc('sign_lease_co_applicant', {
    p_token:           token,
    p_signature:       signature,
    p_ip_address:      ip,
    p_user_agent:      user_agent || '',
    p_signature_image: signature_image || null,
  });
  if (signErr) {
    const m = mapTokenError(signErr.message || '');
    if (m.already_signed) {
      const corsH = handleCors(req);
      const headers = { 'Content-Type': 'application/json', ...(corsH ? Object.fromEntries(corsH.headers) : {}) };
      return new Response(JSON.stringify({ error: m.body, already_signed: true }), { status: 409, headers });
    }
    return jsonErr(m.status, m.body);
  }

  const { data: appSigned } = await supabase
    .from('applications').select('*').eq('id', preApp.id).single();

  // Mirror signature into leases + reload safe co-applicants
  let mirroredLeaseId: string | null = null;
  if (appSigned) {
    const mir = await mirrorAppToLease(supabase, appSigned, 'co_applicant_signed');
    if (mir.ok) mirroredLeaseId = mir.lease_id;
    else console.error('mirrorAppToLease failed (non-fatal):', mir.error);
  }

  const { data: coRowsSafe } = await supabase
    .from('application_applicants')
    .select('id,applicant_index,applicant_type,is_primary,role,first_name,last_name,email,lease_signature,lease_signed_at')
    .eq('app_id', preApp.app_id)
    .eq('is_primary', false)
    .order('applicant_index', { ascending: true });

  const remainingCoSigners = (coRowsSafe || []).filter((c: { lease_signature?: string | null }) => !c.lease_signature);
  const allCoSigned = appSigned?.lease_status === 'co_signed' || remainingCoSigners.length === 0;

  if (appSigned) {
    const tmpl = await resolveLeaseTemplate(supabase, appSigned);
    if (tmpl) {
      try {
        const attachedAddenda = await fetchAttachedAddenda(supabase, appSigned.app_id);
        const signedCoRows = (coRowsSafe || []).filter((c: { lease_signature?: string | null }) => !!c.lease_signature);
        const certCoSigners = signedCoRows.length > 0
          ? signedCoRows.map((c: Record<string, any>) => ({
              role:       (c.applicant_type === 'guarantor' ? 'guarantor' : c.applicant_type === 'co_signer' ? 'co_signer' : 'co_applicant') as 'co_applicant' | 'guarantor' | 'co_signer',
              name:       c.lease_signature || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
              email:      c.email,
              signed_at:  c.lease_signed_at || new Date().toISOString(),
              ip:         (c.id === co?.id ? ip : null),
              user_agent: (c.id === co?.id ? (user_agent || null) : null),
            }))
          : [{
              role:       (co?.applicant_type === 'guarantor' ? 'guarantor' : co?.applicant_type === 'co_signer' ? 'co_signer' : 'co_applicant') as 'co_applicant' | 'guarantor' | 'co_signer',
              name:       signature,
              email:      co.email,
              signed_at:  appSigned.co_applicant_signature_timestamp || new Date().toISOString(),
              ip:         ip,
              user_agent: user_agent || null,
            }];

        const fin = await finalizeAndStorePdf({
          supabase,
          app_id:              appSigned.app_id,
          app:                 { ...appSigned, _co_applicants: coRowsSafe || [] },
          templateText:        tmpl.template_body,
          templateVersionId:   tmpl.version_id,
          templateVersion:     tmpl.version_number || null,
          event:               allCoSigned ? 'co_signed' : 'tenant_signed',
          createdBy:           co.email,
          addenda:             attachedAddenda,
          addendaAssetBaseUrl: getSiteUrl(),
          updateAppPointer:    true,
          certificate: {
            state_code:        appSigned.lease_state_code || null,
            edge_function_tag: 'sign-lease-co-applicant@phase10',
            site_url:          getSiteUrl(),
            signers: [
              {
                role:       'tenant',
                name:       appSigned.tenant_signature || `${appSigned.first_name || ''} ${appSigned.last_name || ''}`.trim(),
                email:      appSigned.email,
                signed_at:  appSigned.signature_timestamp || null,
                ip:         appSigned.lease_ip_address || null,
                user_agent: appSigned.lease_user_agent || null,
              },
              ...certCoSigners,
            ],
          },
        });
        if (!fin.ok) console.error('PDF finalize failed:', fin.error);
      } catch (e) { console.error('PDF re-gen failed (non-fatal):', (e as Error).message); }
    }

    const signerRoleLabel = co.applicant_type === 'guarantor'
      ? 'Guarantor'
      : co.applicant_type === 'co_signer'
        ? 'Co-Signer'
        : (co.role || 'Co-Applicant');

    try {
      const coResult = await sendEmail({
        to:      co.email,
        subject: `\u{2705} ${signerRoleLabel} Signature Received -- Choice Properties (Ref: ${appSigned.app_id})`,
        html:    coApplicantSignedHtml(co.first_name || signerRoleLabel, appSigned.property_address || '', appSigned.app_id, signerRoleLabel),
      });
      await logEmail(appSigned.app_id, 'co_applicant_signed_confirm', co.email, coResult.ok ? 'sent' : 'failed', coResult.provider, coResult.ok ? null : (coResult.error || 'failed'));
    } catch (e) { console.error('Co-applicant confirm email failed:', (e as Error).message); }

    const adminSubject = `[${signerRoleLabel} Signed] ${co.first_name || ''} ${co.last_name || ''} -- ${appSigned.app_id}`;
    const nextNote = allCoSigned
      ? 'all required signers have signed &middot; ready for management countersignature'
      : `waiting on ${remainingCoSigners.length} additional signature(s)`;
    const adminHtml = `<p><strong>${signerRoleLabel} signed</strong> by ${co.first_name || ''} ${co.last_name || ''} (${co.email})</p>
<p>Application: ${appSigned.app_id}<br>Property: ${appSigned.property_address}<br>Signed: ${new Date().toLocaleString('en-US')}</p>
<p>Status: <strong>${appSigned.lease_status}</strong> &middot; ${nextNote}</p>
<p><a href="${getAdminUrl('/admin/leases.html')}">View in Admin Panel &rarr;</a></p>`;
    for (const adminEmail of ADMIN_EMAILS) {
      try {
        const adminResult = await sendEmail({ to: adminEmail, subject: adminSubject, html: adminHtml });
        await logEmail(appSigned.app_id, 'co_applicant_signed_admin', adminEmail, adminResult.ok ? 'sent' : 'failed', adminResult.provider, adminResult.ok ? null : (adminResult.error || 'failed'));
      } catch (e) { console.error('Admin notify failed:', (e as Error).message); }
    }

    try {
      await supabase.from('admin_actions').insert({
        action:      'co_applicant_signed_lease',
        target_type: 'application',
        target_id:   appSigned.app_id,
        metadata:    { app_id: appSigned.app_id, actor: co.email, applicant_id: co.id || null, remaining_co_signers: remainingCoSigners.length, has_image: !!signature_image },
      });
    } catch (_) {}
  }

  return jsonOk({
    success: true,
    lease_id: mirroredLeaseId,
    all_co_applicants_signed: allCoSigned,
    remaining_co_signers: remainingCoSigners.length,
    message: 'Co-applicant lease signed successfully.',
  });
});
