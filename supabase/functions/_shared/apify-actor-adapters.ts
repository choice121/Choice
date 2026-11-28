// ============================================================================
// Choice Properties — Apify Zillow Actor Adapter Registry & Query Planner
// ============================================================================
// Phase 1: Decouples Zillow search/detail invocation from hardcoded payloads.
//
// Production Default (Priority 1):
//   Stage 1: maxcopell/zillow-scraper         (searchUrls + ?searchQueryState + resultsLimit)
//   Stage 2: maxcopell/zillow-detail-scraper  (startUrls/dataset + propertyStatus: "FOR_RENT")
//
// Experimental Actors (Strictly Non-Default — Explicit Opt-In Only):
//   - igolaizola/zillow-scraper-ppe
//   - automation_craft/zillow-scraper
//   - cliqtomedia/zillow-scraper
// ============================================================================

export const ACTOR_ID_RE = /^[a-zA-Z0-9._~-]{1,80}(?:\/[a-zA-Z0-9._~-]{1,80})?$/;
export const DEFAULT_SEARCH_ACTOR_ID = 'maxcopell/zillow-scraper';
export const DEFAULT_DETAIL_ACTOR_ID = 'maxcopell/zillow-detail-scraper';

export type ScrapeStage = 'single' | 'search' | 'detail';
export type ExtractionDepth = 'full_data' | 'with_insights';

export interface ZillowMapBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

export interface StageContext {
  stage?: ScrapeStage;
  searchResultsDatasetId?: string | null;
  detailUrls?: string[];
  extractionDepth?: ExtractionDepth;
  resolvedBoundsByLocation?: Record<string, ZillowMapBounds>;
}

export interface AdapterValidationResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export interface ApifyActorAdapter {
  key: string;
  actorId: string;
  role: 'search' | 'detail' | 'unified';
  isExperimental: boolean;
  supportsTwoStageDetail: boolean;
  defaultDetailActorId?: string;
  supportsInsightsToggle: boolean;
  buildStartInput: (
    taskConfig: Record<string, unknown>,
    providerConfig?: Record<string, unknown>,
    stageCtx?: StageContext,
  ) => Record<string, unknown>;
  validateInput: (input: Record<string, unknown>) => AdapterValidationResult;
}

export interface ActorSelectionResult {
  ok: boolean;
  status: number;
  error?: string;
  message?: string;
  adapter?: ApifyActorAdapter;
  actorId?: string;
  actorSlug?: string;
  twoStageEnabled?: boolean;
  detailActorId?: string | null;
  scrapeStage?: ScrapeStage;
  extractionDepth?: ExtractionDepth;
}

const ZILLOW_HOSTS = new Set(['zillow.com', 'www.zillow.com']);

const SALE_ONLY_STATUSES = new Set([
  'FOR_SALE',
  'SOLD',
  'RECENTLY_SOLD',
  'PENDING_SALE',
  'CONTINGENT',
  'AUCTION',
  'FORECLOSURE',
  'OFF_MARKET',
  'LEASED',
  'RENTED',
]);

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

