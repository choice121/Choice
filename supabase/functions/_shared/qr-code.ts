// supabase/functions/_shared/qr-code.ts
//
// QR Code generator -- Phase 06.
//
// =====================================================================
// Vendored from "QR Code generator library (TypeScript)" by Project Nayuki.
// Copyright (c) Project Nayuki. (MIT License)
// https://www.nayuki.io/page/qr-code-generator-library
//
// MIT License -- full text:
//
//   Permission is hereby granted, free of charge, to any person obtaining
//   a copy of this software and associated documentation files (the
//   "Software"), to deal in the Software without restriction, including
//   without limitation the rights to use, copy, modify, merge, publish,
//   distribute, sublicense, and/or sell copies of the Software, and to
//   permit persons to whom the Software is furnished to do so, subject
//   to the following conditions:
//
//   The above copyright notice and this permission notice shall be
//   included in all copies or substantial portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//   EXPRESS OR IMPLIED.
//
// Trimmed to the subset Phase 06 actually needs:
//   * Byte-mode encoding (UTF-8 ASCII URLs)
//   * Auto version selection 1..40
//   * ECC level L / M / Q / H
//   * Returns a 2-D boolean grid (true = dark module); the caller paints
//     it with pdf-lib rectangles.
// =====================================================================

export type EccLevel = 'L' | 'M' | 'Q' | 'H';

interface EccConst {
  ordinal:   number;        // for sorting
  formatBits: number;       // 2-bit format-info value
}
const ECC: Record<EccLevel, EccConst> = {
  L: { ordinal: 0, formatBits: 1 },
  M: { ordinal: 1, formatBits: 0 },
  Q: { ordinal: 2, formatBits: 3 },
  H: { ordinal: 3, formatBits: 2 },
};

// ── Per-(version, ecc) capacity tables ──────────────────────
// NUM_ERROR_CORRECTION_CODEWORDS[ecc][version] = total ECC codewords
const NUM_ERROR_CORRECTION_CODEWORDS: Record<EccLevel, number[]> = {
  L: [-1,  7, 10, 15, 20, 26, 36, 40, 48, 60,  72,  80,  96, 104, 120, 132, 144, 168, 180, 196, 224, 224, 252, 270, 300, 312, 336, 360, 390, 420, 450, 480, 510, 540, 570, 570, 600, 630, 660, 720, 750],
  M: [-1, 10, 16, 26, 36, 48, 64, 72, 88, 110, 130, 150, 176, 198, 216, 240, 280, 308, 338, 364, 416, 442, 476, 504, 560, 588, 644, 700, 728, 784, 812, 868, 924, 980, 1036, 1064, 1120, 1204, 1260, 1316, 1372],
  Q: [-1, 13, 22, 36, 52, 72, 96, 108, 132, 160, 192, 224, 260, 288, 320, 360, 408, 448, 504, 546, 600, 644, 690, 750, 810, 870, 952, 1020, 1050, 1140, 1200, 1290, 1350, 1440, 1530, 1590, 1680, 1770, 1860, 1950, 2040],
  H: [-1, 17, 28, 44, 64, 88, 112, 130, 156, 192, 224, 264, 308, 352, 384, 432, 480, 532, 588, 650, 700, 750, 816, 900, 960, 1050, 1110, 1200, 1260, 1350, 1440, 1530, 1620, 1710, 1800, 1890, 1980, 2100, 2220, 2310, 2430],
};

// NUM_ERROR_CORRECTION_BLOCKS[ecc][version] = number of EC blocks
const NUM_ERROR_CORRECTION_BLOCKS: Record<EccLevel, number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2,  4,  4,  4,  4,  4,  6,  6,  6,  6,  7,  8,  8,  9,  9, 10, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5,  5,  5,  8,  9,  9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8,  8,  8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8,  8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

