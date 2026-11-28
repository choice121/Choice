// ============================================================================
// Choice Properties — Shared Description Enrichment Engine (Nov 20 Baseline)
// ============================================================================
// Deterministic privacy-scrubbing enrichment aligned with PB-20261120-E00D:
//   - Preserves each property's authentic `original_description` verbatim
//   - Strips Choice-prohibited lines (deposits, lease terms/durations,
//     availability/move-in dates, smoking, pets, showing/tour CTAs, external
//     contacts/URLs/portals, payment-app spam, non-$50/free/admin fees,
//     RBP/protection plans, move-in promos, and applicant screening blocks)
//   - Falls back to a concise verified-spec summary ONLY if < 20 chars remain
//   - Appends standard "$50 application fee" footer strictly once
//   - Zero AI rewriting, zero templates, zero manual_rewrite holds
// ============================================================================

export type DescriptionMode = 'sanitize_only' | 'baseline_rewrite' | 'manual_rewrite';
export type EnrichmentStatus = 'enriched' | 'needs_review' | 'failed';
export type EnrichmentMethod = 'deterministic_sanitize_only' | 'manual_ai_rewrite';

export const STANDARD_APPLICATION_FEE_FOOTER =
  'Application Fee: $50. Submit your rental application today at Choice Properties.';

const PHONE_OR_EMAIL_RE =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i;

const EXTERNAL_URL_RE =
  /https?:\/\/\S+|\bwww\.[a-z0-9.-]+\.[a-z]{2,}|\bapplication\s+at\s+[a-z0-9.-]{3,}/i;

const PORTAL_RE =
  /\b(?:zillow|realtor\.com|opendoor|turbotenant|apartments\s*(?:\.|dot)\s*com|redfin|trulia|rentcafe|rentspree|appfolio|craigslist|facebook\s+marketplace|hotpads|zumper)\b/i;

