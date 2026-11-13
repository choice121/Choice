// ============================================================
// Choice Properties — Zillow Extractor (Deno/TypeScript)
// GENERATED FILE — DO NOT EDIT DIRECTLY.
// Edit src/extractors/shared-extractors.js and run:
//   node scripts/build-extractors.js
// ============================================================

// This module provides the Zillow extraction logic for the
// import-from-url Edge Function. It parses __NEXT_DATA__ JSON
// from a Zillow listing page and returns a normalized payload.

export interface ZillowExtracted {
  source: string;
  source_listing_id: string;
  source_url: string | null;
  title: string | null;
  address: string | null;
  unit_number: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  monthly_rent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  half_bathrooms: number | null;
  total_bathrooms: number | null;
  square_footage: number | null;
  lot_size_sqft: number | null;
  year_built: number | null;
  floors: number | null;
  garage_spaces: number | null;
  total_units: number | null;
  property_type: string | null;
  property_subtype: string | null;
  description: string | null;
  original_description: string | null;
  showing_instructions: string | null;
  neighborhood: string | null;
  county: string | null;
  location_context: string | null;
  pets_allowed: boolean | null;
  pet_types_allowed: string | null;
  pet_weight_limit: number | null;
  pet_details: string | null;
  available_date: string | null;
  listed_at: string | null;
  source_last_updated_at: string | null;
  source_status: string | null;
  minimum_lease_months: number | null;
  lease_terms: string | null;
  smoking_allowed: boolean | null;
  security_deposit: number | null;
  pet_deposit: number | null;
  admin_fee: number | null;
  parking_fee: number | null;
  application_fee: number | null;
  hoa_fee: number | null;
  hoa_fee_frequency: string | null;
  tax_annual_amount: number | null;
  last_months_rent: number | null;
  move_in_special: string | null;
  parking: string | null;
  ev_charging: string | null;
  amenities: string | null;
  appliances: string | null;
  flooring: string | null;
  utilities_included: string | null;
  heating_type: string | null;
  cooling_type: string | null;
  laundry_type: string | null;
  virtual_tour_url: string | null;
  has_basement: boolean | null;
  has_central_air: boolean | null;
  original_image_urls: string;
  agent_name: string | null;
  broker_name: string | null;
  structural_details: Record<string, unknown> | null;
  utility_details: Record<string, unknown> | null;
  financial_details: Record<string, unknown> | null;
  location_details: Record<string, unknown> | null;
  floor_plans: unknown[] | null;
  videos: unknown[] | null;
  source_raw_payload: Record<string, unknown> | null;
}

// ── Type coercion helpers ──────────────────────────────────────────────
function safeInt(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseInt(String(v).replace(/[^0-9.-]/g, ''), 10);
  return isNaN(n) ? null : n;
}

function safeFloat(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function safeStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function safeBool(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === '1' || v === 1) return true;
  if (v === 'false' || v === '0' || v === 0) return false;
  return null;
}

function normalizePropType(v: unknown): string | null {
  if (!v) return null;
  const MAP: Record<string, string> = {
    'SINGLE_FAMILY': 'SINGLE_FAMILY', 'MULTI_FAMILY': 'MULTI_FAMILY',
    'CONDO': 'CONDOS', 'CONDO_TOWNHOME': 'CONDOS', 'TOWNHOUSE': 'TOWNHOMES',
    'APARTMENT': 'APARTMENT', 'MANUFACTURED': 'MOBILE', 'MOBILE': 'MOBILE',
    'LOT': 'LAND', 'LAND': 'LAND', 'FARM': 'FARM',
  };
  const up = String(v).trim().toUpperCase();
  return (MAP[up] ?? up.replace(/[\s-]+/g, '_')) || null;
}

function normalizeDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  if (/^\d{13}$/.test(s)) { try { return new Date(parseInt(s)).toISOString().slice(0, 10); } catch { /* ignore */ } }
  if (/^\d{10}$/.test(s)) { try { return new Date(parseInt(s) * 1000).toISOString().slice(0, 10); } catch { /* ignore */ } }
  try { const d = new Date(s); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10); } catch { /* ignore */ }
  return s.slice(0, 40);
}

