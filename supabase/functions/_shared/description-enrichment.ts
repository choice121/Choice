// ============================================================================
// Choice Properties — Phase 7 Shared Description Enrichment Engine
// ============================================================================
// Reads `original_description` strictly as baseline:
//   - Preserves original meaning, factual statements, tone, and comparable length
//   - Enforces Choice sanitization (strips broker/agent/PM promos, phones, emails,
//     office/key-checkout hours, external URLs/portals, deposits, lease terms,
//     availability, smoking, pets, showing/tour CTAs, $0/free fee claims,
//     Resident Benefits Package/Protection Plans, stale inline rent/fee lines,
//     illustrative-photo disclaimers, and decorative emoji clutter)
//   - Appends standard "$50 application fee" footer
//   - Checks for incomplete or contradictory source copy -> holds in needs_review
//   - Zero external LLM / GEMINI_API_KEY dependency:
//       * `manual_rewrite`: Accepts a bespoke description crafted manually by
//         the assisting AI side-by-side against Zillow source data + Choice lint.
//       * `baseline_rewrite` / `sanitize_only`: Deterministic sanitization safety
//         net that flags `manual_enrichment_required: true` so the assisting AI
//         completes manual side-by-side verification & bespoke description rewrite.
// ============================================================================

export type DescriptionMode = 'manual_rewrite' | 'baseline_rewrite' | 'sanitize_only';
export type EnrichmentStatus = 'enriched' | 'needs_review' | 'failed';
export type EnrichmentMethod =
  | 'manual_ai_rewrite'
  | 'deterministic_sanitize_only'
  | 'deterministic_sanitize_only_needs_manual_rewrite';

export const STANDARD_APPLICATION_FEE_FOOTER =
  'Application Fee: $50. Submit your rental application today at Choice Properties.';

const PHONE_OR_EMAIL_RE =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i;

const EXTERNAL_URL_RE = /https?:\/\/\S+|\bwww\.[a-z0-9.-]+\.[a-z]{2,}/i;

const PORTAL_RE =
  /\b(?:zillow|realtor\.com|opendoor|turbotenant|apartments\s*(?:\.|dot)\s*com|redfin|trulia|rentcafe|rentspree|appfolio|craigslist|facebook\s+marketplace|hotpads|zumper)\b/i;

