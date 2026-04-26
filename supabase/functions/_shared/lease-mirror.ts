/**
 * lease-mirror -- Phase 10 (chunk 3/5)
 *
 * The Phase-04 write-path edge functions (sign-lease, sign-lease-co-applicant,
 * countersign, sign-amendment) call into PL/pgSQL RPCs that still mutate the
 * applications table directly (sign_lease_tenant, sign_lease_co_applicant,
 * etc). To avoid rewriting all of that DB-side logic in one shot, Phase 10
 * uses a dual-write strategy: after the RPC succeeds, the edge function
 * also mirrors the relevant fields onto the matching public.leases row.
 *
 * This module owns that mirroring + the lifecycle transition logic so each
 * edge function only has to call one helper. Lifecycle transitions:
 *
 *   tenant_signed (no co-applicant)         -> 'fully_signed'
 *   tenant_signed (co-applicant required)   -> 'partially_signed'
 *   co_applicant_signed                     -> 'fully_signed'
 *   countersigned                           -> 'active'
 *   amendment events                        -> no status change
 *
 * The helper is best-effort: a mirror failure is logged but does NOT roll
 * back the underlying RPC, since the application table remains the source
 * of truth during the transition window. Phase 14 flips that.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type SignerEvent =
  | 'tenant_signed'
  | 'co_applicant_signed'
  | 'countersigned';

const FIELDS_FROM_APP = [
  // Term + financials (kept in sync in case admin edited via update-lease)
  'lease_state_code','lease_start_date','lease_end_date',
  'monthly_rent','security_deposit','move_in_costs',
  'first_month_rent','last_month_rent','pet_deposit','pet_rent','admin_fee',
  'key_deposit','parking_fee','cleaning_fee','cleaning_fee_refundable',
  'rent_due_day_of_month','rent_proration_method','prorated_first_month',
  'utility_responsibilities',
  'lease_landlord_name','lease_landlord_address',
  'lease_late_fee_flat','lease_late_fee_daily',
  'lease_pets_policy','lease_smoking_policy','lease_compliance_snapshot',
  'lease_notes','lease_template_version_id','lease_pdf_url',
  // Signature fields
  'tenant_signature','tenant_signature_image','signature_timestamp','lease_ip_address',
  'co_applicant_signature','co_applicant_signature_image','co_applicant_signature_timestamp',
  'management_signed','management_signer_name','management_signed_at','management_notes',
  'management_cosigned','management_cosigned_by','management_cosigned_at',
  'lease_sent_date','lease_signed_date','lease_expiry_date',
] as const;

function decideStatus(app: Record<string, any>, event: SignerEvent | null): string {
  if (event === 'countersigned' || app.management_cosigned || app.management_signed) {
    return 'active';
  }
  if (app.has_co_applicant && app.tenant_signature && app.co_applicant_signature) {
    return 'fully_signed';
  }
  if (app.tenant_signature && app.co_applicant_signature) {
    return 'fully_signed';
  }
  if (!app.has_co_applicant && app.tenant_signature) {
    return 'fully_signed';
  }
  if (app.tenant_signature) return 'partially_signed';
  return 'sent';
}

/**
 * Mirror an updated application row into its current lease, optionally
 * advancing the lifecycle status based on the signing event that just
 * happened.
 *
 * Returns { ok: true, lease_id } on success or { ok: false, error } on
 * failure -- the caller decides whether to surface or swallow it.
 */
