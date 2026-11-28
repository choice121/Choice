import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApifyActorInput,
  canonicalFilterPropType,
  extractVirtualTourAndVideos,
  matchesTaskConfigFilters,
  normalizeApifyZillowItem,
  resolveItemCanonicalType,
  resolveItemLocationKey,
  scorePreferredFeatures,
  selectBalancedItemsByQuota,
} from '../apify-normalizer.ts';

function makeNormalized(overrides: Record<string, unknown> = {}) {
  const res = normalizeApifyZillowItem({
    zpid: overrides.zpid ?? 1001,
    detailUrl: 'https://www.zillow.com/homedetails/100-Main-St/1001_zpid/',
    address: {
      streetAddress: overrides.streetAddress ?? '100 Main St',
      city: overrides.city ?? 'Charlotte',
      state: overrides.state ?? 'NC',
      zipcode: overrides.zipcode ?? '28205',
    },
    price: overrides.price ?? '$1,700/mo',
    bedrooms: overrides.bedrooms ?? 3,
    bathrooms: overrides.bathrooms ?? 2.5,
    homeStatus: overrides.homeStatus ?? 'FOR_RENT',
    homeType: overrides.homeType ?? 'SINGLE_FAMILY',
    description: overrides.description ?? 'Spacious home with fenced backyard, attached garage, and central air.',
    responsivePhotos: [
      { url: 'https://photos.zillowstatic.com/fp/1.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/2.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/3.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/4.jpg' },
    ],
    ...overrides,
  });
  assert.equal(res.ok, true);
  if (!res.ok) throw new Error('expected valid normalization');
  return res;
}

test('extractVirtualTourAndVideos stages safe HTTPS media links while rejecting insecure schemes', () => {
  const media = extractVirtualTourAndVideos(
    {
      virtualTourUrl: 'https://my.matterport.com/show/?m=test99',
      videos: [
        'javascript:alert(1)',
        { url: 'https://cdn.example.com/tour.mp4', title: 'Video Tour' },
      ],
    },
    {},
    {},
  );
  assert.equal(media.virtual_tour_url, 'https://my.matterport.com/show/?m=test99');
  assert.equal(media.videos?.length, 2);
  assert.equal(media.videos?.[1].url, 'https://cdn.example.com/tour.mp4');
});

test('matchesTaskConfigFilters enforces beds, baths, rent, property types, required features, and owner_only', () => {
  const sfh = makeNormalized({
    isForRentByOwner: true,
    bedrooms: 3,
    bathrooms: 2.5,
    price: '$1,750/mo',
  });

  assert.equal(
    matchesTaskConfigFilters(sfh, {
      owner_only: true,
      property_types: ['SINGLE_FAMILY'],
      exact_beds: 3,
      min_baths: 2,
      min_rent: 1500,
      max_rent: 1900,
      required_features: ['fenced yard', 'garage'],
    }).matches,
    true,
  );

  assert.equal(matchesTaskConfigFilters(sfh, { exact_beds: 4 }).matches, false);
  assert.equal(matchesTaskConfigFilters(sfh, { max_rent: 1600 }).matches, false);
  assert.equal(matchesTaskConfigFilters(sfh, { required_features: ['swimming pool'] }).matches, false);
  assert.equal(matchesTaskConfigFilters(sfh, { property_types: ['DUPLEX'] }).matches, false);

  const nonOwner = makeNormalized({
    zpid: 2002,
    attributionInfo: { listingAgentCategory: 'Agent' },
  });
  assert.equal(matchesTaskConfigFilters(nonOwner, { owner_only: true }).reason, 'owner_only_required');
  assert.equal(canonicalFilterPropType('HALF_DUPLEX'), 'DUPLEX');

  const duplexSubtype = makeNormalized({
    zpid: 2003,
    homeType: 'MULTI_FAMILY',
    resoFacts: { propertySubType: ['Half Duplex'] },
  });
  assert.equal(resolveItemCanonicalType(duplexSubtype), 'DUPLEX');
});

test('scorePreferredFeatures + selectBalancedItemsByQuota balance locations and types with preference priority', () => {
  const c1 = makeNormalized({ zpid: 1, city: 'Charlotte', homeType: 'SINGLE_FAMILY', description: 'Pool' });
  const c2 = makeNormalized({ zpid: 2, city: 'Charlotte', homeType: 'SINGLE_FAMILY', description: 'Standard home' });
  const c3 = makeNormalized({ zpid: 3, city: 'Charlotte', homeType: 'SINGLE_FAMILY', description: 'Basement, pool, and garage' });
  const r1 = makeNormalized({ zpid: 4, city: 'Raleigh', homeType: 'TOWNHOUSE', description: 'Pool and garage' });

  const entries = [c1, c2, c3, r1].map((norm) => {
    const pref = scorePreferredFeatures(norm, ['pool', 'garage', 'basement']);
    return {
      item: norm,
      locationKey: resolveItemLocationKey(norm, ['Charlotte, NC', 'Raleigh, NC']),
      typeKey: resolveItemCanonicalType(norm),
      preferenceScore: pref.score,
    };
  });

  // Balanced selection for target=2 picks top-scoring from each location/type bucket
  const balanced = selectBalancedItemsByQuota(entries, {}, 2);
  assert.equal(balanced.length, 2);
  const pickedZpids = new Set(balanced.map((e) => e.item.zpid));
  assert.equal(pickedZpids.has('3'), true); // highest Charlotte score (3)
  assert.equal(pickedZpids.has('4'), true); // highest Raleigh score (2)

  // Explicit location quotas override
  const explicit = selectBalancedItemsByQuota(entries, {
    location_quotas: { 'Charlotte, NC': 2, 'Raleigh, NC': 1 },
  }, 3);
  assert.equal(explicit.length, 3);
});

test('buildApifyActorInput preserves exact resultsLimit on simple queries and scales headroom + encodes searchQueryState for filtered/multi-city queries', () => {
  const simple = buildApifyActorInput({
    locations: ['Charlotte, NC'],
    target_qty: 12,
    min_rent: 1400,
    max_rent: 1950,
  });
  assert.equal(simple.resultsLimit, 12);
  const simpleUrls = simple.searchUrls as Array<{ url: string }>;
  assert.equal(simpleUrls.length, 1);
  const simpleQs = JSON.parse(new URL(simpleUrls[0].url).searchParams.get('searchQueryState') || '{}');
  assert.equal(simpleQs.filterState.isForRent.value, true);
  assert.deepEqual(simpleQs.filterState.monthlyPayment, { min: 1400, max: 1950 });

  const filtered = buildApifyActorInput({
    locations: ['Charlotte, NC', 'Raleigh, NC'],
    property_types: ['SINGLE_FAMILY'],
    owner_only: true,
    target_qty: 10,
  });
  assert.equal(filtered.resultsLimit, 30);
  const filteredUrls = filtered.searchUrls as Array<{ url: string }>;
  assert.equal(filteredUrls.length, 2);
  const filteredQs = JSON.parse(new URL(filteredUrls[0].url).searchParams.get('searchQueryState') || '{}');
  assert.equal(filteredQs.filterState.isForRentByOwner.value, true);
  assert.equal(filteredQs.filterState.isSingleFamily.value, true);
});
