import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DETAIL_ACTOR_ID,
  isExcludedScopeKey,
  mergeStage2RecordWithExisting,
  normalizeApifyZillowItem,
} from '../apify-normalizer.ts';
import {
  BONUS_FIELDS,
  TRACKABLE_MISSING,
  buildPipelineRecord,
  qualityScore,
} from '../pipeline-record.ts';
import { STANDARD_UTILITY_KEYS } from '../utility-matrix.ts';

test('Phase 3 lossless extractor populates all 4 JSONB domains, preserves 100% of non-excluded actor keys, and strips excluded keys', () => {
  const maxcopellDetailFixture: Record<string, unknown> = {
    zpid: 44991100,
    detailUrl: 'https://www.zillow.com/homedetails/608-Maple-Ave-Yukon-OK-73099/44991100_zpid/',
    homeStatus: 'FOR_RENT',
    homeType: 'SINGLE_FAMILY',
    price: '$1,695/mo',
    bedrooms: 3,
    bathrooms: 2.5,
    livingArea: 1740,
    yearBuilt: 2018,
    county: 'Canadian County',
    neighborhood: 'Cedarbrook',
    address: {
      streetAddress: '608 Maple Ave',
      city: 'Yukon',
      state: 'OK',
      zipcode: '73099',
    },
    description: 'Spacious 3 bed, 2.5 bath home with s/r/dw/mw kitchen package, fenced backyard, and storm shelter.',
    monthlyHoaFee: 45,
    parkingFee: 0,
    adminFee: 100,
    // Excluded-scope fields that MUST NEVER enter canonical JSONB, ledger, or unmapped_attributes
    datePosted: '2026-11-01',
    daysOnZillow: 14,
    zestimate: 295000,
    rentZestimate: 1850,
    taxAnnualAmount: 3120,
    taxHistory: [{ time: 1700000000, taxPaid: 3100 }],
    priceHistory: [{ date: '2026-10-01', price: 1750 }],
    parcelId: 'R12345678',
    floodZone: 'X',
    walkScore: 42,
    transitScore: 15,
    bikeScore: 38,
    nearbyHomes: [{ zpid: 1 }],
    // Novel top-level non-excluded attribute
    stormShelterType: 'Garage Floor In-Ground Shelter',
    atAGlanceFacts: [
      { factLabel: 'Type', factValue: 'Single Family' },
      { factLabel: 'Days on Zillow', factValue: '14 Days' },
      { factLabel: 'Cooling', factValue: 'Central Air' },
    ],
    resoFacts: {
      propertySubType: ['Single Family Residence'],
      architecturalStyle: 'Traditional',
      constructionMaterials: ['Brick', 'Wood Siding'],
      foundationDetails: ['Slab'],
      roofType: ['Composition'],
      exteriorFeatures: ['Covered Patio', 'EV Charger Ready'],
      interiorFeatures: ['Walk-In Closet(s)', 'Ceiling Fan(s)'],
      flooring: ['Luxury Vinyl Plank', 'Carpet'],
      fencing: ['Wood Privacy'],
      patioAndPorchFeatures: ['Covered Patio'],
      fireplaceFeatures: ['Gas Log'],
      windowFeatures: ['Double Pane Windows'],
      accessibilityFeatures: ['No-Step Entry'],
      parkingFeatures: ['Attached Garage', 'Level 2 EV Charger'],
      garageSpaces: 2,
      appliances: ['Dishwasher', 'Gas Range', 'Microwave', 'Refrigerator'],
      laundryFeatures: ['In Unit', 'Laundry Room'],
      heating: ['Forced Air', 'Natural Gas'],
      cooling: ['Central Air'],
      utilitiesIncluded: ['Trash', 'Lawn Care'],
      utilities: ['Electric (Tenant)', 'Natural Gas (Tenant)'],
      electric: ['220 Volts in Laundry'],
      gas: ['Natural Gas Available'],
      waterSource: ['Municipal Water'],
      sewer: ['Public Sewer'],
      associationFeeIncludes: ['Common Area Maintenance'],
      subdivision: 'Maple Estates',
      highSchoolDistrict: 'Yukon Public Schools',
      // Novel non-excluded resoFacts keys
      ceilingHeight: '10 ft',
      waterfrontFeatures: ['Creek'],
    },
    schools: [
      { name: 'Maple Elementary', level: 'Primary', grades: 'K-5', rating: 8, distance: 0.7, district: 'Yukon Public Schools' },
      { name: 'Yukon High School', level: 'High', grades: '9-12', rating: 7, distance: 2.1, district: 'Yukon Public Schools' },
    ],
    responsivePhotos: [
      { url: 'https://photos.zillowstatic.com/fp/1.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/2.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/3.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/4.jpg' },
    ],
    isForRentByOwner: true,
  };

  const norm = normalizeApifyZillowItem(maxcopellDetailFixture, {
    actorId: DEFAULT_DETAIL_ACTOR_ID,
    batchId: '4821',
  });
  assert.equal(norm.ok, true);
  if (!norm.ok) throw new Error('Expected valid normalization');

  const rec = buildPipelineRecord(norm.pipelineInput);

  // Date & assessor tax columns strictly null
  assert.equal(rec.listed_at, null);
  assert.equal(rec.source_last_updated_at, null);
  assert.equal(rec.tax_annual_amount, null);
  assert.equal(rec.tax_value, null);
  assert.equal(rec.hoa_fee, 45);
  assert.equal(rec.hoa_fee_frequency, 'Monthly');
  assert.equal(rec.ev_charging, 'Level 2 EV Charger');

  // 1. structural_details
  const sd = rec.structural_details as Record<string, unknown>;
  assert.equal(sd.architectural_style, 'Traditional');
  assert.deepEqual(sd.construction_materials, ['Brick', 'Wood Siding']);
  assert.deepEqual(sd.foundation_details, ['Slab']);
  assert.deepEqual(sd.roof, ['Composition']);
  assert.deepEqual(sd.fencing, ['Wood Privacy']);
  assert.deepEqual(sd.window_features, ['Double Pane Windows']);
  assert.deepEqual(sd.accessibility_features, ['No-Step Entry']);
  assert.equal(sd.ev_charging, 'Level 2 EV Charger');

  // 2. utility_details + 13-key Choice utility_matrix
  const ud = rec.utility_details as Record<string, unknown>;
  const matrix = ud.utility_matrix as Record<string, { responsibility: string; notes: string }>;
  for (const key of STANDARD_UTILITY_KEYS) {
    assert.ok(matrix[key], `Missing standard utility key ${key}`);
  }
  assert.equal(matrix.trash.responsibility, 'landlord');
  assert.equal(matrix.lawn_care.responsibility, 'landlord');
  assert.equal(matrix.water.responsibility, 'tenant');
  assert.equal(matrix.sewer.responsibility, 'tenant');
  assert.equal(matrix.electric.responsibility, 'tenant');
  assert.equal(matrix.hoa.responsibility, 'landlord');
  assert.deepEqual(ud.water_source, ['Municipal Water']);
  assert.deepEqual(ud.sewer, ['Public Sewer']);

  // 3. financial_details (non-dated rental financials only, zero Zestimates/taxes)
  const fd = rec.financial_details as Record<string, unknown>;
  assert.equal(fd.asking_rent, 1695);
  assert.equal(fd.application_fee, 50);
  assert.equal(fd.hoa_fee, 45);
  assert.equal(fd.hoa_fee_frequency, 'Monthly');
  assert.equal(fd.zestimate, undefined);
  assert.equal(fd.rent_zestimate, undefined);
  assert.equal(fd.tax_annual_amount, undefined);
  assert.equal(fd.price_history, undefined);
  assert.equal(fd.tax_history, undefined);

  // 4. location_details (schools + district + subdivision; Level-1 excludes walk/transit/bike scores)
  const ld = rec.location_details as Record<string, unknown>;
  assert.equal(ld.county, 'Canadian County');
  assert.equal(ld.subdivision, 'Maple Estates');
  assert.equal(ld.school_district, 'Yukon Public Schools');
  assert.equal((ld.schools as Array<unknown>).length, 2);
  assert.equal(ld.walk_score, undefined);

  // 5. source_facts_ledger + unmapped_attributes 100% key coverage & zero excluded leaks
  const ledger = rec.source_facts_ledger as Record<string, any>;
  const unmapped = rec.unmapped_attributes as Record<string, unknown>;
  assert.equal(unmapped.stormShelterType, 'Garage Floor In-Ground Shelter');
  assert.equal(unmapped.ceilingHeight, '10 ft');
  assert.deepEqual(unmapped.waterfrontFeatures, ['Creek']);

  const serializedLedgerAndUnmapped = JSON.stringify({ ledger, unmapped, sd, ud, fd, ld });
  for (const forbidden of [
    'zestimate',
    'rentZestimate',
    'taxHistory',
    'priceHistory',
    'taxAnnualAmount',
    'parcelId',
    'floodZone',
    'daysOnZillow',
    'datePosted',
    'walkScore',
  ]) {
    assert.equal(
      serializedLedgerAndUnmapped.includes(forbidden),
      false,
      `Excluded key ${forbidden} must NOT leak into Phase 3 extracted structures`,
    );
  }

  // Every non-excluded top-level + resoFacts key on fixture is accounted for in raw_attribute_states
  const states = ledger.raw_attribute_states as Record<string, { target: string; state: string }>;
  for (const k of Object.keys(maxcopellDetailFixture)) {
    if (isExcludedScopeKey(k) || k === 'resoFacts' || k === 'responsivePhotos') continue;
    assert.ok(states[k], `Expected top-level non-excluded key "${k}" in raw_attribute_states`);
  }
  for (const k of Object.keys(maxcopellDetailFixture.resoFacts as Record<string, unknown>)) {
    if (isExcludedScopeKey(k)) continue;
    assert.ok(states[`resoFacts.${k}`], `Expected resoFacts.${k} in raw_attribute_states`);
  }
});

