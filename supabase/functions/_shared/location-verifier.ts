// ============================================================================
// Choice Properties — Phase 5 Independent Location & School Verifier
// ============================================================================
// Independently cross-checks listing coordinates & geographic/school claims:
//   1. Geoapify reverse-geocode consistency check (state, county, city, zip,
//      neighborhood, and coordinate distance sanity check) using GEOAPIFY_API_KEY
//   2. Zero-key Census TIGERweb / NCES EDGE school-district boundary identify
//      lookup (tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/School/MapServer/identify)
//   3. Per-field verification classification:
//      'source_confirmed' | 'independently_verified' | 'partially_verified'
//      | 'unverified' | 'conflicting_sources' | 'not_available'
//   4. Graceful degradation on timeouts/5xx/missing keys (never falsely rejects)
// ============================================================================

import { haversineMeters } from './location-intelligence.ts';

export type FieldVerificationStatus =
  | 'source_confirmed'
  | 'independently_verified'
  | 'partially_verified'
  | 'unverified'
  | 'conflicting_sources'
  | 'not_available';

export interface VerificationConflict {
  field: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  source_value: unknown;
  expected_or_claimed_value: unknown;
  message: string;
}

export interface ReverseGeocodeVerificationData {
  country_code: string | null;
  state: string | null;
  state_code: string | null;
  county: string | null;
  city: string | null;
  zip: string | null;
  neighborhood: string | null;
  matched_lat: number | null;
  matched_lng: number | null;
  distance_m: number | null;
}

export interface CensusSchoolVerificationData {
  unified_district: string | null;
  elementary_district: string | null;
  secondary_district: string | null;
  primary_district: string | null;
}

export interface LocationVerificationResult {
  coordinates_valid: boolean;
  external_checks_attempted: boolean;
  geoapify_status: 'ok' | 'unavailable' | 'skipped' | 'not_available';
  census_status: 'ok' | 'unavailable' | 'skipped' | 'not_available';
  reverse_geocode: ReverseGeocodeVerificationData | null;
  census_schools: CensusSchoolVerificationData | null;
  field_statuses: {
    location_coordinates: FieldVerificationStatus;
    state: FieldVerificationStatus;
    city: FieldVerificationStatus;
    county: FieldVerificationStatus;
    zip: FieldVerificationStatus;
    neighborhood: FieldVerificationStatus;
    school_district: FieldVerificationStatus;
  };
  conflicts: VerificationConflict[];
  critical_mismatch: boolean;
  mismatch_reasons: string[];
}

export interface VerifyLocationAndSchoolsInput {
  lat: unknown;
  lng: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
  county?: unknown;
  neighborhood?: unknown;
  school_district?: unknown;
  location_details?: unknown;
}

export interface VerifyLocationOptions {
  geoapifyApiKey?: string;
  enableExternalChecks?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  forceExternalFetch?: boolean;
}

const TEN_MILES_METERS = 16_093.44;
const ONE_MILE_METERS = 1_609.344;

const US_STATE_CODES: Record<string, string> = {
  ALABAMA: 'AL',
  ALASKA: 'AK',
  ARIZONA: 'AZ',
  ARKANSAS: 'AR',
  CALIFORNIA: 'CA',
  COLORADO: 'CO',
  CONNECTICUT: 'CT',
  DELAWARE: 'DE',
  'DISTRICT OF COLUMBIA': 'DC',
  FLORIDA: 'FL',
  GEORGIA: 'GA',
  HAWAII: 'HI',
  IDAHO: 'ID',
  ILLINOIS: 'IL',
  INDIANA: 'IN',
  IOWA: 'IA',
  KANSAS: 'KS',
  KENTUCKY: 'KY',
  LOUISIANA: 'LA',
  MAINE: 'ME',
  MARYLAND: 'MD',
  MASSACHUSETTS: 'MA',
  MICHIGAN: 'MI',
  MINNESOTA: 'MN',
  MISSISSIPPI: 'MS',
  MISSOURI: 'MO',
  MONTANA: 'MT',
  NEBRASKA: 'NE',
  NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM',
  'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND',
  OHIO: 'OH',
  OKLAHOMA: 'OK',
  OREGON: 'OR',
  PENNSYLVANIA: 'PA',
  'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD',
  TENNESSEE: 'TN',
  TEXAS: 'TX',
  UTAH: 'UT',
  VERMONT: 'VT',
  VIRGINIA: 'VA',
  WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI',
  WYOMING: 'WY',
};

