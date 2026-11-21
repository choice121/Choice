// ============================================================================
// Choice Properties — Shared Apify Zillow Normalizer & Provenance Builder
// ============================================================================
// Losslessly converts raw Apify Zillow scraper/detail JSON items into the
// canonical PipelineRecordInput consumed by _shared/pipeline-record.ts.
// Preserves:
//   - Authentic physical address & rooftop coordinates (Directive 1)
//   - Strict original source photo ordering & HTTPS CDN URLs (Directive 2)
//   - Exact fractional bathroom counts (1.5, 2.5, 3.5 — never truncated)
//   - Original asking rent in original_monthly_rent (never rentZestimate)
//   - Structured poster/profile attribution without name-only owner guessing
// ============================================================================

import type { PipelineRecordInput } from './pipeline-record.ts';

const ZILLOW_HOSTS = new Set(['zillow.com', 'www.zillow.com']);

export interface PosterProfileSignal {
  agent_name: string | null;
  broker_name: string | null;
  raw_attribution_type: string | null;
  seller_type: string | null;
  explicit_owner_landlord: boolean;
  poster_category:
    | 'explicit_owner_landlord'
    | 'explicit_agent_or_broker'
    | 'explicit_management_company'
    | 'unverified';
}

export interface NormalizeApifyContext {
  actorId?: string | null;
  runId?: string | null;
  datasetId?: string | null;
  providerKey?: string | null;
  batchId?: string | null;
  channel?: string | null;
}

export type NormalizeApifyResult =
  | {
      ok: true;
      zpid: string;
      source_url: string;
      pipelineInput: PipelineRecordInput;
      posterProfile: PosterProfileSignal;
      rawItem: Record<string, unknown>;
    }
  | {
      ok: false;
      reason: string;
    };

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asStr(v: unknown): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  return s || null;
}

function asNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const cleaned = v.replace(/,/g, '');
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function parseAskingRent(v: unknown): number | null {
  const n = asNum(v);
  return n !== null && n > 0 ? Math.round(n) : null;
}

function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(asStr).filter((x): x is string => Boolean(x));
}

export function sanitizeZillowUrl(raw: unknown, zpid?: string | null): string {
  const candidate = asStr(raw);
  if (candidate) {
    try {
      const normalized = candidate.startsWith('/')
        ? new URL(`https://www.zillow.com${candidate}`)
        : new URL(candidate);
      if (normalized.protocol === 'https:' && ZILLOW_HOSTS.has(normalized.hostname.toLowerCase()) && !normalized.username && !normalized.password) {
        normalized.search = '';
        normalized.hash = '';
        return normalized.toString();
      }
    } catch {
      // Fall back to canonical zpid URL below if valid zpid exists
    }
  }
  if (zpid && /^\d{4,20}$/.test(zpid)) {
    return `https://www.zillow.com/homedetails/${zpid}_zpid/`;
  }
  return 'https://www.zillow.com/';
}

