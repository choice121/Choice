// ─────────────────────────────────────────────────────────────────────
// submit-deposit-dispute  (Phase 09 chunk 5/5)
//
// Tenant-facing edge function. The tenant cannot UPDATE
// lease_deposit_accountings directly because the chunk 1 RLS only
// grants them SELECT. They POST here with their accounting_id and
// a dispute_text body (≤ 5000 chars), we verify the caller's auth
// email matches the application.email tied to that accounting, then
// stamp tenant_disputed_at = now() + tenant_dispute_text via the
// service-role client.
//
// All disputes are append-only via audit_logs (Phase 06).
// Idempotent: if tenant_disputed_at is already set, a re-submit
// updates the text + bumps the timestamp (so a tenant can clarify
// their objection within their state's response window).
//
// CORS: same shape as generate-deposit-letter so the tenant portal
// (served from CF Pages) can call it.
//
// Body: { accounting_id: uuid, dispute_text: string }
// ─────────────────────────────────────────────────────────────────────

import { serve }        from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const SB_URL  = Deno.env.get('SUPABASE_URL')              || '';
const SB_SRV  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY')         || '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_DISPUTE_LEN = 5000;
const MIN_DISPUTE_LEN = 10;

function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
function jsonErr(code: string, message: string, status = 400, extra?: unknown): Response {
  return jsonOk({ success: false, code, message, ...(extra ? { extra } : {}) }, status);
}

interface AuthCtx { user_id: string; email: string; }

async function getAuthCtx(req: Request): Promise<{ ok: boolean; ctx?: AuthCtx; err?: Response }> {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return { ok: false, err: jsonErr('UNAUTHORIZED_NO_AUTH_HEADER', 'Missing Bearer token', 401) };
  }
  const token = auth.slice(7);
  const sb = createClient(SB_URL, SB_ANON, {
    global: { headers: { Authorization: 'Bearer ' + token } },
  });
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData?.user) {
    return { ok: false, err: jsonErr('UNAUTHORIZED_INVALID_TOKEN', userErr?.message || 'Invalid token', 401) };
  }
  return { ok: true, ctx: { user_id: userData.user.id, email: userData.user.email || '' } };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST')    return jsonErr('METHOD_NOT_ALLOWED', 'POST required', 405);

  // 1. Auth
  const auth = await getAuthCtx(req);
  if (!auth.ok || !auth.ctx) return auth.err!;

  // 2. Body
  let body: { accounting_id?: string; dispute_text?: string };
  try { body = await req.json(); }
  catch { return jsonErr('BAD_JSON', 'Body must be valid JSON'); }

  const accId = String(body.accounting_id || '').trim();
  const text  = String(body.dispute_text  || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accId)) {
    return jsonErr('BAD_ACCOUNTING_ID', 'accounting_id must be a UUID');
  }
  if (text.length < MIN_DISPUTE_LEN) {
    return jsonErr('DISPUTE_TOO_SHORT', `dispute_text must be at least ${MIN_DISPUTE_LEN} characters`);
  }
  if (text.length > MAX_DISPUTE_LEN) {
    return jsonErr('DISPUTE_TOO_LONG', `dispute_text must be at most ${MAX_DISPUTE_LEN} characters`);
  }

  // 3. Service-role client
  const sb = createClient(SB_URL, SB_SRV, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 4. Verify ownership: caller's email must match application.email
  //    on the accounting's app_id (case-insensitive).
  const { data: accRow, error: accErr } = await sb
    .from('lease_deposit_accountings')
    .select(`id, app_id, generated_at, tenant_disputed_at,
             state_code_snapshot, state_return_deadline,
             applications!inner ( id, email, first_name, last_name )`)
    .eq('id', accId)
    .maybeSingle();
  if (accErr) return jsonErr('DB_LOOKUP_FAILED', accErr.message, 500);
  if (!accRow) return jsonErr('ACCOUNTING_NOT_FOUND', 'No accounting with that id', 404);

  const tenantEmail = (accRow.applications as { email?: string } | null)?.email || '';
  if (!tenantEmail || tenantEmail.toLowerCase() !== (auth.ctx.email || '').toLowerCase()) {
    return jsonErr('FORBIDDEN_NOT_TENANT', 'Caller is not the tenant on this accounting', 403);
  }

  if (!accRow.generated_at) {
    return jsonErr('LETTER_NOT_GENERATED', 'Cannot dispute: the deposit-accounting letter has not been finalized yet', 409);
  }

  // 5. Update (idempotent — re-submits update text + bump timestamp)
  const isFirstDispute = !accRow.tenant_disputed_at;
  const { error: updErr } = await sb
    .from('lease_deposit_accountings')
    .update({
      tenant_disputed_at:  new Date().toISOString(),
      tenant_dispute_text: text,
      updated_at:          new Date().toISOString(),
    })
    .eq('id', accId);
  if (updErr) return jsonErr('UPDATE_FAILED', updErr.message, 500);

  // 6. Audit log (best-effort)
  try {
    await sb.from('audit_logs').insert({
      action:        isFirstDispute ? 'deposit_dispute_filed' : 'deposit_dispute_updated',
      entity_type:   'lease_deposit_accountings',
      entity_id:     accId,
      actor:         auth.ctx.email,
      actor_user_id: auth.ctx.user_id,
      meta: {
        app_id:                accRow.app_id,
        dispute_text_length:   text.length,
        was_first_dispute:     isFirstDispute,
        state_code:            accRow.state_code_snapshot,
        state_return_deadline: accRow.state_return_deadline,
      },
    });
  } catch (_) { /* non-fatal */ }

  return jsonOk({
    success:               true,
    accounting_id:         accId,
    was_first_dispute:     isFirstDispute,
    tenant_disputed_at:    new Date().toISOString(),
    dispute_text_length:   text.length,
    state_code:            accRow.state_code_snapshot,
    state_return_deadline: accRow.state_return_deadline,
  });
});
