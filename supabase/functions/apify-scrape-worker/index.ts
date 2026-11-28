// ============================================================
// Choice Properties — apify-scrape-worker Edge Function
// Phase 5 + Phase 10: Apify On-Demand Scraping Engine, Multi-Key
// Pool, Zero-Delay Failover & Mid-Run Handoff
// ============================================================
// Operator-triggered, on-demand Zillow scraper (never runs on schedule/cron):
//   - public.scraping_providers ('apify' on-demand default)
//   - pipeline.apify_api_keys (encrypted multi-key pool + health/cooldowns)
//   - public.rules_get_effective_policy(batch_id)
//   - pipeline-raw-payloads Storage archive
//   - _shared/apify-normalizer.ts + _shared/pipeline-record.ts
//   - _shared/apify-key-pool.ts (instant failover + quota probe)
//   - pipeline.pipeline_properties (batch-scoped disposable folder + intra-batch dedup)
//   - pipeline.pipeline_scrape_runs (full run, key affinity & failover telemetry)
//
// Actions (all require verified admin or service_role auth):
//   - get_provider_status : Provider registry, key pool summary & on-demand status
//   - list_keys           : List masked Apify keys with health/quota/failover telemetry
//   - add_key             : Live-validate, encrypt & store a new Apify API key
//   - probe_keys          : Refresh live Apify /users/me/limits quota for all keys
//   - update_key          : Toggle enabled, priority, label, or reset key cooldown/status
//   - delete_key          : Remove an admin_pool key (or disable edge_secret tracking)
//   - list_runs           : Inspect pipeline_scrape_runs (optional batch_id filter)
//   - start_run           : Operator-triggered Apify Zillow run with instant key failover
//   - poll_and_ingest     : Polls operator run + ingests chunk + hands off mid-run quota aborts
//   - ingest_items        : Ingests Apify Zillow items directly into batch staging
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';
import {
  buildPipelineRecord,
  safeStr,
  safeInt,
} from '../_shared/pipeline-record.ts';
import {
  DEFAULT_DETAIL_ACTOR_ID,
  DEFAULT_SEARCH_ACTOR_ID,
  buildApifyActorInput,
  extractStage1DetailUrls,
  matchesTaskConfigFilters,
  mergeLevel2LocationEnrichment,
  mergeStage2RecordWithExisting,
  normalizeApifyZillowItem,
  normalizeTaskConfigAliases,
  resolveActorAdapterSelection,
  resolveItemCanonicalType,
  resolveItemLocationKey,
  scorePreferredFeatures,
  selectBalancedItemsByQuota,
  type NormalizeApifyResult,
} from '../_shared/apify-normalizer.ts';
import {
  APIFY_ACTOR_ADAPTERS,
  resolveBoundsMapForLocations,
  resolveExtractionDepth,
  type ExtractionDepth,
  type ScrapeStage,
} from '../_shared/apify-actor-adapters.ts';
import {
  fetchLevel2CensusSchoolDistrict,
  fetchLevel2GeoapifyInsights,
} from '../_shared/location-intelligence.ts';
import { verifyBatchWorkerLease } from '../_shared/worker-lease.ts';
import {
  claimKeySlot,
  encryptApifyToken,
  fetchApifyWithFailover,
  fingerprintApifyToken,
  isApifyRunQuotaFailure,
  markKeyState,
  maskApifyToken,
  probeApifyTokenLimits,
  releaseKeySlot,
  resolveUnifiedKeyPool,
  toMaskedKey,
  type FailoverEvent,
  type ResolvedApifyKey,
} from '../_shared/apify-key-pool.ts';

const SAFE_APIFY_ID_RE = /^[a-zA-Z0-9_-]{4,80}$/;
const MAX_CONTINUATION_DEPTH = 5;

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

function formatKeyLabel(key: ResolvedApifyKey): string {
  return `${key.label} (••••${key.token_suffix})`;
}

async function fetchFullDatasetPages(params: {
  adminClient: ReturnType<typeof createClient>;
  keys: ResolvedApifyKey[];
  datasetId: string;
  startOffset: number;
  maxTotalItems?: number;
  preferredFingerprint?: string | null;
}): Promise<{
  ok: boolean;
  items: unknown[];
  fetchedCount: number;
  hasMore: boolean;
  error?: string;
  failoverEvents: FailoverEvent[];
}> {
  const maxTotal = Math.min(Math.max(params.maxTotalItems ?? 500, 1), 1000);
  const pageSize = 100;
  const collected: unknown[] = [];
  const allFailoverEvents: FailoverEvent[] = [];
  let offset = Math.max(0, params.startOffset);
  let lastHadFullPage = false;

  while (collected.length < maxTotal) {
    const limit = Math.min(pageSize, maxTotal - collected.length);
    const dsRes = await fetchApifyWithFailover({
      adminClient: params.adminClient,
      path: `/datasets/${params.datasetId}/items?offset=${offset}&limit=${limit}&clean=true`,
      keys: params.keys,
      preferredFingerprint: params.preferredFingerprint,
    });
    allFailoverEvents.push(...dsRes.failoverEvents);
    if (!dsRes.ok || !Array.isArray(dsRes.data)) {
      if (collected.length > 0) {
        return {
          ok: true,
          items: collected,
          fetchedCount: collected.length,
          hasMore: true,
          failoverEvents: allFailoverEvents,
        };
      }
      return {
        ok: false,
        items: [],
        fetchedCount: 0,
        hasMore: false,
        error: dsRes.error,
        failoverEvents: allFailoverEvents,
      };
    }

    collected.push(...dsRes.data);
    offset += dsRes.data.length;
    lastHadFullPage = dsRes.data.length >= limit;
    if (!lastHadFullPage) break;
  }

  return {
    ok: true,
    items: collected,
    fetchedCount: collected.length,
    hasMore: lastHadFullPage && collected.length >= maxTotal,
    failoverEvents: allFailoverEvents,
  };
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
  count_upgraded?: number;
  count_filtered_out: number;
  count_failed: number;
  avg_score: number | null;
  raw_archive_prefix: string;
  inserted_ids: string[];
  upgraded_ids?: string[];
  duplicate_zpids: string[];
  filtered_out_reasons?: Array<{ index: number; zpid: string; reason: string }>;
  errors: Array<{ index: number; zpid?: string | null; reason: string }>;
  dry_run_preview?: Array<Record<string, unknown>>;
}