export function extractPosterProfileSignal(raw: Record<string, unknown>): PosterProfileSignal {
  const hdpInfo = asObj(asObj(raw.hdpData).homeInfo);
  const attribution = {
    ...asObj(raw.attributionInfo),
    ...asObj(hdpInfo.attributionInfo),
  };
  const listingSubType = {
    ...asObj(raw.listingSubType),
    ...asObj(hdpInfo.listingSubType),
    ...asObj(raw.listingMetadata),
  };

  const agentName = asStr(
    attribution.agentName ||
      raw.agentName ||
      raw.listedByName ||
      attribution.listingAgentName,
  );
  const brokerName = asStr(
    attribution.brokerName ||
      raw.brokerName ||
      raw.brokerageName ||
      attribution.brokerageName ||
      raw.managementCompanyName ||
      raw.propertyManagerName,
  );
  const sellerType = asStr(
    attribution.sellerType ||
      attribution.listingAgentCategory ||
      attribution.listingCategory ||
      raw.sellerType ||
      raw.listingTypeDimension ||
      raw.postedByType ||
      listingSubType.type,
  );
  const rawAttributionType = asStr(
    attribution.listingAgentCategory ||
      attribution.posterCategory ||
      raw.attributionType ||
      raw.postedBy ||
      sellerType,
  );

  const explicitOwnerBool =
    raw.isForRentByOwner === true ||
    raw.is_FRBO === true ||
    raw.is_FSBO === true ||
    listingSubType.is_FSBO === true ||
    listingSubType.is_for_rent_by_owner === true ||
    attribution.isPropertyOwner === true ||
    attribution.isLandlord === true;

  const ownerTypePattern =
    /^(?:property[\s_]*owner|owner|landlord|for[\s_]*rent[\s_]*by[\s_]*owner|frbo|fsbo)$/i;
  const ownerPhrasePattern =
    /\b(?:posted\s+by\s+(?:property\s+)?owner|for\s+rent\s+by\s+owner|listed\s+by\s+(?:property\s+)?owner|verified\s+landlord)\b/i;

  const explicitOwnerByCategory = Boolean(
    (sellerType && (ownerTypePattern.test(sellerType) || ownerPhrasePattern.test(sellerType))) ||
      (rawAttributionType && (ownerTypePattern.test(rawAttributionType) || ownerPhrasePattern.test(rawAttributionType))),
  );

  // Rule: NEVER treat a human person's name (agentName / listedByName) as owner/landlord proof!
  const explicitOwnerLandlord = explicitOwnerBool || explicitOwnerByCategory;

  let posterCategory: PosterProfileSignal['poster_category'] = 'unverified';
  if (explicitOwnerLandlord) {
    posterCategory = 'explicit_owner_landlord';
  } else if (
    (sellerType && /management|property[\s_]*manager|operator|pm\b/i.test(sellerType)) ||
    (rawAttributionType && /management|property[\s_]*manager|operator/i.test(rawAttributionType)) ||
    (brokerName && /\b(?:management|residential|properties|homes|leasing|realty|llc|inc)\b/i.test(brokerName))
  ) {
    posterCategory = 'explicit_management_company';
  } else if (
    brokerName ||
    (sellerType && /\b(?:agent|broker|mls|realtor)\b/i.test(sellerType)) ||
    (rawAttributionType && /\b(?:agent|broker|mls|realtor)\b/i.test(rawAttributionType))
  ) {
    posterCategory = 'explicit_agent_or_broker';
  }

  return {
    agent_name: agentName,
    broker_name: brokerName,
    raw_attribution_type: rawAttributionType,
    seller_type: sellerType,
    explicit_owner_landlord: explicitOwnerLandlord,
    poster_category: posterCategory,
  };
}

function extractPhotoUrl(item: unknown): string | null {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    return trimmed.startsWith('https://') ? trimmed : null;
  }
  const obj = asObj(item);
  const mixed = asObj(obj.mixedSources);
  const jpeg = Array.isArray(mixed.jpeg) ? mixed.jpeg : [];
  let bestUrl: string | null = null;
  let bestWidth = -1;
  for (const variant of jpeg) {
    const v = asObj(variant);
    const u = asStr(v.url);
    const w = Number(v.width || 0);
    if (u && u.startsWith('https://') && w >= bestWidth) {
      bestWidth = w;
      bestUrl = u;
    }
  }
  if (bestUrl) return bestUrl;
  const direct = asStr(obj.url || obj.href || obj.src);
  return direct && direct.startsWith('https://') ? direct : null;
}

export function extractOrderedPhotos(
  raw: Record<string, unknown>,
  hdpInfo: Record<string, unknown>,
  maxPhotos = 50,
): Array<{ url: string; caption?: string | null; room_label?: string | null }> {
  const photos: Array<{ url: string; caption?: string | null; room_label?: string | null }> = [];
  const seen = new Set<string>();

  const collections = [
    raw.responsivePhotosOriginalRatio,
    raw.responsivePhotos,
    raw.hugePhotos,
    raw.largePhotos,
    raw.photos,
    raw.carouselPhotos,
    hdpInfo.responsivePhotosOriginalRatio,
    hdpInfo.photos,
  ];

  for (const col of collections) {
    if (!Array.isArray(col)) continue;
    for (const entry of col) {
      const url = extractPhotoUrl(entry);
      if (url && !seen.has(url)) {
        seen.add(url);
        const obj = asObj(entry);
        const caption = asStr(obj.caption || obj.description);
        const roomLabel = asStr(obj.subjectType || obj.roomType || obj.room_label);
        photos.push(caption || roomLabel ? { url, caption, room_label: roomLabel } : { url });
        if (photos.length >= maxPhotos) return photos;
      }
    }
    if (photos.length > 0) break;
  }

  for (const single of [raw.imgSrc, raw.desktopWebHdpImageLink, raw.heroImage, hdpInfo.imgSrc]) {
    const url = extractPhotoUrl(single);
    if (url && !seen.has(url) && photos.length < maxPhotos) {
      seen.add(url);
      photos.push({ url });
    }
  }

  return photos;
}

