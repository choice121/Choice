import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail }                   from '../_shared/send-email.ts';
import { signedConfirmHtml, coApplicantInviteHtml } from '../_shared/email.ts';
import { buildLeasePDF }               from '../_shared/pdf.ts';
import { getAdminEmails, getAdminUrl, getSiteUrl }  from '../_shared/config.ts';
import { resolveLeaseTemplate, recordPdfVersion, buildPdfStoragePath } from '../_shared/lease-render.ts';

const ADMIN_EMAILS = getAdminEmails();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Phase 3 — accept signature_image (data-URL) alongside typed name.
  // The typed name remains the legally binding signature; the image
  // is an additional verification artifact.
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

  // Identity pre-check by token
  const { data: preApp, error: preErr } = await supabase
    .from('applications')
    .select('id, app_id, email, first_name, last_name, property_address, lease_pdf_url, lease_template_version_id, has_co_applicant')
    .eq('tenant_sign_token', token)
    .single();
  if (preErr || !preApp) {
    return jsonErr(400, 'This signing link is invalid or has already been used.');
  }
  if (!applicant_email || applicant_email.trim().toLowerCase() !== (preApp.email || '').toLowerCase()) {
    return jsonErr(403, 'The email you entered does not match our records. Please use the same email address you applied with.');
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';

  // DB sign (uses 5-arg sign_lease_tenant from Phase 3 migration)
  const { error: signErr } = await supabase.rpc('sign_lease_tenant', {
    p_token:           token,
    p_signature:       signature,
    p_ip_address:      ip,
    p_user_agent:      user_agent || '',
    p_signature_image: signature_image || null,
  });
  if (signErr) return jsonErr(400, signErr.message || 'Signing failed. The link may have expired.');

  // Reload after signing
  const { data: appSigned } = await supabase
    .from('applications').select('*').eq('id', preApp.id).single();

  if (appSigned) {
    // Re-render PDF using the pinned template snapshot (Phase 2)
    const tmpl = await resolveLeaseTemplate(supabase, appSigned);
    if (tmpl) {
      try {
        const pdfBytes = await buildLeasePDF(appSigned, tmpl.template_body);
        // Phase 4 — versioned PDF write (no overwrite)
        const { data: pv } = await supabase.rpc('record_lease_pdf_version', {
          p_app_id:              appSigned.app_id,
          p_event:               'tenant_signed',
          p_storage_path:        '',                 // path computed after we know the version_number
          p_template_version_id: tmpl.version_id,
          p_amendment_id:        null,
          p_created_by:          appSigned.email,
        });
        // The RPC already inserted with an empty path; build the real
        // path using the returned version_number, upload, then update.
        const versionNumber = (pv as { version_number?: number })?.version_number || 1;
        const path = buildPdfStoragePath(appSigned.app_id, versionNumber, 'tenant_signed');
        const { error: upErr } = await supabase.storage.from('lease-pdfs')
          .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: false });
        if (!upErr) {
          await supabase.from('lease_pdf_versions')
            .update({ storage_path: path, size_bytes: pdfBytes.byteLength })
            .eq('app_id', appSigned.app_id).eq('version_number', versionNumber);
          await supabase.from('applications')
            .update({ lease_pdf_url: path, updated_at: new Date().toISOString() })
            .eq('id', appSigned.id);
        } else {
          console.error('Versioned PDF upload failed:', upErr.message);
        }
      } catch (e) { console.error('PDF re-gen failed (non-fatal):', (e as Error).message); }
    }

    // Phase 3 — if has_co_applicant, send invitation to the co-applicant
    if (appSigned.has_co_applicant && appSigned.co_applicant_lease_token) {
      try {
        const { data: co } = await supabase
          .from('co_applicants').select('first_name, last_name, email')
          .eq('app_id', appSigned.app_id).maybeSingle();
        if (co?.email) {
          const signingUrl = `${getSiteUrl()}/lease-sign.html?token=${appSigned.co_applicant_lease_token}`;
          await sendEmail({
            to:      co.email,
            subject: `\u{1F4DD} Your Co-Applicant Lease is Ready to Sign — Choice Properties (Ref: ${appSigned.app_id})`,
            html:    coApplicantInviteHtml(
              co.first_name || 'Co-Applicant',
              `${appSigned.first_name || ''} ${appSigned.last_name || ''}`.trim() || 'the primary applicant',
              appSigned.property_address || '',
              signingUrl,
              appSigned.app_id,
            ),
          });
        }
      } catch (e) { console.error('Co-applicant invite email failed (non-fatal):', (e as Error).message); }
    }

    // Confirmation email to tenant
    try {
      const leaseData = (appSigned.lease_start_date || appSigned.monthly_rent || appSigned.move_in_costs) ? {
        startDate:   appSigned.lease_start_date || undefined,
        endDate:     appSigned.lease_end_date   || undefined,
        rent:        appSigned.monthly_rent     || undefined,
        moveInCost:  appSigned.move_in_costs    || undefined,
      } : undefined;
      await sendEmail({
        to:      appSigned.email,
        subject: `\u{1F389} Lease Signed — Welcome to Choice Properties (Ref: ${appSigned.app_id})`,
        html:    signedConfirmHtml(appSigned.first_name || 'Applicant', appSigned.property_address || '', appSigned.app_id, leaseData),
      });
    } catch (e) { console.error('Tenant confirm email failed:', (e as Error).message); }

    // Notify admins
    const adminSubject = `[Lease Signed] ${appSigned.first_name || ''} ${appSigned.last_name || ''} — ${appSigned.app_id}`;
    const adminHtml = `<p><strong>Lease signed</strong> by ${appSigned.first_name || ''} ${appSigned.last_name || ''} (${appSigned.email})</p>
<p>Application: ${appSigned.app_id}<br>Property: ${appSigned.property_address}<br>Signed: ${new Date().toLocaleString('en-US')}</p>
<p>Status: <strong>${appSigned.lease_status}</strong>${appSigned.has_co_applicant ? ' &middot; co-applicant invited to sign' : ''}</p>
<p><a href="${getAdminUrl('/admin/leases.html')}">View in Admin Panel &rarr;</a></p>`;

    for (const adminEmail of ADMIN_EMAILS) {
      try {
        await sendEmail({ to: adminEmail, subject: adminSubject, html: adminHtml });
      } catch (e) { console.error(`Admin notify (${adminEmail}) failed:`, (e as Error).message); }
    }

    try {
      await supabase.from('admin_actions').insert({
        action:      'tenant_signed_lease',
        target_type: 'application',
        target_id:   appSigned.app_id,
        metadata:    { app_id: appSigned.app_id, actor: appSigned.email, has_image: !!signature_image },
      });
    } catch (_) {}
  }

  return jsonOk({ success: true, message: 'Lease signed successfully.' });
});
