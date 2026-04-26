/**
 * sign-amendment — Phase 4
 * Tenant signs a lease amendment via single-use token from email.
 * Same identity-verification pattern as sign-lease (token + email).
 * Records a sign_event and re-renders the addendum PDF with the
 * tenant's signature block embedded.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { amendmentSignedHtml } from '../_shared/email.ts';
import { buildLeasePDF } from '../_shared/pdf.ts';
import { renderTemplate, createSupabasePartialResolver } from '../_shared/template-engine.ts';
import { buildLeaseRenderContext } from '../_shared/lease-context.ts';
import { getAdminEmails, getAdminUrl } from '../_shared/config.ts';
import { buildPdfStoragePath } from '../_shared/lease-render.ts';

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

  // Look up amendment and parent app
  const { data: amend } = await supabase
    .from('lease_amendments').select('*').eq('signing_token', token).maybeSingle();
  if (!amend) return jsonErr(400, 'This signing link is invalid or has already been used.');
  if (amend.status === 'voided')  return jsonErr(410, 'This amendment has been voided.');
  if (amend.tenant_signature)     return jsonErr(410, 'This amendment has already been signed.');

  const { data: app } = await supabase
    .from('applications').select('*').eq('app_id', amend.app_id).single();
  if (!app) return jsonErr(404, 'Parent lease not found.');

  if (!applicant_email || applicant_email.trim().toLowerCase() !== (app.email || '').toLowerCase()) {
    return jsonErr(403, 'The email you entered does not match our records. Please use the same email address you applied with.');
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';

  const { error: signErr } = await supabase.rpc('sign_lease_amendment', {
    p_token:           token,
    p_signature:       signature,
    p_ip_address:      ip,
    p_user_agent:      user_agent || '',
    p_signature_image: signature_image || null,
  });
  if (signErr) return jsonErr(400, signErr.message || 'Signing failed.');

  const now = new Date().toISOString();

  // Re-render addendum PDF including signature block
  try {
    const partials  = createSupabasePartialResolver(supabase);
    const innerBody = await renderTemplate(amend.body, buildLeaseRenderContext(app), { partials });
    const signedAddendum = `LEASE ADDENDUM — ${amend.title}\n\n${innerBody}\n\n` +
      `This addendum modifies the lease for property: ${app.property_address}\n` +
      `Application: ${app.app_id}\n`;
    const appWithSig = {
      ...app,
      tenant_signature:        signature,
      tenant_signature_image:  signature_image || null,
      signature_timestamp:     now,
      lease_ip_address:        ip,
    };
    const pdfBytes = await buildLeasePDF(appWithSig, signedAddendum, { partials });
    const { data: pv } = await supabase.rpc('record_lease_pdf_version', {
      p_app_id:              app.app_id,
      p_event:               'amended',
      p_storage_path:        '',
      p_template_version_id: app.lease_template_version_id || null,
      p_amendment_id:        amend.id,
      p_created_by:          app.email,
    });
    const versionNumber = (pv as { version_number?: number })?.version_number || 1;
    const path = buildPdfStoragePath(app.app_id, versionNumber, 'amended');
    const { error: upErr } = await supabase.storage.from('lease-pdfs')
      .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: false });
    if (!upErr) {
      await supabase.from('lease_pdf_versions')
        .update({ storage_path: path, size_bytes: pdfBytes.byteLength })
        .eq('app_id', app.app_id).eq('version_number', versionNumber);
      await supabase.from('lease_amendments').update({ pdf_path: path }).eq('id', amend.id);
    }
  } catch (e) { console.error('Amendment PDF re-gen failed (non-fatal):', (e as Error).message); }

  // Confirmation to tenant
  try {
    await sendEmail({
      to:      app.email,
      subject: `\u{2705} Amendment Signed — Choice Properties (Ref: ${app.app_id})`,
      html:    amendmentSignedHtml(app.first_name || 'Applicant', app.property_address || '', amend.title, app.app_id),
    });
  } catch (e) { console.error('Amendment confirm email failed:', (e as Error).message); }

  // Notify admins
  for (const adminEmail of ADMIN_EMAILS) {
    try {
      await sendEmail({
        to: adminEmail,
        subject: `[Amendment Signed] ${amend.title} — ${app.app_id}`,
        html: `<p><strong>Lease amendment signed</strong> by ${app.first_name || ''} ${app.last_name || ''} (${app.email})</p>
<p>Application: ${app.app_id}<br>Amendment: ${amend.title} (${amend.kind})<br>Signed: ${new Date().toLocaleString('en-US')}</p>
<p><a href="${getAdminUrl('/admin/leases.html')}">View in Admin Panel &rarr;</a></p>`,
      });
    } catch (_) {}
  }

  try {
    await supabase.from('admin_actions').insert({
      action:      'lease_amendment_signed',
      target_type: 'application',
      target_id:   app.app_id,
      metadata:    { amendment_id: amend.id, actor: app.email },
    });
  } catch (_) {}

  return jsonOk({ success: true, amendment_id: amend.id });
});
