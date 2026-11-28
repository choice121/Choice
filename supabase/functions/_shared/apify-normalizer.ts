// ============================================================================
// Choice Properties — Shared Apify Zillow Normalizer, Filtering & Quota Engine
// ============================================================================
// Losslessly converts raw Apify Zillow scraper/detail JSON items into the
// canonical PipelineRecordInput consumed by _shared/pipeline-record.ts.
// Preserves:
//   - Authentic physical address & rooftop coordinates (Directive 1)
//   - Strict original source photo ordering & HTTPS CDN URLs (Directive 2)
//   - Virtual tour / video staging links (Directive 4: dropped on publish)
//   - Exact fractional bathroom counts (1.5, 2.5, 3.5 — never truncated)
//   - Original asking rent in original_monthly_rent (never rentZestimate)
//   - Structured poster/profile attribution without name-only owner guessing
//   - Task-config filtering, feature scoring & proportional quota selection
// ============================================================================

import {
  isEmpty,
  missingFields,
  qualityScore,
  safeJsonValue,
  type PipelineRecordInput,
} from './pipeline-record.ts';
import {
  STANDARD_UTILITY_KEYS,
  normalizeUtilityMatrix,
  type UtilityMatrix,
} from './utility-matrix.ts';
import {
  DEFAULT_DETAIL_ACTOR_ID,
  DEFAULT_SEARCH_ACTOR_ID,
  buildZillowSearchQueryState,
  extractStage1DetailUrls,
  getApifyActorAdapter,
  resolveActorAdapterSelection,
  resolveExtractionDepth,
  type ExtractionDepth,
  type StageContext,
} from './apify-actor-adapters.ts';
import type {
  Level2CensusSchoolDistrictResult,
  Level2GeoapifyResult,
} from './location-intelligence.ts';

export {
  DEFAULT_DETAIL_ACTOR_ID,
  DEFAULT_SEARCH_ACTOR_ID,
  buildZillowSearchQueryState,
  extractStage1DetailUrls,
  resolveActorAdapterSelection,
  resolveExtractionDepth,
};

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
  extractionDepth?: ExtractionDepth;
  taskConfig?: Record<string, unknown>;
}

export interface RentalEligibilityResult {
  eligible: boolean;
  status: 'rental_only' | 'dual_listed_rental_active' | 'sale_only' | 'off_market' | 'unconfirmed';
  reason: string | null;
  isDualListed: boolean;
  rawHomeStatus: string | null;
  sourceStatus: string;
}

export interface VerifiedAskingRentResult {
  rent: number | null;
  reason: string | null;
  salePriceDetected: number | null;
}

