#!/usr/bin/env node
/**
 * Choice Properties — Lightweight Publishing Activity History Lookup
 * ============================================================================
 * Queries ONLY public.publishing_batches, public.publishing_batch_properties,
 * and live public.property_shares status. Never reconstructs history from
 * pipeline.pipeline_properties.
 * ============================================================================
 */

import {
  SUPABASE_URL,
  publicHeaders,
  fetchJson,
  callRpc,
  checkSchemaDeployed,
} from './supabase-client.mjs';

export function evaluateShareHealth(batch) {
  if (!batch.share_id && !batch.magic_link_url) {
    return { status: 'none', active: false, reason: 'No magic link generated (public listing or failed)' };
  }
  if (batch.live_share_revoked_at) {
    return { status: 'revoked', active: false, reason: `Revoked at ${batch.live_share_revoked_at}` };
  }
  const exp = batch.live_share_expires_at || batch.share_expires_at;
  if (exp && new Date(exp).getTime() <= Date.now()) {
    return { status: 'expired', active: false, reason: `Expired at ${exp}` };
  }
  if (!batch.share_id) {
    return { status: 'revoked_or_deleted', active: false, reason: 'Share record no longer exists in property_shares' };
  }
  return { status: 'active', active: true, expires_at: exp };
}

export async function queryPublishingHistory({
  recent = 10,
  market = null,
  batchId = null,
  date = null,
  address = null,
  visibility = null,
  failedOnly = false,
} = {}) {
  if (address) {
    const props = await fetchJson(
      `${SUPABASE_URL}/rest/v1/publishing_batch_properties?select=*,publishing_batches(*)&address=ilike.*${encodeURIComponent(address)}*&order=created_at.desc&limit=50`,
      { headers: publicHeaders() }
    );
    return { mode: 'by_address', matches: Array.isArray(props) ? props : [] };
  }

  const rpcRes = await callRpc('pipeline_get_publishing_history', {
    p_limit: recent || 25,
    p_market: market || null,
    p_batch_id: batchId || null,
  });

  let batches = Array.isArray(rpcRes?.batches) ? rpcRes.batches : [];

  if (date) {
    batches = batches.filter((b) => String(b.started_at || '').startsWith(date));
  }
  if (visibility) {
    batches = batches.filter((b) => b.visibility === visibility);
  }
  if (failedOnly) {
    batches = batches
      .map((b) => ({
        ...b,
        properties: (b.properties || []).filter((p) => p.published_status === 'failed'),
      }))
      .filter((b) => b.failed_count > 0 || b.properties.length > 0);
  }

  batches = batches.map((b) => ({
    ...b,
    share_health: evaluateShareHealth(b),
  }));

  return { mode: 'batches', batches };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const schema = await checkSchemaDeployed();
    if (!schema.publishingBatches) {
      console.error('Publishing history tables are not yet deployed in Supabase. Apply migration 20261112000001_publishing_history_and_recovery.sql first.');
      process.exit(1);
    }

    const args = process.argv.slice(2);
    const getArg = (f) => {
      const idx = args.indexOf(f);
      return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
    };

    const res = await queryPublishingHistory({
      recent: parseInt(getArg('--recent') || '10', 10),
      market: getArg('--market'),
      batchId: getArg('--batch'),
      date: getArg('--date'),
      address: getArg('--address'),
      visibility: getArg('--visibility'),
      failedOnly: args.includes('--failed'),
    });

    if (res.mode === 'by_address') {
      console.log(`=== ADDRESS HISTORY MATCHES (${res.matches.length}) ===`);
      for (const m of res.matches) {
        console.log(`  Batch ${m.batch_id} | ${m.address}, ${m.city}, ${m.state} | $${m.monthly_rent}/mo | ${m.visibility} | Outcome: ${m.published_status} | Recovery: ${m.recovery_status}`);
      }
      return;
    }

    console.log(`=== PUBLISHING BATCH HISTORY (${res.batches.length}) ===`);
    for (const b of res.batches) {
      console.log(`\n[${b.id}] ${b.target_market} | ${b.workflow_type} | ${b.visibility} | Status: ${b.status}`);
      console.log(`  Started: ${b.started_at} | Published: ${b.published_count}/${b.total_processed} | Failed: ${b.failed_count}`);
      console.log(`  Cleanup: ${b.cleanup_completed ? 'COMPLETED' : 'PENDING'} | Recovery Status: ${b.recovery_status}`);
      if (b.magic_link_url) {
        console.log(`  Magic Link: ${b.magic_link_url} [Health: ${b.share_health.status.toUpperCase()}${b.share_health.reason ? ' — ' + b.share_health.reason : ''}]`);
      }
      if (Array.isArray(b.properties) && b.properties.length > 0) {
        for (const p of b.properties) {
          console.log(`    - ${p.address}, ${p.city} ${p.state} (${p.bedrooms}bd/${p.bathrooms}ba, $${p.monthly_rent}/mo) -> ${p.published_status} [PropID: ${p.property_id || 'N/A'}]`);
        }
      }
    }
  })().catch((err) => {
    console.error('History lookup error:', err.message);
    process.exit(1);
  });
}