const PROHIBITED_CATEGORIES: Array<{ key: string; pattern: RegExp }> = [
  {
    key: 'security_deposit',
    pattern:
      /\b(?:security\s+)?deposit\b|\bapplicable\s+deposits?\b|\bfirst\s+(?:and\s+last\s+)?month(?:'s|s)?\s+rent\s+due\b|\blast\s+month(?:'s|s)?\s+rent\s+due\b|\bdeposit\s+free\b/i,
  },
  {
    key: 'lease_terms',
    pattern:
      /\b(?:minimum\s+)?lease\s+(?:term|terms|duration|length|details|commencement)\b|\b\d+[- ]?(?:year|month)s?\s+lease\b|\bto\s+a\s+year\s+lease\b|\b\d+\s+year\s+rental\s+terms?\b|\bshorter\s+terms?\b|\blease\s+(?:is\s+for|signed)\b|\bsigning\s+of\s+lease\b|\bmonth[- ]to[- ]month\s+after\b|\bas\s+specified\s+in\s+the\s+lease\b/i,
  },
  {
    key: 'availability_dates',
    pattern:
      /\bavailable\s+(?:now|immediately|today|asap|on|from|starting|date|for\s+rent|january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{1,2}(?:st|nd|rd|th))?\b|\bmove[- ]?in\s+(?:ready|date|special|fee|policy)\b|\bready\s+for\s+move[- ]?in\b|\bcheck\s+availability\b|\bmove\s+in\s+by\b/i,
  },
  {
    key: 'smoking_policy',
    pattern:
      /\bsmok(?:e|ing)(?:-free|\s+policy|\s+allowed|\s+not\s+allowed|\s+is\s+(?:prohibited|not\s+allowed))?\b|\bno\s+smoking\b|\bnon[- ]?smoker\b/i,
  },
  {
    key: 'pet_policy',
    pattern:
      /\bpet[- ]friendly\b|\bpets?\s+(?:are\s+|is\s+)?(?:welcome|allowed|not\s+allowed|case\s+by\s+case|negotiable|subject\s+to\s+approval|considered|on\s+approval)\b|\bno\s+pets\b|\bpet\s+(?:fee|rent|deposit|policy|charge|screening|move-in)\b|\bpetscreening\b|\bper\s+(?:approved\s+)?pet\b/i,
  },
  {
    key: 'showing_and_contact_cta',
    pattern:
      /\b(?:schedule|book|request|arrange|scheduling)\s+(?:a\s+|your\s+)?(?:private\s+|in[- ]person\s+)?(?:property\s+)?(?:tour|showing|viewing|walkthrough)\b|\b(?:in[- ]person|private)\s+(?:property\s+)?showings?\b|\btours?\s*(?::|\s+(?:are\s+)?(?:available|scheduled))\b|\bopen\s+house\b|\b(?:call|text|contact|reach\s+out\s+to|message)\s+(?:us|me|the\s+(?:agent|owner|landlord|manager|property\s+manager)|landlord|for\s+details|[A-Z][a-z]+)\b|\blisted\s+by\b|\bcourtesy\s+of\b|\bMLS\s*#?\s*\d+\b|\blicense\s*#\s*[A-Z0-9]+\b|\bproperty\s+manager\b|\bplease\s+(?:call|text|feel\s+free\s+to\s+reach\s+out)\b/i,
  },
  {
    key: 'management_and_office_hours',
    pattern:
      /\bprofessionally\s+managed\s+by\b|\bmanaged\s+exclusively\s+by\b|\bmanagement\s+company\b|\boffice\s+hours\b|\bkey\s+check\s*out\b|\bcheck\s+out\s+a\s+key\b|\bmon(?:day)?\s*[-–]\s*fri(?:day)?\b|\b\d{1,2}:\d{2}\s*(?:am|pm)\s*[-–]\s*\d{1,2}:\d{2}\s*(?:am|pm)\b|\bequal\s+housing\s+opportunity\b/i,
  },
  {
    key: 'illustrative_photos_disclaimer',
    pattern:
      /\b(?:all\s+)?photos?\s+(?:shown\s+)?are\s+for\s+illustrative\s+purposes\b|\brepresentative\s+photos?\b|\bphotos?\s+may\s+not\s+(?:reflect|represent)\s+(?:the\s+)?actual\s+unit\b/i,
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
    key: 'prohibited_fee_or_sale',
    pattern:
      /\b(?:free|no|zero|waived|complimentary)\s+(?:application\s+)?fee\b|\bapplication\s+fee\s*(?:is\s*|:\s*)?(?:waived|\$?\d+|free)\b|\b(?:app|adm(?:in|inistration)|processing)\s+fee\b|\b(?:for\s+sale|mortgage|down\s+payment|closing\s+costs?|make\s+an\s+offer)\b|\bresidents?\s+benefits?\s+package\b|\bbuilding\s+protection\s+plan\b|\brenter(?:'s|s)?\s+insurance\s+required\b|\b(?:monthly\s+)?rent\s*:\s*\$[\d,]+\b/i,
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
  /** @deprecated External Gemini calls have been removed from the platform. Kept for signature compatibility only. */
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

  // Strip Choice's own footer if already appended so we re-apply cleanly once at the end
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

export function detectSourceContradictions(
  sanitizedText: string,
  prop: Record<string, unknown>,
): string[] {
  const issues: string[] = [];
  if (!sanitizedText) return issues;
  const lower = sanitizedText.toLowerCase();

  const structuredBeds = Number(prop.bedrooms);
  if (Number.isFinite(structuredBeds) && structuredBeds > 0) {
    const bedMatches = [...lower.matchAll(/\b([1-9])\s*[- ]?(?:bed(?:room)?s?|br)\b/gi)];
    if (bedMatches.length > 0) {
      const mentionedBeds = bedMatches.map((m) => Number(m[1]));
      const hasMatch = mentionedBeds.includes(structuredBeds);
      if (!hasMatch && mentionedBeds.every((n) => n !== structuredBeds)) {
        issues.push(
          `Source text states ${mentionedBeds[0]} bedroom(s) while structured record has ${structuredBeds}`,
        );
      }
    }
  }

  const structuredBaths = Number(prop.bathrooms);
  if (Number.isFinite(structuredBaths) && structuredBaths > 0) {
    const bathMatches = [...lower.matchAll(/\b([1-9](?:\.[05])?)\s*[- ]?(?:bath(?:room)?s?|ba)\b/gi)];
    if (bathMatches.length > 0) {
      const mentionedBaths = bathMatches.map((m) => Number(m[1]));
      const hasMatch = mentionedBaths.some((n) => Math.abs(n - structuredBaths) < 0.01);
      if (!hasMatch) {
        issues.push(
          `Source text states ${mentionedBaths[0]} bath(s) while structured record has ${structuredBaths}`,
        );
      }
    }
  }

  return issues;
}

export function lintChoiceDescription(
  candidateBody: string,
  sanitizedBaseline: string,
  maxVariancePct: number,
  opts: { allowVerifiedSpecNumbers?: boolean } = {},
): { ok: boolean; reason: string | null; variancePct: number } {
  const body = candidateBody.trim();
  if (!body || body.length < 20) {
    return { ok: false, reason: 'output_too_short', variancePct: 100 };
  }

  for (const cat of PROHIBITED_CATEGORIES) {
    if (cat.pattern.test(body)) {
      return { ok: false, reason: `prohibited_content_leaked:${cat.key}`, variancePct: 0 };
    }
  }

  // Ensure no non-$50 application fee leaked
  if (/\$(?!50\b)\d+\s*(?:application|app)\s*fee/i.test(body)) {
    return { ok: false, reason: 'prohibited_fee_amount_leaked', variancePct: 0 };
  }

  // Prevent invented numeric specs (unless explicitly authorized for manual side-by-side rewrites)
  if (!opts.allowVerifiedSpecNumbers) {
    const baseNums = new Set((sanitizedBaseline.match(/\b\d+(?:\.\d+)?\b/g) || []).map(String));
    const outNums = (body.match(/\b\d+(?:\.\d+)?\b/g) || []).map(String);
    for (const n of outNums) {
      if (!baseNums.has(n)) {
        return { ok: false, reason: `invented_numeric_fact:${n}`, variancePct: 0 };
      }
    }
  }

  const baseLen = Math.max(sanitizedBaseline.length, 1);
  const variancePct = Math.round((Math.abs(body.length - baseLen) / baseLen) * 100);
  // For very short source descriptions (< 120 chars), allow a 35-char tolerance floor
  const withinShortFloor = baseLen < 120 && Math.abs(body.length - baseLen) <= 35;
  if (!withinShortFloor && variancePct > maxVariancePct) {
    return {
      ok: false,
      reason: `length_variance_exceeded:${variancePct}%>${maxVariancePct}%`,
      variancePct,
    };
  }

  return { ok: true, reason: null, variancePct };
}

function deterministicBaselinePolish(sanitizedBaseline: string): string {
  // Preserves source facts, order, and tone while polishing minor punctuation/spacing artifacts
  let polished = sanitizedBaseline
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*,+/g, ',')
    .replace(/\s*\.\s*\.+/g, '.')
    .replace(/([.!?])\s+([a-z])/g, (_m, punc, ch) => `${punc} ${ch.toUpperCase()}`)
    .trim();

  if (polished && /^[a-z]/.test(polished)) {
    polished = polished.charAt(0).toUpperCase() + polished.slice(1);
  }
  if (polished && !/[.!?]$/.test(polished)) {
    polished += '.';
  }
  return polished;
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
      : policyCfg.mode ?? rulesMap.description_mode ?? 'baseline_rewrite',
  ).trim();
  const mode: DescriptionMode =
    rawMode === 'manual_rewrite'
      ? 'manual_rewrite'
      : rawMode === 'sanitize_only'
      ? 'sanitize_only'
      : 'baseline_rewrite';

  const rawVariance = Number(
    policyCfg.maxLengthVariancePct ?? rulesMap.max_description_length_variance_pct ?? 25,
  );
  const maxVariancePct = Number.isFinite(rawVariance) && rawVariance >= 5 && rawVariance <= 100
    ? rawVariance
    : 25;

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

  // Manual side-by-side rewrite submitted by the assisting AI (replaces/upgrades thin or messy source copy)
  if (mode === 'manual_rewrite' && manualInputRaw) {
    const cleanedManual = manualInputRaw
      .replace(/Application\s+Fee:\s*\$50[\s\S]*$/i, '')
      .trim();

    const manualContradictions = detectSourceContradictions(cleanedManual, prop);
    if (manualContradictions.length > 0) {
      return {
        status: 'needs_review',
        needs_review: true,
        review_reason: 'enrichment_contradictory_manual_rewrite',
        original_description: rawOriginal,
        sanitized_baseline: sanitized,
        ai_description_draft: cleanedManual,
        approved_description: null,
        mode: 'manual_rewrite',
        enrichment_method: 'manual_ai_rewrite',
        manual_enrichment_required: true,
        model: 'manual-ai-rewrite',
        original_hash: originalHash,
        cleaned_hash: await sha256Hex(cleanedManual),
        confidence: 0.3,
        reasons: ['enrichment_contradictory_manual_rewrite', ...manualContradictions],
        changes: {
          stripped_categories: strippedCategories,
          removed_segment_count: removedSegmentCount,
          original_length: rawOriginal.length,
          sanitized_length: sanitized.length,
          final_length: 0,
          variance_pct: 0,
          max_variance_pct: 300,
          ai_used: false,
          ai_rejected_reason: manualContradictions[0],
        },
        ruleset_version: rulesetVersion,
        latency_ms: Date.now() - startedAt,
      };
    }

    const manualCheck = lintChoiceDescription(
      cleanedManual,
      sanitized || cleanedManual,
      300,
      { allowVerifiedSpecNumbers: true },
    );
    if (!manualCheck.ok) {
      return {
        status: 'needs_review',
        needs_review: true,
        review_reason: manualCheck.reason || 'manual_rewrite_failed_lint',
        original_description: rawOriginal,
        sanitized_baseline: sanitized,
        ai_description_draft: cleanedManual,
        approved_description: null,
        mode: 'manual_rewrite',
        enrichment_method: 'manual_ai_rewrite',
        manual_enrichment_required: true,
        model: 'manual-ai-rewrite',
        original_hash: originalHash,
        cleaned_hash: await sha256Hex(cleanedManual),
        confidence: 0.4,
        reasons: [manualCheck.reason || 'manual_rewrite_failed_lint'],
        changes: {
          stripped_categories: strippedCategories,
          removed_segment_count: removedSegmentCount,
          original_length: rawOriginal.length,
          sanitized_length: sanitized.length,
          final_length: 0,
          variance_pct: manualCheck.variancePct,
          max_variance_pct: 300,
          ai_used: false,
          ai_rejected_reason: manualCheck.reason,
        },
        ruleset_version: rulesetVersion,
        latency_ms: Date.now() - startedAt,
      };
    }

    const bodyNormalized = /[.!?]$/.test(cleanedManual) ? cleanedManual : `${cleanedManual}.`;
    const finalApproved = `${bodyNormalized}\n\n${STANDARD_APPLICATION_FEE_FOOTER}`;
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
      model: 'manual-ai-rewrite',
      original_hash: originalHash,
      cleaned_hash: await sha256Hex(finalApproved),
      confidence: 0.99,
      reasons: ['manual_side_by_side_rewrite_approved'],
      changes: {
        stripped_categories: strippedCategories,
        removed_segment_count: removedSegmentCount,
        original_length: rawOriginal.length,
        sanitized_length: sanitized.length,
        final_length: finalApproved.length,
        variance_pct: manualCheck.variancePct,
        max_variance_pct: 300,
        ai_used: false,
        ai_rejected_reason: null,
      },
      ruleset_version: rulesetVersion,
      latency_ms: Date.now() - startedAt,
    };
  }

  // Check for incomplete source description when no manual rewrite was provided
  const wordCount = sanitized ? sanitized.split(/\s+/).filter(Boolean).length : 0;
  if (!rawOriginal || !sanitized || sanitized.length < 25 || wordCount < 5) {
    const latencyMs = Date.now() - startedAt;
    return {
      status: 'needs_review',
      needs_review: true,
      review_reason: 'enrichment_incomplete_source',
      original_description: rawOriginal,
      sanitized_baseline: sanitized,
      ai_description_draft: null,
      approved_description: null,
      mode,
      enrichment_method: 'deterministic_sanitize_only_needs_manual_rewrite',
      manual_enrichment_required: true,
      model: 'deterministic-baseline',
      original_hash: originalHash,
      cleaned_hash: await sha256Hex(sanitized),
      confidence: 0,
      reasons: ['enrichment_incomplete_source'],
      changes: {
        stripped_categories: strippedCategories,
        removed_segment_count: removedSegmentCount,
        original_length: rawOriginal.length,
        sanitized_length: sanitized.length,
        final_length: 0,
        variance_pct: 100,
        max_variance_pct: maxVariancePct,
        ai_used: false,
        ai_rejected_reason: null,
      },
      ruleset_version: rulesetVersion,
      latency_ms: latencyMs,
    };
  }

  // Check for contradictory facts between source text & structured specs
  const contradictions = detectSourceContradictions(sanitized, prop);
  if (contradictions.length > 0) {
    const latencyMs = Date.now() - startedAt;
    return {
      status: 'needs_review',
      needs_review: true,
      review_reason: 'enrichment_contradictory_source',
      original_description: rawOriginal,
      sanitized_baseline: sanitized,
      ai_description_draft: sanitized,
      approved_description: null,
      mode,
      enrichment_method: 'deterministic_sanitize_only_needs_manual_rewrite',
      manual_enrichment_required: true,
      model: 'deterministic-baseline',
      original_hash: originalHash,
      cleaned_hash: await sha256Hex(sanitized),
      confidence: 0.3,
      reasons: ['enrichment_contradictory_source', ...contradictions],
      changes: {
        stripped_categories: strippedCategories,
        removed_segment_count: removedSegmentCount,
        original_length: rawOriginal.length,
        sanitized_length: sanitized.length,
        final_length: 0,
        variance_pct: 0,
        max_variance_pct: maxVariancePct,
        ai_used: false,
        ai_rejected_reason: null,
      },
      ruleset_version: rulesetVersion,
      latency_ms: latencyMs,
    };
  }

  // Deterministic sanitize & baseline polish (zero GEMINI_API_KEY / external LLM).
  // Assisting AI MUST complete manual side-by-side rewrite via save_manual_enrichment before publishing.
  let bodyText = mode === 'sanitize_only' ? sanitized : deterministicBaselinePolish(sanitized);
  const modelUsed = mode === 'sanitize_only' ? 'sanitize-only' : 'deterministic-baseline';

  const finalCheck = lintChoiceDescription(bodyText, sanitized, maxVariancePct);
  if (!finalCheck.ok) {
    bodyText = sanitized;
  }

  const finalApproved = `${bodyText}\n\n${STANDARD_APPLICATION_FEE_FOOTER}`;
  const bodyVariancePct = Math.round(
    (Math.abs(bodyText.length - Math.max(sanitized.length, 1)) / Math.max(sanitized.length, 1)) * 100,
  );
  const cleanedHash = await sha256Hex(finalApproved);

  const isSanitizeOnly = mode === 'sanitize_only';

  return {
    status: 'enriched',
    needs_review: false,
    review_reason: null,
    original_description: rawOriginal,
    sanitized_baseline: sanitized,
    ai_description_draft: finalApproved,
    approved_description: finalApproved,
    mode,
    enrichment_method: isSanitizeOnly
      ? 'deterministic_sanitize_only'
      : 'deterministic_sanitize_only_needs_manual_rewrite',
    manual_enrichment_required: !isSanitizeOnly,
    model: modelUsed,
    original_hash: originalHash,
    cleaned_hash: cleanedHash,
    confidence: isSanitizeOnly ? 0.98 : 0.92,
    reasons: strippedCategories.length ? strippedCategories : ['clean_baseline_preserved'],
    changes: {
      stripped_categories: strippedCategories,
      removed_segment_count: removedSegmentCount,
      original_length: rawOriginal.length,
      sanitized_length: sanitized.length,
      final_length: finalApproved.length,
      variance_pct: bodyVariancePct,
      max_variance_pct: maxVariancePct,
      ai_used: false,
      ai_rejected_reason: null,
    },
    ruleset_version: rulesetVersion,
    latency_ms: Date.now() - startedAt,
  };
}