export function normalizeApifyZillowItem(
  inputRaw: unknown,
  ctx: NormalizeApifyContext = {},
): NormalizeApifyResult {
  if (!inputRaw || typeof inputRaw !== 'object' || Array.isArray(inputRaw)) {
    return { ok: false, reason: 'invalid_item_object' };
  }
  const raw = inputRaw as Record<string, unknown>;
  const hdpData = asObj(raw.hdpData);
  const hdpInfo = asObj(hdpData.homeInfo);
  const addressObj = asObj(raw.address);
  const resoFacts = { ...asObj(hdpInfo.resoFacts), ...asObj(raw.resoFacts) };
  const latLong = { ...asObj(raw.latLong), ...asObj(hdpInfo.latLong) };

  const rawUrl = asStr(raw.detailUrl || raw.url || raw.hdpUrl || hdpInfo.hdpUrl);
  let zpid = asStr(raw.zpid ?? hdpInfo.zpid ?? raw.id);
  if (zpid) {
    const zMatch = zpid.match(/^(\d+)(?:_zpid)?$/i);
    if (zMatch) zpid = zMatch[1];
  }
  if (!zpid && rawUrl) {
    const urlMatch = rawUrl.match(/(\d+)_zpid/i);
    if (urlMatch) zpid = urlMatch[1];
  }
  if (!zpid) {
    return { ok: false, reason: 'missing_zpid' };
  }

  const sourceUrl = sanitizeZillowUrl(rawUrl, zpid);

  // Authentic physical address preservation (Directive 1)
  const streetAddress = asStr(
    addressObj.streetAddress ||
      raw.streetAddress ||
      hdpInfo.streetAddress ||
      (typeof raw.address === 'string' ? raw.address.split(',')[0] : null),
  );
  const city = asStr(addressObj.city || raw.addressCity || raw.city || hdpInfo.city);
  const state = asStr(addressObj.state || raw.addressState || raw.state || hdpInfo.state);
  const zip = asStr(addressObj.zipcode || raw.addressZipcode || raw.zipcode || raw.zip || hdpInfo.zipcode);
  const county = asStr(raw.county || addressObj.county || hdpInfo.county);
  const neighborhood = asStr(
    raw.neighborhoodName || raw.neighborhood || addressObj.neighborhood || resoFacts.subdivision || hdpInfo.neighborhood,
  );
  const unitMatch = streetAddress
    ? streetAddress.match(/(?:,?\s+(?:#|apt\.?|unit|ste\.?|suite)\s*([a-z0-9-]+))$/i)
    : null;
  const unitNumber = asStr(addressObj.unitNumber || raw.unitNumber || resoFacts.unitNumber) ||
    (unitMatch ? unitMatch[1].trim() : null);

  // Fractional bathroom precision (never truncated!)
  const bedrooms = asNum(raw.bedrooms ?? raw.beds ?? hdpInfo.bedrooms);
  const bathrooms = asNum(raw.bathrooms ?? raw.baths ?? hdpInfo.bathrooms);
  const halfBathroomsExplicit = asNum(raw.halfBathrooms ?? resoFacts.bathroomsHalf ?? hdpInfo.bathroomsHalf);
  const halfBathrooms = halfBathroomsExplicit !== null
    ? Math.round(halfBathroomsExplicit)
    : (bathrooms !== null && Math.abs(bathrooms % 1) >= 0.25 ? 1 : null);

  // Asking rent strictly (NEVER rentZestimate)
  const askingRent = parseAskingRent(
    raw.unformattedPrice ??
      hdpInfo.price ??
      raw.price ??
      raw.monthlyRent ??
      raw.rent,
  );

  const propertyType = asStr(raw.homeType || hdpInfo.homeType || raw.propertyType);
  const propertySubtype = asStr(
    resoFacts.propertySubType || raw.homeSubType || hdpInfo.homeSubType || resoFacts.structureType,
  );

  let lotSqft = asNum(raw.lotAreaValue ?? raw.lotSize ?? hdpInfo.lotAreaValue ?? resoFacts.lotSize);
  const lotUnit = String(raw.lotAreaUnit ?? hdpInfo.lotAreaUnit ?? resoFacts.lotAreaUnits ?? '').toLowerCase();
  if (lotSqft !== null && (lotUnit.includes('acre') || /\bac\b/.test(lotUnit))) {
    lotSqft = Math.round(lotSqft * 43560);
  }

  const photos = extractOrderedPhotos(raw, hdpInfo, 50);
  const posterProfile = extractPosterProfileSignal(raw);
  const descriptionText = asStr(raw.description || resoFacts.description || hdpInfo.description);
  const lat = asNum(raw.latitude ?? raw.lat ?? latLong.latitude ?? hdpInfo.latitude);
  const lng = asNum(raw.longitude ?? raw.lng ?? latLong.longitude ?? hdpInfo.longitude);

  const heating = asStrArray(resoFacts.heating);
  const cooling = asStrArray(resoFacts.cooling);
  const laundry = asStrArray(resoFacts.laundryFeatures);
  const appliances = asStrArray(resoFacts.appliances);
  const parking = asStrArray(resoFacts.parkingFeatures);
  const flooring = Array.isArray(resoFacts.flooring)
    ? asStrArray(resoFacts.flooring)
    : asStr(resoFacts.flooring)
    ? [asStr(resoFacts.flooring)!]
    : [];
  const utilitiesIncluded = asStrArray(resoFacts.utilitiesIncluded ?? resoFacts.utilities);
  const amenities = [
    ...asStrArray(raw.tags),
    ...asStrArray(resoFacts.communityFeatures),
    ...asStrArray(resoFacts.interiorFeatures),
    ...asStrArray(resoFacts.exteriorFeatures),
    ...asStrArray(resoFacts.lotFeatures),
    ...asStrArray(resoFacts.poolFeatures),
  ].filter((a) => !/smoke|smoking|tobacco/i.test(a));

  const sourceStatus = asStr(
    raw.homeStatus || hdpInfo.homeStatus || raw.homeStatusType || raw.listingStatus || raw.statusText,
  ) || 'FOR_RENT';

  const nowIso = new Date().toISOString();
  const fieldProvenance: Record<string, unknown> = {
    source: 'zillow',
    provider_key: ctx.providerKey || 'apify',
    import_channel: ctx.channel || 'apify-scrape-worker-v1',
    apify_actor_id: ctx.actorId || null,
    apify_run_id: ctx.runId || null,
    apify_dataset_id: ctx.datasetId || null,
    batch_id: ctx.batchId || null,
    imported_at: nowIso,
    poster_profile: posterProfile,
  };

  const title = streetAddress && city && state
    ? `${streetAddress}, ${city}, ${state}${zip ? ` ${zip}` : ''}`
    : asStr(raw.title) || (streetAddress || `Zillow #${zpid}`);

  const centralAir = resoFacts.hasCooling === false
    ? false
    : cooling.length > 0
    ? cooling.some((c) => c.toLowerCase().includes('central'))
    : null;

  const floorPlans = Array.isArray(raw.floorPlans || raw.buildingFloorPlans || resoFacts.floorPlans)
    ? (raw.floorPlans || raw.buildingFloorPlans || resoFacts.floorPlans) as unknown[]
    : null;

  const pipelineInput: PipelineRecordInput = {
    source: 'zillow',
    source_listing_id: zpid,
    source_url: sourceUrl,
    title,
    address: streetAddress,
    unit_number: unitNumber,
    city,
    state,
    zip,
    county,
    neighborhood,
    lat,
    lng,
    property_type: propertyType,
    property_subtype: propertySubtype,
    bedrooms: bedrooms !== null ? Math.round(bedrooms) : null,
    bathrooms,
    half_bathrooms: halfBathrooms,
    total_bathrooms: bathrooms,
    square_footage: asNum(raw.livingArea ?? raw.livingAreaValue ?? hdpInfo.livingArea ?? resoFacts.livingArea),
    lot_size_sqft: lotSqft,
    year_built: asNum(raw.yearBuilt ?? hdpInfo.yearBuilt ?? resoFacts.yearBuilt),
    floors: asNum(raw.stories ?? resoFacts.stories),
    garage_spaces: asNum(raw.garageParkingCapacity ?? raw.garageSpaces ?? resoFacts.garageSpaces),
    total_units: asNum(raw.unitCount ?? raw.numberOfUnitsTotal ?? hdpInfo.unitCount),
    monthly_rent: askingRent,
    original_monthly_rent: askingRent,
    description: descriptionText,
    original_description: descriptionText,
    parking: parking.join(', ') || asStr(raw.parkingType),
    amenities: JSON.stringify([...new Set(amenities)]),
    appliances: JSON.stringify(appliances),
    utilities_included: JSON.stringify(utilitiesIncluded),
    flooring: flooring.length ? JSON.stringify(flooring) : null,
    heating_type: heating.join(', ') || asStr(resoFacts.heating),
    cooling_type: cooling.join(', ') || asStr(resoFacts.cooling),
    laundry_type: laundry.join(', ') || asStr(resoFacts.laundry),
    has_central_air: centralAir,
    original_image_urls: JSON.stringify(photos),
    agent_name: posterProfile.agent_name,
    broker_name: posterProfile.broker_name,
    listed_at: asStr(raw.datePostedString || raw.datePosted || hdpInfo.datePostedString || resoFacts.listingDate),
    source_last_updated_at: asStr(raw.updatedAt || hdpInfo.datePriceChanged),
    imported_at: nowIso,
    source_status: sourceStatus,
    floor_plans: floorPlans,
    original_data: {
      source: 'zillow',
      zpid,
      detailUrl: sourceUrl,
      homeType: propertyType,
      homeStatus: sourceStatus,
      rentZestimate: hdpInfo.rentZestimate ?? raw.rentZestimate ?? null,
      _import: ctx.channel || 'apify-scrape-worker-v1',
      _imported_at: nowIso,
    },
    source_raw_payload: {
      ...raw,
      _poster_profile: posterProfile,
    },
    field_provenance: fieldProvenance,
    _import: ctx.channel || 'apify-scrape-worker-v1',
  };

  return {
    ok: true,
    zpid,
    source_url: sourceUrl,
    pipelineInput,
    posterProfile,
    rawItem: raw,
  };
}

function slugifyLocationForZillow(location: string): string {
  return location
    .trim()
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function buildApifyActorInput(
  taskConfig: Record<string, unknown>,
  providerConfig: Record<string, unknown> = {},
): Record<string, unknown> {
  const maxItemsRaw = Number(taskConfig.scrape_limit ?? taskConfig.target_qty ?? 25);
  const maxItems = Number.isFinite(maxItemsRaw) ? Math.min(Math.max(Math.round(maxItemsRaw), 1), 200) : 25;

  const validatedUrls: Array<{ url: string }> = [];
  if (Array.isArray(taskConfig.search_urls)) {
    for (const rawUrl of taskConfig.search_urls) {
      if (typeof rawUrl !== 'string') continue;
      try {
        const u = new URL(rawUrl.trim());
        if (u.protocol === 'https:' && ZILLOW_HOSTS.has(u.hostname.toLowerCase()) && !u.username && !u.password) {
          validatedUrls.push({ url: u.toString() });
        }
      } catch {
        // Ignore invalid URLs
      }
    }
  }

  if (validatedUrls.length === 0) {
    const locations = Array.isArray(taskConfig.locations)
      ? taskConfig.locations.map(asStr).filter((x): x is string => Boolean(x))
      : asStr(taskConfig.location)
      ? [asStr(taskConfig.location)!]
      : asStr(taskConfig.target_market)
      ? [asStr(taskConfig.target_market)!]
      : [];

    for (const loc of locations.slice(0, 10)) {
      const slug = slugifyLocationForZillow(loc);
      if (slug) {
        validatedUrls.push({ url: `https://www.zillow.com/${slug}/rentals/` });
      }
    }
  }

  return {
    searchUrls: validatedUrls,
    maxItems,
    extractionMethod: asStr(providerConfig.extractionMethod) || 'PAGINATION_WITH_DETAILS',
    includeHomesForRent: true,
    includeHomesForSale: false,
    ...(typeof taskConfig.min_rent === 'number' ? { minPrice: taskConfig.min_rent } : {}),
    ...(typeof taskConfig.max_rent === 'number' ? { maxPrice: taskConfig.max_rent } : {}),
    ...(typeof taskConfig.min_beds === 'number' ? { minBeds: taskConfig.min_beds } : {}),
    ...(typeof taskConfig.min_baths === 'number' ? { minBaths: taskConfig.min_baths } : {}),
  };
}
