// ============================================================
// Choice Properties — _shared/plain-summary.ts
//
// Phase 12 — Plain-language "at-a-glance" cover page for leases.
//
// buildPlainLanguageSummaryBytes(app, locale)
//   Produces a single-page PDF with a human-readable summary of
//   the key lease terms, formatted for a non-legal reader.
//   Returns raw Uint8Array bytes for that one page.
//
// prependSummaryPage(mainPdfBytes, app, locale?)
//   Creates the summary page and copies it in as page 1 of the
//   supplied PDF.  Uses pdf-lib copy-pages so all existing content
//   (body + cert) shifts to pages 2-N.
// ============================================================

import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { resolveLocale, type Locale } from './i18n.ts';

// ----- helpers ----------------------------------------------------------

function fmt(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

function fmtMoney(v: unknown): string {
  const n = Number(v);
  if (!v || isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: unknown): string {
  if (!d) return '—';
  try {
    return new Date(d as string).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return String(d);
  }
}

// ----- i18n (self-contained so the PDF can render without the full i18n module) ---

const SUMMARY_STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    title:         'Lease at a Glance',
    subtitle:      'Plain-Language Summary — this is not a substitute for the full agreement',
    monthly_rent:  'Monthly Rent',
    property:      'Property',
    lease_term:    'Lease Term',
    term_arrow:    'to',
    deposit:       'Security Deposit',
    tenant:        'Tenant(s)',
    notice_label:  'Notice to Vacate',
    notice_body:   "Written notice is required to end the tenancy. Review the full agreement for the exact number of days required under your state's law.",
    late_label:    'Late Fees',
    late_body:     'A late fee may apply if rent is not received by the date specified in the lease. Check the full agreement for the exact grace period and fee amount.',
    pets_label:    'Pets',
    pets_body:     "Any pet must be pre-approved in writing. Unauthorized pets may result in additional fees or lease termination. Review the addenda for your property's pet policy.",
    footer:        'This summary is provided as a convenience. The full lease agreement on the following pages is the legally binding document. If you have questions, contact us before signing.',
    brand:         'Choice Properties · 2265 Livernois Suite 500, Troy MI 48083 · 707-706-3137',
  },
  es: {
    title:         'Resumen de Su Contrato',
    subtitle:      'Resumen en lenguaje sencillo — esto no sustituye al contrato completo',
    monthly_rent:  'Renta Mensual',
    property:      'Propiedad',
    lease_term:    'Período de Arrendamiento',
    term_arrow:    'hasta',
    deposit:       'Depósito de Seguridad',
    tenant:        'Inquilino(s)',
    notice_label:  'Aviso de Desalojo',
    notice_body:   'Se requiere aviso por escrito para terminar el arrendamiento. Consulte el contrato completo para el número exacto de días requeridos por la ley de su estado.',
    late_label:    'Cargos por Mora',
    late_body:     'Puede aplicarse un cargo por mora si la renta no se recibe en la fecha especificada en el contrato. Consulte el contrato completo para el período de gracia y el monto del cargo.',
    pets_label:    'Mascotas',
    pets_body:     'Toda mascota debe ser pre-aprobada por escrito. Las mascotas no autorizadas pueden resultar en cargos adicionales o terminación del contrato. Consulte los adendos para la política de mascotas de su propiedad.',
    footer:        'Este resumen se proporciona como conveniencia. El contrato de arrendamiento completo en las páginas siguientes es el documento legalmente vinculante. Si tiene preguntas, contáctenos antes de firmar.',
    brand:         'Choice Properties · 2265 Livernois Suite 500, Troy MI 48083 · 707-706-3137',
  },
};

function s(locale: Locale, key: string): string {
  return SUMMARY_STRINGS[locale]?.[key] ?? SUMMARY_STRINGS.en[key] ?? key;
}

// ----- PDF builder -------------------------------------------------------

const BLUE   = rgb(0.11, 0.30, 0.85);
const DKBLUE = rgb(0.07, 0.20, 0.60);
const DGRAY  = rgb(0.20, 0.25, 0.30);
const LGRAY  = rgb(0.55, 0.60, 0.65);
const WHITE  = rgb(1, 1, 1);
const PANEL  = rgb(0.95, 0.97, 1.00);
const BORDER = rgb(0.82, 0.87, 0.94);

/**
 * Build a single-page plain-language summary PDF for the given app.
 */
