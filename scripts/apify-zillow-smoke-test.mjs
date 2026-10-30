import { writeFile } from 'node:fs/promises';

const ACTOR = 'maxcopell~zillow-zip-search';
const MAX_RESULTS = 3;
const MAX_CHARGE_USD = '0.02';

function firstToken(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return String(parsed.find((value) => typeof value === 'string' && value.trim()) || '').trim();
  } catch {
    // A single token is not JSON.
  }
  return raw.split(/[,\n;]/).map((token) => token.trim()).find(Boolean) || '';
}

function normalizeListing(item) {
  if (!item || item.listingStatus !== 'forRent') return null;
  const rent = Number(item.listingPrice?.amount);
  if (!Number.isFinite(rent) || rent <= 0) return null;
  const address = item.listingAddress || {};
  if (String(address.zipCode) !== '76102' || address.state !== 'TX') return null;
  const propertyUrl = typeof item.propertyUrl === 'string' ? item.propertyUrl : '';
  try {
    const url = new URL(propertyUrl);
    if (url.protocol !== 'https:' || !['zillow.com', 'www.zillow.com'].includes(url.hostname) || !/_zpid\/?$/.test(url.pathname)) return null;
  } catch {
    return null;
  }
  const photoUrls = (Array.isArray(item.listingPhotos) ? item.listingPhotos : [])
    .map((photo) => photo?.url)
    .filter((url) => {
      try { return new URL(url).protocol === 'https:'; } catch { return false; }
    })
    .slice(0, 40);
  if (!photoUrls.length && typeof item.mainImage === 'string') {
    try {
      if (new URL(item.mainImage).protocol === 'https:') photoUrls.push(item.mainImage);
    } catch {
      // Ignore malformed image URLs in the actor output.
    }
  }
  const optionalNumber = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);

  return {
    zpid: String(item.zpid || ''),
    source_url: propertyUrl,
    address: address.street || null,
    city: address.city || null,
    state: address.state || null,
    zip: address.zipCode || null,
    monthly_rent: rent,
    bedrooms: optionalNumber(item.bedrooms),
    bathrooms: optionalNumber(item.bathrooms),
    square_footage: optionalNumber(item.livingArea),
    property_type: item.homeType || null,
    original_image_urls: photoUrls,
    publishable: false,
    publish_blocker: 'Search results do not include the full source description; manual review and sanitization are required.',
  };
}

const token = firstToken(process.env.APIFY_API_TOKENS);
if (!token) throw new Error('APIFY_API_TOKENS is unavailable to this workflow.');

const endpoint = new URL(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`);
endpoint.searchParams.set('timeout', '240');
endpoint.searchParams.set('maxTotalChargeUsd', MAX_CHARGE_USD);
endpoint.searchParams.set('format', 'json');
endpoint.searchParams.set('clean', 'true');
endpoint.searchParams.set('limit', String(MAX_RESULTS));

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    zipCodes: ['76102'],
    forRent: true,
    resultsLimit: MAX_RESULTS,
  }),
  signal: AbortSignal.timeout(300_000),
});

if (!response.ok) {
  const detail = (await response.text()).slice(0, 500);
  throw new Error(`Apify Zillow actor returned HTTP ${response.status}: ${detail}`);
}

const rawItems = await response.json();
if (!Array.isArray(rawItems)) throw new Error('Apify returned an unexpected dataset format.');
const listings = rawItems.map(normalizeListing).filter(Boolean).slice(0, MAX_RESULTS);
if (!listings.length) throw new Error('The scrape returned no verified, currently-for-rent listings with an asking rent.');

await writeFile('zillow-smoke-test.json', `${JSON.stringify({
  source: 'Apify Zillow ZIP Code Search Scraper',
  target_zip: '76102',
  result_limit: MAX_RESULTS,
  max_charge_usd: Number(MAX_CHARGE_USD),
  scraped_at: new Date().toISOString(),
  listing_count: listings.length,
  listings,
}, null, 2)}\n`);
console.log(`Saved ${listings.length} verified rentals for review. Apify charge was capped at $${MAX_CHARGE_USD}.`);
