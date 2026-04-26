// supabase/functions/_shared/audit-certificate.ts
//
// Phase 06 -- "Certificate of Completion" renderer.
//
// Appends a tamper-evident audit page (or pages) to a freshly built lease
// PDF. The cert page contains:
//   * Document title, application id, lease state, template + PDF version
//   * Document body SHA-256 (the hash of bytes BEFORE this cert was added)
//   * Generation timestamp + edge function version tag
//   * Signers table (name, role, email, IP, signed_at)
//   * E-SIGN consent rows (role, disclosure version, consented_at, IP)
//   * QR code linking to the public verify-lease.html?t=<token> page
//   * Footer disclaimer
//
// Design notes:
//   * Caller computes body bytes + body sha256, then calls
//     `appendCertificateOfCompletion`. We reload the body bytes into a
//     fresh PDFDocument so the cert lives in the same file but doesn't
//     mutate the body content (which would invalidate the body hash).
//   * The QR encoder returns a boolean module grid; we paint it as
//     pdf-lib rectangles. White = no draw; black = a small black square.
//   * pdf-lib's WinAnsi font set cannot render Unicode checkmarks, so
//     all text is sanitized to ASCII (handled in the caller via
//     sanitizeForPDF or here via cert-local sanitizer).

import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { generateQR } from './qr-code.ts';

export type SignerRole = 'tenant' | 'co_applicant' | 'management' | 'amendment';

export interface CertSigner {
  role:        SignerRole;
  name:        string;
  email?:      string | null;
  ip?:         string | null;
  user_agent?: string | null;
  signed_at?:  string | null;     // ISO timestamp
}

export interface CertEsignConsent {
  role:               SignerRole;
  disclosure_version: string;
  consented_at:       string | null;
  ip:                 string | null;
}

export interface CertOptions {
  app_id:             string;
  state_code:         string | null;
  template_version:   number | null;
  pdf_version:        number;
  body_sha256:        string;            // hex digest of bytes before cert
  generated_at:       string;            // ISO
  edge_function_tag:  string;            // e.g. "lease-render v1.6"
  signers:            CertSigner[];
  esign_consents:     CertEsignConsent[];
  verify_url:         string;            // full URL with ?t=token
  amendment_id?:      string | null;
}

const MARGIN = 36;            // 0.5"
const PAGE_W = 612;           // 8.5"
const PAGE_H = 792;           // 11"

function asciiSanitize(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[\u2022]/g, '*')
    .replace(/[^\x00-\x7E]/g, '?');
}

function fmt(ts: string | null | undefined): string {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });
  } catch { return ts; }
}

function maskEmail(e: string | null | undefined): string {
  if (!e) return '-';
  const at = e.indexOf('@');
  if (at < 1) return '*';
  return e.slice(0, Math.min(2, at)) + '...@' + e.slice(at + 1);
}