// ── Total raw codeword count per version ───────────────────
function getNumRawDataModules(ver: number): number {
  if (ver < 1 || ver > 40) throw new RangeError('Version out of range');
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function getNumDataCodewords(ver: number, ecc: EccLevel): number {
  return Math.floor(getNumRawDataModules(ver) / 8) -
         NUM_ERROR_CORRECTION_CODEWORDS[ecc][ver];
}

// ── Reed-Solomon ECC over GF(2^8), generator polynomial x^8+x^4+x^3+x^2+1 ──
function reedSolomonComputeDivisor(degree: number): number[] {
  if (degree < 1 || degree > 255) throw new RangeError('Degree out of range');
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = reedSolomonMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = reedSolomonMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonComputeRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < divisor.length; i++) {
      result[i] ^= reedSolomonMultiply(divisor[i], factor);
    }
  }
  return result;
}

function reedSolomonMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xFF;
}

// ── BCH-encoded format/version words ────────────────────────
function getBitMaskFormat(ecc: EccLevel, mask: number): number {
  const data = (ECC[ecc].formatBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  return bits & 0x7FFF;
}

function getBitMaskVersion(ver: number): number {
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
  return ((ver << 12) | rem);
}

// ── Alignment pattern positions per version ────────────────
function getAlignmentPatternPositions(ver: number): number[] {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = (ver === 32)
    ? 26
    : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

// ── Bit-buffer helper ───────────────────────────────────────
class BitBuffer {
  bits: number[] = [];
  appendBits(val: number, len: number): void {
    if (len < 0 || len > 31 || val >>> len !== 0) {
      throw new RangeError('Value out of range');
    }
    for (let i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1);
  }
}

// ── Encode a byte-mode segment ──────────────────────────────
function encodeByteSegment(data: Uint8Array, ver: number): BitBuffer {
  const bb = new BitBuffer();
  bb.appendBits(0x4, 4);                  // mode indicator: byte
  const charCountBits = ver < 10 ? 8 : 16;
  if (data.length >= (1 << charCountBits)) {
    throw new RangeError('Byte data too long for this version');
  }
  bb.appendBits(data.length, charCountBits);
  for (const b of data) bb.appendBits(b, 8);
  return bb;
}

// ── Top-level encode ────────────────────────────────────────
export interface QRMatrix {
  size:    number;
  modules: boolean[][];   // modules[y][x] = true if dark
  version: number;
  ecc:     EccLevel;
}

export function encodeUrl(text: string, ecc: EccLevel = 'M'): QRMatrix {
  // UTF-8 encode -- our URLs are ASCII so this is identity.
  const data = new TextEncoder().encode(text);

  // Pick smallest version that fits (bias toward versions <=10 so the
  // QR stays compact on the certificate page).
  let ver = -1;
  for (let v = 1; v <= 40; v++) {
    const charCountBits = v < 10 ? 8 : 16;
    const usedBits      = 4 + charCountBits + data.length * 8;
    const capacityBits  = getNumDataCodewords(v, ecc) * 8;
    if (usedBits <= capacityBits) { ver = v; break; }
  }
  if (ver < 0) throw new RangeError('Data too long even for largest QR (version 40)');

  // Build the bit stream
  const bb = encodeByteSegment(data, ver);
  const dataCapacityBits = getNumDataCodewords(ver, ecc) * 8;

  // Terminator (up to 4 zero bits)
  const term = Math.min(4, dataCapacityBits - bb.bits.length);
  bb.appendBits(0, term);
  // Pad to next byte boundary
  bb.appendBits(0, (8 - bb.bits.length % 8) % 8);
  // Pad bytes 0xEC, 0x11 alternating until full
  for (let pad = 0xEC; bb.bits.length < dataCapacityBits; pad ^= 0xEC ^ 0x11) {
    bb.appendBits(pad, 8);
  }

  // Pack bits into bytes
  const dataCodewords = new Array<number>(bb.bits.length >>> 3).fill(0);
  for (let i = 0; i < bb.bits.length; i++) {
    dataCodewords[i >>> 3] |= bb.bits[i] << (7 - (i & 7));
  }

  // Split into blocks, append RS ECC
  const allCodewords = addEccAndInterleave(dataCodewords, ver, ecc);

  // Place modules + apply best mask
  const matrix = drawCodewords(ver, ecc, allCodewords);
  return matrix;
}

function addEccAndInterleave(data: number[], ver: number, ecc: EccLevel): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecc][ver];
  const blockEccLen = NUM_ERROR_CORRECTION_CODEWORDS[ecc][ver] / numBlocks;
  const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - rawCodewords % numBlocks;
  const shortBlockLen  = Math.floor(rawCodewords / numBlocks);

  const blocks: number[][] = [];
  const rsDiv = reedSolomonComputeDivisor(blockEccLen);
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const dataLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + dataLen);
    k += dataLen;
    const ecc_ = reedSolomonComputeRemainder(dat, rsDiv);
    if (i < numShortBlocks) dat.push(0); // pad for interleaving
    blocks.push(dat.concat(ecc_));
  }

  const result: number[] = [];
  // Interleave data
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        result.push(blocks[j][i]);
      }
    }
  }
  return result;
}

