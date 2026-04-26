/**
 * lease-resolve -- Phase 10 (chunks 2/5 + 3/5)
 *
 * Single source of truth for "given a request, find the lease row".
 * Edge functions in Phase 10 accept EITHER:
 *
 *   * lease_id  (UUID)   -- preferred, points at public.leases.id directly,
 *                           and is the only way to address one specific
 *                           lease in a multi-lease application history
 *                           (renewals, replacement leases).
 *   * app_id    (TEXT)   -- legacy/back-compat. Resolves to the
 *                           application's CURRENT lease via
 *                           applications.current_lease_id, or to the
 *                           most-recent leases row by created_at as a
 *                           fallback for mid-migration callers.
 *
 * Either path returns the same {lease, app} pair so the rest of the
 * edge-function body can stay identical.
 *
 * Returned shape:
 *   { ok: true,  lease, app }                 -- found
 *   { ok: false, status, error }              -- 400/404 to surface to caller
 *
 * NOTE: this module never throws -- all errors are returned in-band so the
 * edge function can map them to HTTP status codes consistently.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface LeaseRow {
  id:                          string;
  application_id:              string | null;
  app_id:                      string | null;
  parent_lease_id:             string | null;
  listing_id:                  string | null;
  landlord_id:                 string | null;
  property_address:            string | null;
  lease_state_code:            string | null;
  lease_start_date:            string | null;
  lease_end_date:              string | null;
  monthly_rent:                number | null;
  security_deposit:            number | null;
  move_in_costs:               number | null;
  first_month_rent:            number | null;
  last_month_rent:             number | null;
  pet_deposit:                 number | null;
  pet_rent:                    number | null;
  admin_fee:                   number | null;
  key_deposit:                 number | null;
  parking_fee:                 number | null;
  cleaning_fee:                number | null;
  cleaning_fee_refundable:     boolean | null;
  rent_due_day_of_month:       number | null;
  rent_proration_method:       string | null;
  prorated_first_month:        number | null;
  utility_responsibilities:    Record<string, unknown> | null;
  lease_landlord_name:         string | null;
  lease_landlord_address:      string | null;
  lease_late_fee_flat:         number | null;
  lease_late_fee_daily:        number | null;
  lease_pets_policy:           string | null;
  lease_smoking_policy:        string | null;
  lease_compliance_snapshot:   string | null;
  lease_notes:                 string | null;
  lease_template_version_id:   string | null;
  lease_pdf_url:               string | null;
  tenant_signature:            string | null;
  tenant_signature_image:      string | null;
  signature_timestamp:         string | null;
  lease_ip_address:            string | null;
  co_applicant_signature:      string | null;
  co_applicant_signature_image: string | null;
  co_applicant_signature_timestamp: string | null;
  management_signed:           boolean | null;
  management_signer_name:      string | null;
  management_signed_at:        string | null;
  management_notes:            string | null;
  management_cosigned:         boolean | null;
  management_cosigned_by:      string | null;
  management_cosigned_at:      string | null;
  lease_status:                string;
  lease_sent_date:             string | null;
  lease_signed_date:           string | null;
  executed_at:                 string | null;
  terminated_at:               string | null;
  termination_reason:          string | null;
  renewed_at:                  string | null;
  cancelled_at:                string | null;
  cancellation_reason:         string | null;
  lease_expiry_date:           string | null;
  created_at:                  string;
  updated_at:                  string;
  created_by:                  string | null;
}

export interface ResolveOk  { ok: true;  lease: LeaseRow; app: Record<string, any>; }
export interface ResolveErr { ok: false; status: 400 | 404 | 500; error: string; }
export type ResolveResult = ResolveOk | ResolveErr;

export interface ResolveParams {
  lease_id?: string | null;
  app_id?:   string | null;
}

/**
 * Resolve a lease row + its parent application from either lease_id or
 * app_id. lease_id wins when both are supplied (more specific).
 */
export async function resolveLease(
  supabase: SupabaseClient,
  params: ResolveParams,
): Promise<ResolveResult> {
  const lease_id = params.lease_id?.trim() || null;
  const app_id   = params.app_id?.trim()   || null;

  if (!lease_id && !app_id) {
    return { ok: false, status: 400, error: 'Missing lease_id or app_id' };
  }

  let lease: LeaseRow | null = null;

  if (lease_id) {
    const { data, error } = await supabase
      .from('leases').select('*').eq('id', lease_id).maybeSingle();
    if (error) return { ok: false, status: 500, error: 'Lease lookup failed: ' + error.message };
    if (!data) return { ok: false, status: 404, error: 'Lease not found for the supplied lease_id' };
    lease = data as LeaseRow;
  } else if (app_id) {
    // Prefer the app's current_lease_id pointer; fall back to the most
    // recent lease row by created_at for older callers / pre-Phase-10
    // applications that had a lease backfilled but no pointer set.
    const { data: appCur, error: appCurErr } = await supabase
      .from('applications')
      .select('current_lease_id')
      .eq('app_id', app_id)
      .maybeSingle();
    if (appCurErr) return { ok: false, status: 500, error: 'Application lookup failed: ' + appCurErr.message };

    if (appCur?.current_lease_id) {
      const { data, error } = await supabase
        .from('leases').select('*').eq('id', appCur.current_lease_id).maybeSingle();
      if (error) return { ok: false, status: 500, error: 'Lease lookup failed: ' + error.message };
      lease = (data as LeaseRow) || null;
    }
    if (!lease) {
      const { data, error } = await supabase
        .from('leases').select('*').eq('app_id', app_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) return { ok: false, status: 500, error: 'Lease lookup failed: ' + error.message };
      lease = (data as LeaseRow) || null;
    }
    if (!lease) return { ok: false, status: 404, error: 'No lease has been generated for this application yet.' };
  }

  if (!lease) return { ok: false, status: 404, error: 'Lease not found' };

  // Pull the parent application -- prefer FK join, fall back to app_id text
  let app: Record<string, any> | null = null;
  if (lease.application_id) {
    const { data } = await supabase
      .from('applications').select('*').eq('id', lease.application_id).maybeSingle();
    app = (data as Record<string, any>) || null;
  }
  if (!app && lease.app_id) {
    const { data } = await supabase
      .from('applications').select('*').eq('app_id', lease.app_id).maybeSingle();
    app = (data as Record<string, any>) || null;
  }
  if (!app) {
    return { ok: false, status: 404, error: 'Parent application not found for this lease' };
  }

  return { ok: true, lease, app };
}

/**
 * Helper: fetch *all* leases for an app, newest first. Used by the admin
 * lease-history view in chunk 4.
 */
export async function listLeasesForApp(
  supabase: SupabaseClient,
  app_id: string,
): Promise<LeaseRow[]> {
  const { data } = await supabase
    .from('leases').select('*').eq('app_id', app_id)
    .order('created_at', { ascending: false });
  return (data as LeaseRow[]) || [];
}
