import { createClient } from 'npm:@supabase/supabase-js@2';
  import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
  import { sendEmail, approvalEmailHtml, denialEmailHtml, moveinEmailHtml } from '../_shared/email.ts';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  async function verifyAdmin(req: Request) {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return { ok: false };
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { ok: false };
    const { data: role } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).single();
    return { ok: !!role };
  }

  Deno.serve(async (req: Request) => {
    const cors = handleCors(req);
    if (cors) return cors;

    const auth = await verifyAdmin(req);
    if (!auth.ok) return jsonErr(401, 'Unauthorized');

    let body: { app_id: string; type: string; message?: string };
    try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }

    const { app_id, type, message } = body;
    if (!app_id || !type) return jsonErr(400, 'Missing app_id or type');

    const { data: app, error: appErr } = await supabase
      .from('applications').select('*').eq('app_id', app_id).single();
    if (appErr || !app) return jsonErr(404, 'Application not found');

    const name = app.first_name || 'Applicant';
    const prop = app.property_address || 'your property';

    let subject = '';
    let html = '';

    if (type === 'approved') {
      subject = 'Your Application Has Been Approved — Choice Properties';
      html = approvalEmailHtml(name, prop, message);
    } else if (type === 'denied') {
      subject = 'Update on Your Application — Choice Properties';
      html = denialEmailHtml(name, prop, message);
    } else if (type === 'movein_confirmed') {
      const moveDate = app.move_in_date_actual
        ? new Date(app.move_in_date_actual).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : undefined;
      subject = 'Move-In Confirmed — Choice Properties';
      html = moveinEmailHtml(name, prop, moveDate, message);
    } else {
      subject = 'Message from Choice Properties';
      html = `<p>Dear ${name},</p><p>${message || ''}</p><p>— Choice Properties</p>`;
    }

    try {
      await sendEmail({ to: app.email, subject, html });
      // Log to email_logs
      await supabase.from('email_logs').insert({
        recipient_email: app.email,
        subject,
        type,
        related_id: app.id,
        sent_at: new Date().toISOString(),
      }).catch(() => {});
      return jsonOk({ success: true, to: app.email });
    } catch (e) {
      return jsonErr(500, 'Email send failed: ' + (e as Error).message);
    }
  });
  