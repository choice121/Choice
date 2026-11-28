// ============================================================================
// Choice Properties — Phase 6 Shared Property Eligibility & Validation Engine
// ============================================================================
// Enforces Rules-Engine driven pre-enrichment / pre-publish gates:
//   1. Prohibited Source Profile Matcher (names, aliases, Zillow profile URLs)
//   2. Owner / Landlord Verification (strict explicit proof; zero name guessing)
//   3. Property Type & Single-Unit Apartment Structure Gate
//   4. Rental Status, Fractional Bath Precision & Core Completeness
//   5. Reachable Photo Count (>= 4) & Non-Destructive Watermark Screening
//   6. Source-Grounded Quality Signals (zero fabrication)
//
// Invariants enforced:
//   - Never modifies image order (Directive 2)
//   - Never crops, blurs, or strips watermarks from images
//   - Never inserts stock or AI-generated photos
//   - SSRF-safe HTTPS image reachability checks (no private/loopback/metadata IPs)
// ============================================================================

import {
  type FieldVerificationStatus,
  type LocationVerificationResult,
  type VerificationConflict,
  verifyLocationAndSchools,
} from './location-verifier.ts';

export type { FieldVerificationStatus, LocationVerificationResult, VerificationConflict };

export type ValidationStatus = 'passed' | 'needs_review' | 'rejected';

export interface ProhibitedProfileRule {
  id?: string;
  canonical_name: string;
  aliases?: string[] | null;
  zillow_profile_urls?: string[] | null;
  match_mode?: 'normalized_exact' | 'token_phrase' | string | null;
  is_immutable?: boolean;
  enabled?: boolean | null;
  notes?: string | null;
}

export interface ValidationCheckResult {
  key: string;
  label: string;
  status: ValidationStatus;
  reason?: string | null;
  details?: Record<string, unknown>;
}

export interface ValidationReport {
  status: ValidationStatus;
  needs_review: boolean;
  primary_reason: string | null;
  reasons: string[];
  checks: ValidationCheckResult[];
  prohibited_match: {
    matched: boolean;
    canonical_name?: string;
    matched_term?: string;
    matched_field?: string;
    matched_by?: 'name_or_alias' | 'zillow_profile_url';
  };
  poster_verification: {
    verified_owner_landlord: boolean;
    poster_category:
      | 'explicit_owner_landlord'
      | 'explicit_agent_or_broker'
      | 'explicit_management_company'
      | 'unverified';
    agent_name: string | null;
    broker_name: string | null;
    raw_attribution_type: string | null;
    seller_type: string | null;
  };
  apartment_check: {
    property_type: string | null;
    is_apartment_type: boolean;
    is_single_unit_verified: boolean;
    is_multi_unit_complex: boolean;
    signals: string[];
  };
  media_check: {
    total_urls: number;
    unique_https_urls: number;
    min_required: number;
    reachable_checked: boolean;
    reachable_count: number;
    unreachable_urls: string[];
    flagged_watermarked_urls: string[];
    vision_scan_status: 'not_requested' | 'manual_visual_review_required';
  };
  field_verification_status: Record<string, FieldVerificationStatus>;
  verification_conflicts: VerificationConflict[];
  location_verification: {
    coordinates_valid: boolean;
    external_checks_attempted: boolean;
    geoapify_status: LocationVerificationResult['geoapify_status'];
    census_status: LocationVerificationResult['census_status'];
    critical_mismatch: boolean;
    reverse_geocode: LocationVerificationResult['reverse_geocode'];
    census_schools: LocationVerificationResult['census_schools'];
  };
  verification_summary: {
    total_fields: number;
    independently_verified: number;
    source_confirmed: number;
    partially_verified: number;
    conflicting_sources: number;
    unverified: number;
    not_available: number;
    conflict_count: number;
    critical_conflict_count: number;
    source_facts_ledger_complete: boolean;
    covered_key_count: number;
  };
  manual_verification_checklist: {
    side_by_side_source_check_required: boolean;
    photo_watermark_inspection_required: boolean;
    missing_fields_refill_check_required: boolean;
    manual_description_rewrite_required: boolean;
    required_actions: string[];
  };
  quality_signals: string[];
  policy_version: {
    id: string | null;
    version_label: string | null;
    version_number: number | null;
  };
  validated_at: string;
}

export interface ValidatePropertyOptions {
  prohibitedProfiles?: ProhibitedProfileRule[];
  rulesMap?: Record<string, unknown>;
  policySet?: { id?: string | null; version_label?: string | null; version_number?: number | null } | null;
  checkPhotoReachability?: boolean;
  allowNonOwnerListing?: boolean;
  verifyLocationAndSchools?: boolean;
  geoapifyApiKey?: string;
  fetchImpl?: typeof fetch;
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

function asArr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
  }
  return [];
}

function asStr(v: unknown): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  return s || null;
}

function asNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = v.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export function normalizeMatchText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractZillowProfileSlug(rawUrlOrSlug: string): string | null {
  const s = String(rawUrlOrSlug || '').trim();
  if (!s) return null;
  const m = s.match(/zillow\.com\/profile\/([^/?#]+)/i);
  if (m && m[1]) {
    try {
      return decodeURIComponent(m[1]).trim().toLowerCase();
    } catch {
      return m[1].trim().toLowerCase();
    }
  }
  if (/^[a-z0-9._-]{2,120}$/i.test(s) && s.includes('-')) {
    return s.toLowerCase();
  }
  return null;
}

function collectRawStrings(
  obj: unknown,
  prefix = '',
  depth = 0,
  out: Array<{ field: string; value: string }> = [],
  limit = 60,
): Array<{ field: string; value: string }> {
  if (out.length >= limit || depth > 4 || obj == null) return out;
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (trimmed && trimmed.length <= 400) {
      out.push({ field: prefix || 'raw', value: trimmed });
    }
    return out;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < Math.min(obj.length, 15); i++) {
      collectRawStrings(obj[i], `${prefix}[${i}]`, depth + 1, out, limit);
    }
    return out;
  }
  if (typeof obj === 'object') {
    for (const [k, val] of Object.entries(obj as Record<string, unknown>)) {
      if (out.length >= limit) break;
      const lower = k.toLowerCase();
      // Skip large photo/gallery blobs during attribution scanning
      if (
        lower.includes('photo') ||
        lower.includes('image') ||
        lower === 'description' ||
        lower === 'original_description' ||
        lower === 'streetaddress' ||
        lower === 'address'
      ) {
        if (lower === 'agent_image_url' && typeof val === 'string') {
          out.push({ field: `${prefix}.${k}`, value: val });
        }
        continue;
      }
      collectRawStrings(val, prefix ? `${prefix}.${k}` : k, depth + 1, out, limit);
    }
  }
  return out;
}

export function matchProhibitedProfiles(
  listing: Record<string, unknown>,
  profiles: ProhibitedProfileRule[],
): ValidationReport['prohibited_match'] {
  if (!Array.isArray(profiles) || profiles.length === 0) return { matched: false };

  const rawPayload = asObj(listing.source_raw_payload);
  const origData = asObj(listing.original_data);
  const prov = asObj(listing.field_provenance);
  const provPoster = asObj(prov.poster_profile);

  // Ordered candidate attribution strings (highest-confidence fields first)
  const candidates: Array<{ field: string; value: string }> = [];
  const push = (field: string, val: unknown) => {
    const s = asStr(val);
    if (s) candidates.push({ field, value: s });
  };

  push('agent_name', listing.agent_name);
  push('broker_name', listing.broker_name);
  push('agent_image_url', listing.agent_image_url);
  push('source_url', listing.source_url);
  push('poster_profile.agent_name', provPoster.agent_name);
  push('poster_profile.broker_name', provPoster.broker_name);
  push('poster_profile.raw_attribution_type', provPoster.raw_attribution_type);
  push('poster_profile.seller_type', provPoster.seller_type);

  // Explicit attribution blocks in raw payload
  const hdpInfo = asObj(asObj(rawPayload.hdpData).homeInfo);
  for (const [srcName, srcObj] of [
    ['raw.attributionInfo', asObj(rawPayload.attributionInfo)],
    ['hdp.attributionInfo', asObj(hdpInfo.attributionInfo)],
    ['raw.listingSubType', asObj(rawPayload.listingSubType)],
    ['orig.attributionInfo', asObj(origData.attributionInfo)],
  ] as const) {
    for (const [k, v] of Object.entries(srcObj)) {
      if (typeof v === 'string') push(`${srcName}.${k}`, v);
    }
  }

  for (const extra of collectRawStrings(rawPayload, 'source_raw_payload')) {
    candidates.push(extra);
  }

  // Descriptions scanned only for URL matches, explicit management signatures, or phrase matches
  const descriptionTexts = [asStr(listing.description), asStr(listing.original_description)]
    .filter((x): x is string => Boolean(x));

  for (const prof of profiles) {
    if (prof.enabled === false) continue;
    const isExactMode = prof.match_mode === 'normalized_exact';

    const profileUrls = Array.isArray(prof.zillow_profile_urls) ? prof.zillow_profile_urls : [];
    const profileSlugs = new Set<string>();
    for (const u of profileUrls) {
      const slug = extractZillowProfileSlug(String(u));
      if (slug) profileSlugs.add(slug);
    }

    const nameTerms = [prof.canonical_name, ...(Array.isArray(prof.aliases) ? prof.aliases : [])]
      .map((t) => normalizeMatchText(t))
      .filter(Boolean);

    // 1. Check Zillow profile URLs/slugs against source URLs & candidate profile URLs
    if (profileSlugs.size > 0 || profileUrls.length > 0) {
      const allTexts = [
        ...candidates.map((c) => ({ field: c.field, value: c.value })),
        ...descriptionTexts.map((d, i) => ({ field: `description[${i}]`, value: d })),
      ];
      for (const item of allTexts) {
        const lowerVal = item.value.toLowerCase();
        for (const rawProfileUrl of profileUrls) {
          const cleaned = String(rawProfileUrl || '').trim().toLowerCase().replace(/\/+$/, '');
          if (cleaned && lowerVal.includes(cleaned)) {
            return {
              matched: true,
              canonical_name: prof.canonical_name,
              matched_term: rawProfileUrl,
              matched_field: item.field,
              matched_by: 'zillow_profile_url',
            };
          }
        }
        const slugInVal = extractZillowProfileSlug(item.value);
        if (slugInVal && profileSlugs.has(slugInVal)) {
          return {
            matched: true,
            canonical_name: prof.canonical_name,
            matched_term: slugInVal,
            matched_field: item.field,
            matched_by: 'zillow_profile_url',
          };
        }
        // Also check slug inside description text
        for (const slug of profileSlugs) {
          if (lowerVal.includes(`/profile/${slug}`)) {
            return {
              matched: true,
              canonical_name: prof.canonical_name,
              matched_term: slug,
              matched_field: item.field,
              matched_by: 'zillow_profile_url',
            };
          }
        }
      }
    }

    // 2. Check canonical name + aliases against attribution fields first
    for (const cand of candidates) {
      const norm = normalizeMatchText(cand.value);
      if (!norm) continue;
      for (const term of nameTerms) {
        if (isExactMode) {
          if (norm === term) {
            return {
              matched: true,
              canonical_name: prof.canonical_name,
              matched_term: term,
              matched_field: cand.field,
              matched_by: 'name_or_alias',
            };
          }
        } else if (` ${norm} `.includes(` ${term} `)) {
          return {
            matched: true,
            canonical_name: prof.canonical_name,
            matched_term: term,
            matched_field: cand.field,
            matched_by: 'name_or_alias',
          };
        }
      }
      // Also match slugified canonical/alias names inside profile URLs
      const candSlug = extractZillowProfileSlug(cand.value);
      if (candSlug) {
        const normSlug = normalizeMatchText(candSlug);
        for (const term of nameTerms) {
          if (` ${normSlug} `.includes(` ${term} `)) {
            return {
              matched: true,
              canonical_name: prof.canonical_name,
              matched_term: term,
              matched_field: cand.field,
              matched_by: 'zillow_profile_url',
            };
          }
        }
      }
    }

    // 3. Check descriptions only for token_phrase matches with safe length >= 3 (avoid short-code false positives on address text)
    if (!isExactMode) {
      for (let i = 0; i < descriptionTexts.length; i++) {
        const normDesc = normalizeMatchText(descriptionTexts[i]);
        if (!normDesc) continue;
        for (const term of nameTerms) {
          if (term.length < 3) continue;
          if (` ${normDesc} `.includes(` ${term} `)) {
            return {
              matched: true,
              canonical_name: prof.canonical_name,
              matched_term: term,
              matched_field: i === 0 ? 'description' : 'original_description',
              matched_by: 'name_or_alias',
            };
          }
        }
      }
    }
  }

  return { matched: false };
}

export function evaluatePosterVerification(
  listing: Record<string, unknown>,
): ValidationReport['poster_verification'] {
  const raw = asObj(listing.source_raw_payload);
  const orig = asObj(listing.original_data);
  const prov = asObj(listing.field_provenance);
  const provPoster = asObj(prov.poster_profile);
  const hdpInfo = asObj(asObj(raw.hdpData).homeInfo);
  const attribution = {
    ...asObj(raw.attributionInfo),
    ...asObj(hdpInfo.attributionInfo),
    ...asObj(orig.attributionInfo),
  };
  const listingSubType = {
    ...asObj(raw.listingSubType),
    ...asObj(hdpInfo.listingSubType),
    ...asObj(raw.listingMetadata),
    ...asObj(orig.listingSubType),
  };

  const agentName = asStr(
    listing.agent_name ||
      provPoster.agent_name ||
      attribution.agentName ||
      raw.agentName ||
      raw.listedByName ||
      orig.agentName,
  );
  const brokerName = asStr(
    listing.broker_name ||
      provPoster.broker_name ||
      attribution.brokerName ||
      raw.brokerName ||
      raw.brokerageName ||
      raw.managementCompanyName ||
      orig.brokerName,
  );
  const sellerType = asStr(
    provPoster.seller_type ||
      attribution.sellerType ||
      attribution.listingAgentCategory ||
      attribution.listingCategory ||
      raw.sellerType ||
      raw.postedByType ||
      listingSubType.type,
  );
  const rawAttributionType = asStr(
    provPoster.raw_attribution_type ||
      attribution.listingAgentCategory ||
      attribution.posterCategory ||
      raw.attributionType ||
      raw.postedBy ||
      sellerType,
  );

  const explicitOwnerBool =
    provPoster.explicit_owner_landlord === true ||
    raw.isForRentByOwner === true ||
    raw.is_FRBO === true ||
    raw.is_FSBO === true ||
    listingSubType.is_FSBO === true ||
    listingSubType.is_for_rent_by_owner === true ||
    attribution.isPropertyOwner === true ||
    attribution.isLandlord === true ||
    orig.isForRentByOwner === true ||
    orig.is_FRBO === true;

  const ownerTypePattern =
    /^(?:property[\s_]*owner|owner|landlord|for[\s_]*rent[\s_]*by[\s_]*owner|frbo|fsbo)$/i;
  const ownerPhrasePattern =
    /\b(?:posted\s+by\s+(?:property\s+)?owner|for\s+rent\s+by\s+owner|listed\s+by\s+(?:property\s+)?owner|verified\s+landlord)\b/i;

  const explicitOwnerByCategory = Boolean(
    (sellerType && (ownerTypePattern.test(sellerType) || ownerPhrasePattern.test(sellerType))) ||
      (rawAttributionType &&
        (ownerTypePattern.test(rawAttributionType) || ownerPhrasePattern.test(rawAttributionType))),
  );

  // Rule: Person name alone (e.g. agent_name: "John Doe") NEVER satisfies owner verification.
  const verifiedOwnerLandlord = explicitOwnerBool || explicitOwnerByCategory;

  let posterCategory: ValidationReport['poster_verification']['poster_category'] = 'unverified';
  if (verifiedOwnerLandlord) {
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
    verified_owner_landlord: verifiedOwnerLandlord,
    poster_category: posterCategory,
    agent_name: agentName,
    broker_name: brokerName,
    raw_attribution_type: rawAttributionType,
    seller_type: sellerType,
  };
}

export function evaluateApartmentAndType(
  listing: Record<string, unknown>,
): ValidationCheckResult & { info: ValidationReport['apartment_check'] } {
  const raw = asObj(listing.source_raw_payload);
  const orig = asObj(listing.original_data);
  const ptRaw = (asStr(listing.property_type) || asStr(raw.homeType) || asStr(raw.propertyType) || '').toUpperCase();
  const subtype = (asStr(listing.property_subtype) || '').toUpperCase();
  const desc = [asStr(listing.original_description), asStr(listing.description)].filter(Boolean).join(' ');

  const floorPlans = asArr(listing.floor_plans ?? raw.floorPlans ?? orig.floorPlans);
  const priceRange = asStr(listing.price_range || raw.priceRange || orig.priceRange);
  const totalUnits = asNum(listing.total_units ?? raw.totalUnits ?? orig.totalUnits);
  const isMultiUnitFlag = listing.is_multi_unit === true || raw.isMultiUnit === true || raw.isBuilding === true;
  const unitNumber = asStr(listing.unit_number || raw.unit);
  const signals: string[] = [];

  if (isMultiUnitFlag) signals.push('is_multi_unit_true');
  if (totalUnits !== null && totalUnits > 1) signals.push(`total_units:${totalUnits}`);
  if (floorPlans.length > 0) signals.push(`floor_plans:${floorPlans.length}`);
  if (priceRange) signals.push(`price_range:${priceRange}`);
  if (/\$\s*[\d,]+\s*[-–—]\s*\$\s*[\d,]+/.test(desc)) signals.push('description_price_range');
  if (
    /\b(?:floor\s*plans?|unit\s*selector|available\s+units|multiple\s+units|leasing\s+(?:office|center)|apartment\s+community|units?\s+starting\s+at|rates?\s+vary|collection\s+of\s+\d+(?:\s+\w+){0,3}\s+(?:units?|apartments?|townhomes?|homes?))\b/i.test(
      desc,
    )
  ) {
    signals.push('description_complex_language');
  }
  if (
    /\b(?:illustrative\s+purposes|representative\s+photos|photos\s+may\s+not\s+(?:reflect|represent)\s+(?:the\s+)?actual\s+unit)\b/i.test(
      desc,
    )
  ) {
    signals.push('illustrative_photos_flag');
  }

  const ineligibleTypes = new Set(['LAND', 'LOT', 'FARM', 'COMMERCIAL', 'MANUFACTURED_LAND']);
  if (ptRaw && ineligibleTypes.has(ptRaw)) {
    return {
      key: 'property_type_and_apartment',
      label: 'Property Type & Structure',
      status: 'rejected',
      reason: 'unsupported_property_type',
      info: {
        property_type: ptRaw,
        is_apartment_type: false,
        is_single_unit_verified: false,
        is_multi_unit_complex: false,
        signals,
      },
    };
  }

  const isApartmentLike =
    ptRaw === 'APARTMENT' ||
    ptRaw === 'MULTI_FAMILY' ||
    ptRaw === 'STUDIO' ||
    subtype.includes('APARTMENT') ||
    subtype.includes('CONDO_APARTMENT');

  const isDuplex = ptRaw === 'DUPLEX' || subtype.includes('DUPLEX');
  const hasMultiUnitComplexEvidence =
    isMultiUnitFlag ||
    (totalUnits !== null && totalUnits > (isDuplex ? 2 : 1)) ||
    floorPlans.length > 0 ||
    Boolean(priceRange) ||
    signals.includes('description_price_range') ||
    signals.includes('description_complex_language');

  if (hasMultiUnitComplexEvidence && !isDuplex) {
    return {
      key: 'property_type_and_apartment',
      label: 'Property Type & Structure',
      status: 'rejected',
      reason: 'multi_unit_apartment_complex',
      info: {
        property_type: ptRaw || null,
        is_apartment_type: isApartmentLike,
        is_single_unit_verified: false,
        is_multi_unit_complex: true,
        signals,
      },
    };
  }

  if (isApartmentLike) {
    const singleUnitConfirmed =
      (totalUnits === 1 || Boolean(unitNumber) || raw.isSingleUnit === true || orig.isSingleUnit === true) &&
      !hasMultiUnitComplexEvidence;
    if (singleUnitConfirmed) {
      return {
        key: 'property_type_and_apartment',
        label: 'Property Type & Structure',
        status: 'passed',
        info: {
          property_type: ptRaw,
          is_apartment_type: true,
          is_single_unit_verified: true,
          is_multi_unit_complex: false,
          signals: unitNumber ? [...signals, 'single_unit_number_present'] : [...signals, 'total_units_1'],
        },
      };
    }

    return {
      key: 'property_type_and_apartment',
      label: 'Property Type & Structure',
      status: 'needs_review',
      reason: 'ambiguous_apartment_structure',
      info: {
        property_type: ptRaw,
        is_apartment_type: true,
        is_single_unit_verified: false,
        is_multi_unit_complex: false,
        signals: [...signals, 'missing_single_unit_confirmation'],
      },
    };
  }

  return {
    key: 'property_type_and_apartment',
    label: 'Property Type & Structure',
    status: 'passed',
    info: {
      property_type: ptRaw || null,
      is_apartment_type: false,
      is_single_unit_verified: false,
      is_multi_unit_complex: false,
      signals,
    },
  };
}

function isDisallowedIpOrHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h === '::' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.localhost') ||
    h.endsWith('.arpa')
  ) {
    return true;
  }
  // Reject IPv6 literals
  if (h.includes(':')) return true;
  // Reject dotted IPv4 literals (loopback, RFC1918, link-local 169.254.*, CGNAT 100.64/10, etc.)
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(h)) return true;
  if (/^\d+$/.test(h)) return true;
  return false;
}

