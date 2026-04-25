/**
 * check-renewals — Phase 4
 *
 * Iterates lease_renewals_due (leases ending in the next 0-70 days,
 * with a 14-day dedupe window), and emails each tenant a renewal
 * nudge. Designed to be triggered by:
 *
 *   • Supabase pg_cron (weekly), OR
 *   • Manual admin click in Admin → Leases → "Check Renewals", OR
 *   • External cron via authenticated POST.
 *
 * Auth model: requires either a valid admin JWT, OR a CRON_SECRET
 * header matching the configured Deno env secret. This lets a
 * cron invoke it without an admin session.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { renewalNudgeHtml } from '../_shared/email.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';

async function verifyAuth(req: Request): Promise<{ ok: boolean; actor: string; error?: string }> {
  // Cron path: explicit header secret
  const cronHeader = req.headers.get('x-cron-secret') || '';
  if (CRON_SECRET && cronHeader && cronHeader === CRON_SECRET) {
    return { ok: true, actor: 'cron' };
  }
  // Admin path: JWT
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, actor: '', error: 'Missing authorization' };
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { ok: false, actor: '', error: 'Invalid token' };
  const { data: role } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).single();
  if (!role) return { ok: false, actor: '', error: 'Not an admin' };
  return { ok: true, actor: user.email || 'admin' };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const auth = await verifyAuth(req);
  if (!auth.ok) return jsonErr(401, auth.error || 'Unauthorized');

  // Optional dry_run mode for the admin "preview" button
  let dryRun = false;
  if (req.method === 'POST') {
    try { const b = await req.json(); dryRun = !!b?.dry_run; } catch { /* no body is fine */ }
  }

  const { data: due, error } = await supabase
    .from('lease_renewals_due').select('*');
  if (error) return jsonErr(500, 'Failed to load renewals: ' + error.message);

  const candidates = (due || []).filter(r => !r.recently_nudged);

  if (dryRun) {
    return jsonOk({
      success: true, dry_run: true,
      total_in_window: due?.length || 0,
      eligible_for_nudge: candidates.length,
      candidates: candidates.map(c => ({
        app_id: c.app_id,
        email:  c.email,
        days_until_end: c.days_until_end,
      })),
    });
  }

  const sent: Array<{ app_id: string; email: string; days: number }> = [];
  const failed: Array<{ app_id: string; error: string }> = [];

  for (const r of candidates) {
    if (!r.email) continue;
    try {
      await sendEmail({
        to:      r.email,
        subject: `Lease Renewal Coming Up — ${r.days_until_end} Days Remaining (Ref: ${r.app_id})`,
        html:    renewalNudgeHtml(
          r.first_name || 'Tenant',
          r.property_address || '',
          r.lease_end_date,
          r.days_until_end,
          r.app_id,
        ),
      });
      // Dedupe: log to admin_actions so the view's recently_nudged
      // flag flips to true for the next run.
      await supabase.from('admin_actions').insert({
        action:      'lease_renewal_nudge_sent',
        target_type: 'application',
        target_id:   r.app_id,
        metadata:    { actor: auth.actor, days_until_end: r.days_until_end, email: r.email },
      });
      sent.push({ app_id: r.app_id, email: r.email, days: r.days_until_end });
    } catch (e) {
      failed.push({ app_id: r.app_id, error: (e as Error).message });
    }
  }

  return jsonOk({
    success: true,
    total_in_window: due?.length || 0,
    eligible_for_nudge: candidates.length,
    sent_count: sent.length,
    failed_count: failed.length,
    sent, failed,
  });
});
