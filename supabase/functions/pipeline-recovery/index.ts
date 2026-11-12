// ============================================================
// Choice Properties — pipeline-recovery Edge Function
// Admin-only endpoint for Publishing History & 24-Hour Recovery
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';

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

async function verifyAdmin(req: Request, adminClient: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: 'admin_auth_required' };

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (serviceKey && match[1] === serviceKey) {
    return { ok: true, status: 200 };
  }

  const { data: userData, error: authErr } = await adminClient.auth.getUser(match[1]);
  if (authErr || !userData?.user) {
    return { ok: false, status: 401, error: 'invalid_session' };
  }

  const { data: adminRow } = await adminClient
    .from('admin_roles')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!adminRow) return { ok: false, status: 403, error: 'admin_required' };
  return { ok: true, status: 200 };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return corsResponse(origin);
  if (req.method !== 'POST') return jsonResp({ ok: false, error: 'method_not_allowed' }, 405, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResp({ ok: false, error: 'missing_supabase_config' }, 503, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = await verifyAdmin(req, adminClient);
  if (!auth.ok) return jsonResp({ ok: false, error: auth.error }, auth.status, origin);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResp({ ok: false, error: 'invalid_json' }, 400, origin);
  }

  const action = String(body.action || '');

  if (action === 'list_history') {
    const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100);
    const market = typeof body.market === 'string' && body.market.trim() ? body.market.trim() : null;
    const batchId = typeof body.batch_id === 'string' && body.batch_id.trim() ? body.batch_id.trim() : null;

    const { data, error } = await adminClient.rpc('pipeline_get_publishing_history', {
      p_limit: limit,
      p_market: market,
      p_batch_id: batchId,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return jsonResp(parsed, 200, origin);
  }

  if (action === 'list_recoverable') {
    const { data, error } = await adminClient.rpc('pipeline_get_recoverable_batches');
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return jsonResp(parsed, 200, origin);
  }

  if (action === 'restore_batch') {
    const batchId = typeof body.batch_id === 'string' ? body.batch_id.trim() : '';
    if (!batchId) return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);

    const pipelineIds = Array.isArray(body.pipeline_ids)
      ? body.pipeline_ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : null;

    const reason = typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : 'Explicit administrator restoration from Admin Console';

    // Fetch raw storage paths before restoring so storage objects are restored alongside DB rows
    const { data: archiveRows } = await adminClient
      .schema('pipeline')
      .from('pipeline_recovery_archive')
      .select('pipeline_id, raw_storage_paths')
      .eq('batch_id', batchId);

    const pathsToRestore: string[] = [];
    for (const row of (archiveRows || [])) {
      if (!pipelineIds || pipelineIds.length === 0 || pipelineIds.includes(row.pipeline_id)) {
        if (Array.isArray(row.raw_storage_paths)) {
          for (const p of row.raw_storage_paths) {
            if (typeof p === 'string' && p.startsWith('recovery/')) pathsToRestore.push(p);
          }
        }
      }
    }

    const { data, error } = await adminClient.rpc('pipeline_restore_batch', {
      p_batch_id: batchId,
      p_pipeline_ids: pipelineIds && pipelineIds.length > 0 ? pipelineIds : null,
      p_reason: reason,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;

    const rpcRawPaths = Array.isArray(parsed?.restored_raw_paths) ? parsed.restored_raw_paths : [];
    const uniquePaths = [...new Set([...pathsToRestore, ...rpcRawPaths].filter((p): p is string => typeof p === 'string' && p.startsWith('recovery/')))];

    if (parsed?.ok && uniquePaths.length > 0) {
      const recoveryPrefix = `recovery/${batchId}/`;
      for (const srcPath of uniquePaths) {
        const destPath = srcPath.startsWith(recoveryPrefix)
          ? srcPath.slice(recoveryPrefix.length)
          : (srcPath.split('/').pop() || srcPath);
        if (destPath && destPath !== srcPath) {
          await adminClient.storage.from('pipeline-raw-payloads').move(srcPath, destPath);
        }
      }
    }

    return jsonResp(parsed, parsed?.ok ? 200 : 400, origin);
  }

  return jsonResp({ ok: false, error: 'invalid_action' }, 400, origin);
});
