/**
 * check-unsigned-leases
 *
 * Scheduled / manually triggerable monitor that sends 48-hour signing
 * reminders to pending unsigned signers (Primary + individual Co-Applicants)
 * and dispatches overdue alerts to ADMIN_EMAILS.
 *
 * Auth: x-cron-secret header matching CRON_SECRET OR valid admin JWT.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { leaseSigningReminderHtml, leaseExpiryAlertHtml } from '../_shared/email.ts';
import { getAdminEmails, getDirectTenantPortalUrl, getSiteUrl } from '../_shared/config.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function isAuthorized(req: Request): Promise<boolean> {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('x-cron-secret') || '';
  if (cronSecret && provided && provided === cronSecret) return true;

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return false;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;
  const { data: role } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).maybeSingle();
  return !!role;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (!(await isAuthorized(req))) {
    return jsonErr(401, 'Unauthorized: admin session or x-cron-secret required.');
  }

  let body: { dry_run?: boolean; min_hours?: number; app_id?: string } = {};
  if (req.method === 'POST') {
    try { body = await req.json(); } catch { body = {}; }
  }
  const dryRun = body.dry_run === true;
  const minHours = typeof body.min_hours === 'number' && body.min_hours >= 0 ? body.min_hours : 48;

  const cutoffIso = new Date(Date.now() - minHours * 60 * 60 * 1000).toISOString();
  const minWindowIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const dedupSinceIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('applications')
    .select('app_id,first_name,last_name,email,phone,property_address,lease_status,lease_sent_date,lease_end_date,tenant_sign_token,has_co_applicant,co_applicant_email,co_applicant_lease_token')
    .eq('status', 'approved')
    .in('lease_status', ['sent', 'awaiting_co_sign'])
    .lt('lease_sent_date', cutoffIso)
    .gt('lease_sent_date', minWindowIso);

  if (body.app_id) {
    query = query.eq('app_id', body.app_id);
  }

  const { data: overdueApps, error: qErr } = await query.order('lease_sent_date', { ascending: true }).limit(50);
  if (qErr) return jsonErr(500, 'Query failed: ' + qErr.message);

  const siteUrl = getSiteUrl();
  const adminEmails = getAdminEmails();
  const results: Array<Record<string, unknown>> = [];
  let remindersSent = 0;
  let adminAlertsSent = 0;

  for (const app of (overdueApps || [])) {
    // Check 48h deduplication window
    const { data: recentLogs } = await supabase
      .from('email_logs')
      .select('id')
      .eq('app_id', app.app_id)
      .eq('type', 'lease_signing_reminder')
      .gte('created_at', dedupSinceIso)
      .limit(1);

    if (recentLogs && recentLogs.length > 0) {
      results.push({ app_id: app.app_id, skipped: true, reason: 'reminded_within_48h' });
      continue;
    }

    const [{ data: pendingTokens }, { data: applicantsSafe }] = await Promise.all([
      supabase
        .from('lease_signing_tokens')
        .select('token, signer_role, applicant_id')
        .eq('app_id', app.app_id)
        .is('used_at', null)
        .is('revoked_at', null),
      supabase
        .from('application_applicants')
        .select('id, first_name, last_name, email, is_primary, lease_signature')
        .eq('app_id', app.app_id),
    ]);

    const targets: Array<{ email: string; firstName: string; role: string; signingUrl: string }> = [];

    if (pendingTokens && pendingTokens.length > 0) {
      for (const tok of pendingTokens) {
        if (app.lease_status === 'awaiting_co_sign' && tok.signer_role === 'tenant') continue;
        const matched = tok.applicant_id
          ? (applicantsSafe || []).find((a: { id: string }) => a.id === tok.applicant_id)
          : (tok.signer_role === 'tenant'
              ? (applicantsSafe || []).find((a: { is_primary?: boolean }) => a.is_primary)
              : null);
        if (matched && matched.lease_signature) continue;

        const targetEmail = matched?.email || (tok.signer_role === 'tenant' ? app.email : app.co_applicant_email);
        const targetFirst = matched?.first_name || (tok.signer_role === 'tenant' ? app.first_name : 'Co-Applicant') || 'Applicant';
        if (!targetEmail) continue;

        targets.push({
          email: targetEmail,
          firstName: targetFirst,
          role: tok.signer_role,
          signingUrl: `${siteUrl}/lease-sign.html?token=${tok.token}`,
        });
      }
    } else if (app.lease_status === 'sent' && app.email && app.tenant_sign_token) {
      targets.push({
        email: app.email,
        firstName: app.first_name || 'Applicant',
        role: 'tenant',
        signingUrl: `${siteUrl}/lease-sign.html?token=${app.tenant_sign_token}`,
      });
    } else if (app.lease_status === 'awaiting_co_sign' && app.co_applicant_email && app.co_applicant_lease_token) {
      targets.push({
        email: app.co_applicant_email,
        firstName: 'Co-Applicant',
        role: 'co_applicant',
        signingUrl: `${siteUrl}/lease-sign.html?token=${app.co_applicant_lease_token}`,
      });
    }

    if (dryRun) {
      results.push({
        app_id: app.app_id,
        lease_status: app.lease_status,
        dry_run: true,
        targets: targets.map(t => ({ email: t.email, role: t.role })),
      });
      continue;
    }

    for (const target of targets) {
      const portalUrl = getDirectTenantPortalUrl(app.app_id);
      const html = leaseSigningReminderHtml(
        target.firstName,
        app.property_address || '',
        portalUrl,
        undefined,
        app.app_id,
        target.signingUrl,
      );
      const res = await sendEmail({
        to: target.email,
        subject: `Reminder — Lease Pending Signature | ${(app.property_address || '').split(',')[0] || app.app_id} (Ref: ${app.app_id})`,
        html,
      });
      await supabase.from('email_logs').insert({
        app_id: app.app_id,
        type: 'lease_signing_reminder',
        recipient: target.email,
        status: res.ok ? 'sent' : 'failed',
        provider: res.provider,
        error_msg: res.ok ? null : (res.error || 'send failed'),
      });
      if (res.ok) remindersSent++;
    }

    for (const adminEmail of adminEmails) {
      const alertHtml = leaseExpiryAlertHtml(
        `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Applicant',
        app.property_address || '',
        app.lease_sent_date || app.lease_end_date || new Date().toISOString(),
        app.app_id,
        app.email || '',
        app.phone || undefined,
      );
      const alertRes = await sendEmail({
        to: adminEmail,
        subject: `Unsigned Lease Alert — ${app.property_address || app.app_id}`,
        html: alertHtml,
      });
      await supabase.from('email_logs').insert({
        app_id: app.app_id,
        type: 'lease_expiry_alert',
        recipient: adminEmail,
        status: alertRes.ok ? 'sent' : 'failed',
        provider: alertRes.provider,
        error_msg: alertRes.ok ? null : (alertRes.error || 'send failed'),
      });
      if (alertRes.ok) adminAlertsSent++;
    }

    results.push({
      app_id: app.app_id,
      reminded: targets.map(t => t.email),
    });
  }

  return jsonOk({
    success: true,
    dry_run: dryRun,
    checked: (overdueApps || []).length,
    reminders_sent: remindersSent,
    admin_alerts_sent: adminAlertsSent,
    results,
  });
});