function maskIp(ip: string | null | undefined): string {
  if (!ip) return '-';
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.\d+$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.x`;
  return ip;     // IPv6 / unusual values are kept verbatim
}

function ellipsize(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '~';
}

function roleLabel(r: SignerRole): string {
  if (r === 'tenant')        return 'Tenant';
  if (r === 'co_applicant')  return 'Co-Applicant';
  if (r === 'management')    return 'Management';
  return 'Amendment Signer';
}

/**
 * Append the certificate page(s) to a freshly built lease PDF.
 * @param bodyBytes   - the lease body PDF bytes (everything except cert)
 * @returns the new PDF bytes with the cert appended
 */
export async function appendCertificateOfCompletion(
  bodyBytes: Uint8Array,
  opts: CertOptions,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(bodyBytes, { ignoreEncryption: true });
  const fontN = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontM = await pdfDoc.embedFont(StandardFonts.Courier);     // monospace for hash

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  }

  function reserve(h: number) {
    if (y - h < MARGIN) newPage();
  }

  function drawText(text: string, size: number, font: import('npm:pdf-lib@1.17.1').PDFFont, gap = 2) {
    reserve(size + gap);
    page.drawText(asciiSanitize(text), { x: MARGIN, y: y - size, size, font, color: rgb(0, 0, 0) });
    y -= size + gap;
  }

  function drawRule(thickness = 0.5) {
    reserve(6);
    page.drawLine({
      start: { x: MARGIN, y: y - 2 }, end: { x: PAGE_W - MARGIN, y: y - 2 },
      thickness, color: rgb(0.3, 0.3, 0.3),
    });
    y -= 6;
  }

  // ── Header ────────────────────────────────────────────────
  drawText('CERTIFICATE OF COMPLETION', 16, fontB, 4);
  drawText('Choice Properties -- Electronic Lease Audit Record', 9, fontN, 8);
  drawRule(1);

  // ── Document metadata block ───────────────────────────────
  const meta: [string, string][] = [
    ['Document',             'Residential Lease Agreement'],
    ['Application ID',       opts.app_id],
    ['Lease State',          opts.state_code || '-'],
    ['Template Version',     opts.template_version != null ? String(opts.template_version) : '-'],
    ['PDF Version',          String(opts.pdf_version)],
    ['Generated',            fmt(opts.generated_at)],
    ['Generator',            opts.edge_function_tag],
  ];
  if (opts.amendment_id) meta.push(['Amendment ID', opts.amendment_id]);

  for (const [k, v] of meta) {
    reserve(12);
    page.drawText(asciiSanitize(k + ':'), { x: MARGIN,         y: y - 9, size: 9, font: fontB });
    page.drawText(asciiSanitize(v),       { x: MARGIN + 110,   y: y - 9, size: 9, font: fontN });
    y -= 12;
  }
  y -= 4;

  // Body hash on its own row (monospace)
  reserve(14);
  page.drawText('Document body SHA-256:', { x: MARGIN, y: y - 9, size: 9, font: fontB });
  y -= 11;
  reserve(12);
  page.drawText(asciiSanitize(opts.body_sha256), { x: MARGIN, y: y - 8, size: 8, font: fontM });
  y -= 12;
  reserve(12);
  page.drawText('(SHA-256 of all PDF bytes BEFORE this Certificate of Completion page was added.)',
    { x: MARGIN, y: y - 7, size: 7, font: fontN, color: rgb(0.35, 0.35, 0.35) });
  y -= 14;

  drawRule();

  // ── Signers table ─────────────────────────────────────────
  drawText('SIGNERS', 11, fontB, 4);
  if (opts.signers.length === 0) {
    drawText('(no signers recorded)', 9, fontN, 6);
  } else {
    // header
    reserve(12);
    const headers = [['Role', 60], ['Name', 130], ['Email', 130], ['IP', 75], ['Signed', 130]];
    let x = MARGIN;
    for (const [h, w] of headers) {
      page.drawText(h as string, { x, y: y - 8, size: 8, font: fontB });
      x += w as number;
    }
    y -= 11;
    page.drawLine({ start: { x: MARGIN, y: y }, end: { x: PAGE_W - MARGIN, y: y }, thickness: 0.4, color: rgb(0.5,0.5,0.5) });
    y -= 4;
    for (const s of opts.signers) {
      reserve(12);
      const cells = [
        roleLabel(s.role),
        ellipsize(s.name || '-', 28),
        ellipsize(maskEmail(s.email), 28),
        maskIp(s.ip),
        fmt(s.signed_at),
      ];
      let cx = MARGIN;
      const widths = [60, 130, 130, 75, 130];
      for (let i = 0; i < cells.length; i++) {
        page.drawText(asciiSanitize(cells[i]), { x: cx, y: y - 8, size: 8, font: fontN });
        cx += widths[i];
      }
      y -= 11;
      if (s.user_agent) {
        reserve(10);
        page.drawText(asciiSanitize('UA: ' + ellipsize(s.user_agent, 110)),
          { x: MARGIN + 60, y: y - 7, size: 6.5, font: fontN, color: rgb(0.4, 0.4, 0.4) });
        y -= 9;
      }
    }
  }
  y -= 6;

  drawRule();

  // ── E-SIGN consents ───────────────────────────────────────
  drawText('E-SIGN CONSENTS', 11, fontB, 4);
  if (opts.esign_consents.length === 0) {
    drawText('(no E-SIGN consent rows on file)', 9, fontN, 6);
  } else {
    reserve(12);
    const hdr = [['Role', 80], ['Disclosure', 130], ['IP', 75], ['Consented', 150]];
    let x = MARGIN;
    for (const [h, w] of hdr) {
      page.drawText(h as string, { x, y: y - 8, size: 8, font: fontB });
      x += w as number;
    }
    y -= 11;
    page.drawLine({ start: { x: MARGIN, y: y }, end: { x: PAGE_W - MARGIN, y: y }, thickness: 0.4, color: rgb(0.5,0.5,0.5) });
    y -= 4;
    for (const c of opts.esign_consents) {
      reserve(12);
      let cx = MARGIN;
      const widths = [80, 130, 75, 150];
      const cells = [
        roleLabel(c.role),
        c.disclosure_version,
        maskIp(c.ip),
        fmt(c.consented_at),
      ];
      for (let i = 0; i < cells.length; i++) {
        page.drawText(asciiSanitize(cells[i]), { x: cx, y: y - 8, size: 8, font: fontN });
        cx += widths[i];
      }
      y -= 11;
    }
  }
  y -= 6;

  drawRule();

  // ── QR + verify URL ───────────────────────────────────────
  drawText('VERIFY THIS DOCUMENT', 11, fontB, 6);
  // Build QR
  let qrPainted = false;
  try {
    const qr = generateQR(opts.verify_url, 'M');
    const moduleSize = 3;            // points per module
    const qrPx = qr.size * moduleSize;
    reserve(qrPx + 30);
    const qrX = MARGIN;
    const qrY = y - qrPx;
    // White background (quiet zone equivalent -- spec says >=4 modules,
    // but our cert page background is already white so this is just a frame).
    for (let yy = 0; yy < qr.size; yy++) {
      for (let xx = 0; xx < qr.size; xx++) {
        if (qr.modules[yy][xx]) {
          page.drawRectangle({
            x: qrX + xx * moduleSize,
            y: qrY + (qr.size - 1 - yy) * moduleSize,
            width:  moduleSize,
            height: moduleSize,
            color:  rgb(0, 0, 0),
          });
        }
      }
    }
    // URL beside QR
    const urlX = qrX + qrPx + 14;
    const urlY = qrY + qrPx - 16;
    page.drawText('Scan to verify on a phone, or open:', { x: urlX, y: urlY, size: 9, font: fontN });
    page.drawText(asciiSanitize(opts.verify_url), { x: urlX, y: urlY - 14, size: 8, font: fontM });
    page.drawText('The verifier confirms which signers are on file and that',
      { x: urlX, y: urlY - 32, size: 8, font: fontN });
    page.drawText('the stored PDF\'s SHA-256 still matches the recorded hash.',
      { x: urlX, y: urlY - 44, size: 8, font: fontN });
    y = qrY - 8;
    qrPainted = true;
  } catch (e) {
    // QR failed -- fall back to text-only verify line.
    console.warn('[audit-certificate] QR render failed:', (e as Error).message);
    drawText('Verify URL: ' + opts.verify_url, 9, fontM, 4);
  }
  if (!qrPainted) y -= 4;

  drawRule();

  // ── Footer disclaimer ─────────────────────────────────────
  const footer =
    'This certificate is generated by Choice Properties and is bound to the lease document above. ' +
    'Any modification of the lease body invalidates the document body hash printed on this page. ' +
    'This certificate is not legal advice; refer to the disclaimer in the lease body.';
  // wrap manually
  const max = 100;
  const words = footer.split(/\s+/);
  let line = '';
  const lines: string[] = [];
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (t.length > max) { lines.push(line); line = w; } else { line = t; }
  }
  if (line) lines.push(line);
  for (const l of lines) {
    reserve(10);
    page.drawText(asciiSanitize(l), { x: MARGIN, y: y - 7, size: 7, font: fontN, color: rgb(0.35, 0.35, 0.35) });
    y -= 9;
  }

  return pdfDoc.save();
}

// ── Helpers exported for the edge functions ──────────────

/**
 * 22-char URL-safe random token (base64url, no padding) for the
 * qr_verify_token column. Uses crypto.getRandomValues so it's
 * cryptographically random.
 */
export function generateQrVerifyToken(): string {
  const bytes = new Uint8Array(16);   // 128 bits -> 22 base64url chars
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Lower-case 64-char hex SHA-256 of the given bytes. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
