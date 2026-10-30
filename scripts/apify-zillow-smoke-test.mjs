import { writeFile } from 'node:fs/promises';

const ACTOR = 'maxcopell~zillow-zip-search';
const MAX_RESULTS = 3;
const MAX_CHARGE_USD = '0.02';
const ZIP_CODES = ['76116', '76137'];

async function apifyRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok) throw new Error(`Apify returned HTTP ${response.status}.`);
  return response;
}

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

function isZillowDetailUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      ['zillow.com', 'www.zillow.com'].includes(url.hostname) &&
      /_zpid\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

function normalizeListing(item) {
  if (!item || item.listingStatus !== 'forRent') return null;
  const rent = Number(item.listingPrice?.amount);
  if (!Number.isFinite(rent) || rent <= 0) return null;
  const address = item.listingAddress || {};
  if (!ZIP_CODES.includes(String(address.zipCode)) || address.state !== 'TX') return null;
  const propertyUrl = typeof item.propertyUrl === 'string' ? item.propertyUrl : '';
  if (!isZillowDetailUrl(propertyUrl)) return null;
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

const mode = process.env.APIFY_MODE || 'scrape';
let rawItems;
if (mode === 'inspect-last-run') {
  const runUrl = new URL(`https://api.apify.com/v2/acts/${ACTOR}/runs/last`);
  runUrl.searchParams.set('origin', 'API');
  runUrl.searchParams.set('status', 'SUCCEEDED');
  const run = await (await apifyRequest(runUrl)).json();
  const datasetId = run?.data?.defaultDatasetId;
  if (!datasetId) throw new Error('No successful Apify API run dataset was found.');
  const datasetUrl = new URL(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items`);
  datasetUrl.searchParams.set('format', 'json');
  datasetUrl.searchParams.set('clean', 'true');
  datasetUrl.searchParams.set('limit', String(MAX_RESULTS));
  rawItems = await (await apifyRequest(datasetUrl)).json();
} else if (mode === 'scrape') {
  const endpoint = new URL(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`);
  endpoint.searchParams.set('timeout', '240');
  endpoint.searchParams.set('maxTotalChargeUsd', MAX_CHARGE_USD);
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('clean', 'true');
  endpoint.searchParams.set('limit', String(MAX_RESULTS));

  const response = await apifyRequest(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      zipCodes: ZIP_CODES,
      forRent: true,
      resultsLimit: MAX_RESULTS,
    }),
  });
  rawItems = await response.json();
} else {
  throw new Error(`Unsupported Apify workflow mode: ${mode}`);
}

if (!Array.isArray(rawItems)) throw new Error('Apify returned an unexpected dataset format.');
const listings = rawItems.map(normalizeListing).filter(Boolean).slice(0, MAX_RESULTS);
const statusCounts = rawItems.reduce((counts, item) => {
  const status = String(item?.listingStatus || 'missing');
  counts[status] = (counts[status] || 0) + 1;
  return counts;
}, {});
const diagnostics = rawItems.slice(0, MAX_RESULTS).map((item) => ({
  top_level_fields: Object.keys(item || {}),
  listing_status: item?.listingStatus || null,
  zip: item?.listingAddress?.zipCode == null ? null : String(item.listingAddress.zipCode),
  state: item?.listingAddress?.state || null,
  address_fields: Object.keys(item?.listingAddress || {}),
  price_fields: Object.fromEntries(Object.entries(item || {})
    .filter(([key]) => /price|rent/i.test(key))
    .map(([key, value]) => [key, value && typeof value === 'object' ? value.amount ?? typeof value : value])),
  zillow_url_fields: Object.entries(item || {})
    .filter(([key, value]) => /url|link/i.test(key) && isZillowDetailUrl(value))
    .map(([key]) => key),
  photo_count: Array.isArray(item?.listingPhotos) ? item.listingPhotos.length : 0,
}));

await writeFile('zillow-smoke-test.json', `${JSON.stringify({
  source: 'Apify Zillow ZIP Code Search Scraper',
  target_zips: ZIP_CODES,
  mode,
  result_limit: MAX_RESULTS,
  max_charge_usd: mode === 'scrape' ? Number(MAX_CHARGE_USD) : 0,
  scraped_at: new Date().toISOString(),
  actor_returned_count: rawItems.length,
  listing_status_counts: statusCounts,
  diagnostics,
  listing_count: listings.length,
  listings,
  publishable: false,
  publish_note: 'Search results do not include the full source description; manual review and sanitization are required.',
}, null, 2)}\n`);
console.log(`Saved ${listings.length} verified rentals from ${rawItems.length} actor results for review (${mode} mode).`);
