/**
 * sign-lease-co-applicant — Phase 3
 *
 * Co-applicant counterpart to sign-lease. Same identity-verification
 * pattern (token + email match) and the same drawn-signature support,
 * but the email check targets the co-applicant's email rather than
 * the primary applicant's. Calls sign_lease_co_applicant() in the DB
 * and triggers the "Lease Fully Executed (pending management)" UI
 * downstream by setting status to 'co_signed'.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { coApplicantSignedHtml } from '../_shared/email.ts';
import { buildLeasePDF } from '../_shared/pdf.ts';
import { getAdminEmails, getAdminUrl } from '../_shared/config.ts';
import { resolveLeaseTemplate, buildPdfStoragePath } from '../_shared/lease-render.ts';

const ADMIN_EMAILS = getAdminEmails();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

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

  // Look up by co-applicant token
  const { data: preApp, error: preErr } = await supabase
    .from('applications')
    .select('id, app_id, first_name, last_name, property_address, lease_pdf_url, lease_template_version_id, has_co_applicant, tenant_signature')
    .eq('co_applicant_lease_token', token)
    .single();
  if (preErr || !preApp) {
    return jsonErr(400, 'This signing link is invalid or has already been used.');
  }
  if (!preApp.has_co_applicant) {
    return jsonErr(400, 'No co-applicant on this application.');
  }
  if (!preApp.tenant_signature) {
    return jsonErr(400, 'The primary applicant must sign first before the co-applicant can sign.');
  }

  // Pull co-applicant for email verification
  const { data: co } = await supabase
    .from('co_applicants').select('first_name, last_name, email')
    .eq('app_id', preApp.app_id).maybeSingle();
  if (!co?.email) {
    return jsonErr(400, 'Co-applicant record not found for this application.');
  }
  if (!applicant_email || applicant_email.trim().toLowerCase() !== co.email.toLowerCase()) {
    return jsonErr(403, 'The email you entered does not match our records. Please use the email the co-applicant was contacted at.');
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';

  const { error: signErr } = await supabase.rpc('sign_lease_co_applicant', {
    p_token:           token,
    p_signature:       signature,
    p_ip_address:      ip,
    p_user_agent:      user_agent || '',
    p_signature_image: signature_image || null,
  });
  if (signErr) return jsonErr(400, signErr.message || 'Signing failed. The link may have expired.');

  const { data: appSigned } = await supabase
    .from('applications').select('*').eq('id', preApp.id).single();

  if (appSigned) {
    // Versioned PDF re-gen using pinned template snapshot
    const tmpl = await resolveLeaseTemplate(supabase, appSigned);
    if (tmpl) {
      try {
        const pdfBytes = await buildLeasePDF(appSigned, tmpl.template_body);
        const { data: pv } = await supabase.rpc('record_lease_pdf_version', {
          p_app_id:              appSigned.app_id,
          p_event:               'co_signed',
          p_storage_path:        '',
          p_template_version_id: tmpl.version_id,
          p_amendment_id:        null,
          p_created_by:          co.email,
        });
        const versionNumber = (pv as { version_number?: number })?.version_number || 2;
        const path = buildPdfStoragePath(appSigned.app_id, versionNumber, 'co_signed');
        const { error: upErr } = await supabase.storage.from('lease-pdfs')
          .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: false });
        if (!upErr) {
          await supabase.from('lease_pdf_versions')
            .update({ storage_path: path, size_bytes: pdfBytes.byteLength })
            .eq('app_id', appSigned.app_id).eq('version_number', versionNumber);
          await supabase.from('applications')
            .update({ lease_pdf_url: path, updated_at: new Date().toISOString() })
            .eq('id', appSigned.id);
        }
      } catch (e) { console.error('PDF re-gen failed (non-fatal):', (e as Error).message); }
    }

    // Confirmation to co-applicant
    try {
      await sendEmail({
        to:      co.email,
        subject: `\u{2705} Co-Applicant Signature Received — Choice Properties (Ref: ${appSigned.app_id})`,
        html:    coApplicantSignedHtml(co.first_name || 'Co-Applicant', appSigned.property_address || '', appSigned.app_id),
      });
    } catch (e) { console.error('Co-applicant confirm email failed:', (e as Error).message); }

    // Notify admins
    const adminSubject = `[Co-Applicant Signed] ${co.first_name || ''} ${co.last_name || ''} — ${appSigned.app_id}`;
    const adminHtml = `<p><strong>Co-applicant signed</strong> by ${co.first_name || ''} ${co.last_name || ''} (${co.email})</p>
<p>Application: ${appSigned.app_id}<br>Property: ${appSigned.property_address}<br>Signed: ${new Date().toLocaleString('en-US')}</p>
<p>Status: <strong>${appSigned.lease_status}</strong> &middot; ready for management countersignature</p>
<p><a href="${getAdminUrl('/admin/leases.html')}">View in Admin Panel &rarr;</a></p>`;
    for (const adminEmail of ADMIN_EMAILS) {
      try { await sendEmail({ to: adminEmail, subject: adminSubject, html: adminHtml }); }
      catch (e) { console.error(`Admin notify (${adminEmail}) failed:`, (e as Error).message); }
    }

    try {
      await supabase.from('admin_actions').insert({
        action:      'co_applicant_signed_lease',
        target_type: 'application',
        target_id:   appSigned.app_id,
        metadata:    { app_id: appSigned.app_id, actor: co.email, has_image: !!signature_image },
      });
    } catch (_) {}
  }

  return jsonOk({ success: true, message: 'Co-applicant lease signed successfully.' });
});