// ── Module placement + masking ──────────────────────────────
function drawCodewords(ver: number, ecc: EccLevel, codewords: number[]): QRMatrix {
  const size = ver * 4 + 17;
  // modules[y][x]; isFunc[y][x] tracks whether a module is reserved
  const modules: boolean[][]   = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const isFunc:  boolean[][]   = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

  // Function patterns
  drawFinder(0, 0, modules, isFunc, size);
  drawFinder(size - 7, 0, modules, isFunc, size);
  drawFinder(0, size - 7, modules, isFunc, size);
  // Timing patterns
  for (let i = 0; i < size; i++) {
    setF(modules, isFunc, 6, i, i % 2 === 0);
    setF(modules, isFunc, i, 6, i % 2 === 0);
  }
  // Alignment patterns
  const alignPos = getAlignmentPatternPositions(ver);
  for (let i = 0; i < alignPos.length; i++) {
    for (let j = 0; j < alignPos.length; j++) {
      // Skip the 3 corners that overlap finders
      if ((i === 0 && j === 0) ||
          (i === 0 && j === alignPos.length - 1) ||
          (i === alignPos.length - 1 && j === 0)) continue;
      drawAlignment(alignPos[i], alignPos[j], modules, isFunc);
    }
  }
  // Reserve format-info area (filled later with actual format bits)
  drawFormatBits(0, modules, isFunc, size);
  // Reserve version-info area for version >= 7
  if (ver >= 7) drawVersionBits(ver, modules, isFunc, size);

  // Place data codewords in zig-zag pattern (right-to-left, two columns at a time)
  const data = codewords;
  let i = 0; // bit index into data
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip vertical timing column
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunc[y][x] && i < data.length * 8) {
          modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }

  // Pick best mask
  let bestMask  = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(modules, isFunc, m);
    drawFormatBits(m, modules, isFunc, size);
    const score = getPenaltyScore(modules, size);
    if (score < bestScore) { bestScore = score; bestMask = m; }
    applyMask(modules, isFunc, m); // undo (xor twice = identity)
  }
  applyMask(modules, isFunc, bestMask);
  drawFormatBits(bestMask, modules, isFunc, size);

  return { size, modules, version: ver, ecc };
}

function setF(modules: boolean[][], isFunc: boolean[][], x: number, y: number, dark: boolean): void {
  modules[y][x] = dark;
  isFunc[y][x]  = true;
}

function drawFinder(x0: number, y0: number, modules: boolean[][], isFunc: boolean[][], size: number): void {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || x >= size || y < 0 || y >= size) continue;
      const dist = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      const dark = dist !== 2 && dist !== 4;
      setF(modules, isFunc, x, y, (dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6) ? dark : false);
    }
  }
}

function drawAlignment(cx: number, cy: number, modules: boolean[][], isFunc: boolean[][]): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      setF(modules, isFunc, cx + dx, cy + dy, dist !== 1);
    }
  }
}

