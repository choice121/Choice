import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DETAIL_ACTOR_ID,
  buildNormalizedAddressKey,
  classifyRentalEligibility,
  mergeStage2RecordWithExisting,
  normalizeApifyZillowItem,
  parseVerifiedAskingRent,
} from '../apify-normalizer.ts';
import { buildPipelineRecord } from '../pipeline-record.ts';
import { validatePipelineProperty } from '../property-validation.ts';

function makeBaseItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    zpid: 88001122,
    detailUrl: 'https://www.zillow.com/homedetails/608-Maple-Ave-Yukon-OK-73099/88001122_zpid/',
    address: {
      streetAddress: '608 Maple Ave',
      city: 'Yukon',
      state: 'OK',
      zipcode: '73099',
    },
    bedrooms: 3,
    bathrooms: 2.5,
    homeType: 'SINGLE_FAMILY',
    description: 'Clean 3 bed home in Yukon with attached garage and fenced yard.',
    responsivePhotos: [
      { url: 'https://photos.zillowstatic.com/fp/1.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/2.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/3.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/4.jpg' },
    ],
    isForRentByOwner: true,
    ...overrides,
  };
}

test('sale-only and non-active statuses are deterministically rejected before quota selection', () => {
  const disallowedStatuses = [
    'FOR_SALE',
    'SOLD',
    'RECENTLY_SOLD',
    'PENDING_SALE',
    'CONTINGENT',
    'AUCTION',
    'FORECLOSURE',
    'FSBO',
    'OFF_MARKET',
    'LEASED',
    'RENTED',
  ];

  for (const homeStatus of disallowedStatuses) {
    const res = normalizeApifyZillowItem(
      makeBaseItem({
        homeStatus,
        price: '$325,000',
      }),
    );
    assert.equal(res.ok, false, `Expected ${homeStatus} to be rejected`);
    if (!res.ok) {
      assert.equal(res.reason, 'sale_only_excluded');
    }
  }
});

test('dual-listed property qualifies ONLY with active rental confirmation AND verified monthly asking rent', () => {
  // Valid dual-listed listing: FOR_SALE + isForRent: true + genuine monthly rent separate from salePrice
  const dualPass = normalizeApifyZillowItem(
    makeBaseItem({
      zpid: 88002233,
      homeStatus: 'FOR_SALE',
      isForRent: true,
      salePrice: 350000,
      price: '$350,000',
      monthlyRent: 1950,
    }),
  );
  assert.equal(dualPass.ok, true);
  if (!dualPass.ok) throw new Error('expected valid dual-listed rental');
  assert.equal(dualPass.rentalEligibility.status, 'dual_listed_rental_active');
  assert.equal(dualPass.rentalEligibility.isDualListed, true);
  assert.equal(dualPass.pipelineInput.rental_eligibility_status, 'dual_listed_rental_active');
  assert.equal(dualPass.pipelineInput.is_dual_listed, true);
  assert.equal(dualPass.pipelineInput.monthly_rent, 1950);

  // Dual-listed trap 1: claims rental intent but price is $350,000 and no monthlyRent exists
  const dualSalePriceTrap = normalizeApifyZillowItem(
    makeBaseItem({
      zpid: 88002234,
      homeStatus: 'FOR_SALE',
      isForRent: true,
      price: '$350,000',
    }),
  );
  assert.equal(dualSalePriceTrap.ok, false);
  if (!dualSalePriceTrap.ok) {
    assert.equal(dualSalePriceTrap.reason, 'invalid_sale_price_as_rent');
  }

  // Dual-listed trap 2: RECENTLY_SOLD with stale rental flag MUST reject
  const closedSaleWithStaleRental = normalizeApifyZillowItem(
    makeBaseItem({
      zpid: 88002235,
      homeStatus: 'RECENTLY_SOLD',
      isForRent: true,
      monthlyRent: 1950,
    }),
  );
  assert.equal(closedSaleWithStaleRental.ok, false);
  if (!closedSaleWithStaleRental.ok) {
    assert.equal(closedSaleWithStaleRental.reason, 'sale_only_excluded');
  }

  // Dual-listed trap 3: monthlyRent omitted, rentCheck refuses to use rentZestimate
  const rentCheck = parseVerifiedAskingRent(
    { homeStatus: 'FOR_SALE', isForRent: true, salePrice: 350000, rentZestimate: 1950 },
    {},
    true,
  );
  assert.equal(rentCheck.rent, null);
  assert.equal(rentCheck.reason, 'missing_verified_asking_rent');
});