const RENTAL_ELIGIBILITY_EXCLUSION_REASONS = new Set([
  'sale_only_excluded',
  'unconfirmed_rental_status',
  'missing_verified_asking_rent',
  'invalid_sale_price_as_rent',
]);

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
    taskConfig?: Record<string, unknown>;
    extractionDepth?: ExtractionDepth;
    dryRun?: boolean;
  },
): Promise<IngestOutcome> {
  const runTag = params.runId || `manual_${Date.now()}`;
  const rawArchivePrefix = `batches/${params.batchId}/apify/${runTag}`;
  const taskConfig = normalizeTaskConfigAliases(params.taskConfig || {});
  const extractionDepth: ExtractionDepth =
    params.extractionDepth || resolveExtractionDepth(taskConfig);
  const outcome: IngestOutcome = {
    count_total: params.items.length,
    count_new: 0,
    count_duplicate: 0,
    count_upgraded: 0,
    count_filtered_out: 0,
    count_failed: 0,
    avg_score: null,
    raw_archive_prefix: rawArchivePrefix,
    inserted_ids: [],
    upgraded_ids: [],
    duplicate_zpids: [],
    filtered_out_reasons: [],
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

  const configuredLocations = Array.isArray(taskConfig.locations)
    ? taskConfig.locations.map((x) => safeStr(x)).filter((x): x is string => Boolean(x))
    : [];

  type MatchedCandidate = {
    index: number;
    norm: Extract<NormalizeApifyResult, { ok: true }>;
    matchedPreferred: string[];
    preferenceScore: number;
  };

  const candidates: Array<{
    item: MatchedCandidate;
    locationKey: string;
    typeKey: string;
    preferenceScore: number;
  }> = [];

  const seenBatchZpids = new Set<string>();
  const seenBatchAddrKeys = new Set<string>();

  for (let i = 0; i < params.items.length; i++) {
    const rawItem = params.items[i];
    const norm = normalizeApifyZillowItem(rawItem, {
      actorId: params.actorId,
      runId: params.runId,
      datasetId: params.datasetId,
      providerKey: params.providerKey,
      batchId: params.batchId,
      channel: 'apify-scrape-worker-v2',
      extractionDepth,
      taskConfig,
    });

    if (!norm.ok) {
      if (RENTAL_ELIGIBILITY_EXCLUSION_REASONS.has(norm.reason)) {
        outcome.count_filtered_out++;
        if ((outcome.filtered_out_reasons?.length || 0) < 20) {
          outcome.filtered_out_reasons?.push({
            index: i,
            zpid: norm.zpid || 'filtered',
            reason: norm.reason,
          });
        }
      } else {
        outcome.count_failed++;
        outcome.errors.push({ index: i, zpid: norm.zpid || null, reason: norm.reason });
      }
      continue;
    }

    const filterRes = matchesTaskConfigFilters(norm, taskConfig);
    if (!filterRes.matches) {
      outcome.count_filtered_out++;
      if ((outcome.filtered_out_reasons?.length || 0) < 20) {
        outcome.filtered_out_reasons?.push({
          index: i,
          zpid: norm.zpid,
          reason: filterRes.reason || 'task_config_mismatch',
        });
      }
      continue;
    }

    if (
      seenBatchZpids.has(norm.zpid) ||
      (norm.normalizedAddressKey && seenBatchAddrKeys.has(norm.normalizedAddressKey))
    ) {
      outcome.count_duplicate++;
      outcome.duplicate_zpids.push(norm.zpid);
      continue;
    }
    seenBatchZpids.add(norm.zpid);
    if (norm.normalizedAddressKey) {
      seenBatchAddrKeys.add(norm.normalizedAddressKey);
    }

    const pref = scorePreferredFeatures(norm, taskConfig.preferred_features);
    candidates.push({
      item: {
        index: i,
        norm,
        matchedPreferred: pref.matched,
        preferenceScore: pref.score,
      },
      locationKey: resolveItemLocationKey(norm, configuredLocations),
      typeKey: resolveItemCanonicalType(norm),
      preferenceScore: pref.score,
    });
  }

  const remainingSlots =
    params.targetQty && params.targetQty > 0
      ? Math.max(params.targetQty - existingCountInBatch, 0)
      : null;

  const selected =
    remainingSlots === 0 && !params.dryRun
      ? []
      : selectBalancedItemsByQuota(
          candidates,
          taskConfig,
          params.dryRun ? params.targetQty : remainingSlots,
        );

  const geoapifyKey = Deno.env.get('GEOAPIFY_API_KEY') || '';
  const scores: number[] = [];

  for (const entry of selected) {
    const { index: i, norm, matchedPreferred, preferenceScore } = entry.item;

    if (
      !params.dryRun &&
      params.targetQty &&
      params.targetQty > 0 &&
      existingCountInBatch + outcome.count_new >= params.targetQty
    ) {
      break;
    }

    // Best-effort county/neighborhood fallback (Level 1 + Level 2) OR
    // full Level-2 external insights (Geoapify Places + Census TIGERweb, strictly opt-in)
    if (!params.dryRun && norm.pipelineInput.lat != null && norm.pipelineInput.lng != null) {
      if (extractionDepth === 'with_insights') {
        try {
          const [geoResSettled, censusResSettled] = await Promise.allSettled([
            geoapifyKey
              ? fetchLevel2GeoapifyInsights({
                  lat: Number(norm.pipelineInput.lat),
                  lng: Number(norm.pipelineInput.lng),
                  apiKey: geoapifyKey,
                  includeReverseGeocode: !norm.pipelineInput.county || !norm.pipelineInput.neighborhood,
                  timeoutMs: 4000,
                })
              : Promise.resolve(null),
            fetchLevel2CensusSchoolDistrict({
              lat: Number(norm.pipelineInput.lat),
              lng: Number(norm.pipelineInput.lng),
              timeoutMs: 4000,
            }),
          ]);
          const geoRes = geoResSettled.status === 'fulfilled' ? geoResSettled.value : null;
          const censusRes = censusResSettled.status === 'fulfilled' ? censusResSettled.value : null;
          mergeLevel2LocationEnrichment(norm.pipelineInput, geoRes, censusRes, extractionDepth);
        } catch {
          // Graceful non-fatal degradation — Level 1 staging continues intact
        }
      } else if (geoapifyKey && !norm.pipelineInput.county) {
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
        property_type: record.property_type,
        monthly_rent: record.monthly_rent,
        original_monthly_rent: record.original_monthly_rent,
        bedrooms: record.bedrooms,
        bathrooms: record.bathrooms,
        half_bathrooms: record.half_bathrooms,
        photos: photoArr.length,
        preference_score: preferenceScore,
        matched_preferred_features: matchedPreferred,
        poster_profile: norm.posterProfile,
        extraction_depth: extractionDepth,
        location_context: record.location_context || null,
        has_level2_insights: Boolean(
          norm.pipelineInput.location_details &&
          typeof norm.pipelineInput.location_details === 'object' &&
          !Array.isArray(norm.pipelineInput.location_details) &&
          (norm.pipelineInput.location_details as Record<string, unknown>).insights,
        ),
        data_quality_score: record.data_quality_score,
      });
      continue;
    }

    // Intra-batch deduplication check: match by source_listing_id OR normalized_address_key
    const { data: existingByZpid } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .select('*')
      .eq('batch_id', params.batchId)
      .eq('source', 'zillow')
      .eq('source_listing_id', norm.zpid)
      .limit(1)
      .maybeSingle();

    let existingRow: Record<string, unknown> | null = existingByZpid as Record<string, unknown> | null;
    if (!existingRow && norm.normalizedAddressKey) {
      const { data: existingByAddr } = await adminClient
        .schema('pipeline')
        .from('pipeline_properties')
        .select('*')
        .eq('batch_id', params.batchId)
        .eq('normalized_address_key', norm.normalizedAddressKey)
        .limit(1)
        .maybeSingle();
      existingRow = existingByAddr as Record<string, unknown> | null;
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

    if (existingRow) {
      const existingProv =
        existingRow.field_provenance && typeof existingRow.field_provenance === 'object'
          ? (existingRow.field_provenance as Record<string, unknown>)
          : {};
      const incomingIsStage2 =
        params.actorId === DEFAULT_DETAIL_ACTOR_ID ||
        Boolean((record.field_provenance as Record<string, unknown> | undefined)?.stage2_enriched);
      const shouldConsiderMerge = incomingIsStage2 || !existingProv.stage2_enriched;

      if (shouldConsiderMerge) {
        const mergeRes = mergeStage2RecordWithExisting(existingRow, record, {
          isStage2Detail: incomingIsStage2,
        });
        if (mergeRes.changed) {
          const { error: updErr } = await adminClient
            .schema('pipeline')
            .from('pipeline_properties')
            .update(mergeRes.patch)
            .eq('id', String(existingRow.id));
          if (updErr) {
            outcome.count_failed++;
            outcome.errors.push({ index: i, zpid: norm.zpid, reason: updErr.message });
            continue;
          }
          outcome.count_upgraded = (outcome.count_upgraded || 0) + 1;
          outcome.upgraded_ids?.push(String(existingRow.id));
          scores.push(Number(mergeRes.patch.data_quality_score ?? existingRow.data_quality_score ?? 0));
        }
      }

      outcome.count_duplicate++;
      outcome.duplicate_zpids.push(norm.zpid);
      continue;
    }

    if (params.folderId) {
      record.folder_id = params.folderId;
      record.folder_serial = nextSerial;
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

async function dispatchTwoStageDetailRun(
  adminClient: ReturnType<typeof createClient>,
  params: {
    stage1RunRow: Record<string, any>;
    stage1Items: unknown[];
    stage1FetchedCount: number;
    stage1StartOffset: number;
    batch: {
      id: string;
      batch_uuid: string;
      target_market: string | null;
      task_config: Record<string, unknown>;
    };
    folderId: string | null;
    locationLabel: string;
    taskConfig: Record<string, unknown>;
    providerCfg: Record<string, unknown>;
    detailActorId: string;
    extractionDepth: ExtractionDepth;
    waitForFinish: number;
    priorFailoverEvents: FailoverEvent[];
  },
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const { stage1RunRow, stage1Items, batch, folderId, locationLabel, taskConfig, providerCfg } = params;
  const stage1Id = Number(stage1RunRow.id);
  const stage1Fingerprint = safeStr(stage1RunRow.key_fingerprint);

  await adminClient
    .schema('pipeline')
    .from('pipeline_scrape_runs')
    .update({
      cursor_offset: params.stage1StartOffset + params.stage1FetchedCount,
      count_total: stage1Items.length,
      status: 'succeeded',
      partial: false,
      failover_events: params.priorFailoverEvents,
      completed_at: new Date().toISOString(),
    })
    .eq('id', stage1Id);

  if (stage1Fingerprint) {
    await releaseKeySlot(adminClient, stage1Fingerprint);
  }

  const rawArchivePrefix =
    safeStr(stage1RunRow.raw_archive_prefix) || `batches/${batch.id}/apify/${stage1RunRow.provider_run_id || stage1Id}`;
  try {
    await adminClient.storage
      .from('pipeline-raw-payloads')
      .upload(`${rawArchivePrefix}/stage1-items.json`, JSON.stringify(stage1Items), {
        contentType: 'application/json',
        upsert: true,
      });
  } catch {
    // non-fatal diagnostic archive
  }

  const triage = extractStage1DetailUrls(stage1Items, taskConfig);
  if (triage.candidateUrls.length === 0) {
    const stage1Diagnostic = stage1Items.slice(0, 3).map((item, idx) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return { index: idx, type: typeof item, preview: String(item).slice(0, 200) };
      }
      const o = item as Record<string, unknown>;
      return {
        index: idx,
        keys: Object.keys(o).slice(0, 25),
        error: o.error ?? null,
        message: o.message ?? null,
        status: o.homeStatus ?? o.listingStatus ?? o.status ?? null,
        isEmpty: o.isEmpty ?? null,
        sourceSearchUrl: o.sourceSearchUrl ?? null,
      };
    });
    const emptyOutcome: IngestOutcome = {
      count_total: stage1Items.length,
      count_new: 0,
      count_duplicate: 0,
      count_filtered_out: triage.skippedSaleOnly + triage.skippedFilterMismatch,
      count_failed: 0,
      avg_score: null,
      raw_archive_prefix: rawArchivePrefix,
      inserted_ids: [],
      duplicate_zpids: [],
      filtered_out_reasons: [],
      errors: [],
    };
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        batch_id: batch.id,
        folder_id: folderId,
        scrape_run_id: stage1Id,
        scrape_stage: 'search',
        two_stage_completed: true,
        two_stage_skipped_reason: 'no_matching_stage1_candidates',
        apify_run_id: stage1RunRow.provider_run_id || null,
        apify_status: 'SUCCEEDED',
        dataset_id: stage1RunRow.dataset_id || null,
        has_more: false,
        stage1_triage: triage,
        stage1_diagnostic: stage1Diagnostic,
        chunk_outcome: emptyOutcome,
        failover_events: params.priorFailoverEvents,
        message: 'Stage-1 search returned no qualifying rental candidates; Stage-2 detail run skipped cleanly.',
      },
    };
  }

  const detailActorId = params.detailActorId || DEFAULT_DETAIL_ACTOR_ID;
  const detailSelection = resolveActorAdapterSelection({
    requestedActorId: detailActorId,
    taskConfig,
    providerConfig: providerCfg,
    allowExperimentalActor: false,
  });
  if (!detailSelection.ok || !detailSelection.adapter || !detailSelection.actorSlug) {
    return {
      ok: false,
      status: detailSelection.status || 400,
      body: {
        ok: false,
        error: detailSelection.error || 'invalid_detail_actor',
        message: detailSelection.message,
        stage1_scrape_run_id: stage1Id,
        stage1_triage: triage,
      },
    };
  }

  const detailTaskConfig: Record<string, unknown> = {
    ...taskConfig,
    actor_id: detailActorId,
    detail_urls: triage.candidateUrls,
  };
  const detailInput = buildApifyActorInput(detailTaskConfig, providerCfg, {
    actorId: detailActorId,
    stage: 'detail',
    extractionDepth: params.extractionDepth,
    detailUrls: triage.candidateUrls,
  });
  const detailValidation = detailSelection.adapter.validateInput(detailInput);
  if (!detailValidation.ok) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: detailValidation.error || 'invalid_detail_input',
        message: detailValidation.message,
        stage1_scrape_run_id: stage1Id,
      },
    };
  }

  const refreshedPool = await resolveUnifiedKeyPool(adminClient);
  if (refreshedPool.usableKeys.length === 0) {
    return {
      ok: false,
      status: 429,
      body: {
        ok: false,
        error: 'all_apify_keys_exhausted',
        message: 'Stage-1 search succeeded, but no healthy Apify API keys remain to launch Stage-2 detail enrichment.',
        stage1_scrape_run_id: stage1Id,
        stage1_triage: triage,
      },
    };
  }

  const stage2Wait = Math.min(Math.max(params.waitForFinish, 0), 12);
  const stage2Start = await fetchApifyWithFailover({
    adminClient,
    path: `/acts/${encodeURIComponent(detailSelection.actorSlug)}/runs?waitForFinish=${stage2Wait}`,
    keys: refreshedPool.allKeys,
    preferredFingerprint: stage1Fingerprint,
    selectionSeed: batch.id,
    method: 'POST',
    body: detailInput,
    recordUseOnSuccess: true,
  });

  const combinedEvents = [...params.priorFailoverEvents, ...stage2Start.failoverEvents];
  if (!stage2Start.ok || !stage2Start.usedKey) {
    return {
      ok: false,
      status: stage2Start.status >= 400 ? stage2Start.status : 502,
      body: {
        ok: false,
        error: 'apify_stage2_start_failed',
        details: stage2Start.error,
        stage1_scrape_run_id: stage1Id,
        stage1_triage: triage,
        failover_events: combinedEvents,
      },
    };
  }

  const stage2Key = stage2Start.usedKey;
  await claimKeySlot(adminClient, stage2Key.key_fingerprint);

  const stage2ApifyRun = stage2Start.data?.data || {};
  const stage2RunId = safeStr(stage2ApifyRun.id);
  const stage2DatasetId = safeStr(stage2ApifyRun.defaultDatasetId);
  const stage2Status = String(stage2ApifyRun.status || 'RUNNING').toUpperCase();

  const { data: stage2Row, error: s2Err } = await adminClient
    .schema('pipeline')
    .from('pipeline_scrape_runs')
    .insert({
      batch_id: batch.id,
      batch_uuid: batch.batch_uuid,
      provider_key: 'apify',
      actor_id: detailActorId,
      provider_run_id: stage2RunId,
      dataset_id: stage2DatasetId,
      status: 'running',
      scrape_stage: 'detail',
      extraction_depth: params.extractionDepth,
      adapter_key: detailSelection.adapter.key,
      source: 'zillow',
      location: locationLabel,
      cursor_offset: 0,
      raw_archive_prefix: `batches/${batch.id}/apify/${stage2RunId || Date.now()}`,
      task_config_snapshot: detailTaskConfig,
      key_fingerprint: stage2Key.key_fingerprint,
      key_label: formatKeyLabel(stage2Key),
      parent_scrape_run_id: stage1Id,
      continuation_depth: 0,
      failover_events: combinedEvents,
      meta_json: JSON.stringify({
        apify_status: stage2Status,
        folder_id: folderId,
        stage1_scrape_run_id: stage1Id,
        stage1_triage: triage,
        used_key_suffix: stage2Key.token_suffix,
      }),
    })
    .select('*')
    .single();

  if (s2Err || !stage2Row) {
    await releaseKeySlot(adminClient, stage2Key.key_fingerprint);
    return {
      ok: false,
      status: 500,
      body: { ok: false, error: s2Err?.message || 'stage2_run_insert_failed' },
    };
  }

  let stage2Outcome: IngestOutcome | null = null;
  let stage2HasMore = stage2Status !== 'SUCCEEDED';

  if (stage2Status === 'SUCCEEDED' && stage2DatasetId && SAFE_APIFY_ID_RE.test(stage2DatasetId)) {
    const s2Pages = await fetchFullDatasetPages({
      adminClient,
      keys: refreshedPool.allKeys,
      datasetId: stage2DatasetId,
      startOffset: 0,
      maxTotalItems: 1000,
      preferredFingerprint: stage2Key.key_fingerprint,
    });
    if (s2Pages.ok) {
      stage2Outcome = await ingestApifyItemsToBatch(adminClient, {
        batchId: batch.id,
        batchUuid: batch.batch_uuid,
        folderId,
        items: s2Pages.items,
        actorId: detailActorId,
        runId: stage2RunId,
        datasetId: stage2DatasetId,
        providerKey: 'apify',
        targetQty: safeInt(taskConfig.target_qty),
        taskConfig,
        extractionDepth: params.extractionDepth,
      });
      stage2HasMore = s2Pages.hasMore;
      await adminClient
        .schema('pipeline')
        .from('pipeline_scrape_runs')
        .update({
          cursor_offset: s2Pages.fetchedCount,
          count_total: stage2Outcome.count_total,
          count_new: stage2Outcome.count_new,
          count_duplicate: stage2Outcome.count_duplicate,
          avg_score: stage2Outcome.avg_score,
          status: stage2HasMore ? 'running' : (stage2Outcome.count_failed > 0 ? 'partial' : 'succeeded'),
          partial: stage2Outcome.count_failed > 0,
          completed_at: stage2HasMore ? null : new Date().toISOString(),
        })
        .eq('id', stage2Row.id);
      if (!stage2HasMore) {
        await releaseKeySlot(adminClient, stage2Key.key_fingerprint);
      }
    }
  } else if (stage2Status === 'FAILED' || stage2Status === 'ABORTED' || stage2Status === 'TIMED-OUT') {
    await releaseKeySlot(adminClient, stage2Key.key_fingerprint);
    await adminClient
      .schema('pipeline')
      .from('pipeline_scrape_runs')
      .update({
        status: 'failed',
        error_message: `Stage-2 detail actor ${stage2Status}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', stage2Row.id);
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error: 'apify_stage2_run_failed',
        apify_status: stage2Status,
        stage1_scrape_run_id: stage1Id,
        scrape_run_id: stage2Row.id,
        stage1_triage: triage,
        failover_events: combinedEvents,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      batch_id: batch.id,
      folder_id: folderId,
      two_stage_transition: true,
      stage2_started: true,
      stage1_scrape_run_id: stage1Id,
      scrape_run_id: stage2Row.id,
      scrape_stage: 'detail',
      stage2_run: stage2Row,
      continuation_run: stage2Row,
      stage1_triage: triage,
      apify_run_id: stage2RunId,
      apify_status: stage2Status,
      dataset_id: stage2DatasetId,
      has_more: stage2HasMore,
      used_key: {
        label: stage2Key.label,
        token_suffix: stage2Key.token_suffix,
        key_fingerprint: stage2Key.key_fingerprint,
      },
      failover_events: combinedEvents,
      chunk_outcome: stage2Outcome,
    },
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

  // Unattended webhook callbacks are disabled: scraping runs strictly on-demand via admin/service calls.
  if (action === 'webhook_callback') {
    return jsonResp({
      ok: false,
      error: 'automated_webhooks_disabled',
      message: 'Unattended scraping webhooks are disabled. Trigger and poll Apify runs manually via Control Center.',
    }, 410, origin);
  }

  const auth = await verifyAdminOrService(req, adminClient, supabaseUrl, serviceKey);
  if (!auth.ok) return jsonResp({ ok: false, error: auth.error }, auth.status, origin);

  // ── 1. Provider Status & Multi-Key Pool Availability ──────────────────────
  if (action === 'get_provider_status') {
    const batchId = safeStr(body.batch_id)?.replace(/^#/, '') || null;
    const [{ data: providers, error: pErr }, { data: runsData }, pool] = await Promise.all([
      adminClient
        .from('scraping_providers')
        .select('provider_key, display_name, channel_type, is_default, enabled, config_json, updated_at')
        .order('is_default', { ascending: false })
        .order('provider_key', { ascending: true }),
      adminClient.rpc('pipeline_list_scrape_runs', { p_batch_id: batchId, p_limit: 20 }),
      resolveUnifiedKeyPool(adminClient),
    ]);

    if (pErr) return jsonResp({ ok: false, error: pErr.message }, 500, origin);
    const defaultProvider = (providers || []).find((p) => p.provider_key === 'apify' || p.is_default) || null;
    const parsedRuns = typeof runsData === 'string' ? JSON.parse(runsData) : runsData;

    return jsonResp({
      ok: true,
      execution_mode: 'on_demand_only',
      scheduled_scraping: false,
      default_provider: defaultProvider?.provider_key || 'apify',
      provider: defaultProvider,
      two_stage_default: `${DEFAULT_SEARCH_ACTOR_ID} -> ${DEFAULT_DETAIL_ACTOR_ID}`,
      actor_adapters: Object.values(APIFY_ACTOR_ADAPTERS).map((a) => ({
        key: a.key,
        actor_id: a.actorId,
        role: a.role,
        is_experimental: a.isExperimental,
        supports_two_stage_detail: a.supportsTwoStageDetail,
        supports_insights_toggle: a.supportsInsightsToggle,
      })),
      apify_token_configured: pool.usableKeys.length > 0,
      apify_token_count: pool.allKeys.length,
      apify_active_key_count: pool.usableKeys.length,
      key_pool: pool.allKeys.map((k) => toMaskedKey(k)),
      providers: providers || [],
      dual_channels: {
        on_demand_apify: 'apify-scrape-worker',
        manual_extensions: ['receive-pipeline-import (chrome + orion)', 'import-from-url'],
      },
      recent_runs: parsedRuns?.runs || [],
    }, 200, origin);
  }

  // ── 2. List Masked Apify Key Pool ─────────────────────────────────────────
  if (action === 'list_keys') {
    const pool = await resolveUnifiedKeyPool(adminClient);
    return jsonResp({
      ok: true,
      active_count: pool.usableKeys.length,
      total_count: pool.allKeys.length,
      keys: pool.allKeys.map((k) => toMaskedKey(k)),
    }, 200, origin);
  }

  // ── 3. List Scrape Runs ───────────────────────────────────────────────────
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

  // ── 3b. Inspect Existing Apify Run Input, Log Tail & Dataset Sample (0 Credits) ──
  if (action === 'inspect_run') {
    const pool = await resolveUnifiedKeyPool(adminClient);
    if (pool.allKeys.length === 0) {
      return jsonResp({ ok: false, error: 'apify_token_not_configured' }, 503, origin);
    }

    const scrapeRunId = safeInt(body.scrape_run_id);
    let providerRunId = safeStr(body.provider_run_id);
    let datasetId = safeStr(body.dataset_id);
    let preferredFp: string | null = null;

    if (scrapeRunId) {
      const { data: runRow, error: rErr } = await adminClient
        .schema('pipeline')
        .from('pipeline_scrape_runs')
        .select('id, provider_run_id, dataset_id, key_fingerprint, task_config_snapshot, meta_json')
        .eq('id', scrapeRunId)
        .maybeSingle();
      if (rErr) return jsonResp({ ok: false, error: rErr.message }, 500, origin);
      if (!runRow) return jsonResp({ ok: false, error: 'scrape_run_not_found' }, 404, origin);
      providerRunId = providerRunId || safeStr(runRow.provider_run_id);
      datasetId = datasetId || safeStr(runRow.dataset_id);
      preferredFp = safeStr(runRow.key_fingerprint);
    }

    let runMeta: Record<string, unknown> | null = null;
    let runInput: unknown = null;
    let logTail: string | null = null;
    let kvStoreId: string | null = null;

    if (providerRunId && SAFE_APIFY_ID_RE.test(providerRunId)) {
      const rRes = await fetchApifyWithFailover({
        adminClient,
        path: `/actor-runs/${providerRunId}`,
        keys: pool.allKeys,
        preferredFingerprint: preferredFp,
      });
      if (rRes.ok && rRes.data?.data) {
        const rd = rRes.data.data as Record<string, unknown>;
        runMeta = {
          id: rd.id,
          actId: rd.actId,
          status: rd.status,
          statusMessage: rd.statusMessage ?? null,
          defaultDatasetId: rd.defaultDatasetId ?? null,
          defaultKeyValueStoreId: rd.defaultKeyValueStoreId ?? null,
          usageTotalUsd: rd.usageTotalUsd ?? null,
          stats: rd.stats ?? null,
        };
        datasetId = datasetId || safeStr(rd.defaultDatasetId);
        kvStoreId = safeStr(rd.defaultKeyValueStoreId);
        if (rRes.usedKey?.key_fingerprint) preferredFp = rRes.usedKey.key_fingerprint;
      }

      const usedKeyObj = pool.allKeys.find((k) => k.key_fingerprint === preferredFp) || pool.usableKeys[0] || pool.allKeys[0];
      if (usedKeyObj?.token) {
        try {
          const logRes = await fetch(
            `https://api.apify.com/v2/actor-runs/${providerRunId}/log?stream=false`,
            { headers: { Authorization: `Bearer ${usedKeyObj.token}` }, signal: AbortSignal.timeout(8000) },
          );
          if (logRes.ok) {
            const fullLog = await logRes.text();
            logTail = fullLog.length > 8000 ? fullLog.slice(-8000) : fullLog;
          }
        } catch {
          // non-fatal
        }
        if (kvStoreId && SAFE_APIFY_ID_RE.test(kvStoreId)) {
          try {
            const inpRes = await fetch(
              `https://api.apify.com/v2/key-value-stores/${kvStoreId}/records/INPUT`,
              { headers: { Authorization: `Bearer ${usedKeyObj.token}` }, signal: AbortSignal.timeout(8000) },
            );
            if (inpRes.ok) runInput = await inpRes.json();
          } catch {
            // non-fatal
          }
        }
      }
    }

    let datasetItems: unknown[] = [];
    const sampleLimit = Math.min(Math.max(safeInt(body.limit) ?? 10, 1), 25);
    if (datasetId && SAFE_APIFY_ID_RE.test(datasetId)) {
      const dsRes = await fetchApifyWithFailover({
        adminClient,
        path: `/datasets/${datasetId}/items?offset=0&limit=${sampleLimit}&clean=false`,
        keys: pool.allKeys,
        preferredFingerprint: preferredFp,
      });
      if (dsRes.ok && Array.isArray(dsRes.data)) {
        datasetItems = dsRes.data;
      }
    }

    return jsonResp({
      ok: true,
      scrape_run_id: scrapeRunId,
      provider_run_id: providerRunId,
      dataset_id: datasetId,
      run_meta: runMeta,
      input: runInput,
      dataset_items: datasetItems,
      log_tail: logTail,
    }, 200, origin);
  }

  if (req.method !== 'POST') {
    return jsonResp({ ok: false, error: 'post_required' }, 405, origin);
  }

  // ── 4. Add & Live-Validate Apify API Key ──────────────────────────────────
  if (action === 'add_key') {
    const rawToken = safeStr(body.token) || safeStr(body.api_key) || '';
    if (!rawToken || rawToken.length < 12) {
      return jsonResp({ ok: false, error: 'valid_apify_token_required' }, 400, origin);
    }

    const validateLive = body.validate_live !== false;
    const priority = Math.min(Math.max(safeInt(body.priority) ?? 50, 1), 9999);
    const fp = await fingerprintApifyToken(rawToken);
    const suffix = maskApifyToken(rawToken);
    const customLabel = safeStr(body.label);

    let probe = null;
    if (validateLive) {
      probe = await probeApifyTokenLimits(rawToken);
      if (!probe.ok && probe.status === 'invalid') {
        return jsonResp({
          ok: false,
          error: 'invalid_apify_token',
          message: probe.error || 'Apify rejected this API key.',
        }, 400, origin);
      }
    }

    const encrypted = await encryptApifyToken(rawToken);
    const { data: existingCountRows } = await adminClient
      .schema('pipeline')
      .from('apify_api_keys')
      .select('id', { count: 'exact', head: true });
    const fallbackNum = ((existingCountRows as any)?.length || 0) + 1;
    const label = customLabel || (probe?.apify_username ? `Apify (${probe.apify_username})` : `Free Key #${fallbackNum}`);

    const { data: savedRow, error: upErr } = await adminClient
      .schema('pipeline')
      .from('apify_api_keys')
      .upsert(
        {
          label,
          key_fingerprint: fp,
          encrypted_token: encrypted,
          token_suffix: suffix,
          source: 'admin_pool',
          priority,
          enabled: true,
          status: probe ? probe.status : 'active',
          cooldown_until: null,
          monthly_reset_at: probe?.monthly_reset_at || null,
          usage_usd_cached: probe?.usage_usd ?? null,
          limit_usd_cached: probe?.limit_usd ?? null,
          apify_username: probe?.apify_username ?? null,
          last_error: probe?.error ?? null,
          last_error_code: probe && !probe.ok ? probe.status_code : null,
          last_checked_at: probe ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key_fingerprint' },
      )
      .select('id, label, key_fingerprint, token_suffix, source, priority, enabled, status, cooldown_until, monthly_reset_at, usage_usd_cached, limit_usd_cached, apify_username, last_error, last_error_code, runs_started, failover_count, last_used_at, last_checked_at')
      .single();

    if (upErr) return jsonResp({ ok: false, error: upErr.message }, 500, origin);

    const pool = await resolveUnifiedKeyPool(adminClient);
    return jsonResp({
      ok: true,
      key: savedRow,
      probe,
      active_count: pool.usableKeys.length,
      total_count: pool.allKeys.length,
    }, 200, origin);
  }

  // ── 5. Probe All Key Quotas Against Apify ─────────────────────────────────
  if (action === 'probe_keys') {
    const pool = await resolveUnifiedKeyPool(adminClient);
    const targetFingerprint = safeStr(body.key_fingerprint);
    const targets = targetFingerprint
      ? pool.allKeys.filter((k) => k.key_fingerprint === targetFingerprint)
      : pool.allKeys;

    await Promise.all(
      targets.map(async (k) => {
        if (!k.token) return;
        const probe = await probeApifyTokenLimits(k.token);
        const nextStatus = !k.enabled ? 'disabled' : probe.status;
        await adminClient
          .schema('pipeline')
          .from('apify_api_keys')
          .update({
            status: nextStatus,
            usage_usd_cached: probe.usage_usd,
            limit_usd_cached: probe.limit_usd,
            monthly_reset_at: probe.monthly_reset_at || k.monthly_reset_at,
            apify_username: probe.apify_username || k.apify_username,
            cooldown_until: nextStatus === 'active' ? null : k.cooldown_until,
            last_error: probe.error,
            last_error_code: probe.ok ? null : probe.status_code,
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('key_fingerprint', k.key_fingerprint);
      }),
    );

    const refreshed = await resolveUnifiedKeyPool(adminClient);
    return jsonResp({
      ok: true,
      active_count: refreshed.usableKeys.length,
      total_count: refreshed.allKeys.length,
      keys: refreshed.allKeys.map((k) => toMaskedKey(k)),
    }, 200, origin);
  }

  // ── 6. Update / Reset / Toggle Key ────────────────────────────────────────
  if (action === 'update_key') {
    const id = safeStr(body.id);
    const fp = safeStr(body.key_fingerprint);
    if (!id && !fp) {
      return jsonResp({ ok: false, error: 'key_id_or_fingerprint_required' }, 400, origin);
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.label === 'string' && body.label.trim()) patch.label = body.label.trim();
    if (body.priority !== undefined) {
      const p = safeInt(body.priority);
      if (p !== null) patch.priority = Math.min(Math.max(p, 1), 9999);
    }
    if (typeof body.enabled === 'boolean') {
      patch.enabled = body.enabled;
      if (!body.enabled) {
        patch.status = 'disabled';
      } else if (body.reset_status !== false) {
        patch.status = 'active';
        patch.cooldown_until = null;
        patch.last_error = null;
        patch.last_error_code = null;
      }
    }
    if (body.reset_status === true) {
      patch.enabled = true;
      patch.status = 'active';
      patch.cooldown_until = null;
      patch.last_error = null;
      patch.last_error_code = null;
    }

    let q = adminClient.schema('pipeline').from('apify_api_keys').update(patch);
    q = id ? q.eq('id', id) : q.eq('key_fingerprint', fp!);
    const { data: updated, error: uErr } = await q
      .select('id, label, key_fingerprint, token_suffix, source, priority, enabled, status, cooldown_until, monthly_reset_at, usage_usd_cached, limit_usd_cached, apify_username, last_error, last_error_code, runs_started, failover_count, last_used_at, last_checked_at')
      .maybeSingle();

    if (uErr) return jsonResp({ ok: false, error: uErr.message }, 500, origin);
    if (!updated) return jsonResp({ ok: false, error: 'key_not_found' }, 404, origin);

    const pool = await resolveUnifiedKeyPool(adminClient);
    return jsonResp({
      ok: true,
      key: updated,
      active_count: pool.usableKeys.length,
      total_count: pool.allKeys.length,
    }, 200, origin);
  }

  // ── 7. Delete Key ─────────────────────────────────────────────────────────
  if (action === 'delete_key') {
    const id = safeStr(body.id);
    const fp = safeStr(body.key_fingerprint);
    if (!id && !fp) {
      return jsonResp({ ok: false, error: 'key_id_or_fingerprint_required' }, 400, origin);
    }

    let findQ = adminClient.schema('pipeline').from('apify_api_keys').select('id, source, key_fingerprint');
    findQ = id ? findQ.eq('id', id) : findQ.eq('key_fingerprint', fp!);
    const { data: existing, error: fErr } = await findQ.maybeSingle();
    if (fErr) return jsonResp({ ok: false, error: fErr.message }, 500, origin);
    if (!existing) return jsonResp({ ok: false, error: 'key_not_found' }, 404, origin);

    if (existing.source === 'edge_secret') {
      // Disable rather than deleting so the next request doesn't auto-re-enable an Edge secret
      await adminClient
        .schema('pipeline')
        .from('apify_api_keys')
        .update({ enabled: false, status: 'disabled', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      const pool = await resolveUnifiedKeyPool(adminClient);
      return jsonResp({
        ok: true,
        disabled_edge_secret: true,
        message: 'Edge Secret key disabled in pool (remove from Supabase/GitHub secrets to delete permanently).',
        active_count: pool.usableKeys.length,
      }, 200, origin);
    }

    const { error: dErr } = await adminClient
      .schema('pipeline')
      .from('apify_api_keys')
      .delete()
      .eq('id', existing.id);
    if (dErr) return jsonResp({ ok: false, error: dErr.message }, 500, origin);

    const pool = await resolveUnifiedKeyPool(adminClient);
    return jsonResp({
      ok: true,
      deleted: true,
      active_count: pool.usableKeys.length,
      total_count: pool.allKeys.length,
    }, 200, origin);
  }

  // ── 8. Ingest Pre-Scraped / Dataset Items into Batch Staging ──────────────
  if (action === 'ingest_items') {
    const rawBatchId = safeStr(body.batch_id) || '';
    const resolved = await resolveBatchAndFolder(adminClient, rawBatchId);
    if (!resolved.ok) return jsonResp({ ok: false, error: resolved.error }, resolved.status, origin);

    if (!Array.isArray(body.items)) {
      return jsonResp({ ok: false, error: 'items_array_required' }, 400, origin);
    }

    const dryRun = body.dry_run === true;
    if (!dryRun) {
      const leaseCheck = await verifyBatchWorkerLease({
        adminClient,
        batchId: resolved.batch.id,
        req,
        body,
        isHumanAdmin: auth.isHumanAdmin,
      });
      if (!leaseCheck.ok) return jsonResp(leaseCheck.body, leaseCheck.status, origin);
    }

    const idempotencyKey = safeStr(body.idempotency_key);
    const actorId = safeStr(body.actor_id) || 'maxcopell/zillow-scraper';
    const providerRunId = safeStr(body.provider_run_id);
    const datasetId = safeStr(body.dataset_id);
    const providerKey = safeStr(body.provider_key) || 'apify';
    const bodyTaskCfg =
      body.task_config && typeof body.task_config === 'object' && !Array.isArray(body.task_config)
        ? (body.task_config as Record<string, unknown>)
        : {};
    const effectiveTaskConfig = normalizeTaskConfigAliases({
      ...resolved.batch.task_config,
      ...(typeof body.extraction_depth === 'string' && body.extraction_depth.trim()
        ? { extraction_depth: body.extraction_depth.trim() }
        : {}),
      ...(typeof body.include_property_insights === 'boolean'
        ? { include_property_insights: body.include_property_insights }
        : typeof body.include_insights === 'boolean'
        ? { include_property_insights: body.include_insights }
        : {}),
      ...bodyTaskCfg,
    });
    const targetQty = safeInt(body.target_qty ?? body.target_quantity ?? effectiveTaskConfig.target_qty);
    const ingestExtractionDepth = resolveExtractionDepth(effectiveTaskConfig);

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
      (Array.isArray(effectiveTaskConfig.locations)
        ? effectiveTaskConfig.locations.join(', ')
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
      taskConfig: effectiveTaskConfig,
      extractionDepth: ingestExtractionDepth,
      dryRun,
    });

    if (dryRun) {
      return jsonResp({
        ok: true,
        dry_run: true,
        batch_id: resolved.batch.id,
        folder_id: resolved.folderId,
        extraction_depth: ingestExtractionDepth,
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
        scrape_stage: (safeStr(body.scrape_stage) as ScrapeStage) || 'single',
        extraction_depth: resolveExtractionDepth(effectiveTaskConfig),
        adapter_key: APIFY_ACTOR_ADAPTERS[actorId]?.key || null,
        source: 'zillow',
        location: locationLabel,
        count_total: outcome.count_total,
        count_new: outcome.count_new,
        count_duplicate: outcome.count_duplicate,
        avg_score: outcome.avg_score,
        cursor_offset: outcome.count_total,
        raw_archive_prefix: outcome.raw_archive_prefix,
        task_config_snapshot: effectiveTaskConfig,
        idempotency_key: idempotencyKey,
        partial: outcome.count_failed > 0,
        error_message: outcome.errors.length ? JSON.stringify(outcome.errors.slice(0, 10)) : null,
        meta_json: JSON.stringify({
          folder_id: resolved.folderId,
          count_filtered_out: outcome.count_filtered_out,
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

  // ── 9. Start Live Apify Zillow Actor Run (with Instant Key Failover) ──────
  if (action === 'start_run') {
    const rawBatchId = safeStr(body.batch_id) || '';
    const resolved = await resolveBatchAndFolder(adminClient, rawBatchId);
    if (!resolved.ok) return jsonResp({ ok: false, error: resolved.error }, resolved.status, origin);

    const leaseCheck = await verifyBatchWorkerLease({
      adminClient,
      batchId: resolved.batch.id,
      req,
      body,
      isHumanAdmin: auth.isHumanAdmin,
    });
    if (!leaseCheck.ok) return jsonResp(leaseCheck.body, leaseCheck.status, origin);

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

    const pool = await resolveUnifiedKeyPool(adminClient);
    if (pool.allKeys.length === 0) {
      return jsonResp({
        ok: false,
        error: 'apify_token_not_configured',
        message: 'Add at least one Apify API key in Control Center or configure APIFY_API_TOKENS in Edge secrets.',
        batch_id: resolved.batch.id,
        provider: apifyProvider,
      }, 503, origin);
    }
    if (pool.usableKeys.length === 0) {
      return jsonResp({
        ok: false,
        error: 'all_apify_keys_exhausted',
        message: 'All configured Apify API keys are exhausted, rate-limited, or disabled. Add a new key or reset status in Control Center.',
        batch_id: resolved.batch.id,
        key_pool: pool.allKeys.map((k) => toMaskedKey(k)),
      }, 429, origin);
    }

    const providerCfg = (apifyProvider.config_json && typeof apifyProvider.config_json === 'object')
      ? (apifyProvider.config_json as Record<string, unknown>)
      : {};

    const bodyTaskCfg =
      body.task_config && typeof body.task_config === 'object' && !Array.isArray(body.task_config)
        ? (body.task_config as Record<string, unknown>)
        : {};
    const topLevelOverrides: Record<string, unknown> = {};
    if (Array.isArray(body.locations) && body.locations.length > 0) topLevelOverrides.locations = body.locations;
    else if (typeof body.location === 'string' && body.location.trim()) {
      topLevelOverrides.locations = [body.location.trim()];
    } else if (typeof body.locations === 'string' && body.locations.trim()) {
      topLevelOverrides.locations = [body.locations.trim()];
    }
    if (Array.isArray(body.search_urls) && body.search_urls.length > 0) topLevelOverrides.search_urls = body.search_urls;
    if (Array.isArray(body.detail_urls) && body.detail_urls.length > 0) topLevelOverrides.detail_urls = body.detail_urls;
    const qtyOverride = safeInt(body.target_qty ?? body.target_quantity ?? body.target ?? body.max_items);
    if (qtyOverride !== null && qtyOverride > 0) topLevelOverrides.target_qty = qtyOverride;
    const minRentOverride = safeInt(body.min_rent ?? body.rent_min);
    if (minRentOverride !== null && minRentOverride > 0) topLevelOverrides.min_rent = minRentOverride;
    const maxRentOverride = safeInt(body.max_rent ?? body.rent_max);
    if (maxRentOverride !== null && maxRentOverride > 0) topLevelOverrides.max_rent = maxRentOverride;
    if (body.exact_beds !== undefined || body.bedrooms_exact !== undefined) topLevelOverrides.exact_beds = body.exact_beds ?? body.bedrooms_exact;
    if (body.min_beds !== undefined || body.bedrooms_min !== undefined) topLevelOverrides.min_beds = body.min_beds ?? body.bedrooms_min;
    if (body.max_beds !== undefined || body.bedrooms_max !== undefined) topLevelOverrides.max_beds = body.max_beds ?? body.bedrooms_max;
    if (body.exact_baths !== undefined || body.bathrooms_exact !== undefined) topLevelOverrides.exact_baths = body.exact_baths ?? body.bathrooms_exact;
    if (body.min_baths !== undefined || body.bathrooms_min !== undefined) topLevelOverrides.min_baths = body.min_baths ?? body.bathrooms_min;
    if (body.max_baths !== undefined || body.bathrooms_max !== undefined) topLevelOverrides.max_baths = body.max_baths ?? body.bathrooms_max;
    if (Array.isArray(body.property_types) && body.property_types.length > 0) topLevelOverrides.property_types = body.property_types;
    else if (typeof body.property_type === 'string' && body.property_type.trim()) topLevelOverrides.property_types = [body.property_type.trim()];
    if (typeof body.owner_only === 'boolean') topLevelOverrides.owner_only = body.owner_only;
    if (Array.isArray(body.required_features)) topLevelOverrides.required_features = body.required_features;
    if (Array.isArray(body.preferred_features)) topLevelOverrides.preferred_features = body.preferred_features;
    if (typeof body.extraction_depth === 'string' && body.extraction_depth.trim()) topLevelOverrides.extraction_depth = body.extraction_depth.trim();
    if (typeof body.include_property_insights === 'boolean') topLevelOverrides.include_property_insights = body.include_property_insights;
    else if (typeof body.include_insights === 'boolean') topLevelOverrides.include_property_insights = body.include_insights;
    if (typeof body.two_stage_details === 'boolean') topLevelOverrides.two_stage_details = body.two_stage_details;
    if (typeof body.allow_experimental_actor === 'boolean') topLevelOverrides.allow_experimental_actor = body.allow_experimental_actor;
    if (body.search_radius_miles !== undefined) topLevelOverrides.search_radius_miles = body.search_radius_miles;

    const taskConfig: Record<string, unknown> = normalizeTaskConfigAliases({
      ...resolved.batch.task_config,
      ...topLevelOverrides,
      ...bodyTaskCfg,
    });

    const allowExperimentalActor =
      body.allow_experimental_actor === true ||
      taskConfig.allow_experimental_actor === true ||
      providerCfg.allow_experimental_actor === true;

    const selection = resolveActorAdapterSelection({
      requestedActorId: safeStr(body.actor_id),
      taskConfig,
      providerConfig: providerCfg,
      allowExperimentalActor,
      twoStageDetailsOverride: typeof body.two_stage_details === 'boolean' ? body.two_stage_details : null,
    });

    if (!selection.ok || !selection.adapter || !selection.actorId || !selection.actorSlug) {
      return jsonResp({
        ok: false,
        error: selection.error || 'invalid_actor_selection',
        message: selection.message,
      }, selection.status || 400, origin);
    }

    const actorId = selection.actorId;
    const actorSlug = selection.actorSlug;
    const scrapeStage = selection.scrapeStage || 'single';
    const extractionDepth = selection.extractionDepth || 'full_data';

    const resolvedBoundsByLocation = await resolveBoundsMapForLocations(taskConfig, {
      geoapifyApiKey: Deno.env.get('GEOAPIFY_API_KEY') || null,
    });

    const actorInput = buildApifyActorInput(taskConfig, providerCfg, {
      actorId,
      stage: scrapeStage,
      extractionDepth,
      searchResultsDatasetId: safeStr(body.search_results_dataset_id),
      resolvedBoundsByLocation,
      detailUrls: Array.isArray(taskConfig.detail_urls)
        ? taskConfig.detail_urls.map(safeStr).filter((x): x is string => Boolean(x))
        : undefined,
    });

    const inputValidation = selection.adapter.validateInput(actorInput);
    if (!inputValidation.ok) {
      return jsonResp({
        ok: false,
        error: inputValidation.error || 'invalid_actor_input',
        message: inputValidation.message,
      }, 400, origin);
    }

    const waitForFinish = Math.min(Math.max(safeInt(body.wait_for_finish) ?? 12, 0), 30);
    const preferredFingerprint = safeStr(body.preferred_key_fingerprint);
    const startRes = await fetchApifyWithFailover({
      adminClient,
      path: `/acts/${encodeURIComponent(actorSlug)}/runs?waitForFinish=${waitForFinish}`,
      keys: pool.allKeys,
      preferredFingerprint,
      selectionSeed: resolved.batch.id,
      method: 'POST',
      body: actorInput,
      recordUseOnSuccess: true,
    });

    if (!startRes.ok || !startRes.usedKey) {
      return jsonResp({
        ok: false,
        error: 'apify_start_failed',
        details: startRes.error,
        failover_events: startRes.failoverEvents,
      }, startRes.status >= 400 ? startRes.status : 502, origin);
    }

    const usedKey = startRes.usedKey;
    await claimKeySlot(adminClient, usedKey.key_fingerprint);

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
        status: 'running',
        scrape_stage: scrapeStage,
        extraction_depth: extractionDepth,
        adapter_key: selection.adapter.key,
        source: 'zillow',
        location: locationLabel,
        cursor_offset: 0,
        raw_archive_prefix: `batches/${resolved.batch.id}/apify/${providerRunId || Date.now()}`,
        task_config_snapshot: taskConfig,
        idempotency_key: idempotencyKey,
        key_fingerprint: usedKey.key_fingerprint,
        key_label: formatKeyLabel(usedKey),
        continuation_depth: 0,
        failover_events: startRes.failoverEvents,
        meta_json: JSON.stringify({
          apify_status: apifyStatus,
          folder_id: resolved.folderId,
          used_key_suffix: usedKey.token_suffix,
          two_stage_enabled: Boolean(selection.twoStageEnabled),
          detail_actor_id: selection.detailActorId || null,
        }),
      })
      .select('*')
      .single();

    if (insErr) {
      await releaseKeySlot(adminClient, usedKey.key_fingerprint);
      return jsonResp({ ok: false, error: insErr.message }, 500, origin);
    }

    let chunkOutcome: IngestOutcome | null = null;
    let hasMore = apifyStatus !== 'SUCCEEDED';

    if (apifyStatus === 'SUCCEEDED' && datasetId && SAFE_APIFY_ID_RE.test(datasetId)) {
      if (selection.twoStageEnabled && scrapeStage === 'search') {
        const s1Pages = await fetchFullDatasetPages({
          adminClient,
          keys: pool.allKeys,
          datasetId,
          startOffset: 0,
          maxTotalItems: 1000,
          preferredFingerprint: usedKey.key_fingerprint,
        });
        if (!s1Pages.ok) {
          await releaseKeySlot(adminClient, usedKey.key_fingerprint);
          return jsonResp({
            ok: false,
            error: 'apify_stage1_dataset_fetch_failed',
            details: s1Pages.error,
            scrape_run_id: runRow.id,
            failover_events: [...startRes.failoverEvents, ...s1Pages.failoverEvents],
          }, 502, origin);
        }

        const stage2Res = await dispatchTwoStageDetailRun(adminClient, {
          stage1RunRow: runRow,
          stage1Items: s1Pages.items,
          stage1FetchedCount: s1Pages.fetchedCount,
          stage1StartOffset: 0,
          batch: resolved.batch,
          folderId: resolved.folderId,
          locationLabel,
          taskConfig,
          providerCfg,
          detailActorId: selection.detailActorId || DEFAULT_DETAIL_ACTOR_ID,
          extractionDepth,
          waitForFinish: Math.min(waitForFinish, 12),
          priorFailoverEvents: [...startRes.failoverEvents, ...s1Pages.failoverEvents],
        });
        return jsonResp(stage2Res.body, stage2Res.status, origin);
      }

      const scanMax = Math.min(Math.max(safeInt(body.chunk_limit) ?? 500, 1), 1000);
      const dsPages = await fetchFullDatasetPages({
        adminClient,
        keys: pool.allKeys,
        datasetId,
        startOffset: 0,
        maxTotalItems: scanMax,
        preferredFingerprint: usedKey.key_fingerprint,
      });
      if (dsPages.ok) {
        const targetQty = safeInt(taskConfig.target_qty);
        chunkOutcome = await ingestApifyItemsToBatch(adminClient, {
          batchId: resolved.batch.id,
          batchUuid: resolved.batch.batch_uuid,
          folderId: resolved.folderId,
          items: dsPages.items,
          actorId,
          runId: providerRunId,
          datasetId,
          providerKey: 'apify',
          targetQty,
          taskConfig,
          extractionDepth,
        });
        hasMore = dsPages.hasMore;
        await adminClient
          .schema('pipeline')
          .from('pipeline_scrape_runs')
          .update({
            cursor_offset: dsPages.fetchedCount,
            count_total: chunkOutcome.count_total,
            count_new: chunkOutcome.count_new,
            count_duplicate: chunkOutcome.count_duplicate,
            avg_score: chunkOutcome.avg_score,
            status: hasMore ? 'running' : (chunkOutcome.count_failed > 0 ? 'partial' : 'succeeded'),
            partial: chunkOutcome.count_failed > 0,
            completed_at: hasMore ? null : new Date().toISOString(),
          })
          .eq('id', runRow.id);
        if (!hasMore) {
          await releaseKeySlot(adminClient, usedKey.key_fingerprint);
        }
      }
    } else if (apifyStatus === 'FAILED' || apifyStatus === 'ABORTED' || apifyStatus === 'TIMED-OUT') {
      await releaseKeySlot(adminClient, usedKey.key_fingerprint);
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
      scrape_stage: scrapeStage,
      extraction_depth: extractionDepth,
      adapter_key: selection.adapter.key,
      used_key: {
        label: usedKey.label,
        token_suffix: usedKey.token_suffix,
        key_fingerprint: usedKey.key_fingerprint,
      },
      failover_events: startRes.failoverEvents,
      chunk_outcome: chunkOutcome,
    }, 200, origin);
  }

  // ── 10. Poll Apify Run, Ingest Next Chunk & Handoff Mid-Run Quota Failures ─
  if (action === 'poll_and_ingest') {
    const pool = await resolveUnifiedKeyPool(adminClient);
    if (pool.allKeys.length === 0) {
      return jsonResp({
        ok: false,
        error: 'apify_token_not_configured',
        message: 'Configure at least one Apify API key to poll Apify datasets.',
      }, 503, origin);
    }

    const scrapeRunId = safeInt(body.scrape_run_id);
    const webhookRunId = safeStr(
      (body.resource as Record<string, unknown> | undefined)?.id ??
        (body.eventData as Record<string, unknown> | undefined)?.actorRunId ??
        body.provider_run_id ??
        body.run_id,
    );

    let runQuery = adminClient.schema('pipeline').from('pipeline_scrape_runs').select('*');
    if (scrapeRunId) runQuery = runQuery.eq('id', scrapeRunId);
    else if (webhookRunId) runQuery = runQuery.eq('provider_run_id', webhookRunId);
    else return jsonResp({ ok: false, error: 'scrape_run_id_or_provider_run_id_required' }, 400, origin);

    const { data: runRow, error: rErr } = await runQuery.limit(1).maybeSingle();
    if (rErr) return jsonResp({ ok: false, error: rErr.message }, 500, origin);
    if (!runRow) return jsonResp({ ok: false, error: 'scrape_run_not_found' }, 404, origin);

    const leaseBatchId = runRow.batch_id || safeStr(body.batch_id);
    if (leaseBatchId) {
      const leaseCheck = await verifyBatchWorkerLease({
        adminClient,
        batchId: leaseBatchId,
        req,
        body,
        isHumanAdmin: auth.isHumanAdmin,
      });
      if (!leaseCheck.ok) return jsonResp(leaseCheck.body, leaseCheck.status, origin);
    }

    const providerRunId = safeStr(runRow.provider_run_id);
    if (!providerRunId || !SAFE_APIFY_ID_RE.test(providerRunId)) {
      return jsonResp({ ok: false, error: 'invalid_provider_run_id' }, 400, origin);
    }

    const runStatusRes = await fetchApifyWithFailover({
      adminClient,
      path: `/actor-runs/${providerRunId}`,
      keys: pool.allKeys,
      preferredFingerprint: runRow.key_fingerprint || null,
    });
    if (!runStatusRes.ok) {
      return jsonResp({
        ok: false,
        error: 'apify_poll_failed',
        details: runStatusRes.error,
        failover_events: runStatusRes.failoverEvents,
      }, 502, origin);
    }

    const apifyRun = runStatusRes.data?.data || {};
    const apifyStatus = String(apifyRun.status || 'RUNNING').toUpperCase();
    const datasetId = safeStr(apifyRun.defaultDatasetId) || safeStr(runRow.dataset_id);

    // Handle mid-run failure / abort (check for partial items + auto-handoff to next key)
    if (apifyStatus === 'FAILED' || apifyStatus === 'ABORTED' || apifyStatus === 'TIMED-OUT') {
      await releaseKeySlot(adminClient, runRow.key_fingerprint);

      const resolved = runRow.batch_id
        ? await resolveBatchAndFolder(adminClient, String(runRow.batch_id))
        : null;

      // 1. Salvage any partial dataset items already scraped before Apify stopped
      let partialOutcome: IngestOutcome | null = null;
      const offset = Number(runRow.cursor_offset || 0);
      if (resolved && resolved.ok && datasetId && SAFE_APIFY_ID_RE.test(datasetId)) {
        const dsPartialPages = await fetchFullDatasetPages({
          adminClient,
          keys: pool.allKeys,
          datasetId,
          startOffset: offset,
          maxTotalItems: 500,
          preferredFingerprint: runRow.key_fingerprint || null,
        });
        if (dsPartialPages.ok && dsPartialPages.items.length > 0) {
          const snapshotCfg = normalizeTaskConfigAliases(
            runRow.task_config_snapshot && typeof runRow.task_config_snapshot === 'object'
              ? { ...resolved.batch.task_config, ...(runRow.task_config_snapshot as Record<string, unknown>) }
              : resolved.batch.task_config,
          );
          partialOutcome = await ingestApifyItemsToBatch(adminClient, {
            batchId: resolved.batch.id,
            batchUuid: resolved.batch.batch_uuid,
            folderId: resolved.folderId,
            items: dsPartialPages.items,
            actorId: runRow.actor_id,
            runId: providerRunId,
            datasetId,
            providerKey: runRow.provider_key || 'apify',
            targetQty: safeInt(snapshotCfg?.target_qty),
            taskConfig: snapshotCfg,
            extractionDepth: (safeStr(runRow.extraction_depth) as ExtractionDepth) || resolveExtractionDepth(snapshotCfg),
          });
        }
      }

      const quotaCheck = isApifyRunQuotaFailure(apifyRun);
      const existingEvents: FailoverEvent[] = Array.isArray(runRow.failover_events)
        ? (runRow.failover_events as FailoverEvent[])
        : [];
      const newFailoverEvents: FailoverEvent[] = [...existingEvents, ...runStatusRes.failoverEvents];

      const boundKey = pool.allKeys.find((k) => k.key_fingerprint === runRow.key_fingerprint) || null;
      if (boundKey && (quotaCheck.isQuotaFailure || apifyStatus === 'ABORTED')) {
        await markKeyState(
          adminClient,
          boundKey,
          quotaCheck.kind === 'rate_limited' ? 'rate_limited' : 'exhausted',
          {
            errorCode: 402,
            error: quotaCheck.reason,
            cooldownSeconds: quotaCheck.kind === 'rate_limited' ? 90 : null,
            incrementFailover: true,
          },
        );
        newFailoverEvents.push({
          from_fingerprint: boundKey.key_fingerprint,
          from_suffix: boundKey.token_suffix,
          from_label: boundKey.label,
          reason: `Mid-run ${apifyStatus}: ${quotaCheck.reason}`,
          kind: quotaCheck.kind,
          status_code: 402,
          at: new Date().toISOString(),
        });
      }

      const totalCount = Number(runRow.count_total || 0) + (partialOutcome?.count_total || 0);
      const newCount = Number(runRow.count_new || 0) + (partialOutcome?.count_new || 0);
      const dupCount = Number(runRow.count_duplicate || 0) + (partialOutcome?.count_duplicate || 0);

      // 2. Attempt automatic continuation handoff to next healthy key
      const currentDepth = Number(runRow.continuation_depth || 0);
      let continuationRun: any = null;
      let continuationUsedKey: ResolvedApifyKey | null = null;

      if (
        resolved &&
        resolved.ok &&
        (quotaCheck.isQuotaFailure || apifyStatus === 'ABORTED' || apifyStatus === 'TIMED-OUT') &&
        currentDepth < MAX_CONTINUATION_DEPTH
      ) {
        const refreshedPool = await resolveUnifiedKeyPool(adminClient);
        const remainingKeys = refreshedPool.usableKeys.filter(
          (k) => k.key_fingerprint !== runRow.key_fingerprint,
        );

        if (remainingKeys.length > 0) {
          const { count: stagedCount } = await adminClient
            .schema('pipeline')
            .from('pipeline_properties')
            .select('id', { count: 'exact', head: true })
            .eq('batch_id', resolved.batch.id);

          const taskCfg = normalizeTaskConfigAliases(
            runRow.task_config_snapshot && typeof runRow.task_config_snapshot === 'object'
              ? { ...(runRow.task_config_snapshot as Record<string, unknown>) }
              : { ...resolved.batch.task_config },
          );
          const originalTarget = safeInt(taskCfg.target_qty);
          const alreadyStaged = stagedCount || 0;
          const remainingQty = originalTarget && originalTarget > 0
            ? Math.max(originalTarget - alreadyStaged, 0)
            : null;

          if (remainingQty === null || remainingQty > 0) {
            if (remainingQty !== null) taskCfg.target_qty = remainingQty;
            const { data: apifyProvider } = await adminClient
              .from('scraping_providers')
              .select('config_json')
              .eq('provider_key', 'apify')
              .maybeSingle();
            const providerCfg = (apifyProvider?.config_json && typeof apifyProvider.config_json === 'object')
              ? (apifyProvider.config_json as Record<string, unknown>)
              : {};
            const contAllowExp =
              taskCfg.allow_experimental_actor === true ||
              providerCfg.allow_experimental_actor === true;
            const contSel = resolveActorAdapterSelection({
              requestedActorId: safeStr(runRow.actor_id),
              taskConfig: taskCfg,
              providerConfig: providerCfg,
              allowExperimentalActor: contAllowExp,
              twoStageDetailsOverride: runRow.scrape_stage === 'search' ? true : (runRow.scrape_stage === 'single' ? false : null),
            });

            if (contSel.ok && contSel.adapter && contSel.actorId && contSel.actorSlug) {
              const contStage = (safeStr(runRow.scrape_stage) as ScrapeStage) || contSel.scrapeStage || 'single';
              const contDepth = (safeStr(runRow.extraction_depth) as ExtractionDepth) || contSel.extractionDepth || 'full_data';
              const contBoundsByLocation = await resolveBoundsMapForLocations(taskCfg, {
                geoapifyApiKey: Deno.env.get('GEOAPIFY_API_KEY') || null,
              });
              const contInput = buildApifyActorInput(taskCfg, providerCfg, {
                actorId: contSel.actorId,
                stage: contStage,
                extractionDepth: contDepth,
                resolvedBoundsByLocation: contBoundsByLocation,
                detailUrls: Array.isArray(taskCfg.detail_urls)
                  ? taskCfg.detail_urls.map(safeStr).filter((x): x is string => Boolean(x))
                  : undefined,
              });
              const contValidation = contSel.adapter.validateInput(contInput);

              if (contValidation.ok) {
                const contStart = await fetchApifyWithFailover({
                  adminClient,
                  path: `/acts/${encodeURIComponent(contSel.actorSlug)}/runs?waitForFinish=8`,
                  keys: remainingKeys,
                  selectionSeed: resolved.batch.id,
                  method: 'POST',
                  body: contInput,
                  recordUseOnSuccess: true,
                });

                if (contStart.ok && contStart.usedKey) {
                  continuationUsedKey = contStart.usedKey;
                  await claimKeySlot(adminClient, contStart.usedKey.key_fingerprint);
                  const contApifyRun = contStart.data?.data || {};
                  const contRunId = safeStr(contApifyRun.id);
                  const contDatasetId = safeStr(contApifyRun.defaultDatasetId);
                  const { data: contRow } = await adminClient
                    .schema('pipeline')
                    .from('pipeline_scrape_runs')
                    .insert({
                      batch_id: resolved.batch.id,
                      batch_uuid: resolved.batch.batch_uuid,
                      provider_key: 'apify',
                      actor_id: contSel.actorId,
                      provider_run_id: contRunId,
                      dataset_id: contDatasetId,
                      status: 'running',
                      scrape_stage: contStage,
                      extraction_depth: contDepth,
                      adapter_key: safeStr(runRow.adapter_key) || contSel.adapter.key,
                      source: 'zillow',
                      location: runRow.location || resolved.batch.target_market || 'Zillow Search',
                      cursor_offset: 0,
                      raw_archive_prefix: `batches/${resolved.batch.id}/apify/${contRunId || Date.now()}`,
                      task_config_snapshot: taskCfg,
                      key_fingerprint: contStart.usedKey.key_fingerprint,
                      key_label: formatKeyLabel(contStart.usedKey),
                      parent_scrape_run_id: runRow.id,
                      continuation_depth: currentDepth + 1,
                      failover_events: [...newFailoverEvents, ...contStart.failoverEvents],
                      meta_json: JSON.stringify({
                        apify_status: String(contApifyRun.status || 'RUNNING').toUpperCase(),
                        folder_id: resolved.folderId,
                        continued_from_run_id: runRow.id,
                      }),
                    })
                    .select('*')
                    .single();
                  continuationRun = contRow;
                }
              }
            }
          }
        }
      }

      const prevMeta = (() => {
        try {
          return runRow.meta_json ? JSON.parse(String(runRow.meta_json)) : {};
        } catch {
          return {};
        }
      })();

      await adminClient
        .schema('pipeline')
        .from('pipeline_scrape_runs')
        .update({
          status: partialOutcome && partialOutcome.count_new > 0
            ? 'partial'
            : (apifyStatus === 'ABORTED' ? 'cancelled' : 'failed'),
          count_total: totalCount,
          count_new: newCount,
          count_duplicate: dupCount,
          error_message: `Apify actor run ${apifyStatus}: ${quotaCheck.reason}`,
          failover_events: newFailoverEvents,
          meta_json: JSON.stringify({
            ...prevMeta,
            apify_status: apifyStatus,
            handed_off_to_scrape_run_id: continuationRun?.id || null,
          }),
          completed_at: new Date().toISOString(),
        })
        .eq('id', runRow.id);

      if (continuationRun && continuationUsedKey) {
        return jsonResp({
          ok: true,
          auto_handed_off: true,
          previous_scrape_run_id: runRow.id,
          apify_status: apifyStatus,
          partial_outcome: partialOutcome,
          continuation_run: continuationRun,
          used_key: {
            label: continuationUsedKey.label,
            token_suffix: continuationUsedKey.token_suffix,
            key_fingerprint: continuationUsedKey.key_fingerprint,
          },
          failover_events: newFailoverEvents,
          message: `Previous key hit limit mid-run (${apifyStatus}). Automatically continued on ${formatKeyLabel(continuationUsedKey)}.`,
        }, 200, origin);
      }

      return jsonResp({
        ok: false,
        error: 'apify_run_failed',
        apify_status: apifyStatus,
        reason: quotaCheck.reason,
        scrape_run_id: runRow.id,
        partial_outcome: partialOutcome,
        failover_events: newFailoverEvents,
      }, 200, origin);
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
      await releaseKeySlot(adminClient, runRow.key_fingerprint);
      return jsonResp({ ok: false, error: 'missing_valid_dataset_id' }, 400, origin);
    }

    const offset = Number(runRow.cursor_offset || 0);
    const scanMax =
      runRow.scrape_stage === 'search'
        ? 1000
        : Math.min(Math.max(safeInt(body.chunk_limit) ?? 500, 1), 1000);
    const dsPages = await fetchFullDatasetPages({
      adminClient,
      keys: pool.allKeys,
      datasetId,
      startOffset: offset,
      maxTotalItems: scanMax,
      preferredFingerprint: runRow.key_fingerprint || null,
    });
    if (!dsPages.ok) {
      return jsonResp({
        ok: false,
        error: 'apify_dataset_fetch_failed',
        details: dsPages.error,
        failover_events: dsPages.failoverEvents,
      }, 502, origin);
    }

    const resolved = await resolveBatchAndFolder(adminClient, String(runRow.batch_id || ''));
    if (!resolved.ok) return jsonResp({ ok: false, error: resolved.error }, resolved.status, origin);

    const snapshotCfg = normalizeTaskConfigAliases(
      runRow.task_config_snapshot && typeof runRow.task_config_snapshot === 'object'
        ? { ...resolved.batch.task_config, ...(runRow.task_config_snapshot as Record<string, unknown>) }
        : resolved.batch.task_config,
    );

    const mergedPollEvents = [
      ...(Array.isArray(runRow.failover_events) ? (runRow.failover_events as FailoverEvent[]) : []),
      ...runStatusRes.failoverEvents,
      ...dsPages.failoverEvents,
    ];

    if (runRow.scrape_stage === 'search') {
      // Idempotency guard: if Stage 1 already transitioned to a child Stage 2 detail run,
      // point the caller directly at that Stage 2 run instead of re-triaging offset > 0.
      const { data: existingChildStage2 } = await adminClient
        .schema('pipeline')
        .from('pipeline_scrape_runs')
        .select('*')
        .eq('parent_scrape_run_id', runRow.id)
        .eq('scrape_stage', 'detail')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingChildStage2 && dsPages.items.length === 0) {
        return jsonResp({
          ok: true,
          batch_id: resolved.batch.id,
          two_stage_transition: true,
          stage2_started: true,
          stage1_scrape_run_id: runRow.id,
          scrape_run_id: existingChildStage2.id,
          scrape_stage: 'detail',
          stage2_run: existingChildStage2,
          continuation_run: existingChildStage2,
          apify_run_id: existingChildStage2.provider_run_id,
          dataset_id: existingChildStage2.dataset_id,
          has_more: existingChildStage2.status === 'running',
          failover_events: mergedPollEvents,
          message: 'Stage-1 already transitioned to Stage-2 detail run; polling Stage-2 detail run.',
        }, 200, origin);
      }

      const { data: apifyProvider } = await adminClient
        .from('scraping_providers')
        .select('config_json')
        .eq('provider_key', 'apify')
        .maybeSingle();
      const providerCfg = (apifyProvider?.config_json && typeof apifyProvider.config_json === 'object')
        ? (apifyProvider.config_json as Record<string, unknown>)
        : {};
      const runMeta = (() => {
        try {
          return runRow.meta_json ? JSON.parse(String(runRow.meta_json)) : {};
        } catch {
          return {};
        }
      })();
      const detailActorId =
        safeStr(runMeta?.detail_actor_id) ||
        safeStr(providerCfg.detail_actor_id) ||
        DEFAULT_DETAIL_ACTOR_ID;
      const extractionDepth =
        (safeStr(runRow.extraction_depth) as ExtractionDepth) ||
        resolveExtractionDepth(snapshotCfg, providerCfg);

      const stage2Res = await dispatchTwoStageDetailRun(adminClient, {
        stage1RunRow: runRow,
        stage1Items: dsPages.items,
        stage1FetchedCount: dsPages.fetchedCount,
        stage1StartOffset: offset,
        batch: resolved.batch,
        folderId: resolved.folderId,
        locationLabel: runRow.location || resolved.batch.target_market || 'Zillow Search',
        taskConfig: snapshotCfg,
        providerCfg,
        detailActorId,
        extractionDepth,
        waitForFinish: 8,
        priorFailoverEvents: mergedPollEvents,
      });
      return jsonResp(stage2Res.body, stage2Res.status, origin);
    }

    const chunkOutcome = await ingestApifyItemsToBatch(adminClient, {
      batchId: resolved.batch.id,
      batchUuid: resolved.batch.batch_uuid,
      folderId: resolved.folderId,
      items: dsPages.items,
      actorId: runRow.actor_id,
      runId: providerRunId,
      datasetId,
      providerKey: runRow.provider_key || 'apify',
      targetQty: safeInt(snapshotCfg?.target_qty),
      taskConfig: snapshotCfg,
      extractionDepth: (safeStr(runRow.extraction_depth) as ExtractionDepth) || resolveExtractionDepth(snapshotCfg),
    });

    const newOffset = offset + dsPages.fetchedCount;
    const hasMore = dsPages.hasMore;
    const totalCount = Number(runRow.count_total || 0) + chunkOutcome.count_total;
    const newCount = Number(runRow.count_new || 0) + chunkOutcome.count_new;
    const dupCount = Number(runRow.count_duplicate || 0) + chunkOutcome.count_duplicate;
    const hasPartial = Boolean(runRow.partial) || chunkOutcome.count_failed > 0;
    const mergedEvents = [
      ...(Array.isArray(runRow.failover_events) ? runRow.failover_events : []),
      ...runStatusRes.failoverEvents,
      ...dsPages.failoverEvents,
    ];

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
        failover_events: mergedEvents,
        completed_at: hasMore ? null : new Date().toISOString(),
      })
      .eq('id', runRow.id);

    if (!hasMore) {
      await releaseKeySlot(adminClient, runRow.key_fingerprint);
    }

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
      failover_events: mergedEvents,
    }, 200, origin);
  }

  return jsonResp({ ok: false, error: 'invalid_action' }, 400, origin);
});
