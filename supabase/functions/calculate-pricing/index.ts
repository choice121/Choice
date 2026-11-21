// ============================================================
// Choice Properties — calculate-pricing Edge Function
// Phase 7: Task-Specific Pricing Engine
// ============================================================
// Actions:
//   - calculate_property : Computes rent for a single staged pipeline_id or dry_run listing
//   - calculate_batch    : Computes rent across a 4-digit batch (none | fixed | individual_map | proportional_range)
//   - pricing_summary    : Counts & pricing_calculations audit summary for a batch
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';
import {
  calculatePropertyRent,
  normalizeAndValidatePricingConfig,
  type PricingComputationResult,
} from '../_shared/pricing-engine.ts';

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
): Promise<{ ok: boolean; status: number; error?: string; actor: string }> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: 'admin_auth_required', actor: 'anonymous' };

  const token = match[1].trim();
  if (!token) return { ok: false, status: 401, error: 'admin_auth_required', actor: 'anonymous' };

  if (serviceKey && constantTimeEqual(token, serviceKey)) {
    return { ok: true, status: 200, actor: 'service_role' };
  }

  const { data: userData, error: authErr } = await adminClient.auth.getUser(token);
  if (!authErr && userData?.user) {
    const { data: adminRow, error: roleErr } = await adminClient
      .from('admin_roles')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (roleErr) return { ok: false, status: 500, error: 'admin_check_failed', actor: userData.user.id };
    if (!adminRow) return { ok: false, status: 403, error: 'admin_required', actor: userData.user.id };
    return { ok: true, status: 200, actor: userData.user.email || userData.user.id };
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
      if (checkRes.ok) return { ok: true, status: 200, actor: 'service_role_jwt' };
    } catch {
      // Fall through to 401
    }
  }

  return { ok: false, status: 401, error: 'invalid_session', actor: 'anonymous' };
}

async function loadEffectivePolicyVersion(
  adminClient: ReturnType<typeof createClient>,
  batchId: string | null,
): Promise<string | null> {
  const { data, error } = await adminClient.rpc('rules_get_effective_policy', {
    p_batch_id: batchId,
  });
  if (error) return null;
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  return parsed?.policy_set?.version_label || null;
}

