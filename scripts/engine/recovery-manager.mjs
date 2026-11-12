#!/usr/bin/env node
/**
 * Choice Properties — Explicit 24-Hour Pipeline Recovery & Stage 2 Purge CLI
 * ============================================================================
 * IMPORTANT: Never called automatically during normal publishing.
 * Used ONLY when an operator explicitly requests:
 *   - Listing batches still inside their 24-hour recovery window
 *   - Checking whether a property can still be restored
 *   - Explicitly restoring a deleted batch (full or partial) to the pipeline
 *   - Running Stage 2 permanent purge for expired (>24h) recovery records
 * ============================================================================
 */

import {
  SUPABASE_URL,
  publicHeaders,
  fetchJson,
  callRpc,
  removeRawPayloads,
  restoreRawPayloadFromRecovery,
  checkSchemaDeployed,
} from './supabase-client.mjs';

function formatCountdown(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

export async function listRecoverableBatches() {
  const res = await callRpc('pipeline_get_recoverable_batches');
  return res?.batches || [];
}

export async function checkPropertyRecoveryStatus(query) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Property query (address, pipeline_id, or source_listing_id) is required');

  const rows = await fetchJson(
    `${SUPABASE_URL}/rest/v1/publishing_batch_properties?select=batch_id,pipeline_id,source_listing_id,address,city,state,zip,recovery_status,deleted_from_pipeline_at,recovery_expires_at,restored_at,permanently_deleted_at&or=(address.ilike.*${encodeURIComponent(q)}*,pipeline_id.eq.${encodeURIComponent(q)},source_listing_id.eq.${encodeURIComponent(q)})&order=created_at.desc&limit=20`,
    { headers: publicHeaders() }
  );

  const now = Date.now();
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const expMs = r.recovery_expires_at ? new Date(r.recovery_expires_at).getTime() : 0;
    const withinWindow = r.recovery_status === 'recoverable' && expMs > now;
    return {
      ...r,
      can_restore: withinWindow,
      seconds_remaining: withinWindow ? Math.floor((expMs - now) / 1000) : 0,
    };
  });
}

export async function restoreBatch({ batchId = null, latest = false, market = null, pipelineIds = null, reason = 'Explicit administrator restoration request' } = {}) {
  let targetBatchId = batchId;

  if (!targetBatchId) {
    const recoverable = await listRecoverableBatches();
    if (recoverable.length === 0) {
      return { ok: false, error: 'no_recoverable_batches_within_24h_window' };
    }
    if (market) {
      const mLower = market.toLowerCase();
      const match = recoverable.find((b) => (b.target_market || '').toLowerCase().includes(mLower));
      if (!match) return { ok: false, error: `no_recoverable_batch_matching_market: ${market}` };
      targetBatchId = match.batch_id;
    } else if (latest) {
      targetBatchId = recoverable[0].batch_id;
    } else {
      return { ok: false, error: 'Specify --batch <PB-...>, --latest, or --market "<City, State>"' };
    }
  }

  // Fetch raw storage paths before restoring so we can restore raw blob references too
  let pathsToRestore = [];
  try {
    const claimed = await fetchJson(
      `${SUPABASE_URL}/rest/v1/pipeline_recovery_archive?select=pipeline_id,raw_storage_paths&batch_id=eq.${encodeURIComponent(targetBatchId)}`,
      { headers: { ...publicHeaders(), 'Accept-Profile': 'pipeline' } }
    );
    for (const row of (Array.isArray(claimed) ? claimed : [])) {
      if (!pipelineIds || pipelineIds.includes(row.pipeline_id)) {
        if (Array.isArray(row.raw_storage_paths)) {
          pathsToRestore.push(...row.raw_storage_paths);
        }
      }
    }
  } catch { /* non-fatal if pipeline schema REST exposure differs */ }

  const res = await callRpc('pipeline_restore_batch', {
    p_batch_id: targetBatchId,
    p_pipeline_ids: pipelineIds && pipelineIds.length > 0 ? pipelineIds : null,
    p_reason: reason,
  });

  if (res?.ok && pathsToRestore.length > 0) {
    for (const p of pathsToRestore) {
      await restoreRawPayloadFromRecovery(p);
    }
  }

  return res;
}

