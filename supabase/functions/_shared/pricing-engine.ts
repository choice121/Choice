// ============================================================================
// Choice Properties — Phase 7 Shared Task-Specific Pricing Engine
// ============================================================================
// Supports 4 task-specific pricing methods:
//   - none               : Keep original_monthly_rent unchanged
//   - fixed              : Set all eligible properties to fixed_rent
//   - individual_map     : Per-property explicit rent mapping
//   - proportional_range :
//       ROUND(TargetMin + ((OriginalRent - SourceMin) / (SourceMax - SourceMin)) * (TargetMax - TargetMin))
//
// Invariants enforced:
//   - Preserves original_monthly_rent untouched
//   - Idempotent across repeat runs (prevents double adjustment)
//   - Validates SourceMax > SourceMin (stops job cleanly if equal/invalid)
//   - Holds out-of-range OriginalRent in needs_review (pricing_out_of_source_range)
//   - Clamps calculated rent strictly within [TargetMin, TargetMax]
// ============================================================================

export type PricingMethod = 'none' | 'fixed' | 'individual_map' | 'proportional_range';
export type PricingPropertyStatus = 'calculated' | 'held_out_of_range' | 'error';

export interface PricingTaskConfig {
  method: PricingMethod;
  fixed_rent?: number | null;
  source_min?: number | null;
  source_max?: number | null;
  target_min?: number | null;
  target_max?: number | null;
  individual_map?: Record<string, number> | null;
}

export interface PricingConfigValidation {
  ok: boolean;
  error?: string;
  message?: string;
  normalized: PricingTaskConfig;
}

export interface PricingComputationResult {
  id: string;
  method: PricingMethod;
  pricing_status: PricingPropertyStatus;
  audit_status: 'calculated' | 'held_out_of_range' | 'skipped_idempotent' | 'error';
  original_rent: number | null;
  calculated_rent: number | null;
  was_clamped: boolean;
  reason: string | null;
  idempotent_skip: boolean;
  config_hash: string;
}

function toFiniteNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function normalizeAndValidatePricingConfig(
  rawConfig: Record<string, unknown> | null | undefined,
): PricingConfigValidation {
  const cfg = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const rawMethod = String(cfg.method || cfg.pricing_method || 'none').trim().toLowerCase();

  if (!['none', 'fixed', 'individual_map', 'proportional_range'].includes(rawMethod)) {
    return {
      ok: false,
      error: 'invalid_pricing_method',
      message: `Unsupported pricing method "${rawMethod}". Expected none, fixed, individual_map, or proportional_range.`,
      normalized: { method: 'none' },
    };
  }

  const method = rawMethod as PricingMethod;

  if (method === 'none') {
    return { ok: true, normalized: { method: 'none' } };
  }

  if (method === 'fixed') {
    const fixedRent = toFiniteNumber(cfg.fixed_rent ?? cfg.target_rent ?? cfg.rent);
    if (fixedRent === null || fixedRent <= 0) {
      return {
        ok: false,
        error: 'invalid_fixed_rent',
        message: 'fixed pricing requires a positive fixed_rent value.',
        normalized: { method: 'fixed', fixed_rent: fixedRent },
      };
    }
    return {
      ok: true,
      normalized: { method: 'fixed', fixed_rent: Math.round(fixedRent) },
    };
  }

  if (method === 'individual_map') {
    const rawMap = (cfg.individual_map || cfg.price_map || cfg.map) as Record<string, unknown> | undefined;
    if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) {
      return {
        ok: false,
        error: 'invalid_individual_map',
        message: 'individual_map pricing requires an object mapping property IDs / listing IDs to target rents.',
        normalized: { method: 'individual_map', individual_map: {} },
      };
    }
    const cleanMap: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawMap)) {
      const n = toFiniteNumber(v);
      if (k.trim() && n !== null && n > 0) {
        cleanMap[k.trim()] = Math.round(n);
      }
    }
    return {
      ok: true,
      normalized: { method: 'individual_map', individual_map: cleanMap },
    };
  }

  // proportional_range
  const sourceMin = toFiniteNumber(cfg.source_min ?? cfg.original_min);
  const sourceMax = toFiniteNumber(cfg.source_max ?? cfg.original_max);
  const targetMin = toFiniteNumber(cfg.target_min);
  const targetMax = toFiniteNumber(cfg.target_max);

  if (sourceMin === null || sourceMax === null || sourceMin <= 0 || sourceMax <= 0) {
    return {
      ok: false,
      error: 'invalid_source_range_clarification_required',
      message: 'Proportional range pricing requires positive source_min and source_max values.',
      normalized: { method: 'proportional_range', source_min: sourceMin, source_max: sourceMax, target_min: targetMin, target_max: targetMax },
    };
  }

  if (sourceMax <= sourceMin) {
    return {
      ok: false,
      error: 'invalid_source_range_clarification_required',
      message: `SourceMin (${sourceMin}) and SourceMax (${sourceMax}) must satisfy SourceMax > SourceMin before proportional pricing can proceed.`,
      normalized: { method: 'proportional_range', source_min: sourceMin, source_max: sourceMax, target_min: targetMin, target_max: targetMax },
    };
  }

  if (targetMin === null || targetMax === null || targetMin <= 0 || targetMax <= 0 || targetMax < targetMin) {
    return {
      ok: false,
      error: 'invalid_target_range_clarification_required',
      message: 'Proportional range pricing requires positive target_min and target_max with target_max >= target_min.',
      normalized: { method: 'proportional_range', source_min: sourceMin, source_max: sourceMax, target_min: targetMin, target_max: targetMax },
    };
  }

  return {
    ok: true,
    normalized: {
      method: 'proportional_range',
      source_min: sourceMin,
      source_max: sourceMax,
      target_min: Math.round(targetMin),
      target_max: Math.round(targetMax),
    },
  };
}