async function resolveBatchPricingConfig(
  adminClient: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  batchId: string | null,
): Promise<Record<string, unknown>> {
  if (body.pricing_config && typeof body.pricing_config === 'object' && !Array.isArray(body.pricing_config)) {
    return body.pricing_config as Record<string, unknown>;
  }
  if (
    body.method ||
    body.pricing_method ||
    body.source_min !== undefined ||
    body.fixed_rent !== undefined ||
    body.individual_map !== undefined
  ) {
    return body;
  }
  if (batchId) {
    const { data: batchRow } = await adminClient
      .from('publishing_batches')
      .select('task_config')
      .eq('id', batchId)
      .maybeSingle();
    const tc = batchRow?.task_config as Record<string, unknown> | null;
    if (tc?.pricing_config && typeof tc.pricing_config === 'object') {
      return tc.pricing_config as Record<string, unknown>;
    }
  }
  return { method: 'none' };
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
      action: url.searchParams.get('action') || 'pricing_summary',
      batch_id: url.searchParams.get('batch_id') || '',
    };
  }

  const action = String(body.action || 'calculate_batch').trim();
  const force = body.force === true;

  try {
    // ── 1. Calculate Single Property (or dry_run listing) ───────────────────
    if (action === 'calculate_property') {
      const batchId = typeof body.batch_id === 'string' && body.batch_id.trim()
        ? body.batch_id.replace(/^#/, '').trim()
        : null;
      const rawCfg = await resolveBatchPricingConfig(adminClient, body, batchId);
      const validation = normalizeAndValidatePricingConfig(rawCfg);
      if (!validation.ok) {
        return jsonResp({ ok: false, error: validation.error, message: validation.message }, 400, origin);
      }

      if (body.dry_run === true && body.listing && typeof body.listing === 'object') {
        const result = await calculatePropertyRent(
          body.listing as Record<string, unknown>,
          validation.normalized,
          { force },
        );
        return jsonResp({ ok: true, dry_run: true, config: validation.normalized, result }, 200, origin);
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
      const policyVersion = await loadEffectivePolicyVersion(adminClient, effectiveBatchId);
      const result = await calculatePropertyRent(row as Record<string, unknown>, validation.normalized, { force });

      if (body.dry_run !== true) {
        const { data: recRes, error: recErr } = await adminClient.rpc('pipeline_record_pricing_result', {
          p_id: propertyId,
          p_method: result.method,
          p_pricing_status: result.pricing_status,
          p_original_rent: result.original_rent,
          p_calculated_rent: result.calculated_rent,
          p_source_min: validation.normalized.source_min ?? null,
          p_source_max: validation.normalized.source_max ?? null,
          p_target_min: validation.normalized.target_min ?? null,
          p_target_max: validation.normalized.target_max ?? null,
          p_was_clamped: result.was_clamped,
          p_reason: result.reason,
          p_policy_version: policyVersion,
          p_task_config_snapshot: validation.normalized,
          p_last_priced_hash: result.config_hash,
          p_pricing_meta: {
            actor: auth.actor,
            idempotent_skip: result.idempotent_skip,
            was_clamped: result.was_clamped,
            config: validation.normalized,
          },
          p_audit_status: result.audit_status,
        });
        if (recErr) return jsonResp({ ok: false, error: recErr.message }, 500, origin);
        const parsedRec = typeof recRes === 'string' ? JSON.parse(recRes) : recRes;
        if (!parsedRec?.ok) return jsonResp(parsedRec, 400, origin);
      }

      return jsonResp({
        ok: true,
        dry_run: body.dry_run === true,
        property_id: propertyId,
        batch_id: effectiveBatchId,
        config: validation.normalized,
        result,
      }, 200, origin);
    }

    // ── 2. Calculate Batch Pricing ──────────────────────────────────────────
    if (action === 'calculate_batch') {
      const batchId = typeof body.batch_id === 'string' && body.batch_id.trim()
        ? body.batch_id.replace(/^#/, '').trim()
        : null;
      const statusFilter = typeof body.status_filter === 'string' && body.status_filter.trim()
        ? body.status_filter.trim()
        : null;
      const limit = Math.min(Math.max(Number(body.limit ?? 200) || 200, 1), 500);
      const dryRun = body.dry_run === true;
      const onlyValidated = body.only_validated === true;

      const rawCfg = await resolveBatchPricingConfig(adminClient, body, batchId);
      const validation = normalizeAndValidatePricingConfig(rawCfg);
      if (!validation.ok) {
        return jsonResp({
          ok: false,
          clarification_required: true,
          error: validation.error,
          message: validation.message,
        }, 400, origin);
      }

      const policyVersion = await loadEffectivePolicyVersion(adminClient, batchId);

      const { data: candData, error: candErr } = await adminClient.rpc('pipeline_price_batch', {
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

      const results: Array<PricingComputationResult & { address: string | null }> = [];
      let calculatedCount = 0;
      let heldOutOfRangeCount = 0;
      let skippedIdempotentCount = 0;
      let errorCount = 0;

      for (const item of rows) {
        const res = await calculatePropertyRent(item as Record<string, unknown>, validation.normalized, { force });

        if (!dryRun && typeof item.id === 'string') {
          if (!res.idempotent_skip) {
            const { error: recErr } = await adminClient.rpc('pipeline_record_pricing_result', {
              p_id: item.id,
              p_method: res.method,
              p_pricing_status: res.pricing_status,
              p_original_rent: res.original_rent,
              p_calculated_rent: res.calculated_rent,
              p_source_min: validation.normalized.source_min ?? null,
              p_source_max: validation.normalized.source_max ?? null,
              p_target_min: validation.normalized.target_min ?? null,
              p_target_max: validation.normalized.target_max ?? null,
              p_was_clamped: res.was_clamped,
              p_reason: res.reason,
              p_policy_version: policyVersion,
              p_task_config_snapshot: validation.normalized,
              p_last_priced_hash: res.config_hash,
              p_pricing_meta: {
                actor: auth.actor,
                idempotent_skip: res.idempotent_skip,
                was_clamped: res.was_clamped,
                config: validation.normalized,
              },
              p_audit_status: res.audit_status,
            });
            if (recErr) {
              errorCount++;
              results.push({
                ...res,
                pricing_status: 'error',
                audit_status: 'error',
                reason: recErr.message,
                address: typeof item.address === 'string' ? item.address : null,
              });
              continue;
            }
          }
        }

        if (res.idempotent_skip) skippedIdempotentCount++;
        else if (res.pricing_status === 'calculated') calculatedCount++;
        else if (res.pricing_status === 'held_out_of_range') heldOutOfRangeCount++;
        else errorCount++;

        results.push({
          ...res,
          address: typeof item.address === 'string' ? item.address : null,
        });
      }

      return jsonResp({
        ok: true,
        dry_run: dryRun,
        batch_id: batchId,
        policy_version: policyVersion,
        config: validation.normalized,
        total: rows.length,
        calculated_count: calculatedCount,
        skipped_idempotent_count: skippedIdempotentCount,
        held_out_of_range_count: heldOutOfRangeCount,
        error_count: errorCount,
        results,
      }, 200, origin);
    }

    // ── 3. Pricing Summary & Audit ──────────────────────────────────────────
    if (action === 'pricing_summary') {
      const batchId = typeof body.batch_id === 'string' && body.batch_id.trim()
        ? body.batch_id.replace(/^#/, '').trim()
        : null;

      let propQuery = adminClient
        .schema('pipeline')
        .from('pipeline_properties')
        .select('id, address, batch_id, original_monthly_rent, monthly_rent, pricing_status, pricing_method, priced_at')
        .neq('status', 'archived')
        .limit(500);
      if (batchId) propQuery = propQuery.eq('batch_id', batchId);

      const { data: rows, error: propErr } = await propQuery;
      if (propErr) return jsonResp({ ok: false, error: propErr.message }, 500, origin);

      let auditQuery = adminClient
        .from('pricing_calculations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (batchId) auditQuery = auditQuery.eq('batch_id', batchId);

      const { data: calculations } = await auditQuery;

      const counts = { pending: 0, calculated: 0, held_out_of_range: 0, error: 0 };
      for (const r of rows || []) {
        const s = String(r.pricing_status || 'pending');
        if (s === 'calculated') counts.calculated++;
        else if (s === 'held_out_of_range') counts.held_out_of_range++;
        else if (s === 'error') counts.error++;
        else counts.pending++;
      }

      return jsonResp({
        ok: true,
        batch_id: batchId,
        total: (rows || []).length,
        counts,
        calculations: calculations || [],
      }, 200, origin);
    }

    return jsonResp({ ok: false, error: 'invalid_action' }, 400, origin);
  } catch (err) {
    return jsonResp({
      ok: false,
      error: err instanceof Error ? err.message : 'calculate_pricing_internal_error',
    }, 500, origin);
  }
});
