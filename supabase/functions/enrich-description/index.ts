// ============================================================
// Choice Properties — enrich-description Edge Function
// Phase 7: Centralized Description Enrichment Engine
// ============================================================
// Actions:
//   - enrich_property        : Enriches a single staged pipeline_id or dry_run listing
//   - save_manual_enrichment : Validates & persists a bespoke description manually rewritten by the assisting AI
//   - enrich_batch           : Runs deterministic sanitization across a batch (flags manual rewrite needed)
//   - enrichment_summary     : Counts & audit summary for batch/queue
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';
import {
  enrichPropertyDescription,
  type DescriptionMode,
  type EnrichmentResult,
} from '../_shared/description-enrichment.ts';
import { verifyBatchWorkerLease } from '../_shared/worker-lease.ts';

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

async function verifyAdminOrService(
  req: Request,
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ ok: boolean; status: number; error?: string; actor: string; isHumanAdmin: boolean }> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: 'admin_auth_required', actor: 'anonymous', isHumanAdmin: false };

  const token = match[1].trim();
  if (!token) return { ok: false, status: 401, error: 'admin_auth_required', actor: 'anonymous', isHumanAdmin: false };

  if (serviceKey && constantTimeEqual(token, serviceKey)) {
    return { ok: true, status: 200, actor: 'service_role', isHumanAdmin: false };
  }

  const { data: userData, error: authErr } = await adminClient.auth.getUser(token);
  if (!authErr && userData?.user) {
    const { data: adminRow, error: roleErr } = await adminClient
      .from('admin_roles')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (roleErr) return { ok: false, status: 500, error: 'admin_check_failed', actor: userData.user.id, isHumanAdmin: false };
    if (!adminRow) return { ok: false, status: 403, error: 'admin_required', actor: userData.user.id, isHumanAdmin: false };
    return { ok: true, status: 200, actor: userData.user.email || userData.user.id, isHumanAdmin: true };
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
      if (checkRes.ok) return { ok: true, status: 200, actor: 'service_role_jwt', isHumanAdmin: false };
    } catch {
      // Fall through to 401
    }
  }

  return { ok: false, status: 401, error: 'invalid_session', actor: 'anonymous', isHumanAdmin: false };
}

async function loadEffectivePolicy(
  adminClient: ReturnType<typeof createClient>,
  batchId: string | null,
) {
  const { data, error } = await adminClient.rpc('rules_get_effective_policy', {
    p_batch_id: batchId,
  });
  if (error) throw new Error(error.message);
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  if (!parsed?.ok) throw new Error(parsed?.error || 'failed_to_load_policy');
  return {
    policySet: parsed.policy_set || null,
    rulesMap: (parsed.rules_map || {}) as Record<string, unknown>,
  };
}

