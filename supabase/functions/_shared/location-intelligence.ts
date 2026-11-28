export type NearbyCategory = 'school' | 'park' | 'shopping' | 'healthcare' | 'transit';

export type NearbyPlace = {
  id: string;
  name: string;
  category: NearbyCategory;
  distance_m: number;
  lat: number;
  lng: number;
  address: string | null;
};

const CATEGORY_RULES: Array<[NearbyCategory, RegExp]> = [
  ['school', /^education\.(school|college|university|kindergarten)(\.|$)/i],
  ['park', /^leisure\.(park|nature_reserve)(\.|$)/i],
  ['shopping', /^commercial\.(supermarket|shopping_mall|marketplace)(\.|$)/i],
  ['healthcare', /^healthcare(?:\.|$)/i],
  ['transit', /^public_transport(?:\.|$)/i],
  ['transit', /^public_transportation(?:\.|$)/i],
];

export function categorizeNearbyPlace(categories: unknown): NearbyCategory | null {
  if (!Array.isArray(categories)) return null;
  for (const category of categories) {
    if (typeof category !== 'string') continue;
    const rule = CATEGORY_RULES.find(([, pattern]) => pattern.test(category));
    if (rule) return rule[0];
  }
  return null;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizeNearbyPlaces(
  features: unknown,
  propertyLat: number,
  propertyLng: number,
): NearbyPlace[] {
  if (!Array.isArray(features)) return [];

  const bestByCategory = new Map<NearbyCategory, NearbyPlace[]>();
  const seen = new Set<string>();

  for (const feature of features) {
    const properties = feature?.properties;
    const coordinates = feature?.geometry?.coordinates;
    if (!properties || !Array.isArray(coordinates) || coordinates.length < 2) continue;

    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const category = categorizeNearbyPlace(properties.categories);
    const name = String(properties.name || properties.address_line1 || '').trim();
    if (!category || !name) continue;

    const distance = haversineMeters(propertyLat, propertyLng, lat, lng);
    if (distance > 5000) continue;

    const id = String(properties.place_id || `${name}:${lat.toFixed(5)}:${lng.toFixed(5)}`);
    if (seen.has(id)) continue;
    seen.add(id);

    const place: NearbyPlace = {
      id,
      name,
      category,
      distance_m: Math.round(distance / 10) * 10,
      lat,
      lng,
      address: String(properties.address_line2 || '').trim() || null,
    };
    const categoryPlaces = bestByCategory.get(category) || [];
    categoryPlaces.push(place);
    bestByCategory.set(category, categoryPlaces);
  }

  return [...bestByCategory.values()]
    .flatMap((places) => places.sort((a, b) => a.distance_m - b.distance_m).slice(0, 4))
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, 16);
}

// ============================================================================
// Phase 4: Reusable Server-Pipeline Level-2 Property Insights Helpers
// ============================================================================

export const LEVEL2_GEOAPIFY_CATEGORIES = [
  'education.school',
  'education.college',
  'education.university',
  'leisure.park',
  'leisure.nature_reserve',
  'commercial.supermarket',
  'commercial.shopping_mall',
  'healthcare',
  'public_transport',
] as const;

export interface NearbySummary {
  counts: Record<NearbyCategory, number>;
  nearest_by_category: Partial<
    Record<NearbyCategory, { name: string; distance_m: number; address: string | null }>
  >;
  nearby_highlights: Array<{ name: string; category: NearbyCategory; distance_m: number }>;
  total_places: number;
}

export interface Level2GeoapifyResult {
  ok: boolean;
  status: 'ok' | 'partial' | 'unavailable';
  places: NearbyPlace[];
  summary: NearbySummary | null;
  reverse?: {
    county: string | null;
    neighborhood: string | null;
    city: string | null;
  };
  error?: string;
}

export interface Level2CensusSchoolDistrictResult {
  ok: boolean;
  status: 'ok' | 'unavailable';
  unified_district: string | null;
  elementary_district: string | null;
  secondary_district: string | null;
  primary_district: string | null;
  error?: string;
}

function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function summarizeNearbyPlacesForInsights(places: NearbyPlace[]): NearbySummary {
  const counts: Record<NearbyCategory, number> = {
    school: 0,
    park: 0,
    shopping: 0,
    healthcare: 0,
    transit: 0,
  };
  const nearest_by_category: Partial<
    Record<NearbyCategory, { name: string; distance_m: number; address: string | null }>
  > = {};

  const sorted = [...places].sort((a, b) => a.distance_m - b.distance_m);
  for (const p of sorted) {
    counts[p.category] = (counts[p.category] || 0) + 1;
    if (!nearest_by_category[p.category]) {
      nearest_by_category[p.category] = {
        name: p.name,
        distance_m: p.distance_m,
        address: p.address,
      };
    }
  }

  const nearby_highlights = sorted.slice(0, 8).map((p) => ({
    name: p.name,
    category: p.category,
    distance_m: p.distance_m,
  }));

  return {
    counts,
    nearest_by_category,
    nearby_highlights,
    total_places: sorted.length,
  };
}