export type NormalizeApifyResult =
  | {
      ok: true;
      zpid: string;
      source_url: string;
      pipelineInput: PipelineRecordInput;
      posterProfile: PosterProfileSignal;
      rentalEligibility: RentalEligibilityResult;
      normalizedAddressKey: string | null;
      rawItem: Record<string, unknown>;
    }
  | {
      ok: false;
      reason: string;
      zpid?: string;
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

const OFF_MARKET_OR_LEASED_STATUSES = new Set([
  'OFF_MARKET',
  'LEASED',
  'RENTED',
  'UNAVAILABLE',
  'CLOSED',
  'EXPIRED',
  'WITHDRAWN',
]);

const SALE_ONLY_STATUS_TOKENS = new Set([
  'FOR_SALE',
  'SOLD',
  'RECENTLY_SOLD',
  'PENDING_SALE',
  'CONTINGENT',
  'AUCTION',
  'FORECLOSURE',
  'FSBO',
  'COMING_SOON',
]);

const STREET_SUFFIX_MAP: Record<string, string> = {
  avenue: 'ave',
  boulevard: 'blvd',
  circle: 'cir',
  court: 'ct',
  drive: 'dr',
  expressway: 'expy',
  highway: 'hwy',
  lane: 'ln',
  parkway: 'pkwy',
  place: 'pl',
  road: 'rd',
  street: 'st',
  terrace: 'ter',
  trail: 'trl',
  way: 'way',
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
  northeast: 'ne',
  northwest: 'nw',
  southeast: 'se',
  southwest: 'sw',
};

export function buildNormalizedAddressKey(
  address: string | null | undefined,
  unitNumber: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined,
): string | null {
  const rawStreet = asStr(address);
  const rawCity = asStr(city);
  const rawState = asStr(state);
  const rawZip = asStr(zip);
  if (!rawStreet || (!rawZip && (!rawCity || !rawState))) return null;

  let extractedUnit = asStr(unitNumber);
  const inlineUnitMatch = rawStreet.match(/(?:,?\s+(?:#|apt\.?|apartment|unit|ste\.?|suite|lot|bldg\.?)\s*([a-z0-9-]+))$/i);
  const streetBase = inlineUnitMatch ? rawStreet.slice(0, inlineUnitMatch.index) : rawStreet;
  if (!extractedUnit && inlineUnitMatch && inlineUnitMatch[1]) {
    extractedUnit = inlineUnitMatch[1];
  }

  const streetTokens = streetBase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => STREET_SUFFIX_MAP[tok] || tok);

  const streetNorm = streetTokens.join(' ');
  if (!streetNorm) return null;

  const unitNorm = extractedUnit
    ? extractedUnit
        .toLowerCase()
        .replace(/^(?:#|apt\.?|apartment|unit|ste\.?|suite|lot)\s*/i, '')
        .replace(/[^a-z0-9-]/g, '')
    : '';

  const cityNorm = (rawCity || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const stateNorm = (rawState || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const zip5 = rawZip ? (rawZip.match(/\d{5}/)?.[0] || rawZip.toLowerCase().replace(/[^a-z0-9]/g, '')) : '';

  return `${streetNorm}|${unitNorm}|${cityNorm}|${stateNorm}|${zip5}`;
}

export function classifyRentalEligibility(
  raw: Record<string, unknown>,
  hdpInfo: Record<string, unknown> = {},
): RentalEligibilityResult {
  const rawStatus = asStr(
    raw.homeStatus ||
      hdpInfo.homeStatus ||
      raw.homeStatusType ||
      raw.listingStatus ||
      raw.status,
  );
  const statusCompact = rawStatus ? rawStatus.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  const statusNorm =
    statusCompact === 'FORRENT' ? 'FOR_RENT'
    : statusCompact === 'FORRENTBYOWNER' ? 'FOR_RENT_BY_OWNER'
    : statusCompact === 'FORSALE' ? 'FOR_SALE'
    : statusCompact === 'RECENTLYSOLD' ? 'RECENTLY_SOLD'
    : statusCompact === 'PENDINGSALE' ? 'PENDING_SALE'
    : statusCompact === 'OFFMARKET' ? 'OFF_MARKET'
    : statusCompact === 'COMINGSOON' ? 'COMING_SOON'
    : rawStatus ? rawStatus.toUpperCase().replace(/[\s-]+/g, '_') : '';
  const statusText = (asStr(raw.statusText || raw.homeStatusText) || '').toLowerCase();
  const listingTypeObj = asObj(raw.listingType);
  const listingTypeNorm = (asStr(typeof raw.listingType === 'object' ? raw.operation : (raw.listingType || raw.operation)) || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  const detailUrl = (asStr(raw.detailUrl || raw.propertyUrl || raw.url || raw.hdpUrl || hdpInfo.hdpUrl) || '').toLowerCase();
  const rentalListing = asObj(raw.rentalListing);
  const rentalInfo = asObj(raw.rentalInfo);
  const listingSubType = {
    ...asObj(raw.listingSubType),
    ...asObj(hdpInfo.listingSubType),
  };

  if (OFF_MARKET_OR_LEASED_STATUSES.has(statusNorm)) {
    return {
      eligible: false,
      status: 'off_market',
      reason: 'sale_only_excluded',
      isDualListed: false,
      rawHomeStatus: rawStatus,
      sourceStatus: statusNorm,
    };
  }

  const hasExplicitRentalListing =
    (Object.keys(rentalListing).length > 0 &&
      rentalListing.isActive !== false &&
      (rentalListing.monthlyRent !== undefined || rentalListing.price !== undefined || rentalListing.rent !== undefined)) ||
    (Object.keys(rentalInfo).length > 0 &&
      rentalInfo.isActive !== false &&
      (rentalInfo.monthlyRent !== undefined || rentalInfo.price !== undefined || rentalInfo.rent !== undefined));

  const hasExplicitRentalOffering = Boolean(
    statusNorm === 'FOR_RENT' ||
      statusNorm === 'RENTAL' ||
      statusNorm === 'FOR_RENT_BY_OWNER' ||
      listingTypeNorm === 'FOR_RENT' ||
      listingTypeNorm === 'RENTAL' ||
      listingTypeNorm === 'RENT' ||
      /\bfor\s+rent\b/i.test(statusText) ||
      raw.isForRent === true ||
      hdpInfo.isForRent === true ||
      raw.isForRentByOwner === true ||
      raw.is_FRBO === true ||
      listingTypeObj.isForRentByOwner === true ||
      listingTypeObj.isFRBO === true ||
      listingSubType.is_for_rent_by_owner === true ||
      asStr(raw.rentalStatus)?.toUpperCase() === 'ACTIVE' ||
      asStr(raw.rentalStatus)?.toUpperCase() === 'FOR_RENT' ||
      hasExplicitRentalListing ||
      detailUrl.includes('/rentals/'),
  );

  const salePriceCandidate = asNum(raw.salePrice ?? raw.purchasePrice ?? hdpInfo.salePrice ?? asObj(raw.saleListing).price);
  const hasExplicitSaleSignal = Boolean(
    (statusNorm && SALE_ONLY_STATUS_TOKENS.has(statusNorm)) ||
      raw.isForSale === true ||
      hdpInfo.isForSale === true ||
      raw.isDualListed === true ||
      listingTypeObj.isFSBA === true ||
      listingTypeObj.isFSBO === true ||
      listingSubType.is_FSBA === true ||
      (salePriceCandidate !== null && salePriceCandidate >= 25000),
  );

  // Permanently closed / sold / foreclosure / auction statuses never qualify even if stale rental hints exist
  const strictlyNonActiveSaleStatuses = new Set([
    'SOLD',
    'RECENTLY_SOLD',
    'PENDING_SALE',
    'CONTINGENT',
    'AUCTION',
    'FORECLOSURE',
    'COMING_SOON',
  ]);
  if (strictlyNonActiveSaleStatuses.has(statusNorm)) {
    return {
      eligible: false,
      status: 'sale_only',
      reason: 'sale_only_excluded',
      isDualListed: false,
      rawHomeStatus: rawStatus,
      sourceStatus: statusNorm,
    };
  }

  if (statusNorm === 'FOR_SALE' || statusNorm === 'FSBO') {
    const dualActiveRental = Boolean(
      raw.isForRent === true ||
        hdpInfo.isForRent === true ||
        asStr(raw.rentalStatus)?.toUpperCase() === 'ACTIVE' ||
        asStr(raw.rentalStatus)?.toUpperCase() === 'FOR_RENT' ||
        hasExplicitRentalListing ||
        asNum(raw.monthlyRent ?? raw.rentalPrice ?? hdpInfo.monthlyRent) !== null,
    );

    if (!dualActiveRental) {
      return {
        eligible: false,
        status: 'sale_only',
        reason: 'sale_only_excluded',
        isDualListed: false,
        rawHomeStatus: rawStatus,
        sourceStatus: statusNorm,
      };
    }

    return {
      eligible: true,
      status: 'dual_listed_rental_active',
      reason: null,
      isDualListed: true,
      rawHomeStatus: rawStatus,
      sourceStatus: 'FOR_RENT',
    };
  }

  if (hasExplicitRentalOffering) {
    if (hasExplicitSaleSignal) {
      return {
        eligible: true,
        status: 'dual_listed_rental_active',
        reason: null,
        isDualListed: true,
        rawHomeStatus: rawStatus,
        sourceStatus: 'FOR_RENT',
      };
    }

    return {
      eligible: true,
      status: 'rental_only',
      reason: null,
      isDualListed: false,
      rawHomeStatus: rawStatus,
      sourceStatus: rawStatus || 'FOR_RENT',
    };
  }

  return {
    eligible: false,
    status: 'unconfirmed',
    reason: 'unconfirmed_rental_status',
    isDualListed: false,
    rawHomeStatus: rawStatus,
    sourceStatus: rawStatus || 'UNCONFIRMED',
  };
}

export function parseVerifiedAskingRent(
  raw: Record<string, unknown>,
  hdpInfo: Record<string, unknown> = {},
  isDualListed = false,
): VerifiedAskingRentResult {
  const rentalListing = asObj(raw.rentalListing);
  const rentalInfo = asObj(raw.rentalInfo);
  const saleListing = asObj(raw.saleListing);

  const explicitSalePrice = asNum(
    raw.salePrice ??
      raw.purchasePrice ??
      raw.listPrice ??
      hdpInfo.salePrice ??
      saleListing.price,
  );

  const priceRangeObj = asObj(raw.priceRange ?? rentalListing.priceRange ?? rentalInfo.priceRange ?? hdpInfo.priceRange);
  const rangeMin = priceRangeObj.min ?? priceRangeObj.minPrice ?? priceRangeObj.low;

  // Explicit dedicated rental offering price fields (strictly excluding rentZestimate/zestimate)
  const dedicatedRentCandidates: unknown[] = [
    raw.monthlyRent,
    raw.rentalPrice,
    raw.rent,
    hdpInfo.monthlyRent,
    hdpInfo.rentalPrice,
    rentalListing.monthlyRent,
    rentalListing.price,
    rentalListing.rent,
    rentalInfo.monthlyRent,
    rentalInfo.price,
    rentalInfo.rent,
    raw.leasePrice,
    rangeMin,
    raw.minPrice,
    raw.minRent,
    rentalListing.minPrice,
    rentalListing.minRent,
    rentalInfo.minPrice,
    rentalInfo.minRent,
    hdpInfo.minPrice,
    hdpInfo.minRent,
  ];

  let resolvedRent: number | null = null;
  for (const cand of dedicatedRentCandidates) {
    const parsed = parseAskingRent(cand);
    if (parsed !== null) {
      resolvedRent = parsed;
      break;
    }
  }

  const listingPriceObj = asObj(raw.listingPrice);
  const generalPrice = parseAskingRent(raw.unformattedPrice ?? listingPriceObj.amount ?? hdpInfo.price ?? raw.price);
  let inferredSalePrice = explicitSalePrice;

  if (resolvedRent === null) {
    if (isDualListed) {
      // On dual-listed listings without a dedicated rental field, only accept generalPrice
      // if an explicit separate salePrice already exists AND generalPrice is strictly below sale-price thresholds.
      if (
        generalPrice !== null &&
        inferredSalePrice !== null &&
        generalPrice < 50000 &&
        generalPrice !== inferredSalePrice &&
        generalPrice < inferredSalePrice * 0.05
      ) {
        resolvedRent = generalPrice;
      } else if (generalPrice !== null && generalPrice >= 50000) {
        inferredSalePrice = inferredSalePrice ?? generalPrice;
        return {
          rent: null,
          reason: 'invalid_sale_price_as_rent',
          salePriceDetected: inferredSalePrice,
        };
      } else {
        return {
          rent: null,
          reason: 'missing_verified_asking_rent',
          salePriceDetected: inferredSalePrice,
        };
      }
    } else if (generalPrice !== null) {
      resolvedRent = generalPrice;
    }
  }

  if (resolvedRent === null || resolvedRent <= 0) {
    return {
      rent: null,
      reason: 'missing_verified_asking_rent',
      salePriceDetected: inferredSalePrice,
    };
  }

  if (resolvedRent >= 50000) {
    return {
      rent: null,
      reason: 'invalid_sale_price_as_rent',
      salePriceDetected: inferredSalePrice ?? resolvedRent,
    };
  }

  if (
    inferredSalePrice !== null &&
    inferredSalePrice > 0 &&
    (resolvedRent === inferredSalePrice || resolvedRent >= inferredSalePrice * 0.05)
  ) {
    return {
      rent: null,
      reason: 'invalid_sale_price_as_rent',
      salePriceDetected: inferredSalePrice,
    };
  }

  return {
    rent: resolvedRent,
    reason: null,
    salePriceDetected: inferredSalePrice,
  };
}

function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(asStr).filter((x): x is string => Boolean(x));
}

function sanitizeSafeHttpsUrl(raw: unknown): string | null {
  const s = asStr(raw);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' && !u.username && !u.password) {
      return u.toString();
    }
  } catch {
    // ignore malformed URLs
  }
  return null;
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
  const listingTypeObj = asObj(raw.listingType);
  const agentObj = asObj(raw.agent);
  const brokerObj = asObj(raw.broker);
  const firstListingAgent = Array.isArray(attribution.listingAgents) ? asObj(attribution.listingAgents[0]) : {};
  const firstListingOffice = Array.isArray(attribution.listingOffices) ? asObj(attribution.listingOffices[0]) : {};

  const agentName = asStr(
    attribution.agentName ||
      raw.agentName ||
      raw.listedByName ||
      attribution.listingAgentName ||
      agentObj.name ||
      firstListingAgent.memberFullName,
  );
  const brokerName = asStr(
    attribution.brokerName ||
      raw.brokerName ||
      raw.brokerageName ||
      attribution.brokerageName ||
      raw.managementCompanyName ||
      raw.propertyManagerName ||
      brokerObj.name ||
      firstListingOffice.officeName,
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
    listingTypeObj.isForRentByOwner === true ||
    listingTypeObj.isFRBO === true ||
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

function isSmallZillowThumbnail(url: string): boolean {
  return /(?:^|\/|[-_])(?:p_[a-e]|s|t|m|cc_ft_(?:192|384|576|768))\.(?:jpe?g|webp|png)(?:[?#]|$)/i.test(url);
}

function isFullZillowHighRes(url: string): boolean {
  return /(?:uncropped_scaled_within|cc_ft_1536|p_f|p_h)/i.test(url);
}

function parseMaybePhotoArray(col: unknown): unknown[] | null {
  if (Array.isArray(col)) return col;
  if (typeof col === 'string') {
    const trimmed = col.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function extractPhotoUrl(item: unknown): string | null {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    return trimmed.startsWith('https://') ? trimmed : null;
  }
  const obj = asObj(item);
  const direct = asStr(obj.url || obj.href || obj.src || obj.hiRes || obj.largeUrl);
  const directSafe = direct && direct.startsWith('https://') ? direct : null;
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
  if (bestUrl) {
    if (
      directSafe &&
      !isSmallZillowThumbnail(directSafe) &&
      (bestWidth < 768 || (isFullZillowHighRes(directSafe) && bestWidth < 1536))
    ) {
      return directSafe;
    }
    return bestUrl;
  }
  return directSafe;
}

export function extractOrderedPhotos(
  raw: Record<string, unknown>,
  hdpInfo: Record<string, unknown>,
  maxPhotos = 500,
): Array<{ url: string; caption?: string | null; room_label?: string | null }> {
  const actorDetails = asObj(raw._details);
  const detailsBlock = asObj(raw.details);

  const candidateCollections: Array<{ priority: number; items: unknown[] | null }> = [
    { priority: 100, items: parseMaybePhotoArray(raw.responsivePhotosOriginalRatio) },
    { priority: 95, items: parseMaybePhotoArray(actorDetails.responsivePhotosOriginalRatio) },
    { priority: 94, items: parseMaybePhotoArray(detailsBlock.responsivePhotosOriginalRatio) },
    { priority: 92, items: parseMaybePhotoArray(hdpInfo.responsivePhotosOriginalRatio) },
    { priority: 90, items: parseMaybePhotoArray(raw.responsivePhotos) },
    { priority: 88, items: parseMaybePhotoArray(actorDetails.responsivePhotos) },
    { priority: 87, items: parseMaybePhotoArray(detailsBlock.responsivePhotos) },
    { priority: 85, items: parseMaybePhotoArray(raw.originalPhotos) },
    { priority: 82, items: parseMaybePhotoArray(raw.hugePhotos) },
    { priority: 80, items: parseMaybePhotoArray(actorDetails.hugePhotos) },
    { priority: 78, items: parseMaybePhotoArray(raw.largePhotos) },
    { priority: 75, items: parseMaybePhotoArray(raw.listingPhotos) },
    { priority: 70, items: parseMaybePhotoArray(raw.photos) },
    { priority: 68, items: parseMaybePhotoArray(actorDetails.photos) },
    { priority: 67, items: parseMaybePhotoArray(detailsBlock.photos) },
    { priority: 65, items: parseMaybePhotoArray(raw.carouselPhotos) },
    { priority: 60, items: parseMaybePhotoArray(hdpInfo.photos) },
  ];

  type ExtractedGallery = {
    priority: number;
    photos: Array<{ url: string; caption?: string | null; room_label?: string | null }>;
    thumbCount: number;
  };
  let bestGallery: ExtractedGallery | null = null;

  for (const col of candidateCollections) {
    if (!col.items || col.items.length === 0) continue;
    const gallery: Array<{ url: string; caption?: string | null; room_label?: string | null }> = [];
    const seen = new Set<string>();
    let thumbCount = 0;

    for (const entry of col.items) {
      const url = extractPhotoUrl(entry);
      if (url && !seen.has(url)) {
        seen.add(url);
        if (isSmallZillowThumbnail(url)) thumbCount++;
        const obj = asObj(entry);
        const caption = asStr(obj.caption || obj.description);
        const roomLabel = asStr(obj.subjectType || obj.roomType || obj.room_label);
        gallery.push(caption || roomLabel ? { url, caption, room_label: roomLabel } : { url });
        if (gallery.length >= maxPhotos) break;
      }
    }

    if (gallery.length === 0) continue;

    if (!bestGallery) {
      bestGallery = { priority: col.priority, photos: gallery, thumbCount };
      continue;
    }

    if (gallery.length > bestGallery.photos.length) {
      bestGallery = { priority: col.priority, photos: gallery, thumbCount };
    } else if (gallery.length === bestGallery.photos.length) {
      const currNonThumb = gallery.length - thumbCount;
      const bestNonThumb = bestGallery.photos.length - bestGallery.thumbCount;
      if (currNonThumb > bestNonThumb || (currNonThumb === bestNonThumb && col.priority > bestGallery.priority)) {
        bestGallery = { priority: col.priority, photos: gallery, thumbCount };
      }
    }
  }

  const photos = bestGallery ? [...bestGallery.photos] : [];
  const hasGalleryArray = photos.length > 0;
  const seenFinal = new Set(photos.map((p) => p.url));

  if (!hasGalleryArray) {
    const mainImgObj = asObj(raw.mainImage);
    for (const single of [
      mainImgObj.hiRes,
      mainImgObj.medium,
      raw.imgSrc,
      raw.desktopWebHdpImageLink,
      raw.heroImage,
      hdpInfo.imgSrc,
    ]) {
      const url = extractPhotoUrl(single);
      if (url && !seenFinal.has(url) && photos.length < maxPhotos) {
        seenFinal.add(url);
        photos.push({ url });
      }
    }
  }

  return photos;
}

export function extractVirtualTourAndVideos(
  raw: Record<string, unknown>,
  hdpInfo: Record<string, unknown>,
  resoFacts: Record<string, unknown>,
): {
  virtual_tour_url: string | null;
  videos: Array<{ url: string; title: string; type: string }> | null;
} {
  const tourCandidates = [
    raw.virtualTourUrl,
    raw.threeDimensionalTourUrl,
    raw.tour3d,
    raw.view3dUrl,
    hdpInfo.virtualTourUrl,
    hdpInfo.threeDimensionalTourUrl,
    resoFacts.virtualTourUrl,
    resoFacts.threeDimensionalTourUrl,
  ];

  let virtualTourUrl: string | null = null;
  for (const c of tourCandidates) {
    const clean = sanitizeSafeHttpsUrl(c);
    if (clean) {
      virtualTourUrl = clean;
      break;
    }
  }

  const videos: Array<{ url: string; title: string; type: string }> = [];
  const seen = new Set<string>();
  const addVideo = (u: string | null, title: string, type: string) => {
    if (!u || seen.has(u)) return;
    seen.add(u);
    videos.push({ url: u, title, type });
  };

  if (virtualTourUrl) {
    addVideo(virtualTourUrl, '3D / Virtual Tour', 'virtual_tour');
  }

  const rawVideos = [
    ...(Array.isArray(raw.videos) ? raw.videos : []),
    ...(Array.isArray(hdpInfo.videos) ? hdpInfo.videos : []),
  ];
  for (const entry of rawVideos) {
    if (typeof entry === 'string') {
      addVideo(sanitizeSafeHttpsUrl(entry), 'Property Walkthrough Video', 'video');
    } else if (entry && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const u = sanitizeSafeHttpsUrl(obj.url || obj.videoUrl || obj.src || obj.href);
      const title = asStr(obj.title || obj.caption) || 'Property Walkthrough Video';
      const type = asStr(obj.type) || 'video';
      addVideo(u, title, type);
    }
  }

  return {
    virtual_tour_url: virtualTourUrl,
    videos: videos.length > 0 ? videos : null,
  };
}

export type FactLedgerState = 'confirmed_present' | 'confirmed_absent' | 'not_applicable' | 'unspecified';

export interface FactLedgerEntry {
  state: FactLedgerState;
  value?: unknown;
  source_key?: string;
}

export interface ExtractionConflictEntry {
  field: string;
  structured_value: unknown;
  narrative_claim: string;
  severity: 'warning' | 'info';
  message: string;
}

function parseFlexStringArray(v: unknown): string[] {
  if (v === null || v === undefined || typeof v === 'boolean') return [];
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === 'string' || typeof item === 'number') {
        const s = String(item).trim();
        if (s) out.push(s);
      } else if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const label = asStr(o.name || o.label || o.value || o.factValue || o.factLabel);
        if (label) out.push(label);
      }
    }
    return out;
  }
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return [];
    return trimmed
      .split(/[,;|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function uniqStrList(lists: Array<string[] | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const clean = asStr(item);
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(clean);
      }
    }
  }
  return out;
}

export interface PropertyInsightsResult {
  depth: ExtractionDepth;
  walk_score: number | null;
  transit_score: number | null;
  bike_score: number | null;
  walk_description: string | null;
  transit_description: string | null;
  bike_description: string | null;
  location_context: string | null;
  insights_payload: Record<string, unknown>;
}

function parseLivabilityScore(v: unknown): number | null {
  if (v === null || v === undefined || typeof v === 'boolean') return null;
  const obj = typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const rawScore = obj ? (obj.walkscore ?? obj.transitscore ?? obj.bikescore ?? obj.score) : v;
  const n = asNum(rawScore);
  if (n === null) return null;
  const rounded = Math.round(n);
  return rounded >= 0 && rounded <= 100 ? rounded : null;
}

function parseScoreDescription(v: unknown, fallbackStr?: unknown): string | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const d = asStr((v as Record<string, unknown>).description);
    if (d) return d;
  }
  return asStr(fallbackStr);
}

/**
 * Phase 4: Two-Level Property Insights Extractor (strictly gated by Level 2 toggle).
 * - Level 1 ('full_data', default): ALWAYS returns null, discarding unsolicited walk/transit/bike scores.
 * - Level 2 ('with_insights', opt-in): Extracts Walk/Transit/Bike scores & concise location_context,
 *   while NEVER admitting zestimate, rentZestimate, rent benchmarks, or date histories.
 */
export function extractPropertyInsights(
  sources: {
    raw: Record<string, unknown>;
    hdpInfo?: Record<string, unknown>;
    actorDetails?: Record<string, unknown>;
    detailsBlock?: Record<string, unknown>;
  },
  enabled: boolean,
): PropertyInsightsResult | null {
  if (!enabled) return null;

  const { raw, hdpInfo = {}, actorDetails = {}, detailsBlock = {} } = sources;
  const rawInsights = asObj(raw.insights);
  const detailsInsights = asObj(detailsBlock.insights);
  const actorInsights = asObj(actorDetails.insights);

  const walkSource =
    raw.walkScore ??
    raw.walk_score ??
    raw.walkabilityScore ??
    rawInsights.walkScore ??
    actorDetails.walkScore ??
    actorInsights.walkScore ??
    detailsBlock.walkScore ??
    detailsInsights.walkScore ??
    hdpInfo.walkScore;
  const transitSource =
    raw.transitScore ??
    raw.transit_score ??
    rawInsights.transitScore ??
    actorDetails.transitScore ??
    actorInsights.transitScore ??
    detailsBlock.transitScore ??
    detailsInsights.transitScore ??
    hdpInfo.transitScore;
  const bikeSource =
    raw.bikeScore ??
    raw.bike_score ??
    rawInsights.bikeScore ??
    actorDetails.bikeScore ??
    actorInsights.bikeScore ??
    detailsBlock.bikeScore ??
    detailsInsights.bikeScore ??
    hdpInfo.bikeScore;

  const walkScore = parseLivabilityScore(walkSource);
  const transitScore = parseLivabilityScore(transitSource);
  const bikeScore = parseLivabilityScore(bikeSource);

  const walkDesc = parseScoreDescription(walkSource, raw.walkScoreDescription ?? rawInsights.walkDescription);
  const transitDesc = parseScoreDescription(transitSource, raw.transitScoreDescription ?? rawInsights.transitDescription);
  const bikeDesc = parseScoreDescription(bikeSource, raw.bikeScoreDescription ?? rawInsights.bikeDescription);

  const ctxParts: string[] = [];
  if (walkScore !== null) ctxParts.push(`Walk score: ${walkScore}`);
  if (transitScore !== null) ctxParts.push(`Transit score: ${transitScore}`);
  if (bikeScore !== null) ctxParts.push(`Bike score: ${bikeScore}`);

  const locationContext = ctxParts.length > 0 ? ctxParts.join('; ') : null;

  const insightsPayload: Record<string, unknown> = {
    depth: 'with_insights',
    source: 'apify_listing',
    ...(walkScore !== null ? { walk_score: walkScore } : {}),
    ...(transitScore !== null ? { transit_score: transitScore } : {}),
    ...(bikeScore !== null ? { bike_score: bikeScore } : {}),
    ...(walkDesc ? { walk_description: walkDesc } : {}),
    ...(transitDesc ? { transit_description: transitDesc } : {}),
    ...(bikeDesc ? { bike_description: bikeDesc } : {}),
  };

  return {
    depth: 'with_insights',
    walk_score: walkScore,
    transit_score: transitScore,
    bike_score: bikeScore,
    walk_description: walkDesc,
    transit_description: transitDesc,
    bike_description: bikeDesc,
    location_context: locationContext,
    insights_payload: insightsPayload,
  };
}

/**
 * Merges optional Level-2 external insights (Geoapify categorized nearby amenities +
 * Census TIGERweb district context) into a normalized PipelineRecordInput without mutating
 * core Level-1 facts or admitting Zestimates / dates / rent benchmarks.
 */
export function mergeLevel2LocationEnrichment(
  pipelineInput: PipelineRecordInput,
  geoapifyRes: Level2GeoapifyResult | null | undefined,
  censusRes: Level2CensusSchoolDistrictResult | null | undefined,
  extractionDepth: ExtractionDepth,
): PipelineRecordInput {
  if (extractionDepth !== 'with_insights') return pipelineInput;

  const existingLocDetails =
    pipelineInput.location_details &&
    typeof pipelineInput.location_details === 'object' &&
    !Array.isArray(pipelineInput.location_details)
      ? ({ ...pipelineInput.location_details } as Record<string, unknown>)
      : {};

  if (!pipelineInput.county && geoapifyRes?.reverse?.county) {
    pipelineInput.county = geoapifyRes.reverse.county;
    if (!existingLocDetails.county) existingLocDetails.county = geoapifyRes.reverse.county;
  }
  if (!pipelineInput.neighborhood && geoapifyRes?.reverse?.neighborhood) {
    pipelineInput.neighborhood = geoapifyRes.reverse.neighborhood;
    if (!existingLocDetails.neighborhood) existingLocDetails.neighborhood = geoapifyRes.reverse.neighborhood;
  }

  const prevInsights =
    existingLocDetails.insights &&
    typeof existingLocDetails.insights === 'object' &&
    !Array.isArray(existingLocDetails.insights)
      ? ({ ...(existingLocDetails.insights as Record<string, unknown>) })
      : { depth: 'with_insights' };

  if (geoapifyRes) {
    prevInsights.geoapify_status = geoapifyRes.status;
    if (geoapifyRes.summary) {
      prevInsights.nearby_counts = geoapifyRes.summary.counts;
      prevInsights.nearest_by_category = geoapifyRes.summary.nearest_by_category;
      prevInsights.nearby_highlights = geoapifyRes.summary.nearby_highlights;
      prevInsights.total_nearby_places = geoapifyRes.summary.total_places;
    } else if (geoapifyRes.error) {
      prevInsights.geoapify_error = geoapifyRes.error;
    }
  }

  if (censusRes) {
    prevInsights.census_district_status = censusRes.status;
    if (censusRes.ok && censusRes.primary_district) {
      prevInsights.census_school_district = {
        primary_district: censusRes.primary_district,
        unified_district: censusRes.unified_district,
        elementary_district: censusRes.elementary_district,
        secondary_district: censusRes.secondary_district,
      };
    } else if (censusRes.error) {
      prevInsights.census_district_error = censusRes.error;
    }
  }

  existingLocDetails.insights = prevInsights;
  pipelineInput.location_details = existingLocDetails;

  // Build non-dated, Zestimate-free concise summary suffix on location_context
  const nearestParts: string[] = [];
  const nearestMap = geoapifyRes?.summary?.nearest_by_category;
  if (nearestMap) {
    for (const [cat, info] of Object.entries(nearestMap)) {
      if (info && info.name) {
        nearestParts.push(`${cat}: ${info.name} (${info.distance_m}m)`);
      }
      if (nearestParts.length >= 3) break;
    }
  }
  if (nearestParts.length > 0) {
    const baseCtx = pipelineInput.location_context ? `${pipelineInput.location_context}; ` : '';
    const nearbyNote = `Nearby amenities: ${nearestParts.join(', ')}`;
    if (!baseCtx.includes('Nearby amenities:')) {
      pipelineInput.location_context = `${baseCtx}${nearbyNote}`.slice(0, 500);
    }
  }

  return pipelineInput;
}

function parseYesNoBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 0 ? false : v > 0 ? true : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (/^(?:yes|true|y|1|included|available|present)$/.test(s)) return true;
  if (/^(?:no|false|n|0|none|not\s+included|not\s+available|absent)$/.test(s)) return false;
  return null;
}

function isExplicitNoneArray(arr: string[]): boolean {
  if (arr.length === 0) return false;
  return arr.every((s) => /^(?:none|no|false|n\/a|na|not\s+applicable)$/i.test(s.trim()));
}

const EXCLUDED_SCOPE_KEY_RE = new RegExp(
  [
    '(?:^|_)(?:date|timestamp|createdat|updatedat|listedat|scrapedat|publishedat)(?:$|_)',
    '(?:dateposted|datesold|lastsolddate|datepricechanged|listingdate|onmarketdate|availabilitydate|dateavailable|availablefrom)',
    '(?:^|_)(?:daysonzillow|timeonzillow|daysonmarket|dom)(?:$|_)',
    '(?:zestimate|rentzestimate|monthlypaymentestimate|rentbenchmark|rentcomp|comps$|comparableproperties|nearbysoldhomes)',
    '(?:taxannual|taxassessed|taxvalue|taxhistory|propertytaxrate|pricehistory)',
    '(?:parcel|apn$|floodzone|floodfactor|femazone|assessor)',
    '(?:photos?|responsivephotos|listingphotos|hugephotos|largephotos|carouselphotos|imgsrc|heroimage|mainimage|photocount|imagecount)',
    '(?:virtualtour|threedimensionaltour|tour3d|view3d|videos?|has3dmodel)',
    '(?:floorplans|buildingfloorplans|complexunits|buildingunits|floorlevel|floornumber|floorsbreakdown)',
    '(?:walkscore|transitscore|bikescore|nearbyhomes|nearbyproperties|listingmortgagerates|staticmapurl|grossrentalyield|caprate|insights$|pageviewcount|favoritecount)',
  ].join('|'),
  'i',
);

export function isExcludedScopeKey(rawKey: string): boolean {
  const key = rawKey.trim();
  if (!key) return true;
  if (key.startsWith('_') && key !== '_details') return true;
  return EXCLUDED_SCOPE_KEY_RE.test(key);
}

function scrubExcludedKeysDeep(val: unknown, depth = 0): unknown {
  if (depth > 6) return null;
  if (val === null || val === undefined) return null;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) {
    const cleaned = val
      .map((item) => scrubExcludedKeysDeep(item, depth + 1))
      .filter((item) => item !== null && item !== undefined && item !== '');
    return cleaned.length > 0 ? cleaned : null;
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (isExcludedScopeKey(k)) continue;
      if (/smoke|smoking|tobacco|pet|pets|lease|deposit/i.test(k)) continue;
      const scrubbed = scrubExcludedKeysDeep(v, depth + 1);
      if (scrubbed !== null && scrubbed !== undefined && scrubbed !== '') {
        out[k] = scrubbed;
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  }
  return null;
}

const KNOWN_MAPPED_SOURCE_KEYS = new Set(
  [
    // Identity / status / pricing / address handled in flat columns & classifier
    'zpid', 'id', 'detailUrl', 'propertyUrl', 'addressOrUrlFromInput', 'sourceSearchUrl', 'url', 'hdpUrl', 'title',
    'homeStatus', 'homeStatusType', 'listingStatus', 'status', 'statusText', 'homeStatusText', 'listingType', 'operation',
    'isForRent', 'isForSale', 'isForRentByOwner', 'is_FRBO', 'isDualListed', 'rentalStatus', 'isValid',
    'rentalListing', 'rentalInfo', 'saleListing', 'listingSubType', 'price', 'unformattedPrice', 'listingPrice',
    'monthlyRent', 'rentalPrice', 'rent', 'leasePrice', 'salePrice', 'purchasePrice', 'listPrice',
    'address', 'listingAddress', 'streetAddress', 'city', 'addressCity', 'state', 'addressState', 'zipcode',
    'addressZipcode', 'zip', 'unitNumber', 'county', 'neighborhood', 'neighborhoodName',
    'subdivision', 'latitude', 'lat', 'longitude', 'lng', 'latLong', 'coordinates', 'description',
    // Specs & architecture
    'bedrooms', 'beds', 'bathrooms', 'baths', 'bathroomsDetail', 'halfBathrooms', 'bathroomsHalf', 'bathroomsFull',
    'homeType', 'propertyType', 'homeSubType', 'propertySubType', 'structureType',
    'livingArea', 'livingAreaValue', 'sqft', 'lotArea', 'lotAreaValue', 'lotSize', 'lotAreaUnit', 'lotAreaUnits',
    'yearBuilt', 'stories', 'levels', 'garageParkingCapacity', 'garageSpaces', 'hasGarage',
    'carportSpaces', 'coveredSpaces', 'openParkingSpaces', 'hasOpenParking', 'unitCount',
    'numberOfUnitsTotal', 'architecturalStyle', 'constructionMaterials', 'foundationDetails',
    'roof', 'roofType', 'exteriorFeatures', 'interiorFeatures', 'fencing',
    'patioAndPorchFeatures', 'fireplaceFeatures', 'hasFireplace', 'fireplaces', 'poolFeatures',
    'hasPool', 'spaFeatures', 'windowFeatures', 'doorFeatures', 'accessibilityFeatures',
    'securityFeatures', 'parkingFeatures', 'parkingType', 'parking', 'otherStructures',
    'lotFeatures', 'lotSizeDimensions', 'hasBasement', 'basement', 'rooms', 'roomTypes',
    'atAGlanceFacts',
    // Appliances, flooring, HVAC, laundry, utilities, EV
    'appliances', 'flooring', 'laundryFeatures', 'laundry', 'hasLaundry', 'heating', 'hasHeating',
    'cooling', 'hasCooling', 'utilitiesIncluded', 'utilities', 'electric', 'gas', 'waterSource',
    'sewer', 'trash', 'recycling', 'internet', 'cable', 'greenEnergyEfficient',
    'electricVehicleCharging', 'evCharger', 'evCharging',
    // Amenities, community, schools, HOA/fees
    'tags', 'communityFeatures', 'schools', 'nearbySchools', 'assignedSchools', 'schoolDistrict', 'schoolDistricts',
    'elementarySchoolDistrict', 'middleOrJuniorSchoolDistrict', 'highSchoolDistrict',
    'monthlyHoaFee', 'hoaFee', 'associationFee', 'hoaFeeFrequency', 'associationFeeFrequency',
    'associationFeeIncludes', 'hasAssociation', 'hoa', 'parkingFee', 'adminFee', 'applicationFee',
    'applicationFeeAmount', 'concessions', 'securityDeposit', 'petsAllowed', 'leaseTerms',
    'smokingAllowed', 'agent', 'broker', 'agentName', 'listedByName', 'brokerName', 'brokerageName',
    'attributionInfo', 'agentPhoneNumber', 'brokerPhoneNumber', 'mls',
    // Sub-containers walked individually
    'hdpData', 'homeInfo', 'resoFacts', '_details', 'details', 'propertyFeatures', 'facts',
  ].map((k) => k.toLowerCase()),
);

function canonicalizeAppliancesList(
  rawList: string[],
  description: string,
): { appliances: string[]; explicitNone: boolean } {
  if (isExplicitNoneArray(rawList)) {
    return { appliances: [], explicitNone: true };
  }
  const canonicalMap: Array<[RegExp, string]> = [
    [/\bdish\s*washer\b/i, 'Dishwasher'],
    [/\b(?:refrigerator|fridge)\b/i, 'Refrigerator'],
    [/\bgas\s*(?:range|stove|oven)\b/i, 'Gas Range'],
    [/\belectric\s*(?:range|stove)\b/i, 'Electric Range'],
    [/\b(?:range\s*\/?\s*oven|range|stove|cooktop)\b/i, 'Range / Oven'],
    [/\bmicrowave\b/i, 'Microwave'],
    [/\b(?:garbage\s*)?disposal\b/i, 'Garbage Disposal'],
    [/\bfreezer\b/i, 'Freezer'],
    [/\bwine\s*cooler\b/i, 'Wine Cooler'],
    [/\bwater\s*softener\b/i, 'Water Softener'],
    [/\bwasher\s*(?:&|and|\/)\s*dryer\b/i, 'Washer & Dryer'],
    [/\bwasher\b(?!.*dryer)/i, 'Washer'],
    [/\bdryer\b(?!.*washer)/i, 'Dryer'],
  ];

  const out: string[] = [];
  const seen = new Set<string>();
  const addApp = (label: string) => {
    const clean = label.trim();
    if (!clean || /^(?:none|no|n\/a)$/i.test(clean)) return;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  };

  for (const rawApp of rawList) {
    if (/^(?:none|no|n\/a)$/i.test(rawApp.trim())) continue;
    let matchedCanonical = false;
    for (const [rx, label] of canonicalMap) {
      if (rx.test(rawApp)) {
        addApp(label);
        matchedCanonical = true;
        if (label === 'Washer & Dryer') {
          addApp('Washer');
          addApp('Dryer');
        }
        break;
      }
    }
    if (!matchedCanonical) addApp(rawApp);
  }

  if (/\bs\/r\/dw\/mw\b|\bs\/r\/dw\b/i.test(description)) {
    addApp('Range / Oven');
    addApp('Refrigerator');
    addApp('Dishwasher');
    if (/\bmw\b/i.test(description)) addApp('Microwave');
  }

  return { appliances: out, explicitNone: false };
}

function normalizeSchoolsList(sources: unknown[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const src of sources) {
    if (!Array.isArray(src)) continue;
    for (const item of src) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const o = item as Record<string, unknown>;
      const name = asStr(o.name || o.schoolName || o.title);
      if (!name) continue;
      const key = `${name.toLowerCase()}|${asStr(o.level || o.type) || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name,
        level: asStr(o.level) || null,
        type: asStr(o.type) || null,
        grades: asStr(o.grades) || null,
        rating: asNum(o.rating),
        distance: asNum(o.distance),
        district: asStr(o.district || o.schoolDistrict) || null,
        link: sanitizeSafeHttpsUrl(o.link || o.url),
      });
      if (out.length >= 12) return out;
    }
  }
  return out;
}

function buildUtilityMatrixFromExtracted(params: {
  utilitiesIncludedRaw: string[];
  utilitiesAllRaw: string[];
  electric: string[];
  gas: string[];
  waterSource: string[];
  sewer: string[];
  trash: string[];
  recycling: string[];
  internet: string[];
  cable: string[];
  hoaIncludes: string[];
  hoaFee: number | null;
  poolFeatures: string[];
}): { matrix: UtilityMatrix; utilitiesIncluded: string[] } {
  const draft: Record<string, { responsibility: 'landlord' | 'tenant' | 'shared' | 'n/a'; notes: string }> = {};
  const includedSet = new Map<string, string>();

  const matchUtilityTokens = (text: string): Array<typeof STANDARD_UTILITY_KEYS[number]> => {
    const low = text.toLowerCase();
    const hits: Array<typeof STANDARD_UTILITY_KEYS[number]> = [];
    if (/\belectric|electricity\b/.test(low)) hits.push('electric');
    if (/\bgas|natural\s+gas|propane\b/.test(low)) hits.push('gas');
    if (/\bwater\b/.test(low) && !/\bwaterfront|water\s+heater|water\s+softener\b/.test(low)) hits.push('water');
    if (/\bsewer|septic\b/.test(low)) hits.push('sewer');
    if (/\btrash|garbage|refuse\b/.test(low)) hits.push('trash');
    if (/\brecycl/.test(low)) hits.push('recycling');
    if (/\binternet|wifi|fiber\b/.test(low)) hits.push('internet');
    if (/\bcable|satellite\b/.test(low)) hits.push('cable');
    if (/\bhoa|association\b/.test(low)) hits.push('hoa');
    if (/\blawn|landscap|yard\s+care\b/.test(low)) hits.push('lawn_care');
    if (/\bsnow\b/.test(low)) hits.push('snow_removal');
    if (/\bpest\b/.test(low)) hits.push('pest_control');
    if (/\bpool\s+maint/.test(low)) hits.push('pool_maintenance');
    return hits;
  };

  for (const item of [...params.utilitiesIncludedRaw, ...params.hoaIncludes]) {
    if (/^(?:none|no|n\/a)$/i.test(item.trim())) continue;
    includedSet.set(item.toLowerCase(), item);
    const matchedKeys = matchUtilityTokens(item);
    for (const k of matchedKeys) {
      draft[k] = { responsibility: 'landlord', notes: item };
    }
  }

  for (const item of params.utilitiesAllRaw) {
    if (/^(?:none|no|n\/a)$/i.test(item.trim())) continue;
    const isTenantPaid = /\b(?:tenant|renter|resident)\b/i.test(item);
    const isLandlordPaid = /\b(?:landlord|owner|included|paid)\b/i.test(item);
    for (const k of matchUtilityTokens(item)) {
      if (isLandlordPaid) {
        draft[k] = { responsibility: 'landlord', notes: item };
        includedSet.set(k, item);
      } else if (isTenantPaid && !draft[k]) {
        draft[k] = { responsibility: 'tenant', notes: item };
      }
    }
  }

  if (params.electric.length > 0 && !draft.electric) {
    draft.electric = { responsibility: 'tenant', notes: params.electric.join(', ') };
  }
  if (params.gas.length > 0 && !draft.gas) {
    draft.gas = { responsibility: 'tenant', notes: params.gas.join(', ') };
  }
  if (params.waterSource.length > 0 && !draft.water) {
    draft.water = { responsibility: 'tenant', notes: params.waterSource.join(', ') };
  }
  if (params.sewer.length > 0 && !draft.sewer) {
    draft.sewer = { responsibility: 'tenant', notes: params.sewer.join(', ') };
  }
  if (params.trash.length > 0 && !draft.trash) {
    draft.trash = { responsibility: 'tenant', notes: params.trash.join(', ') };
  }
  if (params.recycling.length > 0 && !draft.recycling) {
    draft.recycling = { responsibility: 'tenant', notes: params.recycling.join(', ') };
  }
  if (params.internet.length > 0 && !draft.internet) {
    draft.internet = { responsibility: 'tenant', notes: params.internet.join(', ') };
  }
  if (params.cable.length > 0 && !draft.cable) {
    draft.cable = { responsibility: 'tenant', notes: params.cable.join(', ') };
  }
  if (params.hoaFee !== null && params.hoaFee > 0 && !draft.hoa) {
    draft.hoa = { responsibility: 'landlord', notes: `HOA $${params.hoaFee}` };
  }

  return {
    matrix: normalizeUtilityMatrix(draft),
    utilitiesIncluded: Array.from(includedSet.values()),
  };
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
  const actorDetails = asObj(raw._details);
  const detailsBlock = asObj(raw.details);
  const propFeatures = asObj(raw.propertyFeatures);
  const factsBlock = asObj(raw.facts);
  const addressObj = asObj(raw.address);
  const listingAddressObj = asObj(raw.listingAddress);
  const coordinatesObj = asObj(raw.coordinates);
  const bathroomsDetailObj = asObj(raw.bathroomsDetail);
  const lotAreaObj = asObj(raw.lotArea);
  const parkingObj = asObj(raw.parking);
  const hoaObj = asObj(raw.hoa);
  const schoolDistrictsObj = asObj(raw.schoolDistricts);
  const resoFacts = {
    ...factsBlock,
    ...asObj(detailsBlock.resoFacts),
    ...asObj(actorDetails.resoFacts),
    ...asObj(hdpInfo.resoFacts),
    ...asObj(raw.resoFacts),
  };
  const latLong = {
    ...asObj(raw.latLong),
    ...asObj(hdpInfo.latLong),
    ...asObj(actorDetails.latLong),
    ...coordinatesObj,
  };

  const rawUrl = asStr(
    raw.detailUrl || raw.propertyUrl || raw.url || raw.hdpUrl || hdpInfo.hdpUrl || actorDetails.hdpUrl,
  );
  let zpid = asStr(raw.zpid ?? hdpInfo.zpid ?? actorDetails.zpid ?? raw.id);
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
    listingAddressObj.street ||
      addressObj.streetAddress ||
      addressObj.street ||
      raw.streetAddress ||
      hdpInfo.streetAddress ||
      actorDetails.streetAddress ||
      detailsBlock.streetAddress ||
      (typeof raw.address === 'string' ? raw.address.split(',')[0] : null),
  );
  const city = asStr(
    listingAddressObj.city || addressObj.city || raw.addressCity || raw.city || hdpInfo.city || actorDetails.city || detailsBlock.city,
  );
  const state = asStr(
    listingAddressObj.state || addressObj.state || raw.addressState || raw.state || hdpInfo.state || actorDetails.state || detailsBlock.state,
  );
  const zip = asStr(
    listingAddressObj.zipCode ||
      listingAddressObj.zipcode ||
      addressObj.zipcode ||
      addressObj.zipCode ||
      raw.addressZipcode ||
      raw.zipcode ||
      raw.zip ||
      hdpInfo.zipcode ||
      actorDetails.zipcode ||
      detailsBlock.zipcode,
  );
  const county = asStr(
    raw.county || listingAddressObj.county || addressObj.county || hdpInfo.county || actorDetails.county || detailsBlock.county,
  );
  const subdivision = asStr(
    resoFacts.subdivision ||
      listingAddressObj.subdivision ||
      raw.subdivision ||
      detailsBlock.subdivision ||
      actorDetails.subdivision,
  );
  const neighborhood = asStr(
    raw.neighborhoodName ||
      raw.neighborhood ||
      listingAddressObj.neighborhood ||
      addressObj.neighborhood ||
      detailsBlock.neighborhood ||
      actorDetails.neighborhood ||
      subdivision ||
      hdpInfo.neighborhood,
  );
  const unitMatch = streetAddress
    ? streetAddress.match(/(?:,?\s+(?:#|apt\.?|apartment|unit|ste\.?|suite)\s*([a-z0-9-]+))$/i)
    : null;
  const unitNumber =
    asStr(listingAddressObj.unit || addressObj.unitNumber || addressObj.unit || raw.unitNumber || resoFacts.unitNumber || detailsBlock.unitNumber) ||
    (unitMatch ? unitMatch[1].trim() : null);

  // Fractional bathroom precision (never truncated!)
  const bedrooms = asNum(raw.bedrooms ?? raw.beds ?? actorDetails.bedrooms ?? detailsBlock.bedrooms ?? hdpInfo.bedrooms);
  const rawBathNum = asNum(raw.bathrooms ?? raw.baths ?? actorDetails.bathrooms ?? detailsBlock.bathrooms ?? hdpInfo.bathrooms);
  const detailFullBaths = asNum(bathroomsDetailObj.full ?? resoFacts.bathroomsFull ?? hdpInfo.bathroomsFull);
  const detailHalfBaths = asNum(bathroomsDetailObj.half ?? raw.halfBathrooms ?? resoFacts.bathroomsHalf ?? hdpInfo.bathroomsHalf ?? actorDetails.bathroomsHalf);
  const detailThreeQuarterBaths = asNum(bathroomsDetailObj.threeQuarter);
  const bathrooms = (() => {
    if (rawBathNum !== null) {
      if (Number.isInteger(rawBathNum) && detailHalfBaths !== null && detailHalfBaths > 0) {
        const reconstructed = rawBathNum + detailHalfBaths * 0.5;
        if (detailFullBaths !== null && Math.abs(detailFullBaths + detailHalfBaths * 0.5 - reconstructed) < 0.01) {
          return reconstructed;
        }
      }
      return rawBathNum;
    }
    if (detailFullBaths !== null || detailHalfBaths !== null || detailThreeQuarterBaths !== null) {
      return (detailFullBaths || 0) + (detailHalfBaths || 0) * 0.5 + (detailThreeQuarterBaths || 0) * 0.75;
    }
    return null;
  })();
  const halfBathrooms = detailHalfBaths !== null
    ? Math.round(detailHalfBaths)
    : (bathrooms !== null && Math.abs(bathrooms % 1) >= 0.25 ? 1 : null);

  const rentalEligibility = classifyRentalEligibility(raw, hdpInfo);
  if (!rentalEligibility.eligible) {
    return { ok: false, reason: rentalEligibility.reason || 'sale_only_excluded', zpid };
  }

  // Genuine monthly asking rent strictly verified (NEVER rentZestimate or salePrice)
  const rentCheck = parseVerifiedAskingRent(raw, hdpInfo, rentalEligibility.isDualListed);
  if (!rentCheck.rent) {
    return { ok: false, reason: rentCheck.reason || 'missing_verified_asking_rent', zpid };
  }
  const askingRent = rentCheck.rent;

  const propertyType = asStr(raw.homeType || hdpInfo.homeType || actorDetails.homeType || detailsBlock.homeType || raw.propertyType);
  const rawSubtype = resoFacts.propertySubType ?? raw.homeSubType ?? hdpInfo.homeSubType ?? resoFacts.structureType ?? propFeatures.propertySubType;
  const propertySubtype = Array.isArray(rawSubtype)
    ? (parseFlexStringArray(rawSubtype).join(', ') || null)
    : asStr(rawSubtype);

  let lotSqft = asNum(
    raw.lotAreaValue ?? lotAreaObj.value ?? raw.lotSize ?? hdpInfo.lotAreaValue ?? resoFacts.lotSize ?? detailsBlock.lotSize ?? actorDetails.lotAreaValue,
  );
  const lotUnit = String(raw.lotAreaUnit ?? lotAreaObj.unit ?? hdpInfo.lotAreaUnit ?? resoFacts.lotAreaUnits ?? '').toLowerCase();
  if (lotSqft !== null && (lotUnit.includes('acre') || /\bac\b/.test(lotUnit))) {
    lotSqft = Math.round(lotSqft * 43560);
  }

  const photos = extractOrderedPhotos(raw, hdpInfo, 500);
  const mediaLinks = extractVirtualTourAndVideos(raw, hdpInfo, resoFacts);
  const posterProfile = extractPosterProfileSignal(raw);
  const descriptionText = asStr(raw.description || resoFacts.description || hdpInfo.description || actorDetails.description || detailsBlock.description);
  const descriptionRawText = descriptionText || '';
  const lat = asNum(raw.latitude ?? raw.lat ?? latLong.latitude ?? hdpInfo.latitude ?? actorDetails.latitude);
  const lng = asNum(raw.longitude ?? raw.lng ?? latLong.longitude ?? hdpInfo.longitude ?? actorDetails.longitude);

  // Multi-shape structured attributes (Maxcopell resoFacts/propertyFeatures + Cliqto details/propertyFeatures + Igolaizola _details)
  const heating = uniqStrList([
    parseFlexStringArray(resoFacts.heating),
    parseFlexStringArray(propFeatures.heating),
    parseFlexStringArray(detailsBlock.heating),
  ]);
  const cooling = uniqStrList([
    parseFlexStringArray(resoFacts.cooling),
    parseFlexStringArray(propFeatures.cooling),
    parseFlexStringArray(detailsBlock.cooling),
  ]);
  const laundryRaw = uniqStrList([
    parseFlexStringArray(resoFacts.laundryFeatures),
    parseFlexStringArray(resoFacts.laundry),
    parseFlexStringArray(propFeatures.laundry),
    parseFlexStringArray(detailsBlock.laundry),
    parseFlexStringArray(raw.laundry),
  ]);
  const rawAppliances = uniqStrList([
    parseFlexStringArray(resoFacts.appliances),
    parseFlexStringArray(propFeatures.appliances),
    parseFlexStringArray(detailsBlock.appliances),
    parseFlexStringArray(actorDetails.appliances),
    parseFlexStringArray(raw.appliances),
  ]);
  const { appliances, explicitNone: appliancesExplicitNone } = canonicalizeAppliancesList(
    rawAppliances,
    descriptionRawText,
  );
  const parkingList = uniqStrList([
    parseFlexStringArray(resoFacts.parkingFeatures),
    parseFlexStringArray(propFeatures.parking),
    parseFlexStringArray(detailsBlock.parking),
    parseFlexStringArray(parkingObj.features),
    parseFlexStringArray(raw.parking),
  ]);
  const flooring = uniqStrList([
    parseFlexStringArray(resoFacts.flooring),
    parseFlexStringArray(propFeatures.flooring),
    parseFlexStringArray(detailsBlock.flooring),
    parseFlexStringArray(raw.flooring),
  ]);

  const utilitiesIncludedRaw = uniqStrList([
    parseFlexStringArray(resoFacts.utilitiesIncluded),
    parseFlexStringArray(raw.utilitiesIncluded),
    parseFlexStringArray(propFeatures.utilitiesIncluded),
    parseFlexStringArray(detailsBlock.utilitiesIncluded),
  ]);
  const utilitiesAllRaw = uniqStrList([
    parseFlexStringArray(resoFacts.utilities),
    parseFlexStringArray(propFeatures.utilities),
    parseFlexStringArray(detailsBlock.utilities),
  ]);
  const electricList = parseFlexStringArray(resoFacts.electric ?? propFeatures.electric);
  const gasList = parseFlexStringArray(resoFacts.gas ?? propFeatures.gas);
  const waterSourceList = parseFlexStringArray(resoFacts.waterSource ?? propFeatures.waterSource);
  const sewerList = parseFlexStringArray(resoFacts.sewer ?? propFeatures.sewer);
  const trashList = parseFlexStringArray(resoFacts.trash ?? propFeatures.trash);
  const recyclingList = parseFlexStringArray(resoFacts.recycling ?? propFeatures.recycling);
  const internetList = parseFlexStringArray(resoFacts.internet ?? propFeatures.internet);
  const cableList = parseFlexStringArray(resoFacts.cable ?? propFeatures.cable);
  const greenEnergyList = parseFlexStringArray(resoFacts.greenEnergyEfficient);
  const hoaIncludesList = parseFlexStringArray(resoFacts.associationFeeIncludes);

  const hoaFeeRaw = asNum(
    raw.monthlyHoaFee ??
      hoaObj.fee ??
      raw.hoaFee ??
      actorDetails.monthlyHoaFee ??
      detailsBlock.monthlyHoaFee ??
      resoFacts.hoaFee ??
      resoFacts.associationFee ??
      hdpInfo.monthlyHoaFee,
  );
  const hasAssociationBool = parseYesNoBool(resoFacts.hasAssociation ?? hoaObj.hasAssociation ?? raw.hasAssociation);
  const hoaFee = hoaFeeRaw !== null ? Math.round(hoaFeeRaw) : null;
  const hoaFreq =
    asStr(raw.hoaFeeFrequency ?? hoaObj.feeFrequency ?? resoFacts.hoaFeeFrequency ?? resoFacts.associationFeeFrequency) ||
    (hoaFee !== null && hoaFee > 0 && (raw.monthlyHoaFee !== undefined || detailsBlock.monthlyHoaFee !== undefined || actorDetails.monthlyHoaFee !== undefined)
      ? 'Monthly'
      : null);

  const exteriorFeatures = uniqStrList([
    parseFlexStringArray(resoFacts.exteriorFeatures),
    parseFlexStringArray(propFeatures.exteriorFeatures),
    parseFlexStringArray(propFeatures.exterior),
    parseFlexStringArray(detailsBlock.exteriorFeatures),
  ]);
  const interiorFeatures = uniqStrList([
    parseFlexStringArray(resoFacts.interiorFeatures),
    parseFlexStringArray(propFeatures.interiorFeatures),
    parseFlexStringArray(propFeatures.interior),
    parseFlexStringArray(detailsBlock.interiorFeatures),
  ]);
  const communityFeatures = uniqStrList([
    parseFlexStringArray(resoFacts.communityFeatures),
    parseFlexStringArray(propFeatures.community),
  ]);
  const lotFeatures = uniqStrList([
    parseFlexStringArray(resoFacts.lotFeatures),
    parseFlexStringArray(propFeatures.lot),
  ]);
  const poolFeatures = uniqStrList([
    parseFlexStringArray(resoFacts.poolFeatures),
    parseFlexStringArray(propFeatures.pool),
  ]);
  const fencing = parseFlexStringArray(resoFacts.fencing ?? propFeatures.fencing);
  const patioPorch = parseFlexStringArray(resoFacts.patioAndPorchFeatures ?? propFeatures.patio);
  const fireplaceFeatures = parseFlexStringArray(resoFacts.fireplaceFeatures ?? propFeatures.fireplace);
  const spaFeatures = parseFlexStringArray(resoFacts.spaFeatures);
  const windowFeatures = parseFlexStringArray(resoFacts.windowFeatures);
  const doorFeatures = parseFlexStringArray(resoFacts.doorFeatures);
  const accessibilityFeatures = parseFlexStringArray(resoFacts.accessibilityFeatures);
  const securityFeatures = parseFlexStringArray(resoFacts.securityFeatures);
  const otherStructures = parseFlexStringArray(resoFacts.otherStructures);
  const architecturalStyle = asStr(
    Array.isArray(resoFacts.architecturalStyle)
      ? parseFlexStringArray(resoFacts.architecturalStyle).join(', ')
      : (resoFacts.architecturalStyle ?? propFeatures.architecturalStyle),
  );
  const constructionMaterials = uniqStrList([
    parseFlexStringArray(resoFacts.constructionMaterials),
    parseFlexStringArray(propFeatures.constructionMaterials),
  ]);
  const foundationDetails = parseFlexStringArray(resoFacts.foundationDetails);
  const roof = uniqStrList([
    parseFlexStringArray(resoFacts.roofType ?? resoFacts.roof),
    parseFlexStringArray(propFeatures.roofType),
  ]);
  const roomTypes = Array.isArray(resoFacts.rooms)
    ? resoFacts.rooms
        .map((r) => asStr(asObj(r).roomType || asObj(r).name || r))
        .filter((x): x is string => Boolean(x))
    : parseFlexStringArray(resoFacts.roomTypes);

  const amenities = uniqStrList([
    parseFlexStringArray(raw.tags),
    communityFeatures,
    interiorFeatures,
    exteriorFeatures,
    lotFeatures,
    poolFeatures,
  ]).filter((a) => !/smoke|smoking|tobacco/i.test(a) && !/\b(?:\d+[\s-]*month|lease\s*term)\b/i.test(a));

  const laundryJoined = laundryRaw.join(', ');
  const laundryExplicitNone = isExplicitNoneArray(laundryRaw) || parseYesNoBool(resoFacts.hasLaundry) === false;
  let normalizedLaundry: string | null = laundryExplicitNone ? null : (laundryJoined || null);
  if (!laundryExplicitNone && laundryJoined) {
    if (/\b(?:hook[\s-]*ups?|connections?)\b/i.test(laundryJoined)) {
      normalizedLaundry = 'Hookups';
    } else if (/\b(?:in[- ]?unit|included|provided|washer\s*(?:and|&|\/)\s*dryer)\b/i.test(laundryJoined)) {
      normalizedLaundry = 'In Unit';
    } else if (/\b(?:on[- ]?site|shared|common)\b/i.test(laundryJoined)) {
      normalizedLaundry = 'On-Site Laundry';
    }
  }

  const evChargingRaw =
    asStr(resoFacts.electricVehicleCharging ?? resoFacts.evCharger ?? propFeatures.evCharging ?? raw.evCharging) ||
    [...parkingList, ...greenEnergyList, ...exteriorFeatures].find((x) =>
      /\b(?:ev\s*charg|electric\s*vehicle|tesla|level\s*2)\b/i.test(x),
    ) ||
    null;

  const coolingExplicitFalse =
    parseYesNoBool(resoFacts.hasCooling) === false || isExplicitNoneArray(cooling);
  const centralAir = coolingExplicitFalse
    ? false
    : cooling.length > 0
    ? cooling.some((c) => /\bcentral\b/i.test(c))
    : null;

  const garageSpacesExplicit = asNum(
    raw.garageParkingCapacity ?? raw.garageSpaces ?? parkingObj.garageSpaces ?? resoFacts.garageSpaces ?? actorDetails.garageSpaces ?? detailsBlock.garageSpaces,
  );
  const hasGarageBool = parseYesNoBool(resoFacts.hasGarage ?? parkingObj.hasGarage ?? raw.hasGarage);
  const garageExplicitAbsent =
    hasGarageBool === false ||
    (garageSpacesExplicit !== null && garageSpacesExplicit === 0);

  const basementExplicit = parseYesNoBool(resoFacts.hasBasement ?? resoFacts.basement ?? propFeatures.basement ?? raw.hasBasement);
  const basementArr = parseFlexStringArray(resoFacts.basement ?? propFeatures.basement);
  const basementExplicitAbsent = basementExplicit === false || isExplicitNoneArray(basementArr);
  const basementValue = basementExplicitAbsent ? false : (basementExplicit === true || basementArr.length > 0 ? true : null);

  const fireplaceExplicit = parseYesNoBool(resoFacts.hasFireplace ?? raw.hasFireplace);
  const fireplaceCount = asNum(resoFacts.fireplaces ?? raw.fireplaces);
  const fireplaceExplicitAbsent =
    fireplaceExplicit === false ||
    (fireplaceCount !== null && fireplaceCount === 0) ||
    isExplicitNoneArray(fireplaceFeatures);

  const { matrix: utilityMatrix, utilitiesIncluded } = buildUtilityMatrixFromExtracted({
    utilitiesIncludedRaw,
    utilitiesAllRaw,
    electric: electricList,
    gas: gasList,
    waterSource: waterSourceList,
    sewer: sewerList,
    trash: trashList,
    recycling: recyclingList,
    internet: internetList,
    cable: cableList,
    hoaIncludes: hoaIncludesList,
    hoaFee,
    poolFeatures,
  });

  // Schools (non-dated)
  const elemDistrict = asStr(resoFacts.elementarySchoolDistrict ?? schoolDistrictsObj.elementary);
  const midDistrict = asStr(resoFacts.middleOrJuniorSchoolDistrict ?? schoolDistrictsObj.middle);
  const highDistrict = asStr(resoFacts.highSchoolDistrict ?? schoolDistrictsObj.high);
  const schools = normalizeSchoolsList([
    raw.schools,
    raw.nearbySchools,
    raw.assignedSchools,
    actorDetails.assignedSchools,
    actorDetails.schools,
    detailsBlock.schools,
    hdpInfo.schools,
  ]);
  const schoolDistrict =
    asStr(
      highDistrict ||
        elemDistrict ||
        midDistrict ||
        raw.schoolDistrict ||
        schoolDistrictsObj.unified ||
        detailsBlock.schoolDistrict ||
        schools.find((s) => typeof s.district === 'string')?.district,
    ) || null;

  // Build structural_details, utility_details, financial_details, location_details
  const structuralHighlights = Array.isArray(raw.atAGlanceFacts)
    ? raw.atAGlanceFacts
        .map((f) => asObj(f))
        .filter((f) => {
          const lbl = asStr(f.factLabel);
          const val = asStr(f.factValue);
          return Boolean(lbl && val && !isExcludedScopeKey(lbl) && !/date|days on zillow|price\/sqft|zestimate/i.test(lbl));
        })
        .map((f) => ({ label: asStr(f.factLabel), value: asStr(f.factValue) }))
    : [];

  const structuralDetails: Record<string, unknown> = {
    architectural_style: architecturalStyle,
    construction_materials: constructionMaterials.length ? constructionMaterials : null,
    foundation_details: foundationDetails.length ? foundationDetails : null,
    roof: roof.length ? roof : null,
    exterior_features: exteriorFeatures.length ? exteriorFeatures : null,
    interior_features: interiorFeatures.length ? interiorFeatures : null,
    flooring: flooring.length ? flooring : null,
    window_features: windowFeatures.length ? windowFeatures : null,
    door_features: doorFeatures.length ? doorFeatures : null,
    fencing: fencing.length ? fencing : null,
    patio_and_porch_features: patioPorch.length ? patioPorch : null,
    fireplace_features: fireplaceFeatures.length ? fireplaceFeatures : null,
    pool_features: poolFeatures.length ? poolFeatures : null,
    spa_features: spaFeatures.length ? spaFeatures : null,
    levels: asStr(resoFacts.levels) || asNum(raw.stories ?? resoFacts.stories),
    accessibility_features: accessibilityFeatures.length ? accessibilityFeatures : null,
    security_features: securityFeatures.length ? securityFeatures : null,
    parking_features: parkingList.length ? parkingList : null,
    other_structures: otherStructures.length ? otherStructures : null,
    lot_features: lotFeatures.length ? lotFeatures : null,
    lot_size_dimensions: asStr(resoFacts.lotSizeDimensions),
    garage_spaces_raw: garageSpacesExplicit,
    carport_spaces: asNum(resoFacts.carportSpaces),
    covered_spaces: asNum(resoFacts.coveredSpaces),
    open_parking_spaces: asNum(resoFacts.openParkingSpaces),
    room_types: roomTypes.length ? roomTypes : null,
    structural_highlights: structuralHighlights.length ? structuralHighlights : null,
    ev_charging: evChargingRaw,
  };

  const utilityDetails: Record<string, unknown> = {
    utilities_included_confirmed: utilitiesIncluded.length ? utilitiesIncluded : null,
    utilities: utilitiesAllRaw.length ? utilitiesAllRaw : null,
    electric: electricList.length ? electricList : null,
    gas: gasList.length ? gasList : null,
    water_source: waterSourceList.length ? waterSourceList : null,
    sewer: sewerList.length ? sewerList : null,
    trash: trashList.length ? trashList : null,
    recycling: recyclingList.length ? recyclingList : null,
    internet: internetList.length ? internetList : null,
    cable: cableList.length ? cableList : null,
    green_energy: greenEnergyList.length ? greenEnergyList : null,
    heating_systems: heating.length ? heating : null,
    cooling_systems: cooling.length ? cooling : null,
    appliances: appliances.length ? appliances : null,
    laundry_features: laundryRaw.length ? laundryRaw : null,
    utility_matrix: utilityMatrix,
  };

  const parkingFeeNum = asNum(raw.parkingFee ?? resoFacts.parkingFee);
  const adminFeeNum = asNum(raw.adminFee ?? resoFacts.adminFee);
  const financialDetails: Record<string, unknown> = {
    asking_rent: askingRent,
    is_dual_listed: rentalEligibility.isDualListed,
    application_fee: 50,
    hoa_fee: hoaFee,
    hoa_fee_frequency: hoaFreq,
    hoa_includes: hoaIncludesList.length ? hoaIncludesList : null,
    parking_fee: parkingFeeNum !== null && parkingFeeNum >= 0 ? Math.round(parkingFeeNum) : null,
    admin_fee: adminFeeNum !== null && adminFeeNum >= 0 ? Math.round(adminFeeNum) : null,
  };

  const extractionDepth: ExtractionDepth =
    ctx.extractionDepth || resolveExtractionDepth(ctx.taskConfig || {});
  const propertyInsights = extractPropertyInsights(
    { raw, hdpInfo, actorDetails, detailsBlock },
    extractionDepth === 'with_insights',
  );

  const locationDetails: Record<string, unknown> = {
    county,
    neighborhood,
    subdivision,
    school_district: schoolDistrict,
    elementary_school_district: elemDistrict,
    middle_or_junior_school_district: midDistrict,
    high_school_district: highDistrict,
    schools: schools.length ? schools : null,
    community_features: communityFeatures.length ? communityFeatures : null,
    ...(propertyInsights
      ? {
          ...(propertyInsights.walk_score !== null ? { walk_score: propertyInsights.walk_score } : {}),
          ...(propertyInsights.transit_score !== null ? { transit_score: propertyInsights.transit_score } : {}),
          ...(propertyInsights.bike_score !== null ? { bike_score: propertyInsights.bike_score } : {}),
          insights: propertyInsights.insights_payload,
        }
      : {}),
  };

  // Conflict detection (structured facts vs narrative claims — never fabricate over confirmed_absent)
  const conflicts: ExtractionConflictEntry[] = [];
  const lowDesc = descriptionRawText.toLowerCase();
  if (coolingExplicitFalse && /\bcentral\s*(?:air|a\/c|ac|cooling)\b/i.test(lowDesc)) {
    conflicts.push({
      field: 'central_air',
      structured_value: resoFacts.hasCooling === false ? false : cooling,
      narrative_claim: 'central air',
      severity: 'warning',
      message: 'Structured Zillow cooling field indicates absent/none while description mentions central air.',
    });
  }
  if (garageExplicitAbsent && /\b(?:\d+[-\s]*car\s+)?garage\b/i.test(lowDesc) && !/\bno\s+garage\b/i.test(lowDesc)) {
    conflicts.push({
      field: 'garage',
      structured_value: garageSpacesExplicit ?? false,
      narrative_claim: 'garage',
      severity: 'warning',
      message: 'Structured Zillow garage field indicates 0/no garage while description mentions a garage.',
    });
  }
  if (fireplaceExplicitAbsent && /\bfireplace\b/i.test(lowDesc) && !/\bno\s+fireplace\b/i.test(lowDesc)) {
    conflicts.push({
      field: 'fireplace',
      structured_value: fireplaceCount ?? false,
      narrative_claim: 'fireplace',
      severity: 'info',
      message: 'Structured Zillow fireplace field indicates absent while description mentions a fireplace.',
    });
  }
  if (basementExplicitAbsent && /\bbasement\b/i.test(lowDesc) && !/\bno\s+basement\b/i.test(lowDesc)) {
    conflicts.push({
      field: 'basement',
      structured_value: false,
      narrative_claim: 'basement',
      severity: 'info',
      message: 'Structured Zillow basement field indicates absent while description mentions a basement.',
    });
  }
  if (appliancesExplicitNone && /\b(?:dishwasher|refrigerator|microwave|range|stove)\b/i.test(lowDesc)) {
    conflicts.push({
      field: 'appliances',
      structured_value: 'None',
      narrative_claim: 'appliances mentioned in narrative',
      severity: 'warning',
      message: 'Structured appliances field says None while description lists kitchen appliances.',
    });
  }

  // Canonical 4-state fact ledger + lossless raw key walker
  const ledgerFacts: Record<string, FactLedgerEntry> = {
    heating: heating.length
      ? { state: isExplicitNoneArray(heating) ? 'confirmed_absent' : 'confirmed_present', value: heating, source_key: 'heating' }
      : parseYesNoBool(resoFacts.hasHeating) === false
      ? { state: 'confirmed_absent', value: false, source_key: 'hasHeating' }
      : { state: 'unspecified' },
    cooling: cooling.length
      ? { state: isExplicitNoneArray(cooling) ? 'confirmed_absent' : 'confirmed_present', value: cooling, source_key: 'cooling' }
      : parseYesNoBool(resoFacts.hasCooling) === false
      ? { state: 'confirmed_absent', value: false, source_key: 'hasCooling' }
      : { state: 'unspecified' },
    central_air: centralAir === true
      ? { state: 'confirmed_present', value: true, source_key: 'cooling' }
      : centralAir === false
      ? { state: 'confirmed_absent', value: false, source_key: 'hasCooling' }
      : { state: 'unspecified' },
    appliances: appliancesExplicitNone
      ? { state: 'confirmed_absent', value: [], source_key: 'appliances' }
      : appliances.length > 0
      ? { state: 'confirmed_present', value: appliances, source_key: 'appliances' }
      : { state: 'unspecified' },
    laundry: laundryExplicitNone
      ? { state: 'confirmed_absent', value: false, source_key: 'laundryFeatures' }
      : normalizedLaundry
      ? { state: 'confirmed_present', value: normalizedLaundry, source_key: 'laundryFeatures' }
      : { state: 'unspecified' },
    flooring: flooring.length
      ? { state: isExplicitNoneArray(flooring) ? 'confirmed_absent' : 'confirmed_present', value: flooring, source_key: 'flooring' }
      : { state: 'unspecified' },
    parking: parkingList.length
      ? { state: isExplicitNoneArray(parkingList) ? 'confirmed_absent' : 'confirmed_present', value: parkingList, source_key: 'parkingFeatures' }
      : { state: 'unspecified' },
    garage: garageExplicitAbsent
      ? { state: 'confirmed_absent', value: 0, source_key: 'garageSpaces' }
      : (garageSpacesExplicit !== null && garageSpacesExplicit > 0) || parkingList.some((p) => /\bgarage\b/i.test(p))
      ? { state: 'confirmed_present', value: garageSpacesExplicit ?? true, source_key: 'garageSpaces' }
      : { state: 'unspecified' },
    ev_charging: evChargingRaw
      ? { state: /^(?:none|no)$/i.test(evChargingRaw) ? 'confirmed_absent' : 'confirmed_present', value: evChargingRaw, source_key: 'evCharging' }
      : { state: 'unspecified' },
    basement: basementExplicitAbsent
      ? { state: 'confirmed_absent', value: false, source_key: 'hasBasement' }
      : basementValue === true
      ? { state: 'confirmed_present', value: true, source_key: 'basement' }
      : { state: 'unspecified' },
    fireplace: fireplaceExplicitAbsent
      ? { state: 'confirmed_absent', value: false, source_key: 'hasFireplace' }
      : fireplaceFeatures.length > 0 || (fireplaceCount !== null && fireplaceCount > 0) || fireplaceExplicit === true
      ? { state: 'confirmed_present', value: fireplaceFeatures.length ? fireplaceFeatures : (fireplaceCount ?? true), source_key: 'fireplaceFeatures' }
      : { state: 'unspecified' },
    pool: parseYesNoBool(resoFacts.hasPool) === false || isExplicitNoneArray(poolFeatures)
      ? { state: 'confirmed_absent', value: false, source_key: 'poolFeatures' }
      : poolFeatures.length > 0 || parseYesNoBool(resoFacts.hasPool) === true
      ? { state: 'confirmed_present', value: poolFeatures.length ? poolFeatures : true, source_key: 'poolFeatures' }
      : { state: 'unspecified' },
    fencing: fencing.length
      ? { state: isExplicitNoneArray(fencing) ? 'confirmed_absent' : 'confirmed_present', value: fencing, source_key: 'fencing' }
      : { state: 'unspecified' },
    architectural_style: architecturalStyle
      ? { state: 'confirmed_present', value: architecturalStyle, source_key: 'architecturalStyle' }
      : { state: 'unspecified' },
    roof: roof.length
      ? { state: 'confirmed_present', value: roof, source_key: 'roofType' }
      : { state: 'unspecified' },
    foundation: foundationDetails.length
      ? { state: 'confirmed_present', value: foundationDetails, source_key: 'foundationDetails' }
      : { state: 'unspecified' },
    electric: electricList.length
      ? { state: 'confirmed_present', value: electricList, source_key: 'electric' }
      : { state: 'unspecified' },
    gas: gasList.length
      ? { state: 'confirmed_present', value: gasList, source_key: 'gas' }
      : { state: 'unspecified' },
    water_source: waterSourceList.length
      ? { state: 'confirmed_present', value: waterSourceList, source_key: 'waterSource' }
      : { state: 'unspecified' },
    sewer: sewerList.length
      ? { state: 'confirmed_present', value: sewerList, source_key: 'sewer' }
      : { state: 'unspecified' },
    utilities_included: utilitiesIncluded.length
      ? { state: 'confirmed_present', value: utilitiesIncluded, source_key: 'utilitiesIncluded' }
      : utilitiesIncludedRaw.some((u) => /^none$/i.test(u))
      ? { state: 'confirmed_absent', value: [], source_key: 'utilitiesIncluded' }
      : { state: 'unspecified' },
    hoa: hasAssociationBool === false || hoaFee === 0
      ? { state: 'not_applicable', value: 0, source_key: 'hoaFee' }
      : hoaFee !== null && hoaFee > 0
      ? { state: 'confirmed_present', value: hoaFee, source_key: 'hoaFee' }
      : { state: 'unspecified' },
    schools: schools.length
      ? { state: 'confirmed_present', value: schools.length, source_key: 'schools' }
      : { state: 'unspecified' },
    school_district: schoolDistrict
      ? { state: 'confirmed_present', value: schoolDistrict, source_key: 'schoolDistrict' }
      : { state: 'unspecified' },
  };

  // Zero-Drop Guarantee: Walk every non-excluded key returned across raw & actor sub-blocks
  const rawAttributeStates: Record<string, { target: string; state: FactLedgerState }> = {};
  const unmappedAttributes: Record<string, unknown> = {};
  const sourceBags: Array<{ prefix: string; bag: Record<string, unknown> }> = [
    { prefix: '', bag: raw },
    { prefix: 'hdpInfo', bag: hdpInfo },
    { prefix: 'resoFacts', bag: resoFacts },
    { prefix: '_details', bag: actorDetails },
    { prefix: 'details', bag: detailsBlock },
    { prefix: 'propertyFeatures', bag: propFeatures },
    { prefix: 'facts', bag: factsBlock },
  ];

  for (const { prefix, bag } of sourceBags) {
    for (const [k, v] of Object.entries(bag)) {
      if (isExcludedScopeKey(k)) continue;
      if (/smoke|smoking|tobacco|pet|pets|lease|deposit/i.test(k)) continue;
      if (v === null || v === undefined || v === '') continue;
      if (Array.isArray(v) && v.length === 0) continue;

      const lowKey = k.toLowerCase();
      const attrState: FactLedgerState =
        parseYesNoBool(v) === false || (Array.isArray(v) && isExplicitNoneArray(parseFlexStringArray(v)))
          ? 'confirmed_absent'
          : 'confirmed_present';

      if (KNOWN_MAPPED_SOURCE_KEYS.has(lowKey)) {
        rawAttributeStates[prefix ? `${prefix}.${k}` : k] = {
          target: `canonical:${k}`,
          state: attrState,
        };
      } else {
        const cleanedVal = scrubExcludedKeysDeep(v);
        if (cleanedVal !== null && cleanedVal !== undefined && cleanedVal !== '') {
          const outKey = !(k in unmappedAttributes) ? k : `${prefix || 'raw'}_${k}`;
          unmappedAttributes[outKey] = cleanedVal;
          rawAttributeStates[prefix ? `${prefix}.${k}` : k] = {
            target: `unmapped_attributes.${outKey}`,
            state: attrState,
          };
        }
      }
    }
  }

  const sourceFactsLedger: Record<string, unknown> = {
    version: '3.0',
    facts: ledgerFacts,
    conflicts,
    raw_attribute_states: rawAttributeStates,
    covered_key_count: Object.keys(rawAttributeStates).length,
    unmapped_key_count: Object.keys(unmappedAttributes).length,
  };

  const sourceStatus = rentalEligibility.sourceStatus;
  const normalizedAddressKey = buildNormalizedAddressKey(
    streetAddress,
    unitNumber,
    city,
    state,
    zip,
  );

  const nowIso = new Date().toISOString();
  const fieldProvenance: Record<string, unknown> = {
    source: 'zillow',
    provider_key: ctx.providerKey || 'apify',
    import_channel: ctx.channel || 'apify-scrape-worker-v2',
    apify_actor_id: ctx.actorId || null,
    apify_run_id: ctx.runId || null,
    apify_dataset_id: ctx.datasetId || null,
    batch_id: ctx.batchId || null,
    imported_at: nowIso,
    poster_profile: posterProfile,
    rental_eligibility: rentalEligibility,
    stage2_enriched: ctx.actorId === DEFAULT_DETAIL_ACTOR_ID,
    extraction_depth: extractionDepth,
  };

  const title = streetAddress && city && state
    ? `${streetAddress}, ${city}, ${state}${zip ? ` ${zip}` : ''}`
    : asStr(raw.title) || (streetAddress || `Zillow #${zpid}`);

  const pipelineInput: PipelineRecordInput = {
    source: 'zillow',
    source_listing_id: zpid,
    source_url: sourceUrl,
    normalized_address_key: normalizedAddressKey,
    rental_eligibility_status: rentalEligibility.status,
    is_dual_listed: rentalEligibility.isDualListed,
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
    location_context: propertyInsights?.location_context ?? null,
    property_type: propertyType,
    property_subtype: propertySubtype,
    bedrooms: bedrooms !== null ? Math.round(bedrooms) : null,
    bathrooms,
    half_bathrooms: halfBathrooms,
    total_bathrooms: bathrooms,
    square_footage: asNum(raw.livingArea ?? raw.livingAreaValue ?? raw.sqft ?? actorDetails.livingArea ?? actorDetails.sqft ?? detailsBlock.sqft ?? hdpInfo.livingArea ?? resoFacts.livingArea),
    lot_size_sqft: lotSqft,
    year_built: asNum(raw.yearBuilt ?? actorDetails.yearBuilt ?? detailsBlock.yearBuilt ?? hdpInfo.yearBuilt ?? resoFacts.yearBuilt),
    floors: asNum(raw.stories ?? actorDetails.stories ?? detailsBlock.stories ?? resoFacts.stories),
    garage_spaces: garageSpacesExplicit,
    total_units: asNum(raw.unitCount ?? raw.numberOfUnitsTotal ?? hdpInfo.unitCount),
    has_basement: basementValue,
    virtual_tour_url: mediaLinks.virtual_tour_url,
    monthly_rent: askingRent,
    original_monthly_rent: askingRent,
    hoa_fee: hoaFee,
    hoa_fee_frequency: hoaFreq,
    parking_fee: parkingFeeNum !== null && parkingFeeNum >= 0 ? Math.round(parkingFeeNum) : null,
    admin_fee: adminFeeNum !== null && adminFeeNum >= 0 ? Math.round(adminFeeNum) : null,
    description: descriptionText,
    original_description: descriptionText,
    parking: parkingList.join(', ') || asStr(raw.parkingType),
    ev_charging: evChargingRaw,
    amenities: JSON.stringify(amenities),
    appliances: JSON.stringify(appliances),
    utilities_included: JSON.stringify(utilitiesIncluded),
    flooring: flooring.length ? JSON.stringify(flooring) : null,
    heating_type: heating.join(', ') || asStr(resoFacts.heating),
    cooling_type: cooling.join(', ') || asStr(resoFacts.cooling),
    laundry_type: normalizedLaundry,
    has_central_air: centralAir,
    original_image_urls: JSON.stringify(photos),
    agent_name: posterProfile.agent_name,
    broker_name: posterProfile.broker_name,
    listed_at: null,
    source_last_updated_at: null,
    imported_at: nowIso,
    source_status: sourceStatus,
    structural_details: structuralDetails,
    utility_details: utilityDetails,
    financial_details: financialDetails,
    location_details: locationDetails,
    source_facts_ledger: sourceFactsLedger,
    unmapped_attributes: unmappedAttributes,
    floor_plans: null,
    videos: mediaLinks.videos,
    original_data: {
      source: 'zillow',
      zpid,
      detailUrl: sourceUrl,
      homeType: propertyType,
      homeStatus: sourceStatus,
      rental_eligibility_status: rentalEligibility.status,
      is_dual_listed: rentalEligibility.isDualListed,
      _import: ctx.channel || 'apify-scrape-worker-v2',
      _imported_at: nowIso,
    },
    source_raw_payload: {
      ...raw,
      _poster_profile: posterProfile,
    },
    field_provenance: fieldProvenance,
    _import: ctx.channel || 'apify-scrape-worker-v2',
  };

  return {
    ok: true,
    zpid,
    source_url: sourceUrl,
    pipelineInput,
    posterProfile,
    rentalEligibility,
    normalizedAddressKey,
    rawItem: raw,
  };
}

export function canonicalFilterPropType(raw: unknown): string {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!s) return 'UNKNOWN';
  if (['SINGLE_FAMILY', 'SINGLE_FAMILY_HOME', 'SINGLEFAMILY', 'HOUSE', 'HOUSES', 'SFH', 'DETACHED'].includes(s)) {
    return 'SINGLE_FAMILY';
  }
  if (['TOWNHOUSE', 'TOWNHOME', 'TOWNHOMES', 'ROWHOUSE', 'ROW_HOUSE'].includes(s)) {
    return 'TOWNHOME';
  }
  if (['DUPLEX', 'HALF_DUPLEX', '1_2_DUPLEX'].includes(s)) {
    return 'DUPLEX';
  }
  if (['CONDO', 'CONDOS', 'CONDOMINIUM', 'CONDO_TOWNHOME'].includes(s)) {
    return 'CONDO';
  }
  if (['APARTMENT', 'APARTMENTS', 'FLAT'].includes(s)) {
    return 'APARTMENT';
  }
  if (['MULTI_FAMILY', 'MULTIFAMILY'].includes(s)) {
    return 'MULTI_FAMILY';
  }
  return s;
}

function buildFeatureSearchHaystack(pipelineInput: PipelineRecordInput): string {
  const parts = [
    pipelineInput.description,
    pipelineInput.parking,
    pipelineInput.amenities,
    pipelineInput.appliances,
    pipelineInput.heating_type,
    pipelineInput.cooling_type,
    pipelineInput.laundry_type,
    pipelineInput.flooring,
    pipelineInput.property_subtype,
    pipelineInput.title,
  ];
  if (pipelineInput.garage_spaces && Number(pipelineInput.garage_spaces) > 0) {
    parts.push('garage');
  }
  if (pipelineInput.has_central_air === true) {
    parts.push('central air central cooling a/c');
  }
  if (pipelineInput.has_basement === true) {
    parts.push('basement');
  }
  return parts
    .filter(Boolean)
    .map((x) => String(x).toLowerCase())
    .join(' ');
}

function textMatchesFeatureToken(haystack: string, feature: string): boolean {
  const clean = feature.trim().toLowerCase();
  if (!clean) return true;
  if (haystack.includes(clean)) return true;

  if (/^fenced\s*yard$/.test(clean) || /^fenced\s*backyard$/.test(clean)) {
    return /\bfenc\w*\b/.test(haystack) && /\b(?:yard|backyard)\b/.test(haystack);
  }
  if (/^central\s*(?:air|ac|a\/c)$/.test(clean)) {
    return /\bcentral\s*(?:air|a\/c|ac|cooling)\b/.test(haystack);
  }
  if (/^(?:in[- ]?unit\s*)?(?:washer|laundry|w\/d)$/.test(clean)) {
    return /\b(?:washer|laundry|w\/d)\b/.test(haystack);
  }

  const words = clean.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length >= 2) {
    return words.every((w) => haystack.includes(w));
  }
  return false;
}

export function resolveItemCanonicalType(norm: Extract<NormalizeApifyResult, { ok: true }>): string {
  const subtype = String(norm.pipelineInput.property_subtype || '');
  const title = String(norm.pipelineInput.title || '');
  if (/\bduplex\b/i.test(subtype) || /\bhalf[\s-]*duplex\b/i.test(title)) {
    return 'DUPLEX';
  }
  if (/\btownhome\b|\btownhouse\b/i.test(subtype)) {
    return 'TOWNHOME';
  }
  return canonicalFilterPropType(norm.pipelineInput.property_type);
}

export function normalizeTaskConfigAliases(
  rawConfig: Record<string, unknown> | null | undefined = {},
): Record<string, unknown> {
  const cfg = rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
    ? { ...rawConfig }
    : {};

  if (cfg.target_qty === undefined) {
    const qty = cfg.target_quantity ?? cfg.target;
    if (qty !== undefined) cfg.target_qty = qty;
  }
  if (cfg.min_rent === undefined) {
    const mr = cfg.rent_min ?? cfg.source_min;
    if (mr !== undefined) cfg.min_rent = mr;
  }
  if (cfg.max_rent === undefined) {
    const xr = cfg.rent_max ?? cfg.source_max;
    if (xr !== undefined) cfg.max_rent = xr;
  }
  if (cfg.exact_beds === undefined && cfg.bedrooms_exact !== undefined) {
    cfg.exact_beds = cfg.bedrooms_exact;
  }
  if (cfg.min_beds === undefined && cfg.bedrooms_min !== undefined) {
    cfg.min_beds = cfg.bedrooms_min;
  }
  if (cfg.max_beds === undefined && cfg.bedrooms_max !== undefined) {
    cfg.max_beds = cfg.bedrooms_max;
  }
  if (cfg.exact_baths === undefined && cfg.bathrooms_exact !== undefined) {
    cfg.exact_baths = cfg.bathrooms_exact;
  }
  if (cfg.min_baths === undefined && cfg.bathrooms_min !== undefined) {
    cfg.min_baths = cfg.bathrooms_min;
  }
  if (cfg.max_baths === undefined && cfg.bathrooms_max !== undefined) {
    cfg.max_baths = cfg.bathrooms_max;
  }
  if (!Array.isArray(cfg.locations) && typeof cfg.location === 'string' && cfg.location.trim()) {
    cfg.locations = [cfg.location.trim()];
  }
  if (cfg.include_property_insights === undefined && cfg.include_insights !== undefined) {
    cfg.include_property_insights = cfg.include_insights;
  }
  return cfg;
}

export function matchesTaskConfigFilters(
  norm: Extract<NormalizeApifyResult, { ok: true }>,
  rawTaskConfig: Record<string, unknown> = {},
): { matches: boolean; reason: string | null } {
  const taskConfig = normalizeTaskConfigAliases(rawTaskConfig);
  const p = norm.pipelineInput;

  if (!norm.rentalEligibility?.eligible || p.rental_eligibility_status === 'sale_only' || p.rental_eligibility_status === 'off_market' || p.rental_eligibility_status === 'unconfirmed') {
    return { matches: false, reason: 'sale_only_excluded' };
  }

  const verifiedRent = p.monthly_rent != null ? Number(p.monthly_rent) : null;
  if (verifiedRent === null || !Number.isFinite(verifiedRent) || verifiedRent <= 0 || verifiedRent >= 50000) {
    return { matches: false, reason: 'invalid_or_missing_rent' };
  }

  if (taskConfig.owner_only === true && !norm.posterProfile.explicit_owner_landlord) {
    return { matches: false, reason: 'owner_only_required' };
  }

  const rawTypes = Array.isArray(taskConfig.property_types)
    ? taskConfig.property_types
    : typeof taskConfig.property_type === 'string' && taskConfig.property_type.trim()
    ? [taskConfig.property_type]
    : [];
  if (rawTypes.length > 0) {
    const allowed = new Set(rawTypes.map(canonicalFilterPropType));
    const itemType = resolveItemCanonicalType(norm);
    if (!allowed.has(itemType)) {
      return { matches: false, reason: `property_type_excluded:${itemType}` };
    }
  }

  const beds = p.bedrooms != null ? Number(p.bedrooms) : null;
  const exactBeds = asNum(taskConfig.exact_beds);
  const minBeds = asNum(taskConfig.min_beds);
  const maxBeds = asNum(taskConfig.max_beds);
  if (exactBeds !== null) {
    if (beds === null || beds !== exactBeds) {
      return { matches: false, reason: `beds_mismatch:expected_${exactBeds}_got_${String(beds)}` };
    }
  } else {
    if (minBeds !== null && (beds === null || beds < minBeds)) {
      return { matches: false, reason: `below_min_beds:${String(beds)}` };
    }
    if (maxBeds !== null && (beds === null || beds > maxBeds)) {
      return { matches: false, reason: `above_max_beds:${String(beds)}` };
    }
  }

  const baths = p.bathrooms != null ? Number(p.bathrooms) : null;
  const exactBaths = asNum(taskConfig.exact_baths);
  const minBaths = asNum(taskConfig.min_baths);
  const maxBaths = asNum(taskConfig.max_baths);
  if (exactBaths !== null) {
    if (baths === null || Math.abs(baths - exactBaths) > 0.01) {
      return { matches: false, reason: `baths_mismatch:expected_${exactBaths}_got_${String(baths)}` };
    }
  } else {
    if (minBaths !== null && (baths === null || baths < minBaths)) {
      return { matches: false, reason: `below_min_baths:${String(baths)}` };
    }
    if (maxBaths !== null && (baths === null || baths > maxBaths)) {
      return { matches: false, reason: `above_max_baths:${String(baths)}` };
    }
  }

  const rent = p.monthly_rent != null ? Number(p.monthly_rent) : null;
  const minRent = asNum(taskConfig.min_rent);
  const maxRent = asNum(taskConfig.max_rent);
  if (minRent !== null && (rent === null || rent < minRent)) {
    return { matches: false, reason: `below_min_rent:${String(rent)}` };
  }
  if (maxRent !== null && (rent === null || rent > maxRent)) {
    return { matches: false, reason: `above_max_rent:${String(rent)}` };
  }

  const requiredFeatures = Array.isArray(taskConfig.required_features)
    ? taskConfig.required_features.map(asStr).filter((x): x is string => Boolean(x))
    : [];
  if (requiredFeatures.length > 0) {
    const haystack = buildFeatureSearchHaystack(p);
    for (const feat of requiredFeatures) {
      if (!textMatchesFeatureToken(haystack, feat)) {
        return { matches: false, reason: `missing_required_feature:${feat}` };
      }
    }
  }

  return { matches: true, reason: null };
}

export function scorePreferredFeatures(
  norm: Extract<NormalizeApifyResult, { ok: true }>,
  preferredFeatures: unknown,
): { score: number; matched: string[] } {
  const list = Array.isArray(preferredFeatures)
    ? preferredFeatures.map(asStr).filter((x): x is string => Boolean(x))
    : typeof preferredFeatures === 'string' && preferredFeatures.trim()
    ? preferredFeatures.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  if (list.length === 0) return { score: 0, matched: [] };

  const haystack = buildFeatureSearchHaystack(norm.pipelineInput);
  const matched: string[] = [];
  for (const feat of list) {
    if (textMatchesFeatureToken(haystack, feat)) {
      matched.push(feat);
    }
  }

  return { score: matched.length, matched };
}

export interface QuotaSelectableItem<T> {
  item: T;
  locationKey: string;
  typeKey: string;
  preferenceScore: number;
}

function normalizeLocationBucketKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ');
}

export function resolveItemLocationKey(
  norm: Extract<NormalizeApifyResult, { ok: true }>,
  configuredLocations: string[],
): string {
  const city = (norm.pipelineInput.city || '').trim().toLowerCase();
  const state = (norm.pipelineInput.state || '').trim().toLowerCase();
  const zip = (norm.pipelineInput.zip || '').trim().toLowerCase();

  for (const loc of configuredLocations) {
    const normLoc = normalizeLocationBucketKey(loc);
    if (!normLoc) continue;
    if (zip && normLoc.includes(zip)) return loc;
    if (city && normLoc.includes(city)) return loc;
  }

  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  return zip || 'default';
}

export function selectBalancedItemsByQuota<T>(
  entries: Array<QuotaSelectableItem<T>>,
  taskConfig: Record<string, unknown> = {},
  targetCount?: number | null,
): Array<QuotaSelectableItem<T>> {
  if (entries.length === 0) return [];
  const limit = targetCount && targetCount > 0 ? Math.min(targetCount, entries.length) : entries.length;

  const sorted = entries
    .map((e, idx) => ({ ...e, _idx: idx }))
    .sort((a, b) => {
      if (b.preferenceScore !== a.preferenceScore) return b.preferenceScore - a.preferenceScore;
      return a._idx - b._idx;
    });

  if (sorted.length <= limit) return sorted;

  const explicitQuotas =
    taskConfig.location_quotas && typeof taskConfig.location_quotas === 'object' && !Array.isArray(taskConfig.location_quotas)
      ? (taskConfig.location_quotas as Record<string, unknown>)
      : null;

  if (explicitQuotas) {
    const selected: Array<QuotaSelectableItem<T>> = [];
    const usedIndices = new Set<number>();

    for (const [locKey, rawCap] of Object.entries(explicitQuotas)) {
      const cap = Math.max(0, Math.round(Number(rawCap) || 0));
      if (!cap) continue;
      const targetNorm = normalizeLocationBucketKey(locKey);
      let taken = 0;
      for (const entry of sorted) {
        if (usedIndices.has(entry._idx) || selected.length >= limit) continue;
        if (normalizeLocationBucketKey(entry.locationKey) === targetNorm || normalizeLocationBucketKey(entry.locationKey).includes(targetNorm)) {
          selected.push(entry);
          usedIndices.add(entry._idx);
          taken++;
          if (taken >= cap) break;
        }
      }
    }

    for (const entry of sorted) {
      if (selected.length >= limit) break;
      if (!usedIndices.has(entry._idx)) {
        selected.push(entry);
        usedIndices.add(entry._idx);
      }
    }
    return selected;
  }

  // Round-robin balanced distribution across (locationKey | typeKey) buckets
  const buckets = new Map<string, Array<QuotaSelectableItem<T> & { _idx: number }>>();
  for (const entry of sorted) {
    const bucketKey = `${normalizeLocationBucketKey(entry.locationKey)}::${entry.typeKey}`;
    const arr = buckets.get(bucketKey) || [];
    arr.push(entry);
    buckets.set(bucketKey, arr);
  }

  if (buckets.size <= 1) {
    return sorted.slice(0, limit);
  }

  const selected: Array<QuotaSelectableItem<T>> = [];
  const bucketQueues = Array.from(buckets.values());
  let roundProgress = true;
  while (selected.length < limit && roundProgress) {
    roundProgress = false;
    for (const q of bucketQueues) {
      if (selected.length >= limit) break;
      const next = q.shift();
      if (next) {
        selected.push(next);
        roundProgress = true;
      }
    }
  }

  return selected;
}

export function buildApifyActorInput(
  rawTaskConfig: Record<string, unknown>,
  providerConfig: Record<string, unknown> = {},
  stageCtx: StageContext & { actorId?: string | null } = {},
): Record<string, unknown> {
  const taskConfig = normalizeTaskConfigAliases(rawTaskConfig);
  const actorId =
    asStr(stageCtx.actorId) ||
    asStr(taskConfig.actor_id) ||
    asStr(providerConfig.actor_id) ||
    DEFAULT_SEARCH_ACTOR_ID;

  const adapter = getApifyActorAdapter(actorId) || getApifyActorAdapter(DEFAULT_SEARCH_ACTOR_ID)!;
  const extractionDepth = stageCtx.extractionDepth || resolveExtractionDepth(taskConfig, providerConfig);

  return adapter.buildStartInput(taskConfig, providerConfig, {
    ...stageCtx,
    extractionDepth,
  });
}

function parseEditedFieldsSet(rawEdited: unknown): Set<string> {
  if (Array.isArray(rawEdited)) {
    return new Set(rawEdited.map((x) => String(x || '').trim()).filter(Boolean));
  }
  if (typeof rawEdited === 'string' && rawEdited.trim()) {
    try {
      const parsed = JSON.parse(rawEdited);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map((x) => String(x || '').trim()).filter(Boolean));
      }
    } catch {
      return new Set(rawEdited.split(',').map((s) => s.trim()).filter(Boolean));
    }
  }
  return new Set();
}

