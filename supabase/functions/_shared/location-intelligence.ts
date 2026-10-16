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