async function persistEnrichmentResult(
  adminClient: ReturnType<typeof createClient>,
  propertyId: string,
  result: EnrichmentResult,
  actor: string,
) {
  const { data, error } = await adminClient.rpc('pipeline_record_enrichment_result', {
    p_id: propertyId,
    p_enrichment_status: result.status,
    p_ai_description_draft: result.ai_description_draft,
    p_approved_description: result.approved_description,
    p_enrichment_meta: {
      mode: result.mode,
      model: result.model,
      changes: result.changes,
      reasons: result.reasons,
      ruleset_version: result.ruleset_version,
      enriched_by: actor,
    },
    p_enrichment_version: result.ruleset_version || 'v1',
    p_last_enriched_hash: result.original_hash,
    p_needs_review: result.needs_review,
    p_review_reason: result.review_reason,
    p_original_hash: result.original_hash,
    p_cleaned_hash: result.cleaned_hash,
    p_changes: result.changes,
    p_reasons: result.reasons,
    p_confidence: result.confidence,
    p_ruleset_version: result.ruleset_version,
    p_model: result.model,
    p_triggered_by: `enrich-description:${actor}`,
    p_latency_ms: result.latency_ms,
    p_mode: result.mode,
  });
  if (error) throw new Error(error.message);
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  if (!parsed?.ok) throw new Error(parsed?.error || 'failed_to_record_enrichment');
  return parsed;
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
  if (!auth.ok) return jsonResp({ ok: false, error: auth.error }, auth.status, origin);

  let body: Record<string, unknown> = {};
  if (req.method === 'POST') {
    try {
      body = await req.json();
    } catch {
      return jsonResp({ ok: false, error: 'invalid_json' }, 400, origin);
    }
  } else {
    const url = new URL(req.url);
    body = {
      action: url.searchParams.get('action') || 'enrichment_summary',
      batch_id: url.searchParams.get('batch_id') || '',
    };
  }

  const action = String(body.action || 'enrich_batch').trim();
  const manualDescription = typeof (body.manual_description ?? body.approved_description) === 'string'
    ? String(body.manual_description ?? body.approved_description).trim() || null
    : null;
  const overrideMode = typeof body.mode === 'string' && body.mode.trim()
    ? (body.mode.trim() as DescriptionMode)
    : undefined;

  try {
    // ── 1. Enrich Single Property (or save_manual_enrichment / dry_run) ──────
    if (action === 'enrich_property' || action === 'save_manual_enrichment') {
      const batchId = typeof body.batch_id === 'string' && body.batch_id.trim()
        ? body.batch_id.replace(/^#/, '').trim()
        : null;

      if (action === 'save_manual_enrichment' && !manualDescription) {
        return jsonResp({ ok: false, error: 'manual_description_required' }, 400, origin);
      }

      if (body.dry_run === true && body.listing && typeof body.listing === 'object') {
        const policy = await loadEffectivePolicy(adminClient, batchId);
        const result = await enrichPropertyDescription(body.listing as Record<string, unknown>, {
          policy: manualDescription ? { mode: 'manual_rewrite' } : (overrideMode ? { mode: overrideMode } : undefined),
          rulesMap: policy.rulesMap,
          policySet: policy.policySet,
          manualDescription,
          useAi: false,
        });
        return jsonResp({ ok: true, dry_run: true, result }, 200, origin);
      }

      const propertyId = typeof (body.pipeline_id ?? body.property_id ?? body.id) === 'string'
        ? String(body.pipeline_id ?? body.property_id ?? body.id).trim()
        : '';
      if (!propertyId) return jsonResp({ ok: false, error: 'pipeline_id_required' }, 400, origin);

      const { data: row, error: fetchErr } = await adminClient
        .schema('pipeline')
        .from('pipeline_properties')
        .select('*')
        .eq('id', propertyId)
        .maybeSingle();

      if (fetchErr) return jsonResp({ ok: false, error: fetchErr.message }, 500, origin);
      if (!row) return jsonResp({ ok: false, error: 'pipeline_property_not_found' }, 404, origin);

      const effectiveBatchId = row.batch_id || batchId;
      if (body.dry_run !== true && effectiveBatchId) {
        const leaseCheck = await verifyBatchWorkerLease({
          adminClient,
          batchId: effectiveBatchId,
          req,
          body,
          isHumanAdmin: auth.isHumanAdmin,
        });
        if (!leaseCheck.ok) return jsonResp(leaseCheck.body, leaseCheck.status, origin);
      }

      const policy = await loadEffectivePolicy(adminClient, effectiveBatchId);
      const result = await enrichPropertyDescription(row as Record<string, unknown>, {
        policy: manualDescription ? { mode: 'manual_rewrite' } : (overrideMode ? { mode: overrideMode } : undefined),
        rulesMap: policy.rulesMap,
        policySet: policy.policySet,
        manualDescription,
        useAi: false,
      });

      if (body.dry_run !== true) {
        await persistEnrichmentResult(adminClient, propertyId, result, auth.actor);
      }

      return jsonResp({
        ok: true,
        dry_run: body.dry_run === true,
        property_id: propertyId,
        batch_id: effectiveBatchId,
        manual_enrichment_required: result.manual_enrichment_required,
        result,
      }, 200, origin);
    }

    // ── 2. Enrich Batch / Queue ─────────────────────────────────────────────
    if (action === 'enrich_batch') {
      const batchId = typeof body.batch_id === 'string' && body.batch_id.trim()
        ? body.batch_id.replace(/^#/, '').trim()
        : null;
      const statusFilter = typeof body.status_filter === 'string' && body.status_filter.trim()
        ? body.status_filter.trim()
        : null;
      const limit = Math.min(Math.max(Number(body.limit ?? 100) || 100, 1), 300);
      const dryRun = body.dry_run === true;
      const onlyValidated = body.only_validated === true;

      if (!batchId && !auth.isHumanAdmin && !dryRun) {
        return jsonResp({
          ok: false,
          error: 'batch_id_required_for_ai_workers',
          message: 'AI workers must pass an explicit batch_id to enrich_batch.',
        }, 400, origin);
      }

      if (!dryRun && batchId) {
        const leaseCheck = await verifyBatchWorkerLease({
          adminClient,
          batchId,
          req,
          body,
          isHumanAdmin: auth.isHumanAdmin,
        });
        if (!leaseCheck.ok) return jsonResp(leaseCheck.body, leaseCheck.status, origin);
      }

      const policy = await loadEffectivePolicy(adminClient, batchId);

      const { data: candData, error: candErr } = await adminClient.rpc('pipeline_enrich_batch', {
        p_batch_id: batchId,
        p_status_filter: statusFilter,
        p_limit: limit,
      });
      if (candErr) return jsonResp({ ok: false, error: candErr.message }, 500, origin);
      const candParsed = typeof candData === 'string' ? JSON.parse(candData) : candData;
      if (!candParsed?.ok) return jsonResp(candParsed, 400, origin);

      let rows = Array.isArray(candParsed.properties) ? candParsed.properties : [];
      if (onlyValidated) {
        rows = rows.filter((r: Record<string, unknown>) => r.validation_status === 'passed');
      }

      const results: Array<{
        id: string;
        address: string | null;
        enrichment_status: string;
        review_reason: string | null;
        mode: string;
        model: string;
        variance_pct: number;
        approved_description: string | null;
      }> = [];

      let enrichedCount = 0;
      let needsReviewCount = 0;
      let failedCount = 0;

      for (let i = 0; i < rows.length; i += 4) {
        const chunk = rows.slice(i, i + 4);
        const chunkResults = await Promise.all(
          chunk.map(async (item: Record<string, unknown>) => {
            const result = await enrichPropertyDescription(item, {
              policy: overrideMode ? { mode: overrideMode } : undefined,
              rulesMap: policy.rulesMap,
              policySet: policy.policySet,
              useAi: false,
            });
            if (!dryRun && typeof item.id === 'string') {
              await persistEnrichmentResult(adminClient, item.id, result, auth.actor);
            }
            return { item, result };
          }),
        );

        for (const { item, result } of chunkResults) {
          if (result.status === 'enriched') enrichedCount++;
          else if (result.status === 'needs_review') needsReviewCount++;
          else failedCount++;

          results.push({
            id: String(item.id || ''),
            address: typeof item.address === 'string' ? item.address : null,
            enrichment_status: result.status,
            review_reason: result.review_reason,
            mode: result.mode,
            model: result.model,
            variance_pct: result.changes.variance_pct,
            approved_description: result.approved_description,
          });
        }
      }

      const effectiveMode = overrideMode || String(policy.rulesMap?.description_mode || 'sanitize_only');
      return jsonResp({
        ok: true,
        dry_run: dryRun,
        batch_id: batchId,
        policy_version: policy.policySet?.version_label || null,
        effective_mode: effectiveMode,
        manual_enrichment_required: false,
        manual_workflow_note:
          'Authentic source descriptions preserved and sanitized cleanly (sanitize_only policy).',
        total: rows.length,
        enriched_count: enrichedCount,
        needs_review_count: needsReviewCount,
        failed_count: failedCount,
        results,
      }, 200, origin);
    }

    // ── 3. Enrichment Summary ───────────────────────────────────────────────
    if (action === 'enrichment_summary') {
      const batchId = typeof body.batch_id === 'string' && body.batch_id.trim()
        ? body.batch_id.replace(/^#/, '').trim()
        : null;

      let propQuery = adminClient
        .schema('pipeline')
        .from('pipeline_properties')
        .select('id, address, batch_id, enrichment_status, needs_review, review_reason, enriched_at')
        .neq('status', 'archived')
        .limit(500);
      if (batchId) propQuery = propQuery.eq('batch_id', batchId);

      const { data: rows, error: propErr } = await propQuery;
      if (propErr) return jsonResp({ ok: false, error: propErr.message }, 500, origin);

      let auditQuery = adminClient
        .from('description_enrichment_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (batchId) auditQuery = auditQuery.eq('batch_id', batchId);

      const { data: audits } = await auditQuery;

      const counts = { pending: 0, enriched: 0, needs_review: 0, failed: 0 };
      for (const r of rows || []) {
        const s = String(r.enrichment_status || 'pending');
        if (s === 'enriched') counts.enriched++;
        else if (s === 'needs_review') counts.needs_review++;
        else if (s === 'failed') counts.failed++;
        else counts.pending++;
      }

      return jsonResp({
        ok: true,
        batch_id: batchId,
        total: (rows || []).length,
        counts,
        recent_audits: audits || [],
      }, 200, origin);
    }

    return jsonResp({ ok: false, error: 'invalid_action' }, 400, origin);
  } catch (err) {
    return jsonResp({
      ok: false,
      error: err instanceof Error ? err.message : 'enrich_description_internal_error',
    }, 500, origin);
  }
});
