// ============================================================
// Choice Properties — job-manager Edge Function
// Phase 9: Concurrent Multi-AI Job Manager, Worker Isolation,
// Lease/Heartbeat Recovery & Safe Disposable Folder Cleanup.
// ============================================================
// Standardized Worker Contract actions:
//   - register_job               : Validate 4-digit ID, lock policy_set_id, create batch + disposable folder + queued job
//   - claim_next_or_assigned     : Atomic queue/assigned claim (FOR UPDATE SKIP LOCKED) with lease isolation
//   - heartbeat                  : Renew worker lease TTL + update progress telemetry
//   - report_stage               : Lease-guarded stage transition & progress persistence
//   - pause_job                  : Cleanly pause job & preserve resume_stage without losing work
//   - resume_job                 : Resume paused/reaped/failed job cleanly from resume_stage
//   - reap_stale_leases          : Reclaim expired worker leases back to recoverable queue
//   - cleanup_disposable_folder  : Gate on link_verified_at + registry, move raw JSON to recovery/{batch_id}/,
//                                  archive 24h recovery rows, remove ONLY verified-published staging rows,
//                                  hold failed/review rows, and delete disposable folder only if 0 unresolved remain
//   - get_job / list_jobs        : Inspect job, worker leases, and batch status
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';
import {
  VALID_JOB_STAGES,
  buildRecoveryStoragePath,
  isValidUuid,
  mapJobRpcErrorToHttpStatus,
  normalizeBatchId,
} from '../_shared/job-manager.ts';

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

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function safeStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed || null;
}

function safeInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

async function verifyAdminOrService(
  req: Request,
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ ok: boolean; status: number; error?: string; userId?: string | null; actor: string }> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: 'admin_auth_required', actor: 'anonymous' };

  const token = match[1].trim();
  if (!token) return { ok: false, status: 401, error: 'admin_auth_required', actor: 'anonymous' };

  if (serviceKey && constantTimeEqual(token, serviceKey)) {
    return { ok: true, status: 200, userId: null, actor: 'service_role' };
  }

  const { data: userData, error: authErr } = await adminClient.auth.getUser(token);
  if (!authErr && userData?.user) {
    const { data: adminRow, error: roleErr } = await adminClient
      .from('admin_roles')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (roleErr) {
      return { ok: false, status: 500, error: 'admin_check_failed', actor: userData.user.id };
    }
    if (!adminRow) {
      return { ok: false, status: 403, error: 'admin_required', actor: userData.user.id };
    }
    return {
      ok: true,
      status: 200,
      userId: userData.user.id,
      actor: userData.user.email || userData.user.id,
    };
  }

  if (token.startsWith('eyJ')) {
    try {
      const checkRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: serviceKey,
        },
        signal: AbortSignal.timeout(5000),
      });
      await checkRes.body?.cancel();
      if (checkRes.ok) {
        return { ok: true, status: 200, userId: null, actor: 'service_role_jwt' };
      }
    } catch {
      // Fall through to 401
    }
  }

  return { ok: false, status: 401, error: 'invalid_session', actor: 'anonymous' };
}

