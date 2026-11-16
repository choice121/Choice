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
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
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

/**
 * Return only listing facts tied to the requested Zillow ID. The asking rent
 * comes from Zillow's price field, never from rentZestimate.
 */
export function extractVerifiedZillowRental(
  html: string,
  zpid: string,
): Record<string, unknown> | null {
  const property = verifiedRentalProperty(html, zpid);
  if (!property) return null;

  const address = objectValue(property.address);
  const resoFacts = objectValue(property.resoFacts);
  const attribution = objectValue(property.attributionInfo);
  const street = textValue(address.streetAddress || property.streetAddress);
  const unitMatch = street ? street.match(/(?:,?\s+(?:#|apt\.?|unit|ste\.?|suite)\s*([a-z0-9-]+))$/i) : null;
  const unitNumber = textValue(address.unitNumber || property.unitNumber || resoFacts.unitNumber) ||
    (unitMatch ? unitMatch[1].trim() : null);
  const city = textValue(address.city || property.city);
  const state = textValue(address.state || property.state);
  const zip = textValue(address.zipcode || property.zipcode);
  const county = textValue(property.county || address.county);
  const neighborhood = textValue(
    property.neighborhoodName || property.neighborhood || resoFacts.subdivision || address.neighborhood,
  );
  const bedrooms = numericValue(property.bedrooms ?? property.beds);
  const bathrooms = numericValue(property.bathrooms ?? property.baths);
  const halfBathrooms = bathrooms != null && bathrooms % 1 !== 0 ? 1 : null;
  const propertyType = textValue(property.homeType || property.propertyType);
  const propertySubtype = textValue(
    resoFacts.propertySubType || property.homeSubType || resoFacts.structureType,
  );
  const title = textValue(property.title) ||
    (street && city && state
      ? `${street}, ${city}, ${state}${zip ? ` ${zip}` : ""}`
      : street && city
      ? `${street}, ${city}`
      : city
      ? `${bedrooms ? `${bedrooms}BR ` : ""}${propertyType || "Rental"} in ${city}`
      : street);

  const photos: Array<{ url: string; caption?: string | null; room_label?: string | null }> = [];
  const seenUrls = new Set<string>();
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
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        const obj = objectValue(item);
        const cap = textValue(obj.caption || obj.description);
        const room = textValue(obj.subjectType || obj.roomType);
        photos.push(cap || room ? { url, caption: cap, room_label: room } : { url });
      }
      if (photos.length >= 50) break;
    }
    if (photos.length >= 50) break;
  }
  for (const key of ["desktopWebHdpImageLink", "heroImage"]) {
    const url = photoUrl(property[key]);
    if (url && !seenUrls.has(url) && photos.length < 50) {
      seenUrls.add(url);
      photos.push({ url });
    }
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
  ].filter((a) => !/smoke|smoking|tobacco/i.test(a));

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
  const appliances = featureStrings(resoFacts.appliances);
  const flooring = Array.isArray(resoFacts.flooring)
    ? featureStrings(resoFacts.flooring)
    : (textValue(resoFacts.flooring) ? [textValue(resoFacts.flooring)!] : []);
  const utilitiesIncluded = Array.isArray(resoFacts.utilitiesIncluded)
    ? featureStrings(resoFacts.utilitiesIncluded)
    : featureStrings(resoFacts.utilities);

  let lotSqft = numericValue(property.lotAreaValue ?? property.lotSize ?? property.lotSizeSquareFeet);
  const lotUnit = String(property.lotAreaUnit || resoFacts.lotAreaUnits || "").toLowerCase();
  if (lotSqft && (lotUnit.includes("acre") || /\bac\b/.test(lotUnit))) {
    lotSqft = Math.round(lotSqft * 43560);
  }

  const centralAir = resoFacts.hasCooling === false
    ? false
    : cooling.length > 0
    ? cooling.some((c) => c.toLowerCase().includes("central"))
    : null;
  const basement = typeof resoFacts.basement === "boolean"
    ? resoFacts.basement
    : textValue(resoFacts.basement)
    ? !/^(?:none|no(?:\s+basement)?|false|n\/a)$/i.test(textValue(resoFacts.basement)!)
    : null;

  const vtour = textValue(
    property.virtualTourUrl || property.threeDimensionalTourUrl || property.tour3d || property.view3dUrl ||
      resoFacts.virtualTourUrl || resoFacts.threeDimensionalTourUrl,
  );
  const evCharging = textValue(resoFacts.electricVehicleChargingStations || resoFacts.evCharger) ||
    (parking.some((f) => /\bev\b|electric vehicle|charging/i.test(f)) ? "EV Charging Available" : null);
  const hoaFee = numericValue(property.monthlyHoaFee ?? property.hoaFee ?? resoFacts.hoaFee);
  const hoaFreq = textValue(resoFacts.hoaFeeFrequency || property.hoaFeeFrequency) ||
    (property.monthlyHoaFee ? "Monthly" : null);
  const taxAnnual = numericValue(property.taxAnnualAmount ?? resoFacts.taxAnnualAmount);
  const leaseRaw = resoFacts.leaseTerm || resoFacts.leaseTerms || resoFacts.minimumLease;
  const leaseStr = Array.isArray(leaseRaw) ? leaseRaw.map(String).join(" ") : textValue(leaseRaw);
  let minLease: number | null = null;
  if (leaseStr) {
    const m = leaseStr.toLowerCase().match(/(\d+)\s*month/);
    if (m) minLease = parseInt(m[1], 10);
    else if (/month[\s-]*to[\s-]*month|m2m|mtm/i.test(leaseStr)) minLease = 1;
    else if (/\byear\b|12[\s-]*month|annual/i.test(leaseStr)) minLease = 12;
  }

  const ctxParts: string[] = [];
  if (property.walkScore != null) ctxParts.push(`Walk score: ${property.walkScore}`);
  if (property.transitScore != null) ctxParts.push(`Transit score: ${property.transitScore}`);
  if (property.bikeScore != null) ctxParts.push(`Bike score: ${property.bikeScore}`);

  return {
    title,
    address: street,
    unit_number: unitNumber,
    city,
    state,
    zip,
    county,
    neighborhood,
    location_context: ctxParts.length ? ctxParts.join("; ") : null,
    property_type: propertyType,
    property_subtype: propertySubtype,
    bedrooms,
    bathrooms,
    half_bathrooms: halfBathrooms,
    total_bathrooms: bathrooms,
    monthly_rent: parsePositiveNumber(property.price ?? property.unformattedPrice),
    square_footage: numericValue(
      property.livingArea ?? property.livingAreaValue ?? resoFacts.livingArea,
    ),
    lot_size_sqft: lotSqft,
    year_built: numericValue(property.yearBuilt ?? resoFacts.yearBuilt),
    floors: numericValue(property.stories ?? resoFacts.stories),
    garage_spaces: numericValue(property.garageParkingCapacity ?? property.garageSpaces ?? resoFacts.garageSpaces),
    total_units: numericValue(property.unitCount ?? property.numberOfUnitsTotal),
    description: textValue(property.description || resoFacts.description),
    original_description: textValue(property.description || resoFacts.description),
    showing_instructions: textValue(resoFacts.showingInstructions || property.showingInstructions),
    lat: numericValue(property.latitude ?? latLong.latitude),
    lng: numericValue(property.longitude ?? latLong.longitude),
    pets_allowed: petsAllowed,
    pet_types_allowed: JSON.stringify(petTypes),
    pet_weight_limit: numericValue(resoFacts.petWeightLimit),
    pet_details: textValue(resoFacts.petRestrictions || resoFacts.petsComments),
    available_date: textValue(resoFacts.dateAvailable || resoFacts.availableFrom || property.dateAvailable),
    minimum_lease_months: minLease,
    lease_terms: leaseRaw ? JSON.stringify(Array.isArray(leaseRaw) ? leaseRaw : [String(leaseRaw)]) : null,
    smoking_allowed: typeof resoFacts.smokingAllowed === "boolean" ? resoFacts.smokingAllowed : null,
    security_deposit: numericValue(resoFacts.securityDeposit),
    pet_deposit: numericValue(resoFacts.petFee ?? resoFacts.petDepositFee ?? resoFacts.petDeposit),
    admin_fee: numericValue(resoFacts.adminFee),
    parking_fee: numericValue(resoFacts.parkingFee),
    application_fee: numericValue(resoFacts.applicationFeeAmount ?? resoFacts.applicationFee),
    hoa_fee: hoaFee,
    hoa_fee_frequency: hoaFreq,
    tax_annual_amount: taxAnnual,
    last_months_rent: numericValue(resoFacts.lastMonthRent),
    move_in_special: textValue(resoFacts.concessions)?.slice(0, 200) || null,
    parking: parking.join(", ") || textValue(property.parkingType),
    ev_charging: evCharging,
    amenities: JSON.stringify([...new Set(amenities)]),
    appliances: JSON.stringify(appliances),
    utilities_included: JSON.stringify(utilitiesIncluded),
    flooring: flooring.length ? JSON.stringify(flooring) : null,
    heating_type: heating.join(", ") || textValue(resoFacts.heating),
    cooling_type: cooling.join(", ") || textValue(resoFacts.cooling),
    laundry_type: laundry.join(", ") || textValue(resoFacts.laundry),
    has_basement: basement,
    has_central_air: centralAir,
    virtual_tour_url: vtour,
    listed_at: textValue(property.datePosted || resoFacts.listingDate || property.datePostedString),
    source_last_updated_at: textValue(property.dateSold || property.updatedAt),
    agent_name: textValue(attribution.agentName || property.agentName),
    broker_name: textValue(
      attribution.brokerName || property.brokerName || property.brokerageName,
    ),
    source_status: status,
    original_image_urls: JSON.stringify(photos),
    structural_details: {
      architectural_style: textValue(resoFacts.architecturalStyle),
      construction_materials: resoFacts.constructionMaterials || null,
      foundation_details: resoFacts.foundationDetails || null,
      roof: resoFacts.roofType || resoFacts.roof || null,
      exterior_features: resoFacts.exteriorFeatures || null,
      interior_features: resoFacts.interiorFeatures || null,
      fencing: resoFacts.fencing || null,
      patio_and_porch_features: resoFacts.patioAndPorchFeatures || null,
      fireplace_features: resoFacts.fireplaceFeatures || null,
      pool_features: resoFacts.poolFeatures || null,
      accessibility_features: resoFacts.accessibilityFeatures || null,
      ev_charging: evCharging,
    },
    utility_details: {
      utilities_included_confirmed: Array.isArray(resoFacts.utilitiesIncluded) ? resoFacts.utilitiesIncluded : null,
      utilities: resoFacts.utilities || null,
      electric: resoFacts.electric || null,
      gas: resoFacts.gas || null,
      water_source: resoFacts.waterSource || null,
      sewer: resoFacts.sewer || null,
      green_energy: resoFacts.greenEnergyEfficient || null,
      heating_systems: resoFacts.heating || null,
      cooling_systems: resoFacts.cooling || null,
    },
    financial_details: {
      price_per_sqft: resoFacts.pricePerSquareFoot || property.pricePerSquareFoot || null,
      zestimate: property.zestimate || null,
      rent_zestimate: property.rentZestimate || null,
      hoa_fee: hoaFee,
      hoa_fee_frequency: hoaFreq,
      tax_annual_amount: taxAnnual,
      concessions: resoFacts.concessions || null,
      price_history: Array.isArray(property.priceHistory) ? property.priceHistory.slice(0, 25) : null,
      tax_history: Array.isArray(property.taxHistory) ? property.taxHistory.slice(0, 15) : null,
    },
    location_details: {
      county,
      neighborhood,
      subdivision: textValue(resoFacts.subdivision),
      school_district: textValue(resoFacts.highSchoolDistrict || resoFacts.elementarySchoolDistrict),
      schools: Array.isArray(property.schools) ? property.schools.slice(0, 10) : null,
      walk_score: property.walkScore ?? null,
      transit_score: property.transitScore ?? null,
      bike_score: property.bikeScore ?? null,
    },
    floor_plans: Array.isArray(property.floorPlans || property.buildingFloorPlans || resoFacts.floorPlans)
      ? (property.floorPlans || property.buildingFloorPlans || resoFacts.floorPlans).slice(0, 20)
      : null,
    videos: vtour ? [{ url: vtour, title: "3D / Virtual Tour", type: "virtual_tour" }] : null,
    source_raw_payload: {
      source: "zillow",
      zpid: property.zpid || zpid,
      homeStatus: property.homeStatus || null,
      homeType: property.homeType || null,
      resoFacts,
      attributionInfo: attribution,
    },
  };
}
