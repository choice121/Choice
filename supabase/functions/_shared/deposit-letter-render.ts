// ─────────────────────────────────────────────────────────────────────
// deposit-letter-render.ts — Phase 09 chunk 2/5
//
// Renders a state-compliant security-deposit accounting letter into a
// versioned PDF. Layout:
//
//   • Page 1: cover (property address, parties, return-deadline notice
//     with state statute reference, totals summary).
//   • Letter body: state-specific letter text — chunk 2 ships a generic
//     fallback inline; chunk 3 will seed per-state partials in
//     lease_template_partials under slugs `deposit-letter/{STATE}` and
//     this renderer will pick them up automatically.
//   • Itemized deductions table: every lease_deposit_deductions row
//     with category, description, amount; subtotal, refund-owed, and
//     interest-accrued footer.
//   • Photo evidence pages: up to 4 thumbnails per deduction, embedded
//     from the lease-inspection-photos bucket.
//   • Final page: tenant dispute instructions (state-specific objection
//     window for FL, etc.) + integrity footer (UTC generation timestamp,
//     accounting_id, SHA-256 placeholder filled in by caller).
//
// Photos are pulled via the service-role supabase client passed in by
// the edge function. Any fetch / decode failure is logged and the slot
// is rendered as a placeholder rectangle — never fatal.
//
// EXPORT SURFACE:
//   buildDepositLetterPDF(args) -> { bytes, page_count, photos_embedded, photos_failed }
// ─────────────────────────────────────────────────────────────────────

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFImage,
} from 'npm:pdf-lib@1.17.1';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { renderTemplate, createSupabasePartialResolver } from './template-engine.ts';

// ── Types ────────────────────────────────────────────────────────────

export interface DepositDeduction {
  id?:                      string;
  category:                 'rent_arrears'|'cleaning'|'damages'|'unpaid_utilities'|'early_termination'|'other';
  description:              string;
  amount:                   number;
  inspection_id?:           string | null;
  supporting_photo_paths?:  string[];
  receipt_paths?:           string[];
  sort_order?:              number;
}

export interface DepositAccountingPDFArgs {
  supabase:                  SupabaseClient;
  accounting_id:             string;
  app: {
    id:                      string;
    app_id?:                 string | null;
    first_name?:             string | null;
    last_name?:              string | null;
    email?:                  string | null;
    property_address?:       string | null;
    city?:                   string | null;
    state?:                  string | null;
    zip?:                    string | null;
    move_in_date_actual?:    string | null;
    move_out_date_actual?:   string | null;
    lease_state_code?:       string | null;
    security_deposit?:       number | null;
    pet_deposit?:            number | null;
    key_deposit?:            number | null;
  };
  state_law: {
    state_code:                            string;
    security_deposit_return_days:          number;
    statute_security_deposit?:             string | null;
    security_deposit_interest_required?:   boolean | null;
    notes?:                                string | null;
  };
  totals: {
    total_deposit_held:       number;
    amount_withheld:          number;
    refund_owed_to_tenant:    number;
    interest_accrued:         number;
  };
  deadlines: {
    move_out_date:            string;       // ISO YYYY-MM-DD
    state_return_deadline:    string;       // ISO YYYY-MM-DD
    late_generated:           boolean;
  };
  deductions:                 DepositDeduction[];
  landlord_name?:             string;
  generated_at_iso:           string;       // YYYY-MM-DDTHH:MM:SSZ
  photo_bucket?:              string;       // default 'lease-inspection-photos'
}

export interface DepositLetterPDFResult {
  bytes:               Uint8Array;
  page_count:          number;
  photos_embedded:     number;
  photos_failed:       number;
}

// ── Layout constants (US Letter, 0.75" margins) ──────────────────────

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const COL = {
  ink:        rgb(0.07, 0.09, 0.13),
  body:       rgb(0.18, 0.20, 0.27),
  muted:      rgb(0.42, 0.46, 0.55),
  rule:       rgb(0.80, 0.82, 0.88),
  ruleSoft:   rgb(0.90, 0.92, 0.96),
  band:       rgb(0.96, 0.97, 0.99),
  warn:       rgb(0.95, 0.40, 0.18),
  warnBg:     rgb(0.99, 0.95, 0.91),
  ok:         rgb(0.06, 0.50, 0.34),
  accent:     rgb(0.10, 0.30, 0.60),
};

