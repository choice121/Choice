/**
 * generate-termination-notice — Phase 11
 *
 * Generates a state-compliant termination notice PDF for a lease and stores
 * it in lease_lifecycle_documents.  Does NOT file with any court or process
 * server — physical/email delivery is outside this function's scope.
 *
 * POST body (JSON):
 *   lease_id       string   REQUIRED — ID of the lease
 *   notice_type    string   REQUIRED — one of:
 *                    'tenant_initiated_30_day'   Tenant intends to vacate
 *                    'landlord_nonpayment'       Notice to pay or quit
 *                    'landlord_lease_violation'  Notice to cure or quit
 *                    'landlord_no_renewal'       Non-renewal notice
 *                    'mutual'                    Mutual agreement to terminate
 *   effective_date string   REQUIRED — ISO YYYY-MM-DD
 *   reason_text    string?  — Free-form reason / citation (included in PDF)
 *
 * Returns: { success, lifecycle_doc_id, pdf_storage_path, notice_days_required }
 *
 * State-law enforcement:
 *   - effective_date must be >= today + state-required notice days
 *   - For landlord_no_renewal in just-cause states: blocks unless reason_text
 *     contains a qualifying just-cause description (noted in output).
 *   - For mutual notices: no minimum date is enforced.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { resolveLease } from '../_shared/lease-resolve.ts';
import { getStateLaw } from '../_shared/state-law.ts';
import {
  computeTerminationNoticeDays,
  validateEffectiveDate,
  buildNoticePDF,
  sha256Hex,
  type TerminationNoticeType,
} from '../_shared/notice-period.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const VALID_NOTICE_TYPES: TerminationNoticeType[] = [
  'tenant_initiated_30_day',
  'landlord_nonpayment',
  'landlord_lease_violation',
  'landlord_no_renewal',
  'mutual',
];

const TITLE_MAP: Record<TerminationNoticeType, string> = {
  tenant_initiated_30_day:   'Notice of Intent to Vacate',
  landlord_nonpayment:       'Notice to Pay Rent or Quit',
  landlord_lease_violation:  'Notice to Cure Lease Violation or Quit',
  landlord_no_renewal:       'Notice of Non-Renewal of Tenancy',
  mutual:                    'Mutual Agreement to Terminate Tenancy',
};

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body', req); }

  const { lease_id, notice_type, effective_date, reason_text } = body as {
    lease_id?: string;
    notice_type?: string;
    effective_date?: string;
    reason_text?: string;
  };

  if (!lease_id)       return jsonErr(400, 'lease_id is required', req);
  if (!notice_type)    return jsonErr(400, 'notice_type is required', req);
  if (!effective_date) return jsonErr(400, 'effective_date is required (YYYY-MM-DD)', req);

  if (!VALID_NOTICE_TYPES.includes(notice_type as TerminationNoticeType)) {
    return jsonErr(400,
      `Invalid notice_type '${notice_type}'. Must be one of: ${VALID_NOTICE_TYPES.join(', ')}`, req);
  }
  const nt = notice_type as TerminationNoticeType;

  // ── Resolve lease + state law ──────────────────────────────────────────────
  const resolved = await resolveLease(supabase, { lease_id });
  if (!resolved.ok) return jsonErr(resolved.status, resolved.error, req);
  const { lease, app } = resolved;

  const stateCode = (lease.lease_state_code || app.lease_state_code || '').toUpperCase();
  const law = stateCode ? await getStateLaw(supabase, stateCode) : null;

  // ── State-law enforcement ──────────────────────────────────────────────────

  // 1. Compute required notice days
  const { days: noticeDays, statute: noticeStatute } = computeTerminationNoticeDays(law, nt);

  // 2. Validate effective_date meets the minimum
  const isMutual = nt === 'mutual';
  const dateCheck = validateEffectiveDate(effective_date, noticeDays, isMutual);
  if (!dateCheck.ok) {
    return jsonErr(422, dateCheck.error!, req);
  }

  // 3. Just-cause states: block landlord_no_renewal without a reason
  const justCauseWarning: string[] = [];
  if (nt === 'landlord_no_renewal' && law?.just_cause_required) {
    if (!reason_text || reason_text.trim().length < 20) {
      return jsonErr(422,
        `${stateCode} is a just-cause jurisdiction (${law.just_cause_required ? 'just cause required' : ''}). ` +
        `You must provide reason_text (at least 20 characters) describing a qualifying just-cause ground ` +
        `for non-renewal. Grounds vary by jurisdiction — consult your attorney.`, req);
    }
    justCauseWarning.push(
      `This notice is issued in a just-cause jurisdiction (${stateCode}). ` +
      `The reason stated must meet a qualifying statutory ground for non-renewal. ` +
      `Consult a licensed attorney to confirm eligibility before serving this notice.`
    );
  }

  // ── Build the PDF ──────────────────────────────────────────────────────────
  const tenantName = `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Tenant';
  const landlordName = lease.lease_landlord_name || app.lease_landlord_name || 'Choice Properties';

  const noticeDaysLine = isMutual
    ? 'By mutual agreement — no minimum notice required.'
    : `State-required notice: ${noticeDays} calendar day(s) (${stateCode || 'default'}).`;

  const bodySections = [];

  // Core content varies by notice type
  if (nt === 'tenant_initiated_30_day') {
    bodySections.push({
      heading: 'Notice from Tenant',
      body: `I, ${tenantName}, hereby give notice of my intent to vacate the above-referenced ` +
            `premises on or before ${effective_date}. This notice is provided pursuant to the ` +
            `terms of the lease agreement and applicable state law.`,
    });
  } else if (nt === 'landlord_nonpayment') {
    bodySections.push({
      heading: 'Notice to Tenant',
      body: `You are hereby notified that rent is past due on the above-referenced premises. ` +
            `You are required to pay all rent currently due and owing, or vacate the premises, ` +
            `within ${noticeDays} day(s) of service of this notice (by ${effective_date}).`,
    });
    bodySections.push({
      heading: 'Failure to Comply',
      body: `If you fail to pay the full amount of rent due or vacate the premises by the ` +
            `effective date, legal proceedings for eviction may be commenced against you ` +
            `in accordance with applicable state law.`,
    });
  } else if (nt === 'landlord_lease_violation') {
    bodySections.push({
      heading: 'Notice to Tenant',
      body: `You are hereby notified that you have violated the terms of your lease agreement ` +
            `as follows:\n\n${reason_text || '(Description of violation not provided.)'}`,
    });
    bodySections.push({
      heading: 'Cure or Quit',
      body: `You are required to cure the foregoing violation(s) within ${noticeDays} day(s) of ` +
            `service of this notice, or vacate the premises by ${effective_date}. ` +
            `Failure to do so may result in legal proceedings for eviction.`,
    });
  } else if (nt === 'landlord_no_renewal') {
    bodySections.push({
      heading: 'Notice of Non-Renewal',
      body: `Please be advised that your tenancy at the above-referenced property will ` +
            `NOT be renewed at the end of the current lease term. ` +
            `You are required to vacate the premises by ${effective_date}.`,
    });
    if (reason_text) {
      bodySections.push({
        heading: 'Reason for Non-Renewal',
        body: reason_text,
      });
    }
    if (justCauseWarning.length > 0) {
      bodySections.push({
        heading: 'Just-Cause Jurisdiction Notice',
        body: justCauseWarning.join('\n'),
      });
    }
  } else if (nt === 'mutual') {
    bodySections.push({
      heading: 'Mutual Agreement',
      body: `Both parties mutually agree to terminate the tenancy at the above-referenced ` +
            `property effective ${effective_date}. All terms of the original lease regarding ` +
            `final rent payment, deposit return, and move-out condition remain in effect.`,
    });
    if (reason_text) {
      bodySections.push({ heading: 'Notes', body: reason_text });
    }
  }

  bodySections.push({
    heading: 'Notice Period',
    body: noticeDaysLine,
  });

  const statuteCitations: string[] = [];
  if (noticeStatute) statuteCitations.push(`Notice statute: ${noticeStatute}`);
  if (law) {
    if (law.statute_holdover) statuteCitations.push(`Holdover rule: ${law.statute_holdover}`);
  }

  const pdfBytes = await buildNoticePDF({
    title: TITLE_MAP[nt],
    propertyAddress: lease.property_address || app.property_address || '—',
    tenantName,
    landlordName,
    stateCode: stateCode || '??',
    effectiveDate: effective_date,
    refNumber: lease.id,
    sections: bodySections,
    statuteCitations,
    footerLines: [
      `Notice type: ${nt}`,
      `Lease ID: ${lease.id}`,
      `Generated by Choice Properties admin on ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}.`,
    ],
  });

  const pdfHash = await sha256Hex(pdfBytes);

  // ── Store PDF ──────────────────────────────────────────────────────────────
  const storagePath = `termination-notices/${lease.id}/${nt}-${effective_date}.pdf`;
  await supabase.storage.from('lease-pdfs').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  });

  // ── Record in lease_pdf_versions (for audit trail on the lease) ────────────
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
    event:          'termination_notice',
    storage_path:   storagePath,
    sha256:         pdfHash,
    created_by:     auth.user.id,
    metadata: {
      notice_type:      nt,
      effective_date,
      notice_days_used: noticeDays,
    },
  });

  // ── Record in lease_lifecycle_documents ────────────────────────────────────
  const { data: lldRow, error: lldErr } = await supabase
    .from('lease_lifecycle_documents')
    .insert({
      lease_id:                   lease.id,
      doc_type:                   'termination_notice',
      notice_type:                nt,
      effective_date,
      generated_by:               auth.user.id,
      state_code:                 (stateCode || '??').toUpperCase().slice(0, 2),
      state_notice_days_required: noticeDays,
      storage_path:               storagePath,
      sha256:                     pdfHash,
      metadata: {
        reason_text:  reason_text || null,
        statute:      noticeStatute || null,
        just_cause_jurisdiction: law?.just_cause_required ?? false,
      },
    })
    .select('id')
    .single();

  const lifecycleDocId = lldErr ? null : lldRow?.id;

  // ── Update lease status for landlord-initiated and mutual terminations ──────
  if (['mutual', 'landlord_no_renewal'].includes(nt)) {
    await supabase.from('leases').update({
      termination_reason: reason_text || nt,
    }).eq('id', lease.id);
  }

  // ── Log admin action ───────────────────────────────────────────────────────
  await supabase.from('admin_actions').insert({
    action:       'termination_notice_generated',
    target_type:  'lease',
    target_id:    lease.id,
    metadata: {
      actor:             auth.user.id,
      notice_type:       nt,
      effective_date,
      notice_days:       noticeDays,
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
    notice_statute:       noticeStatute || null,
    just_cause_jurisdiction: law?.just_cause_required ?? false,
    just_cause_warnings:  justCauseWarning,
  }, req);
});
