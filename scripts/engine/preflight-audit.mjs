#!/usr/bin/env node
/**
 * Choice Properties — Pre-Flight Pipeline Audit (Stateless)
 * Inspects ONLY active pending rows in pipeline.pipeline_properties.
 * Never reads from pipeline_recovery_archive.
 */

import {
  SUPABASE_URL,
  publicHeaders,
  pipelineHeaders,
  fetchJson,
  listRawPayloadObjects,
} from './supabase-client.mjs';

export function parseMarketTarget(target = '') {
  const clean = String(target || '').trim();
  if (!clean) return { city: null, state: null, raw: '' };
  const parts = clean.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      city: parts[0],
      state: parts[1].toUpperCase().slice(0, 2),
      raw: clean,
    };
  }
  return { city: clean, state: null, raw: clean };
}

export async function runPreflightAudit({ target = '', ids = [] } = {}) {
  const market = parseMarketTarget(target);

  // Query ONLY active pending properties in pipeline.pipeline_properties
  let query = `${SUPABASE_URL}/rest/v1/pipeline_properties?select=id,source,source_listing_id,status,title,address,city,state,zip,bedrooms,bathrooms,monthly_rent,square_footage,original_image_urls,scraped_at,imported_at,folder_id&status=in.(scraped,edited)&order=imported_at.desc&limit=500`;
  const allPending = await fetchJson(query, { headers: pipelineHeaders() });

  const rows = Array.isArray(allPending) ? allPending : [];

  let matched = rows;
  if (ids.length > 0) {
    const idSet = new Set(ids);
    matched = matched.filter((r) => idSet.has(r.id));
  } else if (market.city) {
    matched = matched.filter((r) => {
      const cityMatch = (r.city || '').toLowerCase() === market.city.toLowerCase();
      const stateMatch = !market.state || (r.state || '').toUpperCase() === market.state;
      return cityMatch && stateMatch;
    });
  }

  // Deduplicate by source_listing_id or normalized address
  const seenSource = new Set();
  const seenAddr = new Set();
  const unique = [];
  const duplicates = [];

  for (const r of matched) {
    const addrKey = `${(r.address || '').toLowerCase().trim()}|${(r.city || '').toLowerCase().trim()}|${(r.state || '').toUpperCase().trim()}`;
    const srcKey = r.source_listing_id ? `${r.source || 'src'}:${r.source_listing_id}` : null;
    if ((srcKey && seenSource.has(srcKey)) || (r.address && seenAddr.has(addrKey))) {
      duplicates.push(r.id);
    } else {
      if (srcKey) seenSource.add(srcKey);
      if (r.address) seenAddr.add(addrKey);
      unique.push(r);
    }
  }

  // Check if already published in public.properties
  const alreadyLive = [];
  if (unique.length > 0 && market.city) {
    const liveRows = await fetchJson(
      `${SUPABASE_URL}/rest/v1/properties?select=id,address,city,state,status&city=ilike.${encodeURIComponent(market.city)}&limit=500`,
      { headers: publicHeaders() }
    );
    const liveAddrs = new Set(
      (Array.isArray(liveRows) ? liveRows : []).map(
        (lr) => `${(lr.address || '').toLowerCase().trim()}|${(lr.city || '').toLowerCase().trim()}|${(lr.state || '').toUpperCase().trim()}`
      )
    );
    for (const u of unique) {
      const k = `${(u.address || '').toLowerCase().trim()}|${(u.city || '').toLowerCase().trim()}|${(u.state || '').toUpperCase().trim()}`;
      if (liveAddrs.has(k)) {
        alreadyLive.push(u.id);
      }
    }
  }

  // Only inspect pipeline-raw-payloads root (excluding recovery/ prefix) if 0 matched rows
  let rawRootFiles = [];
  if (unique.length === 0) {
    const rootFiles = await listRawPayloadObjects('', 1000);
    rawRootFiles = rootFiles.filter((name) => !name.startsWith('recovery/'));
  }

  const citiesPresent = [...new Set(rows.map((r) => `${r.city || '?'}, ${r.state || '?'}`))];

  return {
    ok: true,
    target: market.raw || 'ALL',
    totalPendingInPipeline: rows.length,
    matchedCount: matched.length,
    uniqueCount: unique.length,
    duplicateIdsInPipeline: duplicates,
    alreadyLiveIds: alreadyLive,
    citiesPresentInPipeline: citiesPresent,
    unindexedRawRootCount: rawRootFiles.length,
    matchedProperties: unique,
  };
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let target = '';
  let ids = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) target = args[++i];
    if (args[i] === '--ids' && args[i + 1]) ids = args[++i].split(',').map((s) => s.trim()).filter(Boolean);
  }

  runPreflightAudit({ target, ids })
    .then((res) => {
      console.log('=== CHOICE PROPERTIES — PRE-FLIGHT PIPELINE AUDIT ===');
      console.log(`Target Market:          ${res.target}`);
      console.log(`Total Pending in Queue: ${res.totalPendingInPipeline}`);
      console.log(`Matched Target Market:  ${res.matchedCount} (${res.uniqueCount} unique)`);
      console.log(`Cities in Queue:        ${res.citiesPresentInPipeline.join(' | ') || 'None'}`);
      if (res.duplicateIdsInPipeline.length) {
        console.log(`Intra-Batch Duplicates: ${res.duplicateIdsInPipeline.join(', ')} (will deduplicate within batch)`);
      }
      if (res.alreadyLiveIds.length) {
        console.log(`Previously Published:   ${res.alreadyLiveIds.join(', ')} (eligible for independent batch republication)`);
      }
      if (res.uniqueCount === 0) {
        console.log(`Unindexed Raw Blobs:    ${res.unindexedRawRootCount} file(s) in root of pipeline-raw-payloads`);
      }
      console.log('\nMatched Properties:');
      for (const p of res.matchedProperties) {
        console.log(`  - ${p.id} | ${p.address}, ${p.city}, ${p.state} ${p.zip} | ${p.bedrooms}bd/${p.bathrooms}ba | $${p.monthly_rent}/mo`);
      }
    })
    .catch((err) => {
      console.error('Preflight audit failed:', err.message);
      process.exit(1);
    });
}
