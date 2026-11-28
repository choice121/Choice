import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApifyActorInput,
  mergeLevel2LocationEnrichment,
  normalizeApifyZillowItem,
  resolveActorAdapterSelection,
  resolveExtractionDepth,
} from '../apify-normalizer.ts';
import { buildPipelineRecord } from '../pipeline-record.ts';
import {
  fetchLevel2CensusSchoolDistrict,
  fetchLevel2GeoapifyInsights,
  summarizeNearbyPlacesForInsights,
} from '../location-intelligence.ts';

const SAMPLE_LISTING_WITH_INSIGHTS_AND_TRAPS: Record<string, unknown> = {
  zpid: 88224466,
  detailUrl: 'https://www.zillow.com/homedetails/310-Birch-St-Yukon-OK-73099/88224466_zpid/',
  homeStatus: 'FOR_RENT',
  homeType: 'SINGLE_FAMILY',
  price: '$1,800/mo',
  bedrooms: 3,
  bathrooms: 2.5,
  livingArea: 1850,
  latitude: 35.5067,
  longitude: -97.7625,
  address: {
    streetAddress: '310 Birch St',
    city: 'Yukon',
    state: 'OK',
    zipcode: '73099',
  },
  description: 'Updated 3 bed, 2.5 bath home with attached garage and fenced backyard.',
  resoFacts: {
    cooling: ['Central Air'],
    heating: ['Forced Air'],
    appliances: ['Dishwasher', 'Gas Range'],
    highSchoolDistrict: 'Yukon Public Schools',
  },
  schools: [
    { name: 'Yukon Middle School', grades: '6-8', rating: 8, distance: 1.2, district: 'Yukon Public Schools' },
  ],
  // Legit Level-2 livability insights
  walkScore: 78,
  transitScore: 62,
  bikeScore: 54,
  walkScoreDescription: 'Very Walkable',
  // Excluded Zestimates / Rent Benchmarks / Dates that MUST ALWAYS be discarded
  zestimate: 312000,
  rentZestimate: 2150,
  rentBenchmark: 2100,
  rentComps: [{ address: '312 Birch St', price: 2100 }],
  grossRentalYield: 7.4,
  datePosted: '2026-11-10',
  priceHistory: [{ date: '2026-10-01', price: 1850 }],
  taxHistory: [{ time: 1700000000, taxPaid: 2900 }],
};

test('resolveExtractionDepth defaults to full_data and respects explicit Level-1 opt-outs over provider default', () => {
  assert.equal(resolveExtractionDepth({}, {}), 'full_data');
  assert.equal(resolveExtractionDepth({ extraction_depth: 'with_insights' }, {}), 'with_insights');
  assert.equal(resolveExtractionDepth({ include_property_insights: true }, {}), 'with_insights');
  assert.equal(resolveExtractionDepth({ include_insights: true }, {}), 'with_insights');
  assert.equal(resolveExtractionDepth({}, { default_extraction_depth: 'with_insights' }), 'with_insights');
  // Explicit task opt-out wins over provider default
  assert.equal(
    resolveExtractionDepth({ include_property_insights: false }, { default_extraction_depth: 'with_insights' }),
    'full_data',
  );
  assert.equal(
    resolveExtractionDepth({ extraction_depth: 'full_data' }, { default_extraction_depth: 'with_insights' }),
    'full_data',
  );
});

test('actor adapters cleanly wire Level 1 vs Level 2 insight toggles', () => {
  const acLevel1 = buildApifyActorInput(
    { locations: ['Yukon, OK'], allow_experimental_actor: true },
    {},
    { actorId: 'automation_craft/zillow-scraper' },
  );
  assert.equal(acLevel1.includeInsights, false);

  const acLevel2 = buildApifyActorInput(
    { locations: ['Yukon, OK'], extraction_depth: 'with_insights', allow_experimental_actor: true },
    {},
    { actorId: 'automation_craft/zillow-scraper' },
  );
  assert.equal(acLevel2.includeInsights, true);

  const cliqLevel1 = buildApifyActorInput(
    { locations: ['Yukon, OK'], allow_experimental_actor: true },
    {},
    { actorId: 'cliqtomedia/zillow-scraper' },
  );
  assert.equal(cliqLevel1.includeWalkScore, false);
  assert.equal(cliqLevel1.includeNearbyHomes, false);

  const cliqLevel2 = buildApifyActorInput(
    { locations: ['Yukon, OK'], include_property_insights: true, allow_experimental_actor: true },
    {},
    { actorId: 'cliqtomedia/zillow-scraper' },
  );
  assert.equal(cliqLevel2.includeWalkScore, true);
  assert.equal(cliqLevel2.includeNearbyHomes, false);

  const prodSel = resolveActorAdapterSelection({
    taskConfig: { locations: ['Yukon, OK'], extraction_depth: 'with_insights' },
  });
  assert.equal(prodSel.ok, true);
  assert.equal(prodSel.extractionDepth, 'with_insights');
});