export async function fetchLevel2GeoapifyInsights(params: {
  lat: number;
  lng: number;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  includeReverseGeocode?: boolean;
}): Promise<Level2GeoapifyResult> {
  if (!isValidLatLng(params.lat, params.lng)) {
    return { ok: false, status: 'unavailable', places: [], summary: null, error: 'invalid_coordinates' };
  }
  const key = (params.apiKey || '').trim();
  if (!key) {
    return { ok: false, status: 'unavailable', places: [], summary: null, error: 'missing_geoapify_key' };
  }

  const doFetch = params.fetchImpl || fetch;
  const timeoutMs = Math.min(Math.max(params.timeoutMs ?? 4000, 500), 10_000);

  const placesUrl = new URL('https://api.geoapify.com/v2/places');
  placesUrl.searchParams.set('apiKey', key);
  placesUrl.searchParams.set('categories', LEVEL2_GEOAPIFY_CATEGORIES.join(','));
  placesUrl.searchParams.set('filter', `circle:${params.lng},${params.lat},5000`);
  placesUrl.searchParams.set('bias', `proximity:${params.lng},${params.lat}`);
  placesUrl.searchParams.set('limit', '60');
  placesUrl.searchParams.set('lang', 'en');

  const safeFetchJson = async (url: URL) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(url.toString(), { signal: controller.signal });
      if (!res.ok) return { ok: false as const, status: res.status, data: null };
      return { ok: true as const, status: res.status, data: await res.json() };
    } catch (err) {
      return {
        ok: false as const,
        status: null,
        data: null,
        error: err instanceof Error ? err.message : 'fetch_failed',
      };
    } finally {
      clearTimeout(timer);
    }
  };

  let placesRes: Awaited<ReturnType<typeof safeFetchJson>>;
  let revRes: Awaited<ReturnType<typeof safeFetchJson>> | null = null;

  if (params.includeReverseGeocode) {
    const revUrl = new URL('https://api.geoapify.com/v1/geocode/reverse');
    revUrl.searchParams.set('lat', String(params.lat));
    revUrl.searchParams.set('lon', String(params.lng));
    revUrl.searchParams.set('format', 'json');
    revUrl.searchParams.set('lang', 'en');
    revUrl.searchParams.set('apiKey', key);
    [placesRes, revRes] = await Promise.all([safeFetchJson(placesUrl), safeFetchJson(revUrl)]);
  } else {
    placesRes = await safeFetchJson(placesUrl);
  }

  if (!placesRes.ok && !revRes?.ok) {
    return {
      ok: false,
      status: 'unavailable',
      places: [],
      summary: null,
      error: (placesRes as { error?: string }).error || `geoapify_http_${placesRes.status ?? 'error'}`,
    };
  }

  const places = placesRes.ok
    ? normalizeNearbyPlaces(placesRes.data?.features, params.lat, params.lng)
    : [];
  const summary = placesRes.ok ? summarizeNearbyPlacesForInsights(places) : null;

  const revProps = revRes?.ok
    ? (revRes.data?.results?.[0] || revRes.data?.features?.[0]?.properties || {})
    : {};
  const nb = revProps.suburb || revProps.neighbourhood || revProps.neighborhood || revProps.district || revProps.city_district || null;
  const county = typeof revProps.county === 'string' && revProps.county.trim() ? revProps.county.trim() : null;
  const cityRaw = revProps.city || revProps.town || revProps.village || null;
  const city = typeof cityRaw === 'string' && cityRaw.trim() ? cityRaw.trim() : null;

  const status: 'ok' | 'partial' =
    placesRes.ok && (!params.includeReverseGeocode || revRes?.ok) ? 'ok' : 'partial';

  return {
    ok: true,
    status,
    places,
    summary,
    ...(params.includeReverseGeocode
      ? {
          reverse: {
            county,
            neighborhood: typeof nb === 'string' && nb.trim() ? nb.trim() : null,
            city,
          },
        }
      : {}),
  };
}

export async function fetchLevel2CensusSchoolDistrict(params: {
  lat: number;
  lng: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<Level2CensusSchoolDistrictResult> {
  if (!isValidLatLng(params.lat, params.lng)) {
    return {
      ok: false,
      status: 'unavailable',
      unified_district: null,
      elementary_district: null,
      secondary_district: null,
      primary_district: null,
      error: 'invalid_coordinates',
    };
  }

  const doFetch = params.fetchImpl || fetch;
  const timeoutMs = Math.min(Math.max(params.timeoutMs ?? 4000, 500), 10_000);
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await doFetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      return {
        ok: false,
        status: 'unavailable',
        unified_district: null,
        elementary_district: null,
        secondary_district: null,
        primary_district: null,
        error: `tigerweb_http_${res.status}`,
      };
    }
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    let unified: string | null = null;
    let secondary: string | null = null;
    let elementary: string | null = null;

    for (const entry of results) {
      const layerName = String(entry?.layerName || '').toLowerCase();
      const attrs = (entry?.attributes && typeof entry.attributes === 'object')
        ? (entry.attributes as Record<string, unknown>)
        : {};
      const nameRaw = attrs.NAME ?? attrs.BASENAME ?? entry?.value;
      const name = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : null;
      if (!name || /school districts not defined/i.test(name)) continue;
      if (layerName.includes('unified') || entry?.layerId === 0) {
        if (!unified) unified = name;
      } else if (layerName.includes('secondary') || entry?.layerId === 1) {
        if (!secondary) secondary = name;
      } else if (layerName.includes('elementary') || entry?.layerId === 2) {
        if (!elementary) elementary = name;
      } else if (!unified) {
        unified = name;
      }
    }

    const primary = unified || secondary || elementary || null;
    return {
      ok: Boolean(primary),
      status: primary ? 'ok' : 'unavailable',
      unified_district: unified,
      elementary_district: elementary,
      secondary_district: secondary,
      primary_district: primary,
    };
  } catch (err) {
    return {
      ok: false,
      status: 'unavailable',
      unified_district: null,
      elementary_district: null,
      secondary_district: null,
      primary_district: null,
      error: err instanceof Error ? err.message : 'tigerweb_fetch_failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

