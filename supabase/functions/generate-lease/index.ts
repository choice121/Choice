import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { signingEmailHtml } from '../_shared/email.ts';
import { buildLeasePDF, substituteVars } from '../_shared/pdf.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function verifyAdmin(req: Request): Promise<{ ok: boolean; userId?: string; userEmail?: string; error?: string }> {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, error: 'Missing authorization header' };
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { ok: false, error: 'Invalid or expired token' };
  const { data: role } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).single();
  if (!role) return { ok: false, error: 'Not an admin' };
  return { ok: true, userId: user.id, userEmail: user.email };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const auth = await verifyAdmin(req);
  if (!auth.ok) return jsonErr(401, auth.error!);

  // Phase 6 — accept dry_run flag
  let body: { app_id: string; lease_data?: Record<string, unknown>; dry_run?: boolean };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }

  const { app_id, lease_data = {}, dry_run = false } = body;
  if (!app_id) return jsonErr(400, 'Missing app_id');

  // 1. Fetch application
  const { data: app, error: appErr } = await supabase
    .from('applications').select('*').eq('app_id', app_id).single();
  if (appErr || !app) return jsonErr(404, 'Application not found: ' + (appErr?.message || ''));

  // 2. Fetch active lease template
  const { data: tmpl, error: tmplErr } = await supabase
    .from('lease_templates').select('*').eq('is_active', true).single();
  if (tmplErr || !tmpl) return jsonErr(500, 'No active lease template found. Add one in Supabase Table Editor → lease_templates.');

  // 3. Merge lease fields from admin input
  const leaseFields: Record<string, unknown> = {
    lease_start_date:       lease_data.lease_start_date       ?? app.lease_start_date,
    lease_end_date:         lease_data.lease_end_date         ?? app.lease_end_date,
    monthly_rent:           lease_data.monthly_rent           ?? app.monthly_rent,
    security_deposit:       lease_data.security_deposit       ?? app.security_deposit,
    move_in_costs:          lease_data.move_in_costs          ?? app.move_in_costs,
    lease_notes:            lease_data.lease_notes            ?? app.lease_notes,
    lease_landlord_name:    lease_data.lease_landlord_name    ?? app.lease_landlord_name    ?? 'Choice Properties',
    lease_landlord_address: lease_data.lease_landlord_address ?? app.lease_landlord_address ?? '2265 Livernois Suite 500, Troy MI 48083',
    lease_late_fee_flat:    lease_data.lease_late_fee_flat    ?? app.lease_late_fee_flat,
    lease_late_fee_daily:   lease_data.lease_late_fee_daily   ?? app.lease_late_fee_daily,
    lease_state_code:       lease_data.lease_state_code       ?? app.lease_state_code       ?? 'MI',
    lease_pets_policy:      lease_data.lease_pets_policy      ?? app.lease_pets_policy,
    lease_smoking_policy:   lease_data.lease_smoking_policy   ?? app.lease_smoking_policy,
    updated_at: new Date().toISOString(),
  };

  const mergedApp = { ...app, ...leaseFields };

  // 4. Generate PDF
  let pdfBytes: Uint8Array;
  try { pdfBytes = await buildLeasePDF(mergedApp, tmpl.template_body); }
  catch (e) { return jsonErr(500, 'PDF generation failed: ' + (e as Error).message); }

  // ── Phase 6 — DRY RUN: preview only, no DB changes, no email ────────────────
  if (dry_run) {
    const previewPath = `${app_id}/preview_${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('lease-pdfs')
      .upload(previewPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (uploadErr) return jsonErr(500, 'Preview upload failed: ' + uploadErr.message);

    const { data: signedData, error: signErr } = await supabase.storage
      .from('lease-pdfs')
      .createSignedUrl(previewPath, 3600); // 60-minute expiry
    if (signErr || !signedData?.signedUrl) return jsonErr(500, 'Could not generate preview URL');

    // Log dry run to admin_actions (non-fatal)
    try {
      await supabase.from('admin_actions').insert({
        action:      'lease_preview_generated',
        target_type: 'application',
        target_id:   app_id,
        metadata:    { app_id, actor: auth.userEmail || 'admin' },
      });
    } catch (_) {}

    return jsonOk({ success: true, dry_run: true, preview_url: signedData.signedUrl, app_id });
  }

  // ── PRODUCTION: update DB, upload final PDF, generate tokens, send email ───

  // 5. Update application with lease fields
  await supabase.from('applications').update(leaseFields).eq('app_id', app_id);

  // 6. Upload to Supabase Storage
  const storagePath = `${app_id}/lease_${Date.now()}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from('lease-pdfs')
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });
  if (uploadErr) return jsonErr(500, 'PDF upload failed: ' + uploadErr.message);

  // 7. Update lease_pdf_url
  await supabase.from('applications')
    .update({ lease_pdf_url: storagePath, updated_at: new Date().toISOString() })
    .eq('app_id', app_id);

  // 8. Generate signing tokens (sets lease_status = 'sent')
  const { error: tokenErr } = await supabase.rpc('generate_lease_tokens', { p_app_id: app_id });
  if (tokenErr) return jsonErr(500, 'Token generation failed: ' + tokenErr.message);

  // 9. Fetch updated app with tokens
  const { data: updatedApp } = await supabase
    .from('applications').select('*').eq('app_id', app_id).single();

  // 10. Send signing email
  if (updatedApp?.email && updatedApp?.tenant_sign_token) {
    const signingUrl = `https://choice-properties-site.pages.dev/lease-sign.html?token=${updatedApp.tenant_sign_token}`;
    try {
      await sendEmail({
        to:      updatedApp.email,
        subject: 'Your Lease Agreement is Ready — Choice Properties',
        html:    signingEmailHtml(updatedApp.first_name || 'Applicant', updatedApp.property_address || '', signingUrl, app_id),
      });
    } catch (e) { console.error('Signing email failed (non-fatal):', (e as Error).message); }
  }

  // Log to admin_actions
  try {
    await supabase.from('admin_actions').insert({
      action:      'generate_lease',
      target_type: 'application',
      target_id:   app_id,
      metadata:    { app_id, actor: auth.userEmail || 'admin' },
    });
  } catch (_) {}

  return jsonOk({ success: true, app_id, storage_path: storagePath, lease_status: 'sent' });
});
