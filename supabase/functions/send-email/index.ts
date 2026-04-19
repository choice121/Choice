import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import {
  approvalEmailHtml,
  denialEmailHtml,
  moveinEmailHtml,
  holdingFeeRequestHtml,
  holdingFeeReceivedHtml,
  paymentConfirmedHtml,
  moveInPrepHtml,
  leaseSigningReminderHtml,
  leaseExpiryAlertHtml,
  adminReviewSummaryHtml,
  formatDate,
} from '../_shared/email.ts';
import { getAdminEmails, getTenantPortalUrl } from '../_shared/config.ts';

const ADMIN_EMAILS = getAdminEmails();
const TENANT_PORTAL_URL = getTenantPortalUrl();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function verifyAdmin(req: Request): Promise<{ ok: boolean; userEmail?: string }> {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return { ok: false };
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { ok: false };
  const { data: role } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).single();
  return { ok: !!role, userEmail: user.email };
}

async function logEmail(appId: string, _appDbId: string, type: string, recipient: string, status: string, provider = 'unknown') {
  try {
    await supabase.from('email_logs').insert({
      app_id:    appId,
      type,
      recipient,
      status,
      provider,
    });
  } catch (_) {}
}

async function logAdminAction(appId: string, action: string, actor: string) {
  try {
    await supabase.from('admin_actions').insert({
      action,
      target_type: 'application',
      target_id:   appId,
      metadata:    { app_id: appId, actor },
    });
  } catch (_) {}
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const auth = await verifyAdmin(req);
  if (!auth.ok) return jsonErr(401, 'Unauthorized');

  let body: {
    app_id: string;
    type: string;
    message?: string;
    fee_amount?: number;
    due_date?: string;
    payment_method?: string;
    transaction_ref?: string;
    amount_collected?: number;
  };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }

  const { app_id, type, message } = body;
  if (!app_id || !type) return jsonErr(400, 'Missing app_id or type');

  const { data: app, error: appErr } = await supabase
    .from('applications').select('*').eq('app_id', app_id).single();
  if (appErr || !app) return jsonErr(404, 'Application not found');

  const name  = app.first_name || 'Applicant';
  const prop  = app.property_address || 'your property';
  const actor = auth.userEmail || 'admin';
  const now   = new Date().toISOString();

  let subject        = '';
  let html           = '';
  let sendToAdmin    = false;

  // Phase 4A — internal admin review summary (for holding_fee_received)
  let sendAdminReview      = false;
  let adminReviewSubject   = '';
  let adminReviewHtml      = '';

  // ── Build subject + html per type ──────────────────────────────────────────

  if (type === 'approved') {
    subject = 'Your Application Has Been Approved — Choice Properties';
    html    = approvalEmailHtml(name, prop, message);

  } else if (type === 'denied') {
    subject = 'Update on Your Application — Choice Properties';
    html    = denialEmailHtml(name, prop, message);

  } else if (type === 'movein_confirmed') {
    const moveDate = app.move_in_date_actual ? formatDate(app.move_in_date_actual) : undefined;
    subject = 'Move-In Confirmed — Choice Properties';
    html    = moveinEmailHtml(name, prop, moveDate, message);

  } else if (type === 'holding_fee_request') {
    subject = 'Holding Fee Request — Choice Properties';
    html    = holdingFeeRequestHtml(name, prop, body.fee_amount ?? app.holding_fee_amount, body.due_date ?? app.holding_fee_due_date, message);

    const update: Record<string, unknown> = {
      holding_fee_requested:    true,
      holding_fee_requested_at: now,
      updated_at:               now,
    };
    if (body.fee_amount != null) update.holding_fee_amount   = body.fee_amount;
    if (body.due_date)           update.holding_fee_due_date = body.due_date;
    await supabase.from('applications').update(update).eq('app_id', app_id);

  } else if (type === 'holding_fee_received') {
    subject = 'Holding Fee Received — Unit Reserved';
    html    = holdingFeeReceivedHtml(name, prop, TENANT_PORTAL_URL, message);

    await supabase.from('applications').update({
      holding_fee_paid:    true,
      holding_fee_paid_at: now,
      updated_at:          now,
    }).eq('app_id', app_id);

    // Phase 4A — queue admin review summary
    sendAdminReview    = true;
    adminReviewSubject = `Holding Fee Received — Action Required: Generate Lease for ${name} ${app.last_name || ''}`.trim();
    adminReviewHtml    = adminReviewSummaryHtml(
      app.first_name || '', app.last_name || '', app.email || '',
      app.phone || '', prop, app_id,
      body.fee_amount ?? app.holding_fee_amount,
    );

  } else if (type === 'payment_confirmed') {
    subject = 'Payment Confirmed — Choice Properties';
    html    = paymentConfirmedHtml(
      name, prop,
      body.amount_collected ?? app.payment_amount_collected,
      body.payment_method   ?? app.payment_method_confirmed,
      body.transaction_ref  ?? app.payment_transaction_ref,
      message,
    );

    const update: Record<string, unknown> = { payment_confirmed_at: now, updated_at: now };
    if (body.payment_method   != null) update.payment_method_confirmed  = body.payment_method;
    if (body.transaction_ref  != null) update.payment_transaction_ref   = body.transaction_ref;
    if (body.amount_collected != null) update.payment_amount_collected  = body.amount_collected;
    await supabase.from('applications').update(update).eq('app_id', app_id);

  } else if (type === 'move_in_prep') {
    subject = 'Your Move-In Preparation Guide — Choice Properties';
    html    = moveInPrepHtml(name, prop, message);

  } else if (type === 'lease_signing_reminder') {
    subject = 'Reminder: Please Sign Your Lease — Choice Properties';
    html    = leaseSigningReminderHtml(name, prop, TENANT_PORTAL_URL, message);

  } else if (type === 'lease_expiry_alert') {
    const leaseEnd = app.lease_end_date || app.move_out_date;
    if (!leaseEnd) return jsonErr(400, 'No lease_end_date on this application');
    subject     = `Lease Expiry Alert — ${prop}`;
    html        = leaseExpiryAlertHtml(name, prop, leaseEnd, app_id, app.email || '');
    sendToAdmin = true;

  } else {
    return jsonErr(400, `Unsupported email type: "${type}". Supported types: approved, denied, movein_confirmed, holding_fee_request, holding_fee_received, payment_confirmed, move_in_prep, lease_signing_reminder, lease_expiry_alert`);
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  try {
    const failures: string[] = [];
    if (sendToAdmin) {
      for (const adminEmail of ADMIN_EMAILS) {
        const result = await sendEmail({ to: adminEmail, subject, html });
        await logEmail(app_id, app.id, type, adminEmail, result.ok ? 'sent' : 'failed', result.provider);
        if (!result.ok) failures.push(`${adminEmail}: ${result.error || 'send failed'}`);
      }
    } else {
      const result = await sendEmail({ to: app.email, subject, html });
      await logEmail(app_id, app.id, type, app.email, result.ok ? 'sent' : 'failed', result.provider);
      if (!result.ok) failures.push(`${app.email}: ${result.error || 'send failed'}`);
    }

    // Phase 4A — send internal admin review summary alongside holding_fee_received
    if (sendAdminReview) {
      for (const adminEmail of ADMIN_EMAILS) {
        const result = await sendEmail({ to: adminEmail, subject: adminReviewSubject, html: adminReviewHtml });
        await logEmail(app_id, app.id, 'admin_review_summary', adminEmail, result.ok ? 'sent' : 'failed', result.provider);
        if (!result.ok) failures.push(`${adminEmail}: ${result.error || 'admin review send failed'}`);
      }
    }

    if (failures.length) {
      return jsonErr(502, `Email send failed: ${failures.join('; ')}`);
    }

    await logAdminAction(app_id, `send_email_${type}`, actor);

    const recipient = sendToAdmin ? ADMIN_EMAILS.join(', ') : app.email;
    return jsonOk({ success: true, to: recipient, type });

  } catch (e) {
    await logEmail(app_id, app.id, type, sendToAdmin ? 'admin' : app.email, 'failed');
    return jsonErr(500, 'Email send failed: ' + (e as Error).message);
  }
});
