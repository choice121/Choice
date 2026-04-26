/**
 * generate-renewal — Phase 11
 *
 * Creates a renewal lease document for an existing active lease.
 * The renewal is a new `leases` row linked via `parent_lease_id` to the
 * original; the original is marked `superseded`. The new lease starts the
 * day after the parent ends and defaults to the same term length.
 *
 * POST body (JSON):
 *   lease_id              string   REQUIRED — ID of the active lease to renew
 *   new_monthly_rent      number?  — override rent for the renewal (default: same)
 *   new_lease_start_date  string?  — ISO YYYY-MM-DD (default: day after parent ends)
 *   new_lease_end_date    string?  — ISO YYYY-MM-DD (default: same duration as parent)
 *   notes                 string?  — internal admin notes for the renewal
 *
 * Returns: { success, renewal_lease_id, lifecycle_doc_id, pdf_storage_path }
 *
 * Acceptance criteria:
 *   ✓ Creates new leases row with parent_lease_id set
 *   ✓ Sets parent lease status → 'superseded', renewed_at → now()
 *   ✓ Updates applications.current_lease_id to the new lease
 *   ✓ Generates and stores a renewal PDF
 *   ✓ Logs in admin_actions
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, buildCorsHeaders, jsonOk, jsonErr } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { resolveLease } from '../_shared/lease-resolve.ts';
import { getStateLaw } from '../_shared/state-law.ts';
import {
  buildNoticePDF,
  sha256Hex,
} from '../_shared/notice-period.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body', req); }

  const { lease_id, new_monthly_rent, new_lease_start_date, new_lease_end_date, notes } = body as {
    lease_id?: string;
    new_monthly_rent?: number;
    new_lease_start_date?: string;
    new_lease_end_date?: string;
    notes?: string;
  };

  if (!lease_id) return jsonErr(400, 'lease_id is required', req);

  // ── Resolve current lease ────────────────────────────────────────────────
  const resolved = await resolveLease(supabase, { lease_id });
  if (!resolved.ok) return jsonErr(resolved.status, resolved.error, req);
  const { lease, app } = resolved;

  // Only active (countersigned) leases can be renewed
  if (!['active', 'fully_signed'].includes(lease.lease_status)) {
    return jsonErr(422, `Cannot renew a lease in status '${lease.lease_status}'. Only active or fully_signed leases can be renewed.`, req);
  }

  // ── Compute renewal term ──────────────────────────────────────────────────
  let startDate: string;
  let endDate: string;

  if (new_lease_start_date) {
    startDate = new_lease_start_date;
  } else if (lease.lease_end_date) {
    // Day after parent ends
    const parentEnd = new Date(lease.lease_end_date + 'T00:00:00');
    parentEnd.setDate(parentEnd.getDate() + 1);
    startDate = parentEnd.toISOString().slice(0, 10);
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    startDate = tomorrow.toISOString().slice(0, 10);
  }

  if (new_lease_end_date) {
    endDate = new_lease_end_date;
  } else if (lease.lease_start_date && lease.lease_end_date) {
    // Same duration as parent
    const pStart = new Date(lease.lease_start_date + 'T00:00:00');
    const pEnd   = new Date(lease.lease_end_date + 'T00:00:00');
    const durationMs = pEnd.getTime() - pStart.getTime();
    const renewStart = new Date(startDate + 'T00:00:00');
    const renewEnd = new Date(renewStart.getTime() + durationMs);
    endDate = renewEnd.toISOString().slice(0, 10);
  } else {
    // Default 1 year
    const renewStart = new Date(startDate + 'T00:00:00');
    renewStart.setFullYear(renewStart.getFullYear() + 1);
    renewStart.setDate(renewStart.getDate() - 1); // inclusive end
    endDate = renewStart.toISOString().slice(0, 10);
  }

  const renewalRent = typeof new_monthly_rent === 'number' && new_monthly_rent > 0
    ? new_monthly_rent
    : (lease.monthly_rent ?? 0);

  // Check large rent increase (for logging purposes)
  const stateCode = lease.lease_state_code || app.lease_state_code || '';
  const law = stateCode ? await getStateLaw(supabase, stateCode) : null;
  const rentIncreaseAmt = renewalRent - (lease.monthly_rent ?? 0);
  const rentIncreasePct = (lease.monthly_rent ?? 0) > 0
    ? (rentIncreaseAmt / (lease.monthly_rent as number)) * 100
    : 0;
  const isLargeIncrease = law?.rent_increase_large_threshold_pct != null
    && rentIncreasePct > law.rent_increase_large_threshold_pct;

  // ── Create renewal lease row ──────────────────────────────────────────────
  const renewalPayload = {
    app_id:                   lease.app_id,
    application_id:           lease.application_id,
    listing_id:               lease.listing_id,
    landlord_id:              lease.landlord_id,
    parent_lease_id:          lease.id,
    property_address:         lease.property_address,
    lease_state_code:         stateCode || null,
    lease_start_date:         startDate,
    lease_end_date:           endDate,
    monthly_rent:             renewalRent,
    security_deposit:         lease.security_deposit,
    first_month_rent:         null,  // renewal — tenant has already paid first/last
    last_month_rent:          null,
    pet_deposit:              lease.pet_deposit,
    pet_rent:                 lease.pet_rent,
    admin_fee:                null,
    key_deposit:              null,
    parking_fee:              lease.parking_fee,
    cleaning_fee:             null,
    cleaning_fee_refundable:  null,
    rent_due_day_of_month:    lease.rent_due_day_of_month,
    rent_proration_method:    lease.rent_proration_method,
    utility_responsibilities: lease.utility_responsibilities,
    lease_landlord_name:      lease.lease_landlord_name,
    lease_landlord_address:   lease.lease_landlord_address,
    lease_late_fee_flat:      lease.lease_late_fee_flat,
    lease_late_fee_daily:     lease.lease_late_fee_daily,
    lease_pets_policy:        lease.lease_pets_policy,
    lease_smoking_policy:     lease.lease_smoking_policy,
    lease_notes:              notes || null,
    lease_template_version_id: null,  // renewal uses current template; will be set on generate
    lease_status:             'draft',
    created_by:               auth.user.id,
  };

  const { data: newLease, error: newLeaseErr } = await supabase
    .from('leases')
    .insert(renewalPayload)
    .select('id')
    .single();

  if (newLeaseErr || !newLease) {
    return jsonErr(500, 'Failed to create renewal lease: ' + (newLeaseErr?.message || 'unknown'), req);
  }

  const renewalLeaseId: string = newLease.id;

  // ── Mark parent as superseded ─────────────────────────────────────────────
  await supabase.from('leases').update({
    lease_status: 'superseded',
    renewed_at: new Date().toISOString(),
  }).eq('id', lease.id);

  // ── Update applications.current_lease_id ─────────────────────────────────
  if (lease.app_id) {
    await supabase.from('applications').update({
      current_lease_id: renewalLeaseId,
    }).eq('app_id', lease.app_id);
  }

  // ── Generate renewal PDF ──────────────────────────────────────────────────
  const tenantName = `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Tenant';
  const landlordName = lease.lease_landlord_name || app.lease_landlord_name || 'Choice Properties';

  const largeIncreaseSection = isLargeIncrease ? [{
    heading: 'Notice of Substantial Rent Increase',
    body: `The proposed rent increase of ${rentIncreasePct.toFixed(1)}% exceeds the threshold ` +
          `for a "large increase" under ${stateCode} law. ` +
          (law?.rent_increase_large_notice_days
            ? `An extended notice period of ${law.rent_increase_large_notice_days} days is required ` +
              `before the new rent takes effect. `
            : '') +
          `Please ensure the tenant has received proper notice before executing this renewal.`,
  }] : [];

  const pdfBytes = await buildNoticePDF({
    title: 'Lease Renewal Agreement',
    propertyAddress: lease.property_address || app.property_address || '—',
    tenantName,
    landlordName,
    stateCode: stateCode || '??',
    effectiveDate: startDate,
    refNumber: renewalLeaseId,
    sections: [
      {
        heading: 'Agreement to Renew Tenancy',
        body: `This Lease Renewal Agreement ("Renewal") extends the tenancy at the above-referenced ` +
              `property for an additional term. The terms of the original lease (Ref: ${lease.id}) ` +
              `remain in effect except as modified below.`,
      },
      {
        heading: 'Renewal Term',
        body: `New Lease Start Date: ${startDate}\n` +
              `New Lease End Date:   ${endDate}`,
      },
      {
        heading: 'Monthly Rent',
        body: `Monthly Rent: $${renewalRent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
              (rentIncreaseAmt !== 0
                ? `Change from prior lease: ${rentIncreaseAmt > 0 ? '+' : ''}$${rentIncreaseAmt.toFixed(2)} ` +
                  `(${rentIncreasePct > 0 ? '+' : ''}${rentIncreasePct.toFixed(2)}%)`
                : 'Rent is unchanged from the prior lease.'),
      },
      ...largeIncreaseSection,
      {
        heading: 'All Other Terms',
        body: `All other terms and conditions of the original lease agreement dated ` +
              `${lease.lease_start_date || '(date on original)'} remain unchanged and in full force ` +
              `and effect throughout this renewal term.`,
      },
      {
        heading: 'Acknowledgment',
        body: `By countersigning this Renewal Agreement, both parties agree to extend the tenancy ` +
              `under the terms stated above. A new signing workflow will be sent to the tenant ` +
              `for electronic signature.`,
      },
      ...(notes ? [{ heading: 'Admin Notes', body: notes }] : []),
    ],
    statuteCitations: law ? [
      law.statute_eviction ? `Eviction notice statute: ${law.statute_eviction}` : '',
      `${stateCode} security deposit return: ${law.security_deposit_return_days} days after vacating.`,
    ].filter(Boolean) : [],
  });

  const pdfHash = await sha256Hex(pdfBytes);

  // ── Store PDF in Supabase storage ─────────────────────────────────────────
  const storagePath = `renewals/${renewalLeaseId}/renewal-draft.pdf`;
  await supabase.storage.from('lease-pdfs').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  });

  // ── Record in lease_lifecycle_documents ───────────────────────────────────
  const { data: lldRow, error: lldErr } = await supabase
    .from('lease_lifecycle_documents')
    .insert({
      lease_id:                  renewalLeaseId,
      doc_type:                  'renewal_lease',
      effective_date:            startDate,
      generated_by:              auth.user.id,
      state_code:                (stateCode || '??').toUpperCase().slice(0, 2),
      storage_path:              storagePath,
      sha256:                    pdfHash,
      metadata: {
        parent_lease_id:         lease.id,
        prior_monthly_rent:      lease.monthly_rent,
        new_monthly_rent:        renewalRent,
        rent_increase_pct:       parseFloat(rentIncreasePct.toFixed(2)),
        is_large_increase:       isLargeIncrease,
        prior_end_date:          lease.lease_end_date,
        renewal_start_date:      startDate,
        renewal_end_date:        endDate,
        notes:                   notes || null,
      },
    })
    .select('id')
    .single();

  const lifecycleDocId = lldErr ? null : lldRow?.id;

  // ── Log admin action ──────────────────────────────────────────────────────
  await supabase.from('admin_actions').insert({
    action:       'renewal_lease_generated',
    target_type:  'lease',
    target_id:    renewalLeaseId,
    metadata: {
      actor:            auth.user.id,
      parent_lease_id:  lease.id,
      app_id:           lease.app_id,
      prior_rent:       lease.monthly_rent,
      new_rent:         renewalRent,
      renewal_start:    startDate,
      renewal_end:      endDate,
      lifecycle_doc_id: lifecycleDocId,
      pdf_hash:         pdfHash,
    },
  });

  return jsonOk({
    success: true,
    renewal_lease_id:  renewalLeaseId,
    lifecycle_doc_id:  lifecycleDocId,
    pdf_storage_path:  storagePath,
    pdf_sha256:        pdfHash,
    is_large_increase: isLargeIncrease,
    renewal_term: {
      start_date:     startDate,
      end_date:       endDate,
      monthly_rent:   renewalRent,
    },
  }, req);
});
