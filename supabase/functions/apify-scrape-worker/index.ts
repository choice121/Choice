// ============================================================
// Choice Properties — apify-scrape-worker Edge Function
// Phase 5: Apify Default Scraping Engine & Dual-Channel Worker Integration
// ============================================================
// Centralized Apify Zillow automated scraper integrated with:
//   - public.scraping_providers ('apify' automated default)
//   - public.rules_get_effective_policy(batch_id)
//   - pipeline-raw-payloads Storage archive
//   - _shared/apify-normalizer.ts + _shared/pipeline-record.ts
//   - pipeline.pipeline_properties (batch-scoped disposable folder + intra-batch dedup)
//   - pipeline.pipeline_scrape_runs (full run & chunk telemetry)
//
// Actions:
//   - get_provider_status : Provider registry, token presence & dual-channel status
//   - list_runs           : Inspect pipeline_scrape_runs (optional batch_id filter)
//   - start_run           : Launches Apify Zillow actor run for a registered batch
//   - poll_and_ingest     : Polls run status + ingests next dataset chunk
//   - webhook_callback    : Timing-safe Apify webhook receiver -> chunked ingest
//   - ingest_items        : Ingests Apify Zillow items directly into batch staging
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';
import {
  buildPipelineRecord,
  safeStr,
  safeInt,
  safeFloat,
} from '../_shared/pipeline-record.ts';
import {
  buildApifyActorInput,
  normalizeApifyZillowItem,
} from '../_shared/apify-normalizer.ts';

const APIFY_BASE = 'https://api.apify.com/v2';
const ACTOR_ID_RE = /^[a-zA-Z0-9._~-]{1,80}(?:\/[a-zA-Z0-9._~-]{1,80})?$/;
const SAFE_APIFY_ID_RE = /^[a-zA-Z0-9_-]{4,80}$/;

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

function getApifyTokens(): string[] {
  const single = Deno.env.get('APIFY_API_TOKEN')?.trim();
  const multi = Deno.env.get('APIFY_API_TOKENS')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) || [];
  const all = [single, ...multi].filter((x): x is string => Boolean(x));
  return Array.from(new Set(all));
}

async function fetchApifyJson(
  path: string,
  tokens: string[],
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const method = init.method || 'GET';
  let lastStatus = 502;
  let lastError = 'Apify request failed';

  for (const token of tokens) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${APIFY_BASE}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
          signal: AbortSignal.timeout(22_000),
        });

        const text = await res.text();
        let parsed: any = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = text;
        }

        if (res.ok) {
          return { ok: true, status: res.status, data: parsed };
        }

        lastStatus = res.status;
        lastError = parsed?.error?.message || `Apify HTTP ${res.status}`;

        if (res.status === 401 || res.status === 402 || res.status === 403) {
          // Rotate to next token if configured
          break;
        }
        if (res.status === 429 || res.status >= 500) {
          const jitter = Math.floor(Math.random() * 250);
          const backoffMs = 400 * Math.pow(2, attempt) + jitter;
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        return { ok: false, status: res.status, data: parsed, error: lastError };
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Apify network timeout';
        const backoffMs = 350 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  return { ok: false, status: lastStatus, data: null, error: lastError };
}

async function resolveBatchAndFolder(
  adminClient: ReturnType<typeof createClient>,
  rawBatchId: string,
): Promise<
  | {
      ok: true;
      batch: {
        id: string;
        batch_uuid: string;
        target_market: string | null;
        task_config: Record<string, unknown>;
        policy_set_id: string | null;
        disposable_folder_id: string | null;
      };
      folderId: string | null;
      folderName: string | null;
    }
  | { ok: false; status: number; error: string }
