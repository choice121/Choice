import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { normalizeApifyZillowItem } from '../apify-normalizer.ts';
import {
  CLIENT_SAFE_PROPERTY_FIELDS,
  detectLeakedInternalStrings,
  projectClientSafeProperty,
} from '../batch-publishing.ts';
import { buildPipelineRecord, type PipelineRecordInput } from '../pipeline-record.ts';
import { validatePipelineProperty } from '../property-validation.ts';

const ROOT_DIR = resolve(import.meta.dirname, '..', '..', '..', '..');

function extractStringArrayFromSource(sourceText: string, constName: string): string[] {
  const re = new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  const match = sourceText.match(re);
  assert.ok(match, `Expected constant ${constName} to exist`);
  return Array.from(match[1].matchAll(/'([a-z0-9_]+)'/gi)).map((m) => m[1]);
}

function makeSampleRawApifyListing() {
  return {
    zpid: '88442211',
    detailUrl: 'https://www.zillow.com/homedetails/1420-NW-28th-St-Oklahoma-City-OK-73106/88442211_zpid/',
    homeType: 'SINGLE_FAMILY',
    homeStatus: 'FOR_RENT',
    streetAddress: '1420 NW 28th St',
    city: 'Oklahoma City',
    state: 'OK',
    zipcode: '73106',
    county: 'Oklahoma County',
    neighborhood: 'Shepherd',
    latitude: 35.4979,
    longitude: -97.5356,
    bedrooms: 3,
    bathrooms: 2.5,
    livingArea: 1680,
    lotAreaValue: 6500,
    lotAreaUnits: 'Square Feet',
    yearBuilt: 2018,
    stories: 2,
    price: 1895,
    walkScore: 61,
    transitScore: 34,
    bikeScore: 58,
    description:
      'Updated brick home in Shepherd with fenced backyard, stainless steel refrigerator, dishwasher, gas range, microwave, and washer/dryer hookups. Application Fee: $50.',
    attributionInfo: {
      agentName: 'Private Owner Contact',
      brokerName: 'Oklahoma Lease Ops',
      trueStatus: 'OWNER_OCCUPIED',
    },
    resoFacts: {
      homeType: 'Single Family Residence',
      architecturalStyle: 'Traditional',
      constructionMaterials: ['Brick', 'Wood Siding'],
      flooring: ['Hardwood', 'Tile'],
      appliances: ['Dishwasher', 'Gas Range', 'Microwave', 'Refrigerator'],
      heating: ['Forced Air', 'Natural Gas'],
      cooling: ['Central Air'],
      laundryFeatures: ['Washer Hookup', 'Dryer Hookup'],
      garageParkingCapacity: 2,
      parkingFeatures: ['Attached Garage'],
      electric: ['Tenant'],
      gas: ['Tenant'],
      waterSource: ['Public'],
      sewer: ['Public Sewer'],
      subdivision: 'Shepherd Historic',
      associationFee: 45,
      associationFeeIncludes: ['Common Area Maintenance'],
      taxAnnualAmount: 2950,
      zestimate: 289000,
      rentZestimate: 1925,
    },
    schools: [
      { name: 'Putnam Heights Academy', level: 'Elementary', grades: 'PK-5', distance: 0.7, rating: 7 },
      { name: 'Northwest Classen High', level: 'High', grades: '9-12', distance: 1.4, rating: 6 },
    ],
    photos: [
      { url: 'https://photos.zillowstatic.com/fp/ext-hero-p_f.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/living-2-p_f.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/kitchen-3-p_f.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/bath-4-p_f.jpg' },
    ],
    virtualTourUrl: 'https://my.insidemaps.com/app/example-tour',
  };
}

function makeMockVerifierFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('api.geoapify.com/v1/geocode/reverse')) {
      return new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                city: 'Oklahoma City',
                state: 'Oklahoma',
                state_code: 'OK',
                postcode: '73106',
                county: 'Oklahoma County',
                suburb: 'Shepherd',
                formatted: '1420 NW 28th St, Oklahoma City, OK 73106',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('api.geoapify.com/v2/places')) {
      return new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                name: 'Memorial Park',
                categories: ['leisure.park'],
                distance: 420,
              },
            },
            {
              properties: {
                name: 'Neighborhood Market',
                categories: ['commercial.supermarket'],
                distance: 880,
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/School/MapServer/identify')) {
      return new Response(
        JSON.stringify({
          results: [
            {
              layerId: 0,
              layerName: 'Unified School Districts',
              attributes: { NAME: 'Oklahoma City Public Schools' },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(null, { status: 200 });
  }) as typeof fetch;
}

test('Phase 6 end-to-end chain produces clean client-safe Level 1 & Level 2 property payloads with zero leaks', async () => {
  const prevGeoapifyKey = process.env.GEOAPIFY_API_KEY;
  process.env.GEOAPIFY_API_KEY = 'test-geoapify-key';

  try {
    const raw = makeSampleRawApifyListing();
    const mockFetch = makeMockVerifierFetch();

    // Level 1: full_data
    const normL1 = normalizeApifyZillowItem(raw, { extractionDepth: 'full_data', channel: 'apify-stage2' });
    assert.equal(normL1.ok, true);
    if (!normL1.ok) return;

    const recordL1 = buildPipelineRecord(normL1.pipelineInput as PipelineRecordInput);
    const valL1 = await validatePipelineProperty(recordL1, {
      fetchImpl: mockFetch,
      verifyLocationAndSchools: true,
      geoapifyApiKey: 'test-geoapify-key',
    });
    assert.equal(valL1.location_verification.geoapify_status, 'ok');
    assert.equal(valL1.location_verification.census_status, 'ok');
    assert.equal(valL1.field_verification_status.county, 'independently_verified');

    const safeL1 = projectClientSafeProperty(
      {
        ...recordL1,
        id: 'prop_phase6_l1',
        status: 'active',
        field_verification_status: valL1.field_verification_status,
        verification_conflicts: valL1.verification_conflicts,
      },
      null,
      JSON.parse(String(recordL1.original_image_urls || '[]')).map((url: string, idx: number) => ({
        id: `ph_${idx + 1}`,
        property_id: 'prop_phase6_l1',
        url,
        display_order: idx + 1,
        is_hero: idx === 0,
        source_url: 'https://www.zillow.com/should-not-leak',
      })),
    );

    const auditL1 = detectLeakedInternalStrings(safeL1);
    assert.equal(auditL1.clean, true, `Level 1 leaks: ${auditL1.leaks.join(', ')}`);
    assert.equal(safeL1.application_fee, 50);
    assert.equal(safeL1.security_deposit, 1895);
    assert.equal(safeL1.bathrooms, 2.5);
    assert.equal('virtual_tour_url' in safeL1, false);
    assert.equal('videos' in safeL1, false);
    assert.equal('source_facts_ledger' in safeL1, false);
    assert.equal('unmapped_attributes' in safeL1, false);
    assert.equal('field_verification_status' in safeL1, false);
    assert.equal('verification_conflicts' in safeL1, false);
    assert.ok((safeL1.structural_details as Record<string, unknown>)?.architectural_style);
    assert.equal((safeL1.location_details as Record<string, unknown>)?.subdivision, 'Shepherd Historic');
    assert.equal('zestimate' in ((safeL1.structural_details as Record<string, unknown>) || {}), false);

    // Level 2: with_insights
    const normL2 = normalizeApifyZillowItem(raw, { extractionDepth: 'with_insights', channel: 'apify-stage2' });
    assert.equal(normL2.ok, true);
    if (!normL2.ok) return;

    const recordL2 = buildPipelineRecord(normL2.pipelineInput as PipelineRecordInput);
    const safeL2 = projectClientSafeProperty({
      ...recordL2,
      id: 'prop_phase6_l2',
      status: 'private_placement',
    });

    const auditL2 = detectLeakedInternalStrings(safeL2);
    assert.equal(auditL2.clean, true, `Level 2 leaks: ${auditL2.leaks.join(', ')}`);
    const locL2 = safeL2.location_details as Record<string, unknown>;
    const insightsL2 = locL2?.insights as Record<string, unknown>;
    assert.ok(insightsL2, 'Expected insights block on Level 2 location_details');
    assert.equal(insightsL2.walk_score, 61);
    assert.equal(insightsL2.transit_score, 34);
    assert.equal(insightsL2.bike_score, 58);

    // Level 1 must suppress unsolicited Level 2 insight scores
    const locL1 = safeL1.location_details as Record<string, unknown>;
    assert.equal(Boolean(locL1?.insights), false, 'Level 1 must not populate unsolicited Level 2 insights');

    // Legacy row fallback (all JSONB columns null)
    const safeLegacy = projectClientSafeProperty({
      id: 'prop_legacy_1',
      status: 'active',
      title: '100 Main St, Mustang, OK 73064',
      address: '100 Main St',
      city: 'Mustang',
      state: 'OK',
      zip: '73064',
      monthly_rent: 1450,
      structural_details: null,
      utility_details: null,
      location_details: null,
    });
    assert.equal(safeLegacy.structural_details, null);
    assert.equal(safeLegacy.utility_details, null);
    assert.equal(safeLegacy.location_details, null);
    assert.equal(safeLegacy.application_fee, 50);
    assert.equal(safeLegacy.security_deposit, 1450);
    assert.equal(detectLeakedInternalStrings(safeLegacy).clean, true);
  } finally {
    if (prevGeoapifyKey === undefined) delete process.env.GEOAPIFY_API_KEY;
    else process.env.GEOAPIFY_API_KEY = prevGeoapifyKey;
  }
});

test('CLIENT_SAFE property column lists stay synchronized across backend projection, frontend clients, and SQL migration 000026', () => {
  const propertyJs = readFileSync(resolve(ROOT_DIR, 'js/property.js'), 'utf8');
  const cpApiJs = readFileSync(resolve(ROOT_DIR, 'js/cp-api.js'), 'utf8');
  const migrationSql = readFileSync(
    resolve(ROOT_DIR, 'supabase/migrations/20261121000026_phase6_publish_rpc_parity.sql'),
    'utf8',
  );

  const backendFields = [...CLIENT_SAFE_PROPERTY_FIELDS];
  const propertyJsFields = extractStringArrayFromSource(propertyJs, 'CLIENT_SAFE_PROPERTY_FIELDS');
  const cpApiFields = extractStringArrayFromSource(cpApiJs, 'CLIENT_SAFE_PROPERTY_COLUMNS');

  assert.deepEqual(propertyJsFields, backendFields, 'js/property.js must match CLIENT_SAFE_PROPERTY_FIELDS');
  assert.deepEqual(cpApiFields, backendFields, 'js/cp-api.js must match CLIENT_SAFE_PROPERTY_FIELDS');

  // Parse anon GRANT SELECT (...) ON public.properties FROM migration SQL
  const grantMatch = migrationSql.match(
    /REVOKE SELECT ON public\.properties FROM anon;\s*GRANT SELECT\s*\(([\s\S]*?)\)\s*ON public\.properties TO anon;/i,
  );
  assert.ok(grantMatch, 'Expected anon column-level GRANT SELECT on public.properties in migration 000026');
  const sqlGrantCols = grantMatch[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const field of backendFields) {
    assert.ok(
      sqlGrantCols.includes(field),
      `Migration 000026 anon GRANT SELECT on public.properties is missing client-safe column: ${field}`,
    );
  }

  // Ensure internal columns are NOT in anon GRANT SELECT
  const forbiddenAnonCols = [
    'landlord_id',
    'poster_landlord_id',
    'owner_id',
    'agent_name',
    'broker_name',
    'source_url',
    'source_listing_id',
    'source_raw_payload',
    'original_data',
    'field_provenance',
    'source_facts_ledger',
    'unmapped_attributes',
    'field_verification_status',
    'verification_conflicts',
    'tax_annual_amount',
    'tax_value',
    'financial_details',
    'showing_instructions',
    'admin_notes',
    'batch_id',
    'available_date',
    'lease_terms',
    'minimum_lease_months',
    'pets_allowed',
    'pet_types_allowed',
    'pet_deposit',
    'smoking_allowed',
    'virtual_tour_url',
    'videos',
  ];
  for (const col of forbiddenAnonCols) {
    assert.equal(sqlGrantCols.includes(col), false, `Anon GRANT SELECT must NOT include internal/policy column: ${col}`);
  }
});

test('Public pages and SSR edge functions contain zero select(*), landlords joins, or source_url leaks', () => {
  const publicFiles = [
    'index.html',
    'health.html',
    'js/property.js',
    'functions/rent/[state]/[city]/[slug].js',
  ];

  for (const rel of publicFiles) {
    const src = readFileSync(resolve(ROOT_DIR, rel), 'utf8');
    assert.equal(
      /\.from\(\s*['"]properties['"]\s*\)\s*\.select\(\s*['"]\*/i.test(src),
      false,
      `${rel} must not call .from('properties').select('*')`,
    );
    assert.equal(
      /select=[^"'`]*landlords\s*\(/i.test(src),
      false,
      `${rel} must not select joined landlords() fields`,
    );
    assert.equal(
      /CLIENT_SAFE_PHOTO_SELECT[\s\S]{0,120}source_url/i.test(src),
      false,
      `${rel} must not include source_url in CLIENT_SAFE_PHOTO_SELECT`,
    );
  }

  const cpApiJs = readFileSync(resolve(ROOT_DIR, 'js/cp-api.js'), 'utf8');
  const pubSelectMatch = cpApiJs.match(/const\s+PROPERTIES_SELECT_PUBLIC\s*=\s*([\s\S]*?);/);
  assert.ok(pubSelectMatch, 'Expected PROPERTIES_SELECT_PUBLIC in js/cp-api.js');
  assert.equal(/source_url/.test(pubSelectMatch[1]), false, 'PROPERTIES_SELECT_PUBLIC must not select source_url');
  assert.equal(/landlords/.test(pubSelectMatch[1]), false, 'PROPERTIES_SELECT_PUBLIC must not join landlords');
  const getOneSection = cpApiJs.slice(cpApiJs.indexOf('async getOne('), cpApiJs.indexOf('async create('));
  assert.equal(/PROPERTIES_SELECT_ADMIN|\*\s*,|select\(['"]\*/i.test(getOneSection), false, 'Properties.getOne must remain strictly public-safe');
});