test('rentZestimate is never substituted for missing asking rent and missing homeStatus requires explicit rental signal', () => {
  const zestimateOnly = normalizeApifyZillowItem(
    makeBaseItem({
      homeStatus: 'FOR_RENT',
      rentZestimate: 1850,
    }),
  );
  assert.equal(zestimateOnly.ok, false);
  if (!zestimateOnly.ok) {
    assert.equal(zestimateOnly.reason, 'missing_verified_asking_rent');
  }

  // No homeStatus, no /rentals/ URL, no isForRent -> rejected as unconfirmed_rental_status
  const unconfirmed = normalizeApifyZillowItem(
    makeBaseItem({
      price: '$1,750/mo',
      isForRentByOwner: false,
      detailUrl: 'https://www.zillow.com/homedetails/608-Maple-Ave-Yukon-OK-73099/88001122_zpid/',
    }),
  );
  assert.equal(unconfirmed.ok, false);
  if (!unconfirmed.ok) {
    assert.equal(unconfirmed.reason, 'unconfirmed_rental_status');
  }

  // /rentals/ URL counts as explicit rental offering if asking rent is verified
  const eligFromRentalsUrl = classifyRentalEligibility({
    detailUrl: 'https://www.zillow.com/rentals/608-Maple-Ave-Yukon-OK-73099/88001122_zpid/',
  });
  assert.equal(eligFromRentalsUrl.eligible, true);
  assert.equal(eligFromRentalsUrl.status, 'rental_only');
});

test('buildNormalizedAddressKey normalizes street suffixes and preserves duplex unit numbers', () => {
  const unitAVariant1 = buildNormalizedAddressKey(
    '608 Maple Avenue, Apt A',
    null,
    'Yukon',
    'OK',
    '73099-1234',
  );
  const unitAVariant2 = buildNormalizedAddressKey(
    '608 Maple Ave',
    '#A',
    'Yukon',
    'OK',
    '73099',
  );
  const unitB = buildNormalizedAddressKey(
    '608 Maple Ave #B',
    null,
    'Yukon',
    'OK',
    '73099',
  );

  assert.equal(unitAVariant1, '608 maple ave|a|yukon|ok|73099');
  assert.equal(unitAVariant1, unitAVariant2);
  assert.notEqual(unitAVariant1, unitB);
  assert.equal(unitB, '608 maple ave|b|yukon|ok|73099');
});

