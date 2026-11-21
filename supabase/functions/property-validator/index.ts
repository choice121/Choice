// ============================================================
// Choice Properties — property-validator Edge Function
// Phase 6: Automated Property Eligibility, Source Profile & Image Validation Engine
// ============================================================
// Actions:
//   - validate_property   : Validates a single staged pipeline_id or dry_run listing
//   - validate_batch      : Validates a 4-digit batch (or pending queue) via policy_set
//   - resolve_review      : Explicit admin approval / rejection of needs_review rows
//   - validation_summary  : Counts & details of pending / passed / needs_review / rejected
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';
import {
  type ProhibitedProfileRule,
  validatePipelineProperty,
  type ValidationReport,
} from '../_shared/property-validation.ts';

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
    prohibitedProfiles: (parsed.prohibited_source_profiles || []) as ProhibitedProfileRule[],
  };
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
      action: url.searchParams.get('action') || 'validation_summary',
      batch_id: url.searchParams.get('batch_id') || '',
    };
  }

  const action = String(body.action || 'validate_batch').trim();
  const checkPhotoReachability = body.check_photo_reachability !== false;
  const useVisionScan = body.use_vision_scan === true;
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim() || null;

  try {
    // ── 1. Validate Single Property (or dry_run listing) ────────────────────
    if (action === 'validate_property') {
      const batchId = typeof body.batch_id === 'string' && body.batch_id.trim()
        ? body.batch_id.replace(/^#/, '').trim()
        : null;

      if (body.dry_run === true && body.listing && typeof body.listing === 'object') {
        const policy = await loadEffectivePolicy(adminClient, batchId);
        const report = await validatePipelineProperty(body.listing as Record<string, unknown>, {
          prohibitedProfiles: policy.prohibitedProfiles,
          rulesMap: policy.rulesMap,
          policySet: policy.policySet,
          checkPhotoReachability: body.check_photo_reachability === true,
          useVisionScan,
          geminiApiKey,
        });
        return jsonResp({ ok: true, dry_run: true, report }, 200, origin);
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
      const policy = await loadEffectivePolicy(adminClient, effectiveBatchId);
      const report = await validatePipelineProperty(row as Record<string, unknown>, {
        prohibitedProfiles: policy.prohibitedProfiles,
        rulesMap: policy.rulesMap,
        policySet: policy.policySet,
        checkPhotoReachability,
        useVisionScan,
        geminiApiKey,
      });

      if (body.dry_run !== true) {
        const { data: recRes, error: recErr } = await adminClient.rpc('pipeline_record_validation_result', {
          p_id: propertyId,
          p_validation_status: report.status,
          p_needs_review: report.needs_review,
          p_review_reason: report.primary_reason,
          p_validation_report: report,
          p_validated_at: report.validated_at,
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
        report,
      }, 200, origin);
    }

    // ── 2. Validate Batch / Queue ───────────────────────────────────────────
    if (action === 'validate_batch') {
      const batchId = typeof body.batch_id === 'string' && body.batch_id.trim()
        ? body.batch_id.replace(/^#/, '').trim()
        : null;
      const statusFilter = typeof body.status_filter === 'string' && body.status_filter.trim()
        ? body.status_filter.trim()
        : null;
      const limit = Math.min(Math.max(Number(body.limit ?? 100) || 100, 1), 300);
      const dryRun = body.dry_run === true;

      const policy = await loadEffectivePolicy(adminClient, batchId);

      const { data: candData, error: candErr } = await adminClient.rpc('pipeline_validate_batch', {
        p_batch_id: batchId,
        p_status_filter: statusFilter,
        p_limit: limit,
      });
      if (candErr) return jsonResp({ ok: false, error: candErr.message }, 500, origin);
      const candParsed = typeof candData === 'string' ? JSON.parse(candData) : candData;
      if (!candParsed?.ok) return jsonResp(candParsed, 400, origin);

      const rows = Array.isArray(candParsed.properties) ? candParsed.properties : [];
      const results: Array<{
        id: string;
        address: string | null;
        validation_status: string;
        primary_reason: string | null;
        reasons: string[];
        report: ValidationReport;
      }> = [];

      let passedCount = 0;
      let needsReviewCount = 0;
      let rejectedCount = 0;

      // Process in small sequential batches of 4 to avoid burst overload
      for (let i = 0; i < rows.length; i += 4) {
        const chunk = rows.slice(i, i + 4);
        const chunkReports = await Promise.all(
          chunk.map(async (item: Record<string, unknown>) => {
            const report = await validatePipelineProperty(item, {
              prohibitedProfiles: policy.prohibitedProfiles,
              rulesMap: policy.rulesMap,
              policySet: policy.policySet,
              checkPhotoReachability,
              useVisionScan,
              geminiApiKey,
            });

            if (!dryRun && typeof item.id === 'string') {
              await adminClient.rpc('pipeline_record_validation_result', {
                p_id: item.id,
                p_validation_status: report.status,
                p_needs_review: report.needs_review,
                p_review_reason: report.primary_reason,
                p_validation_report: report,
                p_validated_at: report.validated_at,
              });
            }

            return { item, report };
          }),
        );

        for (const { item, report } of chunkReports) {
          if (report.status === 'passed') passedCount++;
          else if (report.status === 'needs_review') needsReviewCount++;
          else rejectedCount++;

          results.push({
            id: String(item.id || ''),
            address: typeof item.address === 'string' ? item.address : null,
            validation_status: report.status,
            primary_reason: report.primary_reason,
            reasons: report.reasons,
            report,
          });
        }
      }

      return jsonResp({
        ok: true,
        dry_run: dryRun,
        batch_id: batchId,
        policy_version: policy.policySet?.version_label || null,
        total: rows.length,
        passed_count: passedCount,
        needs_review_count: needsReviewCount,
        rejected_count: rejectedCount,
        results,
      }, 200, origin);
    }

    // ── 3. Admin Review Resolution ──────────────────────────────────────────
    if (action === 'resolve_review') {
      if (req.method !== 'POST') return jsonResp({ ok: false, error: 'post_required' }, 405, origin);
      const propertyId = typeof (body.property_id ?? body.pipeline_id ?? body.id) === 'string'
        ? String(body.property_id ?? body.pipeline_id ?? body.id).trim()
        : '';
      const decision = typeof body.decision === 'string' ? body.decision.trim() : '';
      const note = typeof body.note === 'string' ? body.note.trim() : null;

      const { data, error } = await adminClient.rpc('pipeline_resolve_validation_review', {
        p_id: propertyId,
        p_decision: decision,
        p_note: note,
        p_actor: auth.actor,
      });
      if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return jsonResp(parsed, parsed?.ok ? 200 : 400, origin);
    }

    // ── 4. Validation Summary ───────────────────────────────────────────────
    if (action === 'validation_summary') {
      const batchId = typeof body.batch_id === 'string' && body.batch_id.trim()
        ? body.batch_id.replace(/^#/, '').trim()
        : null;

      let query = adminClient
        .schema('pipeline')
        .from('pipeline_properties')
        .select('id, address, city, state, batch_id, validation_status, needs_review, review_reason, validated_at, agent_name, broker_name')
        .neq('status', 'archived')
        .limit(500);

      if (batchId) query = query.eq('batch_id', batchId);

      const { data: rows, error } = await query;
      if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);

      const counts = { pending: 0, passed: 0, needs_review: 0, rejected: 0 };
      const flagged: Array<Record<string, unknown>> = [];
      for (const r of rows || []) {
        const s = String(r.validation_status || 'pending');
        if (s === 'passed') counts.passed++;
        else if (s === 'needs_review') counts.needs_review++;
        else if (s === 'rejected') counts.rejected++;
        else counts.pending++;

        if (s === 'needs_review' || s === 'rejected') {
          flagged.push(r);
        }
      }

      return jsonResp({
        ok: true,
        batch_id: batchId,
        total: (rows || []).length,
        counts,
        flagged: flagged.slice(0, 100),
      }, 200, origin);
    }

    return jsonResp({ ok: false, error: 'invalid_action' }, 400, origin);
  } catch (err) {
    return jsonResp({
      ok: false,
      error: err instanceof Error ? err.message : 'validator_internal_error',
    }, 500, origin);
  }
});