test('Level 1 (full_data) suppresses unsolicited insight scores while Level 2 (with_insights) admits scores & discards Zestimates/benchmarks/dates', () => {
  // ── Level 1 (default: full_data) ───────────────────────────────────────────
  const level1Norm = normalizeApifyZillowItem(SAMPLE_LISTING_WITH_INSIGHTS_AND_TRAPS, {
    extractionDepth: 'full_data',
  });
  assert.equal(level1Norm.ok, true);
  if (!level1Norm.ok) throw new Error('Expected Level 1 normalization to succeed');

  const level1Rec = buildPipelineRecord(level1Norm.pipelineInput);
  assert.equal(level1Rec.monthly_rent, 1800);
  assert.equal(level1Rec.location_context, null);
  const l1Loc = level1Rec.location_details as Record<string, unknown>;
  assert.equal(l1Loc.walk_score, undefined);
  assert.equal(l1Loc.transit_score, undefined);
  assert.equal(l1Loc.bike_score, undefined);
  assert.equal(l1Loc.insights, undefined);
  assert.equal((level1Rec.field_provenance as Record<string, unknown>).extraction_depth, 'full_data');

  // ── Level 2 (opt-in: with_insights) ────────────────────────────────────────
  const level2Norm = normalizeApifyZillowItem(SAMPLE_LISTING_WITH_INSIGHTS_AND_TRAPS, {
    extractionDepth: 'with_insights',
  });
  assert.equal(level2Norm.ok, true);
  if (!level2Norm.ok) throw new Error('Expected Level 2 normalization to succeed');

  const level2Rec = buildPipelineRecord(level2Norm.pipelineInput);
  assert.equal(level2Rec.monthly_rent, 1800);
  assert.equal(level2Rec.location_context, 'Walk score: 78; Transit score: 62; Bike score: 54');
  assert.equal((level2Rec.field_provenance as Record<string, unknown>).extraction_depth, 'with_insights');

  const l2Loc = level2Rec.location_details as Record<string, any>;
  assert.equal(l2Loc.walk_score, 78);
  assert.equal(l2Loc.transit_score, 62);
  assert.equal(l2Loc.bike_score, 54);
  assert.equal(l2Loc.insights.depth, 'with_insights');
  assert.equal(l2Loc.insights.walk_score, 78);
  assert.equal(l2Loc.insights.walk_description, 'Very Walkable');

  // Core Level-1 domains remain identical between Level 1 and Level 2
  assert.deepEqual(level2Rec.structural_details, level1Rec.structural_details);
  assert.deepEqual(level2Rec.utility_details, level1Rec.utility_details);
  assert.deepEqual(level2Rec.financial_details, level1Rec.financial_details);

  // Zero Zestimates, rent benchmarks, or dates admitted anywhere in EITHER level
  const l2Fin = level2Rec.financial_details as Record<string, unknown>;
  assert.equal(l2Fin.insights, undefined);
  assert.equal(l2Fin.zestimate, undefined);
  assert.equal(l2Fin.rent_zestimate, undefined);

  const l2Serialized = JSON.stringify({
    location_context: level2Rec.location_context,
    location_details: level2Rec.location_details,
    financial_details: level2Rec.financial_details,
    source_facts_ledger: level2Rec.source_facts_ledger,
    unmapped_attributes: level2Rec.unmapped_attributes,
  });
  for (const forbidden of [
    'zestimate',
    'rentZestimate',
    'rentBenchmark',
    'rentComps',
    'grossRentalYield',
    'priceHistory',
    'taxHistory',
    'datePosted',
  ]) {
    assert.equal(
      l2Serialized.includes(forbidden),
      false,
      `Forbidden insight/date/benchmark key "${forbidden}" leaked in Level 2`,
    );
  }
});

