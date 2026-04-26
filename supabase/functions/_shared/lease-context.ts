// Choice Properties — Shared: lease-context.ts
//
// Phase 01 — extract the variable-derivation logic that used to live
// hard-coded inside substituteVars() in pdf.ts. Keeping it here means
// every renderer (PDF, plain-text email, future UI preview) feeds the
// templating engine the same context shape.
//
// The keys exposed here are the union of every variable any current
// template body references, so the new engine renders the existing
// seeded MI template byte-for-byte identically to the pre-Phase-01
// regex substitution. New variables (state-law fields, addenda flags,
// utility matrices, etc.) get added in later phases.

import type { RenderContext } from './template-engine.ts';
import {
  normalizeUtilityMatrix,
  renderUtilityMatrixHtml,
  renderUtilityMatrixText,
  getUtilityResponsibilitySummary,
} from './utility-matrix.ts';
import { computeFirstMonthProration, type ProrationMethod } from './proration.ts';

function fmtMoney(v: unknown): string {
  if (v == null || v === '') return '';
  const n = typeof v === 'number' ? v : Number(v);
  if (!isFinite(n)) return '';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function fmtDate(d: unknown): string {
  if (!d) return '';
  try { return new Date(String(d)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return String(d); }
}

/**
 * Build a clean HTML breakdown table of itemized financial components for
 * inclusion in the lease body. Falls back to a single-row legacy view when
 * no itemized fields are populated (preserves backward compat with leases
 * generated before Phase 07).
 */
function buildMoveInBreakdownHtml(app: Record<string, unknown>): string {
  type Row = { label: string; amount: number; note?: string };
  const rows: Row[] = [];
  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && n !== 0 ? n : null;
  };

  const prorated = num(app.prorated_first_month);
  const firstMo  = num(app.first_month_rent);
  const monthly  = num(app.monthly_rent);
  if (prorated != null) {
    rows.push({ label: 'First Month (Prorated)', amount: prorated });
  } else if (firstMo != null) {
    rows.push({ label: 'First Month Rent', amount: firstMo });
  } else if (monthly != null) {
    rows.push({ label: 'First Month Rent', amount: monthly });
  }

  const lastMo = num(app.last_month_rent);
  if (lastMo != null) rows.push({ label: 'Last Month Rent', amount: lastMo });

  const sec = num(app.security_deposit);
  if (sec != null) rows.push({ label: 'Security Deposit (refundable)', amount: sec });

  const petDep = num(app.pet_deposit);
  if (petDep != null) rows.push({ label: 'Pet Deposit', amount: petDep });

  const adminFee = num(app.admin_fee);
  if (adminFee != null) rows.push({ label: 'Administrative Fee', amount: adminFee });

  const keyDep = num(app.key_deposit);
  if (keyDep != null) rows.push({ label: 'Key Deposit', amount: keyDep });

  const parking = num(app.parking_fee);
  if (parking != null) rows.push({ label: 'Parking Fee (first month)', amount: parking });

  const cleaning = num(app.cleaning_fee);
  if (cleaning != null) {
    const refundable = app.cleaning_fee_refundable === true
      ? 'refundable'
      : (app.cleaning_fee_refundable === false ? 'non-refundable' : '');
    rows.push({ label: refundable ? `Cleaning Fee (${refundable})` : 'Cleaning Fee', amount: cleaning });
  }

  // Legacy fallback — no itemized components at all.
  if (rows.length === 0) {
    const legacy = num(app.move_in_costs);
    if (legacy != null) {
      rows.push({ label: 'Total Due at Move-In', amount: legacy });
    } else {
      return '';
    }
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = rows.map(r =>
    `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${escape(r.label)}</td>` +
    `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${fmtMoney(r.amount)}</td></tr>`
  ).join('');
  return (
    `<table style="border-collapse:collapse;width:100%;font-size:12px;margin:6px 0 10px;">` +
      `<tbody>${body}` +
        `<tr><td style="padding:6px 8px;font-weight:bold;border-top:2px solid #333;">Total Due at Move-In</td>` +
        `<td style="padding:6px 8px;font-weight:bold;border-top:2px solid #333;text-align:right;">${fmtMoney(total)}</td></tr>` +
      `</tbody>` +
    `</table>`
  );
}

function computeMoveInTotal(app: Record<string, unknown>): number | null {
  const num = (v: unknown): number => {
    if (v == null || v === '') return 0;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const firstCharge = num(app.prorated_first_month) || num(app.first_month_rent) || num(app.monthly_rent);
  const itemized =
    firstCharge +
    num(app.last_month_rent) +
    num(app.security_deposit) +
    num(app.pet_deposit) +
    num(app.admin_fee) +
    num(app.key_deposit) +
    num(app.parking_fee) +
    num(app.cleaning_fee);
  if (itemized > 0) return Math.round(itemized * 100) / 100;
  const legacy = Number(app.move_in_costs);
  return Number.isFinite(legacy) && legacy > 0 ? legacy : null;
}

/**
 * Build the rendering context for a lease body or amendment body.
 *
 * Every key here matches what substituteVars() exposed before Phase 01,
 * so legacy templates that use bare {{tenant_full_name}} continue to
 * render without modification. New templates (Phase 03+) may also
 * reference nested context like {{ state.code }} once Phase 02 lands.
 */
export function buildLeaseRenderContext(app: Record<string, unknown>): RenderContext {
  // Phase 07 — pre-compute itemized money breakdown + utility matrix renderings
  // so templates can reference them with simple {{ var }} substitution.
  const moveInTotal       = computeMoveInTotal(app);
  const moveInBreakdownHtml = buildMoveInBreakdownHtml(app);

  const utilities         = normalizeUtilityMatrix(app.utility_responsibilities);
  const utilityTableHtml  = renderUtilityMatrixHtml(utilities);
  const utilityTableText  = renderUtilityMatrixText(utilities);
  const utilitySummary    = getUtilityResponsibilitySummary(utilities);

  // Best-effort proration recomputation for the rendered explanation. This
  // never overrides the stored prorated_first_month value — it just gives
  // templates a human-readable sentence even if the field wasn't pre-set.
  let prorationExplanation = '';
  const monthly = Number(app.monthly_rent) || 0;
  const startDate = app.lease_start_date as string | undefined;
  if (monthly > 0 && startDate) {
    try {
      const r = computeFirstMonthProration({
        moveInDate:  String(startDate).slice(0, 10),
        monthlyRent: monthly,
        dueDay:      Number(app.rent_due_day_of_month) || 1,
        method:      ((app.rent_proration_method as ProrationMethod) || 'daily'),
      });
      if (r.prorationDays > 0 && r.prorationDays !== r.divisorDays) {
        prorationExplanation = r.explanation;
      }
    } catch (_) { /* leave blank */ }
  }

  return {
    tenant_full_name:    `${app.first_name || ''} ${app.last_name || ''}`.trim(),
    tenant_email:        String(app.email || ''),
    tenant_phone:        String(app.phone || ''),
    property_address:    String(app.property_address || ''),
    lease_start_date:    fmtDate(app.lease_start_date),
    lease_end_date:      fmtDate(app.lease_end_date),
    monthly_rent:        fmtMoney(app.monthly_rent),
    security_deposit:    fmtMoney(app.security_deposit),
    move_in_costs:       moveInTotal != null ? fmtMoney(moveInTotal) : fmtMoney(app.move_in_costs),
    landlord_name:       String(app.lease_landlord_name    || 'Choice Properties'),
    landlord_address:    String(app.lease_landlord_address || '2265 Livernois Suite 500, Troy MI 48083'),
    late_fee_flat:       app.lease_late_fee_flat  ? fmtMoney(app.lease_late_fee_flat)  : '',
    late_fee_daily:      app.lease_late_fee_daily ? fmtMoney(app.lease_late_fee_daily) : '',
    state_code:          String(app.lease_state_code    || 'MI'),
    pets_policy:         String(app.lease_pets_policy   || 'No pets allowed.'),
    smoking_policy:      String(app.lease_smoking_policy || 'No smoking permitted on premises.'),
    desired_lease_term:  String(app.desired_lease_term  || ''),
    app_id:              String(app.app_id || app.id || ''),
    signature_date:      app.signature_timestamp ? fmtDate(app.signature_timestamp) : '',
    tenant_signature:    String(app.tenant_signature || ''),
    co_applicant_signature: String(app.co_applicant_signature || ''),

    // ---------- Phase 07 — itemized financials ----------
    first_month_rent:        app.first_month_rent  != null ? fmtMoney(app.first_month_rent)  : '',
    last_month_rent:         app.last_month_rent   != null ? fmtMoney(app.last_month_rent)   : '',
    pet_deposit:             app.pet_deposit       != null ? fmtMoney(app.pet_deposit)       : '',
    pet_rent:                app.pet_rent          != null ? fmtMoney(app.pet_rent)          : '',
    admin_fee:               app.admin_fee         != null ? fmtMoney(app.admin_fee)         : '',
    key_deposit:             app.key_deposit       != null ? fmtMoney(app.key_deposit)       : '',
    parking_fee:             app.parking_fee       != null ? fmtMoney(app.parking_fee)       : '',
    cleaning_fee:            app.cleaning_fee      != null ? fmtMoney(app.cleaning_fee)      : '',
    cleaning_fee_refundable: app.cleaning_fee_refundable === true
                               ? 'refundable'
                               : (app.cleaning_fee_refundable === false ? 'non-refundable' : ''),
    prorated_first_month:    app.prorated_first_month != null ? fmtMoney(app.prorated_first_month) : '',
    rent_due_day_of_month:   String(app.rent_due_day_of_month || 1),
    rent_proration_method:   String(app.rent_proration_method || 'daily'),
    proration_explanation:   prorationExplanation,
    move_in_breakdown_html:  moveInBreakdownHtml,
    move_in_total:           moveInTotal != null ? fmtMoney(moveInTotal) : '',

    // ---------- Phase 07 — utility responsibility matrix ----------
    utility_table_html:      utilityTableHtml,
    utility_table_text:      utilityTableText,
    utility_summary:         utilitySummary,
    utilities:               utilities, // accessible as {{ utilities.electric.responsibility }} etc.

    // Convenience: also expose the raw application object as `app` so
    // future templates can reach for fields not pre-mapped here, e.g.
    //   {% if app.has_pets %} ... {% endif %}
    app,
  };
}