test('multi-shape extraction supports cliqtomedia & igolaizola shapes cleanly', () => {
  const cliqtoPayload = {
    zpid: '55112233',
    detailUrl: 'https://www.zillow.com/homedetails/12-Pine-Dr/55112233_zpid/',
    status: 'FOR_RENT',
    price: '$1,550/mo',
    beds: 3,
    baths: 2,
    sqft: 1420,
    monthlyHoaFee: 0,
    grossRentalYield: 6.8,
    address: { streetAddress: '12 Pine Dr', city: 'Edmond', state: 'OK', zipcode: '73013' },
    propertyFeatures: {
      appliances: 'Dishwasher, Microwave, Refrigerator',
      cooling: 'Central Air',
      heating: 'Gas Heat',
      laundry: 'Hookups',
      parking: '2-Car Garage',
      greenCertification: 'ENERGY STAR',
    },
    details: {
      yearBuilt: 2012,
      subdivision: 'Pinehurst',
    },
    schools: [{ name: 'Edmond North High', grades: '9-12', rating: 9 }],
    photos: [
      'https://photos.zillowstatic.com/fp/1.jpg',
      'https://photos.zillowstatic.com/fp/2.jpg',
      'https://photos.zillowstatic.com/fp/3.jpg',
      'https://photos.zillowstatic.com/fp/4.jpg',
    ],
  };

  const cliqNorm = normalizeApifyZillowItem(cliqtoPayload, { actorId: 'cliqtomedia/zillow-scraper' });
  assert.equal(cliqNorm.ok, true);
  if (!cliqNorm.ok) throw new Error('expected valid cliqto normalization');

  assert.equal(cliqNorm.pipelineInput.square_footage, 1420);
  assert.equal(cliqNorm.pipelineInput.year_built, 2012);
  assert.equal(cliqNorm.pipelineInput.laundry_type, 'Hookups');
  const ledger = cliqNorm.pipelineInput.source_facts_ledger as Record<string, any>;
  assert.equal(ledger.facts.hoa.state, 'not_applicable');
  assert.equal((cliqNorm.pipelineInput.unmapped_attributes as Record<string, unknown>).greenCertification, 'ENERGY STAR');
  assert.equal((cliqNorm.pipelineInput.unmapped_attributes as Record<string, unknown>).grossRentalYield, undefined);

  const igolaizolaPayload = {
    zpid: '66112233',
    homeStatus: 'FOR_RENT',
    monthlyRent: 1890,
    address: { streetAddress: '99 Elm Ct', city: 'Moore', state: 'OK', zipcode: '73160' },
    bedrooms: 4,
    bathrooms: 2.5,
    _details: {
      livingArea: 1980,
      resoFacts: {
        appliances: ['Gas Range', 'Dishwasher'],
        roofType: ['Architectural Shingle'],
      },
      assignedSchools: [{ name: 'Moore High School', district: 'Moore Public Schools', rating: 7 }],
    },
  };
  const igNorm = normalizeApifyZillowItem(igolaizolaPayload, { actorId: 'igolaizola/zillow-scraper-ppe' });
  assert.equal(igNorm.ok, true);
  if (!igNorm.ok) throw new Error('expected valid igolaizola normalization');
  assert.equal(igNorm.pipelineInput.square_footage, 1980);
  assert.equal((igNorm.pipelineInput.location_details as Record<string, unknown>).school_district, 'Moore Public Schools');
  assert.deepEqual((igNorm.pipelineInput.structural_details as Record<string, unknown>).roof, ['Architectural Shingle']);
});

