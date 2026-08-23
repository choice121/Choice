// Choice Properties — Shared: state-law.ts
//
// Phase 02 — accessor + validator for the state_lease_law table.
//
// Every later phase (Phase 03 multi-state templates, Phase 04
// disclosures, Phase 09 deposit accounting, Phase 11 tenant UX)
// pulls from this module instead of hardcoding statute values.
//
// Validation is intentionally CONSERVATIVE: we only fail a lease when
// it CLEARLY exceeds a known statutory limit (with the actual limit
// numeric in hand). When a column is NULL ("statute silent" or "unverified
// — flag for attorney review" per the Phase 02 brief), we DO NOT block
// the lease — we surface a 'warning' on validation result so admin UX
// can highlight without rejecting.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface StateLawRow {
  state_code: string;
  state_name: string;

  security_deposit_max_months:        number | null;
  security_deposit_return_days:       number;
  security_deposit_interest_required: boolean;
  security_deposit_separate_account:  boolean;
  security_deposit_bank_disclosure:   boolean;

  late_fee_grace_period_days:    number | null;
  late_fee_cap_pct_of_rent:      number | null;
  late_fee_cap_flat:             number | null;
  late_fee_no_fee_until_days:    number | null;

  entry_notice_hours:            number;
  entry_notice_emergency_exempt: boolean;

  eviction_notice_nonpayment_days:   number;
  eviction_notice_other_breach_days: number;

  holdover_rule: 'double_rent' | 'month_to_month' | 'court_discretion';

  just_cause_required:                 boolean;
  rent_increase_notice_days:           number;
  rent_increase_large_notice_days:     number | null;
  rent_increase_large_threshold_pct:   number | null;

  required_translation_languages: string[];

  statute_security_deposit: string | null;
  statute_late_fees:        string | null;
  statute_entry:            string | null;
  statute_eviction:         string | null;
  statute_holdover:         string | null;

  notes:                string | null;
  source_last_reviewed: string | null;
  reviewed_by:          string | null;
}

/** Lease-side fields the validator inspects. All optional — we skip
 *  any check whose required input is missing. */
export interface LeaseForValidation {
  monthly_rent?:        number | null;
  security_deposit?:    number | null;
  lease_late_fee_flat?: number | null;
  late_fee_pct_of_rent?: number | null;
  late_fee_grace_days?:  number | null;
}

export interface ValidationViolation {
  level:   'error' | 'warning';
  field:   string;
  message: string;
  statute?: string;
}

export interface ValidationResult {
  ok:         boolean;       // false if any 'error'-level violation
  violations: ValidationViolation[];
}

// In-process cache so a single edge-function invocation that calls
// getStateLaw multiple times only does one round-trip.
const _cache = new Map<string, StateLawRow | null>();

/**
 * Fetch the row for a state code (e.g. 'CA', 'mi', 'dc'). Returns
 * `null` if the row doesn't exist. Cached in-process for the
 * lifetime of the module load.
 */
export async function getStateLaw(
  client: SupabaseClient,
  stateCode: string,
): Promise<StateLawRow | null> {
  const code = (stateCode || '').toUpperCase().trim();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  if (_cache.has(code)) return _cache.get(code)!;

  const { data, error } = await client
    .from('state_lease_law')
    .select('*')
    .eq('state_code', code)
    .maybeSingle();

  if (error) {
    console.warn('[state-law] fetch error for', code, ':', error.message);
    _cache.set(code, null);
    return null;
  }
  const row = (data as StateLawRow | null) ?? null;
  _cache.set(code, row);
  return row;
}

/** Test-time helper to clear the cache between calls. */
export function _clearStateLawCache(): void { _cache.clear(); }

/**
 * Run a lease (or proposed lease) against the supplied state law row
 * and return any statutory violations.
 *
 * Returns `ok: true, violations: []` when:
 *   - law is null (state not seeded yet — fail open),
 *   - or the lease passes every check we have data for.
 *
 * Warning vs error:
 *   - error   → lease numerically exceeds a confirmed statutory limit
 *   - warning → law row has the column NULL (statute silent / unverified)
 *               OR the lease is missing a field needed to evaluate
 */