export async function computePricingHash(
  config: PricingTaskConfig,
  originalRent: number | null,
  mappedRent: number | null = null,
): Promise<string> {
  const canonical = JSON.stringify({
    method: config.method,
    fixed_rent: config.fixed_rent ?? null,
    source_min: config.source_min ?? null,
    source_max: config.source_max ?? null,
    target_min: config.target_min ?? null,
    target_max: config.target_max ?? null,
    mapped_rent: mappedRent,
    original_rent: originalRent,
  });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function calculatePropertyRent(
  prop: Record<string, unknown>,
  config: PricingTaskConfig,
  options: { force?: boolean } = {},
): Promise<PricingComputationResult> {
  const id = String(prop.id || '');
  // Strictly anchor on original_monthly_rent if already set; never double-adjust from monthly_rent
  const originalRent = toFiniteNumber(prop.original_monthly_rent) ?? toFiniteNumber(prop.monthly_rent);

  if (originalRent === null || originalRent <= 0) {
    const hash = await computePricingHash(config, originalRent);
    return {
      id,
      method: config.method,
      pricing_status: 'error',
      audit_status: 'error',
      original_rent: originalRent,
      calculated_rent: null,
      was_clamped: false,
      reason: 'pricing_missing_original_rent',
      idempotent_skip: false,
      config_hash: hash,
    };
  }

  let mappedRent: number | null = null;
  if (config.method === 'individual_map') {
    const map = config.individual_map || {};
    const candidates = [
      String(prop.id || '').trim(),
      String(prop.source_listing_id || '').trim(),
      String(prop.address || '').trim(),
    ].filter(Boolean);
    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(map, key)) {
        mappedRent = map[key];
        break;
      }
    }
  }

  const configHash = await computePricingHash(config, originalRent, mappedRent);

  let calculatedRent: number | null = null;
  let wasClamped = false;

  if (config.method === 'none') {
    calculatedRent = Math.round(originalRent);
  } else if (config.method === 'fixed') {
    calculatedRent = Math.round(config.fixed_rent!);
  } else if (config.method === 'individual_map') {
    if (mappedRent === null || mappedRent <= 0) {
      return {
        id,
        method: config.method,
        pricing_status: 'held_out_of_range',
        audit_status: 'held_out_of_range',
        original_rent: originalRent,
        calculated_rent: null,
        was_clamped: false,
        reason: 'pricing_missing_individual_map',
        idempotent_skip: false,
        config_hash: configHash,
      };
    }
    calculatedRent = Math.round(mappedRent);
  } else {
    // proportional_range
    const sMin = config.source_min!;
    const sMax = config.source_max!;
    const tMin = config.target_min!;
    const tMax = config.target_max!;

    if (originalRent < sMin || originalRent > sMax) {
      return {
        id,
        method: config.method,
        pricing_status: 'held_out_of_range',
        audit_status: 'held_out_of_range',
        original_rent: originalRent,
        calculated_rent: null,
        was_clamped: false,
        reason: `pricing_out_of_source_range:${originalRent}_outside_${sMin}_${sMax}`,
        idempotent_skip: false,
        config_hash: configHash,
      };
    }

    const ratio = (originalRent - sMin) / (sMax - sMin);
    const rounded = Math.round(tMin + ratio * (tMax - tMin));
    const clamped = Math.min(tMax, Math.max(tMin, rounded));
    wasClamped = clamped !== rounded;
    calculatedRent = clamped;
  }

  const currentRent = toFiniteNumber(prop.monthly_rent);
  const alreadyApplied =
    !options.force &&
    prop.last_priced_hash === configHash &&
    prop.pricing_status === 'calculated' &&
    currentRent === calculatedRent;

  return {
    id,
    method: config.method,
    pricing_status: 'calculated',
    audit_status: alreadyApplied ? 'skipped_idempotent' : 'calculated',
    original_rent: originalRent,
    calculated_rent: calculatedRent,
    was_clamped: wasClamped,
    reason: null,
    idempotent_skip: alreadyApplied,
    config_hash: configHash,
  };
}
