/**
 * countersign — Phase 5
 * Management countersignature for a tenant-signed lease.
 * Verifies admin JWT, checks tenant has signed, updates DB,
 * regenerates PDF with management signature block, sends
 * "Lease Fully Executed" email to applicant.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { leaseFullyExecutedHtml } from '../_shared/email.ts';
import { buildLeasePDF } from '../_shared/pdf.ts';
import { getTenantPortalUrl } from '../_shared/config.ts';

const TENANT_PORTAL_URL = getTenantPortalUrl();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function verifyAdmin(req: Request): Promise<{ ok: boolean; userEmail?: string; error?: string }> {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, error: 'Missing authorization header' };
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { ok: false, error: 'Invalid or expired token' };
  const { data: role } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).single();
  if (!role) return { ok: false, error: 'Not an admin' };
  return { ok: true, userEmail: user.email };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const auth = await verifyAdmin(req);
  if (!auth.ok) return jsonErr(401, auth.error!);

  let body: { app_id: string; signer_name: string; notes?: string };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }

  const { app_id, signer_name, notes } = body;
  if (!app_id)      return jsonErr(400, 'Missing app_id');
  if (!signer_name) return jsonErr(400, 'Missing signer_name');

  // 1. Load application
  const { data: app, error: appErr } = await supabase
    .from('applications').select('*').eq('app_id', app_id).single();
  if (appErr || !app) return jsonErr(404, 'Application not found');

  // 2. Verify tenant has already signed (check tenant_signature string, as tenant_signed column may not exist)
  if (!app.tenant_signature) {
    return jsonErr(400, 'Tenant has not yet signed this lease. Management can only countersign after the tenant has signed.');
  }

  // 3. Check not already countersigned
  if (app.management_signed || app.management_cosigned) {
    return jsonErr(400, 'This lease has already been countersigned by management.');
  }

  const now = new Date().toISOString();

  // 4. Update DB with management signature
  const { error: updateErr } = await supabase.from('applications').update({
    management_signed:      true,
    management_signer_name: signer_name,
    management_signed_at:   now,
    management_notes:       notes || null,
    management_cosigned:    true,
    management_cosigned_by: signer_name,
    management_cosigned_at: now,
    lease_status:           'co_signed',
    updated_at:             now,
  }).eq('app_id', app_id);

  if (updateErr) return jsonErr(500, 'Failed to record countersignature: ' + updateErr.message);

  // 5. Regenerate PDF with management signature block appended
  try {
    const { data: tmpl } = await supabase
      .from('lease_templates').select('*').eq('is_active', true).single();

    if (tmpl && app.lease_pdf_url) {
      const appWithSig = {
        ...app,
        management_signed:      true,
        management_signer_name: signer_name,
        management_signed_at:   now,
        management_notes:       notes || null,
      };
      const pdfBytes = await buildLeasePDF(appWithSig, tmpl.template_body);
      await supabase.storage.from('lease-pdfs')
        .upload(app.lease_pdf_url, pdfBytes, { contentType: 'application/pdf', upsert: true });
    }
  } catch (e) { console.error('PDF re-gen failed (non-fatal):', (e as Error).message); }

  // 6. Send "Lease Fully Executed" email to applicant
  try {
    await sendEmail({
      to:      app.email,
      subject: 'Your Lease Has Been Fully Executed — Choice Properties',
      html:    leaseFullyExecutedHtml(app.first_name || 'Applicant', app.property_address || '', TENANT_PORTAL_URL),
    });
  } catch (e) { console.error('Fully executed email failed (non-fatal):', (e as Error).message); }

  // 7. Log admin action
  try {
    await supabase.from('admin_actions').insert({
      action:      'management_countersign',
      target_type: 'application',
      target_id:   app_id,
      metadata:    { app_id, actor: signer_name },
    });
  } catch (_) {}

  return jsonOk({ success: true, app_id, message: 'Lease countersigned by ' + signer_name });
});