export function isSafePublicHttpsUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    if (u.port && u.port !== '443') return false;
    if (isDisallowedIpOrHostname(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

const WATERMARK_URL_RE =
  /(?:watermark|shutterstock|istockphoto|gettyimages|alamy|123rf|dreamstime|depositphotos|mls[-_]?watermark|branded[-_]?overlay|stock[-_]?photo|placeholder[-_]?property)/i;

const STOCK_OR_AI_URL_RE =
  /(?:unsplash\.com|pexels\.com|pixabay\.com|stockcake|midjourney|dall[-_]?e|ai[-_]?generated)/i;

export function parseOrderedImageEntries(raw: unknown): Array<{
  url: string;
  flaggedWatermark: boolean;
}> {
  const arr = asArr(raw);
  const out: Array<{ url: string; flaggedWatermark: boolean }> = [];
  const seen = new Set<string>();

  for (const item of arr) {
    let url: string | null = null;
    let flagged = false;
    if (typeof item === 'string') {
      url = item.trim();
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      url = asStr(obj.url || obj.src || obj.href);
      flagged =
        obj.watermarked === true ||
        obj.has_watermark === true ||
        obj.watermark_flagged === true ||
        obj.is_watermarked === true ||
        Boolean(obj.watermark_reason);
    }
    if (!url || seen.has(url)) continue;
    seen.add(url);
    if (WATERMARK_URL_RE.test(url) || STOCK_OR_AI_URL_RE.test(url)) {
      flagged = true;
    }
    out.push({ url, flaggedWatermark: flagged });
  }
  return out;
}

async function checkSingleImageUrl(
  url: string,
  fetchImpl: typeof fetch,
): Promise<{ reachable: boolean; error?: string }> {
  if (!isSafePublicHttpsUrl(url)) {
    return { reachable: false, error: 'unsafe_or_non_https_url' };
  }

  let currentUrl = url;
  for (let hop = 0; hop < 3; hop++) {
    try {
      let res = await fetchImpl(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(4500),
      });

      if (res.status === 405 || res.status === 501) {
        await res.body?.cancel();
        res = await fetchImpl(currentUrl, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          redirect: 'manual',
          signal: AbortSignal.timeout(4500),
        });
      }

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        await res.body?.cancel();
        if (!loc) return { reachable: false, error: `redirect_no_location_${res.status}` };
        const nextUrl = new URL(loc, currentUrl).toString();
        if (!isSafePublicHttpsUrl(nextUrl)) return { reachable: false, error: 'unsafe_redirect_target' };
        currentUrl = nextUrl;
        continue;
      }

      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      await res.body?.cancel();

      if (!res.ok) return { reachable: false, error: `http_${res.status}` };
      if (ctype && !ctype.startsWith('image/') && !ctype.includes('octet-stream')) {
        return { reachable: false, error: `non_image_content_type:${ctype}` };
      }
      return { reachable: true };
    } catch (err) {
      return {
        reachable: false,
        error: err instanceof Error ? err.message : 'network_error',
      };
    }
  }
  return { reachable: false, error: 'too_many_redirects' };
}

