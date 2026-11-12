#!/usr/bin/env node
/**
 * Choice Properties — Universal Stateless Publishing Engine
 * ============================================================================
 * Supports both workflows via ephemeral CLI flags (never stored in codebase):
 *   Workflow A: --workflow pipeline_publish (default)
 *   Workflow B: --workflow scrape_and_publish
 *
 * Execution Lifecycle:
 *   1. Parse temporary CLI arguments & generate unique Batch ID (PB-YYYYMMDD-XXXX)
 *   2. Workflow B only: execute approved scraper & stage into pipeline_properties
 *   3. Pre-flight check & deduplication against active pipeline + live properties
 *   4. Enrich & validate Choice invariants ($50 fee, 1x deposit, decimal baths, clean prose)
 *   5. Publish to public.properties + public.property_photos (direct CDN URLs, strict order)
 *   6. Generate & live-verify single master magic link (for private_placement)
 *   7. Record lightweight publishing history (public.publishing_batches + properties)
 *   8. Stage 1 Verified Cleanup: archive processed rows -> pipeline.pipeline_recovery_archive
 *      (24-hour window), remove ONLY verified rows from pipeline.pipeline_properties,
 *      move matching raw payload blobs to recovery/<batch_id>/
 *   9. Post-cleanup verification probe
 * ============================================================================
 */

import crypto from 'crypto';
import { execFileSync } from 'child_process';
import {
  SUPABASE_URL,
  SITE_URL,
  publicHeaders,
  pipelineHeaders,
  fetchJson,
  callRpc,
  generateBatchId,
  listRawPayloadObjects,
  moveRawPayloadToRecovery,
  checkSchemaDeployed,
} from './supabase-client.mjs';
import { enrichPipelineProperty } from './enrichment.mjs';
import { parseMarketTarget } from './preflight-audit.mjs';

function parseCliArgs(argv) {
  const opts = {
    market: '',
    workflow: 'pipeline_publish',
    visibility: 'private_placement',
    count: 50,
    beds: null,
    bathsMin: null,
    bathsMax: null,
    maxRent: null,
    ids: [],
    importUrls: [],
    scrapeSource: 'realtor',
    dryRun: false,
    allowRepublish: false,
    skipCleanup: false,
    retryBatch: '',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--market' && argv[i + 1]) opts.market = argv[++i];
    else if (arg === '--workflow' && argv[i + 1]) opts.workflow = argv[++i];
    else if ((arg === '--visibility' || arg === '--status') && argv[i + 1]) opts.visibility = argv[++i];
    else if (arg === '--count' && argv[i + 1]) opts.count = parseInt(argv[++i], 10);
    else if (arg === '--beds' && argv[i + 1]) opts.beds = parseInt(argv[++i], 10);
    else if (arg === '--baths-min' && argv[i + 1]) opts.bathsMin = parseFloat(argv[++i]);
    else if (arg === '--baths-max' && argv[i + 1]) opts.bathsMax = parseFloat(argv[++i]);
    else if (arg === '--max-rent' && argv[i + 1]) opts.maxRent = parseFloat(argv[++i]);
    else if (arg === '--ids' && argv[i + 1]) opts.ids = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--import-urls' && argv[i + 1]) opts.importUrls = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--scrape-source' && argv[i + 1]) opts.scrapeSource = argv[++i];
    else if (arg === '--retry-batch' && argv[i + 1]) opts.retryBatch = argv[++i].trim();
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--allow-republish') opts.allowRepublish = true;
    else if (arg === '--skip-cleanup') opts.skipCleanup = true;
  }

  return opts;
}