> {
  const batchId = rawBatchId.replace(/^#/, '').trim();
  if (!batchId) return { ok: false, status: 400, error: 'batch_id_required' };

  const { data: batchRow, error: bErr } = await adminClient
    .from('publishing_batches')
    .select('id, batch_uuid, target_market, task_config, policy_set_id, disposable_folder_id')
    .eq('id', batchId)
    .maybeSingle();

  if (bErr) return { ok: false, status: 500, error: bErr.message };
  if (!batchRow) return { ok: false, status: 404, error: `batch_not_found:${batchId}` };

  let folderId: string | null = batchRow.disposable_folder_id || null;
  let folderName: string | null = null;

  if (folderId) {
    const { data: fRow } = await adminClient
      .schema('pipeline')
      .from('pipeline_folders')
      .select('id, name, cleanup_state')
      .eq('id', folderId)
      .maybeSingle();
    if (!fRow || fRow.cleanup_state === 'deleted') {
      folderId = null;
    } else {
      folderName = fRow.name;
    }
  }

  if (!folderId) {
    const { data: fallbackFolder } = await adminClient
      .schema('pipeline')
      .from('pipeline_folders')
      .select('id, name')
      .eq('batch_id', batchId)
      .neq('cleanup_state', 'deleted')
      .limit(1)
      .maybeSingle();
    if (fallbackFolder) {
      folderId = fallbackFolder.id;
      folderName = fallbackFolder.name;
    }
  }

  return {
    ok: true,
    batch: {
      id: batchRow.id,
      batch_uuid: batchRow.batch_uuid,
      target_market: batchRow.target_market || null,
      task_config: (batchRow.task_config && typeof batchRow.task_config === 'object')
        ? (batchRow.task_config as Record<string, unknown>)
        : {},
      policy_set_id: batchRow.policy_set_id || null,
      disposable_folder_id: folderId,
    },
    folderId,
    folderName,
  };
}

interface IngestOutcome {
  count_total: number;
  count_new: number;
  count_duplicate: number;
  count_failed: number;
  avg_score: number | null;
  raw_archive_prefix: string;
  inserted_ids: string[];
  duplicate_zpids: string[];
  errors: Array<{ index: number; zpid?: string | null; reason: string }>;
  dry_run_preview?: Array<Record<string, unknown>>;
}

async function ingestApifyItemsToBatch(
  adminClient: ReturnType<typeof createClient>,
  params: {
    batchId: string;
    batchUuid: string;
    folderId: string | null;
    items: unknown[];
    actorId: string | null;
    runId: string | null;
    datasetId: string | null;
    providerKey: string;
    targetQty?: number | null;
    dryRun?: boolean;
  },
): Promise<IngestOutcome> {
  const runTag = params.runId || `manual_${Date.now()}`;
  const rawArchivePrefix = `batches/${params.batchId}/apify/${runTag}`;
  const outcome: IngestOutcome = {
    count_total: params.items.length,
    count_new: 0,
    count_duplicate: 0,
    count_failed: 0,
    avg_score: null,
    raw_archive_prefix: rawArchivePrefix,
    inserted_ids: [],
    duplicate_zpids: [],
    errors: [],
    ...(params.dryRun ? { dry_run_preview: [] } : {}),
  };

  let nextSerial = 1;
  let existingCountInBatch = 0;

  if (!params.dryRun) {
    if (params.folderId) {
      const { data: maxSerialRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_properties')
        .select('folder_serial')
        .eq('folder_id', params.folderId)
        .order('folder_serial', { ascending: false })
        .limit(1)
        .maybeSingle();
      nextSerial = (maxSerialRow?.folder_serial || 0) + 1;
    }

    const { count } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', params.batchId);
    existingCountInBatch = count || 0;
  }

  const geoapifyKey = Deno.env.get('GEOAPIFY_API_KEY') || '';
  const scores: number[] = [];

  for (let i = 0; i < params.items.length; i++) {
    if (
      !params.dryRun &&
      params.targetQty &&
      params.targetQty > 0 &&
      existingCountInBatch + outcome.count_new >= params.targetQty
    ) {
      break;
    }

    const rawItem = params.items[i];
    const norm = normalizeApifyZillowItem(rawItem, {
      actorId: params.actorId,
      runId: params.runId,
      datasetId: params.datasetId,
      providerKey: params.providerKey,
      batchId: params.batchId,
      channel: 'apify-scrape-worker-v1',
    });

    if (!norm.ok) {
      outcome.count_failed++;
      outcome.errors.push({ index: i, reason: norm.reason });
      continue;
    }

    // Best-effort county/neighborhood enrichment if missing and lat/lng present
    if (!params.dryRun && geoapifyKey && !norm.pipelineInput.county && norm.pipelineInput.lat != null && norm.pipelineInput.lng != null) {
      try {
        const gRes = await fetch(
          `https://api.geoapify.com/v1/geocode/reverse?lat=${norm.pipelineInput.lat}&lon=${norm.pipelineInput.lng}&apiKey=${geoapifyKey}`,
          { signal: AbortSignal.timeout(2500) },
        );
        if (gRes.ok) {
          const gJson = await gRes.json();
          const props = gJson?.features?.[0]?.properties;
          if (props) {
            if (!norm.pipelineInput.county && props.county) norm.pipelineInput.county = String(props.county);
            if (!norm.pipelineInput.neighborhood) {
              const nb = props.suburb || props.district || props.city_district;
              if (nb) norm.pipelineInput.neighborhood = String(nb);
            }
          }
        }
      } catch {
        // Non-fatal
      }
    }

    const record = buildPipelineRecord(norm.pipelineInput);
    record.batch_id = params.batchId;
    record.batch_uuid = params.batchUuid;
    record.photo_import_status = 'completed';
    const photoArr = (() => {
      try {
        const parsed = JSON.parse(String(record.original_image_urls || '[]'));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();
    record.photo_upload_status = photoArr.length > 0 ? 'complete' : 'none';
    record.last_photo_import_at = new Date().toISOString();
    record.last_photo_import_error = null;

    if (params.dryRun) {
      outcome.count_new++;
      scores.push(Number(record.data_quality_score || 0));
      outcome.dry_run_preview?.push({
        zpid: norm.zpid,
        title: record.title,
        monthly_rent: record.monthly_rent,
        original_monthly_rent: record.original_monthly_rent,
        bathrooms: record.bathrooms,
        half_bathrooms: record.half_bathrooms,
        photos: photoArr.length,
        poster_profile: norm.posterProfile,
        data_quality_score: record.data_quality_score,
      });
      continue;
    }

    // Intra-batch deduplication check
    const { data: existingDup } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .select('id')
      .eq('batch_id', params.batchId)
      .eq('source', 'zillow')
      .eq('source_listing_id', norm.zpid)
      .limit(1)
      .maybeSingle();

    if (existingDup) {
      outcome.count_duplicate++;
      outcome.duplicate_zpids.push(norm.zpid);
      continue;
    }

    if (params.folderId) {
      record.folder_id = params.folderId;
      record.folder_serial = nextSerial;
    }

    // Archive raw Apify JSON payload into pipeline-raw-payloads Storage bucket
    const archivePath = `${rawArchivePrefix}/${norm.zpid}.json`;
    try {
      await adminClient.storage
        .from('pipeline-raw-payloads')
        .upload(archivePath, JSON.stringify(norm.rawItem), {
          contentType: 'application/json',
          upsert: true,
        });
      const fp = (record.field_provenance && typeof record.field_provenance === 'object')
        ? (record.field_provenance as Record<string, unknown>)
        : {};
      fp.raw_payload_storage_path = archivePath;
      record.field_provenance = fp;
    } catch {
      // Non-fatal if archive upload has transient error
    }

    const { error: insErr } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .insert(record);

    if (insErr) {
      if (insErr.code === '23505') {
        outcome.count_duplicate++;
        outcome.duplicate_zpids.push(norm.zpid);
      } else {
        outcome.count_failed++;
        outcome.errors.push({ index: i, zpid: norm.zpid, reason: insErr.message });
      }
      continue;
    }

    if (params.folderId) nextSerial++;
    outcome.count_new++;
    outcome.inserted_ids.push(String(record.id));
    scores.push(Number(record.data_quality_score || 0));
  }

  if (scores.length > 0) {
    const sum = scores.reduce((a, b) => a + b, 0);
    outcome.avg_score = Math.round((sum / scores.length) * 100) / 100;
  }

  return outcome;
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
      action: url.searchParams.get('action') || 'get_provider_status',
      batch_id: url.searchParams.get('batch_id') || '',
      limit: url.searchParams.get('limit') || '50',
    };
  }

  const action = safeStr(body.action) || 'get_provider_status';

  // Webhook callbacks authenticate via shared webhook secret; all other actions require admin/service_role
  if (action === 'webhook_callback') {
    const expectedSecret = Deno.env.get('APIFY_WEBHOOK_SECRET') || Deno.env.get('CRON_SECRET') || '';
    const incomingSecret =
      req.headers.get('x-apify-webhook-secret') ||
      url.searchParams.get('webhook_secret') ||
      '';
    if (!expectedSecret || !incomingSecret || !constantTimeEqual(incomingSecret, expectedSecret)) {
      return jsonResp({ ok: false, error: 'invalid_webhook_secret' }, 401, origin);
    }
  } else {
    const auth = await verifyAdminOrService(req, adminClient, supabaseUrl, serviceKey);
    if (!auth.ok) return jsonResp({ ok: false, error: auth.error }, auth.status, origin);
  }

  const tokens = getApifyTokens();

  // ── 1. Provider Status & Dual-Channel Availability ────────────────────────
  if (action === 'get_provider_status') {
    const batchId = safeStr(body.batch_id)?.replace(/^#/, '') || null;
    const [{ data: providers, error: pErr }, { data: runsData }] = await Promise.all([
      adminClient
        .from('scraping_providers')
        .select('provider_key, display_name, channel_type, is_default, enabled, config_json, updated_at')
        .order('is_default', { ascending: false })
        .order('provider_key', { ascending: true }),
      adminClient.rpc('pipeline_list_scrape_runs', { p_batch_id: batchId, p_limit: 20 }),
    ]);

    if (pErr) return jsonResp({ ok: false, error: pErr.message }, 500, origin);
    const defaultAutomated = (providers || []).find((p) => p.channel_type === 'automated' && p.is_default) || null;
    const parsedRuns = typeof runsData === 'string' ? JSON.parse(runsData) : runsData;

    return jsonResp({
      ok: true,
      default_provider: defaultAutomated?.provider_key || 'apify',
      apify_token_configured: tokens.length > 0,
      apify_token_count: tokens.length,
      providers: providers || [],
      dual_channels: {
        automated_default: 'apify-scrape-worker',
        manual_extensions: ['receive-pipeline-import (chrome + orion)', 'import-from-url'],
      },
      recent_runs: parsedRuns?.runs || [],
    }, 200, origin);
  }

  // ── 2. List Scrape Runs ───────────────────────────────────────────────────
  if (action === 'list_runs') {
    const batchId = safeStr(body.batch_id)?.replace(/^#/, '') || null;
    const limit = safeInt(body.limit) || 50;
    const { data, error } = await adminClient.rpc('pipeline_list_scrape_runs', {
      p_batch_id: batchId,
      p_limit: limit,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return jsonResp(parsed, parsed?.ok ? 200 : 400, origin);
  }

  if (req.method !== 'POST') {
    return jsonResp({ ok: false, error: 'post_required' }, 405, origin);
  }

  // ── 3. Ingest Pre-Scraped / Dataset Items into Batch Staging ──────────────
  if (action === 'ingest_items') {
    const rawBatchId = safeStr(body.batch_id) || '';
    const resolved = await resolveBatchAndFolder(adminClient, rawBatchId);
    if (!resolved.ok) return jsonResp({ ok: false, error: resolved.error }, resolved.status, origin);

    if (!Array.isArray(body.items)) {
      return jsonResp({ ok: false, error: 'items_array_required' }, 400, origin);
    }

    const dryRun = body.dry_run === true;
    const idempotencyKey = safeStr(body.idempotency_key);
    const actorId = safeStr(body.actor_id) || 'maxcopell/zillow-scraper';
    const providerRunId = safeStr(body.provider_run_id);
    const datasetId = safeStr(body.dataset_id);
    const providerKey = safeStr(body.provider_key) || 'apify';
    const targetQty = safeInt(body.target_qty ?? resolved.batch.task_config?.target_qty);

    if (!dryRun && idempotencyKey) {
      const { data: existingRun } = await adminClient
        .schema('pipeline')
        .from('pipeline_scrape_runs')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingRun) {
        return jsonResp({
          ok: true,
          idempotent_replay: true,
          batch_id: resolved.batch.id,
          run: existingRun,
        }, 200, origin);
      }
    }

    const locationLabel =
      safeStr(body.location) ||
      resolved.batch.target_market ||
      (Array.isArray(resolved.batch.task_config?.locations)
        ? resolved.batch.task_config.locations.join(', ')
        : 'Zillow Batch Scrape');

    const outcome = await ingestApifyItemsToBatch(adminClient, {
      batchId: resolved.batch.id,
      batchUuid: resolved.batch.batch_uuid,
      folderId: resolved.folderId,
      items: body.items,
      actorId,
      runId: providerRunId,
      datasetId,
      providerKey,
      targetQty,
      dryRun,
    });

    if (dryRun) {
      return jsonResp({
        ok: true,
        dry_run: true,
        batch_id: resolved.batch.id,
        folder_id: resolved.folderId,
        outcome,
      }, 200, origin);
    }

    const runStatus =
      outcome.count_failed > 0 && outcome.count_new > 0
        ? 'partial'
        : outcome.count_failed > 0 && outcome.count_new === 0 && outcome.count_duplicate === 0
        ? 'failed'
        : 'succeeded';

    const { data: runRow, error: runErr } = await adminClient
      .schema('pipeline')
      .from('pipeline_scrape_runs')
      .insert({
        batch_id: resolved.batch.id,
        batch_uuid: resolved.batch.batch_uuid,
        provider_key: providerKey,
        actor_id: actorId,
        provider_run_id: providerRunId,
        dataset_id: datasetId,
        status: runStatus,
        source: 'zillow',
        location: locationLabel,
        count_total: outcome.count_total,
        count_new: outcome.count_new,
        count_duplicate: outcome.count_duplicate,
        avg_score: outcome.avg_score,
        cursor_offset: outcome.count_total,
        raw_archive_prefix: outcome.raw_archive_prefix,
        task_config_snapshot: resolved.batch.task_config,
        idempotency_key: idempotencyKey,
        partial: outcome.count_failed > 0,
        error_message: outcome.errors.length ? JSON.stringify(outcome.errors.slice(0, 10)) : null,
        meta_json: JSON.stringify({
          folder_id: resolved.folderId,
          inserted_ids: outcome.inserted_ids,
          duplicate_zpids: outcome.duplicate_zpids,
        }),
        completed_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (runErr) return jsonResp({ ok: false, error: runErr.message }, 500, origin);

    return jsonResp({
      ok: true,
      batch_id: resolved.batch.id,
      batch_uuid: resolved.batch.batch_uuid,
      folder_id: resolved.folderId,
      folder_name: resolved.folderName,
      outcome,
      run: runRow,
    }, 200, origin);
  }

  // ── 4. Start Live Apify Zillow Actor Run ──────────────────────────────────
  if (action === 'start_run') {
    const rawBatchId = safeStr(body.batch_id) || '';
    const resolved = await resolveBatchAndFolder(adminClient, rawBatchId);
    if (!resolved.ok) return jsonResp({ ok: false, error: resolved.error }, resolved.status, origin);

    // Check scraping_providers & pinned policy
    const { data: apifyProvider, error: provErr } = await adminClient
      .from('scraping_providers')
      .select('*')
      .eq('provider_key', 'apify')
      .maybeSingle();

    if (provErr) return jsonResp({ ok: false, error: provErr.message }, 500, origin);
    if (!apifyProvider || !apifyProvider.enabled) {
      return jsonResp({ ok: false, error: 'apify_provider_disabled' }, 409, origin);
    }

    const idempotencyKey = safeStr(body.idempotency_key);
    if (idempotencyKey) {
      const { data: existingRun } = await adminClient
        .schema('pipeline')
        .from('pipeline_scrape_runs')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existingRun) {
        return jsonResp({
          ok: true,
          idempotent_replay: true,
          batch_id: resolved.batch.id,
          run: existingRun,
        }, 200, origin);
      }
    }

    if (tokens.length === 0) {
      return jsonResp({
        ok: false,
        error: 'apify_token_not_configured',
        message: 'Set APIFY_API_TOKEN in Supabase Edge Function secrets to run live Apify actors.',
        batch_id: resolved.batch.id,
        provider: apifyProvider,
      }, 503, origin);
    }

    const providerCfg = (apifyProvider.config_json && typeof apifyProvider.config_json === 'object')
      ? (apifyProvider.config_json as Record<string, unknown>)
      : {};
    const actorId = safeStr(body.actor_id) || safeStr(providerCfg.actor_id) || 'maxcopell/zillow-scraper';
    if (!ACTOR_ID_RE.test(actorId)) {
      return jsonResp({ ok: false, error: 'invalid_actor_id' }, 400, origin);
    }
    const actorSlug = actorId.replace('/', '~');

    const taskConfig = (body.task_config && typeof body.task_config === 'object' && !Array.isArray(body.task_config))
      ? { ...resolved.batch.task_config, ...(body.task_config as Record<string, unknown>) }
      : resolved.batch.task_config;

    const actorInput = buildApifyActorInput(taskConfig, providerCfg);
    if (!Array.isArray(actorInput.searchUrls) || actorInput.searchUrls.length === 0) {
      return jsonResp({
        ok: false,
        error: 'target_locations_or_zillow_urls_required',
        message: 'Provide task_config.locations or valid https://www.zillow.com search_urls.',
      }, 400, origin);
    }

    const waitForFinish = Math.min(Math.max(safeInt(body.wait_for_finish) ?? 12, 0), 30);
    const startRes = await fetchApifyJson(
      `/acts/${encodeURIComponent(actorSlug)}/runs?waitForFinish=${waitForFinish}`,
      tokens,
      { method: 'POST', body: actorInput },
    );
    if (!startRes.ok) {
      return jsonResp({
        ok: false,
        error: 'apify_start_failed',
        details: startRes.error,
      }, startRes.status >= 400 ? startRes.status : 502, origin);
    }

    const apifyRun = startRes.data?.data || {};
    const providerRunId = safeStr(apifyRun.id);
    const datasetId = safeStr(apifyRun.defaultDatasetId);
    const apifyStatus = String(apifyRun.status || 'RUNNING').toUpperCase();

    const locationLabel =
      resolved.batch.target_market ||
      (Array.isArray(taskConfig.locations) ? taskConfig.locations.join(', ') : 'Zillow Search');

    const { data: runRow, error: insErr } = await adminClient
      .schema('pipeline')
      .from('pipeline_scrape_runs')
      .insert({
        batch_id: resolved.batch.id,
        batch_uuid: resolved.batch.batch_uuid,
        provider_key: 'apify',
        actor_id: actorId,
        provider_run_id: providerRunId,
        dataset_id: datasetId,
        status: apifyStatus === 'SUCCEEDED' ? 'running' : 'running',
        source: 'zillow',
        location: locationLabel,
        cursor_offset: 0,
        raw_archive_prefix: `batches/${resolved.batch.id}/apify/${providerRunId || Date.now()}`,
        task_config_snapshot: taskConfig,
        idempotency_key: idempotencyKey,
        meta_json: JSON.stringify({ apify_status: apifyStatus, folder_id: resolved.folderId }),
      })
      .select('*')
      .single();

    if (insErr) return jsonResp({ ok: false, error: insErr.message }, 500, origin);

    let chunkOutcome: IngestOutcome | null = null;
    let hasMore = apifyStatus !== 'SUCCEEDED';

    if (apifyStatus === 'SUCCEEDED' && datasetId && SAFE_APIFY_ID_RE.test(datasetId)) {
      const chunkLimit = Math.min(Math.max(safeInt(body.chunk_limit) ?? 25, 1), 100);
      const dsRes = await fetchApifyJson(`/datasets/${datasetId}/items?offset=0&limit=${chunkLimit}&clean=true`, tokens);
      if (dsRes.ok && Array.isArray(dsRes.data)) {
        const targetQty = safeInt(taskConfig.target_qty);
        chunkOutcome = await ingestApifyItemsToBatch(adminClient, {
          batchId: resolved.batch.id,
          batchUuid: resolved.batch.batch_uuid,
          folderId: resolved.folderId,
          items: dsRes.data,
          actorId,
          runId: providerRunId,
          datasetId,
          providerKey: 'apify',
          targetQty,
        });
        hasMore = dsRes.data.length >= chunkLimit;
        await adminClient
          .schema('pipeline')
          .from('pipeline_scrape_runs')
          .update({
            cursor_offset: dsRes.data.length,
            count_total: chunkOutcome.count_total,
            count_new: chunkOutcome.count_new,
            count_duplicate: chunkOutcome.count_duplicate,
            avg_score: chunkOutcome.avg_score,
            status: hasMore ? 'running' : (chunkOutcome.count_failed > 0 ? 'partial' : 'succeeded'),
            partial: chunkOutcome.count_failed > 0,
            completed_at: hasMore ? null : new Date().toISOString(),
          })
          .eq('id', runRow.id);
      }
    }

    return jsonResp({
      ok: true,
      batch_id: resolved.batch.id,
      folder_id: resolved.folderId,
      apify_run_id: providerRunId,
      apify_status: apifyStatus,
      dataset_id: datasetId,
      has_more: hasMore,
      scrape_run_id: runRow.id,
      chunk_outcome: chunkOutcome,
    }, 200, origin);
  }

  // ── 5. Poll Apify Run & Ingest Next Paginated Chunk (Also Used by Webhook) ─
  if (action === 'poll_and_ingest' || action === 'webhook_callback') {
    if (tokens.length === 0) {
      return jsonResp({
        ok: false,
        error: 'apify_token_not_configured',
        message: 'Set APIFY_API_TOKEN in Supabase Edge Function secrets to poll Apify datasets.',
      }, 503, origin);
    }

    const scrapeRunId = safeInt(body.scrape_run_id);
    const webhookRunId = safeStr(
      (body.resource as Record<string, unknown> | undefined)?.id ??
        (body.eventData as Record<string, unknown> | undefined)?.actorRunId ??
        body.provider_run_id,
    );

    let runQuery = adminClient.schema('pipeline').from('pipeline_scrape_runs').select('*');
    if (scrapeRunId) runQuery = runQuery.eq('id', scrapeRunId);
    else if (webhookRunId) runQuery = runQuery.eq('provider_run_id', webhookRunId);
    else return jsonResp({ ok: false, error: 'scrape_run_id_or_provider_run_id_required' }, 400, origin);

    const { data: runRow, error: rErr } = await runQuery.limit(1).maybeSingle();
    if (rErr) return jsonResp({ ok: false, error: rErr.message }, 500, origin);
    if (!runRow) return jsonResp({ ok: false, error: 'scrape_run_not_found' }, 404, origin);

    const providerRunId = safeStr(runRow.provider_run_id);
    if (!providerRunId || !SAFE_APIFY_ID_RE.test(providerRunId)) {
      return jsonResp({ ok: false, error: 'invalid_provider_run_id' }, 400, origin);
    }

    const runStatusRes = await fetchApifyJson(`/actor-runs/${providerRunId}`, tokens);
    if (!runStatusRes.ok) {
      return jsonResp({ ok: false, error: 'apify_poll_failed', details: runStatusRes.error }, 502, origin);
    }

    const apifyRun = runStatusRes.data?.data || {};
    const apifyStatus = String(apifyRun.status || 'RUNNING').toUpperCase();
    const datasetId = safeStr(apifyRun.defaultDatasetId) || safeStr(runRow.dataset_id);

    if (apifyStatus === 'FAILED' || apifyStatus === 'ABORTED' || apifyStatus === 'TIMED-OUT') {
      await adminClient
        .schema('pipeline')
        .from('pipeline_scrape_runs')
        .update({
          status: apifyStatus === 'ABORTED' ? 'cancelled' : 'failed',
          error_message: `Apify actor run ${apifyStatus}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runRow.id);

      return jsonResp({ ok: false, error: 'apify_run_failed', apify_status: apifyStatus, scrape_run_id: runRow.id }, 200, origin);
    }

    if (apifyStatus !== 'SUCCEEDED') {
      return jsonResp({
        ok: true,
        scrape_run_id: runRow.id,
        apify_status: apifyStatus,
        has_more: true,
        message: 'Apify run still in progress; poll again shortly.',
      }, 200, origin);
    }

    if (!datasetId || !SAFE_APIFY_ID_RE.test(datasetId)) {
      return jsonResp({ ok: false, error: 'missing_valid_dataset_id' }, 400, origin);
    }

    const offset = Number(runRow.cursor_offset || 0);
    const chunkLimit = Math.min(Math.max(safeInt(body.chunk_limit) ?? 25, 1), 100);
    const dsRes = await fetchApifyJson(
      `/datasets/${datasetId}/items?offset=${offset}&limit=${chunkLimit}&clean=true`,
      tokens,
    );
    if (!dsRes.ok || !Array.isArray(dsRes.data)) {
      return jsonResp({ ok: false, error: 'apify_dataset_fetch_failed', details: dsRes.error }, 502, origin);
    }

    const resolved = await resolveBatchAndFolder(adminClient, String(runRow.batch_id || ''));
    if (!resolved.ok) return jsonResp({ ok: false, error: resolved.error }, resolved.status, origin);

    const chunkOutcome = await ingestApifyItemsToBatch(adminClient, {
      batchId: resolved.batch.id,
      batchUuid: resolved.batch.batch_uuid,
      folderId: resolved.folderId,
      items: dsRes.data,
      actorId: runRow.actor_id,
      runId: providerRunId,
      datasetId,
      providerKey: runRow.provider_key || 'apify',
      targetQty: safeInt(resolved.batch.task_config?.target_qty),
    });

    const newOffset = offset + dsRes.data.length;
    const hasMore = dsRes.data.length >= chunkLimit;
    const totalCount = Number(runRow.count_total || 0) + chunkOutcome.count_total;
    const newCount = Number(runRow.count_new || 0) + chunkOutcome.count_new;
    const dupCount = Number(runRow.count_duplicate || 0) + chunkOutcome.count_duplicate;
    const hasPartial = Boolean(runRow.partial) || chunkOutcome.count_failed > 0;

    await adminClient
      .schema('pipeline')
      .from('pipeline_scrape_runs')
      .update({
        dataset_id: datasetId,
        cursor_offset: newOffset,
        count_total: totalCount,
        count_new: newCount,
        count_duplicate: dupCount,
        avg_score: chunkOutcome.avg_score ?? runRow.avg_score,
        status: hasMore ? 'running' : (hasPartial ? 'partial' : 'succeeded'),
        partial: hasPartial,
        completed_at: hasMore ? null : new Date().toISOString(),
      })
      .eq('id', runRow.id);

    return jsonResp({
      ok: true,
      scrape_run_id: runRow.id,
      batch_id: resolved.batch.id,
      apify_status: apifyStatus,
      offset,
      next_offset: newOffset,
      has_more: hasMore,
      chunk_outcome: chunkOutcome,
      totals: { count_total: totalCount, count_new: newCount, count_duplicate: dupCount },
    }, 200, origin);
  }

  return jsonResp({ ok: false, error: 'invalid_action' }, 400, origin);
});
