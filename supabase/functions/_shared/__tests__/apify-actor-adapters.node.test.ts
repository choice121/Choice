import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DETAIL_ACTOR_ID,
  DEFAULT_SEARCH_ACTOR_ID,
  buildValidatedZillowSearchUrls,
  buildZillowSearchQueryState,
  extractStage1DetailUrls,
  resolveActorAdapterSelection,
} from '../apify-actor-adapters.ts';
import {
  buildApifyActorInput,
  extractOrderedPhotos,
  mergeStage2RecordWithExisting,
} from '../apify-normalizer.ts';

function decodeSearchQueryState(urlStr: string): Record<string, any> {
  const u = new URL(urlStr);
  const raw = u.searchParams.get('searchQueryState');
  assert.ok(raw, `Expected searchQueryState in ${urlStr}`);
  return JSON.parse(raw);
}

test('buildZillowSearchQueryState enforces rental-only locks and maps customer rent/beds/baths/types/FRBO criteria', () => {
  const qs = buildZillowSearchQueryState({
    min_rent: 1400,
    max_rent: 1950,
    exact_beds: 3,
    min_baths: 2.5,
    property_types: ['SINGLE_FAMILY', 'TOWNHOUSE'],
    owner_only: true,
  });

  const f = qs.filterState as Record<string, any>;
  assert.equal(f.isForRent.value, true);
  assert.equal(f.isForSaleByAgent.value, false);
  assert.equal(f.isForSaleByOwner.value, false);
  assert.equal(f.isNewConstruction.value, false);
  assert.equal(f.isAuction.value, false);
  assert.equal(f.isForSaleForeclosure.value, false);
  assert.equal(f.isComingSoon.value, false);

  assert.deepEqual(f.monthlyPayment, { min: 1400, max: 1950 });
  assert.deepEqual(f.beds, { min: 3, max: 3 });
  assert.deepEqual(f.baths, { min: 2.5 });
  assert.equal(f.isSingleFamily.value, true);
  assert.equal(f.isTownhouse.value, true);
  assert.equal(f.isMultiFamily.value, false);
  assert.equal(f.isApartment.value, false);
  assert.equal(f.isLotLand.value, false);
  assert.equal(f.isManufactured.value, false);
  assert.equal(f.isForRentByOwner.value, true);
});

test('maxcopell two-stage production default resolves Stage 1 searchUrls+resultsLimit and Stage 2 propertyStatus: FOR_RENT', () => {
  const sel = resolveActorAdapterSelection({
    taskConfig: { locations: ['Yukon, OK'], target_qty: 12 },
    providerConfig: {
      actor_id: DEFAULT_SEARCH_ACTOR_ID,
      detail_actor_id: DEFAULT_DETAIL_ACTOR_ID,
      two_stage_details: true,
      allow_experimental_actor: false,
    },
  });

  assert.equal(sel.ok, true);
  assert.equal(sel.actorId, DEFAULT_SEARCH_ACTOR_ID);
  assert.equal(sel.twoStageEnabled, true);
  assert.equal(sel.detailActorId, DEFAULT_DETAIL_ACTOR_ID);
  assert.equal(sel.scrapeStage, 'search');
  assert.equal(sel.extractionDepth, 'full_data');

  const stage1Input = buildApifyActorInput({
    locations: ['Yukon, OK'],
    target_qty: 12,
    min_rent: 1400,
    max_rent: 1950,
  });
  assert.equal(stage1Input.resultsLimit, 12);
  assert.equal(stage1Input.extractionMethod, 'PAGINATION');
  assert.equal(stage1Input.maxItems, undefined);
  const urls = stage1Input.searchUrls as Array<{ url: string }>;
  assert.equal(urls.length, 1);
  assert.ok(urls[0].url.startsWith('https://www.zillow.com/yukon-ok/rentals/?searchQueryState='));
  const decoded = decodeSearchQueryState(urls[0].url);
  assert.equal(decoded.filterState.isForRent.value, true);
  assert.deepEqual(decoded.filterState.monthlyPayment, { min: 1400, max: 1950 });

  const stage2Sel = resolveActorAdapterSelection({ requestedActorId: DEFAULT_DETAIL_ACTOR_ID });
  assert.equal(stage2Sel.ok, true);
  assert.equal(stage2Sel.scrapeStage, 'detail');

  const stage2Input = buildApifyActorInput(
    { locations: ['Yukon, OK'] },
    {},
    {
      actorId: DEFAULT_DETAIL_ACTOR_ID,
      stage: 'detail',
      detailUrls: [
        'https://www.zillow.com/homedetails/608-Maple-Ave-Yukon-OK-73099/12345_zpid/?utm=x',
        'http://127.0.0.1/bad',
      ],
    },
  );
  assert.equal(stage2Input.propertyStatus, 'FOR_RENT');
  assert.equal(stage2Input.extractBuildingUnits, 'disabled');
  assert.deepEqual(stage2Input.startUrls, [
    { url: 'https://www.zillow.com/homedetails/608-Maple-Ave-Yukon-OK-73099/12345_zpid/' },
  ]);
  assert.equal(stage2Sel.adapter!.validateInput(stage2Input).ok, true);

  assert.equal(
    stage2Sel.adapter!.validateInput({ startUrls: [{ url: 'https://www.zillow.com/x/' }], propertyStatus: 'RECENTLY_SOLD' }).ok,
    false,
  );
  assert.equal(stage2Sel.adapter!.validateInput({ propertyStatus: 'FOR_RENT' }).ok, false);
});

