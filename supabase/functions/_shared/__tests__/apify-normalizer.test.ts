import { assertEquals } from 'https://deno.land/std@0.220.0/assert/mod.ts';
import {
  buildApifyActorInput,
  extractPosterProfileSignal,
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
  assertEquals(input.maxItems, 12);
});