export function extractQualitySignals(listing: Record<string, unknown>): string[] {
  const signals = new Set<string>();
  const rawDesc = [asStr(listing.original_description), asStr(listing.description)].filter(Boolean).join(' ');
  const bags = [
    ...asArr(listing.amenities),
    ...asArr(listing.appliances),
    ...asArr(listing.flooring),
    ...asArr(listing.utilities_included),
  ]
    .map((x) => asStr(x))
    .filter((x): x is string => Boolean(x))
    .join(' ');

  const combined = `${rawDesc} ${bags}`.toLowerCase();

  if (/\b(?:renovated|remodeled|updated)\s+(?:kitchen|bath|interior|home)/i.test(combined)) {
    signals.add('renovated_interior');
  }
  if (/\b(?:granite|quartz|marble)\b/i.test(combined)) signals.add('stone_countertops');
  if (/\bstainless\s+steel\b/i.test(combined)) signals.add('stainless_appliances');
  if (/\b(?:hardwood|lvp|vinyl\s+plank|wood\s+floor)/i.test(combined)) signals.add('hard_surface_flooring');
  if (listing.has_central_air === true || /\bcentral\s+(?:air|ac|hvac)\b/i.test(combined)) {
    signals.add('central_air');
  }
  if (/\bfenced\s+(?:yard|backyard)\b/i.test(combined)) signals.add('fenced_yard');
  if (asNum(listing.garage_spaces) && Number(listing.garage_spaces) > 0) signals.add('garage_parking');
  if (/\bwasher\s*(?:&|and)?\s*dryer|in[- ]unit\s+laundry/i.test(combined)) signals.add('in_unit_laundry');

  return Array.from(signals);
}

