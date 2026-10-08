import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'npm:pdf-lib@1.17.1';

export interface ReceiptPDFData {
  receiptNumber: string;
  receiptType: 'application_fee' | 'holding_deposit';
  tenantName: string;
  propertyAddress: string;
  applicationId: string;
  amount: number;
  paymentMethod: string;
  transactionReference: string;
  paidAt: string;
  issuedAt: string;
}

function safeText(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E]/g, '?');
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);
  return date.toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

export async function buildReceiptPDF(data: ReceiptPDFData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.14, 0.12);
  const muted = rgb(0.38, 0.44, 0.41);
  const green = rgb(0.09, 0.43, 0.32);
  const line = rgb(0.84, 0.88, 0.85);
  const left = 54;
  const right = 558;

  page.drawText('CHOICE PROPERTIES', { x: left, y: 735, size: 15, font: bold, color: green });
  page.drawText('RESIDENTIAL LEASING OPERATIONS', { x: left, y: 718, size: 8, font: bold, color: muted });
  page.drawText('OFFICIAL PAYMENT RECEIPT', { x: 366, y: 737, size: 9, font: bold, color: ink });
  page.drawText(`RECEIPT ${safeText(data.receiptNumber)}`, { x: 366, y: 720, size: 8, font: regular, color: muted });
  page.drawLine({ start: { x: left, y: 697 }, end: { x: right, y: 697 }, thickness: 1, color: line });

  page.drawText('PAYMENT RECORD', { x: left, y: 665, size: 8, font: bold, color: green });
  page.drawText('Official receipt', { x: left, y: 635, size: 23, font: bold, color: ink });
  page.drawRectangle({ x: 443, y: 636, width: 115, height: 23, color: rgb(0.92, 0.97, 0.94) });
  page.drawText('PAYMENT RECORDED', { x: 452, y: 644, size: 7, font: bold, color: green });

  page.drawRectangle({ x: left, y: 558, width: right - left, height: 52, color: rgb(0.95, 0.97, 0.95) });
  page.drawRectangle({ x: left, y: 558, width: 3, height: 52, color: green });
  page.drawText('AMOUNT RECEIVED', { x: 72, y: 590, size: 8, font: bold, color: muted });
  page.drawText(`$${data.amount.toFixed(2)}`, { x: 72, y: 568, size: 19, font: bold, color: ink });
  const description = data.receiptType === 'application_fee'
    ? 'Residential application screening fee'
    : 'Property reservation holding payment';
  page.drawText(description, { x: 330, y: 579, size: 9, font: regular, color: ink });

  const rows: Array<[string, string]> = [
    ['RECEIVED FROM', data.tenantName],
    ['PROPERTY', data.propertyAddress],
    ['PAYMENT DATE', formatDate(data.paidAt)],
    ['PAYMENT METHOD', data.paymentMethod || 'Not recorded'],
    ['APPLICATION REFERENCE', data.applicationId],
    ['TRANSACTION REFERENCE', data.transactionReference || 'Not provided'],
  ];
  let y = 524;
  for (const [label, value] of rows) {
    page.drawText(label, { x: left, y, size: 7, font: bold, color: muted });
    const lines = wrap(value, regular, 9, 480);
    let lineY = y - 16;
    for (const text of lines.slice(0, 3)) {
      page.drawText(text, { x: left, y: lineY, size: 9, font: regular, color: ink });
      lineY -= 12;
    }
    y = lineY - 11;
    page.drawLine({ start: { x: left, y: y + 5 }, end: { x: right, y: y + 5 }, thickness: 0.6, color: line });
    y -= 6;
  }

  page.drawRectangle({ x: left, y: 105, width: right - left, height: 49, color: rgb(0.97, 0.98, 0.97), borderColor: line, borderWidth: 0.8 });
  page.drawText('LEDGER CONFIRMATION', { x: 68, y: 136, size: 8, font: bold, color: green });
  page.drawText('This receipt confirms the payment shown above is recorded on the application ledger.', {
    x: 68, y: 119, size: 8, font: regular, color: ink,
  });

  page.drawCircle({ x: 501, y: 204, size: 43, borderColor: green, borderWidth: 1.5 });
  page.drawCircle({ x: 501, y: 204, size: 37, borderColor: green, borderWidth: 0.6 });
  page.drawText('RECORDED', { x: 478, y: 205, size: 7, font: bold, color: green });
  page.drawText('CHOICE PROPERTIES', { x: 469, y: 222, size: 5, font: bold, color: green });
  page.drawText(formatDate(data.issuedAt), { x: 54, y: 57, size: 7, font: regular, color: muted });
  page.drawText(`Reference: ${safeText(data.receiptNumber)}`, { x: 350, y: 57, size: 7, font: regular, color: muted });

  return await pdf.save();
}