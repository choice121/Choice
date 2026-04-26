// ─────────────────────────────────────────────────────────────────────
// inspection-pdf.ts — Phase 08 chunk 2/N
//
// Renders a move-in / mid-term / move-out condition report into a
// versioned PDF. Layout:
//
//   • Page 1: cover (property address, inspection type, parties,
//     scheduled / completed dates, notes).
//   • One page per room (sorted: living_room, kitchen, dining_room,
//     bedroom_*, bathroom_*, laundry, exterior, other) listing each
//     item with condition + notes and up to 4 photo thumbnails per
//     item embedded inline.
//   • Final page: signature block (typed name + image when supplied)
//     for tenant and landlord, plus integrity footer (UTC timestamp,
//     inspection_id, photos_count). The SHA-256 footer is appended by
//     the caller AFTER it has hashed the rendered bytes.
//
// Photos are pulled from the lease-inspection-photos bucket using the
// service-role supabase client passed in by the edge function. Any
// fetch / decode failure is logged and the slot is rendered as a
// placeholder rectangle — never fatal.
//
// EXPORT SURFACE:
//   buildInspectionPDF(args) -> { bytes, page_count, photos_embedded }
// ─────────────────────────────────────────────────────────────────────

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFImage,
} from 'npm:pdf-lib@1.17.1';

// ── Types ─────────────────────────────────────────────────────────────

export type InspectionType = 'move_in' | 'mid_term' | 'move_out';

export interface InspectionItem {
  name:        string;
  condition?:  'good' | 'fair' | 'poor' | 'damaged' | string;
  notes?:      string;
  photo_paths?: string[];
}

export interface InspectionRoom {
  items?: InspectionItem[];
}

export interface InspectionRecord {
  id:                  string;
  app_id:              string;
  inspection_type:     InspectionType;
  scheduled_for?:      string | null;
  completed_at?:       string | null;
  completed_by_role?:  string | null;
  tenant_signed_at?:   string | null;
  landlord_signed_at?: string | null;
  tenant_sig_image?:   string | null;   // data: URL
  landlord_sig_image?: string | null;
  rooms:               Record<string, InspectionRoom>;
  notes?:              string | null;
  photos_count?:       number;
}

export interface InspectionPdfArgs {
  inspection:        InspectionRecord;
  app: {
    app_id:           string;
    property_address?: string | null;
    first_name?:      string | null;
    last_name?:       string | null;
    email?:           string | null;
    lease_landlord_name?:    string | null;
    lease_landlord_address?: string | null;
  };
  /** Service-role supabase client used to download photos from the private bucket. */
  storage: {
    from(bucket: string): {
      download(path: string): Promise<{ data: Blob | null; error: { message: string } | null }>;
    };
  };
}

export interface InspectionPdfResult {
  bytes:           Uint8Array;
  page_count:      number;
  photos_embedded: number;
  photos_failed:   number;
}

// ── Constants ─────────────────────────────────────────────────────────

const PHOTO_BUCKET   = 'lease-inspection-photos';
const PAGE_W         = 612;   // US Letter
const PAGE_H         = 792;
const M              = 50;    // page margin
const TITLE_SZ       = 18;
const H_SZ           = 14;
const BODY_SZ        = 10;
const SMALL_SZ       = 8;
const LINE_GAP       = 14;
const PHOTOS_PER_ROW = 2;
const MAX_PHOTOS_PER_ITEM = 4;
const PHOTO_W        = 220;
const PHOTO_H        = 165;

const INSPECTION_TYPE_LABEL: Record<InspectionType, string> = {
  move_in:   'MOVE-IN CONDITION REPORT',
  mid_term:  'MID-TERM CONDITION REPORT',
  move_out:  'MOVE-OUT CONDITION REPORT',
};

const ROOM_ORDER_PRIORITY: Record<string, number> = {
  living_room: 1, kitchen: 2, dining_room: 3,
  bedroom_1: 10, bedroom_2: 11, bedroom_3: 12, bedroom_4: 13, bedroom_5: 14,
  bathroom_1: 20, bathroom_2: 21, bathroom_3: 22,
  laundry: 30, hallway: 31, basement: 32, garage: 33,
  exterior: 90, other: 99,
};