export async function validatePipelineProperty(
  listing: Record<string, unknown>,
  options: ValidatePropertyOptions = {},
): Promise<ValidationReport> {
  const fetchImpl = options.fetchImpl || fetch;
  const rulesMap = options.rulesMap || {};
  const minRequiredPhotos = Math.max(1, Number(rulesMap.min_usable_photos ?? 1) || 1);
  const profiles = Array.isArray(options.prohibitedProfiles) ? options.prohibitedProfiles : [];
  const checks: ValidationCheckResult[] = [];
  const reasons: string[] = [];

  // ── 1. Rental status & core completeness ──────────────────────────────────
  const sourceStatus = (asStr(listing.source_status) || 'available').toLowerCase();
  const rentalEligibilityStatus = (asStr(listing.rental_eligibility_status) || '').toLowerCase();
  const raw = asObj(listing.source_raw_payload);
  const hdpInfo = asObj(asObj(raw.hdpData).homeInfo);
  const rawStatus = (
    asStr(raw.homeStatus) ||
    asStr(hdpInfo.homeStatus) ||
    asStr(raw.listingStatus) ||
    asStr(raw.status) ||
    ''
  ).toUpperCase().replace(/[\s-]+/g, '_');
  const rent = asNum(listing.monthly_rent ?? listing.original_monthly_rent);
  const salePrice = asNum(raw.salePrice ?? raw.purchasePrice ?? hdpInfo.salePrice ?? asObj(raw.saleListing).price);
  const address = asStr(listing.address);
  const city = asStr(listing.city);
  const state = asStr(listing.state);
  const beds = asNum(listing.bedrooms);
  const baths = asNum(listing.bathrooms);
  const origDesc = asStr(listing.original_description) || asStr(listing.description);

  const nonRentalStatuses = new Set(['off_market', 'sold', 'rented', 'leased', 'unavailable', 'sale_only', 'unconfirmed']);
  const nonRentalRaw = new Set([
    'FOR_SALE',
    'SOLD',
    'RECENTLY_SOLD',
    'OFF_MARKET',
    'PENDING_SALE',
    'CONTINGENT',
    'AUCTION',
    'FORECLOSURE',
    'FSBO',
    'LEASED',
    'RENTED',
  ]);

  const rawForRentExplicitFalse = raw.isForRent === false && hdpInfo.isForRent !== true;
  const dualActiveConfirmed =
    (rentalEligibilityStatus === 'dual_listed_rental_active' || listing.is_dual_listed === true) &&
    !rawForRentExplicitFalse &&
    (raw.isForRent === true ||
      hdpInfo.isForRent === true ||
      asStr(raw.rentalStatus)?.toUpperCase() === 'ACTIVE' ||
      asStr(raw.rentalStatus)?.toUpperCase() === 'FOR_RENT' ||
      asNum(raw.monthlyRent ?? raw.rentalPrice ?? asObj(raw.rentalListing).monthlyRent) !== null);

  const hasDisallowedEligibility =
    rentalEligibilityStatus === 'sale_only' ||
    rentalEligibilityStatus === 'off_market' ||
    rentalEligibilityStatus === 'unconfirmed';

  const strictlyClosedRaw = new Set(['SOLD', 'RECENTLY_SOLD', 'OFF_MARKET', 'PENDING_SALE', 'CONTINGENT', 'AUCTION', 'FORECLOSURE', 'LEASED', 'RENTED']);

  if (
    hasDisallowedEligibility ||
    nonRentalStatuses.has(sourceStatus) ||
    strictlyClosedRaw.has(rawStatus) ||
    rawForRentExplicitFalse ||
    (nonRentalRaw.has(rawStatus) && !dualActiveConfirmed)
  ) {
    reasons.push('non_rental_or_off_market');
    checks.push({
      key: 'rental_status_and_completeness',
      label: 'Rental Status & Core Fields',
      status: 'rejected',
      reason: 'non_rental_or_off_market',
      details: {
        source_status: sourceStatus,
        raw_status: rawStatus || null,
        rental_eligibility_status: rentalEligibilityStatus || null,
      },
    });
  } else if (
    rent !== null &&
    (rent >= 50000 || (salePrice !== null && salePrice > 0 && (rent === salePrice || rent >= salePrice * 0.05)))
  ) {
    reasons.push('invalid_sale_price_as_rent');
    checks.push({
      key: 'rental_status_and_completeness',
      label: 'Rental Status & Core Fields',
      status: 'rejected',
      reason: 'invalid_sale_price_as_rent',
      details: { monthly_rent: rent, sale_price: salePrice },
    });
  } else if (!address || !city || !state || rent === null || rent <= 0 || beds === null || baths === null) {
    reasons.push('missing_core_fields');
    checks.push({
      key: 'rental_status_and_completeness',
      label: 'Rental Status & Core Fields',
      status: 'rejected',
      reason: 'missing_core_fields',
      details: {
        has_address: Boolean(address),
        has_city: Boolean(city),
        has_state: Boolean(state),
        monthly_rent: rent,
        bedrooms: beds,
        bathrooms: baths,
      },
    });
  } else if (!origDesc) {
    reasons.push('missing_source_description');
    checks.push({
      key: 'rental_status_and_completeness',
      label: 'Rental Status & Core Fields',
      status: 'needs_review',
      reason: 'missing_source_description',
      details: { monthly_rent: rent, bedrooms: beds, bathrooms: baths },
    });
  } else {
    checks.push({
      key: 'rental_status_and_completeness',
      label: 'Rental Status & Core Fields',
      status: 'passed',
      details: {
        monthly_rent: rent,
        bedrooms: beds,
        bathrooms: baths,
        decimal_baths_preserved: Number.isInteger(baths) ? false : true,
        is_dual_listed: listing.is_dual_listed === true,
      },
    });
  }

  // ── 2. Prohibited source profile matcher ──────────────────────────────────
  const prohibitedMatch = matchProhibitedProfiles(listing, profiles);
  if (prohibitedMatch.matched) {
    reasons.push('prohibited_source_profile');
    checks.push({
      key: 'prohibited_source_profile',
      label: 'Prohibited Profile Screen',
      status: 'rejected',
      reason: 'prohibited_source_profile',
      details: prohibitedMatch as unknown as Record<string, unknown>,
    });
  } else {
    checks.push({
      key: 'prohibited_source_profile',
      label: 'Prohibited Profile Screen',
      status: 'passed',
    });
  }

  // ── 3. Owner / Landlord Proof Verification ────────────────────────────────
  const posterVerification = evaluatePosterVerification(listing);
  const allowNonOwner =
    options.allowNonOwnerListing === true ||
    rulesMap.allow_non_owner_listing === true;
  if (!posterVerification.verified_owner_landlord && !allowNonOwner) {
    reasons.push('unverified_source_profile');
    checks.push({
      key: 'owner_landlord_verification',
      label: 'Owner / Landlord Proof',
      status: 'needs_review',
      reason: 'unverified_source_profile',
      details: posterVerification as unknown as Record<string, unknown>,
    });
  } else {
    checks.push({
      key: 'owner_landlord_verification',
      label: 'Owner / Landlord Proof',
      status: 'passed',
      details: {
        ...posterVerification,
        owner_only_required: !allowNonOwner,
      } as unknown as Record<string, unknown>,
    });
  }

  // ── 4. Property Type & Single-Apartment Gate ──────────────────────────────
  const aptEval = evaluateApartmentAndType(listing);
  checks.push({
    key: aptEval.key,
    label: aptEval.label,
    status: aptEval.status,
    reason: aptEval.reason || null,
    details: aptEval.info as unknown as Record<string, unknown>,
  });
  if (aptEval.reason) reasons.push(aptEval.reason);

  // ── 5. Photo Reachability, Count (>= min_usable_photos) & Watermark Screening
  const entries = parseOrderedImageEntries(listing.original_image_urls);
  const httpsEntries = entries.filter((e) => e.url.startsWith('https://'));
  const flaggedWatermarkedUrls = entries.filter((e) => e.flaggedWatermark).map((e) => e.url);

  // Check any prior watermark sniper flags stored in validation_report
  const prevReport = asObj(listing.validation_report);
  const prevSniperFlagged = asArr(prevReport.flagged_watermarked_urls).map(asStr).filter((x): x is string => Boolean(x));
  for (const prevUrl of prevSniperFlagged) {
    if (!flaggedWatermarkedUrls.includes(prevUrl)) flaggedWatermarkedUrls.push(prevUrl);
  }

  let reachableCount = httpsEntries.length;
  const unreachableUrls: string[] = [];
  let reachableChecked = false;

  if (options.checkPhotoReachability === true && httpsEntries.length > 0) {
    reachableChecked = true;
    const probeResults: Array<{ url: string; reachable: boolean }> = [];
    for (let i = 0; i < httpsEntries.length; i += 6) {
      const batch = httpsEntries.slice(i, i + 6);
      const batchRes = await Promise.all(
        batch.map(async (item) => {
          const chk = await checkSingleImageUrl(item.url, fetchImpl);
          return { url: item.url, reachable: chk.reachable };
        }),
      );
      probeResults.push(...batchRes);
    }
    const unreachableSet = new Set(probeResults.filter((r) => !r.reachable).map((r) => r.url));
    unreachableUrls.push(...Array.from(unreachableSet));
    reachableCount = httpsEntries.filter((e) => !unreachableSet.has(e.url)).length;
  }

  const visionStatus: ValidationReport['media_check']['vision_scan_status'] =
    httpsEntries.length > 0 ? 'manual_visual_review_required' : 'not_requested';

  const flaggedSet = new Set(flaggedWatermarkedUrls);
  const unreachableSet = new Set(unreachableUrls);
  const usableCount = httpsEntries.filter(
    (e) => !flaggedSet.has(e.url) && !unreachableSet.has(e.url),
  ).length;

  let mediaStatus: ValidationStatus = 'passed';
  let mediaReason: string | null = null;
  if (flaggedWatermarkedUrls.length > 0) {
    mediaStatus = 'needs_review';
    mediaReason = 'watermarked_or_branded_image_detected';
  }
  if (usableCount < minRequiredPhotos) {
    mediaStatus = 'rejected';
    mediaReason = flaggedWatermarkedUrls.length > 0 && httpsEntries.length >= minRequiredPhotos
      ? 'watermarked_images_below_minimum'
      : 'insufficient_usable_photos';
  }
  if (mediaReason) reasons.push(mediaReason);

  checks.push({
    key: 'media_and_watermark_gate',
    label: `Photos (>= ${minRequiredPhotos}) & Watermark Screen`,
    status: mediaStatus,
    reason: mediaReason,
    details: {
      total_urls: entries.length,
      unique_https_urls: httpsEntries.length,
      usable_count: usableCount,
      min_required: minRequiredPhotos,
      reachable_checked: reachableChecked,
      reachable_count: reachableCount,
      unreachable_count: unreachableUrls.length,
      flagged_watermark_count: flaggedWatermarkedUrls.length,
      vision_scan_status: visionStatus,
    },
  });

  // ── 6. Phase 5: 3-Layer Verification, Location/School Cross-Check & Conflicts
  const locDetails = asObj(listing.location_details);
  const ledger = asObj(listing.source_facts_ledger);
  const ledgerFacts = asObj(ledger.facts);
  const ledgerConflicts = asArr(ledger.conflicts);

  const shouldVerifyExternal =
    options.verifyLocationAndSchools === true ||
    (options.verifyLocationAndSchools !== false && rulesMap.enable_external_location_verification === true);

  const locationVerification = await verifyLocationAndSchools(
    {
      lat: listing.lat,
      lng: listing.lng,
      address,
      city,
      state,
      zip: listing.zip,
      county: listing.county ?? locDetails.county,
      neighborhood: listing.neighborhood ?? locDetails.neighborhood,
      school_district: listing.school_district ?? locDetails.school_district,
      location_details: locDetails,
    },
    {
      geoapifyApiKey: options.geoapifyApiKey,
      enableExternalChecks: shouldVerifyExternal,
      fetchImpl,
    },
  );

  const fieldVerificationStatus: Record<string, FieldVerificationStatus> = {
    address: address ? 'source_confirmed' : 'not_available',
    city: locationVerification.field_statuses.city,
    state: locationVerification.field_statuses.state,
    zip: locationVerification.field_statuses.zip,
    county: locationVerification.field_statuses.county,
    neighborhood: locationVerification.field_statuses.neighborhood,
    location_coordinates: locationVerification.field_statuses.location_coordinates,
    school_district: locationVerification.field_statuses.school_district,
    monthly_rent: rent !== null && rent > 0
      ? (salePrice !== null && (rent === salePrice || rent >= salePrice * 0.05) ? 'conflicting_sources' : 'source_confirmed')
      : 'not_available',
    bedrooms: beds !== null ? 'source_confirmed' : 'not_available',
    bathrooms: baths !== null ? 'source_confirmed' : 'not_available',
    square_footage: asNum(listing.square_footage) ? 'source_confirmed' : 'not_available',
    property_type: aptEval.info.property_type ? 'source_confirmed' : 'not_available',
    description: origDesc ? 'source_confirmed' : 'not_available',
    photos: usableCount >= minRequiredPhotos
      ? (reachableChecked ? 'independently_verified' : 'source_confirmed')
      : httpsEntries.length > 0
      ? 'conflicting_sources'
      : 'not_available',
    rental_eligibility: hasDisallowedEligibility || nonRentalStatuses.has(sourceStatus) || (nonRentalRaw.has(rawStatus) && !dualActiveConfirmed)
      ? 'conflicting_sources'
      : listing.is_dual_listed === true
      ? (dualActiveConfirmed ? 'independently_verified' : 'unverified')
      : 'source_confirmed',
  };

  // Map Phase 3 source_facts_ledger 4-state ledger onto 3-layer confidence statuses
  const ledgerFieldKeys = [
    'heating',
    'cooling',
    'central_air',
    'appliances',
    'laundry',
    'flooring',
    'parking',
    'garage',
    'ev_charging',
    'basement',
    'fireplace',
    'pool',
    'fencing',
    'utilities_included',
    'hoa',
  ];
  for (const fk of ledgerFieldKeys) {
    const entry = asObj(ledgerFacts[fk]);
    const st = asStr(entry.state);
    if (st === 'confirmed_present' || st === 'confirmed_absent') {
      fieldVerificationStatus[fk] = 'source_confirmed';
    } else if (st === 'not_applicable') {
      fieldVerificationStatus[fk] = 'not_available';
    } else if (st === 'unspecified') {
      fieldVerificationStatus[fk] = 'unverified';
    } else {
      // Fallback for pre-Phase 3 rows lacking source_facts_ledger
      const fallbackMap: Record<string, unknown> = {
        heating: listing.heating_type,
        cooling: listing.cooling_type,
        central_air: listing.has_central_air,
        appliances: asArr(listing.appliances).length ? listing.appliances : null,
        laundry: listing.laundry_type,
        flooring: asArr(listing.flooring).length ? listing.flooring : null,
        parking: listing.parking,
        garage: listing.garage_spaces,
        basement: listing.has_basement,
        utilities_included: asArr(listing.utilities_included).length ? listing.utilities_included : null,
      };
      if (fk in fallbackMap) {
        const val = fallbackMap[fk];
        fieldVerificationStatus[fk] = val !== null && val !== undefined && val !== '' ? 'source_confirmed' : 'not_available';
      }
    }
  }

  const verificationConflicts: VerificationConflict[] = [...locationVerification.conflicts];
  const seenConflictKeys = new Set(
    verificationConflicts.map((c) => `${c.field}:${c.source}`),
  );

  const pushConflict = (conflict: VerificationConflict) => {
    const k = `${conflict.field}:${conflict.source}`;
    if (!seenConflictKeys.has(k)) {
      seenConflictKeys.add(k);
      verificationConflicts.push(conflict);
    }
    fieldVerificationStatus[conflict.field] = 'conflicting_sources';
  };

  // Ingest Phase 3 structured-vs-narrative conflicts from source_facts_ledger
  for (const rawConflict of ledgerConflicts) {
    const cObj = asObj(rawConflict);
    const field = asStr(cObj.field);
    const msg = asStr(cObj.message);
    if (!field || !msg) continue;
    const sevRaw = asStr(cObj.severity);
    const severity: VerificationConflict['severity'] =
      sevRaw === 'critical' || sevRaw === 'warning' || sevRaw === 'info' ? sevRaw : 'warning';
    pushConflict({
      field,
      severity,
      source: 'source_facts_ledger',
      source_value: cObj.structured_value ?? null,
      expected_or_claimed_value: cObj.narrative_claim ?? null,
      message: msg,
    });
  }

  // Fallback narrative vs structured conflict checks for legacy rows without ledger
  const descLower = (origDesc || '').toLowerCase();
  if (listing.has_central_air === false && /\bcentral\s*(?:air|a\/c|ac|cooling)\b/i.test(descLower)) {
    pushConflict({
      field: 'central_air',
      severity: 'warning',
      source: 'structured_vs_narrative',
      source_value: false,
      expected_or_claimed_value: 'central air',
      message: 'Structured has_central_air is false while description mentions central air.',
    });
  }
  const explicitGarageSpaces = asNum(listing.garage_spaces);
  if (
    explicitGarageSpaces !== null &&
    explicitGarageSpaces === 0 &&
    /\b(?:\d+[-\s]*car\s+)?garage\b/i.test(descLower) &&
    !/\bno\s+garage\b/i.test(descLower)
  ) {
    pushConflict({
      field: 'garage',
      severity: 'warning',
      source: 'structured_vs_narrative',
      source_value: 0,
      expected_or_claimed_value: 'garage',
      message: 'Structured garage_spaces is 0 while description mentions a garage.',
    });
  }

  if (rent !== null && (rent >= 50000 || (salePrice !== null && salePrice > 0 && (rent === salePrice || rent >= salePrice * 0.05)))) {
    pushConflict({
      field: 'monthly_rent',
      severity: 'critical',
      source: 'dual_listed_rent_sanity',
      source_value: rent,
      expected_or_claimed_value: salePrice,
      message: 'Monthly rent value appears to match purchase price range on dual-listed/sale listing.',
    });
  }

  if (!locationVerification.coordinates_valid) {
    checks.push({
      key: 'location_and_school_verification',
      label: 'Location & School Verification',
      status: 'passed',
      details: {
        coordinates_valid: false,
        geoapify_status: locationVerification.geoapify_status,
        census_status: locationVerification.census_status,
        note: 'No coordinates provided; spatial cross-check marked not_available.',
      },
    });
  } else if (locationVerification.critical_mismatch) {
    reasons.push('location_geocode_mismatch');
    checks.push({
      key: 'location_and_school_verification',
      label: 'Location & School Verification',
      status: 'needs_review',
      reason: 'location_geocode_mismatch',
      details: {
        coordinates_valid: true,
        geoapify_status: locationVerification.geoapify_status,
        census_status: locationVerification.census_status,
        mismatch_reasons: locationVerification.mismatch_reasons,
        conflicts: locationVerification.conflicts,
      },
    });
  } else {
    checks.push({
      key: 'location_and_school_verification',
      label: 'Location & School Verification',
      status: 'passed',
      details: {
        coordinates_valid: true,
        external_checks_attempted: locationVerification.external_checks_attempted,
        geoapify_status: locationVerification.geoapify_status,
        census_status: locationVerification.census_status,
        conflict_count: locationVerification.conflicts.length,
        conflicts: locationVerification.conflicts,
      },
    });
  }

  // Build verification summary metrics
  const statusCounts = {
    independently_verified: 0,
    source_confirmed: 0,
    partially_verified: 0,
    conflicting_sources: 0,
    unverified: 0,
    not_available: 0,
  };
  for (const st of Object.values(fieldVerificationStatus)) {
    if (st in statusCounts) statusCounts[st]++;
  }
  const coveredKeyCount = Number(ledger.covered_key_count ?? 0) || 0;
  const sourceFactsLedgerComplete = Object.keys(ledgerFacts).length > 0 && coveredKeyCount > 0;
  const criticalConflictCount = verificationConflicts.filter((c) => c.severity === 'critical').length;

  // ── Overall outcome priority: rejected > needs_review > passed ────────────
  let overallStatus: ValidationStatus = 'passed';
  if (checks.some((c) => c.status === 'rejected')) {
    overallStatus = 'rejected';
  } else if (checks.some((c) => c.status === 'needs_review')) {
    overallStatus = 'needs_review';
  }

  const firstProblem = checks.find((c) => c.status === overallStatus && c.reason);
  const primaryReason = firstProblem?.reason || reasons[0] || null;

  return {
    status: overallStatus,
    needs_review: overallStatus === 'needs_review',
    primary_reason: primaryReason,
    reasons: Array.from(new Set(reasons)),
    checks,
    prohibited_match: prohibitedMatch,
    poster_verification: posterVerification,
    apartment_check: aptEval.info,
    media_check: {
      total_urls: entries.length,
      unique_https_urls: httpsEntries.length,
      min_required: minRequiredPhotos,
      reachable_checked: reachableChecked,
      reachable_count: reachableCount,
      unreachable_urls: unreachableUrls,
      flagged_watermarked_urls: flaggedWatermarkedUrls,
      vision_scan_status: visionStatus,
    },
    field_verification_status: fieldVerificationStatus,
    verification_conflicts: verificationConflicts,
    location_verification: {
      coordinates_valid: locationVerification.coordinates_valid,
      external_checks_attempted: locationVerification.external_checks_attempted,
      geoapify_status: locationVerification.geoapify_status,
      census_status: locationVerification.census_status,
      critical_mismatch: locationVerification.critical_mismatch,
      reverse_geocode: locationVerification.reverse_geocode,
      census_schools: locationVerification.census_schools,
    },
    verification_summary: {
      total_fields: Object.keys(fieldVerificationStatus).length,
      ...statusCounts,
      conflict_count: verificationConflicts.length,
      critical_conflict_count: criticalConflictCount,
      source_facts_ledger_complete: sourceFactsLedgerComplete,
      covered_key_count: coveredKeyCount,
    },
    manual_verification_checklist: {
      side_by_side_source_check_required: false,
      photo_watermark_inspection_required: false,
      missing_fields_refill_check_required: false,
      manual_description_rewrite_required: false,
      required_actions: [],
    },
    quality_signals: extractQualitySignals(listing),
    policy_version: {
      id: options.policySet?.id ?? null,
      version_label: options.policySet?.version_label ?? null,
      version_number: options.policySet?.version_number ?? null,
    },
    validated_at: new Date().toISOString(),
  };
}