export async function buildPlainLanguageSummaryBytes(
  app: Record<string, unknown>,
  locale: Locale = 'en',
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const [bold, regular, italic] = await Promise.all([
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaOblique),
  ]);

  const W = 612, H = 792;
  const page = doc.addPage([W, H]);
  const L = 48, R = W - 48, TW = R - L;

  let y = H - 36;

  // ---- header bar --------------------------------------------------------
  page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: BLUE });
  page.drawText('CP', {
    x: L, y: H - 52, size: 20, font: bold, color: WHITE,
  });
  page.drawText(s(locale, 'title'), {
    x: L + 32, y: H - 45, size: 15, font: bold, color: WHITE,
  });
  page.drawText(s(locale, 'subtitle'), {
    x: L + 32, y: H - 61, size: 7.5, font: regular, color: rgb(0.80, 0.88, 1.0),
  });

  y = H - 90;

  // ---- rent hero ---------------------------------------------------------
  const rent = fmtMoney(app.monthly_rent);
  page.drawRectangle({ x: L, y: y - 52, width: TW, height: 60, color: PANEL, borderColor: BORDER, borderWidth: 0.5 });
  page.drawText(s(locale, 'monthly_rent').toUpperCase(), {
    x: L + 14, y: y - 12, size: 7, font: bold, color: LGRAY,
  });
  page.drawText(rent, {
    x: L + 14, y: y - 38, size: 28, font: bold, color: DKBLUE,
  });
  y -= 72;

  // ---- key-term grid -----------------------------------------------------
  function drawField(label: string, value: string, fx: number, fy: number, fw: number) {
    page.drawRectangle({ x: fx, y: fy - 40, width: fw, height: 48, color: PANEL, borderColor: BORDER, borderWidth: 0.5 });
    page.drawText(label.toUpperCase(), { x: fx + 10, y: fy - 10, size: 6.5, font: bold, color: LGRAY });
    // wrap value to fit
    const words = value.split(' ');
    let line = '';
    let lineY = fy - 26;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (regular.widthOfTextAtSize(test, 9.5) > fw - 20 && line) {
        page.drawText(line, { x: fx + 10, y: lineY, size: 9.5, font: bold, color: DGRAY });
        lineY -= 12;
        line = w;
      } else {
        line = test;
      }
    }
    if (line) page.drawText(line, { x: fx + 10, y: lineY, size: 9.5, font: bold, color: DGRAY });
  }

  const halfW = (TW - 10) / 2;
  drawField(s(locale, 'property'), fmt(app.property_address), L, y, TW);
  y -= 60;
  drawField(s(locale, 'tenant'),
    `${fmt(app.first_name)} ${fmt(app.last_name)}`.trim() || '—',
    L, y, halfW);
  drawField(s(locale, 'deposit'), fmtMoney(app.security_deposit), L + halfW + 10, y, halfW);
  y -= 60;
  const termVal = `${fmtDate(app.lease_start_date)} ${s(locale, 'term_arrow')} ${fmtDate(app.lease_end_date)}`;
  drawField(s(locale, 'lease_term'), termVal, L, y, TW);
  y -= 60;

  // ---- divider -----------------------------------------------------------
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: BORDER });
  y -= 18;

  // ---- plain-language notices --------------------------------------------
  function drawNotice(label: string, body: string, ny: number): number {
    const ICON_R = 8;
    page.drawCircle({ x: L + ICON_R, y: ny - ICON_R, size: ICON_R, color: BLUE });
    page.drawText('i', { x: L + ICON_R - 2, y: ny - ICON_R - 4, size: 9, font: bold, color: WHITE });

    page.drawText(label, { x: L + ICON_R * 2 + 8, y: ny - 5, size: 9, font: bold, color: DGRAY });

    const BODY_X = L + ICON_R * 2 + 8;
    const BODY_W = TW - ICON_R * 2 - 10;
    const words2 = body.split(' ');
    let ln = '';
    let lnY = ny - 18;
    for (const w of words2) {
      const test = ln ? ln + ' ' + w : w;
      if (regular.widthOfTextAtSize(test, 8) > BODY_W && ln) {
        page.drawText(ln, { x: BODY_X, y: lnY, size: 8, font: regular, color: LGRAY });
        lnY -= 11;
        ln = w;
      } else {
        ln = test;
      }
    }
    if (ln) page.drawText(ln, { x: BODY_X, y: lnY, size: 8, font: regular, color: LGRAY });
    return lnY - 20; // return next y
  }

  y = drawNotice(s(locale, 'notice_label'), s(locale, 'notice_body'), y);
  y = drawNotice(s(locale, 'late_label'),   s(locale, 'late_body'),   y);
  y = drawNotice(s(locale, 'pets_label'),   s(locale, 'pets_body'),   y);

  // ---- footer ------------------------------------------------------------
  const FOOTER_Y = 40;
  page.drawLine({ start: { x: L, y: FOOTER_Y + 24 }, end: { x: R, y: FOOTER_Y + 24 }, thickness: 0.5, color: BORDER });
  page.drawText(s(locale, 'footer'), {
    x: L, y: FOOTER_Y + 10, size: 6.5, font: italic, color: LGRAY,
    maxWidth: TW,
  });
  page.drawText(s(locale, 'brand'), {
    x: L, y: FOOTER_Y - 4, size: 6.5, font: regular, color: LGRAY,
  });

  return doc.save();
}

/**
 * Prepend a plain-language summary page to an existing lease PDF.
 * The returned bytes represent a PDF where:
 *   page 1  = plain-language summary
 *   pages 2-N = original PDF pages (body + optional cert)
 */
export async function prependSummaryPage(
  mainPdfBytes: Uint8Array,
  app: Record<string, unknown>,
  locale?: Locale,
): Promise<Uint8Array> {
  const resolvedLocale = resolveLocale(
    locale ?? (app.negotiation_language as string | undefined),
  );

  const [summaryBytes, mainDoc] = await Promise.all([
    buildPlainLanguageSummaryBytes(app, resolvedLocale),
    PDFDocument.load(mainPdfBytes),
  ]);

  const summaryDoc = await PDFDocument.load(summaryBytes);
  const merged     = await PDFDocument.create();

  // Copy summary page first
  const [summaryPage] = await merged.copyPages(summaryDoc, [0]);
  merged.addPage(summaryPage);

  // Copy all main pages
  const mainPageIndices = mainDoc.getPageIndices();
  const copiedPages = await merged.copyPages(mainDoc, mainPageIndices);
  for (const p of copiedPages) merged.addPage(p);

  return merged.save();
}
