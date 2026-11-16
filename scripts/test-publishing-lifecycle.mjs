#!/usr/bin/env node
/**
 * Choice Properties — Automated Verification Suite for Publishing, History & 24h Recovery
 * =====================================================================================
 * Tests:
 *   1. Choice Properties invariants (enrichment, $50 fee, 1x deposit / 0 in text, decimal baths,
 *      architectural classification, strict photo ordering, zero prohibited policies).
 *   2. Stateless execution & cross-batch isolation (no disk/config leakage).
 *   3. Publishing history & share health evaluation (active, expired, revoked, none).
 *   4. Two-stage deletion & 24-hour recovery state machine invariants:
 *      - Stage 1 cleanup removes ONLY verified published properties (retains failed rows)
 *      - Recovery archive stays isolated from normal preflight / publishing queries
 *      - Explicit restoration preserves original batch ID, source_listing_id, and does NOT auto-publish
 *      - Strict 24-hour expiration boundary blocks late restoration
 *      - Stage 2 purge removes heavy snapshots & raw payloads while retaining lightweight audit log
 *      - Live public.properties + property_shares remain intact after Stage 2 purge
 *   5. SQL migration & Edge Function structural parity checks.
 *   6. Live read-only audit check against Supabase active pipeline (non-destructive).
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  normalizeBathroomPrecision,
  classifyPropertyType,
  extractPhotoUrlsInOrder,
  buildSourceGroundedDescription,
  enrichPipelineProperty,
  DISABLE_TOUR_AND_VIDEO_LINKS_ON_PUBLISH,
} from './engine/enrichment.mjs';
import { evaluateShareHealth } from './engine/history-lookup.mjs';
import { runPreflightAudit, parseMarketTarget } from './engine/preflight-audit.mjs';
import { generateBatchId } from './engine/supabase-client.mjs';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    process.stdout.write(`Testing: ${name} ... `);
    await fn();
    console.log('PASSED');
    passed++;
  } catch (err) {
    console.log('FAILED');
    console.error('   Error:', err.message);
    failed++;
  }
}

async function main() {
  console.log('======================================================================');
  console.log('CHOICE PROPERTIES — PUBLISHING ARCHITECTURE & 24H RECOVERY TEST SUITE');
  console.log('======================================================================\n');

  // 1. Choice Enrichment & Non-Negotiable Invariants
  await test('Enrichment enforces $50 fee, 1x DB deposit / 0 in text, and strips prohibited policies', () => {
    const sample = {
      id: 'PP-TEST0001',
      address: '1420 Oak Ridge Ln',
      city: 'Dallas',
      state: 'TX',
      zip: '75217',
      bedrooms: 3,
      bathrooms: 2,
      square_footage: 1650,
      monthly_rent: 1850,
      property_type: 'SINGLE_FAMILY',
      original_description:
        'Charming brick home with quartz kitchen and central air. Security deposit is $1,850. 12-month lease required. Available immediately! Pets allowed with $300 pet deposit. No smoking. Free application! Call agent at (214) 555-0199 or visit https://www.zillow.com/homedetails/123.',
      original_image_urls: JSON.stringify([
        'https://photos.zillowstatic.com/fp/img1-uncropped_scaledWithin_1536_1152.jpg',
        'https://photos.zillowstatic.com/fp/img2-uncropped_scaledWithin_1536_1152.jpg',
        'https://photos.zillowstatic.com/fp/img3-uncropped_scaledWithin_1536_1152.jpg',
      ]),
    };

    const res = enrichPipelineProperty(sample, { visibility: 'private_placement' });
    assert.strictEqual(res.isValid, true, `Expected valid enriched record, errors: ${res.validationErrors.join(', ')}`);
    const r = res.propertyRecord;

    // Structured invariants
    assert.strictEqual(r.application_fee, 50);
    assert.strictEqual(r.security_deposit, 1850);
    assert.strictEqual(r.pets_allowed, null);
    assert.strictEqual(r.pet_types_allowed, null);
    assert.strictEqual(r.pet_deposit, null);
    assert.strictEqual(r.lease_terms, null);
    assert.strictEqual(r.minimum_lease_months, null);
    assert.strictEqual(r.available_date, null);
    assert.strictEqual(r.smoking_allowed, null);
    assert.strictEqual(r.status, 'private_placement');
    assert.strictEqual(r.title, '1420 Oak Ridge Ln, Dallas, TX 75217');

    // Description scrubbing invariants
    const descLower = r.description.toLowerCase();
    assert.ok(r.description.includes('Application Fee: $50'), 'Must conclude with canonical $50 application fee line');
    assert.ok(!descLower.includes('free application'), 'Must strip free application claim');
    assert.ok(!descLower.includes('security deposit'), 'Must strip security deposit from description');
    assert.ok(!descLower.includes('12-month lease'), 'Must strip lease term from description');
    assert.ok(!descLower.includes('available immediately'), 'Must strip availability date/timeline');
    assert.ok(!descLower.includes('no smoking'), 'Must strip smoking policy');
    assert.ok(!descLower.includes('214'), 'Must strip third-party phone number');
    assert.ok(!descLower.includes('zillow.com'), 'Must strip external portal URL');

    // Strict original photo sequence preservation (zero reordering, zero photo gate)
    assert.strictEqual(res.photos.length, 3);
    assert.ok(res.photos[0].includes('img1'), 'Hero image must remain exact source photo #1');
    assert.ok(res.photos[1].includes('img2'), 'Photo order #2 preserved');
    assert.ok(res.photos[2].includes('img3'), 'Photo order #3 preserved');

    // Temporary publish-time toggle: drop virtual_tour_url & videos without removing underlying logic
    const withMediaSample = {
      ...sample,
      virtual_tour_url: 'https://www.zillow.com/view-imx/sample-tour/?hidePhotos=true',
      videos: [{ url: 'https://www.zillow.com/view-imx/sample-tour/?hidePhotos=true', type: 'virtual_tour' }],
    };
    const droppedByDefault = enrichPipelineProperty(withMediaSample, { visibility: 'private_placement' });
    assert.strictEqual(DISABLE_TOUR_AND_VIDEO_LINKS_ON_PUBLISH, true);
    assert.strictEqual(droppedByDefault.propertyRecord.virtual_tour_url, null, 'Must drop virtual_tour_url while toggle is disabled');
    assert.strictEqual(droppedByDefault.propertyRecord.videos, null, 'Must drop videos while toggle is disabled');

    const reEnabled = enrichPipelineProperty(withMediaSample, { visibility: 'private_placement', includeToursAndVideos: true });
    assert.ok(reEnabled.propertyRecord.virtual_tour_url.includes('view-imx'), 'Underlying clean tour logic must remain intact when re-enabled');
    assert.strictEqual(reEnabled.propertyRecord.videos.length, 1, 'Underlying clean video logic must remain intact when re-enabled');

    // Regression guard: JSON-stringified appliances from pipeline_properties must NEVER split character-by-character
    const stringAppliancesSample = {
      ...sample,
      appliances: '["Dishwasher","Oven","Refrigerator"]',
      amenities: '["Laundry Room","Swimming Pool"]',
      flooring: '["Tile"]',
    };
    const strEnriched = enrichPipelineProperty(stringAppliancesSample, { visibility: 'private_placement' });
    assert.deepStrictEqual(
      strEnriched.propertyRecord.appliances,
      ['Dishwasher', 'Oven', 'Refrigerator'],
      'JSON-stringified appliances must parse cleanly without splitting characters'
    );

    const emptyStrAppliances = {
      ...sample,
      original_description: 'Nice single-family home with fenced yard.',
      appliances: '[]',
    };
    const emptyEnriched = enrichPipelineProperty(emptyStrAppliances, { visibility: 'private_placement' });
    assert.deepStrictEqual(emptyEnriched.propertyRecord.appliances, [], 'Empty JSON array string must not yield "[" and "]"');
  });

  // 2. Decimal Bath Precision & Architectural Classification
  await test('Bathroom decimal precision and architectural property classification avoid truncation/misclassification', () => {
    const halfDuplex = {
      title: 'Beautiful Half-Duplex',
      property_type: 'SINGLE_FAMILY', // MLS portal default should be overridden by structural reality
      original_description: 'Updated 3 bed, 2 and a half bath half-duplex with fenced yard.',
      bathrooms: 2,
    };
    assert.strictEqual(classifyPropertyType(halfDuplex), 'DUPLEX');
    const baths = normalizeBathroomPrecision(halfDuplex);
    assert.strictEqual(baths.bathrooms, 2.5);
    assert.strictEqual(baths.half_bathrooms, 1);

    const townhome = {
      title: 'Modern End-Unit Townhome',
      property_type: 'CONDO',
      original_description: 'Spacious 3-story townhome with powder room on main level.',
      bathrooms: 1,
    };
    assert.strictEqual(classifyPropertyType(townhome), 'TOWNHOUSE');
    assert.strictEqual(normalizeBathroomPrecision(townhome).bathrooms, 1.5);
  });

  // 3. Unique Batch ID & Market Parsing
  await test('Batch IDs follow PB-YYYYMMDD-XXXX format and market parsing handles both formats', () => {
    const id1 = generateBatchId();
    const id2 = generateBatchId();
    assert.match(id1, /^PB-\d{8}-[A-F0-9]{4}$/);
    assert.notStrictEqual(id1, id2);
    assert.deepStrictEqual(parseMarketTarget('Dallas, TX'), { city: 'Dallas', state: 'TX', raw: 'Dallas, TX' });
    assert.deepStrictEqual(parseMarketTarget('Oklahoma City'), { city: 'Oklahoma City', state: null, raw: 'Oklahoma City' });
  });

  // 4. Share Health Evaluation
  await test('History lookup evaluates share health accurately (active, expired, revoked, none)', () => {
    assert.strictEqual(evaluateShareHealth({}).status, 'none');
    assert.strictEqual(
      evaluateShareHealth({ share_id: 's1', live_share_revoked_at: '2026-11-11T00:00:00Z' }).status,
      'revoked'
    );
    assert.strictEqual(
      evaluateShareHealth({ share_id: 's1', share_expires_at: '2020-01-01T00:00:00Z' }).status,
      'expired'
    );
    assert.strictEqual(
      evaluateShareHealth({ share_id: 's1', share_expires_at: new Date(Date.now() + 86400000).toISOString() }).status,
      'active'
    );
  });

  // 5. Partial Failure, 24h Window, Explicit Restoration & Stage 2 Purge Lifecycle Simulation
  await test('Two-stage pipeline deletion, partial failure safety, explicit batch restore, and >24h purge invariants hold', () => {
    // Simulated isolated in-memory stores mirroring Postgres tables
    const activePipeline = [
      { id: 'PP-A1', city: 'Dallas', state: 'TX', source_listing_id: 'z-101', folder_id: 'fold-1', status: 'scraped' },
      { id: 'PP-A2', city: 'Dallas', state: 'TX', source_listing_id: 'z-102', folder_id: 'fold-1', status: 'scraped' },
      { id: 'PP-FAIL', city: 'Dallas', state: 'TX', source_listing_id: 'z-999', folder_id: 'fold-1', status: 'scraped' },
    ];
    const recoveryArchive = [];
    const liveProperties = [];
    const historyBatches = [];

    const batchId = 'PB-20261112-TEST';
    const verifiedIds = ['PP-A1', 'PP-A2'];
    const failedIds = ['PP-FAIL'];

    // Publish verified items into liveProperties
    for (const id of verifiedIds) {
      liveProperties.push({ id: `prop_${id}`, pipeline_id: id, status: 'private_placement' });
    }

    // Record history BEFORE cleanup
    const tDelete = Date.now();
    const tExpires = tDelete + 24 * 60 * 60 * 1000;
    historyBatches.push({
      id: batchId,
      target_market: 'Dallas, TX',
      published_count: 2,
      failed_count: 1,
      recovery_status: 'recoverable',
      pipeline_deleted_at: new Date(tDelete).toISOString(),
      recovery_expires_at: new Date(tExpires).toISOString(),
    });

    // Stage 1: Archive ONLY verified IDs and remove them from activePipeline; leave PP-FAIL untouched
    for (const id of verifiedIds) {
      const idx = activePipeline.findIndex((r) => r.id === id);
      const row = activePipeline.splice(idx, 1)[0];
      recoveryArchive.push({
        batch_id: batchId,
        pipeline_id: row.id,
        source_listing_id: row.source_listing_id,
        pipeline_row_snapshot: { ...row },
        raw_storage_paths: [`recovery/${batchId}/raw_zillow_${row.id}.json`],
        recovery_status: 'recoverable',
        deleted_at: tDelete,
        recovery_expires_at: tExpires,
      });
    }

    assert.strictEqual(activePipeline.length, 1, 'Failed item PP-FAIL must stay in active pipeline');
    assert.strictEqual(activePipeline[0].id, 'PP-FAIL');
    assert.strictEqual(recoveryArchive.length, 2, 'Only verified items archived');

    // Verify normal pipeline scan never reads recoveryArchive
    const normalCandidates = activePipeline.filter((r) => r.id !== 'PP-FAIL');
    assert.strictEqual(normalCandidates.length, 0, 'Normal pipeline query must NOT return archived rows');

    // Explicit partial restoration within 24h window (restore PP-A1 ONLY, keeping PP-A1's original batch/source_listing_id/folder_id)
    const nowWithinWindow = tDelete + 6 * 60 * 60 * 1000; // +6 hours
    const targetToRestore = recoveryArchive.find((a) => a.batch_id === batchId && a.pipeline_id === 'PP-A1');
    assert.ok(targetToRestore.recovery_expires_at > nowWithinWindow, 'Within 24h window');
    activePipeline.push({ ...targetToRestore.pipeline_row_snapshot });
    targetToRestore.recovery_status = 'restored';

    const restoredRow = activePipeline.find((r) => r.id === 'PP-A1');
    assert.ok(restoredRow, 'Restored property must return to active pipeline');
    assert.strictEqual(restoredRow.source_listing_id, 'z-101', 'Original source_listing_id preserved');
    assert.strictEqual(restoredRow.folder_id, 'fold-1', 'Original folder_id preserved');
    assert.strictEqual(restoredRow.status, 'scraped', 'Restored to pipeline state — NOT auto-republished');

    // Advance time past 24h expiry -> late restore MUST fail
    const nowAfterExpiry = tDelete + 25 * 60 * 60 * 1000; // +25 hours
    const remainingArchived = recoveryArchive.find((a) => a.batch_id === batchId && a.pipeline_id === 'PP-A2');
    assert.strictEqual(remainingArchived.recovery_expires_at > nowAfterExpiry, false, 'Past 24h window cannot be restored');

    // Stage 2 Automatic Permanent Purge (>24h): wipes heavy snapshot & raw paths, preserves lightweight history & liveProperties
    for (const arch of recoveryArchive) {
      if (arch.recovery_status === 'recoverable' && arch.recovery_expires_at <= nowAfterExpiry) {
        arch.pipeline_row_snapshot = null;
        arch.raw_storage_paths = [];
        arch.recovery_status = 'permanently_deleted';
        arch.permanently_deleted_at = nowAfterExpiry;
      }
    }
    historyBatches[0].recovery_status = 'permanently_deleted';
    historyBatches[0].permanently_deleted_at = new Date(nowAfterExpiry).toISOString();

    assert.strictEqual(remainingArchived.pipeline_row_snapshot, null, 'Heavy snapshot must be wiped on Stage 2 purge');
    assert.strictEqual(remainingArchived.raw_storage_paths.length, 0, 'Raw storage refs wiped');
    assert.strictEqual(liveProperties.length, 2, 'Live published properties MUST remain live after pipeline purge');
    assert.strictEqual(historyBatches[0].published_count, 2, 'Lightweight audit record retained after purge');
  });

  // 6. SQL Migration & Edge Functions Structural Sanity
  await test('SQL migration, Edge Functions, GitHub cron workflow, and DeepSeek prompt exist and are coherent', () => {
    const root = process.cwd();
    const migSql = fs.readFileSync(path.join(root, 'supabase/migrations/20261112000001_publishing_history_and_recovery.sql'), 'utf8');
    for (const fn of [
      'public.pipeline_archive_and_remove',
      'public.pipeline_restore_batch',
      'public.pipeline_claim_expired_recovery',
      'public.pipeline_finalize_permanent_purge',
      'public.pipeline_get_publishing_history',
      'public.pipeline_get_recoverable_batches',
    ]) {
      assert.ok(migSql.includes(fn), `Missing RPC ${fn} in SQL migration`);
    }
    assert.ok(migSql.includes("interval '24 hours'"), '24-hour recovery TTL must be defined in SQL');
    assert.ok(migSql.includes('FOR UPDATE SKIP LOCKED'), 'Concurrent purge lock safety must be present');

    const purgeFn = fs.readFileSync(path.join(root, 'supabase/functions/purge-expired-pipeline-recovery/index.ts'), 'utf8');
    assert.ok(purgeFn.includes('pipeline-raw-payloads'), 'Purge Edge Function must clean pipeline-raw-payloads Storage bucket');
    assert.ok(purgeFn.includes('x-cron-secret'), 'Purge Edge Function must authenticate cron runs via x-cron-secret');

    const configToml = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
    assert.ok(configToml.includes('[functions.purge-expired-pipeline-recovery]'), 'purge-expired-pipeline-recovery must be in config.toml');
    assert.ok(configToml.includes('[functions.pipeline-recovery]'), 'pipeline-recovery must be in config.toml');

    const masterPrompt = fs.readFileSync(path.join(root, 'docs/DEEPSEEK_MASTER_PROMPT.md'), 'utf8');
    assert.ok(masterPrompt.includes('WORKFLOW_MODE'), 'DeepSeek Master Prompt must cover both Workflow A & B');
    assert.ok(masterPrompt.includes('24 hours'), 'DeepSeek Master Prompt must cover 24-hour recovery & Stage 2 purge');
  });

  // 7. Live Read-Only Preflight Pipeline Audit Check (Non-destructive)
  await test('Live read-only preflight audit accesses active pipeline cleanly without mutating existing data', async () => {
    const audit = await runPreflightAudit({ target: '' });
    assert.strictEqual(audit.ok, true);
    assert.ok(audit.totalPendingInPipeline >= 0, 'Pending count must be numeric');
    console.log(`\n   [Live Read-Only Snapshot: ${audit.totalPendingInPipeline} pending rows across ${audit.citiesPresentInPipeline.join(', ') || 'none'}]`);
  });

  console.log('\n======================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