function parseStringArrayField(rawVal: unknown): string[] {
  if (Array.isArray(rawVal)) {
    return rawVal.map(asStr).filter((x): x is string => Boolean(x));
  }
  if (typeof rawVal === 'string' && rawVal.trim()) {
    try {
      const parsed = JSON.parse(rawVal);
      if (Array.isArray(parsed)) {
        return parsed.map(asStr).filter((x): x is string => Boolean(x));
      }
    } catch {
      return [];
    }
  }
  return [];
}

function parsePhotoCountField(rawVal: unknown): number {
  const parsed = safeJsonValue(rawVal);
  return Array.isArray(parsed) ? parsed.length : 0;
}

export interface Stage2MergeResult {
  patch: Record<string, unknown>;
  upgradedFields: string[];
  changed: boolean;
}

export function mergeStage2RecordWithExisting(
  existingRow: Record<string, unknown>,
  incomingRecord: Record<string, unknown>,
  options: { isStage2Detail?: boolean } = {},
): Stage2MergeResult {
  const editedFields = parseEditedFieldsSet(existingRow.edited_fields);
  const existingProv = asObj(safeJsonValue(existingRow.field_provenance) ?? existingRow.field_provenance);
  const incomingProv = asObj(safeJsonValue(incomingRecord.field_provenance) ?? incomingRecord.field_provenance);
  const incomingIsStage2 =
    options.isStage2Detail === true ||
    incomingProv.stage2_enriched === true;

  const patch: Record<string, unknown> = {};
  const upgradedFields: string[] = [];
  const mergedFull: Record<string, unknown> = { ...existingRow };

  const setPatch = (field: string, value: unknown) => {
    patch[field] = value;
    mergedFull[field] = value;
    upgradedFields.push(field);
  };

  // Phase 2 classification & normalized key tracking
  if (incomingRecord.normalized_address_key && !existingRow.normalized_address_key) {
    setPatch('normalized_address_key', incomingRecord.normalized_address_key);
  }
  if (incomingRecord.rental_eligibility_status && incomingRecord.rental_eligibility_status !== existingRow.rental_eligibility_status) {
    setPatch('rental_eligibility_status', incomingRecord.rental_eligibility_status);
  }
  if (typeof incomingRecord.is_dual_listed === 'boolean' && incomingRecord.is_dual_listed !== Boolean(existingRow.is_dual_listed)) {
    setPatch('is_dual_listed', incomingRecord.is_dual_listed);
  }
  if (incomingRecord.source_status && !editedFields.has('source_status') && existingRow.source_status !== incomingRecord.source_status) {
    setPatch('source_status', incomingRecord.source_status);
  }

  // Narrative fields: fill if missing OR upgrade truncated Stage-1 card snippet with fuller Stage-2 description
  for (const textField of ['description', 'original_description'] as const) {
    if (editedFields.has(textField)) continue;
    const incVal = asStr(incomingRecord[textField]);
    const extVal = asStr(existingRow[textField]);
    if (incVal && (!extVal || (incomingIsStage2 && incVal.length > extVal.length))) {
      setPatch(textField, incVal);
    }
  }

  // Bathroom decimal precision preservation
  if (!editedFields.has('bathrooms')) {
    const extBath = asNum(existingRow.bathrooms);
    const incBath = asNum(incomingRecord.bathrooms);
    if (incBath !== null && (extBath === null || (Number.isInteger(extBath) && !Number.isInteger(incBath)))) {
      setPatch('bathrooms', incBath);
      if (!editedFields.has('total_bathrooms')) {
        setPatch('total_bathrooms', incBath);
      }
    }
  }

  // JSON array string fields: union when empty or Stage-2 enriches additional items
  for (const arrField of ['amenities', 'appliances', 'utilities_included', 'flooring'] as const) {
    if (editedFields.has(arrField)) continue;
    const extArr = parseStringArrayField(existingRow[arrField]);
    const incArr = parseStringArrayField(incomingRecord[arrField]);
    if (incArr.length === 0) continue;
    const seenLower = new Set(extArr.map((x) => x.toLowerCase()));
    const combined = [...extArr];
    let added = false;
    for (const item of incArr) {
      if (!seenLower.has(item.toLowerCase())) {
        seenLower.add(item.toLowerCase());
        combined.push(item);
        added = true;
      }
    }
    if (extArr.length === 0 || (incomingIsStage2 && added)) {
      setPatch(arrField, JSON.stringify(combined));
    }
  }

  // Photo list: fill if missing, Stage-2 recovered more photos, or Stage-2 upgrades low-res Stage-1 thumbnails (strict original order preserved)
  if (!editedFields.has('original_image_urls')) {
    const extPhotos = parseStringArrayField(
      (safeJsonValue(existingRow.original_image_urls) as unknown[] | null)?.map((x) =>
        typeof x === 'string' ? x : (asObj(x).url || ''),
      ) || [],
    );
    const incPhotos = parseStringArrayField(
      (safeJsonValue(incomingRecord.original_image_urls) as unknown[] | null)?.map((x) =>
        typeof x === 'string' ? x : (asObj(x).url || ''),
      ) || [],
    );
    const extCount = parsePhotoCountField(existingRow.original_image_urls);
    const incCount = parsePhotoCountField(incomingRecord.original_image_urls);
    const extThumbs = extPhotos.filter((u) => isSmallZillowThumbnail(u)).length;
    const incThumbs = incPhotos.filter((u) => isSmallZillowThumbnail(u)).length;
    const extHighRes = extPhotos.filter((u) => isFullZillowHighRes(u)).length;
    const incHighRes = incPhotos.filter((u) => isFullZillowHighRes(u)).length;
    const stage2BetterResolution =
      incomingIsStage2 &&
      incCount >= extCount &&
      (incThumbs < extThumbs || incHighRes > extHighRes || (extThumbs > 0 && incPhotos[0] !== extPhotos[0]));

    if (incCount > 0 && (extCount === 0 || (incomingIsStage2 && (incCount > extCount || stage2BetterResolution)))) {
      setPatch('original_image_urls', incomingRecord.original_image_urls);
      patch.photo_upload_status = 'complete';
    }
  }

  // General enrichable scalar & JSONB fields (never overwrite edited_fields)
  const enrichableFields = [
    'source_url',
    'unit_number',
    'county',
    'neighborhood',
    'lat',
    'lng',
    'location_context',
    'property_type',
    'property_subtype',
    'bedrooms',
    'half_bathrooms',
    'square_footage',
    'lot_size_sqft',
    'year_built',
    'floors',
    'garage_spaces',
    'total_units',
    'has_basement',
    'has_central_air',
    'virtual_tour_url',
    'monthly_rent',
    'original_monthly_rent',
    'parking',
    'ev_charging',
    'heating_type',
    'cooling_type',
    'laundry_type',
    'agent_name',
    'broker_name',
    'hoa_fee',
    'hoa_fee_frequency',
    'parking_fee',
    'admin_fee',
    'structural_details',
    'utility_details',
    'financial_details',
    'location_details',
    'source_facts_ledger',
    'unmapped_attributes',
    'floor_plans',
    'videos',
  ] as const;

  for (const field of enrichableFields) {
    if (editedFields.has(field)) continue;
    const incVal = incomingRecord[field];
    if (isEmpty(incVal)) continue;
    const extVal = existingRow[field];
    const extEmpty =
      isEmpty(extVal) ||
      (typeof extVal === 'object' && extVal !== null && !Array.isArray(extVal) && Object.keys(extVal as Record<string, unknown>).length === 0);
    if (
      extEmpty ||
      (incomingIsStage2 &&
        (field === 'structural_details' ||
          field === 'utility_details' ||
          field === 'financial_details' ||
          field === 'location_details' ||
          field === 'source_facts_ledger' ||
          field === 'unmapped_attributes'))
    ) {
      setPatch(field, incVal);
    }
  }

  const shouldRefreshPayload = incomingIsStage2 && Boolean(incomingRecord.source_raw_payload);
  if (shouldRefreshPayload) {
    patch.source_raw_payload = incomingRecord.source_raw_payload;
    mergedFull.source_raw_payload = incomingRecord.source_raw_payload;
  }

  const changed = upgradedFields.length > 0 || shouldRefreshPayload;
  if (changed) {
    const nowIso = new Date().toISOString();
    patch.field_provenance = {
      ...existingProv,
      ...incomingProv,
      stage1_imported_at: existingProv.stage1_imported_at ?? existingProv.imported_at ?? null,
      stage2_enriched: Boolean(existingProv.stage2_enriched) || incomingIsStage2,
      upgraded_at: nowIso,
      upgraded_fields: upgradedFields,
    };
    patch.updated_at = nowIso;
    patch.data_quality_score = qualityScore(mergedFull);
    patch.missing_fields = missingFields(mergedFull);
  }

  return { patch, upgradedFields, changed };
}