export function validateLeaseAgainstState(
  law:   StateLawRow | null,
  lease: LeaseForValidation,
): ValidationResult {
  const v: ValidationViolation[] = [];
  if (!law) return { ok: true, violations: [] };

  // ── Security deposit cap ──────────────────────────────────────
  if (law.security_deposit_max_months != null) {
    if (lease.monthly_rent == null) {
      v.push({
        level: 'warning',
        field: 'security_deposit',
        message: `Cannot verify deposit cap — monthly_rent missing. ${law.state_code} caps deposit at ${law.security_deposit_max_months} months of rent.`,
        statute: law.statute_security_deposit ?? undefined,
      });
    } else if (lease.security_deposit != null) {
      const cap = law.security_deposit_max_months * lease.monthly_rent;
      if (lease.security_deposit > cap + 0.005) { // tolerance for cent rounding
        v.push({
          level: 'error',
          field: 'security_deposit',
          message: `Deposit $${lease.security_deposit.toFixed(2)} exceeds ${law.state_code} statutory maximum of ${law.security_deposit_max_months}× monthly rent ($${cap.toFixed(2)}).`,
          statute: law.statute_security_deposit ?? undefined,
        });
      }
    }
  } else {
    v.push({
      level: 'warning',
      field: 'security_deposit',
      message: `${law.state_code} has no statutory cap on security deposits — verify lease amount is commercially reasonable.`,
      statute: law.statute_security_deposit ?? undefined,
    });
  }

  // ── Late-fee structure ────────────────────────────────────────
  // Percent cap
  if (law.late_fee_cap_pct_of_rent != null && lease.monthly_rent != null && lease.lease_late_fee_flat != null) {
    const pctMax = (law.late_fee_cap_pct_of_rent / 100) * lease.monthly_rent;
    if (law.late_fee_cap_flat != null) {
      // Some states (NY, NC) define "lesser of pct OR flat"
      const max = Math.min(pctMax, law.late_fee_cap_flat);
      if (lease.lease_late_fee_flat > max + 0.005) {
        v.push({
          level: 'error',
          field: 'late_fee_flat',
          message: `Late fee $${lease.lease_late_fee_flat.toFixed(2)} exceeds ${law.state_code} cap (lesser of ${law.late_fee_cap_pct_of_rent}% of rent = $${pctMax.toFixed(2)} or flat $${law.late_fee_cap_flat.toFixed(2)}, i.e. $${max.toFixed(2)}).`,
          statute: law.statute_late_fees ?? undefined,
        });
      }
    } else if (lease.lease_late_fee_flat > pctMax + 0.005) {
      v.push({
        level: 'error',
        field: 'late_fee_flat',
        message: `Late fee $${lease.lease_late_fee_flat.toFixed(2)} exceeds ${law.state_code} cap of ${law.late_fee_cap_pct_of_rent}% of monthly rent ($${pctMax.toFixed(2)}).`,
        statute: law.statute_late_fees ?? undefined,
      });
    }
  } else if (law.late_fee_cap_flat != null && lease.lease_late_fee_flat != null) {
    if (lease.lease_late_fee_flat > law.late_fee_cap_flat + 0.005) {
      v.push({
        level: 'error',
        field: 'late_fee_flat',
        message: `Late fee $${lease.lease_late_fee_flat.toFixed(2)} exceeds ${law.state_code} statutory flat cap of $${law.late_fee_cap_flat.toFixed(2)}.`,
        statute: law.statute_late_fees ?? undefined,
      });
    }
  }

  // Grace period must meet or exceed the statutory minimum
  if (law.late_fee_grace_period_days != null && lease.late_fee_grace_days != null) {
    if (lease.late_fee_grace_days < law.late_fee_grace_period_days) {
      v.push({
        level: 'error',
        field: 'late_fee_grace_days',
        message: `Grace period of ${lease.late_fee_grace_days} day(s) is below ${law.state_code} statutory minimum of ${law.late_fee_grace_period_days} day(s).`,
        statute: law.statute_late_fees ?? undefined,
      });
    }
  }

  // MA: no late fee until 30 days past due
  if (law.late_fee_no_fee_until_days != null && lease.lease_late_fee_flat != null && lease.lease_late_fee_flat > 0) {
    if (lease.late_fee_grace_days == null || lease.late_fee_grace_days < law.late_fee_no_fee_until_days) {
      v.push({
        level: 'error',
        field: 'late_fee_grace_days',
        message: `${law.state_code} prohibits any late fee until rent is at least ${law.late_fee_no_fee_until_days} days past due.`,
        statute: law.statute_late_fees ?? undefined,
      });
    }
  }

  // ── Translation requirement (CA Civ. §1632) ───────────────────
  if (law.required_translation_languages?.length) {
    v.push({
      level: 'warning',
      field: 'required_translation_languages',
      message: `${law.state_code} requires translation when lease is negotiated in: ${law.required_translation_languages.join(', ')}. Verify the negotiation language and provide translated copy if applicable.`,
    });
  }

  return { ok: !v.some(x => x.level === 'error'), violations: v };
}
