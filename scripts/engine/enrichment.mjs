import { extractMinedFacts, lintDescription } from '../description-generator.mjs';
import { sanitizeProhibitedDescription } from '../description-sanitizer.mjs';

/**
 * TEMPORARY OWNER DIRECTIVE — DO NOT REMOVE UNDERLYING CODE:
 * While `DISABLE_TOUR_AND_VIDEO_LINKS_ON_PUBLISH` is `true`, publishing drops
 * `virtual_tour_url` and `videos` (sets both to `null` on `public.properties`).
 * Keep all extraction, sanitization, schema fields, and frontend UI intact so
 * tours and video walkthroughs can be re-enabled immediately by flipping this flag.
 */
export const DISABLE_TOUR_AND_VIDEO_LINKS_ON_PUBLISH = true;

export function normalizeBathroomPrecision(prop) {
  const parseObj = (v) => {
    if (!v) return null;
    if (typeof v === 'object') return v;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return null; }
    }
    return null;
  };

  const rawPayload = parseObj(prop.source_raw_payload) || parseObj(prop.original_data) || {};
  const reso = rawPayload.resoFacts || rawPayload || {};
  const resoFull = reso.bathroomsFull != null ? Number(reso.bathroomsFull) : null;
  const resoHalf = reso.bathroomsHalf != null ? Number(reso.bathroomsHalf) : null;
  const resoFloat = reso.bathroomsFloat != null ? Number(reso.bathroomsFloat) : null;

  const rawBaths = prop.bathrooms !== null && prop.bathrooms !== undefined ? parseFloat(prop.bathrooms) : 1;
  let baths = Number.isFinite(rawBaths) ? rawBaths : 1;
  let halfBaths = prop.half_bathrooms !== null && prop.half_bathrooms !== undefined
    ? parseInt(prop.half_bathrooms, 10)
    : (baths % 1 !== 0 ? 1 : 0);

  if (Number.isFinite(resoFull) && Number.isFinite(resoHalf) && resoHalf > 0) {
    baths = resoFull + (resoHalf * 0.5);
    halfBaths = resoHalf;
  } else if (Number.isFinite(resoFloat) && resoFloat > 0 && resoFloat % 1 !== 0) {
    baths = resoFloat;
    halfBaths = Number.isFinite(resoHalf) ? resoHalf : 1;
  } else {
    const text = `${prop.original_description || ''} ${prop.description || ''} ${prop.title || ''}`.toLowerCase();
    if (/\b1\.5[- ]*baths?\b|\b1\s+and\s+a\s+half\s+bath|\bone\s+and\s+a\s+half\s+bath/.test(text) && (baths === 1 || baths === 2)) {
      baths = 1.5;
      halfBaths = 1;
    } else if (baths % 1 === 0) {
      if (/\b2\.5[- ]*baths?\b|\b2\s+and\s+a\s+half\s+bath|\btwo\s+and\s+a\s+half\s+bath/.test(text) && baths === 2) {
        baths = 2.5;
        halfBaths = 1;
      } else if (/\b3\.5[- ]*baths?\b|\b3\s+and\s+a\s+half\s+bath|\bthree\s+and\s+a\s+half\s+bath/.test(text) && baths === 3) {
        baths = 3.5;
        halfBaths = 1;
      } else if (/\bhalf\s+bath\b|\bpowder\s+room\b/.test(text) && halfBaths === 0) {
        baths = baths + 0.5;
        halfBaths = 1;
      }
    }
  }

  return {
    bathrooms: baths,
    half_bathrooms: Number.isFinite(halfBaths) ? halfBaths : 0,
    total_bathrooms: Math.ceil(baths),
  };
}

export function classifyPropertyType(prop) {
  const rawType = String(prop.property_type || '').toUpperCase().trim();
  const text = `${prop.title || ''} ${prop.address || ''} ${prop.original_description || ''} ${prop.description || ''}`.toLowerCase();

  if (/\b(?:1\/2\s*duplex|half[- ]duplex|duplex|side[- ]by[- ]side)\b/.test(text) || rawType.includes('DUPLEX')) {
    return 'DUPLEX';
  }
  if (/\b(?:townhouse|townhome|rowhouse|row\s*home)\b/.test(text) || rawType.includes('TOWN')) {
    return 'TOWNHOUSE';
  }
  if (rawType.includes('APARTMENT') || /\bapartment\s+(?:community|complex|building)\b/.test(text)) {
    return 'APARTMENT';
  }
  if (rawType.includes('CONDO')) {
    return 'CONDO';
  }
  return 'SINGLE_FAMILY';
}

