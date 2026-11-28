import assert from 'node:assert/strict';
import test from 'node:test';
import {
  schoolDistrictsMatch,
  verifyLocationAndSchools,
} from '../location-verifier.ts';
import { validatePipelineProperty } from '../property-validation.ts';
import { normalizeApifyZillowItem } from '../apify-normalizer.ts';
import { buildPipelineRecord } from '../pipeline-record.ts';

const FOUR_VALID_PHOTOS = JSON.stringify([
  'https://photos.zillowstatic.com/fp/img1-cc_ft_960.jpg',
  'https://photos.zillowstatic.com/fp/img2-cc_ft_960.jpg',
  'https://photos.zillowstatic.com/fp/img3-cc_ft_960.jpg',
  'https://photos.zillowstatic.com/fp/img4-cc_ft_960.jpg',
]);

function makeOwnerListing(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    address: '608 Maple Ave',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    neighborhood: 'Cedarbrook',
    lat: 35.5067,
    lng: -97.7625,
    monthly_rent: 1595,
    bedrooms: 3,
    bathrooms: 2.5,
    square_footage: 1650,
    property_type: 'SINGLE_FAMILY',
    source_status: 'available',
    original_description: 'Spacious 3 bed home with fenced yard and stainless appliances.',
    original_image_urls: FOUR_VALID_PHOTOS,
    location_details: {
      county: 'Canadian County',
      neighborhood: 'Cedarbrook',
      school_district: 'Yukon Public Schools',
    },
    field_provenance: {
      poster_profile: {
        explicit_owner_landlord: true,
        poster_category: 'explicit_owner_landlord',
        seller_type: 'Property Owner',
      },
    },
    ...overrides,
  };
}

test('schoolDistrictsMatch compares normalized district tokens accurately', () => {
  assert.equal(schoolDistrictsMatch('Yukon Public Schools', ['Yukon School District']), true);
  assert.equal(schoolDistrictsMatch('Oklahoma City Public Schools', ['Oklahoma City Unified District']), true);
  assert.equal(schoolDistrictsMatch('Mustang Public Schools', ['Yukon School District']), false);
});

