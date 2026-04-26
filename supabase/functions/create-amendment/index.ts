/**
 * create-amendment — Phase 4
 * Admin creates a lease amendment (addendum) and sends it to the
 * primary tenant for signature. Generates a single-use signing token
 * scoped to the amendment row. Renders an addendum PDF and stores
 * it as a versioned event on the parent application.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { amendmentRequestHtml } from '../_shared/email.ts';
import { buildLeasePDF } from '../_shared/pdf.ts';
import { renderTemplate, createSupabasePartialResolver } from '../_shared/template-engine.ts';
import { buildLeaseRenderContext } from '../_shared/lease-context.ts';
import { getSiteUrl } from '../_shared/config.ts';
import { buildPdfStoragePath } from '../_shared/lease-render.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function verifyAdmin(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, error: 'Missing authorization header' };
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { ok: false, error: 'Invalid or expired token' };
  const { data: role } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).single();
  if (!role) return { ok: false, error: 'Not an admin' };
  return { ok: true, userEmail: user.email };
}

function genToken(): string {
  const a = new Uint8Array(24); crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const auth = await verifyAdmin(req);
  if (!auth.ok) return jsonErr(401, auth.error!);

  let body: { app_id: string; kind: string; title: string; body: string; send_email?: boolean };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }

  const { app_id, kind, title, body: amendBody, send_email = true } = body;
  if (!app_id) return jsonErr(400, 'Missing app_id');
  if (!kind)   return jsonErr(400, 'Missing kind');
  if (!title || title.trim().length < 3) return jsonErr(400, 'Title is required');
  if (!amendBody || amendBody.trim().length < 20) return jsonErr(400, 'Amendment body is too short');

  const { data: app, error: appErr } = await supabase
    .from('applications').select('*').eq('app_id', app_id).single();
  if (appErr || !app) return jsonErr(404, 'Application not found');
  if (!app.management_cosigned) {
    return jsonErr(400, 'Amendments can only be added to fully executed leases.');
  }

  // Phase 10 -- attach the amendment to the application's CURRENT lease.
  // Falls back to most-recent lease for backwards compat with apps that
  // were never explicitly pointed via current_lease_id.
  let leaseId: string | null = (app as { current_lease_id?: string }).current_lease_id || null;
  if (!leaseId) {
    const { data: l } = await supabase
      .from('leases').select('id').eq('app_id', app_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    leaseId = (l as { id: string } | null)?.id || null;
  }

  const token = genToken();

  // Insert the amendment row first so we have its id for the PDF version FK
  const { data: amend, error: insErr } = await supabase
    .from('lease_amendments')
    .insert({
      app_id, kind, title: title.trim(), body: amendBody.trim(),
      lease_id:      leaseId,
      status:        send_email ? 'sent' : 'draft',
      signing_token: send_email ? token : null,
      sent_at:       send_email ? new Date().toISOString() : null,
      created_by:    auth.userEmail || null,
    })
    .select().single();
  if (insErr || !amend) return jsonErr(500, 'Failed to create amendment: ' + (insErr?.message || ''));

  // Render an addendum PDF (uses the same builder; the body IS the template)
  let pdfPath: string | null = null;
  try {
    const partials  = createSupabasePartialResolver(supabase);
    const innerBody = await renderTemplate(amendBody, buildLeaseRenderContext(app), { partials });
    const renderedBody = `LEASE ADDENDUM — ${title}\n\n${innerBody}\n\n` +
      `This addendum modifies the lease for property: ${app.property_address}\n` +
      `Application: ${app_id}\n` +
      `Original lease executed: ${app.management_cosigned_at || ''}\n`;
    const pdfBytes = await buildLeasePDF(app, renderedBody, { partials });
    const { data: pv } = await supabase.rpc('record_lease_pdf_version', {
      p_app_id:              app_id,
      p_event:               'amended',
      p_storage_path:        '',
      p_template_version_id: app.lease_template_version_id || null,
      p_amendment_id:        amend.id,
      p_created_by:          auth.userEmail || null,
    });
    const versionNumber = (pv as { version_number?: number })?.version_number || 1;
    pdfPath = buildPdfStoragePath(app_id, versionNumber, 'amended');
    const { error: upErr } = await supabase.storage.from('lease-pdfs')
      .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: false });
    if (upErr) {
      console.error('Amendment PDF upload failed:', upErr.message);
      pdfPath = null;
    } else {
      await supabase.from('lease_pdf_versions')
        .update({ storage_path: pdfPath, size_bytes: pdfBytes.byteLength })
        .eq('app_id', app_id).eq('version_number', versionNumber);
      await supabase.from('lease_amendments').update({ pdf_path: pdfPath }).eq('id', amend.id);
    }
  } catch (e) { console.error('Amendment PDF generation failed (non-fatal):', (e as Error).message); }

  // Email the tenant
  if (send_email && app.email) {
    try {
      const url = `${getSiteUrl()}/lease-sign.html?amendment_token=${token}`;
      await sendEmail({
        to:      app.email,
        subject: `\u{1F4DD} Lease Amendment Ready to Sign — Choice Properties (Ref: ${app_id})`,
        html:    amendmentRequestHtml(
          app.first_name || 'Applicant',
          app.property_address || '',
          title,
          url,
          app_id,
        ),
      });
    } catch (e) { console.error('Amendment email failed (non-fatal):', (e as Error).message); }
  }

  try {
    await supabase.from('admin_actions').insert({
      action:      'lease_amendment_created',
      target_type: 'application',
      target_id:   app_id,
      metadata:    { amendment_id: amend.id, kind, title, sent: send_email, actor: auth.userEmail },
    });
  } catch (_) {}

  return jsonOk({
    success: true,
    amendment_id: amend.id,
    lease_id:    leaseId,
    pdf_path: pdfPath,
    signing_url: send_email ? `${getSiteUrl()}/lease-sign.html?amendment_token=${token}` : null,
  });
});
