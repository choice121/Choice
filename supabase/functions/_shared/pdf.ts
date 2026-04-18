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
    };
    return template.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? '');
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
    const lineHeight = bodySize * 1.55;

    function addPage() {
      const p = pdfDoc.addPage([pageWidth, pageHeight]);
      return { page: p, y: pageHeight - margin };
    }

    let { page, y } = addPage();

    function drawText(text: string, size: number, font: import('npm:pdf-lib@1.17.1').PDFFont, extra = 0) {
      if (y - size < margin) {
        ({ page, y } = addPage());
      }
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

    // Header
    drawText('RESIDENTIAL LEASE AGREEMENT', 15, fontBold, 4);
    drawText('Choice Properties  ·  2265 Livernois Suite 500, Troy MI 48083', 9, fontNormal, 20);

    // Lease body
    const rendered = substituteVars(templateText, app);
    drawWrapped(rendered, bodySize, fontNormal, 4);

    // Signature block (if signed)
    if (app.tenant_signature) {
      y -= 20;
      if (y - 120 < margin) ({ page, y } = addPage());
      drawText('─'.repeat(80), 8, fontNormal, 8);
      drawText('ELECTRONIC SIGNATURE', 11, fontBold, 6);
      drawText(`Tenant: ${app.tenant_signature}`, 12, fontItalic, 4);
      drawText(`Date signed: ${fmtDate(app.signature_timestamp as string)}`, 9, fontNormal, 3);
      if (app.lease_ip_address) drawText(`IP Address: ${app.lease_ip_address}`, 9, fontNormal, 3);
      y -= 6;
      drawWrapped(
        'This document was electronically signed via the Choice Properties tenant portal. ' +
        'The signature above constitutes a legally binding electronic signature under applicable law.',
        8, fontNormal, 3
      );
    }

    return pdfDoc.save();
  }
  