const PROHIBITED_CATEGORIES: Array<{ key: string; pattern: RegExp }> = [
  {
    key: 'security_deposit',
    pattern:
      /\b(?:security\s+)?deposit\b|\bdep\s+is\b|\bof\s+dep\b|\bapplicable\s+deposits?\b|\bfirst\s+(?:and\s+last\s+)?month(?:'s|s)?\s+rent\s+due\b|\blast\s+month(?:'s|s)?\s+rent\s+due\b|\bdeposit\s+free\b|\bone\s+month\s+rent\s+as\s+deposit\b/i,
  },
  {
    key: 'lease_terms',
    pattern:
      /\b(?:minimum\s+)?lease\s+(?:term|terms|duration|length|details|commencement)\b|\bleasing\s+terms?\b|\b\d+[- ]?(?:year|month)s?\s+lease\b|\b(?:one|two|three)[-\s]+year\s+lease\b|\bto\s+a\s+year\s+lease\b|\b\d+\s+year\s+rental\s+terms?\b|\bshorter\s+terms?\b|\blease\s+(?:is\s+for|signed)\b|\bsigning\s+of\s+lease\b|\bmonth[- ]to[- ]month\s+after\b|\bas\s+specified\s+in\s+the\s+lease\b/i,
  },
  {
    key: 'availability_dates',
    pattern:
      /\bavailable\s+(?:now|immediately|today|asap|on|from|starting|date|for\s+(?:rent|move[- ]?in)|january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{1,2}(?:st|nd|rd|th))?\b|\bmove[- ]?in\s+(?:ready|date|special|fee|policy)\b|\bready\s+for\s+move[- ]?in\b|\bready\s+to\s+move\s+in\b|\bcheck\s+availability\b|\bmove\s+in\s+by\b|\bwithin\s+\d+\s+weeks?\s+of\s+approval\b|\bavailability\s+and\s+rental\s+terms\b/i,
  },
  {
    key: 'smoking_policy',
    pattern:
      /\bsmok(?:e|ing)(?:-free|\s+policy|\s+allowed|\s+not\s+allowed|\s+is\s+(?:prohibited|not\s+allowed|permitted))?\b|\bno\s+smoking\b|\bnon[- ]?smoker\b/i,
  },
  {
    key: 'pet_policy',
    pattern:
      /\bpet[- ]friendly\b|\bpets?\s+(?:are\s+|is\s+)?(?:welcome|allowed|not\s+allowed|case\s*by\s*case|negotiable|subject\s+to\s+approval|considered|on\s+approval)\b|\bno\s+pets\b|\bpet\s+(?:fee|rent|deposit|policy|charge|screening|move-in)\b|\bpetscreening\b|\bper\s+(?:approved\s+)?pet\b|\b(?:small|large)?\s*(?:dog|dogs|cat|cats)\s+(?:are\s+|is\s+)?(?:welcome|allowed|ok|negotiable)\b/i,
  },
  {
    key: 'showing_and_contact_cta',
    pattern:
      /\b(?:schedule|book|request|arrange|scheduling)\s+(?:a\s+|your\s+)?(?:private\s+|in[- ]person\s+)?(?:property\s+)?(?:tour|showing|viewing|walkthrough)\b|\b(?:in[- ]person|private)\s+(?:property\s+)?showings?\b|\btours?\s*(?::|\s+(?:are\s+)?(?:available|scheduled))\b|\bopen\s+house\b|\b(?:call|text|contact|reach\s+out\s+to|message)\s+(?:us|me|the\s+(?:agent|owner|landlord|manager|property\s+manager)|landlord|for\s+details|[A-Z][a-z]+)\b|\blisted\s+by\b|\bcourtesy\s+of\b|\bMLS\s*#?\s*\d+\b|\blicense\s*#\s*[A-Z0-9]+\b|\bproperty\s+manager\b|\bplease\s+(?:call|text|feel\s+free\s+to\s+reach\s+out)\b|\bez\s+going\s+lndlrd\b/i,
  },
  {
    key: 'management_and_office_hours',
    pattern:
      /\bprofessionally\s+managed\s+by\b|\bmanaged\s+exclusively\s+by\b|\bmanagement\s+company\b|\boffice\s+hours\b|\bkey\s+check\s*out\b|\bcheck\s+out\s+a\s+key\b|\bmon(?:day)?\s*[-–]\s*fri(?:day)?\b|\b\d{1,2}:\d{2}\s*(?:am|pm)\s*[-–]\s*\d{1,2}:\d{2}\s*(?:am|pm)\b|\bequal\s+housing\s+opportunity\b/i,
  },
  {
    key: 'illustrative_photos_disclaimer',
    pattern:
      /\b(?:all\s+)?photos?\s+(?:shown\s+)?are\s+for\s+illustrative\s+purposes\b|\brepresentative\s+photos?\b|\bphotos?\s+may\s+not\s+(?:reflect|represent)\s+(?:the\s+)?actual\s+unit\b|\bstock\s+photos?\b/i,
  },
  {
    key: 'portal_or_url',
    pattern: new RegExp(`${EXTERNAL_URL_RE.source}|${PORTAL_RE.source}`, 'i'),
  },
  {
    key: 'phone_or_email',
    pattern: PHONE_OR_EMAIL_RE,
  },
  {
    key: 'payment_scam_or_promo',
    pattern:
      /\b(?:cash\s*app|zelle|paypal|venmo|apple\s*pay|wire\s*transfer|western\s*union|money\s*order)\b|\b(?:scam|fraud)\b|\boffering\s+50%\s+off\b|\b50%\s+off\s+the\s+first\s+month\b/i,
  },
  {
    key: 'applicant_screening_requirements',
    pattern:
      /\b(?:requirements?\s*&\s*qualifications?|qualifications?\s+to\s+rent|applicants?\s+must\s+have|credit\s+score|credit\s+requirement|income\s+requirement|income\s+must|household\s+income|no\s+(?:recent\s+)?evictions|broken\s+leases|criminal\s+history|corporate\s+leases?|application\s+pending|waiting\s+list)\b/i,
  },
  {
    key: 'prohibited_fee_or_sale',
    pattern:
      /\b(?:free|no|zero|waived|complimentary)\s+(?:application\s+)?fee\b|\bapplication\s+fee\s*(?:is\s*|:\s*)?(?:waived|\$?\d+|free)\b|\bapplication\s+\$?\d+(?:\s*\/\s*person|\s+per\s+adult)?\b|\bapplication\s*:\s*\$\d+|\b(?:app|adm(?:in|inistration)|processing)\s+fee\b|\b(?:for\s+sale|mortgage|down\s+payment|closing\s+costs?|make\s+an\s+offer)\b|\bresidents?\s+benefits?\s+package\b|\bbuilding\s+protection\s+plan\b|\b(?:monthly\s+)?rent\s*(?::|is)\s*\$?\d[\d,]*/i,
  },
];