test('mocked Geoapify + Census TIGERweb independently verify matching location and school district', async () => {
  const mockFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('api.geoapify.com/v1/geocode/reverse')) {
      return new Response(
        JSON.stringify({
          results: [
            {
              country_code: 'us',
              state: 'Oklahoma',
              state_code: 'OK',
              county: 'Canadian County',
              city: 'Yukon',
              postcode: '73099',
              suburb: 'Cedarbrook',
              lat: 35.5068,
              lon: -97.7624,
            },
          ],
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

  const report = await validatePipelineProperty(makeOwnerListing(), {
    verifyLocationAndSchools: true,
    geoapifyApiKey: 'test-geoapify-key',
    fetchImpl: mockFetch,
  });

  assert.equal(report.status, 'passed');
  assert.equal(report.location_verification.geoapify_status, 'ok');
  assert.equal(report.location_verification.census_status, 'ok');
  assert.equal(report.location_verification.critical_mismatch, false);
  assert.equal(report.field_verification_status.location_coordinates, 'independently_verified');
  assert.equal(report.field_verification_status.state, 'independently_verified');
  assert.equal(report.field_verification_status.city, 'independently_verified');
  assert.equal(report.field_verification_status.county, 'independently_verified');
  assert.equal(report.field_verification_status.zip, 'independently_verified');
  assert.equal(report.field_verification_status.neighborhood, 'independently_verified');
  assert.equal(report.field_verification_status.school_district, 'independently_verified');
  assert.equal(report.verification_conflicts.length, 0);
});

test('Census TIGERweb school district mismatch flags conflicting_sources without blocking valid rental', async () => {
  const mockFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('api.geoapify.com/v1/geocode/reverse')) {
      return new Response(
        JSON.stringify({
          results: [
            {
              state_code: 'OK',
              county: 'Canadian County',
              city: 'Yukon',
              postcode: '73099',
              suburb: 'Cedarbrook',
              lat: 35.5067,
              lon: -97.7625,
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('tigerweb.geo.census.gov')) {
      return new Response(
        JSON.stringify({
          results: [
            {
              layerId: 0,
              layerName: 'Unified School Districts',
              attributes: { NAME: 'Mustang Public Schools' },
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response('Not Found', { status: 404 });
  };

  const report = await validatePipelineProperty(makeOwnerListing(), {
    verifyLocationAndSchools: true,
    geoapifyApiKey: 'test-geoapify-key',
    fetchImpl: mockFetch,
  });

  assert.equal(report.status, 'passed');
  assert.equal(report.field_verification_status.school_district, 'conflicting_sources');
  assert.equal(report.verification_conflicts.length, 1);
  assert.equal(report.verification_conflicts[0].field, 'school_district');
  assert.equal(report.verification_conflicts[0].severity, 'warning');
  assert.equal(report.verification_conflicts[0].source, 'census_tigerweb_school_boundary');
});

test('Geoapify critical state or >10-mile city mismatch routes listing to needs_review', async () => {
  const wrongStateFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('api.geoapify.com/v1/geocode/reverse')) {
      return new Response(
        JSON.stringify({
          results: [
            {
              state: 'Texas',
              state_code: 'TX',
              county: 'Dallas County',
              city: 'Dallas',
              postcode: '75201',
              lat: 32.7767,
              lon: -96.797,
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  };

  const report = await validatePipelineProperty(makeOwnerListing(), {
    verifyLocationAndSchools: true,
    geoapifyApiKey: 'test-geoapify-key',
    fetchImpl: wrongStateFetch,
  });

  assert.equal(report.status, 'needs_review');
  assert.equal(report.needs_review, true);
  assert.ok(report.reasons.includes('location_geocode_mismatch'));
  assert.equal(report.location_verification.critical_mismatch, true);
  assert.equal(report.field_verification_status.state, 'conflicting_sources');
  assert.equal(report.field_verification_status.city, 'conflicting_sources');
  assert.equal(report.field_verification_status.location_coordinates, 'conflicting_sources');
  assert.ok(report.verification_conflicts.some((c) => c.severity === 'critical'));
});

test('external timeouts/5xx degrade gracefully without rejecting valid listings; missing coords mark not_available', async () => {
  const brokenFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('tigerweb.geo.census.gov')) {
      throw new Error('AbortError: TIGERweb timed out');
    }
    return new Response('Bad Gateway', { status: 502 });
  };

  const report = await validatePipelineProperty(makeOwnerListing(), {
    verifyLocationAndSchools: true,
    geoapifyApiKey: 'test-geoapify-key',
    fetchImpl: brokenFetch,
  });

  assert.equal(report.status, 'passed');
  assert.equal(report.location_verification.geoapify_status, 'unavailable');
  assert.equal(report.location_verification.census_status, 'unavailable');
  assert.equal(report.field_verification_status.location_coordinates, 'unverified');
  assert.equal(report.field_verification_status.school_district, 'source_confirmed');

  const noCoordRes = await verifyLocationAndSchools(
    { lat: null, lng: null, city: 'Yukon', state: 'OK' },
    { enableExternalChecks: true, geoapifyApiKey: 'test', fetchImpl: brokenFetch },
  );
  assert.equal(noCoordRes.coordinates_valid, false);
  assert.equal(noCoordRes.field_statuses.location_coordinates, 'not_available');
});

test('source_facts_ledger 4-state facts and narrative contradictions integrate cleanly into validation report', async () => {
  const norm = normalizeApifyZillowItem({
    zpid: 44556677,
    detailUrl: 'https://www.zillow.com/homedetails/120-Oak-Ln-Yukon-OK-73099/44556677_zpid/',
    homeStatus: 'FOR_RENT',
    homeType: 'SINGLE_FAMILY',
    price: '$1,650/mo',
    bedrooms: 3,
    bathrooms: 2.5,
    livingArea: 1720,
    address: {
      streetAddress: '120 Oak Ln',
      city: 'Yukon',
      state: 'OK',
      zipcode: '73099',
    },
    description: 'Gorgeous home with central air, two car garage, and stainless dishwasher.',
    resoFacts: {
      hasCooling: false,
      cooling: ['None'],
      garageSpaces: 0,
      appliances: ['None'],
      heating: ['Forced Air'],
    },
    photos: [
      'https://photos.zillowstatic.com/fp/a1.jpg',
      'https://photos.zillowstatic.com/fp/a2.jpg',
      'https://photos.zillowstatic.com/fp/a3.jpg',
      'https://photos.zillowstatic.com/fp/a4.jpg',
    ],
    attributionInfo: {
      isPropertyOwner: true,
      sellerType: 'Property Owner',
    },
  });

  assert.equal(norm.ok, true);
  if (!norm.ok) throw new Error('Expected normalizer success');
  const rec = buildPipelineRecord(norm.pipelineInput);

  const report = await validatePipelineProperty(rec as Record<string, unknown>, {
    rulesMap: { enable_external_location_verification: false },
  });

  assert.equal(report.status, 'passed');
  assert.equal(report.verification_summary.source_facts_ledger_complete, true);
  assert.equal(report.field_verification_status.heating, 'source_confirmed');
  assert.equal(report.field_verification_status.central_air, 'conflicting_sources');
  assert.equal(report.field_verification_status.garage, 'conflicting_sources');
  assert.equal(report.field_verification_status.appliances, 'conflicting_sources');
  assert.ok(report.verification_conflicts.some((c) => c.field === 'central_air'));
  assert.ok(report.verification_conflicts.some((c) => c.field === 'garage'));
  assert.ok(report.verification_conflicts.some((c) => c.field === 'appliances'));
});

test('dual-listed verification rejects missing active rental proof or purchase-price rent while passing genuine dual rentals', async () => {
  const validDual = await validatePipelineProperty(
    makeOwnerListing({
      rental_eligibility_status: 'dual_listed_rental_active',
      is_dual_listed: true,
      monthly_rent: 1950,
      source_raw_payload: {
        homeStatus: 'FOR_SALE',
        isForRent: true,
        salePrice: 315000,
        monthlyRent: 1950,
      },
    }),
    { rulesMap: { enable_external_location_verification: false } },
  );
  assert.equal(validDual.status, 'passed');
  assert.equal(validDual.field_verification_status.rental_eligibility, 'independently_verified');

  const disguisedSalePrice = await validatePipelineProperty(
    makeOwnerListing({
      rental_eligibility_status: 'dual_listed_rental_active',
      is_dual_listed: true,
      monthly_rent: 315000,
      source_raw_payload: {
        homeStatus: 'FOR_SALE',
        isForRent: true,
        salePrice: 315000,
      },
    }),
    { rulesMap: { enable_external_location_verification: false } },
  );
  assert.equal(disguisedSalePrice.status, 'rejected');
  assert.ok(disguisedSalePrice.reasons.includes('invalid_sale_price_as_rent'));
  assert.equal(disguisedSalePrice.field_verification_status.monthly_rent, 'conflicting_sources');

  const unconfirmedDual = await validatePipelineProperty(
    makeOwnerListing({
      rental_eligibility_status: 'dual_listed_rental_active',
      is_dual_listed: true,
      source_raw_payload: {
        homeStatus: 'FOR_SALE',
        isForRent: false,
        salePrice: 315000,
      },
    }),
    { rulesMap: { enable_external_location_verification: false } },
  );
  assert.equal(unconfirmedDual.status, 'rejected');
  assert.ok(unconfirmedDual.reasons.includes('non_rental_or_off_market'));
});
