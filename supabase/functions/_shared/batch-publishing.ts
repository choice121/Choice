// ============================================================
// Choice Properties — Shared Batch Publishing & Client Privacy Shield
// Phase 8: Batch-scoped publishing, per-batch rent/description overlays,
// strict client-safe field projection, and leak detection.
// ============================================================

export interface BatchOverlaySnapshot {
  property_id?: string | null;
  published_rent?: number | string | null;
  monthly_rent?: number | string | null;
  published_description?: string | null;
}

export interface ClientPhotoRow {
  id?: string;
  property_id?: string;
  url: string;
  file_id?: string | null;
  display_order?: number | null;
  is_hero?: boolean | null;
  caption?: string | null;
  room_label?: string | null;
  media_type?: string | null;
}

export const CLIENT_SAFE_PROPERTY_FIELDS = [
  'id',
  'status',
  'title',
  'description',
  'address',
  'unit_number',
  'city',
  'state',
  'zip',
  'county',
  'neighborhood',
  'location_context',
  'lat',
  'lng',
  'property_type',
  'property_subtype',
  'year_built',
  'floors',
  'total_units',
  'bedrooms',
  'bathrooms',
  'half_bathrooms',
  'total_bathrooms',
  'square_footage',
  'lot_size_sqft',
  'garage_spaces',
  'monthly_rent',
  'security_deposit',
  'last_months_rent',
  'application_fee',
  'admin_fee',
  'move_in_special',
  'hoa_fee',
  'hoa_fee_frequency',
  'parking',
  'parking_fee',
  'ev_charging',
  'amenities',
  'appliances',
  'utilities_included',
  'utility_details',
  'structural_details',
  'location_details',
  'flooring',
  'heating_type',
  'cooling_type',
  'laundry_type',
  'has_basement',
  'has_central_air',
  'floor_plans',
  'minimum_income_multiplier',
  'minimum_credit_score',
  'featured',
  'created_at',
  'updated_at',
] as const;

export const CLIENT_SAFE_PROPERTY_SELECT = CLIENT_SAFE_PROPERTY_FIELDS.join(', ');

export const CLIENT_SAFE_COLLECTION_SELECT = [
  'id',
  'title',
  'address',
  'unit_number',
  'city',
  'state',
  'zip',
  'monthly_rent',
  'bedrooms',
  'bathrooms',
  'half_bathrooms',
  'square_footage',
  'property_type',
  'featured',
  'status',
].join(', ');

export const CLIENT_SAFE_PHOTO_SELECT =
  'id, property_id, url, file_id, display_order, is_hero, caption, room_label, media_type';

export const FORBIDDEN_INTERNAL_FIELDS = new Set<string>([
  'landlords',
  'landlord_id',
  'poster_landlord_id',
  'owner_id',
  'agent_name',
  'broker_name',
  'agent_image_url',
  'poster_type',
  'poster_profile_name',
  'poster_profile_url',
  'poster_contact_info',
  'source_url',
  'source_listing_id',
  'source',
  'original_data',
  'source_raw_payload',
  'field_provenance',
  'source_facts_ledger',
  'unmapped_attributes',
  'field_verification_status',
  'verification_conflicts',
  'verification_status',
  'validation_status',
  'validation_report',
  'review_reason',
  'normalized_address_key',
  'rental_eligibility_status',
  'rental_eligibility_reason',
  'is_dual_listed',
  'financial_details',
  'tax_annual_amount',
  'tax_value',
  'zestimate',
  'rent_zestimate',
  'rentZestimate',
  'showing_instructions',
  'admin_notes',
  'batch_id',
  'batch_uuid',
  'original_description',
  'original_monthly_rent',
  'approved_description',
  'listed_at',
  'source_last_updated_at',
  'imported_at',
  'scraped_at',
  'last_verified_at',
  'source_status',
  'virtual_tour_url',
  'videos',
  'available_date',
  'lease_terms',
  'minimum_lease_months',
  'pets_allowed',
  'pet_types_allowed',
  'pet_weight_limit',
  'pet_details',
  'pet_deposit',
  'smoking_allowed',
]);

const EXTERNAL_PORTAL_RE =
  /(?:https?:\/\/(?:www\.)?(?:zillow\.com|realtor\.com|apartments\.com|redfin\.com|turbotenant\.com|rentspree\.com|appfolio\.com|insidemaps\.com)\b|\b(?:insidemaps\.com|turbotenant)\b)/i;

const PRIVATE_LABEL_RE = /\bprivate\s+placement\b/i;

const EXCLUDED_NESTED_KEY_RE =
  /(?:^|_)(?:zestimate|rent_?zestimate|price_?history|tax_?history|tax_annual_amount|tax_value|source_url|source_raw_payload|original_data|field_provenance|source_facts_ledger|unmapped_attributes|field_verification_status|verification_conflicts|agent_name|broker_name|showing_instructions|admin_notes|benchmark|comparable|comps)(?:$|_)/i;

function parseMaybeJsonObject(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  let obj: unknown = raw;
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (!trimmed || trimmed === '{}') return null;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  return obj as Record<string, unknown>;
}