test('confirmed_absent facts are distinguished from unspecified, detect narrative conflicts, and prevent fabrication', () => {
  const conflictItem = {
    zpid: 77112233,
    homeStatus: 'FOR_RENT',
    monthlyRent: 1450,
    address: { streetAddress: '10 Oak St', city: 'Norman', state: 'OK', zipcode: '73069' },
    bedrooms: 2,
    bathrooms: 1,
    // Description claims central air & 2-car garage, but structured fields explicitly report absent!
    description: 'Charming 2 bed home with central air, fireplace, and 2-car garage.',
    resoFacts: {
      hasCooling: false,
      garageSpaces: 0,
      hasFireplace: false,
      appliances: ['None'],
    },
  };

  const norm = normalizeApifyZillowItem(conflictItem);
  assert.equal(norm.ok, true);
  if (!norm.ok) throw new Error('expected valid item');

  const rec = buildPipelineRecord(norm.pipelineInput);
  const ledger = rec.source_facts_ledger as Record<string, any>;

  // Confirmed absent vs unspecified (e.g. fencing omitted -> unspecified)
  assert.equal(ledger.facts.central_air.state, 'confirmed_absent');
  assert.equal(ledger.facts.garage.state, 'confirmed_absent');
  assert.equal(ledger.facts.fireplace.state, 'confirmed_absent');
  assert.equal(ledger.facts.appliances.state, 'confirmed_absent');
  assert.equal(ledger.facts.fencing.state, 'unspecified');

  // Narrative conflict logged cleanly
  const conflictFields = (ledger.conflicts as Array<{ field: string }>).map((c) => c.field);
  assert.ok(conflictFields.includes('central_air'));
  assert.ok(conflictFields.includes('garage'));
  assert.ok(conflictFields.includes('fireplace'));

  // buildPipelineRecord did NOT fabricate central air or garage from narrative over confirmed_absent!
  assert.equal(rec.has_central_air, false);
  assert.equal(rec.garage_spaces, 0);
  assert.equal(rec.parking, null);
});