const US_CODE_TO_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_CODES).map(([name, code]) => [code, name]),
);

const DISTRICT_STOPWORDS = new Set([
  'public',
  'school',
  'schools',
  'district',
  'independent',
  'isd',
  'usd',
  'cisd',
  'consolidated',
  'unified',
  'community',
  'unit',
  'elementary',
  'secondary',
  'high',
  'no',
  'number',
  'of',
  'the',
  'and',
  'county',
  'city',
]);

function asStr(v: unknown): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  return s || null;
}

function asObj(v: unknown): Record<string, unknown> {
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    return {};
  }
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function isValidVerificationCoordinatePair(
  latVal: unknown,
  lngVal: unknown,
): { valid: boolean; lat: number | null; lng: number | null } {
  const lat = typeof latVal === 'number' ? latVal : typeof latVal === 'string' && latVal.trim() ? Number(latVal) : NaN;
  const lng = typeof lngVal === 'number' ? lngVal : typeof lngVal === 'string' && lngVal.trim() ? Number(lngVal) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, lat: null, lng: null };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valid: false, lat: null, lng: null };
  }
  // Guard Null Island (0, 0)
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
    return { valid: false, lat: null, lng: null };
  }
  return { valid: true, lat, lng };
}

export function normalizeUsStateCode(rawState: unknown): string | null {
  const s = asStr(rawState);
  if (!s) return null;
  const upper = s.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  if (US_CODE_TO_STATE[upper]) return upper;
  if (US_STATE_CODES[upper]) return US_STATE_CODES[upper];
  return upper;
}

export function normalizeCountyName(rawCounty: unknown): string {
  const s = asStr(rawCounty);
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/\b(?:county|parish|borough|census\s+area|municipality)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCityName(rawCity: unknown): string {
  const s = asStr(rawCity);
  if (!s) return '';
  let norm = s
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (norm === 'okc') norm = 'oklahoma city';
  norm = norm
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bfort\b/g, 'ft')
    .replace(/\bmount\b/g, 'mt')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return norm;
}

export function normalizeZip5(rawZip: unknown): string {
  const s = asStr(rawZip);
  if (!s) return '';
  const m = s.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : '';
}

export function normalizeNeighborhoodName(rawNeighborhood: unknown): string {
  const s = asStr(rawNeighborhood);
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSchoolDistrict(rawDistrict: unknown): string[] {
  const s = asStr(rawDistrict);
  if (!s) return [];
  const cleaned = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];

  const tokens = cleaned
    .split(' ')
    .filter((tok) => tok && !DISTRICT_STOPWORDS.has(tok) && !/^\d+$/.test(tok));

  if (tokens.length > 0) return Array.from(new Set(tokens));
  return Array.from(
    new Set(
      cleaned
        .split(' ')
        .filter((tok) => tok && tok !== 'district' && tok !== 'school' && tok !== 'schools'),
    ),
  );
}

export function schoolDistrictsMatch(claimed: string, verifiedCandidates: string[]): boolean {
  const claimedTokens = tokenizeSchoolDistrict(claimed);
  if (claimedTokens.length === 0) return false;
  const claimedJoined = claimedTokens.join(' ');

  for (const candidate of verifiedCandidates) {
    const candTokens = tokenizeSchoolDistrict(candidate);
    if (candTokens.length === 0) continue;
    const candJoined = candTokens.join(' ');
    if (claimedJoined === candJoined) return true;

    const candSet = new Set(candTokens);
    const shared = claimedTokens.filter((t) => candSet.has(t));
    if (shared.length > 0) {
      const minLen = Math.min(claimedTokens.length, candTokens.length);
      if (shared.length >= minLen) return true;
    }
  }
  return false;
}

