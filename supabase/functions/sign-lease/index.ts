import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail, signedConfirmHtml } from '../_shared/email.ts';
import { buildLeasePDF } from '../_shared/pdf.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  let body: { token: string; signature: string; user_agent?: string };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }

  const { token, signature, user_agent } = body;
  if (!token)     return jsonErr(400, 'Missing token');
  if (!signature) return jsonErr(400, 'Missing signature');

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';

  const { error: signErr } = await supabase.rpc('sign_lease_tenant', {
    p_token:       token,
    p_signature:   signature,
    p_ip_address:  ip,
    p_user_agent:  user_agent || '',
  });
  if (signErr) return jsonErr(400, signErr.message || 'Signing failed. The link may have expired.');

  const { data: appSigned } = await supabase
    .from('applications')
    .select('*')
    .eq('tenant_signature', signature)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (appSigned) {
    const { data: tmpl } = await supabase
      .from('lease_templates').select('*').eq('is_active', true).single();

    if (tmpl && appSigned.lease_pdf_url) {
      try {
        const pdfBytes = await buildLeasePDF(appSigned, tmpl.template_body);
        await supabase.storage.from('lease-pdfs')
          .upload(appSigned.lease_pdf_url, pdfBytes, { contentType: 'application/pdf', upsert: true });
      } catch (e) { console.error('PDF re-gen failed (non-fatal):', (e as Error).message); }
    }

    try {
      await sendEmail({
        to: appSigned.email,
        subject: 'Lease Signed — Choice Properties',
        html: signedConfirmHtml(appSigned.first_name || 'Applicant', appSigned.property_address || '', appSigned.app_id),
      });
    } catch (e) { console.error('Tenant confirm email failed:', (e as Error).message); }

    const adminEmail = Deno.env.get('ADMIN_EMAIL');
    if (adminEmail) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `[Lease Signed] ${appSigned.first_name} ${appSigned.last_name} — ${appSigned.app_id}`,
          html: `<p><strong>Lease signed</strong> by ${appSigned.first_name} ${appSigned.last_name} (${appSigned.email})</p>
<p>Application: ${appSigned.app_id}<br>Property: ${appSigned.property_address}<br>Signed: ${new Date().toLocaleString('en-US')}</p>
<p><a href="https://choice-properties-site.pages.dev/admin/leases.html">View in Admin Panel →</a></p>`,
        });
      } catch (e) { console.error('Admin notify email failed:', (e as Error).message); }
    }
  }

  return jsonOk({ success: true, message: 'Lease signed successfully.' });
});