// ── Small helpers (mirrored from pdf.ts to avoid coupling) ────────────

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

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    }) + ' UTC';
  } catch { return d; }
}

function wrap(text: string, maxW: number, sz: number, font: PDFFont): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    const words = para.split(' ');
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(test, sz) > maxW && cur) {
        out.push(cur); cur = w;
      } else { cur = test; }
    }
    if (cur) out.push(cur);
  }
  return out;
}

function humanRoomName(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
}

function roomSortKey(key: string): number {
  if (key in ROOM_ORDER_PRIORITY) return ROOM_ORDER_PRIORITY[key];
  // unknown rooms sort after exterior, before 'other', alpha by char code
  return 91 + (key.charCodeAt(0) || 0) / 1000;
}

function decodeDataUrl(dataUrl: string | null | undefined): { mime: 'png' | 'jpeg'; bytes: Uint8Array } | null {
  if (!dataUrl) return null;
  const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const mime = (m[1].toLowerCase() === 'png' ? 'png' : 'jpeg') as 'png' | 'jpeg';
    return { mime, bytes };
  } catch { return null; }
}

async function blobToBytes(b: Blob): Promise<Uint8Array> {
  const ab = await b.arrayBuffer();
  return new Uint8Array(ab);
}

function detectImageMime(bytes: Uint8Array): 'png' | 'jpeg' | null {
  if (bytes.length < 8) return null;
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
  // JPEG SOI: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpeg';
  return null;
}

// ── Drawing primitives ────────────────────────────────────────────────

interface PageCtx {
  pdf:  PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y:    number;
}

function newPage(ctx: PageCtx): void {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y    = PAGE_H - M;
}

function ensureSpace(ctx: PageCtx, needed: number): void {
  if (ctx.y - needed < M) newPage(ctx);
}

function drawLine(ctx: PageCtx, text: string, opts: { sz?: number; bold?: boolean; color?: [number, number, number]; indent?: number } = {}): void {
  const sz     = opts.sz ?? BODY_SZ;
  const font   = opts.bold ? ctx.bold : ctx.font;
  const color  = opts.color ? rgb(opts.color[0], opts.color[1], opts.color[2]) : rgb(0, 0, 0);
  const indent = opts.indent ?? 0;
  const maxW   = PAGE_W - 2 * M - indent;
  const lines  = wrap(sanitize(text), maxW, sz, font);
  for (const ln of lines) {
    ensureSpace(ctx, sz + 4);
    ctx.page.drawText(ln, { x: M + indent, y: ctx.y - sz, size: sz, font, color });
    ctx.y -= sz + 4;
  }
}

function drawHr(ctx: PageCtx, color: [number, number, number] = [0.85, 0.85, 0.85]): void {
  ensureSpace(ctx, 8);
  ctx.page.drawLine({
    start: { x: M, y: ctx.y - 4 },
    end:   { x: PAGE_W - M, y: ctx.y - 4 },
    thickness: 0.5,
    color: rgb(color[0], color[1], color[2]),
  });
  ctx.y -= 10;
}

// ── Photo embedding ───────────────────────────────────────────────────

interface PhotoEmbedResult { ok: boolean; image: PDFImage | null }

async function fetchAndEmbedPhoto(
  ctx: PageCtx,
  storage: InspectionPdfArgs['storage'],
  path:    string,
): Promise<PhotoEmbedResult> {
  try {
    const { data, error } = await storage.from(PHOTO_BUCKET).download(path);
    if (error || !data) return { ok: false, image: null };
    const bytes = await blobToBytes(data);
    const mime  = detectImageMime(bytes);
    if (!mime) return { ok: false, image: null };
    const img   = mime === 'png'
      ? await ctx.pdf.embedPng(bytes)
      : await ctx.pdf.embedJpg(bytes);
    return { ok: true, image: img };
  } catch {
    return { ok: false, image: null };
  }
}

