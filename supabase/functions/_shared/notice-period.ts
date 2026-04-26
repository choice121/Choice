/**
 * notice-period.ts  — Phase 11
 *
 * Shared computation helpers for all three Phase 11 document generators:
 *   generate-renewal
 *   generate-termination-notice
 *   generate-rent-increase-letter
 *
 * Also owns the simple one-page PDF builder used by all three functions.
 * The full buildLeasePDF() in pdf.ts is designed for the full-lease flow;
 * for notices we just need a clean, legible letter-style page.
 */

import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import type { StateLawRow } from './state-law.ts';
import { STANDARD_DISCLAIMER } from './legal-disclaimer.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Termination notice period computation
// ─────────────────────────────────────────────────────────────────────────────

export type TerminationNoticeType =
  | 'tenant_initiated_30_day'
  | 'landlord_nonpayment'
  | 'landlord_lease_violation'
  | 'landlord_no_renewal'
  | 'mutual';

/**
 * How many days of advance notice are required for this notice type?
 * Returns the required days + the applicable statute citation if available.
 */
export function computeTerminationNoticeDays(
  law: StateLawRow | null,
  noticeType: TerminationNoticeType,
): { days: number; statute: string | null } {
  // Mutual and tenant-initiated: typically 30 days (most states) or as required
  if (noticeType === 'mutual') {
    return { days: 0, statute: null }; // effective date is by agreement
  }
  if (noticeType === 'tenant_initiated_30_day') {
    // Most states require 30 days; some require less for month-to-month.
    // Default to 30 — the more conservative value — so we don't under-serve.
    return { days: 30, statute: null };
  }
  if (!law) {
    // No state law data — fall back to conservative federal-style minimums
    if (noticeType === 'landlord_nonpayment') return { days: 3, statute: null };
    if (noticeType === 'landlord_lease_violation') return { days: 3, statute: null };
    if (noticeType === 'landlord_no_renewal') return { days: 30, statute: null };
    return { days: 30, statute: null };
  }
  if (noticeType === 'landlord_nonpayment') {
    return {
      days: law.eviction_notice_nonpayment_days,
      statute: law.statute_eviction ?? null,
    };
  }
  if (noticeType === 'landlord_lease_violation') {
    return {
      days: law.eviction_notice_other_breach_days,
      statute: law.statute_eviction ?? null,
    };
  }
  // landlord_no_renewal — use longer of nonpayment or other-breach notice; typically state
  // requires 30 days for no-renewal but we use eviction_notice_other_breach_days as proxy.
  // Many states (CA, OR) require 60-90 days for no-renewal on long-tenancies.
  // We use the max of the two available fields + bump to 30 days minimum.
  const days = Math.max(
    30,
    law.eviction_notice_other_breach_days,
    law.eviction_notice_nonpayment_days,
  );
  return { days, statute: law.statute_eviction ?? null };
}

/**
 * Validate that the proposed effective_date (ISO YYYY-MM-DD string) is at
 * least `requiredDays` calendar days from today.
 *
 * Returns { ok: true } or { ok: false, error: string }.
 */
