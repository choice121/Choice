// ============================================================
// Choice Properties — purge-expired-pipeline-recovery Edge Function
// Stage 2 Automatic Permanent Deletion Worker (> 24 hours)
// ============================================================
// Triggered hourly via GitHub Actions cron (x-cron-secret) or manually
// by an authenticated administrator.
//
// Responsibilities:
//   1. Claim expired rows from pipeline.pipeline_recovery_archive
//      (recovery_expires_at <= now(), skipping rows actively being restored).
//   2. Permanently remove associated raw JSON payloads from the
//      `pipeline-raw-payloads` Supabase Storage bucket.
//   3. Null out pipeline_row_snapshot and mark recovery_status =
//      'permanently_deleted' while preserving lightweight audit history
//      in public.publishing_batches and public.publishing_batch_properties.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';

interface ExpiredItem {
  id: string;
  batch_id: string;
  pipeline_id: string;
  raw_storage_paths: unknown;
  recovery_expires_at: string;
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

async function authorizeCronOrAdmin(
  req: Request,
  adminClient: ReturnType<typeof createClient>
): Promise<{ ok: boolean; status: number; error?: string }> {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const incomingCron = req.headers.get('x-cron-secret');
  if (cronSecret && incomingCron && incomingCron === cronSecret) {
    return { ok: true, status: 200 };
  }

  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (serviceKey && match[1] === serviceKey) {
    return { ok: true, status: 200 };
  }

  const { data: userData, error: userErr } = await adminClient.auth.getUser(match[1]);
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: 'invalid_token' };
  }

  const { data: adminRow } = await adminClient
    .from('admin_roles')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!adminRow) {
    return { ok: false, status: 403, error: 'admin_required' };
  }

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

  const auth = await authorizeCronOrAdmin(req, adminClient);
  if (!auth.ok) {
    return jsonResp({ ok: false, error: auth.error }, auth.status, origin);
  }

  let body: { dry_run?: boolean; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const dryRun = Boolean(body.dry_run);
  const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 500);

  // 1. Claim expired recovery records (strictly where recovery_expires_at <= now())
  const { data: claimData, error: claimErr } = await adminClient.rpc('pipeline_claim_expired_recovery', {
    p_limit: limit,
  });

  if (claimErr) {
    return jsonResp({ ok: false, error: claimErr.message }, 500, origin);
  }

  const parsedClaim = typeof claimData === 'string' ? JSON.parse(claimData) : claimData;
  const items: ExpiredItem[] = Array.isArray(parsedClaim?.items) ? parsedClaim.items : [];

  if (items.length === 0) {
    return jsonResp({
      ok: true,
      dry_run: dryRun,
      expired_found: 0,
      purged_count: 0,
      storage_deleted_count: 0,
      checked_at: parsedClaim?.checked_at || new Date().toISOString(),
    }, 200, origin);
  }

  if (dryRun) {
    return jsonResp({
      ok: true,
      dry_run: true,
      expired_found: items.length,
      preview: items.map((item) => ({
        archive_id: item.id,
        batch_id: item.batch_id,
        pipeline_id: item.pipeline_id,
        recovery_expires_at: item.recovery_expires_at,
        raw_storage_paths_count: Array.isArray(item.raw_storage_paths) ? item.raw_storage_paths.length : 0,
      })),
    }, 200, origin);
  }

  // 2. Delete associated raw payload blobs from pipeline-raw-payloads Storage bucket
  const errorsById: Record<string, string> = {};
  let storageDeletedCount = 0;

  for (const item of items) {
    const paths = Array.isArray(item.raw_storage_paths)
      ? item.raw_storage_paths.filter((p): p is string => typeof p === 'string' && p.length > 0)
      : [];

    if (paths.length > 0) {
      const { error: rmErr } = await adminClient.storage
        .from('pipeline-raw-payloads')
        .remove(paths);

      if (rmErr) {
        errorsById[item.id] = `storage_remove_failed: ${rmErr.message}`;
      } else {
        storageDeletedCount += paths.length;
      }
    }
  }

  // 3. Finalize permanent purge in Postgres (wipes pipeline_row_snapshot, keeps lightweight audit)
  const archiveIds = items.map((item) => item.id);
  const { data: finData, error: finErr } = await adminClient.rpc('pipeline_finalize_permanent_purge', {
    p_archive_ids: archiveIds,
    p_errors: errorsById,
  });

  if (finErr) {
    return jsonResp({ ok: false, error: finErr.message }, 500, origin);
  }

  const finalized = typeof finData === 'string' ? JSON.parse(finData) : finData;

  return jsonResp({
    ok: true,
    dry_run: false,
    expired_found: items.length,
    purged_count: finalized?.purged ?? 0,
    storage_deleted_count: storageDeletedCount,
    errors_count: finalized?.errors ?? 0,
    purged_at: finalized?.purged_at || new Date().toISOString(),
  }, 200, origin);
});
