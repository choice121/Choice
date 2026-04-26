/**
 * generate-rent-increase-letter — Phase 11
 *
 * Generates a state-compliant rent increase letter PDF and stores it in
 * lease_lifecycle_documents.
 *
 * POST body (JSON):
 *   lease_id             string   REQUIRED — ID of the active lease
 *   new_monthly_rent     number   REQUIRED — proposed new monthly rent
 *   effective_date       string   REQUIRED — ISO YYYY-MM-DD (first day of new rent)
 *   override_cap_check   boolean? — set true to bypass CA/OR statutory cap check
 *                                  (must document justification externally)
 *
 * Returns: {
 *   success, lifecycle_doc_id, pdf_storage_path,
 *   notice_days_required, is_large_increase, warnings[]
 * }
 *
 * State-law enforcement:
 *   - effective_date must be >= today + state-required notice days
 *   - If the increase is "large" (above state threshold), the extended notice
 *     period applies automatically.
 *   - CA AB-1482 (Civil Code §1947.12): increase > 10% is refused unless
 *     override_cap_check = true.
 *   - OR SB-608 (ORS 90.600): same 10% enforcement.
 *
 * Acceptance criteria:
 *   ✓ CA increase > 10% → 422 refused unless override
 *   ✓ effective_date < today + notice_days → 422 refused
 *   ✓ Stored in lease_lifecycle_documents with sha256
 *   ✓ Logged in admin_actions
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { resolveLease } from '../_shared/lease-resolve.ts';
import { getStateLaw } from '../_shared/state-law.ts';
import {
  computeRentIncreaseNoticeDays,
  validateEffectiveDate,
  checkRentCap,
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

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body', req); }

  const { lease_id, new_monthly_rent, effective_date, override_cap_check } = body as {
    lease_id?: string;
    new_monthly_rent?: number;
    effective_date?: string;
    override_cap_check?: boolean;
  };

  if (!lease_id)           return jsonErr(400, 'lease_id is required', req);
  if (!new_monthly_rent || new_monthly_rent <= 0)
    return jsonErr(400, 'new_monthly_rent must be a positive number', req);
  if (!effective_date)     return jsonErr(400, 'effective_date is required (YYYY-MM-DD)', req);

  // ── Resolve lease ─────────────────────────────────────────────────────────
  const resolved = await resolveLease(supabase, { lease_id });
  if (!resolved.ok) return jsonErr(resolved.status, resolved.error, req);
  const { lease, app } = resolved;

  const stateCode = (lease.lease_state_code || app.lease_state_code || '').toUpperCase();
  const law = stateCode ? await getStateLaw(supabase, stateCode) : null;

  const currentRent = typeof lease.monthly_rent === 'number' ? lease.monthly_rent : 0;
  if (new_monthly_rent <= currentRent) {
    return jsonErr(422,
      `new_monthly_rent ($${new_monthly_rent.toFixed(2)}) must be greater than the current ` +
      `rent ($${currentRent.toFixed(2)}). Use a lease amendment for rent reductions.`, req);
  }

  const rentDiff = new_monthly_rent - currentRent;
  const rentPct  = currentRent > 0 ? (rentDiff / currentRent) * 100 : 0;

  // ── Statutory cap enforcement (CA AB-1482, OR SB-608) ────────────────────
  const capCheck = checkRentCap(law, stateCode, currentRent, new_monthly_rent);
  if (!capCheck.ok && !override_cap_check) {
    return jsonErr(422, capCheck.error!, req);
  }
  const capWarnings: string[] = [];
  if (!capCheck.ok && override_cap_check) {
    capWarnings.push(
      `CAP CHECK OVERRIDE ENGAGED: The proposed increase of ${rentPct.toFixed(2)}% may exceed ` +
      `the ${stateCode} statutory cap of ~${capCheck.capPct}%. This override was explicitly ` +
      `requested. Ensure proper legal review before serving this notice.`
    );
  }

  // ── Notice period computation ─────────────────────────────────────────────
  const { noticeDays, isLargeIncrease, largeDays } =
    computeRentIncreaseNoticeDays(law, currentRent, new_monthly_rent);

  // ── Validate effective_date ───────────────────────────────────────────────
  const dateCheck = validateEffectiveDate(effective_date, noticeDays);
  if (!dateCheck.ok) return jsonErr(422, dateCheck.error!, req);

  // ── Build PDF ─────────────────────────────────────────────────────────────
  const tenantName    = `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Tenant';
  const landlordName  = lease.lease_landlord_name || app.lease_landlord_name || 'Choice Properties';

  const largeLine = isLargeIncrease
    ? `This increase of ${rentPct.toFixed(2)}% qualifies as a "large increase" under ` +
      `${stateCode} law (threshold: ${law?.rent_increase_large_threshold_pct ?? '?'}%). ` +
      `An extended notice period of ${largeDays ?? noticeDays} days applies.`
    : '';

  const capWarningLine = capWarnings.length > 0
    ? `\n\nWARNING: ${capWarnings.join(' ')}`
    : '';

  const sections = [
    {
      heading: 'Notice of Rent Increase',
      body: `Please be advised that effective ${effective_date}, your monthly rent at the ` +
            `above-referenced property will increase as follows:`,
    },
    {
      heading: 'Rent Adjustment Summary',
      body: `Current Monthly Rent:  $${currentRent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
            `New Monthly Rent:      $${new_monthly_rent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
            `Increase Amount:       +$${rentDiff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
            `Percentage Increase:   ${rentPct.toFixed(2)}%\n` +
            `Effective Date:        ${effective_date}`,
    },
    {
      heading: 'State-Required Notice Period',
      body: `${stateCode || 'State'} law requires at least ${noticeDays} calendar days' ` +
            `advance notice before a rent increase takes effect. ` +
            (isLargeIncrease ? largeLine + ' ' : '') +
            `This notice was issued ${noticeDays} or more days in advance of the effective date.`,
    },
    {
      heading: 'All Other Terms Unchanged',
      body: `All other terms and conditions of your lease agreement remain in effect. ` +
            `If you have questions, please contact your property manager at the address or ` +
            `phone number on file.`,
    },
    ...(capWarnings.length > 0 ? [{
      heading: 'Statutory Cap Override Notice',
      body: capWarnings.join('\n') + capWarningLine,
    }] : []),
  ];

  const statuteCitations: string[] = [];
  if (law) {
    if (law.statute_entry) statuteCitations.push(`Entry notice: ${law.statute_entry}`);
    // Rent-increase statutes aren't a separate column, so cite the general statute notes
    const code = stateCode.toUpperCase();
    if (code === 'CA') {
      statuteCitations.push(
        'CA Civil Code §1947.12 (AB-1482, 2019) — Annual rent increase cap for covered units.',
        'CA Civil Code §827 — 30-day notice for increases ≤10%; 90-day for increases >10%.'
      );
    } else if (code === 'OR') {
      statuteCitations.push(
        'ORS 90.600 (SB-608, 2019) — Maximum annual rent increase of 7%+CPI for covered units.',
        'ORS 90.600(2) — 90-day advance notice required for all rent increases.'
      );
    }
    if (law.notes) statuteCitations.push(`${code} notes: ${law.notes}`);
  }

  const pdfBytes = await buildNoticePDF({
    title: 'Notice of Rent Increase',
    propertyAddress: lease.property_address || app.property_address || '—',
    tenantName,
    landlordName,
    stateCode: stateCode || '??',
    effectiveDate: effective_date,
    refNumber: lease.id,
    sections,
    statuteCitations,
    footerLines: [
      `Lease ID: ${lease.id}`,
      `Generated by Choice Properties admin on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`,
    ],
  });

  const pdfHash = await sha256Hex(pdfBytes);

  // ── Store PDF ──────────────────────────────────────────────────────────────
  const storagePath = `rent-increase/${lease.id}/${effective_date}.pdf`;
  await supabase.storage.from('lease-pdfs').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  });

  // ── Record in lease_pdf_versions ───────────────────────────────────────────
  const { data: pdfVer } = await supabase
    .from('lease_pdf_versions')
    .select('version_number')
    .eq('app_id', lease.app_id || '')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVer = ((pdfVer?.version_number as number | null) ?? 0) + 1;
  await supabase.from('lease_pdf_versions').insert({
    lease_id:       lease.id,
    app_id:         lease.app_id || null,
    version_number: nextVer,
    event:          'rent_increase_letter',
    storage_path:   storagePath,
    sha256:         pdfHash,
    created_by:     auth.user.id,
    metadata: {
      new_monthly_rent,
      prior_monthly_rent: currentRent,
      rent_increase_pct:  parseFloat(rentPct.toFixed(2)),
      effective_date,
      notice_days_used:   noticeDays,
      is_large_increase:  isLargeIncrease,
      cap_override:       !!override_cap_check,
    },
  });

  // ── Record in lease_lifecycle_documents ────────────────────────────────────
  const { data: lldRow, error: lldErr } = await supabase
    .from('lease_lifecycle_documents')
    .insert({
      lease_id:                   lease.id,
      doc_type:                   'rent_increase_letter',
      effective_date,
      generated_by:               auth.user.id,
      state_code:                 (stateCode || '??').toUpperCase().slice(0, 2),
      state_notice_days_required: noticeDays,
      storage_path:               storagePath,
      sha256:                     pdfHash,
      metadata: {
        prior_monthly_rent:   currentRent,
        new_monthly_rent,
        rent_increase_pct:    parseFloat(rentPct.toFixed(2)),
        is_large_increase:    isLargeIncrease,
        large_notice_days:    largeDays ?? null,
        cap_override:         !!override_cap_check,
        cap_check_ok:         capCheck.ok,
        cap_pct:              capCheck.capPct ?? null,
      },
    })
    .select('id')
    .single();

  const lifecycleDocId = lldErr ? null : lldRow?.id;

  // ── Log admin action ───────────────────────────────────────────────────────
  await supabase.from('admin_actions').insert({
    action:       'rent_increase_letter_generated',
    target_type:  'lease',
    target_id:    lease.id,
    metadata: {
      actor:             auth.user.id,
      prior_rent:        currentRent,
      new_rent:          new_monthly_rent,
      rent_pct:          parseFloat(rentPct.toFixed(2)),
      effective_date,
      notice_days:       noticeDays,
      is_large_increase: isLargeIncrease,
      cap_override:      !!override_cap_check,
      state_code:        stateCode,
      lifecycle_doc_id:  lifecycleDocId,
      pdf_hash:          pdfHash,
    },
  });

  return jsonOk({
    success: true,
    lifecycle_doc_id:     lifecycleDocId,
    pdf_storage_path:     storagePath,
    pdf_sha256:           pdfHash,
    notice_days_required: noticeDays,
    is_large_increase:    isLargeIncrease,
    large_notice_days:    largeDays ?? null,
    rent_increase_pct:    parseFloat(rentPct.toFixed(2)),
    warnings:             capWarnings,
  }, req);
});
