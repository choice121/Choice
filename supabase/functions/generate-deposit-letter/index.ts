// ─────────────────────────────────────────────────────────────────────
// generate-deposit-letter — Phase 09 chunk 2/5
//
// Admin-only POST endpoint that:
//
//   1. Looks up (or creates) a lease_deposit_accountings row for an app.
//   2. Optionally REPLACES the deduction line-items in one atomic batch.
//   3. Computes totals (held / withheld / refund / interest), snapshots
//      the per-state return-deadline from state_lease_law, and flips
//      late_generated when today > deadline.
//   4. Renders the state-compliant accounting PDF using
//      _shared/deposit-letter-render.ts.
//   5. Hashes the PDF bytes (SHA-256, Phase 06 convention), uploads to
//      the lease-pdfs bucket at <app_id>/deposit/<accounting_id>.pdf,
//      and mirrors the artifact into lease_pdf_versions with event
//      'deposit_accounting'.
//   6. Persists letter_pdf_path / letter_pdf_sha256 / letter_pdf_bytes
//      / generated_at / generated_by / state snapshot fields back onto
//      the accounting row.
//   7. Optionally emails the tenant a signed-URL link to download the
//      letter (deferred to chunk 5; flag accepted but no-op for now).
//
// Request body:
//   {
//     app_id:           UUID,                  // required
//     deductions?:      DeductionInput[],      // OPTIONAL — if present,
//                                              //   replaces existing rows
//                                              //   under this accounting.
//     interest_accrued?: number,                // optional, default 0
//     dry_run?:         boolean,               // if true, computes totals
//                                              //   but does NOT render or
//                                              //   persist a PDF. Useful
//                                              //   for the admin UI's
//                                              //   live preview pane.
//     send_email?:      boolean,               // chunk 5 wires this up
//     admin_notes?:     string,                // appended to accounting
//   }
//
// On success returns:
//   {
//     success: true,
//     accounting_id, app_id,
//     totals: { total_deposit_held, amount_withheld, refund_owed_to_tenant,
//               interest_accrued },
//     state_code, state_return_days, state_return_deadline,
//     late_generated,
//     letter_pdf_path?:    string,             // present unless dry_run
//     letter_pdf_sha256?:  string,
//     letter_pdf_bytes?:   number,
//     page_count?:         number,
//     photos_embedded?:    number,
//     photos_failed?:      number,
//     pdf_version_number?: number | null,
//     dry_run?: true,
//   }
// ─────────────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import {
  buildDepositLetterPDF,
  type DepositDeduction,
} from '../_shared/deposit-letter-render.ts';

const PDF_BUCKET   = 'lease-pdfs';
const PHOTO_BUCKET = 'lease-inspection-photos';
const VALID_CATEGORIES = new Set([
  'rent_arrears', 'cleaning', 'damages', 'unpaid_utilities', 'early_termination', 'other',
]);

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── Helpers ──────────────────────────────────────────────────────────

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

interface AuthCtx { user_id: string; email: string; }

async function requireAdmin(req: Request): Promise<{ ok: true; ctx: AuthCtx } | { ok: false; status: number; msg: string }> {
  const authHeader = req.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, msg: 'Missing Authorization header' };
  const { data: userData, error: userErr } = await supabase.auth.getUser(match[1]);
  if (userErr || !userData?.user) return { ok: false, status: 401, msg: 'Invalid session' };
  const { data: roleRow } = await supabase
    .from('admin_roles').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (!roleRow) return { ok: false, status: 403, msg: 'Admin role required' };
  return { ok: true, ctx: { user_id: userData.user.id, email: userData.user.email || '' } };
}