async function runWorkflowBScrape(opts) {
  if (!opts.market && opts.importUrls.length === 0) {
    throw new Error('Workflow scrape_and_publish requires --market "<City, State>" or --import-urls');
  }

  // Path 1: Import explicit URLs through approved import-from-url Edge Function
  if (opts.importUrls.length > 0) {
    console.log(`[Workflow B] Importing ${opts.importUrls.length} URL(s) via import-from-url...`);
    const importSecret = process.env.IMPORT_SECRET || process.env.SHORTCUT_IMPORT_SECRET || '';
    const stagedIds = [];
    for (const url of opts.importUrls) {
      const res = await fetchJson(`${SUPABASE_URL}/functions/v1/import-from-url`, {
        method: 'POST',
        headers: {
          ...publicHeaders(),
          ...(importSecret ? { 'x-import-secret': importSecret } : {}),
        },
        body: { url },
      });
      if (res?.id) stagedIds.push(res.id);
    }
    return stagedIds;
  }

  // Path 2: Invoke approved Python scraper (scraper/scraper.py) — stages by default unless --publish is passed
  console.log(`[Workflow B] Running approved scraper for "${opts.market}" (limit: ${opts.count})...`);
  const scraperArgs = [
    'scraper/scraper.py',
    '--location', opts.market,
    '--source', opts.scrapeSource || 'realtor',
    '--limit', String(opts.count || 20),
  ];
  if (opts.beds !== null && opts.beds !== undefined) {
    scraperArgs.push('--beds-min', String(opts.beds), '--beds-max', String(opts.beds));
  }
  if (opts.maxRent !== null && opts.maxRent !== undefined) {
    scraperArgs.push('--price-max', String(opts.maxRent));
  }
  execFileSync('python3', scraperArgs, { stdio: 'inherit' });
  return [];
}

async function fetchMatchingPendingPipeline(opts) {
  const market = parseMarketTarget(opts.market);
  // Strictly query ONLY active pending pipeline rows — NEVER pipeline_recovery_archive
  const rows = await fetchJson(
    `${SUPABASE_URL}/rest/v1/pipeline_properties?select=*&status=in.(scraped,edited)&order=imported_at.desc&limit=500`,
    { headers: pipelineHeaders() }
  );

  let candidates = Array.isArray(rows) ? rows : [];

  if (opts.ids.length > 0) {
    const idSet = new Set(opts.ids);
    candidates = candidates.filter((r) => idSet.has(r.id));
  } else if (market.city) {
    candidates = candidates.filter((r) => {
      const cityOk = (r.city || '').toLowerCase() === market.city.toLowerCase();
      const stateOk = !market.state || (r.state || '').toUpperCase() === market.state;
      return cityOk && stateOk;
    });
  }

  if (opts.beds !== null) candidates = candidates.filter((r) => Number(r.bedrooms) === opts.beds);
  if (opts.bathsMin !== null) candidates = candidates.filter((r) => Number(r.bathrooms) >= opts.bathsMin);
  if (opts.bathsMax !== null) candidates = candidates.filter((r) => Number(r.bathrooms) <= opts.bathsMax);
  if (opts.maxRent !== null) candidates = candidates.filter((r) => Number(r.monthly_rent) <= opts.maxRent);

  // Deduplicate within pipeline batch
  const seenSrc = new Set();
  const seenAddr = new Set();
  const deduped = [];
  for (const r of candidates) {
    const srcKey = r.source_listing_id ? `${r.source || 'src'}:${r.source_listing_id}` : null;
    const addrKey = `${(r.address || '').toLowerCase().trim()}|${(r.city || '').toLowerCase().trim()}|${(r.state || '').toUpperCase().trim()}`;
    if ((srcKey && seenSrc.has(srcKey)) || (r.address && seenAddr.has(addrKey))) continue;
    if (srcKey) seenSrc.add(srcKey);
    if (r.address) seenAddr.add(addrKey);
    deduped.push(r);
  }

  return deduped.slice(0, opts.count || 50);
}

async function fetchExistingLiveAddressSet(city) {
  const url = city
    ? `${SUPABASE_URL}/rest/v1/properties?select=id,address,city,state&city=ilike.${encodeURIComponent(city)}&limit=1000`
    : `${SUPABASE_URL}/rest/v1/properties?select=id,address,city,state&limit=1000`;
  const rows = await fetchJson(url, { headers: publicHeaders() });
  const map = new Map();
  for (const r of (Array.isArray(rows) ? rows : [])) {
    const key = `${(r.address || '').toLowerCase().trim()}|${(r.city || '').toLowerCase().trim()}|${(r.state || '').toUpperCase().trim()}`;
    map.set(key, r.id);
  }
  return map;
}