test('experimental actors are blocked without explicit allow_experimental_actor opt-in and emit valid rental inputs when opted in', () => {
  const experimentalIds = [
    'igolaizola/zillow-scraper-ppe',
    'automation_craft/zillow-scraper',
    'cliqtomedia/zillow-scraper',
  ];

  for (const actorId of experimentalIds) {
    const blocked = resolveActorAdapterSelection({ requestedActorId: actorId });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.error, 'experimental_actor_opt_in_required');

    const allowed = resolveActorAdapterSelection({
      requestedActorId: actorId,
      allowExperimentalActor: true,
      taskConfig: { locations: ['Charlotte, NC'], target_qty: 10 },
    });
    assert.equal(allowed.ok, true);
    assert.equal(allowed.adapter?.isExperimental, true);
    assert.equal(allowed.scrapeStage, 'single');

    const input = buildApifyActorInput(
      { locations: ['Charlotte, NC'], min_rent: 1500, max_rent: 2100, target_qty: 10 },
      {},
      { actorId },
    );
    assert.equal(allowed.adapter!.validateInput(input).ok, true);
  }

  const igInput = buildApifyActorInput({ locations: ['Charlotte, NC'], min_rent: 1500 }, {}, { actorId: 'igolaizola/zillow-scraper-ppe' });
  assert.equal(igInput.operation, 'rent');
  assert.equal(igInput.fetchDetails, true);

  const acInput = buildApifyActorInput({ locations: ['Charlotte, NC'], owner_only: true }, {}, { actorId: 'automation_craft/zillow-scraper' });
  assert.equal(acInput.listingStatus, 'forRent');
  assert.equal(acInput.includeInsights, false);
  assert.equal(acInput.rentByOwner, true);

  const acInsights = buildApifyActorInput(
    { locations: ['Charlotte, NC'], extraction_depth: 'with_insights' },
    {},
    { actorId: 'automation_craft/zillow-scraper' },
  );
  assert.equal(acInsights.includeInsights, true);
});