function drawFormatBits(mask: number, modules: boolean[][], isFunc: boolean[][], size: number): void {
  // We don't actually have ecc here -- format bits depend on ecc + mask.
  // Caller must inject ecc through closure; instead we encode-on-fly.
  // (We thread ecc via a cached var on the modules array? Simpler: use a singleton.)
  const bits = formatBitsCache.get();
  void bits;
  // Real implementation in encodeFormatBits below.
  encodeFormatBits(modules, isFunc, size, mask);
}

const formatBitsCache = (() => {
  let ecc: EccLevel = 'M';
  return {
    set(e: EccLevel) { ecc = e; },
    get(): EccLevel { return ecc; },
  };
})();

function encodeFormatBits(modules: boolean[][], isFunc: boolean[][], size: number, mask: number): void {
  const bits = getBitMaskFormat(formatBitsCache.get(), mask);
  // Top-left finder strip
  for (let i = 0; i <= 5; i++) setF(modules, isFunc, 8, i, ((bits >>> i) & 1) !== 0);
  setF(modules, isFunc, 8, 7, ((bits >>> 6) & 1) !== 0);
  setF(modules, isFunc, 8, 8, ((bits >>> 7) & 1) !== 0);
  setF(modules, isFunc, 7, 8, ((bits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) setF(modules, isFunc, 14 - i, 8, ((bits >>> i) & 1) !== 0);
  // Bottom-left + top-right strips
  for (let i = 0; i < 8; i++) setF(modules, isFunc, size - 1 - i, 8, ((bits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++) setF(modules, isFunc, 8, size - 15 + i, ((bits >>> i) & 1) !== 0);
  setF(modules, isFunc, 8, size - 8, true); // dark module
}

function drawVersionBits(ver: number, modules: boolean[][], isFunc: boolean[][], size: number): void {
  const bits = getBitMaskVersion(ver);
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) !== 0;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setF(modules, isFunc, a, b, dark);
    setF(modules, isFunc, b, a, dark);
  }
}

function applyMask(modules: boolean[][], isFunc: boolean[][], mask: number): void {
  for (let y = 0; y < modules.length; y++) {
    for (let x = 0; x < modules.length; x++) {
      if (isFunc[y][x]) continue;
      let invert = false;
      switch (mask) {
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invert = (x * y) % 2 + (x * y) % 3 === 0; break;
        case 6: invert = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
        case 7: invert = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
      }
      if (invert) modules[y][x] = !modules[y][x];
    }
  }
}

function getPenaltyScore(modules: boolean[][], size: number): number {
  let result = 0;
  // Adjacent same-color modules in row/col
  for (let y = 0; y < size; y++) {
    let runColor = false, runX = 0;
    for (let x = 0; x < size; x++) {
      if (modules[y][x] === runColor) { runX++; if (runX === 5) result += 3; else if (runX > 5) result++; }
      else { runColor = modules[y][x]; runX = 1; }
    }
  }
  for (let x = 0; x < size; x++) {
    let runColor = false, runY = 0;
    for (let y = 0; y < size; y++) {
      if (modules[y][x] === runColor) { runY++; if (runY === 5) result += 3; else if (runY > 5) result++; }
      else { runColor = modules[y][x]; runY = 1; }
    }
  }
  // 2x2 blocks
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) {
        result += 3;
      }
    }
  }
  // Finder-like patterns
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size - 6; x++) {
      if (modules[y][x] && !modules[y][x+1] && modules[y][x+2] && modules[y][x+3] && modules[y][x+4] && !modules[y][x+5] && modules[y][x+6]) {
        result += 40;
      }
    }
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size - 6; y++) {
      if (modules[y][x] && !modules[y+1][x] && modules[y+2][x] && modules[y+3][x] && modules[y+4][x] && !modules[y+5][x] && modules[y+6][x]) {
        result += 40;
      }
    }
  }
  // Balance of dark vs light
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
  const total = size * size;
  const k = Math.floor(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += k * 10;
  return result;
}

// ── Public entry that threads ecc into the format-bits cache ──
export function generateQR(text: string, ecc: EccLevel = 'M'): QRMatrix {
  formatBitsCache.set(ecc);
  return encodeUrl(text, ecc);
}