async function fetchExistingPublishedSourceMap(city) {
  const url = city
    ? `${SUPABASE_URL}/rest/v1/publishing_batch_properties?select=source,source_listing_id,property_id&published_status=eq.published&city=ilike.${encodeURIComponent(city)}&limit=1000`
    : `${SUPABASE_URL}/rest/v1/publishing_batch_properties?select=source,source_listing_id,property_id&published_status=eq.published&limit=1000`;
  try {
    const rows = await fetchJson(url, { headers: publicHeaders() });
    const srcMap = new Map();
    const propIds = [...new Set((Array.isArray(rows) ? rows : []).map((r) => r.property_id).filter(Boolean))];
    if (propIds.length === 0) return srcMap;

    const liveRows = await fetchJson(
      `${SUPABASE_URL}/rest/v1/properties?select=id&id=in.(${propIds.map((id) => encodeURIComponent(id)).join(',')})`,
      { headers: publicHeaders() }
    );
    const liveSet = new Set((Array.isArray(liveRows) ? liveRows : []).map((r) => r.id));

    for (const r of rows) {
      if (r.source_listing_id && r.property_id && liveSet.has(r.property_id)) {
        srcMap.set(`${r.source || 'src'}:${r.source_listing_id}`, r.property_id);
      }
    }
    return srcMap;
  } catch {
    return new Map();
  }
}