test('qualityScore removes pets_allowed & security_deposit bias and Stage-2 merge preserves source_facts_ledger', () => {
  assert.equal(BONUS_FIELDS.includes('pets_allowed'), false);
  assert.equal(BONUS_FIELDS.includes('security_deposit'), false);
  assert.equal(TRACKABLE_MISSING.includes('pets_allowed'), false);
  assert.equal(TRACKABLE_MISSING.includes('security_deposit'), false);

  const base = buildPipelineRecord({
    source: 'zillow',
    source_listing_id: '9001',
    address: '500 Elm St',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    monthly_rent: 1500,
    bedrooms: 3,
    bathrooms: 2,
    property_type: 'SINGLE_FAMILY',
    description: 'Nice house.',
  });
  const withPetsAndDeposit = buildPipelineRecord({
    source: 'zillow',
    source_listing_id: '9002',
    address: '500 Elm St',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    monthly_rent: 1500,
    bedrooms: 3,
    bathrooms: 2,
    property_type: 'SINGLE_FAMILY',
    description: 'Nice house.',
    pets_allowed: true,
    security_deposit: 1500,
  });
  assert.equal(base.data_quality_score, withPetsAndDeposit.data_quality_score);
  assert.equal(base.data_quality_score, qualityScore(base));

  // Verify Stage-2 merge updates source_facts_ledger and unmapped_attributes
  const stage2Norm = normalizeApifyZillowItem(
    {
      zpid: '9001',
      homeStatus: 'FOR_RENT',
      monthlyRent: 1500,
      address: { streetAddress: '500 Elm St', city: 'Yukon', state: 'OK', zipcode: '73099' },
      bedrooms: 3,
      bathrooms: 2,
      resoFacts: { roofType: ['Metal'] },
      tornadoShelter: true,
    },
    { actorId: DEFAULT_DETAIL_ACTOR_ID },
  );
  assert.equal(stage2Norm.ok, true);
  if (!stage2Norm.ok) throw new Error('expected stage 2 norm');
  const stage2Rec = buildPipelineRecord(stage2Norm.pipelineInput);
  const merged = mergeStage2RecordWithExisting(base, stage2Rec, { isStage2Detail: true });
  assert.equal(merged.changed, true);
  assert.ok(merged.upgradedFields.includes('source_facts_ledger'));
  assert.ok(merged.upgradedFields.includes('unmapped_attributes'));
});