function cleanSafePrimitiveOrList(val: unknown): unknown {
  if (val == null) return undefined;
  if (typeof val === 'boolean' || typeof val === 'number') {
    return typeof val === 'number' && !Number.isFinite(val) ? undefined : val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || EXTERNAL_PORTAL_RE.test(trimmed)) return undefined;
    return trimmed;
  }
  if (Array.isArray(val)) {
    const cleaned = val
      .map((item) => cleanSafePrimitiveOrList(item))
      .filter((item) => item !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (FORBIDDEN_INTERNAL_FIELDS.has(k) || EXCLUDED_NESTED_KEY_RE.test(k)) continue;
      const cleaned = cleanSafePrimitiveOrList(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return undefined;
}

export function sanitizeLocationDetailsForClient(raw: unknown): Record<string, unknown> | null {
  const src = parseMaybeJsonObject(raw);
  if (!src) return null;

  const out: Record<string, unknown> = {};
  const SAFE_STRING_OR_ARRAY_KEYS = [
    'county',
    'neighborhood',
    'subdivision',
    'school_district',
    'elementary_school_district',
    'middle_or_junior_school_district',
    'high_school_district',
    'community_features',
  ];

  for (const key of SAFE_STRING_OR_ARRAY_KEYS) {
    if (key in src && src[key] != null) {
      const cleaned = cleanSafePrimitiveOrList(src[key]);
      if (cleaned !== undefined) out[key] = cleaned;
    }
  }

  for (const scoreKey of ['walk_score', 'transit_score', 'bike_score']) {
    if (scoreKey in src && src[scoreKey] != null && src[scoreKey] !== '') {
      const n = Number(src[scoreKey]);
      if (Number.isInteger(n) && n >= 0 && n <= 100) {
        out[scoreKey] = n;
      }
    }
  }

  if (Array.isArray(src.schools)) {
    const safeSchools = src.schools
      .map((sch) => {
        if (typeof sch === 'string') {
          const s = sch.trim();
          return s && !EXTERNAL_PORTAL_RE.test(s) ? s : null;
        }
        if (sch && typeof sch === 'object' && !Array.isArray(sch)) {
          const rec = sch as Record<string, unknown>;
          const item: Record<string, unknown> = {};
          for (const sk of ['name', 'title', 'level', 'type', 'grades', 'district', 'distance', 'rating']) {
            const cleaned = cleanSafePrimitiveOrList(rec[sk]);
            if (cleaned !== undefined) item[sk] = cleaned;
          }
          return Object.keys(item).length > 0 ? item : null;
        }
        return null;
      })
      .filter((s) => s !== null);
    if (safeSchools.length > 0) out.schools = safeSchools;
  }

  const rawInsights = parseMaybeJsonObject(src.insights);
  if (rawInsights) {
    const safeInsights: Record<string, unknown> = {};
    const SAFE_INSIGHT_KEYS = [
      'level',
      'walk_score',
      'transit_score',
      'bike_score',
      'location_context',
      'nearby_counts',
      'nearby_highlights',
      'reverse_geocode_city',
      'reverse_geocode_county',
      'census_school_district',
    ];
    for (const ik of SAFE_INSIGHT_KEYS) {
      if (ik in rawInsights && rawInsights[ik] != null) {
        const cleaned = cleanSafePrimitiveOrList(rawInsights[ik]);
        if (cleaned !== undefined) safeInsights[ik] = cleaned;
      }
    }
    if (Object.keys(safeInsights).length > 0) {
      out.insights = safeInsights;
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}

export function sanitizeStructuralDetailsForClient(raw: unknown): Record<string, unknown> | null {
  const src = parseMaybeJsonObject(raw);
  if (!src) return null;
  const cleaned = cleanSafePrimitiveOrList(src);
  return cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned) && Object.keys(cleaned).length > 0
    ? (cleaned as Record<string, unknown>)
    : null;
}

export function sanitizeUtilityDetailsForClient(raw: unknown): Record<string, unknown> | null {
  const src = parseMaybeJsonObject(raw);
  if (!src) return null;
  const cleaned = cleanSafePrimitiveOrList(src);
  return cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned) && Object.keys(cleaned).length > 0
    ? (cleaned as Record<string, unknown>)
    : null;
}

export function sanitizeClientPhotos(photos: unknown): ClientPhotoRow[] {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((ph): ph is Record<string, unknown> => Boolean(ph && typeof ph === 'object' && typeof (ph as Record<string, unknown>).url === 'string'))
    .map((ph) => ({
      id: ph.id ? String(ph.id) : undefined,
      property_id: ph.property_id ? String(ph.property_id) : undefined,
      url: String(ph.url),
      file_id: ph.file_id != null ? String(ph.file_id) : null,
      display_order: ph.display_order != null ? Number(ph.display_order) : null,
      is_hero: typeof ph.is_hero === 'boolean' ? ph.is_hero : null,
      caption: ph.caption != null ? String(ph.caption) : null,
      room_label: ph.room_label != null ? String(ph.room_label) : null,
      media_type: ph.media_type != null ? String(ph.media_type) : 'photo',
    }))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
}

export function projectClientSafeProperty(
  row: Record<string, unknown>,
  overlay?: BatchOverlaySnapshot | null,
  photos?: unknown,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const field of CLIENT_SAFE_PROPERTY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(row, field) && row[field] !== undefined) {
      if (field === 'location_details') {
        safe[field] = row[field] == null ? null : sanitizeLocationDetailsForClient(row[field]);
      } else if (field === 'structural_details') {
        safe[field] = row[field] == null ? null : sanitizeStructuralDetailsForClient(row[field]);
      } else if (field === 'utility_details') {
        safe[field] = row[field] == null ? null : sanitizeUtilityDetailsForClient(row[field]);
      } else {
        safe[field] = row[field];
      }
    }
  }

  // Batch-scoped rent & description overlay for canonical reuse across batches
  if (overlay) {
    const overlayRent =
      overlay.published_rent != null && Number(overlay.published_rent) > 0
        ? Number(overlay.published_rent)
        : overlay.monthly_rent != null && Number(overlay.monthly_rent) > 0
          ? Number(overlay.monthly_rent)
          : null;
    if (overlayRent !== null && Number.isFinite(overlayRent)) {
      safe.monthly_rent = overlayRent;
      safe.security_deposit = overlayRent;
    }

    if (typeof overlay.published_description === 'string' && overlay.published_description.trim().length > 0) {
      safe.description = overlay.published_description.trim();
    }
  }

  // Enforce Choice non-negotiable client invariants
  safe.application_fee = 50;
  if (safe.monthly_rent != null && Number(safe.monthly_rent) > 0) {
    safe.security_deposit = Number(safe.monthly_rent);
  }

  if (photos !== undefined) {
    safe.property_photos = sanitizeClientPhotos(photos);
  } else if (Array.isArray(row.property_photos)) {
    safe.property_photos = sanitizeClientPhotos(row.property_photos);
  }

  return safe;
}