export function slugifyLocationForZillow(location: string): string {
  return location
    .trim()
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function normalizeCanonicalPropertyTypeFilter(raw: unknown): string {
  const s = String(raw ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!s) return 'SINGLE_FAMILY';
  if (['SINGLE_FAMILY', 'SFH', 'HOUSE', 'SINGLE_FAMILY_HOME', 'DETACHED'].includes(s)) return 'SINGLE_FAMILY';
  if (['TOWNHOUSE', 'TOWNHOME', 'TOWNHOMES', 'ROW_HOUSE', 'ROWHOUSE'].includes(s)) return 'TOWNHOUSE';
  if (['DUPLEX', 'HALF_DUPLEX', '1/2_DUPLEX', 'TWO_FAMILY', 'MULTI_FAMILY', 'MULTIFAMILY'].includes(s)) return 'DUPLEX';
  if (['APARTMENT', 'APT', 'FLAT'].includes(s)) return 'APARTMENT';
  if (['CONDO', 'CONDOMINIUM'].includes(s)) return 'CONDO';
  return s;
}

export function resolveConfiguredLocations(taskConfig: Record<string, unknown>): string[] {
  if (Array.isArray(taskConfig.locations)) {
    return taskConfig.locations.map(asStr).filter((x): x is string => Boolean(x)).slice(0, 10);
  }
  const single = asStr(taskConfig.location) || asStr(taskConfig.target_market);
  return single ? [single] : [];
}

export function computeScrapeHeadroomLimit(taskConfig: Record<string, unknown>): number {
  const explicitScrapeLimit =
    taskConfig.scrape_limit !== undefined && taskConfig.scrape_limit !== null
      ? Number(taskConfig.scrape_limit)
      : null;
  const targetQtyRaw = Number(taskConfig.target_qty ?? taskConfig.target_quantity ?? 25);
  const safeTargetQty = Number.isFinite(targetQtyRaw) ? Math.max(Math.round(targetQtyRaw), 1) : 25;

  const exactBedsVal = asNum(taskConfig.exact_beds);
  const maxBedsVal = asNum(taskConfig.max_beds);
  const exactBathsVal = asNum(taskConfig.exact_baths);
  const maxBathsVal = asNum(taskConfig.max_baths);

  const hasPostScrapeFilters = Boolean(
    taskConfig.owner_only === true ||
      (Array.isArray(taskConfig.property_types) && taskConfig.property_types.length > 0) ||
      (typeof taskConfig.property_type === 'string' && taskConfig.property_type.trim()) ||
      exactBedsVal !== null ||
      maxBedsVal !== null ||
      exactBathsVal !== null ||
      maxBathsVal !== null ||
      (Array.isArray(taskConfig.required_features) && taskConfig.required_features.length > 0) ||
      (Array.isArray(taskConfig.preferred_features) && taskConfig.preferred_features.length > 0) ||
      (Array.isArray(taskConfig.locations) && taskConfig.locations.length > 1),
  );

  const computedLimit =
    explicitScrapeLimit !== null && Number.isFinite(explicitScrapeLimit)
      ? explicitScrapeLimit
      : hasPostScrapeFilters
      ? Math.min(safeTargetQty * 3, 200)
      : safeTargetQty;

  return Number.isFinite(computedLimit) ? Math.min(Math.max(Math.round(computedLimit), 1), 200) : 25;
}

export function buildZillowSearchQueryState(taskConfig: Record<string, unknown>): Record<string, unknown> {
  const minRent = asNum(taskConfig.min_rent);
  const maxRent = asNum(taskConfig.max_rent);
  const exactBeds = asNum(taskConfig.exact_beds);
  const minBeds = asNum(taskConfig.min_beds);
  const maxBeds = asNum(taskConfig.max_beds);
  const exactBaths = asNum(taskConfig.exact_baths);
  const minBaths = asNum(taskConfig.min_baths);

  const filterState: Record<string, unknown> = {
    isForRent: { value: true },
    isForSaleByAgent: { value: false },
    isForSaleByOwner: { value: false },
    isNewConstruction: { value: false },
    isAuction: { value: false },
    isForSaleForeclosure: { value: false },
    isComingSoon: { value: false },
  };

  if (minRent !== null || maxRent !== null) {
    filterState.monthlyPayment = {
      ...(minRent !== null && minRent > 0 ? { min: Math.round(minRent) } : {}),
      ...(maxRent !== null && maxRent > 0 ? { max: Math.round(maxRent) } : {}),
    };
  }

  if (exactBeds !== null) {
    filterState.beds = { min: exactBeds, max: exactBeds };
  } else if (minBeds !== null || maxBeds !== null) {
    filterState.beds = {
      ...(minBeds !== null ? { min: minBeds } : {}),
      ...(maxBeds !== null ? { max: maxBeds } : {}),
    };
  }

  if (exactBaths !== null) {
    filterState.baths = { min: exactBaths };
  } else if (minBaths !== null) {
    filterState.baths = { min: minBaths };
  }

  const rawTypes = Array.isArray(taskConfig.property_types)
    ? taskConfig.property_types
    : typeof taskConfig.property_type === 'string' && taskConfig.property_type.trim()
    ? [taskConfig.property_type]
    : [];
  if (rawTypes.length > 0) {
    const allowed = new Set(rawTypes.map(normalizeCanonicalPropertyTypeFilter));
    filterState.isSingleFamily = { value: allowed.has('SINGLE_FAMILY') };
    filterState.isTownhouse = { value: allowed.has('TOWNHOUSE') };
    filterState.isMultiFamily = { value: allowed.has('DUPLEX') };
    filterState.isApartment = { value: allowed.has('APARTMENT') };
    filterState.isApartmentOrCondo = { value: allowed.has('APARTMENT') || allowed.has('CONDO') };
    filterState.isCondo = { value: allowed.has('CONDO') };
    filterState.isLotLand = { value: false };
    filterState.isManufactured = { value: false };
  }

  if (taskConfig.owner_only === true) {
    filterState.isForRentByOwner = { value: true };
  }

  const explicitBounds = (() => {
    const raw = (taskConfig.map_bounds ?? taskConfig.mapBounds) as Record<string, unknown> | undefined;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const west = asNum(raw.west);
    const east = asNum(raw.east);
    const south = asNum(raw.south);
    const north = asNum(raw.north);
    if (west === null || east === null || south === null || north === null) return null;
    return { west, east, south, north };
  })();

  const boundsToUse =
    (taskConfig.__resolvedMapBounds as ZillowMapBounds | undefined) ||
    explicitBounds;
  const usersSearchTerm = asStr(taskConfig.__usersSearchTerm);

  return {
    pagination: {},
    isMapVisible: true,
    isListVisible: true,
    ...(boundsToUse ? { mapBounds: boundsToUse, mapZoom: 11 } : {}),
    ...(usersSearchTerm ? { usersSearchTerm } : {}),
    filterState,
  };
}

function expandBoundsByRadiusMiles(
  lat: number,
  lng: number,
  radiusMiles: number,
  baseBounds?: ZillowMapBounds | null,
): ZillowMapBounds {
  const latDelta = Math.max(radiusMiles / 69.0, 0.08);
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
  const lngDelta = Math.max(radiusMiles / (69.0 * cosLat), 0.08);
  const radial: ZillowMapBounds = {
    west: Number((lng - lngDelta).toFixed(6)),
    east: Number((lng + lngDelta).toFixed(6)),
    south: Number((lat - latDelta).toFixed(6)),
    north: Number((lat + latDelta).toFixed(6)),
  };
  if (!baseBounds) return radial;
  return {
    west: Math.min(baseBounds.west, radial.west),
    east: Math.max(baseBounds.east, radial.east),
    south: Math.min(baseBounds.south, radial.south),
    north: Math.max(baseBounds.north, radial.north),
  };
}

function normalizeResolvedBounds(
  bbox: { west: number; east: number; south: number; north: number; lat?: number; lng?: number },
  radiusMiles?: number | null,
): ZillowMapBounds {
  const rawBounds: ZillowMapBounds = {
    west: Number(bbox.west.toFixed(6)),
    east: Number(bbox.east.toFixed(6)),
    south: Number(bbox.south.toFixed(6)),
    north: Number(bbox.north.toFixed(6)),
  };
  const centerLat = bbox.lat ?? (rawBounds.south + rawBounds.north) / 2;
  const centerLng = bbox.lng ?? (rawBounds.west + rawBounds.east) / 2;
  if (radiusMiles && radiusMiles > 0) {
    return expandBoundsByRadiusMiles(centerLat, centerLng, radiusMiles, rawBounds);
  }
  // Ensure minimum ~0.12 degree span for tiny towns/ZIPs so Zillow finds listings around the municipality
  const latSpan = Math.abs(rawBounds.north - rawBounds.south);
  const lngSpan = Math.abs(rawBounds.east - rawBounds.west);
  if (latSpan < 0.12 || lngSpan < 0.12) {
    return expandBoundsByRadiusMiles(centerLat, centerLng, 8, rawBounds);
  }
  return rawBounds;
}

export async function resolveZillowLocationBounds(
  location: string,
  options: {
    geoapifyApiKey?: string | null;
    searchRadiusMiles?: number | null;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<ZillowMapBounds | null> {
  const clean = location.trim();
  if (!clean) return null;
  const doFetch = options.fetchImpl || fetch;
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 4500, 1000), 10_000);
  const radius = options.searchRadiusMiles && options.searchRadiusMiles > 0 ? options.searchRadiusMiles : null;

  // 1. Geoapify forward geocoding (fast, reliable, has structured bbox)
  const geoKey = (options.geoapifyApiKey || '').trim();
  if (geoKey) {
    try {
      const u = new URL('https://api.geoapify.com/v1/geocode/search');
      u.searchParams.set('text', clean);
      u.searchParams.set('filter', 'countrycode:us');
      u.searchParams.set('format', 'json');
      u.searchParams.set('limit', '1');
      u.searchParams.set('apiKey', geoKey);
      const res = await doFetch(u.toString(), { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) {
        const data = await res.json();
        const hit = Array.isArray(data?.results) ? data.results[0] : null;
        const bbox = hit?.bbox;
        if (
          bbox &&
          Number.isFinite(Number(bbox.lon1)) &&
          Number.isFinite(Number(bbox.lon2)) &&
          Number.isFinite(Number(bbox.lat1)) &&
          Number.isFinite(Number(bbox.lat2))
        ) {
          return normalizeResolvedBounds(
            {
              west: Math.min(Number(bbox.lon1), Number(bbox.lon2)),
              east: Math.max(Number(bbox.lon1), Number(bbox.lon2)),
              south: Math.min(Number(bbox.lat1), Number(bbox.lat2)),
              north: Math.max(Number(bbox.lat1), Number(bbox.lat2)),
              lat: Number.isFinite(Number(hit.lat)) ? Number(hit.lat) : undefined,
              lng: Number.isFinite(Number(hit.lon)) ? Number(hit.lon) : undefined,
            },
            radius,
          );
        }
        if (hit && Number.isFinite(Number(hit.lat)) && Number.isFinite(Number(hit.lon))) {
          return expandBoundsByRadiusMiles(Number(hit.lat), Number(hit.lon), radius ?? 12);
        }
      }
    } catch {
      // Fall through to Nominatim
    }
  }

  // 2. OpenStreetMap Nominatim fallback (keyless, returns [south, north, west, east])
  try {
    const nu = new URL('https://nominatim.openstreetmap.org/search');
    nu.searchParams.set('format', 'json');
    nu.searchParams.set('limit', '1');
    nu.searchParams.set('countrycodes', 'us');
    nu.searchParams.set('q', clean);
    const nRes = await doFetch(nu.toString(), {
      headers: { 'User-Agent': 'ChoicePropertiesGeocoder/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (nRes.ok) {
      const arr = await nRes.json();
      const first = Array.isArray(arr) ? arr[0] : null;
      const bb = Array.isArray(first?.boundingbox) ? first.boundingbox : null;
      if (bb && bb.length >= 4) {
        const south = Number(bb[0]);
        const north = Number(bb[1]);
        const west = Number(bb[2]);
        const east = Number(bb[3]);
        if ([south, north, west, east].every((n) => Number.isFinite(n))) {
          return normalizeResolvedBounds(
            {
              west: Math.min(west, east),
              east: Math.max(west, east),
              south: Math.min(south, north),
              north: Math.max(south, north),
              lat: Number.isFinite(Number(first.lat)) ? Number(first.lat) : undefined,
              lng: Number.isFinite(Number(first.lon)) ? Number(first.lon) : undefined,
            },
            radius,
          );
        }
      }
      if (first && Number.isFinite(Number(first.lat)) && Number.isFinite(Number(first.lon))) {
        return expandBoundsByRadiusMiles(Number(first.lat), Number(first.lon), radius ?? 12);
      }
    }
  } catch {
    // Non-fatal fallback without mapBounds
  }

  return null;
}

export function extractLocationFromZillowSearchUrl(u: URL): string | null {
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0].toLowerCase();
  if (
    !first ||
    first === 'homes' ||
    first === 'homedetails' ||
    first === 'b' ||
    first === 'apartments' ||
    first === 'rentals'
  ) {
    return null;
  }
  return first.replace(/-+/g, ' ').trim() || null;
}

export async function resolveBoundsMapForLocations(
  taskConfig: Record<string, unknown>,
  options: { geoapifyApiKey?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<Record<string, ZillowMapBounds>> {
  const locations = resolveConfiguredLocations(taskConfig);
  const urlLocations: string[] = [];
  if (Array.isArray(taskConfig.search_urls)) {
    for (const rawUrl of taskConfig.search_urls) {
      if (typeof rawUrl !== 'string') continue;
      try {
        const u = new URL(rawUrl.trim());
        if (u.protocol === 'https:' && ZILLOW_HOSTS.has(u.hostname.toLowerCase()) && !u.searchParams.has('searchQueryState')) {
          const extracted = extractLocationFromZillowSearchUrl(u);
          if (extracted && !locations.some((l) => l.toLowerCase() === extracted.toLowerCase())) {
            urlLocations.push(extracted);
          }
        }
      } catch {
        // ignore invalid URLs
      }
    }
  }
  const allLocations = Array.from(new Set([...locations, ...urlLocations]));
  const radius = asNum(taskConfig.search_radius_miles);
  const out: Record<string, ZillowMapBounds> = {};
  if (allLocations.length === 0) return out;

  await Promise.all(
    allLocations.map(async (loc) => {
      const b = await resolveZillowLocationBounds(loc, {
        geoapifyApiKey: options.geoapifyApiKey,
        searchRadiusMiles: radius,
        fetchImpl: options.fetchImpl,
      });
      if (b) out[loc] = b;
    }),
  );
  return out;
}

function findBoundsForLocationOrUrl(
  boundsByLocation: Record<string, ZillowMapBounds>,
  key: string | null,
): { bounds: ZillowMapBounds; label: string } | null {
  if (!key) return null;
  if (boundsByLocation[key]) return { bounds: boundsByLocation[key], label: key };
  const normalizedKey = slugifyLocationForZillow(key);
  for (const [k, b] of Object.entries(boundsByLocation)) {
    if (slugifyLocationForZillow(k) === normalizedKey || k.toLowerCase() === key.toLowerCase()) {
      return { bounds: b, label: k };
    }
  }
  return null;
}

export function buildValidatedZillowSearchUrls(
  taskConfig: Record<string, unknown>,
  boundsByLocation: Record<string, ZillowMapBounds> = {},
): Array<{ url: string }> {
  const validatedUrls: Array<{ url: string }> = [];
  if (Array.isArray(taskConfig.search_urls)) {
    for (const rawUrl of taskConfig.search_urls) {
      if (typeof rawUrl !== 'string') continue;
      try {
        const u = new URL(rawUrl.trim());
        if (u.protocol === 'https:' && ZILLOW_HOSTS.has(u.hostname.toLowerCase()) && !u.username && !u.password) {
          if (!u.searchParams.has('searchQueryState')) {
            const urlLoc = extractLocationFromZillowSearchUrl(u);
            const matched = findBoundsForLocationOrUrl(boundsByLocation, urlLoc);
            if (matched) {
              const queryState = buildZillowSearchQueryState({
                ...taskConfig,
                __resolvedMapBounds: matched.bounds,
                __usersSearchTerm: matched.label,
              });
              u.searchParams.set('searchQueryState', JSON.stringify(queryState));
            }
          }
          validatedUrls.push({ url: u.toString() });
        }
      } catch {
        // ignore invalid URLs
      }
    }
  }

  if (validatedUrls.length > 0) return validatedUrls;

  const locations = resolveConfiguredLocations(taskConfig);

  for (const loc of locations) {
    const slug = slugifyLocationForZillow(loc);
    if (!slug) continue;
    const locBounds = findBoundsForLocationOrUrl(boundsByLocation, loc)?.bounds;
    const queryState = buildZillowSearchQueryState({
      ...taskConfig,
      ...(locBounds ? { __resolvedMapBounds: locBounds } : {}),
      __usersSearchTerm: loc,
    });
    const encodedQs = encodeURIComponent(JSON.stringify(queryState));
    validatedUrls.push({
      url: `https://www.zillow.com/${slug}/rentals/?searchQueryState=${encodedQs}`,
    });
  }

  return validatedUrls;
}

function sanitizeZillowDetailUrl(raw: unknown): string | null {
  const s = asStr(raw);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' || !ZILLOW_HOSTS.has(u.hostname.toLowerCase()) || u.username || u.password) {
      return null;
    }
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

function mapHomeTypesForActor(taskConfig: Record<string, unknown>): string[] | undefined {
  const rawTypes = Array.isArray(taskConfig.property_types)
    ? taskConfig.property_types
    : typeof taskConfig.property_type === 'string' && taskConfig.property_type.trim()
    ? [taskConfig.property_type]
    : [];
  if (rawTypes.length === 0) return undefined;

  const out = new Set<string>();
  for (const rt of rawTypes) {
    const canonical = normalizeCanonicalPropertyTypeFilter(rt);
    if (canonical === 'SINGLE_FAMILY') out.add('Houses');
    else if (canonical === 'TOWNHOUSE') out.add('Townhomes');
    else if (canonical === 'DUPLEX') out.add('Multi-family');
    else if (canonical === 'APARTMENT') out.add('Apartments');
    else if (canonical === 'CONDO') out.add('Condos');
  }
  return out.size > 0 ? Array.from(out) : undefined;
}

const maxcopellSearchAdapter: ApifyActorAdapter = {
  key: 'maxcopell_search',
  actorId: DEFAULT_SEARCH_ACTOR_ID,
  role: 'search',
  isExperimental: false,
  supportsTwoStageDetail: true,
  defaultDetailActorId: DEFAULT_DETAIL_ACTOR_ID,
  supportsInsightsToggle: false,
  buildStartInput(taskConfig, providerConfig = {}, stageCtx = {}) {
    const searchUrls = buildValidatedZillowSearchUrls(taskConfig, stageCtx.resolvedBoundsByLocation || {});
    const resultsLimit = computeScrapeHeadroomLimit(taskConfig);
    return {
      searchUrls,
      resultsLimit,
      extractionMethod: asStr(providerConfig.extractionMethod) || 'PAGINATION',
    };
  },
  validateInput(input) {
    if (!Array.isArray(input.searchUrls) || input.searchUrls.length === 0) {
      return {
        ok: false,
        error: 'target_locations_or_zillow_urls_required',
        message: 'Provide locations or valid https://www.zillow.com search URLs.',
      };
    }
    return { ok: true };
  },
};

const maxcopellDetailAdapter: ApifyActorAdapter = {
  key: 'maxcopell_detail',
  actorId: DEFAULT_DETAIL_ACTOR_ID,
  role: 'detail',
  isExperimental: false,
  supportsTwoStageDetail: false,
  supportsInsightsToggle: false,
  buildStartInput(taskConfig, _providerConfig = {}, stageCtx = {}) {
    const explicitUrls = [
      ...(Array.isArray(stageCtx.detailUrls) ? stageCtx.detailUrls : []),
      ...(Array.isArray(taskConfig.detail_urls) ? taskConfig.detail_urls : []),
    ]
      .map(sanitizeZillowDetailUrl)
      .filter((x): x is string => Boolean(x));

    const uniqueUrls = Array.from(new Set(explicitUrls));
    const datasetId = asStr(stageCtx.searchResultsDatasetId);

    return {
      ...(uniqueUrls.length > 0
        ? { startUrls: uniqueUrls.map((url) => ({ url })) }
        : datasetId
        ? { searchResultsDatasetId: datasetId }
        : {}),
      propertyStatus: 'FOR_RENT',
      extractBuildingUnits: 'disabled',
    };
  },
  validateInput(input) {
    if (input.propertyStatus !== 'FOR_RENT') {
      return {
        ok: false,
        error: 'rental_status_lock_missing',
        message: 'maxcopell/zillow-detail-scraper must enforce propertyStatus: "FOR_RENT".',
      };
    }
    const hasUrls = Array.isArray(input.startUrls) && input.startUrls.length > 0;
    const hasDataset = typeof input.searchResultsDatasetId === 'string' && input.searchResultsDatasetId.trim().length > 0;
    if (!hasUrls && !hasDataset) {
      return {
        ok: false,
        error: 'detail_targets_required',
        message: 'Provide startUrls or searchResultsDatasetId for detail scraping.',
      };
    }
    return { ok: true };
  },
};

const igolaizolaAdapter: ApifyActorAdapter = {
  key: 'igolaizola_ppe',
  actorId: 'igolaizola/zillow-scraper-ppe',
  role: 'unified',
  isExperimental: true,
  supportsTwoStageDetail: false,
  supportsInsightsToggle: false,
  buildStartInput(taskConfig) {
    const locations = resolveConfiguredLocations(taskConfig);
    const maxItems = computeScrapeHeadroomLimit(taskConfig);
    const minRent = asNum(taskConfig.min_rent);
    const maxRent = asNum(taskConfig.max_rent);
    const exactBeds = asNum(taskConfig.exact_beds);
    const minBeds = asNum(taskConfig.min_beds);
    const maxBeds = asNum(taskConfig.max_beds);
    const exactBaths = asNum(taskConfig.exact_baths);
    const minBaths = asNum(taskConfig.min_baths);
    const maxBaths = asNum(taskConfig.max_baths);
    const homeTypes = mapHomeTypesForActor(taskConfig);

    return {
      locations,
      operation: 'rent',
      maxItems,
      fetchDetails: true,
      ...(minRent !== null ? { minPrice: Math.round(minRent) } : {}),
      ...(maxRent !== null ? { maxPrice: Math.round(maxRent) } : {}),
      ...(exactBeds !== null
        ? { minBeds: exactBeds, maxBeds: exactBeds }
        : {
            ...(minBeds !== null ? { minBeds } : {}),
            ...(maxBeds !== null ? { maxBeds } : {}),
          }),
      ...(exactBaths !== null
        ? { minBaths: exactBaths, maxBaths: exactBaths }
        : {
            ...(minBaths !== null ? { minBaths } : {}),
            ...(maxBaths !== null ? { maxBaths } : {}),
          }),
      ...(homeTypes ? { homeTypes } : {}),
      ...(taskConfig.owner_only === true ? { ownerPosted: true } : {}),
    };
  },
  validateInput(input) {
    if (input.operation !== 'rent') {
      return { ok: false, error: 'rental_status_lock_missing', message: 'operation must be "rent".' };
    }
    if (!Array.isArray(input.locations) || input.locations.length === 0) {
      return { ok: false, error: 'target_locations_required', message: 'Provide locations for igolaizola actor.' };
    }
    return { ok: true };
  },
};

const automationCraftAdapter: ApifyActorAdapter = {
  key: 'automation_craft',
  actorId: 'automation_craft/zillow-scraper',
  role: 'unified',
  isExperimental: true,
  supportsTwoStageDetail: false,
  supportsInsightsToggle: true,
  buildStartInput(taskConfig, _providerConfig = {}, stageCtx = {}) {
    const locations = resolveConfiguredLocations(taskConfig);
    const searchUrls = locations.length === 0 ? buildValidatedZillowSearchUrls(taskConfig).map((u) => u.url) : [];
    const maxItems = computeScrapeHeadroomLimit(taskConfig);
    const minRent = asNum(taskConfig.min_rent);
    const maxRent = asNum(taskConfig.max_rent);
    const exactBeds = asNum(taskConfig.exact_beds);
    const minBeds = asNum(taskConfig.min_beds);
    const maxBeds = asNum(taskConfig.max_beds);
    const exactBaths = asNum(taskConfig.exact_baths);
    const minBaths = asNum(taskConfig.min_baths);
    const homeTypes = mapHomeTypesForActor(taskConfig);

    return {
      ...(locations.length > 0 ? { locations } : { searchUrls }),
      listingStatus: 'forRent',
      maxItems,
      includeDetails: true,
      includeInsights: stageCtx.extractionDepth === 'with_insights',
      ...(minRent !== null ? { minPrice: Math.round(minRent) } : {}),
      ...(maxRent !== null ? { maxPrice: Math.round(maxRent) } : {}),
      ...(exactBeds !== null
        ? { minBeds: exactBeds, maxBeds: exactBeds }
        : {
            ...(minBeds !== null ? { minBeds } : {}),
            ...(maxBeds !== null ? { maxBeds } : {}),
          }),
      ...(exactBaths !== null
        ? { minBaths: exactBaths }
        : minBaths !== null
        ? { minBaths }
        : {}),
      ...(homeTypes ? { homeTypes } : {}),
      ...(taskConfig.owner_only === true ? { rentByOwner: true } : {}),
    };
  },
  validateInput(input) {
    if (input.listingStatus !== 'forRent') {
      return { ok: false, error: 'rental_status_lock_missing', message: 'listingStatus must be "forRent".' };
    }
    const hasLoc = Array.isArray(input.locations) && input.locations.length > 0;
    const hasUrls = Array.isArray(input.searchUrls) && input.searchUrls.length > 0;
    if (!hasLoc && !hasUrls) {
      return { ok: false, error: 'target_locations_or_zillow_urls_required', message: 'Provide locations or searchUrls.' };
    }
    return { ok: true };
  },
};

const cliqtomediaAdapter: ApifyActorAdapter = {
  key: 'cliqtomedia',
  actorId: 'cliqtomedia/zillow-scraper',
  role: 'unified',
  isExperimental: true,
  supportsTwoStageDetail: false,
  supportsInsightsToggle: true,
  buildStartInput(taskConfig, _providerConfig = {}, stageCtx = {}) {
    const locations = resolveConfiguredLocations(taskConfig);
    const searchUrls = locations.length === 0 ? buildValidatedZillowSearchUrls(taskConfig).map((u) => u.url) : [];
    const maxItems = computeScrapeHeadroomLimit(taskConfig);
    const minRent = asNum(taskConfig.min_rent);
    const maxRent = asNum(taskConfig.max_rent);
    const exactBeds = asNum(taskConfig.exact_beds);
    const minBeds = asNum(taskConfig.min_beds);
    const maxBeds = asNum(taskConfig.max_beds);
    const exactBaths = asNum(taskConfig.exact_baths);
    const minBaths = asNum(taskConfig.min_baths);
    const homeTypes = mapHomeTypesForActor(taskConfig);

    return {
      mode: 'search',
      ...(locations.length > 0 ? { locations } : { searchUrls }),
      status: 'forRent',
      outputFormat: 'json',
      maxItems,
      includeDetails: true,
      includeWalkScore: stageCtx.extractionDepth === 'with_insights',
      includeNearbyHomes: false,
      ...(minRent !== null ? { minPrice: Math.round(minRent) } : {}),
      ...(maxRent !== null ? { maxPrice: Math.round(maxRent) } : {}),
      ...(exactBeds !== null
        ? { minBeds: exactBeds, maxBeds: exactBeds }
        : {
            ...(minBeds !== null ? { minBeds } : {}),
            ...(maxBeds !== null ? { maxBeds } : {}),
          }),
      ...(exactBaths !== null
        ? { minBaths: exactBaths }
        : minBaths !== null
        ? { minBaths }
        : {}),
      ...(homeTypes ? { homeTypes } : {}),
      ...(taskConfig.owner_only === true ? { ownerPosted: true } : {}),
    };
  },
  validateInput(input) {
    if (input.status !== 'forRent') {
      return { ok: false, error: 'rental_status_lock_missing', message: 'status must be "forRent".' };
    }
    const hasLoc = Array.isArray(input.locations) && input.locations.length > 0;
    const hasUrls = Array.isArray(input.searchUrls) && input.searchUrls.length > 0;
    if (!hasLoc && !hasUrls) {
      return { ok: false, error: 'target_locations_or_zillow_urls_required', message: 'Provide locations or searchUrls.' };
    }
    return { ok: true };
  },
};

export const APIFY_ACTOR_ADAPTERS: Record<string, ApifyActorAdapter> = {
  [DEFAULT_SEARCH_ACTOR_ID]: maxcopellSearchAdapter,
  [DEFAULT_DETAIL_ACTOR_ID]: maxcopellDetailAdapter,
  'igolaizola/zillow-scraper-ppe': igolaizolaAdapter,
  'automation_craft/zillow-scraper': automationCraftAdapter,
  'cliqtomedia/zillow-scraper': cliqtomediaAdapter,
};

export function getApifyActorAdapter(actorId: string): ApifyActorAdapter | null {
  return APIFY_ACTOR_ADAPTERS[actorId.trim()] || null;
}

export function resolveExtractionDepth(
  taskConfig: Record<string, unknown> = {},
  providerConfig: Record<string, unknown> = {},
): ExtractionDepth {
  const rawDepth = typeof taskConfig.extraction_depth === 'string'
    ? taskConfig.extraction_depth.trim().toLowerCase()
    : '';
  if (
    rawDepth === 'full_data' ||
    rawDepth === 'level_1' ||
    rawDepth === 'level1' ||
    taskConfig.include_property_insights === false ||
    taskConfig.include_insights === false
  ) {
    return 'full_data';
  }
  if (
    rawDepth === 'with_insights' ||
    rawDepth === 'level_2' ||
    rawDepth === 'level2' ||
    taskConfig.include_property_insights === true ||
    taskConfig.include_insights === true ||
    providerConfig.default_extraction_depth === 'with_insights'
  ) {
    return 'with_insights';
  }
  return 'full_data';
}

export function resolveActorAdapterSelection(params: {
  requestedActorId?: unknown;
  taskConfig?: Record<string, unknown>;
  providerConfig?: Record<string, unknown>;
  allowExperimentalActor?: boolean;
  twoStageDetailsOverride?: boolean | null;
}): ActorSelectionResult {
  const taskConfig = params.taskConfig || {};
  const providerConfig = params.providerConfig || {};
  const actorId =
    asStr(params.requestedActorId) ||
    asStr(taskConfig.actor_id) ||
    asStr(providerConfig.actor_id) ||
    DEFAULT_SEARCH_ACTOR_ID;

  if (!ACTOR_ID_RE.test(actorId)) {
    return { ok: false, status: 400, error: 'invalid_actor_id', message: `Invalid Apify actor ID: ${actorId}` };
  }

  const adapter = getApifyActorAdapter(actorId);
  if (!adapter) {
    return {
      ok: false,
      status: 400,
      error: 'unsupported_apify_actor',
      message: `Actor "${actorId}" has no registered Choice adapter. Default production workflow uses ${DEFAULT_SEARCH_ACTOR_ID} -> ${DEFAULT_DETAIL_ACTOR_ID}.`,
    };
  }

  const allowExperimental =
    params.allowExperimentalActor === true ||
    taskConfig.allow_experimental_actor === true ||
    providerConfig.allow_experimental_actor === true;

  if (adapter.isExperimental && !allowExperimental) {
    return {
      ok: false,
      status: 403,
      error: 'experimental_actor_opt_in_required',
      message: `Actor "${actorId}" is marked experimental and cannot run without explicit allow_experimental_actor opt-in. Production default uses ${DEFAULT_SEARCH_ACTOR_ID} -> ${DEFAULT_DETAIL_ACTOR_ID}.`,
    };
  }

  const twoStageEnabled =
    adapter.supportsTwoStageDetail &&
    params.twoStageDetailsOverride !== false &&
    taskConfig.two_stage_details !== false &&
    providerConfig.two_stage_details !== false;

  const scrapeStage: ScrapeStage =
    adapter.role === 'detail' ? 'detail' : twoStageEnabled ? 'search' : 'single';

  const extractionDepth = resolveExtractionDepth(taskConfig, providerConfig);
  const detailActorId = twoStageEnabled
    ? asStr(providerConfig.detail_actor_id) || adapter.defaultDetailActorId || DEFAULT_DETAIL_ACTOR_ID
    : null;

  return {
    ok: true,
    status: 200,
    adapter,
    actorId: adapter.actorId,
    actorSlug: adapter.actorId.replace('/', '~'),
    twoStageEnabled,
    detailActorId,
    scrapeStage,
    extractionDepth,
  };
}

export interface Stage1CandidateTriage {
  candidateUrls: string[];
  totalScanned: number;
  skippedSaleOnly: number;
  skippedFilterMismatch: number;
  skippedMissingUrl: number;
}

/**
 * Triages Stage-1 search cards before launching Stage-2 detail enrichment.
 * Only rejects listings that EXPLICITLY fail card-level rental status or numeric
 * price/bed/bath constraints (never drops items solely because shallow search cards
 * omit attributionInfo or narrative features that only Stage 2 fetches).
 */
export function extractStage1DetailUrls(
  items: unknown[],
  taskConfig: Record<string, unknown> = {},
  maxCandidates?: number,
): Stage1CandidateTriage {
  const limit =
    typeof maxCandidates === 'number' && maxCandidates > 0
      ? Math.min(Math.round(maxCandidates), 200)
      : computeScrapeHeadroomLimit(taskConfig);

  const minRent = asNum(taskConfig.min_rent);
  const maxRent = asNum(taskConfig.max_rent);
  const exactBeds = asNum(taskConfig.exact_beds);
  const minBeds = asNum(taskConfig.min_beds);
  const maxBeds = asNum(taskConfig.max_beds);
  const exactBaths = asNum(taskConfig.exact_baths);
  const minBaths = asNum(taskConfig.min_baths);
  const maxBaths = asNum(taskConfig.max_baths);

  const rawTypes = Array.isArray(taskConfig.property_types)
    ? taskConfig.property_types
    : typeof taskConfig.property_type === 'string' && taskConfig.property_type.trim()
    ? [taskConfig.property_type]
    : [];
  const allowedTypes = rawTypes.length > 0 ? new Set(rawTypes.map(normalizeCanonicalPropertyTypeFilter)) : null;

  const seenUrls = new Set<string>();
  const candidateUrls: string[] = [];
  let skippedSaleOnly = 0;
  let skippedFilterMismatch = 0;
  let skippedMissingUrl = 0;

  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const obj = raw as Record<string, unknown>;
    const hdpInfo =
      obj.hdpData && typeof obj.hdpData === 'object' && !Array.isArray(obj.hdpData)
        ? ((obj.hdpData as Record<string, unknown>).homeInfo as Record<string, unknown> | undefined) || {}
        : {};

    const rawStatus = asStr(obj.homeStatus ?? hdpInfo.homeStatus ?? obj.listingStatus ?? obj.status);
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
    const candidatePropertyUrl = asStr(obj.detailUrl ?? obj.propertyUrl ?? obj.url ?? obj.hdpUrl);
    const explicitlyForRent =
      statusNorm === 'FOR_RENT' ||
      statusNorm === 'FOR_RENT_BY_OWNER' ||
      obj.isForRent === true ||
      hdpInfo.isForRent === true ||
      Boolean(candidatePropertyUrl?.includes('/rentals/'));

    if (statusNorm && SALE_ONLY_STATUSES.has(statusNorm) && !explicitlyForRent) {
      skippedSaleOnly++;
      continue;
    }

    const cardBeds = asNum(obj.bedrooms ?? obj.beds ?? hdpInfo.bedrooms);
    if (cardBeds !== null) {
      if (exactBeds !== null && cardBeds !== exactBeds) {
        skippedFilterMismatch++;
        continue;
      }
      if (minBeds !== null && cardBeds < minBeds) {
        skippedFilterMismatch++;
        continue;
      }
      if (maxBeds !== null && cardBeds > maxBeds) {
        skippedFilterMismatch++;
        continue;
      }
    }

    const cardBaths = asNum(obj.bathrooms ?? obj.baths ?? hdpInfo.bathrooms);
    if (cardBaths !== null) {
      if (exactBaths !== null && Math.abs(cardBaths - exactBaths) > 0.01) {
        skippedFilterMismatch++;
        continue;
      }
      if (minBaths !== null && cardBaths < minBaths) {
        skippedFilterMismatch++;
        continue;
      }
      if (maxBaths !== null && cardBaths > maxBaths) {
        skippedFilterMismatch++;
        continue;
      }
    }

    const listingPriceObj =
      obj.listingPrice && typeof obj.listingPrice === 'object' && !Array.isArray(obj.listingPrice)
        ? (obj.listingPrice as Record<string, unknown>)
        : {};
    const cardRent = asNum(
      obj.unformattedPrice ?? obj.rent ?? obj.monthlyRent ?? listingPriceObj.amount ?? obj.price ?? hdpInfo.price,
    );
    if (cardRent !== null && cardRent > 0) {
      if (minRent !== null && cardRent < minRent) {
        skippedFilterMismatch++;
        continue;
      }
      if (maxRent !== null && cardRent > maxRent) {
        skippedFilterMismatch++;
        continue;
      }
    }

    if (allowedTypes) {
      const cardTypeRaw = asStr(obj.homeType ?? hdpInfo.homeType ?? obj.propertyType);
      if (cardTypeRaw) {
        const cardType = normalizeCanonicalPropertyTypeFilter(cardTypeRaw);
        // Only reject on Stage 1 when the search card explicitly reports a different non-ambiguous type
        // (allow MULTI_FAMILY / DUPLEX overlap until Stage 2 resoFacts checks half-duplex subtypes)
        if (cardType !== 'DUPLEX' && !allowedTypes.has(cardType)) {
          skippedFilterMismatch++;
          continue;
        }
      }
    }

    const rawUrl = sanitizeZillowDetailUrl(obj.detailUrl ?? obj.propertyUrl ?? obj.url ?? obj.hdpUrl);
    const zpid = asStr(obj.zpid ?? hdpInfo.zpid);
    const detailUrl = rawUrl || (zpid && /^\d+$/.test(zpid) ? `https://www.zillow.com/homedetails/${zpid}_zpid/` : null);
    if (!detailUrl) {
      skippedMissingUrl++;
      continue;
    }
    if (seenUrls.has(detailUrl)) continue;
    seenUrls.add(detailUrl);
    candidateUrls.push(detailUrl);
    if (candidateUrls.length >= limit) break;
  }

  return {
    candidateUrls,
    totalScanned: items.length,
    skippedSaleOnly,
    skippedFilterMismatch,
    skippedMissingUrl,
  };
}