export async function executePublishingRun(opts) {
  const startedAt = new Date().toISOString();
  const batchId = generateBatchId();
  const schemaStatus = await checkSchemaDeployed();

  // Retry-batch idempotency guard: prevent duplicate properties, shares, or logs when retrying an existing batch
  if (opts.retryBatch && schemaStatus.publishingBatches) {
    const existingBatches = await fetchJson(
      `${SUPABASE_URL}/rest/v1/publishing_batches?select=*&id=eq.${encodeURIComponent(opts.retryBatch)}&limit=1`,
      { headers: publicHeaders() }
    );
    const existingBatch = Array.isArray(existingBatches) ? existingBatches[0] : null;
    if (existingBatch) {
      if (existingBatch.status === 'completed' && Number(existingBatch.failed_count || 0) === 0 && !opts.allowRepublish) {
        console.log(`[IDEMPOTENT RETRY] Batch ${opts.retryBatch} is already completed (${existingBatch.published_count} published). Zero duplicate properties, shares, or logs created.`);
        return {
          ok: true,
          idempotentNoOp: true,
          batchId: existingBatch.id,
          publishedPropertyIds: [],
          failedPipelineIds: [],
          magicLinkUrl: existingBatch.magic_link_url || null,
          shareVerified: Boolean(existingBatch.share_verified),
          historyRecorded: false,
          cleanupResult: { ok: true, skipped: true, reason: 'batch_already_completed' },
        };
      }
      if ((existingBatch.status === 'partial' || existingBatch.status === 'failed') && opts.ids.length === 0) {
        const batchProps = await fetchJson(
          `${SUPABASE_URL}/rest/v1/publishing_batch_properties?select=pipeline_id,published_status&batch_id=eq.${encodeURIComponent(opts.retryBatch)}`,
          { headers: publicHeaders() }
        );
        const retryIds = (Array.isArray(batchProps) ? batchProps : [])
          .filter((p) => p.published_status === 'failed' && p.pipeline_id)
          .map((p) => p.pipeline_id);
        if (retryIds.length === 0 && !opts.allowRepublish) {
          console.log(`[IDEMPOTENT RETRY] Batch ${opts.retryBatch} has no retryable failed items.`);
          return {
            ok: true,
            idempotentNoOp: true,
            batchId: existingBatch.id,
            publishedPropertyIds: [],
            failedPipelineIds: [],
            magicLinkUrl: existingBatch.magic_link_url || null,
            shareVerified: Boolean(existingBatch.share_verified),
            historyRecorded: false,
            cleanupResult: { ok: true, skipped: true, reason: 'no_retryable_failed_items' },
          };
        }
        opts.ids = retryIds;
        if (!opts.market && existingBatch.target_market) opts.market = existingBatch.target_market;
      }
    }
  }

  console.log('=============================================================================');
  console.log(`CHOICE PROPERTIES — STATELESS PUBLISHING ENGINE (${opts.dryRun ? 'DRY RUN' : 'LIVE'})`);
  console.log(`Batch ID: ${batchId} | Workflow: ${opts.workflow} | Visibility: ${opts.visibility}`);
  console.log(`Target:   ${opts.market || (opts.ids.length ? `IDs (${opts.ids.join(',')})` : 'Unspecified')}`);
  console.log('=============================================================================\n');

  if (opts.workflow === 'scrape_and_publish' && !opts.dryRun && (opts.importUrls.length > 0 || opts.ids.length === 0)) {
    const stagedFromUrls = await runWorkflowBScrape(opts);
    if (stagedFromUrls.length > 0 && opts.ids.length === 0) {
      opts.ids = stagedFromUrls;
    }
  }

  const candidates = await fetchMatchingPendingPipeline(opts);
  if (candidates.length === 0) {
    console.log('No matching pending properties found in pipeline.pipeline_properties.');
    return { ok: false, batchId, error: 'no_matching_pipeline_properties' };
  }

  const marketObj = parseMarketTarget(opts.market || `${candidates[0].city}, ${candidates[0].state}`);
  const liveAddrMap = await fetchExistingLiveAddressSet(marketObj.city);
  const liveSourceMap = await fetchExistingPublishedSourceMap(marketObj.city);

  const executionErrors = [];
  const snapshots = [];
  const publishedPropertyIds = [];
  const verifiedPipelineIds = [];
  const failedPipelineIds = [];
  const skippedPipelineIds = [];

  // Enrich, validate, and publish each candidate independently
  for (const pipeRow of candidates) {
    const addrKey = `${(pipeRow.address || '').toLowerCase().trim()}|${(pipeRow.city || '').toLowerCase().trim()}|${(pipeRow.state || '').toUpperCase().trim()}`;
    const srcKey = pipeRow.source_listing_id ? `${pipeRow.source || 'src'}:${pipeRow.source_listing_id}` : null;
    const existingLiveId = liveAddrMap.get(addrKey) || (srcKey ? liveSourceMap.get(srcKey) : null);

    if (existingLiveId && !opts.allowRepublish) {
      console.log(`  ↷ SKIPPED (already live as ${existingLiveId}): ${pipeRow.address}`);
      skippedPipelineIds.push(pipeRow.id);
      snapshots.push({
        batch_id: batchId,
        property_id: existingLiveId,
        pipeline_id: pipeRow.id,
        source_listing_id: pipeRow.source_listing_id || null,
        source: pipeRow.source || null,
        address: pipeRow.address,
        city: pipeRow.city,
        state: pipeRow.state,
        zip: pipeRow.zip,
        property_type: pipeRow.property_type || 'SINGLE_FAMILY',
        bedrooms: pipeRow.bedrooms,
        bathrooms: pipeRow.bathrooms,
        square_footage: pipeRow.square_footage,
        monthly_rent: pipeRow.monthly_rent,
        visibility: opts.visibility,
        photo_count: 0,
        published_status: 'skipped',
        recovery_status: 'active',
        error_message: `Duplicate prevented: already exists in public.properties (${existingLiveId})`,
      });
      continue;
    }

    const enriched = enrichPipelineProperty(pipeRow, { visibility: opts.visibility });
    if (!enriched.isValid) {
      const errMsg = enriched.validationErrors.join('; ');
      console.error(`  ✗ VALIDATION FAILED (${pipeRow.id} ${pipeRow.address}): ${errMsg}`);
      failedPipelineIds.push(pipeRow.id);
      executionErrors.push({ pipeline_id: pipeRow.id, address: pipeRow.address, error: errMsg });
      snapshots.push({
        batch_id: batchId,
        property_id: null,
        pipeline_id: pipeRow.id,
        source_listing_id: pipeRow.source_listing_id || null,
        source: pipeRow.source || null,
        address: pipeRow.address || pipeRow.title || pipeRow.id,
        city: pipeRow.city || '',
        state: pipeRow.state || '',
        zip: pipeRow.zip || '',
        property_type: enriched.propertyRecord.property_type,
        bedrooms: enriched.propertyRecord.bedrooms,
        bathrooms: enriched.propertyRecord.bathrooms,
        square_footage: enriched.propertyRecord.square_footage,
        monthly_rent: enriched.propertyRecord.monthly_rent,
        visibility: opts.visibility,
        photo_count: enriched.photos.length,
        published_status: 'failed',
        recovery_status: 'active',
        error_message: errMsg,
      });
      continue;
    }

    if (opts.dryRun) {
      console.log(`  [DRY RUN] Would publish ${pipeRow.id}: ${enriched.propertyRecord.title} ($${enriched.propertyRecord.monthly_rent}/mo, ${enriched.photos.length} photos)`);
      verifiedPipelineIds.push(pipeRow.id);
      continue;
    }

    // Live publish into public.properties + public.property_photos
    const newPropId = 'prop_' + crypto.randomBytes(6).toString('hex');
    try {
      await fetchJson(`${SUPABASE_URL}/rest/v1/properties`, {
        method: 'POST',
        headers: publicHeaders({ Prefer: 'return=minimal' }),
        body: { id: newPropId, ...enriched.propertyRecord },
      });

      const photoRows = enriched.photos.map((url, idx) => ({
        id: crypto.randomUUID(),
        property_id: newPropId,
        url,
        display_order: idx + 1,
        is_hero: idx === 0,
        watermark_status: 'clean',
        alt_text: `${pipeRow.address}, ${pipeRow.city} ${pipeRow.state} - Photo ${idx + 1}`,
      }));

      await fetchJson(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: publicHeaders({ Prefer: 'return=minimal' }),
        body: photoRows,
      });

      // Verify property & photos exist before declaring success
      const verifyProps = await fetchJson(
        `${SUPABASE_URL}/rest/v1/properties?select=id,status&id=eq.${encodeURIComponent(newPropId)}`,
        { headers: publicHeaders() }
      );
      const verifyPhotos = await fetchJson(
        `${SUPABASE_URL}/rest/v1/property_photos?select=id&property_id=eq.${encodeURIComponent(newPropId)}`,
        { headers: publicHeaders() }
      );
      if (!Array.isArray(verifyProps) || verifyProps.length !== 1 || !Array.isArray(verifyPhotos) || verifyPhotos.length !== photoRows.length) {
        throw new Error('Post-insert verification mismatch for property or photos');
      }

      // Mark choice_property_id & batch_id on pipeline row before archival snapshot
      await fetchJson(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${encodeURIComponent(pipeRow.id)}`, {
        method: 'PATCH',
        headers: pipelineHeaders({ Prefer: 'return=minimal' }),
        body: {
          choice_property_id: newPropId,
          batch_id: batchId,
          published_at: new Date().toISOString(),
        },
      });

      console.log(`  ✓ PUBLISHED ${newPropId} (${pipeRow.address}, ${enriched.photos.length} photos)`);
      publishedPropertyIds.push(newPropId);
      verifiedPipelineIds.push(pipeRow.id);

      snapshots.push({
        batch_id: batchId,
        property_id: newPropId,
        pipeline_id: pipeRow.id,
        source_listing_id: pipeRow.source_listing_id || null,
        source: pipeRow.source || null,
        address: pipeRow.address,
        city: pipeRow.city,
        state: pipeRow.state,
        zip: pipeRow.zip,
        property_type: enriched.propertyRecord.property_type,
        bedrooms: enriched.propertyRecord.bedrooms,
        bathrooms: enriched.propertyRecord.bathrooms,
        square_footage: enriched.propertyRecord.square_footage,
        monthly_rent: enriched.propertyRecord.monthly_rent,
        visibility: opts.visibility,
        photo_count: photoRows.length,
        published_status: 'published',
        recovery_status: 'active',
      });
    } catch (err) {
      // Roll back partial property if photo insertion or verification failed
      try {
        await fetchJson(`${SUPABASE_URL}/rest/v1/properties?id=eq.${encodeURIComponent(newPropId)}`, {
          method: 'DELETE',
          headers: publicHeaders({ Prefer: 'return=minimal' }),
        });
      } catch { /* ignore cleanup rollback failure */ }

      console.error(`  ✗ PUBLISH FAILED (${pipeRow.id}): ${err.message}`);
      failedPipelineIds.push(pipeRow.id);
      executionErrors.push({ pipeline_id: pipeRow.id, address: pipeRow.address, error: err.message });
      snapshots.push({
        batch_id: batchId,
        property_id: null,
        pipeline_id: pipeRow.id,
        source_listing_id: pipeRow.source_listing_id || null,
        source: pipeRow.source || null,
        address: pipeRow.address || pipeRow.title || pipeRow.id,
        city: pipeRow.city || '',
        state: pipeRow.state || '',
        zip: pipeRow.zip || '',
        property_type: enriched.propertyRecord.property_type,
        bedrooms: enriched.propertyRecord.bedrooms,
        bathrooms: enriched.propertyRecord.bathrooms,
        square_footage: enriched.propertyRecord.square_footage,
        monthly_rent: enriched.propertyRecord.monthly_rent,
        visibility: opts.visibility,
        photo_count: 0,
        published_status: 'failed',
        recovery_status: 'active',
        error_message: err.message,
      });
    }
  }

  if (opts.dryRun) {
    console.log(`\n[DRY RUN COMPLETE] ${verifiedPipelineIds.length} ready, ${failedPipelineIds.length} failed validation.`);
    return { ok: true, dryRun: true, batchId, readyCount: verifiedPipelineIds.length, failedCount: failedPipelineIds.length };
  }

  // Pure idempotent retry guard: if EVERY candidate was already live and nothing new failed or published,
  // do NOT create duplicate shares or pollute publishing_batches with bogus 'failed' log rows.
  if (publishedPropertyIds.length === 0 && failedPipelineIds.length === 0 && skippedPipelineIds.length > 0 && !opts.allowRepublish) {
    console.log(`\n[IDEMPOTENT NO-OP] All ${skippedPipelineIds.length} candidate(s) are already published on site. Zero duplicate properties, shares, or batch logs created.`);
    return {
      ok: true,
      idempotentNoOp: true,
      batchId,
      publishedPropertyIds: [],
      failedPipelineIds: [],
      skippedPipelineIds,
      magicLinkUrl: null,
      shareVerified: false,
      historyRecorded: false,
      cleanupResult: { ok: true, skipped: true, reason: 'all_candidates_already_live' },
    };
  }

  // Step 6: Magic Link Generation & Verification (when private_placement)
  let shareId = null;
  let magicLinkUrl = null;
  let shareTokenHash = null;
  let shareCreatedAt = null;
  let shareExpiresAt = null;
  let shareVerified = false;

  if (opts.visibility === 'private_placement' && publishedPropertyIds.length > 0) {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    shareTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    shareId = crypto.randomUUID();
    shareCreatedAt = new Date().toISOString();
    shareExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    await fetchJson(`${SUPABASE_URL}/rest/v1/property_shares`, {
      method: 'POST',
      headers: publicHeaders({ Prefer: 'return=minimal' }),
      body: { id: shareId, token_hash: shareTokenHash, expires_at: shareExpiresAt },
    });

    await fetchJson(`${SUPABASE_URL}/rest/v1/property_share_properties`, {
      method: 'POST',
      headers: publicHeaders({ Prefer: 'return=minimal' }),
      body: publishedPropertyIds.map((pid) => ({ share_id: shareId, property_id: pid })),
    });

    magicLinkUrl = `${SITE_URL}/listings.html#share=${rawToken}`;

    // Verify token resolves live via Edge Function
    try {
      const resolveResp = await fetchJson(`${SUPABASE_URL}/functions/v1/property-share`, {
        method: 'POST',
        headers: publicHeaders(),
        body: { action: 'resolve', token: rawToken },
      });
      shareVerified = Array.isArray(resolveResp?.properties) && resolveResp.properties.length === publishedPropertyIds.length;
    } catch (err) {
      executionErrors.push({ step: 'magic_link_verification', error: err.message });
      shareVerified = false;
    }
  }

  // Step 7: Record Lightweight Publishing History BEFORE Cleanup
  let historyRecorded = false;
  const batchStatus =
    publishedPropertyIds.length === 0 ? 'failed'
    : failedPipelineIds.length > 0 ? 'partial'
    : 'completed';

  if (schemaStatus.publishingBatches) {
    await fetchJson(`${SUPABASE_URL}/rest/v1/publishing_batches`, {
      method: 'POST',
      headers: publicHeaders({ Prefer: 'return=minimal' }),
      body: {
        id: batchId,
        target_market: opts.market || `${candidates[0].city}, ${candidates[0].state}`,
        workflow_type: opts.workflow,
        visibility: opts.visibility,
        status: batchStatus,
        total_processed: candidates.length,
        published_count: publishedPropertyIds.length,
        failed_count: failedPipelineIds.length,
        skipped_count: skippedPipelineIds.length,
        share_id: shareId,
        magic_link_url: magicLinkUrl,
        share_token_hash: shareTokenHash,
        share_created_at: shareCreatedAt,
        share_expires_at: shareExpiresAt,
        share_verified: shareVerified,
        share_property_count: publishedPropertyIds.length,
        enrichment_succeeded: publishedPropertyIds.length > 0,
        images_synchronized: publishedPropertyIds.length > 0,
        publishing_succeeded: publishedPropertyIds.length > 0,
        magic_link_succeeded: opts.visibility !== 'private_placement' || shareVerified,
        execution_summary: `Published ${publishedPropertyIds.length}/${candidates.length} properties (${failedPipelineIds.length} failed, ${skippedPipelineIds.length} skipped).`,
        errors: executionErrors,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      },
    });

    if (snapshots.length > 0) {
      await fetchJson(`${SUPABASE_URL}/rest/v1/publishing_batch_properties`, {
        method: 'POST',
        headers: publicHeaders({ Prefer: 'return=minimal' }),
        body: snapshots,
      });
    }
    historyRecorded = true;
  }

  // Step 8: Stage 1 Verification Gate -> 24-Hour Recoverable Archive & Active Cleanup
  let cleanupResult = { ok: false, skipped: true };
  const canCleanup =
    !opts.skipCleanup &&
    historyRecorded &&
    schemaStatus.archiveRpc &&
    verifiedPipelineIds.length > 0 &&
    (opts.visibility !== 'private_placement' || shareVerified);

  if (canCleanup) {
    try {
      // Match raw payload files in pipeline-raw-payloads (excluding recovery/) for verified IDs
      const rootObjects = (await listRawPayloadObjects('', 1000)).filter((p) => !p.startsWith('recovery/'));
      const rawPathsByPipelineId = {};

      for (const pipeId of verifiedPipelineIds) {
        const matchingFiles = rootObjects.filter((name) => name.includes(pipeId));
        const movedPaths = [];
        for (const fileKey of matchingFiles) {
          const moved = await moveRawPayloadToRecovery(fileKey, batchId);
          movedPaths.push(moved);
        }
        rawPathsByPipelineId[pipeId] = movedPaths;
      }

      cleanupResult = await callRpc('pipeline_archive_and_remove', {
        p_batch_id: batchId,
        p_pipeline_ids: verifiedPipelineIds,
        p_raw_paths: rawPathsByPipelineId,
        p_target_market: opts.market || `${candidates[0].city}, ${candidates[0].state}`,
      });
      console.log(`\n✓ Stage 1 Cleanup Complete: ${cleanupResult.deleted} removed from active pipeline, archived for 24h until ${cleanupResult.recovery_expires_at}`);
    } catch (archErr) {
      cleanupResult = { ok: false, skipped: false, error: archErr.message };
      executionErrors.push({ step: 'stage1_archival', error: archErr.message });
      if (schemaStatus.publishingBatches) {
        await fetchJson(`${SUPABASE_URL}/rest/v1/publishing_batches?id=eq.${encodeURIComponent(batchId)}`, {
          method: 'PATCH',
          headers: publicHeaders({ Prefer: 'return=minimal' }),
          body: { errors: executionErrors },
        }).catch(() => {});
      }
      console.error(`\n✗ Stage 1 Archival Failed (active pipeline rows preserved): ${archErr.message}`);
    }
  } else {
    console.warn('\n⚠ Cleanup skipped or held (failed verification gate or schema migration not yet applied).');
  }

  // Step 9: Post-Cleanup Integrity Probe
  const stillInActive = verifiedPipelineIds.length > 0
    ? await fetchJson(
        `${SUPABASE_URL}/rest/v1/pipeline_properties?select=id&id=in.(${verifiedPipelineIds.map((id) => encodeURIComponent(id)).join(',')})`,
        { headers: pipelineHeaders() }
      )
    : [];

  console.log('\n=== BATCH COMPLETION SUMMARY ===');
  console.log(`Batch ID:            ${batchId}`);
  console.log(`Published Count:     ${publishedPropertyIds.length}`);
  console.log(`Failed Count:        ${failedPipelineIds.length}`);
  console.log(`Skipped Count:       ${skippedPipelineIds.length}`);
  if (magicLinkUrl) console.log(`Master Magic Link:   ${magicLinkUrl} (Verified: ${shareVerified})`);
  console.log(`History Recorded:    ${historyRecorded}`);
  console.log(`Active Pipeline Left:${Array.isArray(stillInActive) ? stillInActive.length : 'unknown'} for processed IDs`);

  return {
    ok: publishedPropertyIds.length > 0,
    batchId,
    publishedPropertyIds,
    failedPipelineIds,
    skippedPipelineIds,
    magicLinkUrl,
    shareVerified,
    historyRecorded,
    cleanupResult,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const opts = parseCliArgs(process.argv.slice(2));
  executePublishingRun(opts)
    .then((res) => {
      if (!res.ok && !res.dryRun) process.exit(1);
    })
    .catch((err) => {
      console.error('Fatal publishing error:', err);
      process.exit(1);
    });
}