// ── Utilities ────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  const v = Number.isFinite(Number(n)) ? Number(n) : 0;
  return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  } catch { return iso; }
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch { return iso; }
}

function categoryLabel(c: string): string {
  return ({
    rent_arrears:      'Unpaid rent',
    cleaning:          'Cleaning',
    damages:           'Property damage',
    unpaid_utilities:  'Unpaid utilities',
    early_termination: 'Early-termination charges',
    other:             'Other',
  } as Record<string,string>)[c] || c;
}

// pdf-lib's WinAnsi font cannot encode non-Latin-1 characters. Coerce
// any text we draw to safe fallbacks so the whole document renders.
function toAnsi(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[\u2022]/g, '*')
    .replace(/[\u2264]/g, '<=')
    .replace(/[\u2265]/g, '>=')
    .replace(/[\u00A7]/g, 'Sec.')
    .replace(/[^\x20-\x7E\n]/g, '?');
}

// Word-wrap a string to fit a width given the font + size.
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  const paragraphs = toAnsi(text).split(/\r?\n/);
  for (const para of paragraphs) {
    if (!para.trim()) { out.push(''); continue; }
    const words = para.split(/\s+/);
    let line = '';
    for (const w of words) {
      const tryLine = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(tryLine, size) > maxW && line) {
        out.push(line);
        line = w;
      } else {
        line = tryLine;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

// Strip data: URL prefix and base64-decode (none used here, but kept for
// signature image symmetry with inspection-pdf.ts).
function decodeBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── State-specific dispute instructions (chunk 2 fallback) ───────────
//
// These mirror what chunk 3 will move into lease_template_partials
// (slug = 'deposit-letter-dispute/{STATE}'). Until those land, the
// renderer uses these so even unseeded states get correct legal text.

const DISPUTE_TEXT: Record<string, string> = {
  CA: 'You may dispute any deduction within a reasonable time. Civil Code Sec.1950.5(g) requires the landlord to provide receipts for any single deduction exceeding $125. If you do not receive receipts attached or available on request, you may demand them in writing.',
  FL: 'Notice of Intention to Impose Claim on Security Deposit: under Florida Statute Sec.83.49(3), you have FIFTEEN (15) DAYS from the date of this notice to object in writing. If you do not object within 15 days, the landlord may withhold the amounts claimed. Send any objection in writing by certified mail to the address shown above.',
  MA: 'This itemized list is sworn under the penalties of perjury per M.G.L. ch. 186 Sec.15B. If the landlord fails to comply with the statute, you may be entitled to recover three (3) times the amount wrongfully withheld plus interest, costs, and reasonable attorneys\' fees.',
  NJ: 'Per the Truth-in-Renting Act and N.J.S.A. 46:8-21.1, the landlord must return any unused portion of the security deposit, with interest, within thirty (30) days of lease termination. Any wrongful retention may result in liability for double the amount withheld plus court costs and attorneys\' fees.',
  TX: 'Per Texas Property Code Sec.92.103-92.109, the landlord must furnish this written description and itemized list of deductions within thirty (30) days of surrender. If you believe the deductions are not in good faith you may bring an action to recover three times the amount wrongfully withheld plus $100 and reasonable attorneys\' fees.',
  NY: 'Per N.Y. General Obligations Law Sec.7-108, you may inspect the premises and dispute any deduction. The landlord must provide an itemized statement of damages within fourteen (14) days of vacating.',
  IL: 'Per the Illinois Security Deposit Return Act (765 ILCS 710), you may dispute the deductions. If the landlord fails to comply with the Act, you may recover damages equal to two times the amount of the deposit plus court costs and reasonable attorneys\' fees.',
  GA: 'Per O.C.G.A. Sec.44-7-34 and Sec.44-7-35, you may dispute the deductions in writing. If the landlord fails to comply with the statute, you may be entitled to three times the amount wrongfully withheld.',
  OH: 'Per Ohio Revised Code Sec.5321.16, you may dispute these deductions. If the landlord wrongfully withholds any portion of the deposit, you may recover damages equal to the amount wrongfully withheld plus reasonable attorneys\' fees.',
  MI: 'Per the Michigan Security Deposits Act (MCL Sec.554.609), you have seven (7) days from receipt of this list to respond in writing if you disagree with any of the damages claimed. Failure to respond may waive certain rights.',
};

const GENERIC_DISPUTE = 'You have the right to dispute any deduction listed above by sending a written objection to the landlord at the address shown on this letter. Please send any objection promptly so that the landlord can review and respond. Keep a copy for your records. If the parties cannot agree, you may pursue the matter in your local small-claims court.';

function disputeText(stateCode: string): string {
  return DISPUTE_TEXT[stateCode] || GENERIC_DISPUTE;
}

// Generic letter body used when no per-state partial is seeded yet.
const GENERIC_BODY = `Dear {{tenant_name}},

This letter constitutes the itemized accounting of your security deposit for the residential lease at {{property_address}}.

Lease term: {{move_in_date_long}} through {{move_out_date_long}}.

Total security deposit held by landlord:    {{total_deposit_held}}
Total deductions itemized below:            {{amount_withheld}}
Interest accrued (where required by law):  {{interest_accrued}}
                                            -------------
NET REFUND OWED TO TENANT:                  {{refund_owed_to_tenant}}

Per the laws of the State of {{state_code}} ({{statute}}), the landlord must return any unused portion of the deposit within {{return_days}} days of the date you surrendered the premises. The deadline for this letter and the refund (if any) is {{return_deadline_long}}.

Each deduction is itemized on the following page along with supporting evidence where available. Please review the deductions and the dispute instructions on the final page.

Sincerely,
{{landlord_name}}
`;

// ── Page-level drawing primitives ────────────────────────────────────

function newPage(doc: PDFDocument): { page: PDFPage; y: number } {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  return { page, y: PAGE_H - MARGIN };
}

function ensureSpace(doc: PDFDocument, page: PDFPage, y: number, needed: number): { page: PDFPage; y: number } {
  if (y - needed < MARGIN + 36) {
    return newPage(doc);
  }
  return { page, y };
}

function drawHeader(page: PDFPage, fontBold: PDFFont, font: PDFFont, args: DepositAccountingPDFArgs) {
  const top = PAGE_H - MARGIN + 8;
  page.drawText(toAnsi('SECURITY DEPOSIT ACCOUNTING'), {
    x: MARGIN, y: top, size: 9, font: fontBold, color: COL.muted,
  });
  const right = toAnsi(`Acct ${args.accounting_id.slice(0, 8)} - ${fmtDateShort(args.generated_at_iso)}`);
  const w = font.widthOfTextAtSize(right, 9);
  page.drawText(right, { x: PAGE_W - MARGIN - w, y: top, size: 9, font, color: COL.muted });
  page.drawLine({
    start: { x: MARGIN, y: top - 4 }, end: { x: PAGE_W - MARGIN, y: top - 4 },
    thickness: 0.5, color: COL.ruleSoft,
  });
}

function drawFooter(page: PDFPage, font: PDFFont, args: DepositAccountingPDFArgs, pageNum: number, totalPages: number) {
  const y = MARGIN - 30;
  page.drawLine({
    start: { x: MARGIN, y: y + 14 }, end: { x: PAGE_W - MARGIN, y: y + 14 },
    thickness: 0.5, color: COL.ruleSoft,
  });
  const left = toAnsi(`Choice Properties - Security Deposit Accounting Letter`);
  page.drawText(left, { x: MARGIN, y, size: 8, font, color: COL.muted });
  const right = toAnsi(`Page ${pageNum} of ${totalPages}`);
  const w = font.widthOfTextAtSize(right, 8);
  page.drawText(right, { x: PAGE_W - MARGIN - w, y, size: 8, font, color: COL.muted });
}

// ── Main entry ───────────────────────────────────────────────────────

export async function buildDepositLetterPDF(args: DepositAccountingPDFArgs): Promise<DepositLetterPDFResult> {
  const doc = await PDFDocument.create();
  doc.setTitle('Security Deposit Accounting Letter');
  doc.setProducer('Choice Properties');
  doc.setCreator('Choice Properties Lease Subsystem - Phase 09');
  doc.setCreationDate(new Date(args.generated_at_iso));

  const font     = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontIt   = await doc.embedFont(StandardFonts.HelveticaOblique);

  let photos_embedded = 0;
  let photos_failed   = 0;

  // ── 1. Cover page ────────────────────────────────────────────────
  let { page, y } = newPage(doc);
  drawHeader(page, fontBold, font, args);

  // Title
  y -= 14;
  page.drawText(toAnsi('Security Deposit Accounting'), {
    x: MARGIN, y: y - 22, size: 22, font: fontBold, color: COL.ink,
  });
  y -= 38;
  page.drawText(toAnsi('Itemized statement and refund accounting'), {
    x: MARGIN, y: y - 12, size: 11, font: fontIt, color: COL.muted,
  });
  y -= 30;

  // Late-generated banner (Phase 9 acceptance criterion #5)
  if (args.deadlines.late_generated) {
    const bannerH = 44;
    page.drawRectangle({
      x: MARGIN, y: y - bannerH, width: CONTENT_W, height: bannerH,
      color: COL.warnBg, borderColor: COL.warn, borderWidth: 1.2,
    });
    page.drawText(toAnsi('GENERATED PAST STATUTORY DEADLINE'), {
      x: MARGIN + 12, y: y - 18, size: 10, font: fontBold, color: COL.warn,
    });
    const sub = toAnsi(`State return deadline was ${fmtDateLong(args.deadlines.state_return_deadline)}; this letter was generated on ${fmtDateLong(args.generated_at_iso)}.`);
    const subLines = wrap(sub, font, 8.5, CONTENT_W - 24);
    let yy = y - 30;
    for (const line of subLines) {
      page.drawText(line, { x: MARGIN + 12, y: yy, size: 8.5, font, color: COL.warn });
      yy -= 11;
    }
    y -= bannerH + 14;
  }

  // Property + parties block
  const tenantName = toAnsi(`${args.app.first_name || ''} ${args.app.last_name || ''}`.trim() || 'Tenant');
  const propAddr = toAnsi([args.app.property_address, args.app.city, args.app.state, args.app.zip]
    .filter(Boolean).join(', ') || '—');
  const rows: Array<[string, string]> = [
    ['Property',          propAddr],
    ['Tenant',            tenantName + (args.app.email ? `  (${toAnsi(args.app.email)})` : '')],
    ['Move-in date',      fmtDateLong(args.app.move_in_date_actual)],
    ['Move-out date',     fmtDateLong(args.deadlines.move_out_date)],
    ['State of premises', `${args.state_law.state_code}` +
      (args.state_law.statute_security_deposit ? `   ${toAnsi(args.state_law.statute_security_deposit)}` : '')],
    ['Return window',     `${args.state_law.security_deposit_return_days} days from move-out`],
    ['Return deadline',   fmtDateLong(args.deadlines.state_return_deadline)],
    ['Letter generated',  fmtDateLong(args.generated_at_iso) + (args.deadlines.late_generated ? '  (LATE)' : '')],
  ];
  for (const [label, value] of rows) {
    page.drawText(toAnsi(label.toUpperCase()), { x: MARGIN, y, size: 7.5, font: fontBold, color: COL.muted });
    const valueLines = wrap(value, font, 10.5, CONTENT_W - 130);
    let yy = y;
    for (const line of valueLines) {
      page.drawText(line, { x: MARGIN + 130, y: yy, size: 10.5, font, color: COL.ink });
      yy -= 13;
    }
    y = Math.min(y - 13, yy);
    page.drawLine({
      start: { x: MARGIN, y: y + 2 }, end: { x: PAGE_W - MARGIN, y: y + 2 },
      thickness: 0.4, color: COL.ruleSoft,
    });
    y -= 4;
  }

  // Totals summary box
  y -= 10;
  const boxH = 92;
  page.drawRectangle({
    x: MARGIN, y: y - boxH, width: CONTENT_W, height: boxH,
    color: COL.band, borderColor: COL.rule, borderWidth: 0.6,
  });
  const totals = args.totals;
  const totalRows: Array<[string, number, boolean]> = [
    ['Total deposit held',                  totals.total_deposit_held,    false],
    ['Itemized deductions (page 2)',        -totals.amount_withheld,       false],
    ['Interest accrued',                    totals.interest_accrued,      false],
    ['Net refund owed to tenant',           totals.refund_owed_to_tenant, true],
  ];
  let ty = y - 18;
  for (const [label, amt, emph] of totalRows) {
    const f  = emph ? fontBold : font;
    const sz = emph ? 12.5    : 11;
    const col = emph ? COL.ink : COL.body;
    page.drawText(toAnsi(label), { x: MARGIN + 14, y: ty, size: sz, font: f, color: col });
    const amtStr = (amt < 0 ? '-' : '') + fmtMoney(Math.abs(amt));
    const w = f.widthOfTextAtSize(amtStr, sz);
    page.drawText(amtStr, {
      x: PAGE_W - MARGIN - 14 - w, y: ty, size: sz, font: f,
      color: emph ? (totals.refund_owed_to_tenant > 0 ? COL.ok : COL.warn) : COL.body,
    });
    ty -= emph ? 22 : 18;
  }
  y -= boxH + 10;

  // ── 2. Letter body ───────────────────────────────────────────────
  // Try a per-state partial first (chunk 3 will seed these); fall back
  // to the embedded generic body so chunk 2 stands alone.
  const partials = createSupabasePartialResolver(args.supabase);
  const stateCode = args.state_law.state_code;
  const tplCtx = {
    tenant_name:           tenantName,
    property_address:      propAddr,
    state_code:            stateCode,
    statute:               args.state_law.statute_security_deposit || '',
    return_days:           String(args.state_law.security_deposit_return_days),
    return_deadline_long:  fmtDateLong(args.deadlines.state_return_deadline),
    move_in_date_long:     fmtDateLong(args.app.move_in_date_actual),
    move_out_date_long:    fmtDateLong(args.deadlines.move_out_date),
    total_deposit_held:    fmtMoney(totals.total_deposit_held),
    amount_withheld:       fmtMoney(totals.amount_withheld),
    refund_owed_to_tenant: fmtMoney(totals.refund_owed_to_tenant),
    interest_accrued:      fmtMoney(totals.interest_accrued),
    landlord_name:         args.landlord_name || 'Choice Properties',
    generated_date_long:   fmtDateLong(args.generated_at_iso),
  };
  let letterBody = GENERIC_BODY;
  try {
    const stateTpl = await partials(`deposit-letter/${stateCode}`);
    if (stateTpl && stateTpl.trim().length > 40) letterBody = stateTpl;
  } catch (e) {
    console.warn('[deposit-letter] partial lookup failed:', (e as Error).message);
  }
  let renderedBody: string;
  try {
    renderedBody = await renderTemplate(letterBody, tplCtx, { partials });
  } catch (e) {
    console.warn('[deposit-letter] template render failed, using raw fallback:', (e as Error).message);
    renderedBody = letterBody.replace(/\{\{(\w+)\}\}/g, (_, k) => (tplCtx as any)[k] ?? '');
  }

  // Page 2: letter body
  ({ page, y } = newPage(doc));
  drawHeader(page, fontBold, font, args);
  y -= 12;
  page.drawText(toAnsi('LETTER'), { x: MARGIN, y: y - 12, size: 10, font: fontBold, color: COL.accent });
  y -= 24;
  const bodyLines = wrap(renderedBody, font, 10.5, CONTENT_W);
  for (const line of bodyLines) {
    if (y < MARGIN + 50) {
      ({ page, y } = newPage(doc));
      drawHeader(page, fontBold, font, args);
      y -= 12;
    }
    page.drawText(line, { x: MARGIN, y: y - 11, size: 10.5, font, color: COL.body });
    y -= 13.5;
  }

  // ── 3. Itemized deductions table ─────────────────────────────────
  ({ page, y } = newPage(doc));
  drawHeader(page, fontBold, font, args);
  y -= 12;
  page.drawText(toAnsi('ITEMIZED DEDUCTIONS'), { x: MARGIN, y: y - 12, size: 10, font: fontBold, color: COL.accent });
  y -= 26;

  const colX = {
    cat:    MARGIN,
    desc:   MARGIN + 110,
    amt:    PAGE_W - MARGIN - 80,
  };
  page.drawText('CATEGORY',   { x: colX.cat,  y, size: 8, font: fontBold, color: COL.muted });
  page.drawText('DESCRIPTION',{ x: colX.desc, y, size: 8, font: fontBold, color: COL.muted });
  page.drawText('AMOUNT',     { x: colX.amt,  y, size: 8, font: fontBold, color: COL.muted });
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: COL.rule });
  y -= 10;

  const sorted = [...args.deductions].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (!sorted.length) {
    page.drawText(toAnsi('(no deductions - full deposit refunded)'), {
      x: colX.cat, y: y - 12, size: 10, font: fontIt, color: COL.muted,
    });
    y -= 18;
  } else {
    for (const d of sorted) {
      const descLines = wrap(d.description, font, 10, colX.amt - colX.desc - 8);
      const rowH = Math.max(16, descLines.length * 12 + 6);
      ({ page, y } = ensureSpace(doc, page, y, rowH + 4));
      // Category
      page.drawText(toAnsi(categoryLabel(d.category)), { x: colX.cat, y: y - 11, size: 10, font: fontBold, color: COL.ink });
      // Description (multi-line)
      let dy = y - 11;
      for (const line of descLines) {
        page.drawText(line, { x: colX.desc, y: dy, size: 10, font, color: COL.body });
        dy -= 12;
      }
      // Amount
      const amtStr = fmtMoney(d.amount);
      const w = fontBold.widthOfTextAtSize(amtStr, 10);
      page.drawText(amtStr, { x: PAGE_W - MARGIN - w, y: y - 11, size: 10, font: fontBold, color: COL.ink });
      // Evidence note
      if (d.supporting_photo_paths?.length || d.receipt_paths?.length) {
        const evNote = `Evidence: ${d.supporting_photo_paths?.length || 0} photo(s), ${d.receipt_paths?.length || 0} receipt(s)`;
        page.drawText(toAnsi(evNote), { x: colX.desc, y: dy, size: 8, font: fontIt, color: COL.muted });
        dy -= 11;
      }
      y -= rowH;
      page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: PAGE_W - MARGIN, y: y + 2 }, thickness: 0.3, color: COL.ruleSoft });
      y -= 6;
    }

    // Totals row
    ({ page, y } = ensureSpace(doc, page, y, 56));
    page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: PAGE_W - MARGIN, y: y + 2 }, thickness: 0.8, color: COL.ink });
    y -= 8;
    page.drawText(toAnsi('TOTAL DEDUCTIONS'), { x: colX.desc, y: y - 11, size: 11, font: fontBold, color: COL.ink });
    const totStr = fmtMoney(totals.amount_withheld);
    const totW = fontBold.widthOfTextAtSize(totStr, 11);
    page.drawText(totStr, { x: PAGE_W - MARGIN - totW, y: y - 11, size: 11, font: fontBold, color: COL.ink });
    y -= 18;

    page.drawText(toAnsi('Refund owed to tenant'), { x: colX.desc, y: y - 11, size: 11, font: fontBold, color: COL.ok });
    const refStr = fmtMoney(totals.refund_owed_to_tenant);
    const refW = fontBold.widthOfTextAtSize(refStr, 11);
    page.drawText(refStr, {
      x: PAGE_W - MARGIN - refW, y: y - 11, size: 11, font: fontBold,
      color: totals.refund_owed_to_tenant > 0 ? COL.ok : COL.warn,
    });
    y -= 22;
  }

  // ── 4. Photo evidence pages ──────────────────────────────────────
  // Up to 4 thumbs per deduction, 2 cols x 2 rows. We add a fresh page
  // when needed. Failures are logged + drawn as placeholders.
  const photoBucket = args.photo_bucket || 'lease-inspection-photos';
  const dedsWithPhotos = sorted.filter(d => (d.supporting_photo_paths?.length || 0) > 0);
  if (dedsWithPhotos.length) {
    ({ page, y } = newPage(doc));
    drawHeader(page, fontBold, font, args);
    y -= 12;
    page.drawText(toAnsi('PHOTO EVIDENCE'), { x: MARGIN, y: y - 12, size: 10, font: fontBold, color: COL.accent });
    y -= 24;

    for (const d of dedsWithPhotos) {
      const paths = (d.supporting_photo_paths || []).slice(0, 4);
      if (!paths.length) continue;
      ({ page, y } = ensureSpace(doc, page, y, 250));
      page.drawText(toAnsi(`${categoryLabel(d.category)}: ${d.description}`), {
        x: MARGIN, y: y - 11, size: 10, font: fontBold, color: COL.ink,
      });
      y -= 18;
      const thumbW = (CONTENT_W - 12) / 2;
      const thumbH = 110;
      for (let i = 0; i < paths.length; i++) {
        const col = i % 2, row = Math.floor(i / 2);
        const tx = MARGIN + col * (thumbW + 12);
        const ty = y - (row * (thumbH + 8)) - thumbH;
        let img: PDFImage | null = null;
        try {
          const { data, error } = await args.supabase.storage.from(photoBucket).download(paths[i]);
          if (error || !data) throw error || new Error('no data');
          const buf = new Uint8Array(await data.arrayBuffer());
          // Detect JPEG vs PNG by magic bytes
          if (buf[0] === 0xFF && buf[1] === 0xD8) img = await doc.embedJpg(buf);
          else if (buf[0] === 0x89 && buf[1] === 0x50) img = await doc.embedPng(buf);
          else throw new Error('unknown image format');
        } catch (e) {
          console.warn(`[deposit-letter] photo embed failed (${paths[i]}):`, (e as Error).message);
          photos_failed++;
        }
        if (img) {
          const dims = img.scaleToFit(thumbW, thumbH);
          page.drawImage(img, { x: tx + (thumbW - dims.width) / 2, y: ty + (thumbH - dims.height) / 2, width: dims.width, height: dims.height });
          page.drawRectangle({ x: tx, y: ty, width: thumbW, height: thumbH, borderColor: COL.rule, borderWidth: 0.5 });
          photos_embedded++;
        } else {
          page.drawRectangle({ x: tx, y: ty, width: thumbW, height: thumbH, color: COL.band, borderColor: COL.rule, borderWidth: 0.5 });
          page.drawText(toAnsi('photo unavailable'), {
            x: tx + 8, y: ty + thumbH / 2, size: 9, font: fontIt, color: COL.muted,
          });
        }
      }
      const usedRows = Math.ceil(paths.length / 2);
      y -= usedRows * (thumbH + 8) + 14;
    }
  }

  // ── 5. Final page: dispute instructions + integrity footer ───────
  ({ page, y } = newPage(doc));
  drawHeader(page, fontBold, font, args);
  y -= 12;
  page.drawText(toAnsi('YOUR RIGHT TO DISPUTE'), { x: MARGIN, y: y - 12, size: 10, font: fontBold, color: COL.accent });
  y -= 24;

  const dispute = disputeText(stateCode);
  const dLines = wrap(dispute, font, 10.5, CONTENT_W);
  for (const line of dLines) {
    ({ page, y } = ensureSpace(doc, page, y, 14));
    page.drawText(line, { x: MARGIN, y: y - 11, size: 10.5, font, color: COL.body });
    y -= 13.5;
  }

  y -= 18;
  page.drawText(toAnsi('How to submit a dispute'), { x: MARGIN, y: y - 11, size: 10, font: fontBold, color: COL.ink });
  y -= 16;
  const howLines = wrap(
    'Log in to the tenant portal at choiceproperties.com/tenant and open the security deposit page; ' +
    'use the "Dispute" button to submit your written objection. Your dispute will be recorded with a ' +
    'timestamp and reviewed by the property manager. You may also send a written objection by certified ' +
    'mail to the property management address shown on this letter. Keep a copy of any correspondence ' +
    'for your records.',
    font, 10.5, CONTENT_W,
  );
  for (const line of howLines) {
    ({ page, y } = ensureSpace(doc, page, y, 14));
    page.drawText(line, { x: MARGIN, y: y - 11, size: 10.5, font, color: COL.body });
    y -= 13.5;
  }

  // Integrity footer block
  y -= 24;
  ({ page, y } = ensureSpace(doc, page, y, 80));
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: COL.rule });
  y -= 14;
  page.drawText(toAnsi('DOCUMENT INTEGRITY'), { x: MARGIN, y, size: 8, font: fontBold, color: COL.muted });
  y -= 14;
  const intRows: Array<[string, string]> = [
    ['Generated (UTC)',  toAnsi(args.generated_at_iso)],
    ['Accounting ID',    toAnsi(args.accounting_id)],
    ['Application ID',   toAnsi(args.app.app_id || args.app.id)],
    ['SHA-256',          '(computed by service after render)'],
    ['Document type',    'Security Deposit Accounting Letter (Phase 09)'],
  ];
  for (const [k, v] of intRows) {
    page.drawText(k, { x: MARGIN, y, size: 8.5, font: fontBold, color: COL.muted });
    page.drawText(v, { x: MARGIN + 110, y, size: 8.5, font, color: COL.body });
    y -= 12;
  }

  // ── 6. Footers (page numbers) ────────────────────────────────────
  const pages = doc.getPages();
  pages.forEach((p, i) => drawFooter(p, font, args, i + 1, pages.length));

  const bytes = await doc.save();
  return {
    bytes,
    page_count: pages.length,
    photos_embedded,
    photos_failed,
  };
}