export interface EnrichmentPolicyConfig {
  mode?: DescriptionMode;
  maxLengthVariancePct?: number;
  applicationFee?: number;
  policyVersion?: string | null;
}

export interface EnrichOptions {
  policy?: EnrichmentPolicyConfig;
  rulesMap?: Record<string, unknown>;
  policySet?: { id?: string | null; version_label?: string | null; version_number?: number | null } | null;
  manualDescription?: string | null;
  /** @deprecated Kept for call-site compatibility only. */
  useAi?: boolean;
}

export interface EnrichmentResult {
  status: EnrichmentStatus;
  needs_review: boolean;
  review_reason: string | null;
  original_description: string;
  sanitized_baseline: string;
  ai_description_draft: string | null;
  approved_description: string | null;
  mode: DescriptionMode;
  enrichment_method: EnrichmentMethod;
  manual_enrichment_required: boolean;
  model: string;
  original_hash: string;
  cleaned_hash: string;
  confidence: number;
  reasons: string[];
  changes: {
    stripped_categories: string[];
    removed_segment_count: number;
    original_length: number;
    sanitized_length: number;
    final_length: number;
    variance_pct: number;
    max_variance_pct: number;
    ai_used: boolean;
    ai_rejected_reason: string | null;
  };
  ruleset_version: string | null;
  latency_ms: number;
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function sanitizeBaselineDescription(raw: string): {
  sanitized: string;
  strippedCategories: string[];
  removedSegmentCount: number;
} {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { sanitized: '', strippedCategories: [], removedSegmentCount: 0 };
  }

