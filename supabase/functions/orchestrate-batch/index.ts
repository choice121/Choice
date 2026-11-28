// ============================================================
// Choice Properties — orchestrate-batch Edge Function
// Single-Call "One-Go" Multi-AI Pipeline Orchestrator
// ============================================================
// Lets multiple concurrent AIs each run a complete end-to-end
// Apify scrape -> validate -> enrich -> price -> publish ->
// verify -> cleanup flow in a single HTTP request with:
//   - Atomic 4-digit batch_id auto-allocation (or explicit batch_id)
//   - Exclusive worker_id + lease_token isolation & heartbeats
//   - Validated pre-flight pricing & task_config alias normalization
//   - Graceful HTTP 202 continuation handoff if Apify takes > 90s
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';
import { normalizeTaskConfigAliases, resolveExtractionDepth } from '../_shared/apify-normalizer.ts';
import { normalizeAndValidatePricingConfig } from '../_shared/pricing-engine.ts';

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
): Promise<{ ok: boolean; status: number; error?: string; actor: string; isHumanAdmin: boolean; authHeader: string }> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: 'admin_auth_required', actor: 'anonymous', isHumanAdmin: false, authHeader };

  const token = match[1].trim();
  if (!token) return { ok: false, status: 401, error: 'admin_auth_required', actor: 'anonymous', isHumanAdmin: false, authHeader };

  if (serviceKey && constantTimeEqual(token, serviceKey)) {
    return { ok: true, status: 200, actor: 'service_role', isHumanAdmin: false, authHeader };
  }

  const { data: userData, error: authErr } = await adminClient.auth.getUser(token);
  if (!authErr && userData?.user) {
    const { data: adminRow, error: roleErr } = await adminClient
      .from('admin_roles')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (roleErr) return { ok: false, status: 500, error: 'admin_check_failed', actor: userData.user.id, isHumanAdmin: false, authHeader };
    if (!adminRow) return { ok: false, status: 403, error: 'admin_required', actor: userData.user.id, isHumanAdmin: false, authHeader };
    return { ok: true, status: 200, actor: userData.user.email || userData.user.id, isHumanAdmin: true, authHeader };
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
      if (checkRes.ok) return { ok: true, status: 200, actor: 'service_role_jwt', isHumanAdmin: false, authHeader };
    } catch {
      // Fall through to 401
    }
  }

  return { ok: false, status: 401, error: 'invalid_session', actor: 'anonymous', isHumanAdmin: false, authHeader };
}