export async function purgeExpiredRecovery({ dryRun = false, limit = 100 } = {}) {
  const claim = await callRpc('pipeline_claim_expired_recovery', { p_limit: limit });
  const items = Array.isArray(claim?.items) ? claim.items : [];

  if (items.length === 0 || dryRun) {
    return {
      ok: true,
      dry_run: dryRun,
      expired_found: items.length,
      purged: 0,
      storage_deleted: 0,
      preview: items,
    };
  }

  const errorsById = {};
  let storageDeleted = 0;

  for (const item of items) {
    const paths = Array.isArray(item.raw_storage_paths) ? item.raw_storage_paths : [];
    if (paths.length > 0) {
      const rmRes = await removeRawPayloads(paths);
      if (rmRes.errors.length > 0) {
        errorsById[item.id] = rmRes.errors.join('; ');
      } else {
        storageDeleted += rmRes.deleted;
      }
    }
  }

  const finalize = await callRpc('pipeline_finalize_permanent_purge', {
    p_archive_ids: items.map((i) => i.id),
    p_errors: errorsById,
  });

  return {
    ok: true,
    dry_run: false,
    expired_found: items.length,
    purged: finalize?.purged || 0,
    storage_deleted: storageDeleted,
    errors: finalize?.errors || 0,
    purged_at: finalize?.purged_at,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const schema = await checkSchemaDeployed();
    if (!schema.restoreRpc) {
      console.error('Recovery schema/RPCs are not yet deployed in Supabase. Apply migration 20261112000001_publishing_history_and_recovery.sql first.');
      process.exit(1);
    }

    const args = process.argv.slice(2);
    const hasFlag = (f) => args.includes(f);
    const getArg = (f) => {
      const idx = args.indexOf(f);
      return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
    };

    if (hasFlag('--list-recoverable')) {
      const batches = await listRecoverableBatches();
      console.log(`=== RECOVERABLE PIPELINE BATCHES (24-HOUR WINDOW): ${batches.length} ===`);
      for (const b of batches) {
        console.log(`  ${b.batch_id} | ${b.target_market} | ${b.recoverable_count} properties | Deleted: ${b.deleted_at} | Remaining: ${formatCountdown(b.seconds_remaining)}`);
      }
    } else if (getArg('--check-property')) {
      const matches = await checkPropertyRecoveryStatus(getArg('--check-property'));
      console.log(`=== PROPERTY RECOVERY CHECK (${matches.length} match(es)) ===`);
      for (const m of matches) {
        console.log(`  Batch ${m.batch_id} | ${m.pipeline_id} | ${m.address}, ${m.city}, ${m.state} | Status: ${m.recovery_status} | Can Restore: ${m.can_restore ? `YES (${formatCountdown(m.seconds_remaining)} left)` : 'NO'}`);
      }
    } else if (hasFlag('--restore-batch') || hasFlag('--latest') || getArg('--market')) {
      const batchId = getArg('--restore-batch');
      const market = getArg('--market');
      const pIdsRaw = getArg('--property-ids');
      const pipelineIds = pIdsRaw ? pIdsRaw.split(',').map((s) => s.trim()).filter(Boolean) : null;
      const reason = getArg('--reason') || 'Explicit CLI restoration request';
      const res = await restoreBatch({ batchId, latest: hasFlag('--latest'), market, pipelineIds, reason });
      console.log(JSON.stringify(res, null, 2));
      if (!res?.ok) process.exit(1);
    } else if (hasFlag('--purge-expired')) {
      const res = await purgeExpiredRecovery({ dryRun: hasFlag('--dry-run') });
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log('Usage:');
      console.log('  node scripts/engine/recovery-manager.mjs --list-recoverable');
      console.log('  node scripts/engine/recovery-manager.mjs --check-property "<address or PP-ID>"');
      console.log('  node scripts/engine/recovery-manager.mjs --restore-batch PB-... [--property-ids PP-1,PP-2] [--reason "..."]');
      console.log('  node scripts/engine/recovery-manager.mjs --latest [--reason "..."]');
      console.log('  node scripts/engine/recovery-manager.mjs --market "Dallas, TX" [--reason "..."]');
      console.log('  node scripts/engine/recovery-manager.mjs --purge-expired [--dry-run]');
    }
  })().catch((err) => {
    console.error('Recovery manager error:', err.message);
    process.exit(1);
  });
}