  let text = raw
    .replace(/\r\n/g, '\n')
    .replace(/(?:^|\n)\s*All\s+(?:[A-Z][A-Za-z0-9\s&.'-]{1,40}\s+)?residents\s+are\s+enrolled\s+in\s+the\s+Resident\s+Benefits\s+Package[\s\S]*?(?=\n\n|$)/gi, '')
    .replace(/_{3,}\s*RENT\s+WITH\s+MYND[\s\S]*$/gi, '')
    .replace(/\*\*WARNING\s+AVOID\s+SCAMS\*\*[\s\S]*?DETAILS\)\.?/gi, '')
    .replace(/^\s*(?:For\s+Rent\s+by\s+Private\s+Owner\s*:?|Privately\s+owned)\s*/gim, '')
    .replace(/^\s*3D\s+TOUR(?:\s+LINK)?\s*\n+/gim, '')
    .replace(/Apartments\s*\.\s*com/gi, 'apartments.com')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, ' ');

  const strippedSet = new Set<string>();
  let removedSegmentCount = 0;

  // Strip Choice's own footer if already present so it is applied strictly once at the end
  text = text
    .replace(/Application\s+Fee:\s*\$50\.\s*Submit\s+your\s+rental\s+application\s+today\s+at\s+Choice\s+Properties\.?/gi, '')
    .trim();

  const segments = text
    .split(/\n+|(?<=[.!?])\s+|\s+-\s+(?=[A-Z])/)
    .map((s) => s.replace(/^[*•\-–—]+\s*/, '').trim())
    .filter(Boolean);

  const kept: string[] = [];
  for (const segment of segments) {
    let blocked = false;
    for (const cat of PROHIBITED_CATEGORIES) {
      if (cat.pattern.test(segment)) {
        strippedSet.add(cat.key);
        blocked = true;
      }
    }
    if (blocked) {
      removedSegmentCount++;
      continue;
    }
    kept.push(segment);
  }

  let sanitized = kept
    .join(' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;!?])/g, '$1')
    .replace(/\.{2,}/g, '.')
    .trim();

  if (sanitized && !/[.!?]$/.test(sanitized)) {
    sanitized += '.';
  }

  return {
    sanitized,
    strippedCategories: Array.from(strippedSet),
    removedSegmentCount,
  };
}

function buildMinimalStructuredFallback(prop: Record<string, unknown>): string {
  const beds = Number(prop.bedrooms);
  const baths = Number(prop.bathrooms);
  const rawType = typeof prop.property_type === 'string' ? prop.property_type.trim().toLowerCase() : '';
  const typeLabel =
    rawType === 'duplex' ? 'duplex'
      : rawType === 'townhouse' ? 'townhome'
      : rawType === 'apartment' ? 'apartment'
      : rawType === 'condo' ? 'condo'
      : 'home';

  const parts: string[] = [];
  if (Number.isFinite(beds) && beds > 0 && Number.isFinite(baths) && baths > 0) {
    parts.push(`${beds}-bedroom, ${baths}-bath ${typeLabel}`);
  } else {
    parts.push(`Residential ${typeLabel}`);
  }

  const loc =
    (typeof prop.neighborhood === 'string' && prop.neighborhood.trim()) ||
    (typeof prop.city === 'string' && prop.city.trim()) ||
    '';
  if (loc) parts[0] += ` in ${loc}`;

  const extras: string[] = [];
  const sqft = Number(prop.square_footage);
  if (Number.isFinite(sqft) && sqft > 0) extras.push(`${sqft.toLocaleString()} sq. ft.`);

  const parseArr = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map((x) => String(x || '').trim()).filter(Boolean);
    if (typeof v === 'string' && v.trim().startsWith('[')) {
      try {
        const p = JSON.parse(v);
        if (Array.isArray(p)) return p.map((x) => String(x || '').trim()).filter(Boolean);
      } catch {
        // ignore
      }
    }
    return [];
  };

  const flooring = parseArr(prop.flooring);
  if (flooring.length) extras.push(`${flooring.slice(0, 2).join(' and ').toLowerCase()} flooring`);
  if (prop.has_central_air === true || /central/i.test(String(prop.cooling_type || ''))) {
    extras.push('central air');
  }
  if (typeof prop.heating_type === 'string' && prop.heating_type.trim()) {
    extras.push(prop.heating_type.trim().toLowerCase());
  }
  if (typeof prop.laundry_type === 'string' && prop.laundry_type.trim()) {
    extras.push(prop.laundry_type.trim().toLowerCase());
  }
  const garage = Number(prop.garage_spaces);
  if (Number.isFinite(garage) && garage > 0) {
    extras.push(`${garage}-car garage`);
  } else if (typeof prop.parking === 'string' && prop.parking.trim()) {
    extras.push(prop.parking.trim().toLowerCase());
  }

  const sentence = extras.length > 0
    ? `${parts[0]} featuring ${extras.join(', ')}.`
    : `${parts[0]}.`;
  return sentence;
}

export function lintChoiceDescription(
  candidateBody: string,
  _sanitizedBaseline: string,
  _maxVariancePct: number,
  _opts: { allowVerifiedSpecNumbers?: boolean } = {},
): { ok: boolean; reason: string | null; variancePct: number } {
  const body = candidateBody.trim();
  if (!body || body.length < 10) {
    return { ok: false, reason: 'output_too_short', variancePct: 100 };
  }

  for (const cat of PROHIBITED_CATEGORIES) {
    if (cat.pattern.test(body)) {
      return { ok: false, reason: `prohibited_content_leaked:${cat.key}`, variancePct: 0 };
    }
  }

  if (/\$(?!50\b)\d+\s*(?:application|app)\s*fee/i.test(body)) {
    return { ok: false, reason: 'prohibited_fee_amount_leaked', variancePct: 0 };
  }

  return { ok: true, reason: null, variancePct: 0 };
}

export async function enrichPropertyDescription(
  prop: Record<string, unknown>,
  options: EnrichOptions = {},
): Promise<EnrichmentResult> {
  const startedAt = Date.now();
  const rulesMap = options.rulesMap || {};
  const policyCfg = options.policy || {};

  const manualInputRaw =
    typeof options.manualDescription === 'string' && options.manualDescription.trim()
      ? options.manualDescription.trim()
      : typeof prop.manual_description === 'string' && prop.manual_description.trim()
      ? prop.manual_description.trim()
      : null;

  const rawMode = String(
    manualInputRaw
      ? 'manual_rewrite'
      : policyCfg.mode ?? rulesMap.description_mode ?? 'sanitize_only',
  ).trim();
  const mode: DescriptionMode =
    rawMode === 'manual_rewrite'
      ? 'manual_rewrite'
      : rawMode === 'baseline_rewrite'
      ? 'baseline_rewrite'
      : 'sanitize_only';

  const rulesetVersion =
    policyCfg.policyVersion ??
    options.policySet?.version_label ??
    (options.policySet?.version_number ? `v${options.policySet.version_number}` : 'v1');

  const rawOriginal =
    (typeof prop.original_description === 'string' && prop.original_description.trim()
      ? prop.original_description
      : typeof prop.description === 'string'
      ? prop.description
      : ''
    ).trim();

  const originalHash = await sha256Hex(rawOriginal);
  const { sanitized, strippedCategories, removedSegmentCount } = sanitizeBaselineDescription(rawOriginal);

  // Optional explicit manual override if submitted via save_manual_enrichment
  if (mode === 'manual_rewrite' && manualInputRaw) {
    const cleanedManual = sanitizeBaselineDescription(manualInputRaw).sanitized || manualInputRaw.trim();
    const normalizedManual = /[.!?]$/.test(cleanedManual) ? cleanedManual : `${cleanedManual}.`;
    const finalApproved = `${normalizedManual} ${STANDARD_APPLICATION_FEE_FOOTER}`;
    return {
      status: 'enriched',
      needs_review: false,
      review_reason: null,
      original_description: rawOriginal,
      sanitized_baseline: sanitized,
      ai_description_draft: finalApproved,
      approved_description: finalApproved,
      mode: 'manual_rewrite',
      enrichment_method: 'manual_ai_rewrite',
      manual_enrichment_required: false,
      model: 'manual-override',
      original_hash: originalHash,
      cleaned_hash: await sha256Hex(finalApproved),
      confidence: 0.99,
      reasons: ['manual_override_applied'],
      changes: {
        stripped_categories: strippedCategories,
        removed_segment_count: removedSegmentCount,
        original_length: rawOriginal.length,
        sanitized_length: sanitized.length,
        final_length: finalApproved.length,
        variance_pct: 0,
        max_variance_pct: 100,
        ai_used: false,
        ai_rejected_reason: null,
      },
      ruleset_version: rulesetVersion,
      latency_ms: Date.now() - startedAt,
    };
  }

  // Deterministic authentic source preservation (Nov 20 PB-20261120-E00D behavior):
  // Keep original sanitized copy verbatim; only fall back to factual spec line if < 20 chars survive scrubbing.
  const wordCount = sanitized ? sanitized.split(/\s+/).filter(Boolean).length : 0;
  const usedFallback = !sanitized || sanitized.length < 20 || wordCount < 4;
  const bodyText = usedFallback ? buildMinimalStructuredFallback(prop) : sanitized;
  const normalizedBody = /[.!?]$/.test(bodyText) ? bodyText : `${bodyText}.`;
  const finalApproved = `${normalizedBody} ${STANDARD_APPLICATION_FEE_FOOTER}`;
  const cleanedHash = await sha256Hex(finalApproved);

  return {
    status: 'enriched',
    needs_review: false,
    review_reason: null,
    original_description: rawOriginal,
    sanitized_baseline: sanitized,
    ai_description_draft: finalApproved,
    approved_description: finalApproved,
    mode: 'sanitize_only',
    enrichment_method: 'deterministic_sanitize_only',
    manual_enrichment_required: false,
    model: 'sanitize-only',
    original_hash: originalHash,
    cleaned_hash: cleanedHash,
    confidence: usedFallback ? 0.9 : 0.98,
    reasons: usedFallback
      ? ['minimal_structured_fallback', ...strippedCategories]
      : strippedCategories.length
      ? strippedCategories
      : ['clean_baseline_preserved'],
    changes: {
      stripped_categories: strippedCategories,
      removed_segment_count: removedSegmentCount,
      original_length: rawOriginal.length,
      sanitized_length: sanitized.length,
      final_length: finalApproved.length,
      variance_pct: 0,
      max_variance_pct: 100,
      ai_used: false,
      ai_rejected_reason: null,
    },
    ruleset_version: rulesetVersion,
    latency_ms: Date.now() - startedAt,
  };
}
