import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
  import {
    renderTemplate,
    renderTemplateSync,
    type PartialResolver,
  } from './template-engine.ts';
  import { buildLeaseRenderContext } from './lease-context.ts';
  import type { RenderedAddendum } from './lease-addenda.ts';
  import {
    appendCertificateOfCompletion,
    generateQrVerifyToken,
    sha256Hex,
    type CertOptions,
    type CertSigner,
    type CertEsignConsent,
  } from './audit-certificate.ts';

  // Phase 06 -- re-export so callers can import the cert helpers from
  // the same surface as buildLeasePDF.
  export {
    appendCertificateOfCompletion,
    generateQrVerifyToken,
    sha256Hex,
  } from './audit-certificate.ts';
  export type { CertOptions, CertSigner, CertEsignConsent } from './audit-certificate.ts';

  // Re-export so callers that need the partial-resolver type can grab it
  // from the same module they're already importing buildLeasePDF from.
  export type { PartialResolver } from './template-engine.ts';
  export { createSupabasePartialResolver } from './template-engine.ts';

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

  function fmtDateTime(d: string | null | undefined): string {
    if (!d) return '';
    try { return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  }

  /**
   * @deprecated Phase 01 - prefer `renderTemplate` from
   * `_shared/template-engine.ts` together with `buildLeaseRenderContext`
   * from `_shared/lease-context.ts`. This wrapper exists only so legacy
   * call sites keep compiling during the rollout and so we have a clear
   * single-line backward-compat path; it does NOT support
   * `{% include %}` (use the async renderer if your template needs
   * partials).
   */
  export function substituteVars(template: string, app: Record<string, unknown>): string {
    return renderTemplateSync(template, buildLeaseRenderContext(app));
  }

  /** Replace non-WinAnsi characters with ASCII equivalents so pdf-lib doesn't choke */
  function sanitizeForPDF(text: string): string {
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

  /**
   * Convert a data-URL signature image to raw bytes for embedding.
   * Returns null on any failure - the typed name remains the legally
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

  /**
   * Try to fetch and embed an attached PDF asset (e.g. EPA lead pamphlet).
   * Path is resolved against `baseUrl` if provided. Network or parse
   * errors are swallowed (graceful fallback) - the addendum text already
   * mentions the pamphlet and includes the source URL.
   *
   * Phase 04: returns true on success so the caller can record an
   * "attached" footer line, false on any failure (caller adds a
   * "see [source_url] for the official pamphlet" footer instead).
   */
  async function copyAttachedPdf(
    pdfDoc: import('npm:pdf-lib@1.17.1').PDFDocument,
    attachedPath: string,
    baseUrl: string | undefined,
  ): Promise<{ ok: boolean; pages: number }> {
    if (!baseUrl) return { ok: false, pages: 0 };
    try {
      const url = baseUrl.replace(/\/+$/, '') + '/' + attachedPath.replace(/^\/+/, '');
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        console.warn('[pdf.copyAttachedPdf]', url, 'returned', res.status);
        return { ok: false, pages: 0 };
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const sig = String.fromCharCode(...bytes.slice(0, 5));
      if (sig !== '%PDF-') {
        console.warn('[pdf.copyAttachedPdf] not a PDF (sig=' + sig + '):', url);
        return { ok: false, pages: 0 };
      }
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const indices = src.getPageIndices();
      const copied = await pdfDoc.copyPages(src, indices);
      for (const p of copied) pdfDoc.addPage(p);
      return { ok: true, pages: copied.length };
    } catch (e) {
      console.warn('[pdf.copyAttachedPdf] failed:', (e as Error).message);
      return { ok: false, pages: 0 };
    }
  }

  export interface BuildLeasePDFOptions {
    partials?:            PartialResolver;
    /** Phase 04 - addenda already rendered (use selectRequiredAddenda upstream). */
    addenda?:             RenderedAddendum[];
    /** Phase 04 - base URL for fetching attached_pdf_path assets (e.g. site URL). */
    addendaAssetBaseUrl?: string;
  }

  export async function buildLeasePDF(
    app: Record<string, unknown>,
    templateText: string,
    opts?: BuildLeasePDFOptions,
  ): Promise<Uint8Array> {
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

    /** Force a fresh page (used at the top of each addendum so they don't bleed together). */
    function newPage() {
      ({ page, y } = addPage());
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
    drawText('Choice Properties  -  2265 Livernois Suite 500, Troy MI 48083', 9, fontNormal, 20);

    // Lease body - Phase 01 templating engine.
    const renderedRaw = await renderTemplate(
      templateText,
      buildLeaseRenderContext(app),
      { partials: opts?.partials },
    );
    const rendered = sanitizeForPDF(renderedRaw);
    drawWrapped(rendered, bodySize, fontNormal, 4);

    // ----- Signature block -----
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
      drawText('Typed name:  ' + tenantSig, 11, fontItalic, 3);
      drawText('Date signed: ' + fmtDateTime(app.signature_timestamp as string), 9, fontNormal, 3);
      if (app.lease_ip_address) drawText('IP Address:  ' + app.lease_ip_address, 9, fontNormal, 3);
      y -= 10;
    }

    if (coAppSig) {
      if (y - 80 < margin) ({ page, y } = addPage());
      drawText('Co-Applicant', 9, fontBold, 4);
      if (coAppImg) await drawSignatureImage(coAppImg);
      drawText('Typed name:  ' + coAppSig, 11, fontItalic, 3);
      drawText('Date signed: ' + fmtDateTime(app.co_applicant_signature_timestamp as string), 9, fontNormal, 3);
      y -= 10;
    }

    if (mgmtSigned && mgmtSig) {
      if (y - 80 < margin) ({ page, y } = addPage());
      drawText('Management (Choice Properties)', 9, fontBold, 4);
      drawText('Signed by:   ' + mgmtSig, 11, fontItalic, 3);
      drawText('Date signed: ' + fmtDateTime(mgmtAt), 9, fontNormal, 3);
      if (app.management_notes) drawText('Notes:       ' + String(app.management_notes).slice(0, 200), 9, fontNormal, 3);
      y -= 10;
    }

    if (tenantSig || coAppSig || mgmtSigned) {
      if (y - 40 < margin) ({ page, y } = addPage());
      drawWrapped(
        'This document was electronically signed via the Choice Properties tenant portal. ' +
        'Each typed name above constitutes a legally binding electronic signature under the ' +
        'federal E-SIGN Act (15 U.S.C. \u00a77001) and applicable state Uniform Electronic Transactions Act.',
        8, fontNormal, 3
      );
    }

    // ===========================================================
    // Phase 04 - Addenda
    // Each addendum starts on a fresh page with a header block,
    // then the rendered body, then per-addendum signature lines
    // (if signature_required) and initials lines (if initials_required).
    // After the addendum text, an attached PDF (e.g. EPA pamphlet) may
    // be embedded via pdf-lib copyPages.
    // ===========================================================
    const addenda = opts?.addenda ?? [];
    if (addenda.length > 0) {
      // Cover separator on existing page
      y -= 10;
      if (y - 60 < margin) ({ page, y } = addPage());
      drawText('-'.repeat(80), 8, fontNormal, 6);
      drawText('REQUIRED ADDENDA AND DISCLOSURES', 11, fontBold, 6);
      drawWrapped(
        'The following ' + addenda.length + ' addendum(a) form an integral part of this Lease. ' +
        'Each is governed by the cited federal, state, or local authority and must be acknowledged ' +
        'separately by Tenant.',
        9, fontItalic, 8
      );

      let n = 0;
      for (const a of addenda) {
        n++;
        newPage();
        // Header block
        drawText(sanitizeForPDF('ADDENDUM ' + n + ' of ' + addenda.length), 9, fontBold, 4);
        drawText(sanitizeForPDF(a.title), 13, fontBold, 4);
        drawText(sanitizeForPDF('Jurisdiction: ' + a.jurisdiction.toUpperCase()), 8, fontNormal, 2);
        drawWrapped(sanitizeForPDF('Authority: ' + a.citation), 8, fontItalic, 6);
        drawText('-'.repeat(80), 8, fontNormal, 8);

        // Body
        drawWrapped(sanitizeForPDF(a.rendered_body), bodySize, fontNormal, 4);

        // Optional embedded PDF (e.g. EPA lead pamphlet)
        let embeddedPages = 0;
        if (a.attached_pdf_path) {
          const r = await copyAttachedPdf(pdfDoc, a.attached_pdf_path, opts?.addendaAssetBaseUrl);
          if (r.ok) {
            embeddedPages = r.pages;
            // After copyPages, we've added new pages but our local
            // (page,y) cursor still points at the addendum text page.
            // For any per-addendum signature line we need a fresh page
            // at the END of the embedded pamphlet so the signature
            // immediately follows. Force a new page.
            newPage();
            drawText(sanitizeForPDF('(' + embeddedPages + '-page pamphlet attached above)'), 8, fontItalic, 8);
          } else {
            if (y - 24 < margin) newPage();
            drawWrapped(
              sanitizeForPDF('NOTE: The official pamphlet referenced above will be provided separately. ' +
                             'Tenant may also access it online.'),
              8, fontItalic, 6
            );
          }
        }

        // Per-addendum signature / initials lines
        if (a.signature_required) {
          if (y - 60 < margin) newPage();
          y -= 10;
          drawText('-'.repeat(60), 8, fontNormal, 6);
          drawText('Tenant signature: ____________________________________   Date: ___________', 9, fontNormal, 4);
          if (a.initials_required) {
            drawText('Tenant initials:  ______', 9, fontNormal, 4);
          }
        }
      }
    }

    return pdfDoc.save();
  }


  // =====================================================================
  // Phase 06 -- Finalized PDF helper
  //
  // buildLeasePDFFinalized() wraps buildLeasePDF + (optional) audit
  // certificate page + SHA-256 hashing in a single call so every signing
  // edge function follows the exact same integrity flow:
  //
  //   1. Render lease body (templating + addenda + signatures).
  //   2. SHA-256 the body bytes  -> body_sha256 (printed on cert page).
  //   3. If `certificate` opts are passed, append the cert page:
  //        - signers table
  //        - E-SIGN consent rows
  //        - QR code -> /verify-lease.html?t=<qr_token>
  //   4. SHA-256 the FINAL bytes -> sha256 (stored in lease_pdf_versions
  //      and re-checked by verify-lease at retrieval time).
  //
  // Callers receive everything they need to:
  //   * upload the final bytes to storage,
  //   * call record_lease_pdf_integrity(sha256, certificate_appended,
  //     qr_verify_token).
  // =====================================================================

  export interface FinalizedPdf {
    bytes:                 Uint8Array;
    sha256:                string;
    body_sha256:           string;
    certificate_appended:  boolean;
    qr_verify_token:       string | null;
  }

  export interface CertificateInput {
    /** Required to compute the verify URL printed in the cert. */
    site_url:           string;
    app_id:             string;
    state_code:         string | null;
    template_version:   number | null;
    pdf_version:        number;
    edge_function_tag:  string;
    signers:            CertSigner[];
    esign_consents:     CertEsignConsent[];
    amendment_id?:      string | null;
    /** If omitted, a fresh 22-char URL-safe token is generated. */
    qr_verify_token?:   string;
  }

  export interface BuildLeasePDFFinalizedOptions extends BuildLeasePDFOptions {
    /** When provided, an audit certificate page is appended. */
    certificate?: CertificateInput;
  }

  export async function buildLeasePDFFinalized(
    app: Record<string, unknown>,
    templateText: string,
    opts: BuildLeasePDFFinalizedOptions,
  ): Promise<FinalizedPdf> {
    // 1. Body
    const bodyBytes = await buildLeasePDF(app, templateText, {
      partials:            opts.partials,
      addenda:             opts.addenda,
      addendaAssetBaseUrl: opts.addendaAssetBaseUrl,
    });
    const body_sha256 = await sha256Hex(bodyBytes);

    // 2. Optionally append cert
    if (!opts.certificate) {
      return {
        bytes:                 bodyBytes,
        sha256:                body_sha256,
        body_sha256,
        certificate_appended:  false,
        qr_verify_token:       null,
      };
    }

    const c = opts.certificate;
    const qrToken = c.qr_verify_token || generateQrVerifyToken();
    const verifyUrl = `${c.site_url.replace(/\/+$/, '')}/verify-lease.html?t=${qrToken}`;

    const certOpts: CertOptions = {
      app_id:            c.app_id,
      state_code:        c.state_code,
      template_version:  c.template_version,
      pdf_version:       c.pdf_version,
      body_sha256,
      generated_at:      new Date().toISOString(),
      edge_function_tag: c.edge_function_tag,
      signers:           c.signers,
      esign_consents:    c.esign_consents,
      verify_url:        verifyUrl,
      amendment_id:      c.amendment_id || null,
    };

    const finalBytes = await appendCertificateOfCompletion(bodyBytes, certOpts);
    const finalSha   = await sha256Hex(finalBytes);

    return {
      bytes:                 finalBytes,
      sha256:                finalSha,
      body_sha256,
      certificate_appended:  true,
      qr_verify_token:       qrToken,
    };
  }
  