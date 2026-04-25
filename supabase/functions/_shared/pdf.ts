import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

// Word-wrap helper (pdf-lib doesn't auto-wrap)
function wrapText(text: string, maxWidth: number, fontSize: number, font: import('npm:pdf-lib@1.17.1').PDFFont): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (para.trim() === '') { lines.push(''); continue; }
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      const w = font.widthOfTextAtSize(test, fontSize);
      if (w > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return '';
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return d; }
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '';
  try { return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

export function substituteVars(template: string, app: Record<string, unknown>): string {
  const vars: Record<string, string> = {
    tenant_full_name:    `${app.first_name || ''} ${app.last_name || ''}`.trim(),
    tenant_email:        String(app.email || ''),
    tenant_phone:        String(app.phone || ''),
    property_address:    String(app.property_address || ''),
    lease_start_date:    fmtDate(app.lease_start_date as string),
    lease_end_date:      fmtDate(app.lease_end_date as string),
    monthly_rent:        fmtMoney(app.monthly_rent as number),
    security_deposit:    fmtMoney(app.security_deposit as number),
    move_in_costs:       fmtMoney(app.move_in_costs as number),
    landlord_name:       String(app.lease_landlord_name    || 'Choice Properties'),
    landlord_address:    String(app.lease_landlord_address || '2265 Livernois Suite 500, Troy MI 48083'),
    late_fee_flat:       app.lease_late_fee_flat  ? fmtMoney(app.lease_late_fee_flat as number) : '',
    late_fee_daily:      app.lease_late_fee_daily ? fmtMoney(app.lease_late_fee_daily as number) : '',
    state_code:          String(app.lease_state_code    || 'MI'),
    pets_policy:         String(app.lease_pets_policy   || 'No pets allowed.'),
    smoking_policy:      String(app.lease_smoking_policy|| 'No smoking permitted on premises.'),
    desired_lease_term:  String(app.desired_lease_term  || ''),
    app_id:              String(app.app_id || app.id || ''),
    signature_date:      app.signature_timestamp ? fmtDate(app.signature_timestamp as string) : '',
    tenant_signature:    String(app.tenant_signature || ''),
    co_applicant_signature: String(app.co_applicant_signature || ''),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? '');
}

/** Replace non-WinAnsi characters with ASCII equivalents so pdf-lib doesn't choke */
function sanitizeForPDF(text: string): string {
  return text
    .replace(/[─━\u2500-\u257F]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[^\x00-\xFF]/g, '?');
}

/**
 * Convert a data-URL signature image to raw bytes for embedding.
 * Returns null on any failure — the typed name remains the legally
 * binding signature so a missing image is never fatal.
 */
function decodeDataUrl(dataUrl: string | null | undefined): { mime: string; bytes: Uint8Array } | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/i);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime: m[1].toLowerCase(), bytes };
  } catch { return null; }
}

