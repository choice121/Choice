import { assertEquals } from 'https://deno.land/std@0.220.0/assert/mod.ts';
import {
  buildApifyActorInput,
  extractPosterProfileSignal,
  matchesTaskConfigFilters,
  normalizeApifyZillowItem,
} from '../apify-normalizer.ts';

Deno.test('normalizeApifyZillowItem preserves fractional bathrooms, asking rent, and strict photo order', () => {
  const result = normalizeApifyZillowItem(
    {
      zpid: 44556677,
      detailUrl: 'https://www.zillow.com/homedetails/123-Oak-St-Charlotte-NC-28205/44556677_zpid/?utm_source=test',
      address: {
        streetAddress: '123 Oak St',
        city: 'Charlotte',
        state: 'NC',
        zipcode: '28205',
      },
      price: '$1,795/mo',
      rentZestimate: 2150,
      bedrooms: 3,
      bathrooms: 2.5,
      homeType: 'SINGLE_FAMILY',
      homeStatus: 'FOR_RENT',
      description: 'Clean 3 bed, 2.5 bath home with fenced yard and attached garage.',
      responsivePhotos: [
        { url: 'https://photos.zillowstatic.com/fp/first-cover.jpg' },
        { url: 'https://photos.zillowstatic.com/fp/second-living.jpg' },
        { url: 'https://photos.zillowstatic.com/fp/third-kitchen.jpg' },
        { url: 'https://photos.zillowstatic.com/fp/fourth-bath.jpg' },
      ],
      attributionInfo: {
        agentName: 'Jordan Smith',
        listingAgentCategory: 'Property Owner',
      },
    },
    { actorId: 'maxcopell/zillow-scraper', runId: 'run-abc', batchId: '4821' },
  );

  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(result.zpid, '44556677');
  assertEquals(result.source_url, 'https://www.zillow.com/homedetails/123-Oak-St-Charlotte-NC-28205/44556677_zpid/');
  assertEquals(result.pipelineInput.bathrooms, 2.5);
  assertEquals(result.pipelineInput.half_bathrooms, 1);
  assertEquals(result.pipelineInput.monthly_rent, 1795);
  assertEquals(result.pipelineInput.original_monthly_rent, 1795);
  assertEquals(result.posterProfile.explicit_owner_landlord, true);
  assertEquals(result.posterProfile.poster_category, 'explicit_owner_landlord');

  const imgs = JSON.parse(result.pipelineInput.original_image_urls || '[]');
  assertEquals(imgs.length, 4);
  assertEquals(imgs[0].url, 'https://photos.zillowstatic.com/fp/first-cover.jpg');
});

Deno.test('extractPosterProfileSignal never guesses owner status from person name alone', () => {
  const signal = extractPosterProfileSignal({
    attributionInfo: {
      agentName: 'Alex Mercer',
    },
  });

  assertEquals(signal.agent_name, 'Alex Mercer');
  assertEquals(signal.explicit_owner_landlord, false);
  assertEquals(signal.poster_category, 'unverified');
});

Deno.test('buildApifyActorInput only allows https zillow.com searchUrls', () => {
  const input = buildApifyActorInput({
    locations: ['Charlotte, NC'],
    search_urls: [
      'http://127.0.0.1/evil',
      'https://evil.example.com/rentals/',
      'https://www.zillow.com/charlotte-nc/rentals/',
    ],
    target_qty: 12,
    min_rent: 1400,
    max_rent: 1950,
  });

  const urls = input.searchUrls as Array<{ url: string }>;
  assertEquals(urls.length, 1);
  assertEquals(urls[0].url, 'https://www.zillow.com/charlotte-nc/rentals/');
  assertEquals(input.resultsLimit, 12);
});

Deno.test('normalizeApifyZillowItem stages virtual_tour_url and videos and matches task_config filters & quotas', () => {
  const res = normalizeApifyZillowItem({
    zpid: 99887766,
    detailUrl: 'https://www.zillow.com/homedetails/500-Pine-St-Charlotte-NC-28205/99887766_zpid/',
    address: {
      streetAddress: '500 Pine St',
      city: 'Charlotte',
      state: 'NC',
      zipcode: '28205',
    },
    price: '$1,650/mo',
    bedrooms: 3,
    bathrooms: 2,
    homeType: 'SINGLE_FAMILY',
    description: 'Fenced backyard with 2-car garage and central air.',
    virtualTourUrl: 'https://my.matterport.com/show/?m=abc123',
    videos: [{ url: 'https://cdn.example.com/walkthrough.mp4', title: 'Walkthrough' }],
    responsivePhotos: [
      { url: 'https://photos.zillowstatic.com/fp/p1.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/p2.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/p3.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/p4.jpg' },
    ],
    isForRentByOwner: true,
  });

  assertEquals(res.ok, true);
  if (!res.ok) return;

  assertEquals(res.pipelineInput.virtual_tour_url, 'https://my.matterport.com/show/?m=abc123');
  assertEquals(Array.isArray(res.pipelineInput.videos), true);
  assertEquals(res.pipelineInput.videos?.length, 2);

  assertEquals(
    matchesTaskConfigFilters(res, {
      owner_only: true,
      property_types: ['SINGLE_FAMILY'],
      exact_beds: 3,
      min_rent: 1500,
      max_rent: 1800,
      required_features: ['fenced yard', 'garage'],
    }).matches,
    true,
  );
  assertEquals(matchesTaskConfigFilters(res, { property_types: ['DUPLEX'] }).matches, false);
});

Deno.test('buildApifyActorInput applies headroom scaling and owner_only filter when needed', () => {
  const input = buildApifyActorInput({
    locations: ['Charlotte, NC', 'Raleigh, NC'],
    property_types: ['SINGLE_FAMILY', 'TOWNHOME'],
    owner_only: true,
    target_qty: 10,
  });

  assertEquals(input.resultsLimit, 30);
  const urls = input.searchUrls as Array<{ url: string }>;
  const qs = JSON.parse(new URL(urls[0].url).searchParams.get('searchQueryState') || '{}');
  assertEquals(qs.filterState.isForRentByOwner.value, true);
  assertEquals(qs.filterState.isForRent.value, true);
});