function parseRpcJson(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return { ok: false, error: 'invalid_rpc_response' };
    }
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { ok: false, error: 'empty_rpc_response' };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return corsResponse(origin);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResp({ ok: false, error: 'method_not_allowed' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
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

  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  if (req.method === 'POST') {
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return jsonResp({ ok: false, error: 'json_object_required' }, 400, origin);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return jsonResp({ ok: false, error: 'invalid_json' }, 400, origin);
    }
  } else {
    body = {
      action: url.searchParams.get('action') || 'list_jobs',
      batch_id: url.searchParams.get('batch_id') || '',
      stage: url.searchParams.get('stage') || '',
      worker_id: url.searchParams.get('worker_id') || '',
      limit: url.searchParams.get('limit') || '50',
    };
  }

  const action = safeStr(body.action) || (req.method === 'GET' ? 'list_jobs' : '');
  if (!action) {
    return jsonResp({ ok: false, error: 'action_required' }, 400, origin);
  }

  // ── Read Actions (GET or POST) ────────────────────────────────────────────
  if (action === 'get_job') {
    const batchId = normalizeBatchId(body.batch_id);
    if (!batchId) return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);

    const { data, error } = await adminClient.rpc('job_get', { p_batch_id: batchId });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const res = parseRpcJson(data);
    return jsonResp(res, res.ok ? 200 : mapJobRpcErrorToHttpStatus(res.error), origin);
  }

  if (action === 'list_jobs') {
    const stage = safeStr(body.stage);
    const workerId = safeStr(body.worker_id);
    const limit = safeInt(body.limit) ?? 50;

    const { data, error } = await adminClient.rpc('job_list', {
      p_stage: stage,
      p_worker_id: workerId,
      p_limit: limit,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const res = parseRpcJson(data);
    return jsonResp(res, res.ok ? 200 : mapJobRpcErrorToHttpStatus(res.error), origin);
  }

  if (req.method !== 'POST') {
    return jsonResp({ ok: false, error: 'post_required' }, 405, origin);
  }

  // ── 1. register_job ───────────────────────────────────────────────────────
  if (action === 'register_job') {
    const batchId = normalizeBatchId(body.batch_id);
    if (!batchId) return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);

    const taskConfig =
      body.task_config && typeof body.task_config === 'object' && !Array.isArray(body.task_config)
        ? body.task_config
        : {};
    const claimImmediately = body.claim_immediately === true || body.auto_claim === true;
    const workerId = safeStr(body.worker_id);
    const workerType = safeStr(body.worker_type) || 'ai_worker';
    const leaseSeconds = safeInt(body.lease_seconds) ?? 300;

    const { data, error } = await adminClient.rpc('job_register', {
      p_batch_id: batchId,
      p_target_market: safeStr(body.target_market) || 'Unspecified',
      p_workflow_type: safeStr(body.workflow_type) || 'scrape_and_publish',
      p_visibility: safeStr(body.visibility) || 'private_placement',
      p_task_config: taskConfig,
      p_description: safeStr(body.description),
      p_idempotency_key: safeStr(body.idempotency_key),
      p_worker_id: workerId,
      p_worker_type: workerType,
      p_claim_immediately: claimImmediately,
      p_lease_seconds: leaseSeconds,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const res = parseRpcJson(data);
    if (!res.ok) {
      return jsonResp(res, mapJobRpcErrorToHttpStatus(res.error), origin);
    }

    try {
      await adminClient.from('admin_actions').insert({
        user_id: auth.userId || null,
        action: 'job.register',
        target_type: 'publishing_batch',
        target_id: String(res.batch_id || batchId),
        metadata: {
          actor: auth.actor,
          worker_id: workerId,
          claimed: Boolean(res.claimed),
          policy_set_id: res.policy_set_id || null,
        },
      });
    } catch {
      // Non-fatal audit logging
    }

    return jsonResp(res, 200, origin);
  }

  // ── 2. claim_next_or_assigned (or claim_job) ──────────────────────────────
  if (action === 'claim_next_or_assigned' || action === 'claim_job') {
    const workerId = safeStr(body.worker_id);
    if (!workerId) return jsonResp({ ok: false, error: 'worker_id_required' }, 400, origin);

    const batchId = normalizeBatchId(body.batch_id) || null;
    const workerType = safeStr(body.worker_type) || 'ai_worker';
    const leaseSeconds = safeInt(body.lease_seconds) ?? 300;
    const adminOverride = body.admin_override === true;

    const { data, error } = await adminClient.rpc('job_claim', {
      p_worker_id: workerId,
      p_worker_type: workerType,
      p_batch_id: batchId,
      p_lease_seconds: leaseSeconds,
      p_admin_override: adminOverride,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const res = parseRpcJson(data);
    return jsonResp(res, res.ok ? 200 : mapJobRpcErrorToHttpStatus(res.error), origin);
  }

  // ── 3. heartbeat ──────────────────────────────────────────────────────────
  if (action === 'heartbeat') {
    const batchId = normalizeBatchId(body.batch_id);
    const workerId = safeStr(body.worker_id);
    const leaseToken = safeStr(body.lease_token);
    if (!batchId) return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);
    if (!workerId) return jsonResp({ ok: false, error: 'worker_id_required' }, 400, origin);
    if (!leaseToken) return jsonResp({ ok: false, error: 'lease_token_required' }, 400, origin);
    if (!isValidUuid(leaseToken)) {
      return jsonResp({ ok: false, error: 'invalid_lease_token' }, 400, origin);
    }

    const progressJson =
      body.progress_json && typeof body.progress_json === 'object' && !Array.isArray(body.progress_json)
        ? body.progress_json
        : null;
    const leaseSeconds = safeInt(body.lease_seconds) ?? 300;

    const { data, error } = await adminClient.rpc('job_heartbeat', {
      p_batch_id: batchId,
      p_worker_id: workerId,
      p_lease_token: leaseToken,
      p_lease_seconds: leaseSeconds,
      p_progress_json: progressJson,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const res = parseRpcJson(data);
    return jsonResp(res, res.ok ? 200 : mapJobRpcErrorToHttpStatus(res.error), origin);
  }

  // ── 4. report_stage ───────────────────────────────────────────────────────
  if (action === 'report_stage') {
    const batchId = normalizeBatchId(body.batch_id);
    const stage = safeStr(body.stage);
    const workerId = safeStr(body.worker_id);
    const leaseToken = safeStr(body.lease_token);
    const adminOverride = body.admin_override === true;

    if (!batchId) return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);
    if (!stage || !VALID_JOB_STAGES.has(stage)) {
      return jsonResp({ ok: false, error: 'invalid_stage', stage }, 400, origin);
    }
    if (!adminOverride) {
      if (!workerId) return jsonResp({ ok: false, error: 'worker_id_required' }, 400, origin);
      if (!leaseToken) return jsonResp({ ok: false, error: 'lease_token_required' }, 400, origin);
      if (!isValidUuid(leaseToken)) {
        return jsonResp({ ok: false, error: 'invalid_lease_token' }, 400, origin);
      }
    }

    const progressJson =
      body.progress_json && typeof body.progress_json === 'object' && !Array.isArray(body.progress_json)
        ? body.progress_json
        : null;
    const errorMessage = safeStr(body.error_message);
    const leaseSeconds = safeInt(body.lease_seconds) ?? 300;

    const { data, error } = await adminClient.rpc('job_report_stage', {
      p_batch_id: batchId,
      p_worker_id: workerId,
      p_lease_token: leaseToken && isValidUuid(leaseToken) ? leaseToken : null,
      p_stage: stage,
      p_progress_json: progressJson,
      p_error_message: errorMessage,
      p_lease_seconds: leaseSeconds,
      p_admin_override: adminOverride,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const res = parseRpcJson(data);
    return jsonResp(res, res.ok ? 200 : mapJobRpcErrorToHttpStatus(res.error), origin);
  }

  // ── 5. pause_job ──────────────────────────────────────────────────────────
  if (action === 'pause_job') {
    const batchId = normalizeBatchId(body.batch_id);
    if (!batchId) return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);

    const reason = safeStr(body.reason) || 'Paused by operator';
    const workerId = safeStr(body.worker_id);
    const leaseToken = safeStr(body.lease_token);
    const adminOverride = body.admin_override !== false;

    if (!adminOverride && (!workerId || !leaseToken || !isValidUuid(leaseToken))) {
      return jsonResp({ ok: false, error: 'lease_token_required' }, 400, origin);
    }

    const { data, error } = await adminClient.rpc('job_pause', {
      p_batch_id: batchId,
      p_reason: reason,
      p_worker_id: workerId,
      p_lease_token: leaseToken && isValidUuid(leaseToken) ? leaseToken : null,
      p_admin_override: adminOverride,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const res = parseRpcJson(data);
    return jsonResp(res, res.ok ? 200 : mapJobRpcErrorToHttpStatus(res.error), origin);
  }

  // ── 6. resume_job ─────────────────────────────────────────────────────────
  if (action === 'resume_job') {
    const batchId = normalizeBatchId(body.batch_id);
    if (!batchId) return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);

    const workerId = safeStr(body.worker_id);
    const workerType = safeStr(body.worker_type) || 'ai_worker';
    const leaseSeconds = safeInt(body.lease_seconds) ?? 300;

    const { data, error } = await adminClient.rpc('job_resume', {
      p_batch_id: batchId,
      p_worker_id: workerId,
      p_worker_type: workerType,
      p_lease_seconds: leaseSeconds,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const res = parseRpcJson(data);
    return jsonResp(res, res.ok ? 200 : mapJobRpcErrorToHttpStatus(res.error), origin);
  }

  // ── 7. reap_stale_leases ──────────────────────────────────────────────────
  if (action === 'reap_stale_leases') {
    const staleMinutes = safeInt(body.worker_stale_minutes) ?? 10;
    const { data, error } = await adminClient.rpc('job_reap_stale_leases', {
      p_worker_stale_minutes: staleMinutes,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const res = parseRpcJson(data);
    return jsonResp(res, res.ok ? 200 : mapJobRpcErrorToHttpStatus(res.error), origin);
  }

  // ── 8. cleanup_disposable_folder ──────────────────────────────────────────
  if (action === 'cleanup_disposable_folder') {
    const batchId = normalizeBatchId(body.batch_id);
    if (!batchId) return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);

    const workerId = safeStr(body.worker_id);
    const leaseToken = safeStr(body.lease_token);
    const adminOverride = body.admin_override === true;

    if (leaseToken && !isValidUuid(leaseToken)) {
      return jsonResp({ ok: false, error: 'invalid_lease_token' }, 400, origin);
    }

    // Step 1: Pre-check verification gate + lease ownership + eligible vs held partition
    const { data: prepRaw, error: prepErr } = await adminClient.rpc('job_cleanup_prepare', {
      p_batch_id: batchId,
      p_worker_id: workerId,
      p_lease_token: leaseToken,
      p_admin_override: adminOverride,
    });
    if (prepErr) return jsonResp({ ok: false, error: prepErr.message }, 500, origin);
    const prep = parseRpcJson(prepRaw);
    if (!prep.ok) {
      return jsonResp(prep, mapJobRpcErrorToHttpStatus(prep.error), origin);
    }

    const resolvedBatchId = String(prep.batch_id || batchId);
    const eligibleRows = Array.isArray(prep.eligible_rows)
      ? (prep.eligible_rows as Array<Record<string, unknown>>)
      : [];

    // Step 2: Move raw JSON Storage objects to recovery/{batch_id}/... for 24h recovery
    const rawPathsMap: Record<string, string[]> = {};
    const storageWarnings: Array<{ pipeline_id: string; path: string; warning: string }> = [];
    let storageMovedCount = 0;

    for (const row of eligibleRows) {
      const pipelineId = safeStr(row.pipeline_id);
      const srcPath = safeStr(row.raw_payload_storage_path);
      if (!pipelineId || !srcPath) continue;

      const destPath = buildRecoveryStoragePath(resolvedBatchId, srcPath);
      if (!destPath) continue;

      if (destPath === srcPath) {
        rawPathsMap[pipelineId] = [destPath];
        continue;
      }

      try {
        const { error: moveErr } = await adminClient.storage
          .from('pipeline-raw-payloads')
          .move(srcPath, destPath);

        if (!moveErr) {
          rawPathsMap[pipelineId] = [destPath];
          storageMovedCount++;
        } else {
          // If object already lives at recovery/{batch_id}/..., still track it cleanly
          const { data: existingList } = await adminClient.storage
            .from('pipeline-raw-payloads')
            .list(destPath.split('/').slice(0, -1).join('/'), {
              search: destPath.split('/').pop() || undefined,
              limit: 1,
            });
          if (Array.isArray(existingList) && existingList.length > 0) {
            rawPathsMap[pipelineId] = [destPath];
          } else {
            storageWarnings.push({
              pipeline_id: pipelineId,
              path: srcPath,
              warning: moveErr.message || 'storage_move_skipped',
            });
          }
        }
      } catch (err) {
        storageWarnings.push({
          pipeline_id: pipelineId,
          path: srcPath,
          warning: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Step 3: Atomically archive verified-published staging rows (24h TTL),
    // hold failed/needs_review rows untouched, and delete disposable folder only if empty.
    const { data: cleanRaw, error: cleanErr } = await adminClient.rpc(
      'job_cleanup_disposable_folder',
      {
        p_batch_id: resolvedBatchId,
        p_raw_paths: rawPathsMap,
        p_worker_id: workerId,
        p_lease_token: leaseToken,
        p_admin_override: adminOverride,
      },
    );
    if (cleanErr) return jsonResp({ ok: false, error: cleanErr.message }, 500, origin);
    const cleanRes = parseRpcJson(cleanRaw);
    if (!cleanRes.ok) {
      return jsonResp(cleanRes, mapJobRpcErrorToHttpStatus(cleanRes.error), origin);
    }

    try {
      await adminClient.from('admin_actions').insert({
        user_id: auth.userId || null,
        action: 'batch.cleanup_disposable_folder',
        target_type: 'publishing_batch',
        target_id: resolvedBatchId,
        metadata: {
          actor: auth.actor,
          worker_id: workerId,
          archived_count: cleanRes.archived_count ?? 0,
          pipeline_deleted_count: cleanRes.pipeline_deleted_count ?? 0,
          held_unresolved_count: cleanRes.held_unresolved_count ?? 0,
          folder_deleted: Boolean(cleanRes.folder_deleted),
          storage_moved_count: storageMovedCount,
        },
      });
    } catch {
      // Non-fatal audit logging
    }

    return jsonResp(
      {
        ...cleanRes,
        storage_moved_count: storageMovedCount,
        storage_warnings: storageWarnings,
      },
      200,
      origin,
    );
  }

  return jsonResp({ ok: false, error: 'invalid_action', action }, 400, origin);
});