async function fetchJsonSafe(
  url: URL,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number | null; data: Record<string, unknown> | null; error?: string }> {
  // Defense-in-depth host allowlist enforcement (only Geoapify and US Census TIGERweb)
  if (
    url.protocol !== 'https:' ||
    (url.hostname !== 'api.geoapify.com' && url.hostname !== 'tigerweb.geo.census.gov')
  ) {
    return { ok: false, status: null, data: null, error: 'disallowed_verification_host' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      await res.body?.cancel();
      return { ok: false, status: res.status, data: null, error: `http_${res.status}` };
    }
    const parsed = await res.json();
    const data = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
    return { ok: Boolean(data), status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: null,
      data: null,
      error: err instanceof Error ? err.message : 'fetch_failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyGeoapifyReverseGeocode(params: {
  lat: number;
  lng: number;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: 'ok' | 'unavailable'; reverse: ReverseGeocodeVerificationData | null; error?: string }> {
  const key = (params.apiKey || '').trim();
  if (!key) {
    return { ok: false, status: 'unavailable', reverse: null, error: 'missing_geoapify_key' };
  }
  const doFetch = params.fetchImpl || fetch;
  const timeoutMs = Math.min(Math.max(params.timeoutMs ?? 4000, 500), 10_000);

  const url = new URL('https://api.geoapify.com/v1/geocode/reverse');
  url.searchParams.set('lat', String(params.lat));
  url.searchParams.set('lon', String(params.lng));
  url.searchParams.set('format', 'json');
  url.searchParams.set('lang', 'en');
  url.searchParams.set('apiKey', key);

  const res = await fetchJsonSafe(url, doFetch, timeoutMs);
  if (!res.ok || !res.data) {
    return { ok: false, status: 'unavailable', reverse: null, error: res.error || 'geoapify_unavailable' };
  }

  const resultsArr = Array.isArray(res.data.results) ? res.data.results : [];
  const featuresArr = Array.isArray(res.data.features) ? res.data.features : [];
  const rowObj = resultsArr[0]
    ? asObj(resultsArr[0])
    : featuresArr[0]
    ? asObj(asObj(featuresArr[0]).properties)
    : {};

  if (Object.keys(rowObj).length === 0) {
    return { ok: false, status: 'unavailable', reverse: null, error: 'empty_reverse_geocode' };
  }

  const matchedLat = typeof rowObj.lat === 'number' && Number.isFinite(rowObj.lat) ? rowObj.lat : null;
  const matchedLng = typeof rowObj.lon === 'number' && Number.isFinite(rowObj.lon)
    ? rowObj.lon
    : typeof rowObj.lng === 'number' && Number.isFinite(rowObj.lng)
    ? rowObj.lng
    : null;

  const distanceM = matchedLat !== null && matchedLng !== null
    ? Math.round(haversineMeters(params.lat, params.lng, matchedLat, matchedLng))
    : typeof rowObj.distance === 'number' && Number.isFinite(rowObj.distance)
    ? Math.round(rowObj.distance)
    : null;

  const stateCode = normalizeUsStateCode(rowObj.state_code || rowObj.state);
  const reverse: ReverseGeocodeVerificationData = {
    country_code: asStr(rowObj.country_code)?.toLowerCase() || null,
    state: asStr(rowObj.state),
    state_code: stateCode,
    county: asStr(rowObj.county),
    city: asStr(rowObj.city || rowObj.town || rowObj.village || rowObj.hamlet),
    zip: normalizeZip5(rowObj.postcode || rowObj.zip) || null,
    neighborhood: asStr(rowObj.suburb || rowObj.neighbourhood || rowObj.neighborhood || rowObj.district || rowObj.city_district),
    matched_lat: matchedLat,
    matched_lng: matchedLng,
    distance_m: distanceM,
  };

  return { ok: true, status: 'ok', reverse };
}

export async function verifyCensusTigerSchoolDistrict(params: {
  lat: number;
  lng: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: 'ok' | 'unavailable'; schools: CensusSchoolVerificationData | null; error?: string }> {
  const doFetch = params.fetchImpl || fetch;
  const timeoutMs = Math.min(Math.max(params.timeoutMs ?? 4500, 500), 10_000);

  const url = new URL('https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/School/MapServer/identify');
  url.searchParams.set('geometry', `${params.lng},${params.lat}`);
  url.searchParams.set('geometryType', 'esriGeometryPoint');
  url.searchParams.set('sr', '4326');
  url.searchParams.set('layers', 'all:0,1,2');
  url.searchParams.set('tolerance', '0');
  url.searchParams.set('mapExtent', `${params.lng - 0.05},${params.lat - 0.05},${params.lng + 0.05},${params.lat + 0.05}`);
  url.searchParams.set('imageDisplay', '200,200,96');
  url.searchParams.set('returnGeometry', 'false');
  url.searchParams.set('f', 'json');

  const res = await fetchJsonSafe(url, doFetch, timeoutMs);
  if (!res.ok || !res.data) {
    return { ok: false, status: 'unavailable', schools: null, error: res.error || 'tigerweb_unavailable' };
  }

  const results = Array.isArray(res.data.results) ? res.data.results : [];
  let unified: string | null = null;
  let secondary: string | null = null;
  let elementary: string | null = null;

  for (const entryRaw of results) {
    const entry = asObj(entryRaw);
    const layerName = String(entry.layerName || '').toLowerCase();
    const attrs = asObj(entry.attributes);
    const name = asStr(attrs.NAME ?? attrs.BASENAME ?? entry.value);
    if (!name || /school districts not defined/i.test(name)) continue;

    if (layerName.includes('unified') || entry.layerId === 0) {
      if (!unified) unified = name;
    } else if (layerName.includes('secondary') || entry.layerId === 1) {
      if (!secondary) secondary = name;
    } else if (layerName.includes('elementary') || entry.layerId === 2) {
      if (!elementary) elementary = name;
    } else if (!unified) {
      unified = name;
    }
  }

  const primary = unified || secondary || elementary || null;
  if (!primary) {
    return {
      ok: false,
      status: 'unavailable',
      schools: null,
      error: 'no_school_district_polygon_found',
    };
  }

  return {
    ok: true,
    status: 'ok',
    schools: {
      unified_district: unified,
      elementary_district: elementary,
      secondary_district: secondary,
      primary_district: primary,
    },
  };
}

export async function verifyLocationAndSchools(
  listing: VerifyLocationAndSchoolsInput,
  options: VerifyLocationOptions = {},
): Promise<LocationVerificationResult> {
  const locDetails = asObj(listing.location_details);
  const cachedInsights = asObj(locDetails.insights);

  const coordCheck = isValidVerificationCoordinatePair(listing.lat, listing.lng);
  const claimedState = normalizeUsStateCode(listing.state);
  const claimedCity = asStr(listing.city);
  const claimedZip = normalizeZip5(listing.zip);
  const claimedCounty = asStr(listing.county ?? locDetails.county);
  const claimedNeighborhood = asStr(listing.neighborhood ?? locDetails.neighborhood);
  const claimedSchoolDistrict = asStr(listing.school_district ?? locDetails.school_district);

  const baseStatus = (present: boolean): FieldVerificationStatus =>
    present ? 'source_confirmed' : 'not_available';

  const fieldStatuses: LocationVerificationResult['field_statuses'] = {
    location_coordinates: coordCheck.valid ? 'source_confirmed' : 'not_available',
    state: baseStatus(Boolean(claimedState)),
    city: baseStatus(Boolean(claimedCity)),
    county: baseStatus(Boolean(claimedCounty)),
    zip: baseStatus(Boolean(claimedZip)),
    neighborhood: baseStatus(Boolean(claimedNeighborhood)),
    school_district: baseStatus(Boolean(claimedSchoolDistrict)),
  };

  if (!coordCheck.valid || coordCheck.lat === null || coordCheck.lng === null) {
    return {
      coordinates_valid: false,
      external_checks_attempted: false,
      geoapify_status: 'not_available',
      census_status: 'not_available',
      reverse_geocode: null,
      census_schools: null,
      field_statuses: fieldStatuses,
      conflicts: [],
      critical_mismatch: false,
      mismatch_reasons: [],
    };
  }

  const cachedGeo = asObj(cachedInsights.geoapify_reverse);
  const cachedCensus = asObj(cachedInsights.census_school_district);
  const hasCachedCensus = cachedInsights.census_district_status === 'ok' && Boolean(asStr(cachedCensus.primary_district));
  const hasCachedGeo = cachedInsights.geoapify_status === 'ok' && (
    Boolean(asStr(cachedGeo.county)) ||
    Boolean(asStr(cachedGeo.city)) ||
    Boolean(asStr(cachedGeo.neighborhood))
  );

  let geoStatus: LocationVerificationResult['geoapify_status'] = 'skipped';
  let censusStatus: LocationVerificationResult['census_status'] = 'skipped';
  let reverseGeocode: ReverseGeocodeVerificationData | null = null;
  let censusSchools: CensusSchoolVerificationData | null = null;
  let externalAttempted = false;

  if (options.enableExternalChecks === true) {
    externalAttempted = true;
    const apiKey = (options.geoapifyApiKey || '').trim();
    const shouldFetchGeo = Boolean(apiKey) && (options.forceExternalFetch !== false || !hasCachedGeo);
    const shouldFetchCensus = options.forceExternalFetch === true || !hasCachedCensus;

    const [geoRes, censusRes] = await Promise.all([
      shouldFetchGeo
        ? verifyGeoapifyReverseGeocode({
            lat: coordCheck.lat,
            lng: coordCheck.lng,
            apiKey,
            fetchImpl: options.fetchImpl,
            timeoutMs: options.timeoutMs,
          })
        : Promise.resolve(null),
      shouldFetchCensus
        ? verifyCensusTigerSchoolDistrict({
            lat: coordCheck.lat,
            lng: coordCheck.lng,
            fetchImpl: options.fetchImpl,
            timeoutMs: options.timeoutMs,
          })
        : Promise.resolve(null),
    ]);

    if (geoRes) {
      if (geoRes.ok && geoRes.reverse) {
        geoStatus = 'ok';
        reverseGeocode = geoRes.reverse;
      } else {
        geoStatus = 'unavailable';
      }
    } else if (hasCachedGeo) {
      geoStatus = 'ok';
      reverseGeocode = {
        country_code: null,
        state: asStr(cachedGeo.state),
        state_code: normalizeUsStateCode(cachedGeo.state_code || cachedGeo.state),
        county: asStr(cachedGeo.county),
        city: asStr(cachedGeo.city),
        zip: normalizeZip5(cachedGeo.zip) || null,
        neighborhood: asStr(cachedGeo.neighborhood),
        matched_lat: null,
        matched_lng: null,
        distance_m: null,
      };
    } else if (!apiKey) {
      geoStatus = 'unavailable';
    }

    if (censusRes) {
      if (censusRes.ok && censusRes.schools) {
        censusStatus = 'ok';
        censusSchools = censusRes.schools;
      } else {
        censusStatus = 'unavailable';
      }
    } else if (hasCachedCensus) {
      censusStatus = 'ok';
      censusSchools = {
        unified_district: asStr(cachedCensus.unified_district),
        elementary_district: asStr(cachedCensus.elementary_district),
        secondary_district: asStr(cachedCensus.secondary_district),
        primary_district: asStr(cachedCensus.primary_district),
      };
    }
  } else {
    // External HTTP calls disabled: still leverage cached insights if Level 2 ran during staging
    if (hasCachedGeo) {
      geoStatus = 'ok';
      reverseGeocode = {
        country_code: null,
        state: asStr(cachedGeo.state),
        state_code: normalizeUsStateCode(cachedGeo.state_code || cachedGeo.state),
        county: asStr(cachedGeo.county),
        city: asStr(cachedGeo.city),
        zip: normalizeZip5(cachedGeo.zip) || null,
        neighborhood: asStr(cachedGeo.neighborhood),
        matched_lat: null,
        matched_lng: null,
        distance_m: null,
      };
    }
    if (hasCachedCensus) {
      censusStatus = 'ok';
      censusSchools = {
        unified_district: asStr(cachedCensus.unified_district),
        elementary_district: asStr(cachedCensus.elementary_district),
        secondary_district: asStr(cachedCensus.secondary_district),
        primary_district: asStr(cachedCensus.primary_district),
      };
    }
  }

  const conflicts: VerificationConflict[] = [];
  const mismatchReasons: string[] = [];
  let criticalMismatch = false;

  // ── Geoapify reverse geocode cross-checks ──────────────────────────────────
  if (geoStatus === 'ok' && reverseGeocode) {
    let coordMatchedAny = false;
    let coordHasConflict = false;

    // 1. State check (critical on mismatch)
    if (claimedState && reverseGeocode.state_code) {
      if (claimedState === reverseGeocode.state_code) {
        fieldStatuses.state = 'independently_verified';
        coordMatchedAny = true;
      } else {
        fieldStatuses.state = 'conflicting_sources';
        coordHasConflict = true;
        criticalMismatch = true;
        mismatchReasons.push('geoapify_state_mismatch');
        conflicts.push({
          field: 'state',
          severity: 'critical',
          source: 'geoapify_reverse_geocode',
          source_value: claimedState,
          expected_or_claimed_value: reverseGeocode.state_code,
          message: `Coordinates reverse-geocode to state "${reverseGeocode.state_code}" while listing claims "${claimedState}".`,
        });
      }
    } else if (claimedState) {
      fieldStatuses.state = 'unverified';
    }

    // 2. City check (critical if city differs AND reverse distance > 10 miles OR reverse city differs & state differs;
    //    Wait: Geoapify reverse geocode `distance_m` is distance from queried point to nearest road/address, NOT city centroid!
    //    Wait: what if the listing geocoded coordinates are in Tulsa, OK while city says Yukon, OK? Road distance from queried point to Geoapify's road in Tulsa is ~10m, while city is totally different!
    //    Or what if listing is in unincorporated edge of Yukon where Geoapify says Oklahoma City (adjacent suburb)? Let's handle both!)
    if (claimedCity && reverseGeocode.city) {
      const normClaimedCity = normalizeCityName(claimedCity);
      const normGeoCity = normalizeCityName(reverseGeocode.city);
      if (normClaimedCity && normGeoCity && normClaimedCity === normGeoCity) {
        fieldStatuses.city = 'independently_verified';
        coordMatchedAny = true;
      } else {
        fieldStatuses.city = 'conflicting_sources';
        coordHasConflict = true;
        const farDistance = reverseGeocode.distance_m !== null && reverseGeocode.distance_m > TEN_MILES_METERS;
        const differentStateToo = Boolean(
          claimedState && reverseGeocode.state_code && claimedState !== reverseGeocode.state_code,
        );
        const differentCountyToo = Boolean(
          claimedCounty &&
            reverseGeocode.county &&
            normalizeCountyName(claimedCounty) !== normalizeCountyName(reverseGeocode.county),
        );
        const severity: VerificationConflict['severity'] =
          farDistance || differentStateToo || differentCountyToo ? 'critical' : 'warning';
        if (severity === 'critical') {
          criticalMismatch = true;
          mismatchReasons.push('geoapify_city_mismatch');
        }
        conflicts.push({
          field: 'city',
          severity,
          source: 'geoapify_reverse_geocode',
          source_value: claimedCity,
          expected_or_claimed_value: reverseGeocode.city,
          message: `Coordinates reverse-geocode to city "${reverseGeocode.city}" while listing claims "${claimedCity}"${reverseGeocode.distance_m !== null ? ` (${reverseGeocode.distance_m}m offset)` : ''}.`,
        });
      }
    } else if (claimedCity) {
      fieldStatuses.city = 'unverified';
    }

    // Also flag critical if reverse-geocode point itself snapped >10 miles from queried coordinates
    if (reverseGeocode.distance_m !== null && reverseGeocode.distance_m > TEN_MILES_METERS) {
      coordHasConflict = true;
      criticalMismatch = true;
      mismatchReasons.push('geoapify_coordinate_distance_exceeded');
      conflicts.push({
        field: 'location_coordinates',
        severity: 'critical',
        source: 'geoapify_reverse_geocode',
        source_value: { lat: coordCheck.lat, lng: coordCheck.lng },
        expected_or_claimed_value: {
          lat: reverseGeocode.matched_lat,
          lng: reverseGeocode.matched_lng,
          distance_m: reverseGeocode.distance_m,
        },
        message: `Geoapify reverse-geocode nearest feature is ${Math.round(reverseGeocode.distance_m / ONE_MILE_METERS)} miles away (>10 miles).`,
      });
    }

    // 3. County check (warning on conflict unless paired with city mismatch above)
    if (claimedCounty && reverseGeocode.county) {
      if (normalizeCountyName(claimedCounty) === normalizeCountyName(reverseGeocode.county)) {
        fieldStatuses.county = 'independently_verified';
        coordMatchedAny = true;
      } else {
        fieldStatuses.county = 'conflicting_sources';
        conflicts.push({
          field: 'county',
          severity: 'warning',
          source: 'geoapify_reverse_geocode',
          source_value: claimedCounty,
          expected_or_claimed_value: reverseGeocode.county,
          message: `Listing county "${claimedCounty}" differs from Geoapify county "${reverseGeocode.county}".`,
        });
      }
    } else if (reverseGeocode.county && !claimedCounty) {
      fieldStatuses.county = 'unverified';
    }

    // 4. ZIP check
    if (claimedZip && reverseGeocode.zip) {
      if (claimedZip === reverseGeocode.zip) {
        fieldStatuses.zip = 'independently_verified';
        coordMatchedAny = true;
      } else {
        fieldStatuses.zip = 'conflicting_sources';
        conflicts.push({
          field: 'zip',
          severity: 'warning',
          source: 'geoapify_reverse_geocode',
          source_value: claimedZip,
          expected_or_claimed_value: reverseGeocode.zip,
          message: `Listing ZIP "${claimedZip}" differs from Geoapify reverse-geocode postcode "${reverseGeocode.zip}".`,
        });
      }
    } else if (claimedZip) {
      fieldStatuses.zip = 'unverified';
    }

    // 5. Neighborhood check (info on difference, never blocks)
    if (claimedNeighborhood && reverseGeocode.neighborhood) {
      const a = normalizeNeighborhoodName(claimedNeighborhood);
      const b = normalizeNeighborhoodName(reverseGeocode.neighborhood);
      if (a && b && (a === b || a.includes(b) || b.includes(a))) {
        fieldStatuses.neighborhood = 'independently_verified';
      } else {
        fieldStatuses.neighborhood = 'conflicting_sources';
        conflicts.push({
          field: 'neighborhood',
          severity: 'info',
          source: 'geoapify_reverse_geocode',
          source_value: claimedNeighborhood,
          expected_or_claimed_value: reverseGeocode.neighborhood,
          message: `Neighborhood label differs between Zillow ("${claimedNeighborhood}") and Geoapify ("${reverseGeocode.neighborhood}").`,
        });
      }
    } else if (claimedNeighborhood) {
      fieldStatuses.neighborhood = 'partially_verified';
    }

    // Coordinate aggregate status
    if (coordHasConflict) {
      fieldStatuses.location_coordinates = 'conflicting_sources';
    } else if (coordMatchedAny) {
      fieldStatuses.location_coordinates = 'independently_verified';
    } else {
      fieldStatuses.location_coordinates = 'partially_verified';
    }
  } else if (geoStatus === 'unavailable') {
    // Graceful degradation: external service down -> keep source_confirmed / unverified, never reject
    fieldStatuses.location_coordinates = 'unverified';
  }

  // ── Census TIGERweb school district boundary check ─────────────────────────
  if (censusStatus === 'ok' && censusSchools) {
    const verifiedDistricts = [
      censusSchools.unified_district,
      censusSchools.elementary_district,
      censusSchools.secondary_district,
      censusSchools.primary_district,
    ].filter((x): x is string => Boolean(x));

    if (claimedSchoolDistrict) {
      if (schoolDistrictsMatch(claimedSchoolDistrict, verifiedDistricts)) {
        fieldStatuses.school_district = 'independently_verified';
      } else {
        fieldStatuses.school_district = 'conflicting_sources';
        conflicts.push({
          field: 'school_district',
          severity: 'warning',
          source: 'census_tigerweb_school_boundary',
          source_value: claimedSchoolDistrict,
          expected_or_claimed_value: verifiedDistricts[0] || censusSchools.primary_district,
          message: `Zillow school_district "${claimedSchoolDistrict}" differs from US Census TIGERweb boundary "${censusSchools.primary_district}".`,
        });
      }
    } else {
      fieldStatuses.school_district = 'unverified';
    }
  } else if (censusStatus === 'unavailable' && claimedSchoolDistrict) {
    fieldStatuses.school_district = 'source_confirmed';
  }

  return {
    coordinates_valid: true,
    external_checks_attempted: externalAttempted,
    geoapify_status: geoStatus,
    census_status: censusStatus,
    reverse_geocode: reverseGeocode,
    census_schools: censusSchools,
    field_statuses: fieldStatuses,
    conflicts,
    critical_mismatch: criticalMismatch,
    mismatch_reasons: Array.from(new Set(mismatchReasons)),
  };
}