// ── Zillow __NEXT_DATA__ extraction ───────────────────────────────────
export function extractFromNextData(html: string): Record<string, unknown> | { _error: string; _blocked?: boolean } {
  // Extract __NEXT_DATA__ script tag via regex
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([^<]{10,})<\/script>/i);
  if (!match) {
    // Check if this looks like a CAPTCHA or bot-check page
    if (html.includes('captcha') || html.includes('robot') || html.includes('challenge')) {
      return { _error: 'blocked', _blocked: true };
    }
    return { _error: 'No __NEXT_DATA__ found — this URL may not be a Zillow listing detail page' };
  }

  let nd: Record<string, unknown>;
  try { nd = JSON.parse(match[1]); } catch (e) {
    return { _error: 'Could not parse __NEXT_DATA__: ' + (e as Error).message };
  }

  // Traverse known cache paths to find the property object
  const cachePaths = [
    ['props', 'pageProps', 'componentProps', 'gdpClientCache'],
    ['props', 'pageProps', 'initialData', 'gdpClientCache'],
    ['props', 'pageProps', 'gdpClientCache'],
  ];

  // deno-lint-ignore no-explicit-any
  let prop: any = null;
  for (const path of cachePaths) {
    if (prop) break;
    try {
      // deno-lint-ignore no-explicit-any
      let node: any = nd;
      for (const key of path) { node = node?.[key]; }
      if (!node) continue;
      const cache = typeof node === 'string' ? JSON.parse(node) : node;
      if (typeof cache !== 'object' || !cache) continue;
      for (const v of Object.values(cache as Record<string, unknown>)) {
        // deno-lint-ignore no-explicit-any
        const vv = v as any;
        if (vv?.property?.zpid) { prop = vv.property; break; }
        if (vv?.data?.property?.zpid) { prop = vv.data.property; break; }
        if (vv?.zpid !== undefined && (vv?.bedrooms !== undefined || vv?.price !== undefined)) { prop = vv; break; }
      }
    } catch { /* try next path */ }
  }

  // Fallback: homeDetails directly on componentProps
  if (!prop) {
    try {
      // deno-lint-ignore no-explicit-any
      const cp = (nd as any)?.props?.pageProps?.componentProps;
      if (cp?.homeDetails?.zpid) prop = cp.homeDetails;
    } catch { /* ignore */ }
  }

  if (!prop) {
    return { _error: 'Could not find listing data in __NEXT_DATA__ — make sure you are on a single listing detail page, not search results' };
  }

  // deno-lint-ignore no-explicit-any
  const rf   = (prop.resoFacts   || {}) as Record<string, any>;
  // deno-lint-ignore no-explicit-any
  const addr = (prop.address     || {}) as Record<string, any>;
  // deno-lint-ignore no-explicit-any
  const ai   = (prop.attributionInfo || {}) as Record<string, any>;

  // Photos: best JPEG from mixedSources, deduplicated
  function bestJpeg(ms: Record<string, unknown> | null | undefined): string | null {
    // deno-lint-ignore no-explicit-any
    const jpegs: any[] = (ms as any)?.jpeg || [];
    let best: string | null = null, bestW = 0;
    for (const j of jpegs) { if ((j.width || 0) > bestW) { bestW = j.width; best = j.url || null; } }
    return best;
  }
  const photoSeen = new Set<string>();
  const photos: string[] = [];
  function addPhoto(u: unknown) {
    if (u && typeof u === 'string' && u.startsWith('http') && !photoSeen.has(u)) {
      photos.push(u); photoSeen.add(u);
    }
  }
  // deno-lint-ignore no-explicit-any
  for (const p of (prop.responsivePhotosOriginalRatio as any[]) || []) addPhoto(bestJpeg(p.mixedSources) || p.url);
  // deno-lint-ignore no-explicit-any
  for (const p of (prop.responsivePhotos as any[]) || []) addPhoto(bestJpeg(p.mixedSources) || p.url);
  // deno-lint-ignore no-explicit-any
  for (const p of (prop.hugePhotos || prop.largePhotos || []) as any[]) addPhoto(typeof p === 'string' ? p : (p?.url || p?.href || p?.src));
  // deno-lint-ignore no-explicit-any
  for (const p of (prop.photos || []) as any[]) addPhoto(typeof p === 'string' ? p : (p?.url || p?.href || p?.src));
  addPhoto(prop.desktopWebHdpImageLink);
  addPhoto(prop.heroImage);
  const photosCapped = photos.slice(0, 50);

  // Price (asking rent only; never substitute rentZestimate for asking rent)
  let rent: number | null = null;
  const rawPrice = prop.price || prop.unformattedPrice;
  if (typeof rawPrice === 'number' && rawPrice > 0) { rent = rawPrice; }
  else if (typeof rawPrice === 'string') { const d = rawPrice.replace(/[^0-9]/g, ''); rent = d ? parseInt(d, 10) : null; }

  // Bathrooms (Decimal precision without truncation per Rule 6A)
  const bathsRaw = prop.bathrooms ?? prop.baths ?? null;
  const bathVal = bathsRaw != null ? parseFloat(String(bathsRaw)) : null;
  const bathH = bathVal != null && (bathVal % 1 !== 0) ? 1 : null;

  // Lot size → sqft
  let lotSqft: number | null = null;
  if (prop.lotAreaValue) {
    const lv = parseFloat(String(prop.lotAreaValue));
    const lu = String(prop.lotAreaUnit || rf.lotAreaUnits || '').toLowerCase();
    if (!isNaN(lv) && lv > 0) lotSqft = (lu.includes('acre') || /\bac\b/.test(lu)) ? Math.round(lv * 43560) : Math.round(lv);
  } else if (prop.lotSize) {
    const lsStr = String(prop.lotSize);
    const ls = parseFloat(lsStr.replace(/,/g, ''));
    if (!isNaN(ls) && ls > 0) lotSqft = /acre/i.test(lsStr) ? Math.round(ls * 43560) : Math.round(ls);
  } else if (prop.lotSizeSquareFeet > 0) {
    lotSqft = Math.round(Number(prop.lotSizeSquareFeet));
  }

  // Min lease months
  let minLease: number | null = null;
  const ltRaw = rf.leaseTerm || rf.leaseTerms || rf.minimumLease || null;
  if (ltRaw) {
    const lt = String(ltRaw).toLowerCase();
    const mmo = lt.match(/(\d+)\s*month/);
    if (mmo) minLease = parseInt(mmo[1], 10);
    else if (/month.to.month|m2m|mtm/.test(lt)) minLease = 1;
    else if (/\byear\b|12[\s-]*month|annual/.test(lt)) minLease = 12;
  }

  // Amenities
  const amenityMap: Record<string, boolean> = {};
  // deno-lint-ignore no-explicit-any
  for (const t of (prop.tags || []) as any[]) { const s = String(t).trim(); if (s && !/smoke|smoking|tobacco/i.test(s)) amenityMap[s] = true; }
  for (const arr of [
    rf.communityFeatures, rf.interiorFeatures, rf.exteriorFeatures,
    rf.lotFeatures, rf.poolFeatures, rf.accessibilityFeatures,
  ]) {
    // deno-lint-ignore no-explicit-any
    for (const t of (arr || []) as any[]) { const s = String(t).trim(); if (s && !/smoke|smoking|tobacco/i.test(s)) amenityMap[s] = true; }
  }

  // Walk/transit/bike + schools → location_context
  const ctxParts: string[] = [];
  if (prop.walkScore != null) ctxParts.push('Walk score: ' + prop.walkScore);
  if (prop.transitScore != null) ctxParts.push('Transit score: ' + prop.transitScore);
  if (prop.bikeScore != null) ctxParts.push('Bike score: ' + prop.bikeScore);

  // Parking & EV
  let parking: string | null = null;
  if (rf.parkingFeatures?.length) parking = (rf.parkingFeatures as string[]).join(', ');
  else if (prop.parkingType) parking = String(prop.parkingType).replace(/_/g, ' ');
  const evCharging: string | null = rf.electricVehicleChargingStations || rf.evCharger ||
    ((rf.parkingFeatures as string[] | undefined)?.some((f: string) => /\bev\b|electric vehicle|charging/i.test(f)) ? 'EV Charging Available' : null);

  // Central air + basement (distinguish false vs unknown)
  let centralAir: boolean | null = rf.hasCooling === false ? false : null;
  if (Array.isArray(rf.cooling) && rf.cooling.length) {
    centralAir = (rf.cooling as string[]).some((c: string) => c.toLowerCase().includes('central'));
  }
  let basement: boolean | null = null;
  if (typeof rf.basement === 'boolean') basement = rf.basement;
  else if (typeof rf.basement === 'string' && rf.basement.trim()) {
    basement = !/^(?:none|no(?:\s+basement)?|false|n\/a)$/i.test(rf.basement.trim());
  }

  // Pet types
  const petTypes: string[] = [];
  if (rf.catsAllowed) petTypes.push('cats');
  if (rf.dogsAllowed) petTypes.push('dogs');

  // Title & Unit
  const beds = prop.bedrooms ?? prop.beds ?? null;
  const propType = normalizePropType(prop.homeType);
  function fmtType(t: string | null) {
    if (!t) return 'Rental';
    return t.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }
  const streetAddr = addr.streetAddress || prop.streetAddress;
  const unitMatch = typeof streetAddr === 'string' ? streetAddr.match(/(?:,?\s+(?:#|apt\.?|unit|ste\.?|suite)\s*([a-z0-9-]+))$/i) : null;
  const unitNumber = addr.unitNumber || prop.unitNumber || rf.unitNumber || (unitMatch ? unitMatch[1].trim() : null);
  const title = (prop.title && String(prop.title).trim()) ||
    (streetAddr
      ? (city && (addr.state || prop.state)
          ? `${streetAddr}, ${city}, ${addr.state || prop.state}${addr.zipcode || prop.zipcode ? ' ' + (addr.zipcode || prop.zipcode) : ''}`
          : (city ? `${streetAddr}, ${city}` : streetAddr))
      : (city ? ((beds ? beds + 'BR ' : '') + fmtType(propType) + ' in ' + city) : 'Zillow Rental'));

  const vtour = prop.virtualTourUrl || prop.threeDimensionalTourUrl || prop.tour3d || prop.view3dUrl || (rf && (rf.virtualTourUrl || rf.threeDimensionalTourUrl)) || null;
  const sqftNum = prop.livingArea || prop.livingAreaValue || prop.area || rf.livingArea || null;
  const hoaFee = safeInt(prop.monthlyHoaFee || prop.hoaFee || rf.hoaFee);
  const hoaFreq = rf.hoaFeeFrequency || prop.hoaFeeFrequency || (prop.monthlyHoaFee ? 'Monthly' : null);
  const taxAnnual = safeInt(prop.taxAnnualAmount || rf.taxAnnualAmount);

  return {
    source: 'zillow',
    source_listing_id: String(prop.zpid || ''),
    source_url: null, // caller provides the URL
    title,
    address: addr.streetAddress || prop.streetAddress || null,
    unit_number: unitNumber,
    city,
    state: addr.state || prop.state || null,
    zip: addr.zipcode || prop.zipcode || null,
    lat: prop.latitude || (prop.latLong as Record<string, unknown> | null)?.latitude || null,
    lng: prop.longitude || (prop.latLong as Record<string, unknown> | null)?.longitude || null,
    monthly_rent: rent,
    bedrooms: beds != null ? Number(beds) : null,
    bathrooms: bathVal,
    half_bathrooms: bathH,
    total_bathrooms: bathVal,
    square_footage: sqftNum,
    lot_size_sqft: lotSqft,
    year_built: prop.yearBuilt || rf.yearBuilt || null,
    floors: prop.stories || rf.stories || null,
    garage_spaces: prop.garageParkingCapacity || prop.garageSpaces || rf.garageSpaces || null,
    total_units: prop.unitCount || prop.numberOfUnitsTotal || null,
    property_type: propType,
    property_subtype: rf.propertySubType || prop.homeSubType || rf.structureType || null,
    description: prop.description || rf.description || null,
    original_description: prop.description || rf.description || null,
    showing_instructions: rf.showingInstructions || prop.showingInstructions || null,
    neighborhood: prop.neighborhoodName || prop.neighborhood || rf.subdivision || addr.neighborhood || null,
    county: prop.county || addr.county || null,
    location_context: ctxParts.length ? ctxParts.join('; ') : null,
    available_date: normalizeDate(rf.dateAvailable || rf.availableFrom || prop.dateAvailable || rf.availabilityDate),
    listed_at: normalizeDate(prop.datePosted || rf.listingDate || rf.onMarketDate || prop.datePostedString),
    source_last_updated_at: prop.dateSold || prop.lastSoldDate || prop.updatedAt || rf.listingLastUpdatedDate || null,
    source_status: prop.homeStatus || rf.listingStatus || prop.listingStatus || null,
    minimum_lease_months: minLease,
    lease_terms: ltRaw ? JSON.stringify(Array.isArray(ltRaw) ? ltRaw : [String(ltRaw)]) : null,
    pets_allowed: prop.isPetFriendly ?? (rf.petsAllowed !== undefined ? rf.petsAllowed : null),
    pet_types_allowed: JSON.stringify(petTypes),
    pet_weight_limit: safeInt(rf.petWeightLimit),
    pet_details: rf.petRestrictions || rf.petsComments || null,
    smoking_allowed: rf.smokingAllowed != null ? !!rf.smokingAllowed : null,
    security_deposit: safeInt(rf.securityDeposit),
    pet_deposit: safeInt(rf.petFee || rf.petDepositFee || rf.petDeposit),
    admin_fee: safeInt(rf.adminFee),
    parking_fee: safeInt(rf.parkingFee),
    application_fee: safeInt(rf.applicationFeeAmount || rf.applicationFee),
    hoa_fee: hoaFee,
    hoa_fee_frequency: hoaFreq,
    tax_annual_amount: taxAnnual,
    last_months_rent: safeInt(rf.lastMonthRent),
    move_in_special: rf.concessions ? String(rf.concessions).slice(0, 200) : null,
    parking,
    ev_charging: evCharging,
    amenities: JSON.stringify(Object.keys(amenityMap)),
    appliances: JSON.stringify(rf.appliances || []),
    flooring: rf.flooring ? JSON.stringify(Array.isArray(rf.flooring) ? rf.flooring : [String(rf.flooring)]) : null,
    utilities_included: JSON.stringify(rf.utilitiesIncluded || rf.utilities || []),
    heating_type: (rf.heating as string[] | undefined)?.join(', ') || null,
    cooling_type: (rf.cooling as string[] | undefined)?.join(', ') || null,
    laundry_type: (rf.laundryFeatures as string[] | undefined)?.join(', ') || null,
    has_basement: basement,
    has_central_air: centralAir,
    virtual_tour_url: vtour,
    original_image_urls: JSON.stringify(photosCapped),
    agent_name: ai.agentName || null,
    broker_name: ai.brokerName || null,
    structural_details: {
      architectural_style: rf.architecturalStyle || null,
      construction_materials: rf.constructionMaterials || null,
      foundation_details: rf.foundationDetails || null,
      roof: rf.roofType || rf.roof || null,
      exterior_features: rf.exteriorFeatures || null,
      interior_features: rf.interiorFeatures || null,
      window_features: rf.windowFeatures || null,
      fencing: rf.fencing || null,
      patio_and_porch_features: rf.patioAndPorchFeatures || null,
      fireplace_features: rf.fireplaceFeatures || null,
      pool_features: rf.poolFeatures || null,
      spa_features: rf.spaFeatures || null,
      levels: rf.levels || prop.stories || rf.stories || null,
      accessibility_features: rf.accessibilityFeatures || null,
      parking_features: rf.parkingFeatures || null,
      other_structures: rf.otherStructures || null,
      lot_features: rf.lotFeatures || null,
      ev_charging: evCharging,
    },
    utility_details: {
      utilities_included_confirmed: Array.isArray(rf.utilitiesIncluded) ? rf.utilitiesIncluded : null,
      utilities: rf.utilities || null,
      electric: rf.electric || null,
      gas: rf.gas || null,
      water_source: rf.waterSource || null,
      sewer: rf.sewer || null,
      green_energy: rf.greenEnergyEfficient || null,
      heating_systems: rf.heating || null,
      cooling_systems: rf.cooling || null,
      appliances: rf.appliances || null,
      laundry_features: rf.laundryFeatures || null,
    },
    financial_details: {
      price_per_sqft: rf.pricePerSquareFoot || prop.pricePerSquareFoot || null,
      zestimate: prop.zestimate || null,
      rent_zestimate: prop.rentZestimate || null,
      security_deposit: safeInt(rf.securityDeposit),
      application_fee: safeInt(rf.applicationFeeAmount || rf.applicationFee),
      hoa_fee: hoaFee,
      hoa_fee_frequency: hoaFreq,
      tax_annual_amount: taxAnnual,
      concessions: rf.concessions || null,
      price_history: Array.isArray(prop.priceHistory) ? prop.priceHistory.slice(0, 25) : null,
      tax_history: Array.isArray(prop.taxHistory) ? prop.taxHistory.slice(0, 15) : null,
    },
    location_details: {
      county: prop.county || addr.county || null,
      neighborhood: prop.neighborhoodName || prop.neighborhood || rf.subdivision || addr.neighborhood || null,
      subdivision: rf.subdivision || null,
      school_district: rf.highSchoolDistrict || rf.elementarySchoolDistrict || null,
      schools: Array.isArray(prop.schools) ? prop.schools.slice(0, 10) : null,
      walk_score: prop.walkScore ?? null,
      transit_score: prop.transitScore ?? null,
      bike_score: prop.bikeScore ?? null,
    },
    floor_plans: Array.isArray(prop.floorPlans || prop.buildingFloorPlans || rf.floorPlans)
      ? (prop.floorPlans || prop.buildingFloorPlans || rf.floorPlans).slice(0, 20)
      : null,
    videos: vtour ? [{ url: vtour, title: '3D / Virtual Tour', type: 'virtual_tour' }] : null,
    source_raw_payload: {
      source: 'zillow',
      zpid: prop.zpid || null,
      homeStatus: prop.homeStatus || null,
      homeType: prop.homeType || null,
      resoFacts: rf,
      attributionInfo: ai,
    },
  };
}