export async function sha256Hex(raw: string): Promise<string> {
  const encoded = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function mintShareToken(): Promise<{ rawToken: string; tokenHash: string }> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const rawToken = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const tokenHash = await sha256Hex(rawToken);
  return { rawToken, tokenHash };
}

export function extractShareTokenFromUrl(magicLinkUrl: string | null | undefined): string | null {
  if (!magicLinkUrl) return null;
  const raw = String(magicLinkUrl).trim();
  if (!raw) return null;
  const hashMatch = raw.match(/[#&?]share=([A-Za-z0-9_-]+)/i);
  if (hashMatch && hashMatch[1]) return decodeURIComponent(hashMatch[1]);
  return null;
}

export interface LeakAuditResult {
  clean: boolean;
  leaks: string[];
}

function scanNestedObjectForLeaks(value: unknown, path: string, leaks: string[], depth = 0): void {
  if (value == null || depth > 5) return;
  if (typeof value === 'string') {
    if (EXTERNAL_PORTAL_RE.test(value)) {
      leaks.push(`external_portal_url_in:${path}`);
    }
    if (PRIVATE_LABEL_RE.test(value)) {
      leaks.push(`private_placement_label_exposed_in:${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      scanNestedObjectForLeaks(value[i], `${path}[${i}]`, leaks, depth + 1);
    }
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_INTERNAL_FIELDS.has(k) || EXCLUDED_NESTED_KEY_RE.test(k)) {
        leaks.push(`forbidden_nested_field:${path}.${k}`);
      } else {
        scanNestedObjectForLeaks(v, `${path}.${k}`, leaks, depth + 1);
      }
    }
  }
}

export function detectLeakedInternalStrings(prop: Record<string, unknown>): LeakAuditResult {
  const leaks: string[] = [];

  for (const key of Object.keys(prop || {})) {
    if (FORBIDDEN_INTERNAL_FIELDS.has(key)) {
      leaks.push(`forbidden_field:${key}`);
    }
  }

  for (const nestedKey of ['structural_details', 'utility_details', 'location_details']) {
    if (prop && prop[nestedKey] != null) {
      scanNestedObjectForLeaks(prop[nestedKey], nestedKey, leaks, 0);
    }
  }

  if (Array.isArray(prop.property_photos)) {
    for (let i = 0; i < prop.property_photos.length; i++) {
      const ph = prop.property_photos[i];
      if (ph && typeof ph === 'object') {
        const rec = ph as Record<string, unknown>;
        if ('source_url' in rec && rec.source_url !== undefined) {
          leaks.push(`forbidden_photo_field:property_photos[${i}].source_url`);
        }
      }
    }
  }

  const desc = typeof prop.description === 'string' ? prop.description : '';
  const title = typeof prop.title === 'string' ? prop.title : '';
  if (EXTERNAL_PORTAL_RE.test(desc)) {
    leaks.push('external_portal_url_in_description');
  }
  if (PRIVATE_LABEL_RE.test(title) || PRIVATE_LABEL_RE.test(desc)) {
    leaks.push('private_placement_label_exposed');
  }

  return {
    clean: leaks.length === 0,
    leaks,
  };
}