test('extractStage1DetailUrls triages Stage-1 cards accurately and handles zero-candidate sets gracefully', () => {
  const triage = extractStage1DetailUrls(
    [
      // Sale-only -> skipped
      { zpid: 1, homeStatus: 'FOR_SALE', price: 325000, detailUrl: 'https://www.zillow.com/homedetails/1_zpid/' },
      // Bed mismatch -> skipped
      { zpid: 2, homeStatus: 'FOR_RENT', bedrooms: 2, bathrooms: 2, unformattedPrice: 1700, detailUrl: 'https://www.zillow.com/homedetails/2_zpid/' },
      // Missing detail attributionInfo (only fetched in Stage 2) -> RETAINED!
      { zpid: 3, homeStatus: 'FOR_RENT', bedrooms: 3, bathrooms: 2.5, unformattedPrice: 1800, homeType: 'SINGLE_FAMILY', detailUrl: 'https://www.zillow.com/homedetails/3_zpid/?utm=card' },
      // Duplicate canonical URL -> deduplicated
      { zpid: 3, homeStatus: 'FOR_RENT', bedrooms: 3, bathrooms: 2.5, unformattedPrice: 1800, detailUrl: 'https://www.zillow.com/homedetails/3_zpid/' },
      // Fallback via zpid when detailUrl omitted
      { zpid: 4, isForRent: true, bedrooms: 3, bathrooms: 2, unformattedPrice: 1850 },
    ],
    { exact_beds: 3, min_rent: 1500, max_rent: 2000, property_types: ['SINGLE_FAMILY'] },
  );

  assert.equal(triage.totalScanned, 5);
  assert.equal(triage.skippedSaleOnly, 1);
  assert.equal(triage.skippedFilterMismatch, 1);
  assert.deepEqual(triage.candidateUrls, [
    'https://www.zillow.com/homedetails/3_zpid/',
    'https://www.zillow.com/homedetails/4_zpid/',
  ]);

  const emptyTriage = extractStage1DetailUrls(
    [{ zpid: 9, homeStatus: 'RECENTLY_SOLD', detailUrl: 'https://www.zillow.com/homedetails/9_zpid/' }],
    { exact_beds: 3 },
  );
  assert.equal(emptyTriage.candidateUrls.length, 0);
  assert.equal(emptyTriage.skippedSaleOnly, 1);

  const built = buildValidatedZillowSearchUrls({ locations: ['Oklahoma City, OK'] });
  assert.equal(built.length, 1);
  assert.ok(built[0].url.startsWith('https://www.zillow.com/oklahoma-city-ok/rentals/?searchQueryState='));
});

test('extractOrderedPhotos preserves >50 high-res Zillow photos in exact order without duplicating collections', () => {
  const responsivePhotosOriginalRatio = Array.from({ length: 65 }, (_, i) => ({
    caption: `Room ${i + 1}`,
    subjectType: i === 0 ? 'Exterior' : 'Interior',
    url: `https://photos.zillowstatic.com/fp/img_${i + 1}-p_e.jpg`,
    mixedSources: {
      jpeg: [
        { width: 384, url: `https://photos.zillowstatic.com/fp/img_${i + 1}-cc_ft_384.jpg` },
        { width: 1536, url: `https://photos.zillowstatic.com/fp/img_${i + 1}-cc_ft_1536.jpg` },
      ],
    },
  }));

  // Duplicate lower-priority collection with thumbnails that must NOT be concatenated or override
  const carouselPhotos = responsivePhotosOriginalRatio.slice(0, 10).map((_, i) => ({
    url: `https://photos.zillowstatic.com/fp/img_${i + 1}-p_e.jpg`,
  }));

  const extracted = extractOrderedPhotos(
    {
      responsivePhotosOriginalRatio,
      carouselPhotos,
      imgSrc: 'https://photos.zillowstatic.com/fp/fallback-card.jpg',
    },
    {},
  );

  assert.equal(extracted.length, 65);
  assert.equal(extracted[0].url, 'https://photos.zillowstatic.com/fp/img_1-cc_ft_1536.jpg');
  assert.equal(extracted[64].url, 'https://photos.zillowstatic.com/fp/img_65-cc_ft_1536.jpg');
  assert.equal(extracted.some((p) => p.url.includes('fallback-card')), false);
});

test('mergeStage2RecordWithExisting upgrades equal-count Stage-1 thumbnails to Stage-2 high-res Zillow URLs', () => {
  const existingRow = {
    original_image_urls: JSON.stringify([
      'https://photos.zillowstatic.com/fp/a-p_e.jpg',
      'https://photos.zillowstatic.com/fp/b-p_e.jpg',
      'https://photos.zillowstatic.com/fp/c-p_e.jpg',
    ]),
    edited_fields: [],
    field_provenance: { imported_at: '2026-11-22T00:00:00Z' },
  };
  const incomingRecord = {
    original_image_urls: JSON.stringify([
      'https://photos.zillowstatic.com/fp/a-cc_ft_1536.jpg',
      'https://photos.zillowstatic.com/fp/b-cc_ft_1536.jpg',
      'https://photos.zillowstatic.com/fp/c-cc_ft_1536.jpg',
    ]),
    field_provenance: { stage2_enriched: true },
  };

  const merged = mergeStage2RecordWithExisting(existingRow, incomingRecord, { isStage2Detail: true });
  assert.equal(merged.changed, true);
  assert.ok(merged.upgradedFields.includes('original_image_urls'));
  assert.equal(merged.patch.original_image_urls, incomingRecord.original_image_urls);
  assert.equal(merged.patch.photo_upload_status, 'complete');
});