export async function buildLeasePDF(app: Record<string, unknown>, templateText: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const margin = 60;
  const pageWidth = 612;
  const pageHeight = 792;
  const contentWidth = pageWidth - margin * 2;
  const bodySize = 10;

  function addPage() {
    const p = pdfDoc.addPage([pageWidth, pageHeight]);
    return { page: p, y: pageHeight - margin };
  }

  let { page, y } = addPage();

  function drawText(text: string, size: number, font: import('npm:pdf-lib@1.17.1').PDFFont, extra = 0) {
    if (y - size < margin) ({ page, y } = addPage());
    page.drawText(text, { x: margin, y: y - size, size, font, color: rgb(0, 0, 0) });
    y -= size + extra;
  }

  function drawWrapped(text: string, size: number, font: import('npm:pdf-lib@1.17.1').PDFFont, gap = 4) {
    const lines = wrapText(text, contentWidth, size, font);
    for (const line of lines) {
      if (y - size < margin) ({ page, y } = addPage());
      if (line !== '') {
        page.drawText(line, { x: margin, y: y - size, size, font, color: rgb(0, 0, 0) });
      }
      y -= size + gap;
    }
  }

  async function drawSignatureImage(imgDataUrl: string | null | undefined): Promise<boolean> {
    const decoded = decodeDataUrl(imgDataUrl);
    if (!decoded) return false;
    try {
      const img = decoded.mime === 'image/png'
        ? await pdfDoc.embedPng(decoded.bytes)
        : await pdfDoc.embedJpg(decoded.bytes);
      const targetWidth  = 220;
      const scale        = targetWidth / img.width;
      const targetHeight = Math.min(60, img.height * scale);
      if (y - targetHeight < margin) ({ page, y } = addPage());
      page.drawImage(img, { x: margin, y: y - targetHeight, width: targetWidth, height: targetHeight });
      y -= targetHeight + 4;
      return true;
    } catch (e) {
      console.warn('[buildLeasePDF] signature image embed failed:', (e as Error).message);
      return false;
    }
  }

  // Header
  drawText('RESIDENTIAL LEASE AGREEMENT', 15, fontBold, 4);
  drawText('Choice Properties  ·  2265 Livernois Suite 500, Troy MI 48083', 9, fontNormal, 20);

  // Lease body
  const rendered = sanitizeForPDF(substituteVars(templateText, app));
  drawWrapped(rendered, bodySize, fontNormal, 4);

  // ── Signature block ────────────────────────────────────────
  const tenantSig    = app.tenant_signature        as string | undefined;
  const tenantImg    = app.tenant_signature_image  as string | undefined;
  const coAppSig     = app.co_applicant_signature  as string | undefined;
  const coAppImg     = app.co_applicant_signature_image as string | undefined;
  const mgmtSig      = app.management_signer_name  as string | undefined;
  const mgmtAt       = app.management_signed_at    as string | undefined;
  const mgmtSigned   = app.management_signed       as boolean | undefined;

  if (tenantSig || coAppSig || mgmtSigned) {
    y -= 14;
    if (y - 60 < margin) ({ page, y } = addPage());
    drawText('-'.repeat(80), 8, fontNormal, 6);
    drawText('ELECTRONIC SIGNATURES', 11, fontBold, 8);
  }

  if (tenantSig) {
    drawText('Tenant', 9, fontBold, 4);
    if (tenantImg) await drawSignatureImage(tenantImg);
    drawText(`Typed name:  ${tenantSig}`, 11, fontItalic, 3);
    drawText(`Date signed: ${fmtDateTime(app.signature_timestamp as string)}`, 9, fontNormal, 3);
    if (app.lease_ip_address) drawText(`IP Address:  ${app.lease_ip_address}`, 9, fontNormal, 3);
    y -= 10;
  }

  if (coAppSig) {
    if (y - 80 < margin) ({ page, y } = addPage());
    drawText('Co-Applicant', 9, fontBold, 4);
    if (coAppImg) await drawSignatureImage(coAppImg);
    drawText(`Typed name:  ${coAppSig}`, 11, fontItalic, 3);
    drawText(`Date signed: ${fmtDateTime(app.co_applicant_signature_timestamp as string)}`, 9, fontNormal, 3);
    y -= 10;
  }

  if (mgmtSigned && mgmtSig) {
    if (y - 80 < margin) ({ page, y } = addPage());
    drawText('Management (Choice Properties)', 9, fontBold, 4);
    drawText(`Signed by:   ${mgmtSig}`, 11, fontItalic, 3);
    drawText(`Date signed: ${fmtDateTime(mgmtAt)}`, 9, fontNormal, 3);
    if (app.management_notes) drawText(`Notes:       ${String(app.management_notes).slice(0, 200)}`, 9, fontNormal, 3);
    y -= 10;
  }

  if (tenantSig || coAppSig || mgmtSigned) {
    if (y - 40 < margin) ({ page, y } = addPage());
    drawWrapped(
      'This document was electronically signed via the Choice Properties tenant portal. ' +
      'Each typed name above constitutes a legally binding electronic signature under the ' +
      'federal E-SIGN Act (15 U.S.C. §7001) and applicable state Uniform Electronic Transactions Act.',
      8, fontNormal, 3
    );
  }

  return pdfDoc.save();
}