export function validateEffectiveDate(
  effectiveDate: string,
  requiredDays: number,
  isMutual = false,
): { ok: boolean; error?: string; earliestAllowed?: string } {
  if (isMutual) return { ok: true };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const earliest = new Date(today);
  earliest.setDate(earliest.getDate() + requiredDays);
  const proposed = new Date(effectiveDate + 'T00:00:00');
  if (isNaN(proposed.getTime())) return { ok: false, error: 'effective_date is not a valid date (YYYY-MM-DD)' };
  if (proposed < earliest) {
    return {
      ok: false,
      error: `effective_date must be at least ${requiredDays} calendar day(s) from today. ` +
             `Earliest allowed: ${earliest.toISOString().slice(0, 10)}.`,
      earliestAllowed: earliest.toISOString().slice(0, 10),
    };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Rent-increase notice period and cap computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine how many days notice are required for a proposed rent increase.
 * When the state has a "large increase" threshold, a longer notice period applies.
 */
export function computeRentIncreaseNoticeDays(
  law: StateLawRow | null,
  currentRent: number,
  newRent: number,
): { noticeDays: number; isLargeIncrease: boolean; largeDays: number | null } {
  const baseDays = law?.rent_increase_notice_days ?? 30;
  const largeDays = law?.rent_increase_large_notice_days ?? null;
  const largeThresholdPct = law?.rent_increase_large_threshold_pct ?? null;

  let isLargeIncrease = false;
  if (largeDays != null && largeThresholdPct != null && currentRent > 0) {
    const pctIncrease = ((newRent - currentRent) / currentRent) * 100;
    if (pctIncrease > largeThresholdPct) isLargeIncrease = true;
  }

  const noticeDays = isLargeIncrease && largeDays != null ? largeDays : baseDays;
  return { noticeDays, isLargeIncrease, largeDays };
}

/**
 * Check whether a proposed rent increase is within state statutory caps.
 *
 * CA AB-1482 (Civil Code §1947.12): max 5% + local CPI or 10%, whichever is
 * less, for covered units. We enforce the 10% ceiling (since CPI+5% is always
 * ≤ 10%). Admins who need a higher value can pass override_cap_check=true and
 * document their reasoning externally.
 *
 * OR SB-608 (ORS 90.600): max 7% + CPI (total capped at 10%) per calendar year.
 * Same conservative 10% ceiling approach.
 *
 * Returns { ok: true } or { ok: false, error, capPct }.
 */
export function checkRentCap(
  law: StateLawRow | null,
  stateCode: string,
  currentRent: number,
  newRent: number,
): { ok: boolean; capPct?: number; error?: string } {
  const code = stateCode.toUpperCase();

  // CA AB-1482 — https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=201920200AB1482
  if (code === 'CA' && law?.just_cause_required) {
    const CAP = 10; // lesser of CPI+5% or 10%; we enforce 10% ceiling
    const pct = currentRent > 0 ? ((newRent - currentRent) / currentRent) * 100 : 0;
    if (pct > CAP + 0.001) {
      return {
        ok: false,
        capPct: CAP,
        error: `CA AB-1482 (Civil Code §1947.12) caps rent increases at the lesser of ` +
               `CPI+5% or 10% per 12-month period. The proposed increase of ` +
               `${pct.toFixed(2)}% exceeds the 10% absolute ceiling. ` +
               `Reduce the new rent or pass override_cap_check=true with documented justification.`,
      };
    }
  }

  // OR SB-608 — https://www.oregonlegislature.gov/bills_laws/ors/ors090.html
  if (code === 'OR' && law?.just_cause_required) {
    const CAP = 10; // 7% + CPI, statutory max ~10%
    const pct = currentRent > 0 ? ((newRent - currentRent) / currentRent) * 100 : 0;
    if (pct > CAP + 0.001) {
      return {
        ok: false,
        capPct: CAP,
        error: `OR SB-608 (ORS 90.600) caps rent increases at 7% + local CPI (total capped at ~10%) ` +
               `per calendar year. The proposed increase of ${pct.toFixed(2)}% exceeds the 10% ` +
               `absolute ceiling. Reduce the new rent or pass override_cap_check=true.`,
      };
    }
  }

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Simple notice PDF builder
// ─────────────────────────────────────────────────────────────────────────────

export interface NoticePDFSection {
  heading?: string;
  body: string;
}

export interface NoticePDFOptions {
  title: string;
  propertyAddress: string;
  tenantName: string;
  landlordName: string;
  stateCode: string;
  effectiveDate: string;
  sections: NoticePDFSection[];
  statuteCitations?: string[];
  footerLines?: string[];
  refNumber?: string;
}

/** Replace characters outside the Windows-1252 range that pdf-lib can't embed */
function sanitize(text: string): string {
  return text
    .replace(/[\u2500-\u257F]/g, '-')
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[^\x00-\xFF]/g, '?');
}

/** Word-wrap a single paragraph at maxWidth */
function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  font: import('npm:pdf-lib@1.17.1').PDFFont,
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (para.trim() === '') { lines.push(''); continue; }
    const words = para.split(' ');
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

/**
 * Build a clean letter-style PDF for notices and lifecycle documents.
 * Returns the raw PDF bytes.
 */
export async function buildNoticePDF(opts: NoticePDFOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fN = await doc.embedFont(StandardFonts.Helvetica);
  const fB = await doc.embedFont(StandardFonts.HelveticaBold);
  const fI = await doc.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 60;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const LINE = 13;  // standard body line height

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN + 30) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  function drawLine(text: string, size: number, font: import('npm:pdf-lib@1.17.1').PDFFont, gap = 2) {
    ensureSpace(size + gap);
    page.drawText(sanitize(text), { x: MARGIN, y: y - size, size, font, color: rgb(0, 0, 0) });
    y -= size + gap;
  }

  function drawWrapped(text: string, size: number, font: import('npm:pdf-lib@1.17.1').PDFFont, gap = 4) {
    for (const line of wrapText(sanitize(text), CONTENT_W, size, font)) {
      ensureSpace(size + gap);
      if (line) page.drawText(line, { x: MARGIN, y: y - size, size, font, color: rgb(0, 0, 0) });
      y -= size + gap;
    }
  }

  function gap(px: number) { y -= px; }

  function rule() {
    ensureSpace(12);
    page.drawLine({
      start: { x: MARGIN, y: y - 2 },
      end: { x: PAGE_W - MARGIN, y: y - 2 },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= 12;
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  drawLine('CHOICE PROPERTIES', 9, fB, 2);
  drawLine('Property Management', 9, fN, 6);
  rule();
  gap(6);

  // Title block
  drawLine(opts.title.toUpperCase(), 14, fB, 4);
  gap(4);

  // Meta table
  const metaRows: Array<[string, string]> = [
    ['Property:', opts.propertyAddress],
    ['Tenant:', opts.tenantName],
    ['Landlord / Manager:', opts.landlordName],
    ['Effective Date:', opts.effectiveDate],
    ['State:', opts.stateCode.toUpperCase()],
  ];
  if (opts.refNumber) metaRows.push(['Ref #:', opts.refNumber]);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  metaRows.push(['Date Issued:', today]);

  for (const [label, value] of metaRows) {
    ensureSpace(LINE);
    page.drawText(sanitize(label), { x: MARGIN, y: y - 10, size: 9, font: fB, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(sanitize(value || '—'), { x: MARGIN + 160, y: y - 10, size: 9, font: fN, color: rgb(0, 0, 0) });
    y -= LINE;
  }

  gap(10);
  rule();
  gap(8);

  // ── Body sections ──────────────────────────────────────────────────────────
  for (const section of opts.sections) {
    if (section.heading) {
      drawLine(section.heading, 10, fB, 3);
      gap(2);
    }
    drawWrapped(section.body, 10, fN, 3);
    gap(8);
  }

  // ── Statutory citations ─────────────────────────────────────────────────────
  if (opts.statuteCitations && opts.statuteCitations.length > 0) {
    gap(4);
    rule();
    drawLine('Statutory Reference(s)', 9, fB, 3);
    for (const cite of opts.statuteCitations) {
      drawWrapped('  ' + cite, 8, fI, 2);
    }
    gap(6);
  }

  // ── Footer / disclaimer ────────────────────────────────────────────────────
  gap(10);
  rule();
  drawWrapped(STANDARD_DISCLAIMER, 7.5, fI, 2);

  if (opts.footerLines) {
    gap(6);
    for (const fl of opts.footerLines) drawWrapped(fl, 8, fN, 2);
  }

  return doc.save();
}

/**
 * Compute a SHA-256 hex digest of arbitrary bytes.
 * Uses the Deno / Web Crypto API available in Supabase Edge Functions.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