test('mergeStage2RecordWithExisting enriches Stage-1 row upward while protecting operator edited_fields', () => {
  const stage1Norm = normalizeApifyZillowItem(
    makeBaseItem({
      homeStatus: 'FOR_RENT',
      price: '$1,695/mo',
      bathrooms: 2,
      description: 'Short card preview.',
    }),
    { actorId: 'maxcopell/zillow-scraper', runId: 'run-s1', batchId: '4821' },
  );
  assert.equal(stage1Norm.ok, true);
  if (!stage1Norm.ok) throw new Error('expected Stage 1 norm');
  const stage1Row = buildPipelineRecord(stage1Norm.pipelineInput);
  // Operator edited description and monthly_rent manually before Stage-2 arrived
  stage1Row.description = 'Operator curated custom narrative.';
  stage1Row.monthly_rent = 1725;
  stage1Row.edited_fields = JSON.stringify(['description', 'monthly_rent']);

  const stage2Norm = normalizeApifyZillowItem(
    makeBaseItem({
      homeStatus: 'FOR_RENT',
      price: '$1,695/mo',
      bathrooms: 2.5,
      county: 'Canadian County',
      description: 'Full detailed Zillow property description with rich specifications and features.',
      resoFacts: {
        appliances: ['Dishwasher', 'Microwave'],
        cooling: ['Central Air'],
        heating: ['Forced Air'],
      },
    }),
    { actorId: DEFAULT_DETAIL_ACTOR_ID, runId: 'run-s2', batchId: '4821' },
  );
  assert.equal(stage2Norm.ok, true);
  if (!stage2Norm.ok) throw new Error('expected Stage 2 norm');
  const stage2Rec = buildPipelineRecord(stage2Norm.pipelineInput);

  const merged = mergeStage2RecordWithExisting(stage1Row, stage2Rec, { isStage2Detail: true });
  assert.equal(merged.changed, true);
  // Operator-edited fields MUST NOT be overwritten
  assert.equal(merged.patch.description, undefined);
  assert.equal(merged.patch.monthly_rent, undefined);
  // Missing/shallower Stage-1 fields MUST be upgraded upward
  assert.equal(merged.patch.bathrooms, 2.5);
  assert.equal(merged.patch.county, 'Canadian County');
  assert.equal(merged.patch.cooling_type, 'Central Air');
  assert.equal(merged.patch.heating_type, 'Forced Air');
  const upgradedProv = merged.patch.field_provenance as Record<string, unknown>;
  assert.equal(upgradedProv.stage2_enriched, true);
  assert.ok(Number(merged.patch.data_quality_score) > Number(stage1Row.data_quality_score));
});

test('validatePipelineProperty rejects sale-only / invalid rent traps and passes verified dual-listed rentals', async () => {
  const commonBase = {
    id: 'PP-P2TEST',
    address: '608 Maple Ave',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    bedrooms: 3,
    bathrooms: 2.5,
    property_type: 'SINGLE_FAMILY',
    description: 'Clean 3 bed home with garage.',
    original_description: 'Clean 3 bed home with garage.',
    monthly_rent: 1950,
    original_monthly_rent: 1950,
    original_image_urls: JSON.stringify([
      { url: 'https://photos.zillowstatic.com/fp/1.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/2.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/3.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/4.jpg' },
    ]),
    agent_name: 'Owner Direct',
    original_data: { attributionInfo: { listingAgentCategory: 'Property Owner' } },
  };

  // Reject FOR_SALE raw status without rental confirmation
  const saleOnlyReport = await validatePipelineProperty({
    ...commonBase,
    source_status: 'FOR_SALE',
    rental_eligibility_status: 'sale_only',
    source_raw_payload: { homeStatus: 'FOR_SALE', price: 350000 },
  });
  assert.equal(saleOnlyReport.status, 'rejected');
  assert.ok(saleOnlyReport.reasons.includes('non_rental_or_off_market'));

  // Reject rented/leased raw status
  const rentedReport = await validatePipelineProperty({
    ...commonBase,
    source_status: 'RENTED',
    source_raw_payload: { homeStatus: 'RENTED' },
  });
  assert.equal(rentedReport.status, 'rejected');
  assert.ok(rentedReport.reasons.includes('non_rental_or_off_market'));

  // Reject $350,000 sale price stored as monthly_rent
  const salePriceRentReport = await validatePipelineProperty({
    ...commonBase,
    monthly_rent: 350000,
    original_monthly_rent: 350000,
    source_status: 'FOR_RENT',
    rental_eligibility_status: 'dual_listed_rental_active',
    is_dual_listed: true,
    source_raw_payload: { homeStatus: 'FOR_SALE', isForRent: true, salePrice: 350000 },
  });
  assert.equal(salePriceRentReport.status, 'rejected');
  assert.ok(salePriceRentReport.reasons.includes('invalid_sale_price_as_rent'));

  // Pass verified active dual-listed rental
  const dualPassReport = await validatePipelineProperty({
    ...commonBase,
    source_status: 'FOR_RENT',
    rental_eligibility_status: 'dual_listed_rental_active',
    is_dual_listed: true,
    source_raw_payload: {
      homeStatus: 'FOR_SALE',
      isForRent: true,
      salePrice: 350000,
      monthlyRent: 1950,
    },
  });
  assert.equal(dualPassReport.status, 'passed');
});
