// ============================================================
// Choice Properties — verify-batch-publication Edge Function
// Phase 8: Post-publish live verification of registry parity,
// anon RLS/RPC isolation, sitemap & /rent/ SSR exclusion,
// property-share rent/description parity, leak audit, and
// >= 4 reachable photo URLs before setting link_verified_at.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';
import { runBatchVerification } from '../_shared/batch-verifier.ts';
import { verifyBatchWorkerLease } from '../_shared/worker-lease.ts';

interface AdminAuthResult {
  ok: boolean;
  status: number;
  error?: string;
  userId?: string | null;
  isHumanAdmin?: boolean;
}

function jsonResp(data: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

async function verifyAdminOrService(
  req: Request,
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<AdminAuthResult> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: 'admin_auth_required' };

  const token = match[1].trim();
  if (!token) return { ok: false, status: 401, error: 'admin_auth_required' };

  if (serviceKey && token === serviceKey) {
    return { ok: true, status: 200, userId: null, isHumanAdmin: false };
  }

  const { data: userData, error: authErr } = await adminClient.auth.getUser(token);
  if (!authErr && userData?.user) {
    const { data: adminRow, error: roleErr } = await adminClient
      .from('admin_roles')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (roleErr) return { ok: false, status: 500, error: 'admin_check_failed' };
    if (!adminRow) return { ok: false, status: 403, error: 'admin_required' };
    return { ok: true, status: 200, userId: userData.user.id, isHumanAdmin: true };
  }

  if (token.startsWith('eyJ')) {
    try {
      const checkRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: serviceKey,
        },
      });
      await checkRes.body?.cancel();
      if (checkRes.ok) {
        return { ok: true, status: 200, userId: null, isHumanAdmin: false };
      }
    } catch {
      // Fall through to 401
    }
  }

  return { ok: false, status: 401, error: 'invalid_session' };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return corsResponse(origin);
  if (req.method !== 'POST') {
    return jsonResp({ ok: false, error: 'method_not_allowed' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!supabaseUrl || !serviceKey) {
    return jsonResp({ ok: false, error: 'missing_supabase_config' }, 503, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = await verifyAdminOrService(req, adminClient, supabaseUrl, serviceKey);
  if (!auth.ok) {
    return jsonResp({ ok: false, error: auth.error }, auth.status, origin);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResp({ ok: false, error: 'invalid_json' }, 400, origin);
  }

  const batchId = typeof body.batch_id === 'string' ? body.batch_id.replace(/^#/, '').trim() : '';
  if (!batchId) {
    return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);
  }

  const leaseCheck = await verifyBatchWorkerLease({
    adminClient,
    batchId,
    req,
    body,
    isHumanAdmin: auth.isHumanAdmin,
  });
  if (!leaseCheck.ok) {
    return jsonResp(leaseCheck.body, leaseCheck.status, origin);
  }

  const output = await runBatchVerification(adminClient, {
    batchId,
    checkLivePages: body.check_live_pages !== false,
    checkMediaHead: body.check_media_head !== false,
    supabaseUrl,
    serviceKey,
    anonKey,
    siteBase: typeof body.site_base === 'string' && body.site_base.trim() ? body.site_base.trim() : undefined,
  });

  try {
    await adminClient
      .from('admin_actions')
      .insert({
        user_id: auth.userId || null,
        action: 'batch.verify',
        target_type: 'publishing_batch',
        target_id: output.batch_id,
        metadata: {
          verified: output.verified,
          checks: output.checks,
          failures: output.failures,
        },
      });
  } catch {
    // Non-fatal audit logging
  }

  return jsonResp(output, output.verified ? 200 : 422, origin);
});