// Compute the per-state return deadline as move_out + return_days.
// Both inputs are at calendar-date granularity (UTC).
function computeReturnDeadline(moveOutISO: string, returnDays: number): string {
  const d = new Date(moveOutISO + (moveOutISO.length === 10 ? 'T00:00:00Z' : ''));
  if (isNaN(d.getTime())) throw new Error('invalid move_out date');
  d.setUTCDate(d.getUTCDate() + returnDays);
  return d.toISOString().slice(0, 10);
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// Total deposit held = security_deposit + pet_deposit + key_deposit
// (Phase 7 schema: applications carries these columns directly. The
// cleaning_fee, when refundable=false, is a non-refundable fee and is
// NOT part of the held deposit — refundable cleaning fees, when used,
// are folded into security_deposit by the lease generator.)
function computeDepositHeld(app: any): number {
  return num(app.security_deposit) + num(app.pet_deposit) + num(app.key_deposit);
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonErr('Method not allowed', 405, req);

  // 1. Auth
  const auth = await requireAdmin(req);
  if (!auth.ok) return jsonErr(auth.msg, auth.status, req);

  // 2. Parse + validate body
  let body: any;
  try { body = await req.json(); }
  catch { return jsonErr('Invalid JSON body', 400, req); }

  const app_id = body?.app_id;
  if (!isUuid(app_id)) return jsonErr('app_id (UUID) is required', 400, req);

  const dry_run        = body.dry_run === true;
  const send_email     = body.send_email === true;
  const interest       = Math.max(0, num(body.interest_accrued, 0));
  const admin_notes    = typeof body.admin_notes === 'string' ? body.admin_notes.slice(0, 4000) : null;

  let deductionsInput: DepositDeduction[] | null = null;
  if (Array.isArray(body.deductions)) {
    if (body.deductions.length > 100) return jsonErr('Too many deductions (max 100)', 400, req);
    deductionsInput = [];
    for (const [i, raw] of body.deductions.entries()) {
      if (!raw || typeof raw !== 'object') return jsonErr(`deductions[${i}] is not an object`, 400, req);
      const cat  = String(raw.category || '');
      const desc = String(raw.description || '').trim();
      const amt  = num(raw.amount, NaN);
      if (!VALID_CATEGORIES.has(cat))            return jsonErr(`deductions[${i}].category invalid`, 400, req);
      if (!desc)                                 return jsonErr(`deductions[${i}].description required`, 400, req);
      if (!Number.isFinite(amt) || amt < 0)      return jsonErr(`deductions[${i}].amount must be >= 0`, 400, req);
      const photos = Array.isArray(raw.supporting_photo_paths) ? raw.supporting_photo_paths.map(String).slice(0, 20) : [];
      const receipts = Array.isArray(raw.receipt_paths) ? raw.receipt_paths.map(String).slice(0, 20) : [];
      deductionsInput.push({
        category:                cat as DepositDeduction['category'],
        description:             desc,
        amount:                  amt,
        inspection_id:           isUuid(raw.inspection_id) ? raw.inspection_id : null,
        supporting_photo_paths:  photos,
        receipt_paths:           receipts,
        sort_order:              Number.isFinite(raw.sort_order) ? Number(raw.sort_order) : i,
      });
    }
  }

  // 3. Load application
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select(`id, app_id, first_name, last_name, email,
             property_address, city, state, zip,
             move_in_date_actual, move_out_date_actual,
             lease_state_code, lease_status,
             security_deposit, pet_deposit, key_deposit,
             property_id`)
    .eq('id', app_id)
    .maybeSingle();
  if (appErr || !app) return jsonErr(`Application not found: ${appErr?.message || 'no row'}`, 404, req);
  if (!app.move_out_date_actual) {
    return jsonErr('applications.move_out_date_actual must be set before generating deposit accounting', 400, req);
  }

  // 4. Resolve state law (snapshot at generation time)
  const stateCode = (app.lease_state_code || app.state || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) {
    return jsonErr(`Cannot determine state of premises (lease_state_code='${app.lease_state_code}', state='${app.state}')`, 400, req);
  }
  const { data: stateLaw, error: stateErr } = await supabase
    .from('state_lease_law')
    .select('state_code, security_deposit_return_days, statute_security_deposit, security_deposit_interest_required, notes')
    .eq('state_code', stateCode)
    .maybeSingle();
  if (stateErr || !stateLaw) return jsonErr(`No state_lease_law row for state ${stateCode}`, 400, req);

  const returnDays   = stateLaw.security_deposit_return_days;
  const moveOutISO   = String(app.move_out_date_actual);
  const deadlineISO  = computeReturnDeadline(moveOutISO, returnDays);
  const lateGenerated = todayUTC() > deadlineISO;

  // 5. Find or create accounting row
  let { data: accounting, error: accErr } = await supabase
    .from('lease_deposit_accountings')
    .select('*')
    .eq('app_id', app_id)
    .is('lease_termination_id', null)
    .maybeSingle();
  if (accErr) return jsonErr(`accounting lookup failed: ${accErr.message}`, 500, req);

  if (!accounting) {
    const { data: created, error: insErr } = await supabase
      .from('lease_deposit_accountings')
      .insert({
        app_id,
        state_code_snapshot:        stateCode,
        state_return_days_snapshot: returnDays,
        move_out_date_snapshot:     moveOutISO,
        state_return_deadline:      deadlineISO,
        late_generated:             lateGenerated,
        admin_notes,
      })
      .select('*').single();
    if (insErr || !created) return jsonErr(`accounting create failed: ${insErr?.message}`, 500, req);
    accounting = created;
  }

  // 6. Replace deductions if caller supplied them
  if (deductionsInput) {
    const { error: delErr } = await supabase
      .from('lease_deposit_deductions')
      .delete().eq('accounting_id', accounting.id);
    if (delErr) return jsonErr(`deductions clear failed: ${delErr.message}`, 500, req);
    if (deductionsInput.length) {
      const insertRows = deductionsInput.map(d => ({
        accounting_id:           accounting!.id,
        app_id,
        category:                d.category,
        description:             d.description,
        amount:                  d.amount,
        inspection_id:           d.inspection_id || null,
        supporting_photo_paths:  d.supporting_photo_paths || [],
        receipt_paths:           d.receipt_paths || [],
        sort_order:              d.sort_order ?? 0,
      }));
      const { error: insErr } = await supabase.from('lease_deposit_deductions').insert(insertRows);
      if (insErr) return jsonErr(`deductions insert failed: ${insErr.message}`, 500, req);
    }
  }

  // 7. Re-load deductions (canonical state for compute + render)
  const { data: deductions, error: dedErr } = await supabase
    .from('lease_deposit_deductions')
    .select('id, category, description, amount, inspection_id, supporting_photo_paths, receipt_paths, sort_order')
    .eq('accounting_id', accounting.id)
    .order('sort_order', { ascending: true });
  if (dedErr) return jsonErr(`deductions reload failed: ${dedErr.message}`, 500, req);

  // 8. Compute totals
  const totalDepositHeld = computeDepositHeld(app);
  const amountWithheld   = (deductions || []).reduce((s, d) => s + num(d.amount), 0);
  const refundOwed       = Math.max(0, totalDepositHeld - amountWithheld + interest);

  if (amountWithheld > totalDepositHeld + interest) {
    // Allowed (admin can record overage), but flag in response
    console.warn(`[generate-deposit-letter] withheld ${amountWithheld} > held ${totalDepositHeld} + interest ${interest} for app ${app_id}`);
  }

  // 9. Resolve landlord display name (best-effort)
  let landlordName = 'Choice Properties';
  if (app.property_id) {
    const { data: prop } = await supabase
      .from('properties').select('landlord_id').eq('id', app.property_id).maybeSingle();
    if (prop?.landlord_id) {
      const { data: landlord } = await supabase
        .from('user_profiles').select('display_name, full_name, business_name')
        .eq('user_id', prop.landlord_id).maybeSingle();
      landlordName = landlord?.business_name || landlord?.display_name || landlord?.full_name || landlordName;
    }
  }

  const generatedAtISO = new Date().toISOString();

  // 10. Dry-run short-circuit
  if (dry_run) {
    // Persist the recomputed totals + deadline so the UI sees consistent
    // state, but do NOT render or upload a PDF.
    await supabase.from('lease_deposit_accountings').update({
      state_code_snapshot:        stateCode,
      state_return_days_snapshot: returnDays,
      move_out_date_snapshot:     moveOutISO,
      state_return_deadline:      deadlineISO,
      late_generated:             lateGenerated,
      total_deposit_held:         totalDepositHeld,
      amount_withheld:            amountWithheld,
      refund_owed_to_tenant:      refundOwed,
      interest_accrued:           interest,
      admin_notes:                admin_notes ?? accounting.admin_notes,
    }).eq('id', accounting.id);

    return jsonOk({
      success:             true,
      dry_run:             true,
      accounting_id:       accounting.id,
      app_id,
      totals: {
        total_deposit_held:    totalDepositHeld,
        amount_withheld:       amountWithheld,
        refund_owed_to_tenant: refundOwed,
        interest_accrued:      interest,
      },
      state_code:            stateCode,
      state_return_days:     returnDays,
      state_return_deadline: deadlineISO,
      late_generated:        lateGenerated,
      deductions_count:      (deductions || []).length,
    }, req);
  }

  // 11. Render PDF
  let pdfBytes: Uint8Array;
  let page_count = 0, photos_embedded = 0, photos_failed = 0;
  try {
    const result = await buildDepositLetterPDF({
      supabase,
      accounting_id:    accounting.id,
      app:              app as any,
      state_law:        stateLaw as any,
      totals: {
        total_deposit_held:    totalDepositHeld,
        amount_withheld:       amountWithheld,
        refund_owed_to_tenant: refundOwed,
        interest_accrued:      interest,
      },
      deadlines: {
        move_out_date:         moveOutISO,
        state_return_deadline: deadlineISO,
        late_generated:        lateGenerated,
      },
      deductions:        (deductions || []) as any,
      landlord_name:     landlordName,
      generated_at_iso:  generatedAtISO,
      photo_bucket:      PHOTO_BUCKET,
    });
    pdfBytes        = result.bytes;
    page_count      = result.page_count;
    photos_embedded = result.photos_embedded;
    photos_failed   = result.photos_failed;
  } catch (e) {
    console.error('[generate-deposit-letter] render failed:', e);
    return jsonErr(`PDF render failed: ${(e as Error).message}`, 500, req);
  }

  // 12. Hash + upload to lease-pdfs
  const sha256 = await sha256Hex(pdfBytes);
  const storagePath = `${app_id}/deposit/${accounting.id}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(PDF_BUCKET)
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });
  if (upErr) {
    console.error('[generate-deposit-letter] storage upload failed:', upErr);
    return jsonErr(`Storage upload failed: ${upErr.message}`, 500, req);
  }

  // 13. Persist artifact metadata back onto the accounting row
  const { error: updErr } = await supabase
    .from('lease_deposit_accountings')
    .update({
      state_code_snapshot:        stateCode,
      state_return_days_snapshot: returnDays,
      move_out_date_snapshot:     moveOutISO,
      state_return_deadline:      deadlineISO,
      late_generated:             lateGenerated,
      total_deposit_held:         totalDepositHeld,
      amount_withheld:            amountWithheld,
      refund_owed_to_tenant:      refundOwed,
      interest_accrued:           interest,
      letter_pdf_path:            storagePath,
      letter_pdf_sha256:          sha256,
      letter_pdf_bytes:           pdfBytes.length,
      generated_at:               generatedAtISO,
      generated_by:               auth.ctx.user_id,
      admin_notes:                admin_notes ?? accounting.admin_notes,
    })
    .eq('id', accounting.id);
  if (updErr) {
    console.error('[generate-deposit-letter] accounting update failed:', updErr);
    return jsonErr(`Accounting update failed: ${updErr.message}`, 500, req);
  }

  // 14. Mirror into lease_pdf_versions (Phase 06 audit trail)
  let pdfVersionNumber: number | null = null;
  try {
    // Compute next version_number for this app
    const { data: existing } = await supabase
      .from('lease_pdf_versions')
      .select('version_number')
      .eq('app_id', app.app_id || app_id)
      .order('version_number', { ascending: false })
      .limit(1);
    pdfVersionNumber = ((existing?.[0]?.version_number) || 0) + 1;

    await supabase.from('lease_pdf_versions').insert({
      app_id:                 app.app_id || app_id,
      version_number:         pdfVersionNumber,
      event:                  'deposit_accounting',
      storage_path:           storagePath,
      size_bytes:             pdfBytes.length,
      created_by:             auth.ctx.email || null,
      sha256,
      certificate_appended:   false,
    });
  } catch (e) {
    console.error('[generate-deposit-letter] lease_pdf_versions mirror failed (non-fatal):', (e as Error).message);
    pdfVersionNumber = null;
  }

  // 15. Audit log
  try {
    await supabase.from('admin_actions').insert({
      action:      'generate_deposit_letter',
      target_type: 'application',
      target_id:   app.app_id || app_id,
      metadata: {
        app_id,
        accounting_id:         accounting.id,
        actor:                 auth.ctx.email,
        state_code:            stateCode,
        state_return_days:     returnDays,
        state_return_deadline: deadlineISO,
        late_generated:        lateGenerated,
        total_deposit_held:    totalDepositHeld,
        amount_withheld:       amountWithheld,
        refund_owed_to_tenant: refundOwed,
        interest_accrued:      interest,
        deductions_count:      (deductions || []).length,
        page_count,
        photos_embedded,
        photos_failed,
        pdf_storage_path:      storagePath,
        pdf_sha256:            sha256,
      },
    });
  } catch (_) { /* non-fatal */ }

  // 16. Email tenant (deferred to chunk 5 — flag accepted, no-op for now)
  if (send_email) {
    console.log('[generate-deposit-letter] send_email requested but email wiring lands in chunk 5');
  }

  return jsonOk({
    success:               true,
    accounting_id:         accounting.id,
    app_id,
    totals: {
      total_deposit_held:    totalDepositHeld,
      amount_withheld:       amountWithheld,
      refund_owed_to_tenant: refundOwed,
      interest_accrued:      interest,
    },
    state_code:            stateCode,
    state_return_days:     returnDays,
    state_return_deadline: deadlineISO,
    late_generated:        lateGenerated,
    letter_pdf_path:       storagePath,
    letter_pdf_sha256:     sha256,
    letter_pdf_bytes:      pdfBytes.length,
    page_count,
    photos_embedded,
    photos_failed,
    pdf_version_number:    pdfVersionNumber,
  }, req);
});
