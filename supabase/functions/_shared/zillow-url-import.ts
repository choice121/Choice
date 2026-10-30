const ZILLOW_HOSTS = new Set(["zillow.com", "www.zillow.com"]);
const DETAIL_PATH_RE = /^\/homedetails\/.+\/(\d+)_zpid\/?$/i;

export type ZillowDetailUrlResult =
  | { ok: true; url: URL; zpid: string }
  | { ok: false; error: string };

export function parseZillowDetailUrl(value: unknown): ZillowDetailUrlResult {
  if (typeof value !== "string" || value.length > 2048) {
    return { ok: false, error: "Enter a Zillow home-details URL." };
  }

  let input: URL;
  try {
    input = new URL(value);
  } catch {
    return { ok: false, error: "The URL is invalid." };
  }

  if (
    input.protocol !== "https:" ||
    !ZILLOW_HOSTS.has(input.hostname.toLowerCase()) ||
    input.username ||
    input.password
  ) {
    return { ok: false, error: "Only HTTPS Zillow listing URLs are supported." };
  }

  const match = input.pathname.match(DETAIL_PATH_RE);
  if (!match) {
    return { ok: false, error: "Use a Zillow home-details page, not a search page." };
  }

  // Normalize the host and discard tracking parameters before persisting provenance.
  const url = new URL(`https://www.zillow.com${input.pathname}`);
  return { ok: true, url, zpid: match[1] };
}