test('fetchLevel2GeoapifyInsights + fetchLevel2CensusSchoolDistrict enrich Level 2 cleanly and merge without mutating Level 1 facts', async () => {
  const mockFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('api.geoapify.com/v2/places')) {
      return new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                place_id: 'sch-1',
                name: 'Ranchwood Elementary',
                categories: ['education.school'],
                address_line2: 'Yukon, OK 73099',
              },
              geometry: { coordinates: [-97.761, 35.508] },
            },
            {
              properties: {
                place_id: 'park-1',
                name: 'Sunrise Park',
                categories: ['leisure.park'],
              },
              geometry: { coordinates: [-97.765, 35.505] },
            },
            {
              properties: {
                place_id: 'shop-1',
                name: 'Homeland Market',
                categories: ['commercial.supermarket'],
              },
              geometry: { coordinates: [-97.755, 35.51] },
            },
            {
              properties: {
                place_id: 'hlth-1',
                name: 'Integris Clinic',
                categories: ['healthcare'],
              },
              geometry: { coordinates: [-97.759, 35.509] },
            },
            {
              properties: {
                place_id: 'trn-1',
                name: 'Route 66 Stop',
                categories: ['public_transport'],
              },
              geometry: { coordinates: [-97.763, 35.507] },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.includes('api.geoapify.com/v1/geocode/reverse')) {
      return new Response(
        JSON.stringify({
          results: [{ county: 'Canadian County', suburb: 'Cedarbrook', city: 'Yukon' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.includes('tigerweb.geo.census.gov')) {
      return new Response(
        JSON.stringify({
          results: [
            {
              layerId: 0,
              layerName: 'Unified School Districts',
              attributes: { NAME: 'Yukon School District' },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response('Not Found', { status: 404 });
  };

  const geoRes = await fetchLevel2GeoapifyInsights({
    lat: 35.5067,
    lng: -97.7625,
    apiKey: 'test-geo-key',
    includeReverseGeocode: true,
    fetchImpl: mockFetch,
  });
  assert.equal(geoRes.ok, true);
  assert.equal(geoRes.status, 'ok');
  assert.equal(geoRes.summary?.counts.school, 1);
  assert.equal(geoRes.summary?.counts.park, 1);
  assert.equal(geoRes.summary?.counts.shopping, 1);
  assert.equal(geoRes.summary?.counts.healthcare, 1);
  assert.equal(geoRes.summary?.counts.transit, 1);
  assert.equal(geoRes.reverse?.county, 'Canadian County');

  const censusRes = await fetchLevel2CensusSchoolDistrict({
    lat: 35.5067,
    lng: -97.7625,
    fetchImpl: mockFetch,
  });
  assert.equal(censusRes.ok, true);
  assert.equal(censusRes.unified_district, 'Yukon School District');

  const l2Norm = normalizeApifyZillowItem(SAMPLE_LISTING_WITH_INSIGHTS_AND_TRAPS, {
    extractionDepth: 'with_insights',
  });
  assert.equal(l2Norm.ok, true);
  if (!l2Norm.ok) throw new Error('Expected Level 2 norm');

  // Verify Level 1 guard refuses merge
  const untouched = mergeLevel2LocationEnrichment(
    { ...l2Norm.pipelineInput, location_context: null },
    geoRes,
    censusRes,
    'full_data',
  );
  assert.equal(untouched.location_context, null);

  // Merge at Level 2
  const enrichedInput = mergeLevel2LocationEnrichment(
    l2Norm.pipelineInput,
    geoRes,
    censusRes,
    'with_insights',
  );
  const locDetails = enrichedInput.location_details as Record<string, any>;
  assert.equal(locDetails.insights.geoapify_status, 'ok');
  assert.equal(locDetails.insights.census_district_status, 'ok');
  assert.equal(locDetails.insights.census_school_district.primary_district, 'Yukon School District');
  assert.ok(Array.isArray(locDetails.insights.nearby_highlights));
  assert.ok(String(enrichedInput.location_context).startsWith('Walk score: 78; Transit score: 62; Bike score: 54; Nearby amenities:'));
  // Core Level 1 facts untouched
  assert.equal(enrichedInput.monthly_rent, 1800);
  assert.equal(enrichedInput.bedrooms, 3);
  assert.equal(enrichedInput.bathrooms, 2.5);

  const summaryStandalone = summarizeNearbyPlacesForInsights(geoRes.places);
  assert.equal(summaryStandalone.total_places, 5);
});

test('Level-2 Geoapify and Census TIGERweb timeouts/5xx degrade gracefully without blocking staging', async () => {
  const failingFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('tigerweb.geo.census.gov')) {
      throw new Error('AbortError: network timeout');
    }
    return new Response('Upstream Error', { status: 503 });
  };

  const geoFail = await fetchLevel2GeoapifyInsights({
    lat: 35.5067,
    lng: -97.7625,
    apiKey: 'test-geo-key',
    fetchImpl: failingFetch,
  });
  assert.equal(geoFail.ok, false);
  assert.equal(geoFail.status, 'unavailable');

  const censusFail = await fetchLevel2CensusSchoolDistrict({
    lat: 35.5067,
    lng: -97.7625,
    fetchImpl: failingFetch,
  });
  assert.equal(censusFail.ok, false);
  assert.equal(censusFail.status, 'unavailable');

  const l2Norm = normalizeApifyZillowItem(SAMPLE_LISTING_WITH_INSIGHTS_AND_TRAPS, {
    extractionDepth: 'with_insights',
  });
  assert.equal(l2Norm.ok, true);
  if (!l2Norm.ok) throw new Error('Expected Level 2 norm');

  mergeLevel2LocationEnrichment(l2Norm.pipelineInput, geoFail, censusFail, 'with_insights');
  const locDetails = l2Norm.pipelineInput.location_details as Record<string, any>;
  assert.equal(locDetails.insights.geoapify_status, 'unavailable');
  assert.equal(locDetails.insights.census_district_status, 'unavailable');
  const rec = buildPipelineRecord(l2Norm.pipelineInput);
  assert.equal(rec.monthly_rent, 1800);
  assert.equal(rec.bedrooms, 3);
});
