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
 * Build the rendering context for a lease body or amendment body.
 *
 * Every key here matches what substituteVars() exposed before Phase 01,
 * so legacy templates that use bare {{tenant_full_name}} continue to
 * render without modification. New templates (Phase 03+) may also
 * reference nested context like {{ state.code }} once Phase 02 lands.
 */
export function buildLeaseRenderContext(app: Record<string, unknown>): RenderContext {
  return {
    tenant_full_name:    `${app.first_name || ''} ${app.last_name || ''}`.trim(),
    tenant_email:        String(app.email || ''),
    tenant_phone:        String(app.phone || ''),
    property_address:    String(app.property_address || ''),
    lease_start_date:    fmtDate(app.lease_start_date),
    lease_end_date:      fmtDate(app.lease_end_date),
    monthly_rent:        fmtMoney(app.monthly_rent),
    security_deposit:    fmtMoney(app.security_deposit),
    move_in_costs:       fmtMoney(app.move_in_costs),
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

    // Convenience: also expose the raw application object as `app` so
    // future templates can reach for fields not pre-mapped here, e.g.
    //   {% if app.has_pets %} ... {% endif %}
    app,
  };
}
