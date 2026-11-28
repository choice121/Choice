#!/usr/bin/env node
/**
 * Unit & integration tests for src/extractors/shared-card-engine.js
 * Verifies Zero-Tab Search-Card Quick-Save payload construction,
 * batch-scoped visual state checks, prohibited profile screening,
 * and mobile/desktop photo cap parity.
 */
import assert from 'assert';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const extractors = require('../chrome-extension/shared-extractors.js');

// Ensure globalThis.CP_Extractors is registered for shared-card-engine.js
globalThis.CP_Extractors = extractors;
const { createEngine } = require('../src/extractors/shared-card-engine.js');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass += 1;
    console.log('OK   ' + name);
  } catch (err) {
    fail += 1;
    console.error('FAIL ' + name + ' - ' + err.message);
  }
}

console.log('CP_CardEngine verification suite\n');

test('buildSubmitPayload preserves HDP richness, lossless details, batch scope, and zero_tab_card_save provenance', () => {
  const engine = createEngine();
  // Set up minimal ctx via start or internal closure via a direct _testHooks scenario:
  // Re-initialize with mock ctx using start() on a mock minimal environment or direct context
  const html = '<html><body><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({
    props: {
      pageProps: {
        componentProps: {
          gdpClientCache: JSON.stringify({
            k: {
              property: {
                zpid: 88112233,
                homeStatus: 'FOR_RENT',
                address: { streetAddress: '608 Maple Ave', city: 'Yukon', state: 'OK', zipcode: '73099' },
                price: 1595,
                bedrooms: 3,
                bathrooms: 2.5,
                livingArea: 1450,
                homeType: 'DUPLEX',
                description: 'Great duplex with 2.5 baths and fenced yard.',
                responsivePhotos: [
                  { caption: 'Front', subjectType: 'Exterior', mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/11112222333344445555666677778811-uncropped_scaled_within_1536_1152.jpg' }] } },
                  { caption: 'Living', subjectType: 'Living Room', mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/11112222333344445555666677778812-uncropped_scaled_within_1536_1152.jpg' }] } },
                  { caption: 'Kitchen', subjectType: 'Kitchen', mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/11112222333344445555666677778813-uncropped_scaled_within_1536_1152.jpg' }] } },
                  { caption: 'Bath', subjectType: 'Bathroom', mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/11112222333344445555666677778814-uncropped_scaled_within_1536_1152.jpg' }] } }
                ],
                attributionInfo: { brokerName: 'Oakwood Realty', agentName: 'Sam Agent' }
              }
            }
          })
        }
      }
    }
  }) + '</script></body></html>';

  const hdp = extractors.extractZillowFromHtml(html, 'https://www.zillow.com/homedetails/608-Maple-Ave-Yukon-OK-73099/88112233_zpid/');
  const hydrated = extractors.hydrateZillowCardPayload(hdp, { zpid: '88112233', lat: 35.506, lng: -97.762 }, { zpid: '88112233' }, '');

  const payload = engine._testHooks.buildSubmitPayload(hydrated, 'tier1_ssr_html');
  assert.strictEqual(payload.source, 'zillow');
  assert.strictEqual(payload.source_listing_id, '88112233');
  assert.strictEqual(payload.address, '608 Maple Ave');
  assert.strictEqual(payload.city, 'Yukon');
  assert.strictEqual(payload.state, 'OK');
  assert.strictEqual(payload.zip, '73099');
  assert.strictEqual(payload.lat, 35.506);
  assert.strictEqual(payload.lng, -97.762);
  assert.strictEqual(payload.bathrooms, 2.5);
  assert.strictEqual(payload.half_bathrooms, 1);
  assert.strictEqual(payload.property_type, 'DUPLEX');
  assert.strictEqual(payload.application_fee, 50);
  assert.strictEqual(payload.security_deposit, 1595);
  assert.strictEqual(payload.field_provenance.hydration_tier, 'tier1_ssr_html');
  assert.strictEqual(payload.field_provenance.zero_tab_card_save, true);
  assert.ok(payload.field_provenance.save_nonce);
  const imgs = JSON.parse(payload.original_image_urls);
  assert.strictEqual(imgs.length, 4);
  assert.strictEqual(imgs[0].caption, 'Front');
  assert.strictEqual(imgs[0].room_label, 'Exterior');
});

test('computeCardVisualState distinguishes published, in-batch, other-batch, for-sale, prohibited, and ready cards', () => {
  const engine = createEngine();
  engine._testHooks.setProhibitedProfiles([
    { canonical_name: 'Blocked Manager', aliases: ['Blocked PM'], zillow_profile_urls: [], match_mode: 'token_phrase' }
  ]);
  engine._testHooks.setBatchCheckCache({
    'inbox:1001': { exists_in_scope: false, published: true, other_batches: [] },
    'inbox:1002': { exists_in_scope: true, published: false, batch_id: '4821', other_batches: [] },
    'inbox:1003': { exists_in_scope: false, published: false, other_batches: ['1905'] }
  });

  const sPublished = engine._testHooks.computeCardVisualState({ zpid: '1001', card: { zpid: '1001', statusType: 'FOR_RENT' } });
  assert.strictEqual(sPublished.kind, 'published');

  const sInBatch = engine._testHooks.computeCardVisualState({ zpid: '1002', card: { zpid: '1002', statusType: 'FOR_RENT' } });
  assert.strictEqual(sInBatch.kind, 'in_pipeline');
  assert.ok(sInBatch.label.includes('#4821'));

  const sOtherBatch = engine._testHooks.computeCardVisualState({
    zpid: '1003',
    card: { zpid: '1003', statusType: 'FOR_RENT', carousel_photos: ['https://photos.zillowstatic.com/fp/a.jpg', 'https://photos.zillowstatic.com/fp/b.jpg'] }
  });
  assert.strictEqual(sOtherBatch.kind, 'ready');
  assert.strictEqual(sOtherBatch.subLabel, '#1905');
  assert.ok(sOtherBatch.label.includes('2📸'));

  const sForSale = engine._testHooks.computeCardVisualState({ zpid: '1004', card: { zpid: '1004', statusType: 'FOR_SALE' } });
  assert.strictEqual(sForSale.kind, 'for_sale');

  const sBlocked = engine._testHooks.computeCardVisualState({ zpid: '1005', card: { zpid: '1005', statusType: 'FOR_RENT', broker_name: 'Blocked PM Homes' } });
  assert.strictEqual(sBlocked.kind, 'prohibited');
});

test('syncSettings updates card engine filter defaults cleanly', () => {
  const engine = createEngine();
  engine.syncSettings({
    offlineQueue: false,
    autoSkipForSale: false,
    autoSkipDuplicates: true,
    autoSkipProhibited: true,
    bgTabFallback: true
  });
  const s = engine._testHooks.getSettings();
  assert.strictEqual(s.offlineQueue, false);
  assert.strictEqual(s.autoSkipForSale, false);
  assert.strictEqual(s.autoSkipDuplicates, true);
  assert.strictEqual(s.autoSkipProhibited, true);
  assert.strictEqual(s.bgTabFallback, true);
});

test('registerFavoritesItems + countUnsavedAll include off-screen paginated Favorites while respecting skips', () => {
  const engine = createEngine();
  engine._testHooks.setFavoritesState({ isFavoritesMode: true, reportedTotal: 32 });
  engine._testHooks.setProhibitedProfiles([
    { canonical_name: 'Blocked PM', aliases: ['Blocked PM'], zillow_profile_urls: [], match_mode: 'token_phrase' }
  ]);
  engine._testHooks.setBatchCheckCache({
    'inbox:7002': { exists_in_scope: true, published: false, batch_id: null, other_batches: [] }
  });

  const added = engine._testHooks.registerFavoritesItems([
    { zpid: '7001', address: '100 First St', statusType: 'FOR_RENT', monthly_rent: 1500 },
    { zpid: '7002', address: '200 Second St', statusType: 'FOR_RENT', monthly_rent: 1600 },
    { zpid: '7003', address: '300 Sale St', statusType: 'FOR_SALE', price: 350000 },
    { zpid: '7004', address: '400 Blocked St', statusType: 'FOR_RENT', broker_name: 'Blocked PM' },
    { zpid: '7005', address: '500 Offscreen Fifth St', statusType: 'FOR_RENT', monthly_rent: 1850 }
  ]);
  assert.deepStrictEqual(added, ['7001', '7002', '7003', '7004', '7005']);
  const unsaved = engine._testHooks.countUnsavedAll();
  assert.deepStrictEqual(unsaved, ['7001', '7005']);
});

test('isLosslessHdpPayload rejects sparse card stubs and accepts full HDP SSR/GraphQL/bg-tab records', () => {
  const engine = createEngine();
  assert.strictEqual(engine._testHooks.isLosslessHdpPayload({ address: '1 Main St' }, 'tier0_card_stub', null), false);
  assert.strictEqual(
    engine._testHooks.isLosslessHdpPayload(
      {
        address: '1 Main St',
        description: 'Bright 3 bedroom brick home with updated kitchen.',
        original_image_urls: JSON.stringify(['https://photos.zillowstatic.com/fp/a.jpg', 'https://photos.zillowstatic.com/fp/b.jpg'])
      },
      'tier0_cache',
      null
    ),
    true
  );
  assert.strictEqual(
    engine._testHooks.isLosslessHdpPayload({ address: '1 Main St' }, 'tier1_ssr_html', { zpid: '1' }),
    true
  );
});

test('applySubmissionResult logs explicit failedRecords on failure and clears on retry success (zero silent failures)', () => {
  const engine = createEngine();
  engine._testHooks.registerFavoritesItems([
    { zpid: '8001', address: '800 Retry Ave', statusType: 'FOR_RENT', monthly_rent: 1900 }
  ]);
  const rec = { zpid: '8001', card: { zpid: '8001', address: '800 Retry Ave' } };

  const resFail = engine._testHooks.applySubmissionResult({ rec, zpid: '8001', warnings: [] }, { ok: false, error: 'HTTP 502 Gateway Timeout' });
  assert.strictEqual(resFail, 'failed');
  let failed = engine._testHooks.getFailedRecords();
  assert.strictEqual(failed.length, 1);
  assert.strictEqual(failed[0].zpid, '8001');
  assert.ok(failed[0].reason.includes('502'));

  const resOk = engine._testHooks.applySubmissionResult({ rec, zpid: '8001', warnings: [] }, { ok: true, id: 'uuid-8001' });
  assert.strictEqual(resOk, 'saved');
  failed = engine._testHooks.getFailedRecords();
  assert.strictEqual(failed.length, 0);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