function drawPhotoSlot(ctx: PageCtx, image: PDFImage | null, x: number, y: number, label: string): void {
  // Border
  ctx.page.drawRectangle({
    x, y, width: PHOTO_W, height: PHOTO_H,
    borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.5,
    color: rgb(0.97, 0.97, 0.97),
  });
  if (image) {
    // Fit-cover (preserve aspect ratio inside the box)
    const iw = image.width;
    const ih = image.height;
    const scale = Math.min(PHOTO_W / iw, PHOTO_H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.page.drawImage(image, {
      x: x + (PHOTO_W - dw) / 2,
      y: y + (PHOTO_H - dh) / 2,
      width: dw, height: dh,
    });
  } else {
    ctx.page.drawText(sanitize('[photo unavailable]'), {
      x: x + 8, y: y + PHOTO_H / 2 - 4,
      size: SMALL_SZ, font: ctx.font, color: rgb(0.5, 0.5, 0.5),
    });
  }
  // Caption beneath the box
  ctx.page.drawText(sanitize(label).slice(0, 60), {
    x, y: y - 10,
    size: SMALL_SZ, font: ctx.font, color: rgb(0.4, 0.4, 0.4),
  });
}

// ── Cover page ────────────────────────────────────────────────────────

function drawCover(ctx: PageCtx, args: InspectionPdfArgs): void {
  const { inspection, app } = args;
  const title = INSPECTION_TYPE_LABEL[inspection.inspection_type] || 'CONDITION REPORT';

  // Title bar
  ctx.page.drawRectangle({
    x: 0, y: PAGE_H - 70, width: PAGE_W, height: 70,
    color: rgb(0.07, 0.18, 0.35),
  });
  ctx.page.drawText(sanitize(title), {
    x: M, y: PAGE_H - 45, size: TITLE_SZ, font: ctx.bold, color: rgb(1, 1, 1),
  });
  ctx.page.drawText('Choice Properties', {
    x: M, y: PAGE_H - 62, size: BODY_SZ, font: ctx.font, color: rgb(0.85, 0.9, 1),
  });
  ctx.y = PAGE_H - 90;

  drawLine(ctx, 'PROPERTY', { sz: H_SZ, bold: true });
  drawLine(ctx, app.property_address || '(address not on record)', { sz: BODY_SZ });
  ctx.y -= 6;

  drawLine(ctx, 'PARTIES', { sz: H_SZ, bold: true });
  const tenantName = [app.first_name, app.last_name].filter(Boolean).join(' ').trim() || '(tenant name on file)';
  drawLine(ctx, 'Tenant:   ' + tenantName + (app.email ? ' <' + app.email + '>' : ''), { sz: BODY_SZ });
  drawLine(ctx, 'Landlord: ' + (app.lease_landlord_name || 'Choice Properties'), { sz: BODY_SZ });
  if (app.lease_landlord_address) {
    drawLine(ctx, '          ' + app.lease_landlord_address, { sz: BODY_SZ });
  }
  ctx.y -= 6;

  drawLine(ctx, 'TIMING', { sz: H_SZ, bold: true });
  drawLine(ctx, 'Scheduled for : ' + fmtDateTime(inspection.scheduled_for),  { sz: BODY_SZ });
  drawLine(ctx, 'Completed at  : ' + fmtDateTime(inspection.completed_at),   { sz: BODY_SZ });
  drawLine(ctx, 'Completed by  : ' + (inspection.completed_by_role || '—'),  { sz: BODY_SZ });
  ctx.y -= 6;

  if (inspection.notes) {
    drawLine(ctx, 'INSPECTOR NOTES', { sz: H_SZ, bold: true });
    drawLine(ctx, inspection.notes, { sz: BODY_SZ });
    ctx.y -= 6;
  }

  drawHr(ctx);
  drawLine(ctx, sanitize(
    'This document records the condition of the rental property as observed and ' +
    'agreed by the parties named above. Both parties should keep a copy. Damage ' +
    'or wear noted in this report shall be the baseline for any future security ' +
    'deposit accounting. Inspection ID: ' + inspection.id
  ), { sz: SMALL_SZ, color: [0.4, 0.4, 0.4] });
}

// ── Per-room pages ────────────────────────────────────────────────────

async function drawRoom(
  ctx:     PageCtx,
  roomKey: string,
  room:    InspectionRoom,
  storage: InspectionPdfArgs['storage'],
  counters: { embedded: number; failed: number },
): Promise<void> {
  // Always start a room on a fresh page so each section is self-contained.
  newPage(ctx);

  drawLine(ctx, humanRoomName(roomKey), { sz: TITLE_SZ - 2, bold: true });
  drawHr(ctx);

  const items = room.items || [];
  if (items.length === 0) {
    drawLine(ctx, '(no items recorded)', { sz: BODY_SZ, color: [0.5, 0.5, 0.5] });
    return;
  }

  for (const item of items) {
    ensureSpace(ctx, 80);

    // Item header line: "Stove   —   GOOD"
    const cond = (item.condition || '').toUpperCase();
    const condColor: [number, number, number] =
      cond === 'GOOD'    ? [0.0, 0.5, 0.1] :
      cond === 'FAIR'    ? [0.7, 0.5, 0.0] :
      cond === 'POOR'    ? [0.8, 0.3, 0.0] :
      cond === 'DAMAGED' ? [0.7, 0.0, 0.0] :
                            [0.3, 0.3, 0.3];

    ensureSpace(ctx, BODY_SZ + 4);
    ctx.page.drawText(sanitize(item.name || '(unnamed)'), {
      x: M, y: ctx.y - BODY_SZ,
      size: BODY_SZ + 1, font: ctx.bold, color: rgb(0, 0, 0),
    });
    if (cond) {
      ctx.page.drawText(sanitize('  -  ' + cond), {
        x: M + ctx.bold.widthOfTextAtSize(item.name || '(unnamed)', BODY_SZ + 1),
        y: ctx.y - BODY_SZ,
        size: BODY_SZ + 1, font: ctx.bold,
        color: rgb(condColor[0], condColor[1], condColor[2]),
      });
    }
    ctx.y -= BODY_SZ + 6;

    if (item.notes) {
      drawLine(ctx, item.notes, { sz: BODY_SZ, indent: 12, color: [0.2, 0.2, 0.2] });
    }

    const photoPaths = (item.photo_paths || []).slice(0, MAX_PHOTOS_PER_ITEM);
    if (photoPaths.length > 0) {
      // Lay out photos in rows of PHOTOS_PER_ROW
      let i = 0;
      while (i < photoPaths.length) {
        // Each row takes PHOTO_H + 18 (caption + gap)
        ensureSpace(ctx, PHOTO_H + 22);
        const rowTop = ctx.y;
        const rowItems = photoPaths.slice(i, i + PHOTOS_PER_ROW);
        for (let c = 0; c < rowItems.length; c++) {
          const path  = rowItems[c];
          const x     = M + c * (PHOTO_W + 12);
          const yBox  = rowTop - PHOTO_H;
          // eslint-disable-next-line no-await-in-loop
          const r     = await fetchAndEmbedPhoto(ctx, storage, path);
          if (r.ok) counters.embedded++; else counters.failed++;
          drawPhotoSlot(ctx, r.image, x, yBox, path.split('/').pop() || '');
        }
        ctx.y = rowTop - PHOTO_H - 18;
        i += PHOTOS_PER_ROW;
      }
    }

    ctx.y -= 8;
    drawHr(ctx, [0.93, 0.93, 0.93]);
  }
}

// ── Signature page ────────────────────────────────────────────────────

async function drawSignatures(ctx: PageCtx, args: InspectionPdfArgs): Promise<void> {
  const { inspection, app } = args;
  newPage(ctx);

  drawLine(ctx, 'ACKNOWLEDGEMENT & SIGNATURES', { sz: TITLE_SZ - 2, bold: true });
  drawHr(ctx);
  drawLine(ctx, sanitize(
    'By signing below, each party acknowledges that the conditions documented in ' +
    'the preceding pages accurately reflect the state of the property as of the ' +
    'completion date listed on the cover page.'
  ), { sz: BODY_SZ });
  ctx.y -= 14;

  // Tenant block
  drawLine(ctx, 'TENANT', { sz: H_SZ, bold: true });
  const tenantName = [app.first_name, app.last_name].filter(Boolean).join(' ').trim();
  drawLine(ctx, 'Name:        ' + (tenantName || '—'), { sz: BODY_SZ });
  drawLine(ctx, 'Signed at:   ' + fmtDateTime(inspection.tenant_signed_at), { sz: BODY_SZ });
  await embedSig(ctx, inspection.tenant_sig_image, 'Tenant signature');
  ctx.y -= 18;

  // Landlord block
  drawLine(ctx, 'LANDLORD', { sz: H_SZ, bold: true });
  drawLine(ctx, 'Name:        ' + (app.lease_landlord_name || 'Choice Properties'), { sz: BODY_SZ });
  drawLine(ctx, 'Signed at:   ' + fmtDateTime(inspection.landlord_signed_at), { sz: BODY_SZ });
  await embedSig(ctx, inspection.landlord_sig_image, 'Landlord signature');
  ctx.y -= 24;

  drawHr(ctx);
  drawLine(ctx, sanitize(
    'Inspection ID: ' + inspection.id +
    '  |  Application: ' + inspection.app_id +
    '  |  Photos embedded: ' + (inspection.photos_count ?? 0) +
    '  |  Generated: ' + fmtDateTime(new Date().toISOString())
  ), { sz: SMALL_SZ, color: [0.4, 0.4, 0.4] });
}

async function embedSig(ctx: PageCtx, dataUrl: string | null | undefined, label: string): Promise<void> {
  // Always draw the line + label; image is optional.
  ensureSpace(ctx, 60);
  const lineY = ctx.y - 30;
  ctx.page.drawLine({
    start: { x: M, y: lineY }, end: { x: M + 260, y: lineY },
    thickness: 0.7, color: rgb(0.2, 0.2, 0.2),
  });
  ctx.page.drawText(sanitize(label), {
    x: M, y: lineY - 12, size: SMALL_SZ, font: ctx.font, color: rgb(0.4, 0.4, 0.4),
  });

  const decoded = decodeDataUrl(dataUrl || null);
  if (decoded) {
    try {
      const img = decoded.mime === 'png'
        ? await ctx.pdf.embedPng(decoded.bytes)
        : await ctx.pdf.embedJpg(decoded.bytes);
      const sigW = 220;
      const scale = sigW / img.width;
      const sigH = Math.min(50, img.height * scale);
      ctx.page.drawImage(img, { x: M + 8, y: lineY + 2, width: sigW, height: sigH });
    } catch { /* fall through — line stays */ }
  }
  ctx.y = lineY - 24;
}

// ── Public entry point ────────────────────────────────────────────────

export async function buildInspectionPDF(args: InspectionPdfArgs): Promise<InspectionPdfResult> {
  const pdf  = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ctx: PageCtx = {
    pdf, font, bold,
    page: pdf.addPage([PAGE_W, PAGE_H]),
    y:    PAGE_H - M,
  };

  drawCover(ctx, args);

  const counters = { embedded: 0, failed: 0 };
  const sortedKeys = Object.keys(args.inspection.rooms || {}).sort(
    (a, b) => roomSortKey(a) - roomSortKey(b),
  );
  for (const key of sortedKeys) {
    // eslint-disable-next-line no-await-in-loop
    await drawRoom(ctx, key, args.inspection.rooms[key] || {}, args.storage, counters);
  }

  await drawSignatures(ctx, args);

  const bytes = await pdf.save();
  return {
    bytes,
    page_count:      pdf.getPageCount(),
    photos_embedded: counters.embedded,
    photos_failed:   counters.failed,
  };
}
