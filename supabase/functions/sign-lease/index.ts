import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail }                   from '../_shared/send-email.ts';
import { signedConfirmHtml }           from '../_shared/email.ts';
import { buildLeasePDF }               from '../_shared/pdf.ts';

// Phase 2B — both admin emails notified on every lease signing
const ADMIN_EMAILS = [
  'choicepropertyofficial1@gmail.com',
  'choicepropertygroup@hotmail.com',
];

const TENANT_PORTAL_URL = 'https://choice-properties-site.pages.dev/tenant/portal.html';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Phase 3 — accept applicant_email for identity verification
  let body: { token: string; signature: string; applicant_email?: string; user_agent?: string };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }

  const { token, signature, applicant_email, user_agent } = body;
  if (!token)     return jsonErr(400, 'Missing token');
  if (!signature) return jsonErr(400, 'Missing signature');

  // Phase 3 — minimum signature length
  if (signature.trim().length < 5) {
    return jsonErr(400, 'Signature must be at least 5 characters. Please type your full legal name.');
  }

  // Phase 3 — pre-check: look up app by token before signing to verify identity
  const { data: preApp, error: preErr } = await supabase
    .from('applications')
    .select('id, app_id, email, first_name, last_name, property_address, lease_pdf_url')
    .eq('tenant_sign_token', token)
    .single();

  if (preErr || !preApp) {
    return jsonErr(400, 'This signing link is invalid or has already been used.');
  }

  // Phase 3 — email identity verification
  if (!applicant_email || applicant_email.trim().toLowerCase() !== (preApp.email || '').toLowerCase()) {
    return jsonErr(403, 'The email you entered does not match our records. Please use the same email address you applied with.');
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';

  const { error: signErr } = await supabase.rpc('sign_lease_tenant', {
    p_token:      token,
    p_signature:  signature,
    p_ip_address: ip,
    p_user_agent: user_agent || '',
  });
  if (signErr) return jsonErr(400, signErr.message || 'Signing failed. The link may have expired.');

  // Fetch updated app record after signing (use preApp.id for reliability)
  const { data: appSigned } = await supabase
    .from('applications')
    .select('*')
    .eq('id', preApp.id)
    .single();

  if (appSigned) {
    // Regenerate PDF with signature if template is available
    const { data: tmpl } = await supabase
      .from('lease_templates').select('*').eq('is_active', true).single();

    if (tmpl && appSigned.lease_pdf_url) {
      try {
        const pdfBytes = await buildLeasePDF(appSigned, tmpl.template_body);
        await supabase.storage.from('lease-pdfs')
          .upload(appSigned.lease_pdf_url, pdfBytes, { contentType: 'application/pdf', upsert: true });
      } catch (e) { console.error('PDF re-gen failed (non-fatal):', (e as Error).message); }
    }

    // Confirmation email to tenant
    try {
      await sendEmail({
        to: appSigned.email,
        subject: 'Lease Signed — Choice Properties',
        html: signedConfirmHtml(appSigned.first_name || 'Applicant', appSigned.property_address || '', appSigned.app_id),
      });
    } catch (e) { console.error('Tenant confirm email failed:', (e as Error).message); }

    // Phase 2B — notify BOTH admin emails
    const adminSubject = `[Lease Signed] ${appSigned.first_name || ''} ${appSigned.last_name || ''} — ${appSigned.app_id}`;
    const adminHtml = `<p><strong>Lease signed</strong> by ${appSigned.first_name || ''} ${appSigned.last_name || ''} (${appSigned.email})</p>
<p>Application: ${appSigned.app_id}<br>Property: ${appSigned.property_address}<br>Signed: ${new Date().toLocaleString('en-US')}</p>
<p><a href="https://choice-properties-site.pages.dev/admin/leases.html">View in Admin Panel &rarr;</a></p>`;

    for (const adminEmail of ADMIN_EMAILS) {
      try {
        await sendEmail({ to: adminEmail, subject: adminSubject, html: adminHtml });
      } catch (e) { console.error(`Admin notify (${adminEmail}) failed:`, (e as Error).message); }
    }

    // Log to admin_actions
    try {
      await supabase.from('admin_actions').insert({
        action:      'tenant_signed_lease',
        target_type: 'application',
        target_id:   appSigned.app_id,
        metadata:    { app_id: appSigned.app_id, actor: appSigned.email },
      });
    } catch (_) {}
  }

  return jsonOk({ success: true, message: 'Lease signed successfully.' });
});