async function invokeEdgeFunction(params: {
  supabaseUrl: string;
  authHeader: string;
  apikey: string;
  fnName: string;
  body: Record<string, unknown>;
  workerId?: string | null;
  leaseToken?: string | null;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: params.authHeader,
    apikey: params.apikey,
  };
  if (params.workerId) headers['x-worker-id'] = params.workerId;
  if (params.leaseToken) headers['x-lease-token'] = params.leaseToken;

  const res = await fetch(`${params.supabaseUrl}/functions/v1/${params.fnName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params.body),
    signal: AbortSignal.timeout(params.timeoutMs ?? 45_000),
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { ok: false, error: text || `http_${res.status}` };
  }
  return { ok: res.ok && parsed.ok !== false, status: res.status, data: parsed };
}

function buildEffectiveTaskConfig(body: Record<string, unknown>): Record<string, unknown> {
  const nested =
    body.task_config && typeof body.task_config === 'object' && !Array.isArray(body.task_config)
      ? (body.task_config as Record<string, unknown>)
      : {};

  const topLevel: Record<string, unknown> = {};
  const passthroughKeys = [
    'locations',
    'location',
    'search_urls',
    'target_qty',
    'target_quantity',
    'target',
    'scrape_limit',
    'min_rent',
    'rent_min',
    'max_rent',
    'rent_max',
    'exact_beds',
    'bedrooms_exact',
    'min_beds',
    'bedrooms_min',
    'max_beds',
    'bedrooms_max',
    'exact_baths',
    'bathrooms_exact',
    'min_baths',
    'bathrooms_min',
    'max_baths',
    'bathrooms_max',
    'property_type',
    'property_types',
    'owner_only',
    'required_features',
    'preferred_features',
    'location_quotas',
    'pricing_config',
    'pricing',
    'actor_id',
    'extraction_depth',
    'include_property_insights',
    'include_insights',
    'two_stage_details',
    'allow_experimental_actor',
    'search_radius_miles',
  ];

  for (const key of passthroughKeys) {
    if (body[key] !== undefined) topLevel[key] = body[key];
  }

  return normalizeTaskConfigAliases({
    ...topLevel,
    ...nested,
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return corsResponse(origin);
  if (req.method !== 'POST') {
    return jsonResp({ ok: false, error: 'method_not_allowed' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey;
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
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonResp({ ok: false, error: 'json_object_required' }, 400, origin);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResp({ ok: false, error: 'invalid_json' }, 400, origin);
  }

  const action = safeStr(body.action) || 'run_one_go';
  if (action !== 'run_one_go' && action !== 'continue_one_go') {
    return jsonResp({ ok: false, error: 'invalid_action', action }, 400, origin);
  }

  const startMs = Date.now();
  const maxWaitSeconds = Math.min(Math.max(safeInt(body.max_wait_seconds) ?? 85, 10), 110);
  const deadlineMs = startMs + maxWaitSeconds * 1000;

  const taskConfig = buildEffectiveTaskConfig(body);
  const rawPricingCfg = (
    body.pricing_config ??
    body.pricing ??
    taskConfig.pricing_config ??
    taskConfig.pricing ??
    { method: 'none' }
  ) as Record<string, unknown>;

  const pricingValidation = normalizeAndValidatePricingConfig(rawPricingCfg);
  if (!pricingValidation.ok) {
    return jsonResp({
      ok: false,
      error: pricingValidation.error,
      message: pricingValidation.message,
      clarification_required: true,
    }, 400, origin);
  }
  taskConfig.pricing_config = pricingValidation.normalized;
  const extractionDepth = resolveExtractionDepth(taskConfig);
  taskConfig.extraction_depth = extractionDepth;

  const visibility = safeStr(body.visibility) === 'active' ? 'active' : 'private_placement';
  const explicitPublicOverride =
    body.explicit_public_override === true ||
    body.allow_public_override === true ||
    taskConfig.explicit_public_override === true;
  const publicOverrideReason = safeStr(body.public_override_reason) || safeStr(taskConfig.public_override_reason);

  if (visibility === 'active' && !explicitPublicOverride) {
    return jsonResp({
      ok: false,
      error: 'public_visibility_override_required',
      message: 'Strict rule: every job defaults to private_placement unless the operator explicitly authorizes public (active) publishing with explicit_public_override: true.',
    }, 403, origin);
  }
  if (visibility === 'active' && explicitPublicOverride) {
    taskConfig.explicit_public_override = true;
    if (publicOverrideReason) taskConfig.public_override_reason = publicOverrideReason;
  }

  const shouldVerify = body.verify !== false;
  const checkLivePages = body.check_live_pages !== false;
  const checkMediaHead = body.check_media_head !== false;
  const autoCleanup = body.auto_cleanup !== false;
  const checkPhotoReachability = body.check_photo_reachability !== false;
  const stageOnly = body.stage_only === true;

  let batchId = safeStr(body.batch_id)?.replace(/^#/, '') || '';
  let workerId = safeStr(body.worker_id) || `ai_orchestrator_${crypto.randomUUID().slice(0, 8)}`;
  let leaseToken = safeStr(body.lease_token) || '';
  let scrapeRunId = safeInt(body.scrape_run_id);

  const stages: Record<string, unknown> = {};

  const reportStage = async (
    stage: string,
    extra: { progress_json?: Record<string, unknown>; error_message?: string | null } = {},
  ) => {
    if (!batchId || !workerId || !leaseToken) return;
    await invokeEdgeFunction({
      supabaseUrl,
      authHeader: auth.authHeader,
      apikey: anonKey,
      fnName: 'job-manager',
      workerId,
      leaseToken,
      body: {
        action: 'report_stage',
        batch_id: batchId,
        worker_id: workerId,
        lease_token: leaseToken,
        stage,
        lease_seconds: 600,
        progress_json: extra.progress_json,
        error_message: extra.error_message,
      },
      timeoutMs: 12_000,
    }).catch(() => null);
  };

  try {
    // ── Phase A: Register / Claim Batch & Scrape Discovery ──────────────────
    if (action === 'run_one_go') {
      const targetMarket =
        safeStr(body.target_market) ||
        (Array.isArray(taskConfig.locations) && taskConfig.locations.length > 0
          ? taskConfig.locations.join(', ')
          : null) ||
        'Unspecified';

      const regRes = await invokeEdgeFunction({
        supabaseUrl,
        authHeader: auth.authHeader,
        apikey: anonKey,
        fnName: 'job-manager',
        body: {
          action: 'register_job',
          batch_id: batchId || 'auto',
          target_market: targetMarket,
          workflow_type: safeStr(body.workflow_type) || 'scrape_and_publish',
          visibility,
          explicit_public_override: visibility === 'active' ? explicitPublicOverride : undefined,
          public_override_reason: visibility === 'active' ? publicOverrideReason : undefined,
          task_config: taskConfig,
          description: safeStr(body.description) || `One-Go orchestrated batch (${targetMarket})`,
          idempotency_key: safeStr(body.idempotency_key),
          worker_id: workerId,
          worker_type: safeStr(body.worker_type) || 'ai_worker',
          claim_immediately: true,
          lease_seconds: 600,
        },
        timeoutMs: 15_000,
      });

      if (!regRes.ok || !regRes.data.batch_id || !regRes.data.lease_token) {
        return jsonResp({
          ok: false,
          failed_stage: 'register_job',
          error: regRes.data.error || 'job_register_failed',
          details: regRes.data,
        }, regRes.status >= 400 ? regRes.status : 400, origin);
      }

      batchId = String(regRes.data.batch_id);
      workerId = String(regRes.data.worker_id || workerId);
      leaseToken = String(regRes.data.lease_token);
      stages.register_job = {
        batch_id: batchId,
        worker_id: workerId,
        claimed: true,
        extraction_depth: extractionDepth,
        idempotent_replay: Boolean(regRes.data.idempotent_replay),
      };

      await reportStage('scraping', { progress_json: { orchestrator: 'starting_apify' } });

      const startScrape = await invokeEdgeFunction({
        supabaseUrl,
        authHeader: auth.authHeader,
        apikey: anonKey,
        fnName: 'apify-scrape-worker',
        workerId,
        leaseToken,
        body: {
          action: 'start_run',
          batch_id: batchId,
          worker_id: workerId,
          lease_token: leaseToken,
          task_config: taskConfig,
          wait_for_finish: 20,
          chunk_limit: 500,
          idempotency_key: safeStr(body.scrape_idempotency_key) || (body.idempotency_key ? `scrape:${String(body.idempotency_key)}` : undefined),
        },
        timeoutMs: 35_000,
      });

      if (!startScrape.ok) {
        await reportStage('failed', { error_message: String(startScrape.data.error || 'apify_start_failed') });
        return jsonResp({
          ok: false,
          batch_id: batchId,
          worker_id: workerId,
          lease_token: leaseToken,
          failed_stage: 'scraping',
          error: startScrape.data.error || 'apify_start_failed',
          details: startScrape.data,
          stages,
        }, startScrape.status >= 400 ? startScrape.status : 502, origin);
      }

      scrapeRunId = safeInt(startScrape.data.scrape_run_id);
      let hasMore = startScrape.data.has_more === true;
      let latestScrapeData: Record<string, unknown> = startScrape.data;

      while (hasMore && scrapeRunId && Date.now() + 5000 < deadlineMs) {
        await new Promise((r) => setTimeout(r, 4500));
        await invokeEdgeFunction({
          supabaseUrl,
          authHeader: auth.authHeader,
          apikey: anonKey,
          fnName: 'job-manager',
          workerId,
          leaseToken,
          body: {
            action: 'heartbeat',
            batch_id: batchId,
            worker_id: workerId,
            lease_token: leaseToken,
            lease_seconds: 600,
            progress_json: { polling_scrape_run_id: scrapeRunId },
          },
          timeoutMs: 10_000,
        }).catch(() => null);

        const pollRes = await invokeEdgeFunction({
          supabaseUrl,
          authHeader: auth.authHeader,
          apikey: anonKey,
          fnName: 'apify-scrape-worker',
          workerId,
          leaseToken,
          body: {
            action: 'poll_and_ingest',
            batch_id: batchId,
            scrape_run_id: scrapeRunId,
            worker_id: workerId,
            lease_token: leaseToken,
            chunk_limit: 500,
          },
          timeoutMs: 35_000,
        });

        latestScrapeData = pollRes.data;
        if (!pollRes.ok) {
          await reportStage('failed', { error_message: String(pollRes.data.error || 'apify_poll_failed') });
          return jsonResp({
            ok: false,
            batch_id: batchId,
            worker_id: workerId,
            lease_token: leaseToken,
            scrape_run_id: scrapeRunId,
            failed_stage: 'scraping',
            error: pollRes.data.error || 'apify_poll_failed',
            details: pollRes.data,
            stages,
          }, pollRes.status >= 400 ? pollRes.status : 502, origin);
        }

        if (
          (pollRes.data.auto_handed_off === true || pollRes.data.two_stage_transition === true) &&
          (pollRes.data.continuation_run as Record<string, unknown> | undefined)?.id
        ) {
          scrapeRunId = Number((pollRes.data.continuation_run as Record<string, unknown>).id);
          hasMore = pollRes.data.auto_handed_off === true ? true : pollRes.data.has_more === true;
          if (hasMore) continue;
        } else {
          hasMore = pollRes.data.has_more === true;
        }
      }

      stages.scraping = latestScrapeData;

      if (hasMore) {
        return jsonResp({
          ok: true,
          status: 'in_progress',
          partial: true,
          batch_id: batchId,
          worker_id: workerId,
          lease_token: leaseToken,
          scrape_run_id: scrapeRunId,
          message: `Apify actor run still executing after ${maxWaitSeconds}s. Call orchestrate-batch again with continue_payload to finish.`,
          continue_payload: {
            action: 'continue_one_go',
            batch_id: batchId,
            worker_id: workerId,
            lease_token: leaseToken,
            scrape_run_id: scrapeRunId,
            visibility,
            explicit_public_override: visibility === 'active' ? explicitPublicOverride : undefined,
            public_override_reason: visibility === 'active' ? publicOverrideReason : undefined,
            pricing_config: pricingValidation.normalized,
            verify: shouldVerify,
            check_live_pages: checkLivePages,
            check_media_head: checkMediaHead,
            auto_cleanup: autoCleanup,
            check_photo_reachability: checkPhotoReachability,
            stage_only: stageOnly,
          },
          stages,
        }, 202, origin);
      }
    } else {
      // continue_one_go
      if (!batchId || !workerId || !leaseToken || !scrapeRunId) {
        return jsonResp({
          ok: false,
          error: 'continue_requires_batch_worker_lease_and_scrape_run_id',
        }, 400, origin);
      }

      let hasMore = true;
      let latestScrapeData: Record<string, unknown> = {};
      while (hasMore && Date.now() + 2000 < deadlineMs) {
        await invokeEdgeFunction({
          supabaseUrl,
          authHeader: auth.authHeader,
          apikey: anonKey,
          fnName: 'job-manager',
          workerId,
          leaseToken,
          body: {
            action: 'heartbeat',
            batch_id: batchId,
            worker_id: workerId,
            lease_token: leaseToken,
            lease_seconds: 600,
          },
          timeoutMs: 10_000,
        }).catch(() => null);

        const pollRes = await invokeEdgeFunction({
          supabaseUrl,
          authHeader: auth.authHeader,
          apikey: anonKey,
          fnName: 'apify-scrape-worker',
          workerId,
          leaseToken,
          body: {
            action: 'poll_and_ingest',
            batch_id: batchId,
            scrape_run_id: scrapeRunId,
            worker_id: workerId,
            lease_token: leaseToken,
            chunk_limit: 500,
          },
          timeoutMs: 35_000,
        });

        latestScrapeData = pollRes.data;
        if (!pollRes.ok) {
          await reportStage('failed', { error_message: String(pollRes.data.error || 'apify_poll_failed') });
          return jsonResp({
            ok: false,
            batch_id: batchId,
            worker_id: workerId,
            lease_token: leaseToken,
            scrape_run_id: scrapeRunId,
            failed_stage: 'scraping',
            error: pollRes.data.error || 'apify_poll_failed',
            details: pollRes.data,
          }, pollRes.status >= 400 ? pollRes.status : 502, origin);
        }

        if (
          (pollRes.data.auto_handed_off === true || pollRes.data.two_stage_transition === true) &&
          (pollRes.data.continuation_run as Record<string, unknown> | undefined)?.id
        ) {
          scrapeRunId = Number((pollRes.data.continuation_run as Record<string, unknown>).id);
          hasMore = pollRes.data.auto_handed_off === true ? true : pollRes.data.has_more === true;
        } else {
          hasMore = pollRes.data.has_more === true;
        }

        if (hasMore && Date.now() + 5000 < deadlineMs) {
          await new Promise((r) => setTimeout(r, 4500));
        } else if (hasMore) {
          break;
        }
      }

      stages.scraping = latestScrapeData;

      if (hasMore) {
        return jsonResp({
          ok: true,
          status: 'in_progress',
          partial: true,
          batch_id: batchId,
          worker_id: workerId,
          lease_token: leaseToken,
          scrape_run_id: scrapeRunId,
          continue_payload: {
            action: 'continue_one_go',
            batch_id: batchId,
            worker_id: workerId,
            lease_token: leaseToken,
            scrape_run_id: scrapeRunId,
            visibility,
            explicit_public_override: visibility === 'active' ? explicitPublicOverride : undefined,
            public_override_reason: visibility === 'active' ? publicOverrideReason : undefined,
            pricing_config: pricingValidation.normalized,
            verify: shouldVerify,
            check_live_pages: checkLivePages,
            check_media_head: checkMediaHead,
            auto_cleanup: autoCleanup,
            check_photo_reachability: checkPhotoReachability,
            stage_only: stageOnly,
          },
          stages,
        }, 202, origin);
      }
    }

    // ── Phase B: Validate ───────────────────────────────────────────────────
    await reportStage('validating');
    const valRes = await invokeEdgeFunction({
      supabaseUrl,
      authHeader: auth.authHeader,
      apikey: anonKey,
      fnName: 'property-validator',
      workerId,
      leaseToken,
      body: {
        action: 'validate_batch',
        batch_id: batchId,
        worker_id: workerId,
        lease_token: leaseToken,
        check_photo_reachability: checkPhotoReachability,
        allow_non_owner_listing: taskConfig.owner_only !== true,
      },
      timeoutMs: 45_000,
    });
    stages.validating = valRes.data;
    if (!valRes.ok) {
      await reportStage('failed', { error_message: String(valRes.data.error || 'validation_failed') });
      return jsonResp({
        ok: false,
        batch_id: batchId,
        worker_id: workerId,
        lease_token: leaseToken,
        failed_stage: 'validating',
        error: valRes.data.error || 'validation_failed',
        stages,
      }, valRes.status >= 400 ? valRes.status : 422, origin);
    }

    if (Number(valRes.data.passed_count || 0) === 0) {
      await reportStage('failed', {
        error_message: 'no_properties_passed_validation',
        progress_json: {
          passed_count: 0,
          needs_review_count: valRes.data.needs_review_count ?? 0,
          rejected_count: valRes.data.rejected_count ?? 0,
        },
      });
      return jsonResp({
        ok: false,
        batch_id: batchId,
        worker_id: workerId,
        lease_token: leaseToken,
        failed_stage: 'validating',
        error: 'no_properties_passed_validation',
        message: 'No scraped listings passed pre-publish validation.',
        stages,
      }, 422, origin);
    }

    // ── Phase C: Enrich Descriptions ────────────────────────────────────────
    await reportStage('enriching');
    const enrichRes = await invokeEdgeFunction({
      supabaseUrl,
      authHeader: auth.authHeader,
      apikey: anonKey,
      fnName: 'enrich-description',
      workerId,
      leaseToken,
      body: {
        action: 'enrich_batch',
        batch_id: batchId,
        worker_id: workerId,
        lease_token: leaseToken,
        only_validated: true,
        use_ai: false,
      },
      timeoutMs: 45_000,
    });
    stages.enriching = enrichRes.data;
    if (!enrichRes.ok) {
      await reportStage('failed', { error_message: String(enrichRes.data.error || 'enrichment_failed') });
      return jsonResp({
        ok: false,
        batch_id: batchId,
        worker_id: workerId,
        lease_token: leaseToken,
        failed_stage: 'enriching',
        error: enrichRes.data.error || 'enrichment_failed',
        stages,
      }, enrichRes.status >= 400 ? enrichRes.status : 422, origin);
    }

    if (stageOnly) {
      await reportStage('completed', {
        progress_json: {
          staged_only: true,
          validated_passed: valRes.data.passed_count ?? 0,
          enriched_count: enrichRes.data.enriched_count ?? 0,
        },
      });
      return jsonResp({
        ok: true,
        status: 'staged',
        batch_id: batchId,
        worker_id: workerId,
        lease_token: leaseToken,
        visibility,
        manual_verification_required: false,
        elapsed_ms: Date.now() - startMs,
        stages,
      }, 200, origin);
    }

    // ── Phase D: Calculate Task-Specific Pricing ────────────────────────────
    await reportStage('pricing');
    const priceRes = await invokeEdgeFunction({
      supabaseUrl,
      authHeader: auth.authHeader,
      apikey: anonKey,
      fnName: 'calculate-pricing',
      workerId,
      leaseToken,
      body: {
        action: 'calculate_batch',
        batch_id: batchId,
        worker_id: workerId,
        lease_token: leaseToken,
        pricing_config: pricingValidation.normalized,
        only_validated: true,
      },
      timeoutMs: 30_000,
    });
    stages.pricing = priceRes.data;
    if (!priceRes.ok) {
      await reportStage('failed', { error_message: String(priceRes.data.error || 'pricing_failed') });
      return jsonResp({
        ok: false,
        batch_id: batchId,
        worker_id: workerId,
        lease_token: leaseToken,
        failed_stage: 'pricing',
        error: priceRes.data.error || 'pricing_failed',
        stages,
      }, priceRes.status >= 400 ? priceRes.status : 422, origin);
    }

    // ── Phase E: Publish Batch + Verify Live Share Link ─────────────────────
    await reportStage('publishing');
    const pubRes = await invokeEdgeFunction({
      supabaseUrl,
      authHeader: auth.authHeader,
      apikey: anonKey,
      fnName: 'publish-batch',
      workerId,
      leaseToken,
      body: {
        batch_id: batchId,
        worker_id: workerId,
        lease_token: leaseToken,
        visibility,
        explicit_public_override: visibility === 'active' ? explicitPublicOverride : undefined,
        public_override_reason: visibility === 'active' ? publicOverrideReason : undefined,
        landlord_id: safeStr(body.landlord_id),
        verify: shouldVerify,
        check_live_pages: checkLivePages,
        check_media_head: checkMediaHead,
      },
      timeoutMs: 45_000,
    });
    stages.publishing = pubRes.data;
    if (!pubRes.ok || Number(pubRes.data.published_count || 0) === 0) {
      await reportStage('failed', { error_message: String(pubRes.data.error || 'publish_failed') });
      return jsonResp({
        ok: false,
        batch_id: batchId,
        worker_id: workerId,
        lease_token: leaseToken,
        failed_stage: 'publishing',
        error: pubRes.data.error || 'publish_failed',
        stages,
      }, pubRes.status >= 400 ? pubRes.status : 422, origin);
    }

    // ── Phase F: Safe Disposable Folder Cleanup & 24h Recovery Archive ──────
    const verification = pubRes.data.verification as Record<string, unknown> | null;
    const isVerified = !shouldVerify || Boolean(verification?.verified === true);
    let cleanupData: Record<string, unknown> | null = null;

    if (autoCleanup && isVerified) {
      await reportStage('cleaning');
      const cleanRes = await invokeEdgeFunction({
        supabaseUrl,
        authHeader: auth.authHeader,
        apikey: anonKey,
        fnName: 'job-manager',
        workerId,
        leaseToken,
        body: {
          action: 'cleanup_disposable_folder',
          batch_id: batchId,
          worker_id: workerId,
          lease_token: leaseToken,
        },
        timeoutMs: 25_000,
      });
      cleanupData = cleanRes.data;
      stages.cleaning = cleanRes.data;
    } else if (isVerified) {
      await reportStage('completed', {
        progress_json: {
          magic_link_url: pubRes.data.magic_link_url || null,
          published_count: pubRes.data.published_count ?? 0,
        },
      });
    }

    return jsonResp({
      ok: true,
      status: isVerified ? 'completed' : 'partial',
      batch_id: batchId,
      worker_id: workerId,
      lease_token: leaseToken,
      visibility,
      extraction_depth: extractionDepth,
      manual_verification_required: false,
      magic_link_url: pubRes.data.magic_link_url || null,
      share_id: pubRes.data.share_id || null,
      expires_at: pubRes.data.expires_at || null,
      published_count: pubRes.data.published_count ?? 0,
      failed_count: pubRes.data.failed_count ?? 0,
      property_ids: pubRes.data.property_ids || [],
      results: pubRes.data.results || [],
      verification,
      cleanup: cleanupData,
      elapsed_ms: Date.now() - startMs,
      stages,
    }, 200, origin);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'orchestrate_batch_internal_error';
    await reportStage('failed', { error_message: errMsg });
    return jsonResp({
      ok: false,
      batch_id: batchId || null,
      worker_id: workerId,
      lease_token: leaseToken || null,
      error: errMsg,
      stages,
    }, 500, origin);
  }
});