export async function mirrorAppToLease(
  supabase: SupabaseClient,
  app: Record<string, any>,
  event: SignerEvent | null = null,
): Promise<{ ok: true; lease_id: string } | { ok: false; error: string }> {
  if (!app?.id || !app?.app_id) return { ok: false, error: 'mirror requires app.id and app.app_id' };

  // Find the lease row to mirror to: prefer applications.current_lease_id,
  // fall back to most recent leases row for this app_id.
  let leaseId: string | null = (app as { current_lease_id?: string }).current_lease_id || null;
  if (!leaseId) {
    const { data } = await supabase
      .from('leases').select('id').eq('app_id', app.app_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    leaseId = (data as { id: string } | null)?.id || null;
  }
  if (!leaseId) {
    return { ok: false, error: 'No lease row found to mirror to (run generate-lease first).' };
  }

  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const f of FIELDS_FROM_APP) {
    if (f in app) update[f] = (app as Record<string, any>)[f];
  }

  const newStatus = decideStatus(app, event);
  update.lease_status = newStatus;
  if (event === 'tenant_signed' && app.signature_timestamp && !app.lease_signed_date) {
    update.lease_signed_date = app.signature_timestamp;
  }
  if (event === 'countersigned' && app.management_cosigned_at) {
    update.executed_at = app.management_cosigned_at;
  }

  const { error } = await supabase.from('leases').update(update).eq('id', leaseId);
  if (error) return { ok: false, error: 'Lease mirror update failed: ' + error.message };
  return { ok: true, lease_id: leaseId };
}

/**
 * Create a new lease row for an application as part of generate-lease.
 * Returns the new lease_id and also points applications.current_lease_id
 * at it. Idempotent-ish: if there's already a "live" (draft/sent/etc)
 * lease for this application, reuses it instead of creating a duplicate.
 *
 * Also stamps lease_id onto the existing rows in lease_signing_tokens
 * (for this app_id, freshly minted by generate_lease_tokens), so the
 * sign-* edge functions can find the lease via the token without
 * needing a separate lookup.
 */
export async function ensureLeaseForApp(
  supabase: SupabaseClient,
  app: Record<string, any>,
  createdByEmail: string | null,
): Promise<{ ok: true; lease_id: string; created: boolean } | { ok: false; error: string }> {
  if (!app?.id || !app?.app_id) return { ok: false, error: 'app.id and app.app_id required' };

  const { data: existing } = await supabase
    .from('leases').select('id, lease_status')
    .eq('application_id', app.id)
    .in('lease_status', ['draft','sent','partially_signed','fully_signed','active','expiring'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let leaseId: string;
  let created = false;
  if (existing?.id) {
    leaseId = existing.id;
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const f of FIELDS_FROM_APP) if (f in app) update[f] = (app as Record<string, any>)[f];
    update.lease_status = decideStatus(app, null);
    update.lease_sent_date = app.lease_sent_date || new Date().toISOString();
    await supabase.from('leases').update(update).eq('id', leaseId);
  } else {
    const insertRow: Record<string, any> = {
      application_id:   app.id,
      app_id:           app.app_id,
      listing_id:       app.listing_id || null,
      landlord_id:      app.landlord_id || null,
      property_address: app.property_address || null,
      created_by:       createdByEmail,
      lease_status:     'sent',
      lease_sent_date:  new Date().toISOString(),
    };
    for (const f of FIELDS_FROM_APP) if (f in app) insertRow[f] = (app as Record<string, any>)[f];
    insertRow.lease_status = 'sent';
    const { data: inserted, error } = await supabase
      .from('leases').insert(insertRow).select('id').single();
    if (error) return { ok: false, error: 'Lease insert failed: ' + error.message };
    leaseId = (inserted as { id: string }).id;
    created = true;
  }

  // Point the application at this lease
  await supabase.from('applications')
    .update({ current_lease_id: leaseId })
    .eq('id', app.id);

  // Stamp lease_id onto any signing tokens that don't have it yet
  // (newly-minted ones from generate_lease_tokens, plus any legacy rows).
  await supabase.from('lease_signing_tokens')
    .update({ lease_id: leaseId })
    .eq('app_id', app.app_id)
    .is('lease_id', null);

  // Also stamp lease_id onto child rows so admin/history queries can join
  // by lease_id without falling back to app_id.
  await supabase.from('lease_pdf_versions')
    .update({ lease_id: leaseId })
    .eq('app_id', app.app_id)
    .is('lease_id', null);
  await supabase.from('lease_addenda_attached')
    .update({ lease_id: leaseId })
    .eq('app_id', app.app_id)
    .is('lease_id', null);

  return { ok: true, lease_id: leaseId, created };
}