function findPropertyByZpid(root: unknown, zpid: string): Record<string, unknown> | null {
  const stack: unknown[] = [root];
  const visited = new Set<object>();
  let nodesVisited = 0;

  while (stack.length > 0 && nodesVisited < 100_000) {
    const current = stack.pop();
    if (typeof current === "string") {
      const serialized = current.trim();
      if (
        serialized.length <= 5 * 1024 * 1024 &&
        /^[\[{]/.test(serialized) &&
        /"zpid"\s*:/.test(serialized)
      ) {
        try {
          stack.push(JSON.parse(serialized) as unknown);
        } catch {
          // Ignore unrelated or malformed serialized page data.
        }
      }
      continue;
    }
    if (!current || typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);
    nodesVisited++;

    if (!Array.isArray(current)) {
      const object = current as Record<string, unknown>;
      if (object.zpid != null && String(object.zpid) === zpid) return object;
    }

    for (const value of Object.values(current)) stack.push(value);
  }

  return null;
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function hasPositiveAskingPrice(property: Record<string, unknown>): boolean {
  // Do not treat rentZestimate as an asking rent; it is only an estimate.
  const raw = property.price ?? property.unformattedPrice;
  return parsePositiveNumber(raw) !== null;
}

function hasRentStatus(property: Record<string, unknown>, html: string): boolean {
  const statusFields = [
    property.homeStatus,
    property.homeStatusType,
    property.listingStatus,
    property.propertyStatus,
    property.availabilityStatus,
  ];
  const statuses = statusFields
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toUpperCase().replace(/[\s-]+/g, "_"));

  if (statuses.some((status) => /FOR_RENT|RENTAL/.test(status))) return true;
  if (statuses.some((status) => /FOR_SALE|SOLD|NOT_FOR_RENT|OFF_MARKET/.test(status))) return false;

  const visibleText = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&");

  return /\b(?:house|home|single family residence|apartment|condo|townhouse|townhome|multi[- ]family|studio)\s+for\s+rent\b/i
    .test(visibleText);
}

/**
 * Require the exact Zillow property object, a positive asking price, and an
 * explicit rental signal. This prevents importing estimates or sale listings
 * as rentals.
 */
function verifiedRentalProperty(html: string, zpid: string): Record<string, unknown> | null {
  const nextData = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!nextData?.[1]) return null;

  try {
    const root = JSON.parse(nextData[1]) as unknown;
    const property = findPropertyByZpid(root, zpid);
    return property &&
        hasPositiveAskingPrice(property) &&
        hasRentStatus(property, html)
      ? property
      : null;
  } catch {
    return null;
  }
}

export function isExplicitZillowRentalPage(html: string, zpid: string): boolean {
  return verifiedRentalProperty(html, zpid) !== null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text || null;
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function featureStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(textValue).filter((item): item is string => !!item);
}

function photoUrl(value: unknown): string | null {
  if (typeof value === "string") return value.startsWith("https://") ? value : null;
  const photo = objectValue(value);
  const mixedSources = objectValue(photo.mixedSources);
  const jpegPhotos = Array.isArray(mixedSources.jpeg) ? mixedSources.jpeg : [];
  let largest: Record<string, unknown> | null = null;
  for (const item of jpegPhotos) {
    const candidate = objectValue(item);
    if (
      !largest ||
      Number(candidate.width || 0) > Number(largest.width || 0)
    ) largest = candidate;
  }
  return textValue(largest?.url || photo.url || photo.href || photo.src);
}

function collectZillowMedia(property: Record<string, unknown>): Record<string, unknown>[] {
  const media: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const add = (value: unknown, hint: string) => {
    const item = typeof value === "string" ? { url: value } : objectValue(value);
    const rawUrl = textValue(item.url || item.href || item.src || item.embedUrl || item.embed_url || item.contentUrl);
    if (!rawUrl) return;

    let url: URL;
    try {
      url = new URL(rawUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") return;
    } catch {
      return;
    }

    const description = [
      item.kind, item.type, item.mediaType, item.media_type, item.category,
      item.title, item.name, item.label, hint, url.href,
    ].map(textValue).filter(Boolean).join(" ").toLowerCase();
    let kind: string | null = null;
    if (/floor[\s_-]*plan|floorplan/.test(description)) kind = "floor_plan";
    else if (/video|walkthrough|youtube|vimeo|\.(?:mp4|webm|mov)(?:[?#]|$)/i.test(description)) kind = "video";
    else if (/virtual[\s_-]*tour|3d[\s_-]*tour|matterport|insidemaps|view-3d|view-imx|tour3d|\btour\b/i.test(description)) kind = "virtual_tour";
    if (!kind) return;

    const key = `${kind}::${url.href.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    media.push({
      kind,
      title: textValue(item.title || item.name || item.label) || (kind === "floor_plan" ? "Floor plan" : kind === "video" ? "Video walkthrough" : "3D virtual tour"),
      floor_label: textValue(item.floor_label || item.floorLabel || item.floor),
      provider: textValue(item.provider || item.source),
      url: url.href,
      poster_url: textValue(item.poster_url || item.posterUrl || item.thumbnailUrl),
      display_order: media.length,
      metadata: objectValue(item.metadata),
    });
  };

  const mediaFields: Array<[string, string]> = [
    ["floorPlans", "floor plan"], ["floor_plans", "floor plan"],
    ["floorPlanImages", "floor plan"], ["floorPlan", "floor plan"],
    ["floorplan", "floor plan"], ["floor_plan", "floor plan"],
    ["videos", "video"], ["video", "video"], ["propertyVideos", "video"],
    ["virtualTours", "virtual tour"], ["virtual_tours", "virtual tour"],
    ["virtualTour", "virtual tour"], ["threeDimensionalTours", "3d tour"],
    ["tours", "virtual tour"], ["media", "media"],
  ];
  mediaFields.forEach(([field, hint]) => {
    const value = property[field];
    if (Array.isArray(value)) value.forEach(item => add(item, hint));
    else if (value) add(value, hint);
  });

  const legacyTour = property.virtualTourUrl || property.threeDimensionalTourUrl ||
    property.tour3d || property.view3dUrl ||
    (property.view3dHomeId ? `https://www.zillow.com/view-3d-home/${property.view3dHomeId}` : null);
  if (legacyTour) add(legacyTour, "virtual tour");
  return media;
}

/**
 * Return only listing facts tied to the requested Zillow ID. The asking rent
 * comes from Zillow's price field, never from rentZestimate.
 */
export function extractVerifiedZillowRental(
  html: string,
  zpid: string): Record<string, unknown> | null {
  const property = verifiedRentalProperty(html, zpid);
  if (!property) return null;

  const address = objectValue(property.address);
  const resoFacts = objectValue(property.resoFacts);
  const attribution = objectValue(property.attributionInfo);
  const street = textValue(address.streetAddress || property.streetAddress);
  const city = textValue(address.city || property.city);
  const state = textValue(address.state || property.state);
  const zip = textValue(address.zipcode || property.zipcode);
  const bedrooms = numericValue(property.bedrooms ?? property.beds);
  const bathrooms = numericValue(property.bathrooms ?? property.baths);
  const propertyType = textValue(property.homeType || property.propertyType);
  const title = textValue(property.title) ||
    (street && city && state
      ? `${street}, ${city}, ${state}${zip ? ` ${zip}` : ""}`
      : street && city
      ? `${street}, ${city}`
      : city
      ? `${bedrooms ? `${bedrooms}BR ` : ""}${propertyType || "Rental"} in ${city}`
      : street);

  const photos: string[] = [];
  for (const collection of [
    property.responsivePhotosOriginalRatio,
    property.responsivePhotos,
    property.hugePhotos,
    property.largePhotos,
    property.photos,
  ]) {
    if (!Array.isArray(collection)) continue;
    for (const item of collection) {
      const url = photoUrl(item);
      if (url && !photos.includes(url)) photos.push(url);
      if (photos.length >= 50) break;
    }
    if (photos.length >= 50) break;
  }
  for (const key of ["desktopWebHdpImageLink", "heroImage"]) {
    const url = photoUrl(property[key]);
    if (url && !photos.includes(url) && photos.length < 50) photos.push(url);
  }

  const petTypes: string[] = [];
  if (resoFacts.catsAllowed === true) petTypes.push("cats");
  if (resoFacts.dogsAllowed === true) petTypes.push("dogs");
  const petsAllowed = typeof resoFacts.petsAllowed === "boolean"
    ? resoFacts.petsAllowed
    : petTypes.length > 0
    ? true
    : resoFacts.catsAllowed === false && resoFacts.dogsAllowed === false
    ? false
    : null;

  const amenities = [
    ...featureStrings(property.tags),
    ...featureStrings(resoFacts.communityFeatures),
    ...featureStrings(resoFacts.interiorFeatures),
    ...featureStrings(resoFacts.exteriorFeatures),
    ...featureStrings(resoFacts.lotFeatures),
    ...featureStrings(resoFacts.poolFeatures),
    ...featureStrings(resoFacts.accessibilityFeatures),
  ];
  const parking = featureStrings(resoFacts.parkingFeatures);
  const status = [
    property.homeStatus,
    property.homeStatusType,
    property.listingStatus,
  ].map(textValue).find((value) => value !== null);

  const latLong = objectValue(property.latLong);
  const heating = featureStrings(resoFacts.heating);
  const cooling = featureStrings(resoFacts.cooling);
  const laundry = featureStrings(resoFacts.laundryFeatures);
  const media = collectZillowMedia(property);
  const virtualTour = media.find(item => item.kind === "virtual_tour" || item.kind === "tour_3d");

  return {
    title,
    address: street,
    city,
    state,
    zip,
    property_type: propertyType,
    bedrooms,
    bathrooms,
    total_bathrooms: bathrooms,
    monthly_rent: parsePositiveNumber(property.price ?? property.unformattedPrice),
    square_footage: numericValue(
      property.livingArea ?? property.livingAreaValue ?? resoFacts.livingArea),
    lot_size_sqft: numericValue(property.lotAreaValue ?? property.lotSize),
    year_built: numericValue(property.yearBuilt ?? resoFacts.yearBuilt),
    description: textValue(property.description || resoFacts.description),
    lat: numericValue(property.latitude ?? latLong.latitude),
    lng: numericValue(property.longitude ?? latLong.longitude),
    pets_allowed: petsAllowed,
    pet_types_allowed: JSON.stringify(petTypes),
    parking: parking.join(", ") || textValue(property.parkingType),
    amenities: JSON.stringify([...new Set(amenities)]),
    heating_type: heating.join(", ") || textValue(resoFacts.heating),
    cooling_type: cooling.join(", ") || textValue(resoFacts.cooling),
    laundry_type: laundry.join(", ") || textValue(resoFacts.laundry),
    agent_name: textValue(attribution.agentName || property.agentName),
    broker_name: textValue(
      attribution.brokerName || property.brokerName || property.brokerageName),
    virtual_tour_url: virtualTour ? virtualTour.url : null,
    media,
    source_status: status,
    original_image_urls: JSON.stringify(photos),
  };
}