export function parseJsonArrayField(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '[]') return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function extractPhotoEntriesInOrder(prop) {
  let raw = parseJsonArrayField(prop.original_image_urls);
  if (raw.length === 0) {
    raw = parseJsonArrayField(prop.local_image_paths);
  }
  return raw
    .map((entry) => {
      if (typeof entry === 'string') {
        const url = entry.trim();
        return url ? { url, source_url: url, media_type: 'photo' } : null;
      }
      if (entry && typeof entry === 'object') {
        const url = String(entry.url || entry.src || '').trim();
        if (!url) return null;
        return {
          url,
          fileId: entry.fileId || entry.file_id || null,
          width: typeof entry.width === 'number' ? entry.width : null,
          height: typeof entry.height === 'number' ? entry.height : null,
          caption: typeof entry.caption === 'string' && entry.caption.trim() ? entry.caption.trim() : null,
          room_label: typeof entry.room_label === 'string' && entry.room_label.trim() ? entry.room_label.trim() : null,
          source_url: typeof entry.source_url === 'string' && entry.source_url.trim() ? entry.source_url.trim() : url,
          media_type: typeof entry.media_type === 'string' && entry.media_type.trim() ? entry.media_type.trim() : 'photo',
        };
      }
      return null;
    })
    .filter((entry) => entry && /^https?:\/\//i.test(entry.url));
}

export function extractPhotoUrlsInOrder(prop) {
  return extractPhotoEntriesInOrder(prop).map((entry) => entry.url);
}

export function buildSourceGroundedDescription(prop) {
  const rawDesc = prop.original_description || prop.description || '';
  let cleaned = sanitizeProhibitedDescription(rawDesc);

  // Additional surgical scrubbing for remaining deposit/lease/availability/portal/zero-fee strings
  cleaned = cleaned
    .replace(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\b(?:security\s+)?deposit(?:\s*(?:is|of|:))?\s*\$?[\d,]+(?:\.\d{2})?[^.\n]*/gi, '')
    .replace(/\b(?:12|24|36|6)[- ]?(?:month|year)s?\s+lease[^.\n]*/gi, '')
    .replace(/\b(?:minimum|standard)\s+lease\s+(?:term|duration)[^.\n]*/gi, '')
    .replace(/\b(?:available\s+(?:now|immediately|on)|move-?in\s+(?:ready|date))[^.\n]*/gi, '')
    .replace(/\b(?:no\s+smoking|non-?smoking|smoking\s+policy)[^.\n]*/gi, '')
    .replace(/\b(?:free\s+(?:to\s+)?apply|free\s+application|apply\s+for\s+free|fee[- ]?free\s+application|(?:no|zero|waived|complimentary)\s+(?:application\s+|app\s+)?fee|\$\s*0(?:\.00)?\s*(?:application|app)?\s*fee|fee\s+(?:is\s+|will\s+be\s+)?waived)\b[^.!\n]*[.!]?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned) {
    return 'Application Fee: $50. Submit your rental application today at Choice Properties.';
  }

  // Ensure no stale fee line remains before appending the canonical Choice fee note
  cleaned = cleaned
    .replace(/Application\s+Fee:\s*\$50\.\s*Submit\s+your\s+rental\s+application\s+today\s+at\s+Choice\s+Properties\.?/gi, '')
    .trim();

  return `${cleaned}\n\nApplication Fee: $50. Submit your rental application today at Choice Properties.`;
}

export function enrichPipelineProperty(prop, options = {}) {
  const rawDesc = prop.original_description || prop.description || '';
  const textLower = rawDesc.toLowerCase();
  const mined = extractMinedFacts(rawDesc, prop);
  const bathInfo = normalizeBathroomPrecision(prop);
  const propType = classifyPropertyType(prop);

  // Year built extraction
  let yearBuilt = prop.year_built ? parseInt(prop.year_built, 10) : null;
  if (!yearBuilt) {
    const builtMatch = rawDesc.match(/\bbuilt\s+in\s+(19\d{2}|20[0-2]\d)\b/i);
    if (builtMatch) yearBuilt = parseInt(builtMatch[1], 10);
  }

  // Laundry type: only populate when explicitly present in source or description
  let laundryType = prop.laundry_type || null;
  if (laundryType !== 'In Unit' && laundryType !== 'Hookups') {
    if (/\b(?:washer\s*(?:and|&|\/)\s*dryer\s*(?:included|in\s*unit)|in[- ]unit\s*laundry)\b/i.test(textLower)) {
      laundryType = 'In Unit';
    } else if (/\b(?:washer\s*(?:and|&|\/)\s*dryer\s*hookups?|laundry\s*hookups?|w\/d\s*hookups?)\b/i.test(textLower)) {
      laundryType = 'Hookups';
    }
  }

  // Garage spaces & parking: preserve source values without inventing unknown counts
  let garageSpaces = prop.garage_spaces != null ? parseInt(prop.garage_spaces, 10) : null;
  let parking = prop.parking || null;
  if (garageSpaces == null) {
    const gMatch = textLower.match(/\b(\d)[- ]?car\s+(?:attached\s+)?garage\b/) || textLower.match(/\b(?:two|2)[- ]?car\s+(?:attached\s+)?garage\b/);
    if (gMatch) {
      garageSpaces = gMatch[1] ? parseInt(gMatch[1], 10) : 2;
    } else if (/\b(?:1|one)[- ]?car\s+(?:attached\s+)?garage\b/.test(textLower)) {
      garageSpaces = 1;
    }
  }

  // Appliances & Amenities
  const appliancesSet = new Set([
    ...parseJsonArrayField(prop.appliances),
    ...(mined.appliances || []),
  ]);
  if (laundryType === 'In Unit') {
    appliancesSet.add('Washer');
    appliancesSet.add('Dryer');
  } else if (laundryType === 'Hookups') {
    appliancesSet.add('Washer/Dryer Hookups');
  }

  const amenitiesSet = new Set([
    ...parseJsonArrayField(prop.amenities),
    ...mined.kitchenFeatures,
    ...mined.layoutFeatures,
    ...mined.outdoorFeatures,
  ]);
  if (prop.has_central_air === true || textLower.includes('central air') || textLower.includes('central a/c') || textLower.includes('central heat and air') || textLower.includes('central heat & air') || prop.cooling_type) {
    amenitiesSet.add('Central Air Conditioning');
  }
  if (parking) amenitiesSet.add(parking);

  const flooring = parseJsonArrayField(prop.flooring);
  if (flooring.length === 0 && mined.finishes.length > 0) {
    flooring.push(...mined.finishes);
  }

  const description = buildSourceGroundedDescription(prop);
  const lint = lintDescription(description, { ...prop, bathrooms: bathInfo.bathrooms });

  const monthlyRent = options.rentOverride ? Number(options.rentOverride) : Number(prop.monthly_rent);
  const cleanTitle = `${prop.address}, ${prop.city}, ${prop.state} ${prop.zip}`.trim();
  const photoEntries = extractPhotoEntriesInOrder(prop);
  const photos = photoEntries.map((entry) => entry.url);

  const utilitiesInc = parseJsonArrayField(prop.utilities_included);
  const parseObjField = (v) => {
    if (!v) return null;
    if (typeof v === 'object') return v;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return null; }
    }
    return null;
  };
  let fieldProvenance = parseObjField(prop.field_provenance);
  if (options.rentOverride) {
    fieldProvenance = { ...(fieldProvenance || {}), monthly_rent: 'admin_override' };
  }

  const isBrandedThirdPartyTour = (u) => /insidemaps\.com/i.test(String(u || ''));
  const rawVideos = parseObjField(prop.videos);
  const cleanVideos = Array.isArray(rawVideos)
    ? rawVideos.filter((v) => !isBrandedThirdPartyTour(typeof v === 'string' ? v : v?.url))
    : null;
  const cleanVirtualTourUrl = prop.virtual_tour_url && !isBrandedThirdPartyTour(prop.virtual_tour_url)
    ? prop.virtual_tour_url
    : null;

  // Temporary publish-time toggle: drop tour & video links without removing pipeline/UI support
  const toursAndVideosEnabled = options.includeToursAndVideos === true || !DISABLE_TOUR_AND_VIDEO_LINKS_ON_PUBLISH;
  const publishedVirtualTourUrl = toursAndVideosEnabled ? cleanVirtualTourUrl : null;
  const publishedVideos = toursAndVideosEnabled && cleanVideos && cleanVideos.length > 0 ? cleanVideos : null;

  const propertyRecord = {
    landlord_id: prop.poster_landlord_id || null,
    status: options.visibility === 'active' ? 'active' : 'private_placement',
    title: cleanTitle,
    description,
    original_description: prop.original_description || prop.description || null,
    address: prop.address,
    city: prop.city,
    state: prop.state,
    zip: prop.zip,
    county: prop.county || null,
    neighborhood: prop.neighborhood || null,
    lat: prop.lat ?? null,
    lng: prop.lng ?? null,
    property_type: propType,
    property_subtype: prop.property_subtype || null,
    year_built: yearBuilt,
    floors: prop.floors ?? (parseObjField(prop.structural_details)?.levels ? Number(parseObjField(prop.structural_details).levels) : null),
    unit_number: prop.unit_number || null,
    total_units: prop.total_units || null,
    bedrooms: Number(prop.bedrooms),
    bathrooms: bathInfo.bathrooms,
    half_bathrooms: bathInfo.half_bathrooms,
    total_bathrooms: bathInfo.total_bathrooms,
    square_footage: prop.square_footage ? Number(prop.square_footage) : null,
    lot_size_sqft: prop.lot_size_sqft ? Number(prop.lot_size_sqft) : null,
    garage_spaces: garageSpaces,
    monthly_rent: monthlyRent,
    security_deposit: monthlyRent, // Strictly 1x monthly rent in DB, 0 in description
    application_fee: 50,           // Strictly $50 in DB
    hoa_fee: prop.hoa_fee != null ? Number(prop.hoa_fee) : null,
    hoa_fee_frequency: prop.hoa_fee_frequency || null,
    tax_annual_amount: prop.tax_annual_amount != null ? Number(prop.tax_annual_amount) : null,
    pet_deposit: null,             // Platform invariant: never display pet info
    pets_allowed: null,
    pet_types_allowed: null,
    pet_details: null,
    smoking_allowed: null,
    lease_terms: null,             // Platform invariant: never display lease terms
    minimum_lease_months: null,
    available_date: null,          // Platform invariant: never display move-in dates
    parking,
    ev_charging: prop.ev_charging || null,
    amenities: Array.from(amenitiesSet),
    appliances: Array.from(appliancesSet),
    utilities_included: utilitiesInc.length > 0 ? utilitiesInc : null,
    flooring: flooring.length > 0 ? flooring : null,
    heating_type: prop.heating_type || null,
    cooling_type: prop.cooling_type || (prop.has_central_air ? 'Central Air' : null),
    laundry_type: laundryType,
    has_basement: prop.has_basement ?? null,
    has_central_air: prop.has_central_air ?? null,
    virtual_tour_url: publishedVirtualTourUrl,
    listed_at: prop.listed_at || new Date().toISOString().slice(0, 10),
    source_last_updated_at: prop.source_last_updated_at || null,
    imported_at: prop.imported_at || prop.scraped_at || new Date().toISOString(),
    source_status: prop.source_status || 'available',
    last_verified_at: new Date().toISOString(),
    original_data: parseObjField(prop.original_data),
    source_raw_payload: parseObjField(prop.source_raw_payload),
    field_provenance: fieldProvenance,
    structural_details: parseObjField(prop.structural_details),
    utility_details: parseObjField(prop.utility_details),
    financial_details: parseObjField(prop.financial_details),
    location_details: parseObjField(prop.location_details),
    floor_plans: parseObjField(prop.floor_plans),
    videos: publishedVideos,
  };

  return {
    propertyRecord,
    photos,
    photoEntries,
    lint,
    isValid:
      Boolean(cleanTitle && prop.address && prop.city && prop.state && prop.zip) &&
      Number.isFinite(monthlyRent) && monthlyRent > 0 &&
      Number.isFinite(Number(prop.bedrooms)) &&
      Number.isFinite(bathInfo.bathrooms) &&
      photos.length > 0 &&
      lint.valid,
    validationErrors: [
      ...(!prop.address || !prop.city || !prop.state || !prop.zip ? ['Missing required address components'] : []),
      ...(!Number.isFinite(monthlyRent) || monthlyRent <= 0 ? ['Invalid monthly_rent'] : []),
      ...(photos.length === 0 ? ['No valid source CDN photos found'] : []),
      ...lint.errors,
    ],
  };
}
