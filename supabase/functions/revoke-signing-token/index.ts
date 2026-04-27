/**
 * revoke-signing-token -- Phase 05 -- ADMIN ONLY
 *
 * Allows an admin to revoke an in-flight signing token (tenant,
 * co-applicant or amendment).  Calls the DB RPC revoke_signing_token
 * which atomically marks the registry row revoked AND nulls out the
 * live token column on applications/lease_amendments so the link is
 * unusable from that instant on.
 */
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;
  const actor = user.email || 'admin';

  let body: { token: string; reason?: string };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }
  const { token, reason } = body;
  if (!token) return jsonErr(400, 'Missing token');

  const { data: revoked, error: rpcErr } = await supabase.rpc('revoke_signing_token', {
    p_token:  token,
    p_by:     actor,
    p_reason: (reason || 'admin_revoked').slice(0, 200),
  });
  if (rpcErr) return jsonErr(500, 'Revoke failed: ' + rpcErr.message);
  if (!revoked) return jsonErr(409, 'This token is already used or revoked -- nothing to revoke.');

  // Resolve app_id for the audit log
  const { data: meta } = await supabase
    .from('lease_signing_tokens')
    .select('app_id, signer_role')
    .eq('token', token)
    .maybeSingle();

  try {
    await supabase.from('admin_actions').insert({
      action:      'signing_token_revoked',
      target_type: 'application',
      target_id:   meta?.app_id || 'unknown',
      metadata:    {
        actor,
        signer_role: meta?.signer_role || null,
        reason:      reason || 'admin_revoked',
      },
    });
  } catch (_) { /* non-fatal */ }

  return jsonOk({ success: true, revoked: true });
});
