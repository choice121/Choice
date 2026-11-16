/**
 * ssn-crypto.ts — AES-256-GCM encryption + HMAC-SHA256 indexing + SSA format validation
 * for full 9-digit Social Security Numbers stored in application_applicants.
 *
 * Security invariants:
 *   - Raw 9-digit SSNs MUST NEVER be stored in applications, draft_applications, localStorage,
 *     email payloads, or logs.
 *   - Encrypted format: `v1:<12-byte-iv-base64>:<ciphertext-with-tag-base64>`
 */

const TEXT_ENC = new TextEncoder();
const TEXT_DEC = new TextDecoder();

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function normalizeSsnDigits(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

export function formatFullSsn(digits: string): string {
  const d = normalizeSsnDigits(digits);
  if (d.length !== 9) return '';
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5, 9)}`;
}

export function formatMaskedSsn(rawOrDigits: unknown): string | null {
  const d = normalizeSsnDigits(rawOrDigits);
  if (d.length < 4) return null;
  return `XXX-XX-${d.slice(-4)}`;
}

export function extractSsnLast4(rawOrDigits: unknown): string | null {
  const d = normalizeSsnDigits(rawOrDigits);
  if (d.length < 4) return null;
  return d.slice(-4);
}

/**
 * Validate a complete 9-digit US SSN against SSA allocation rules:
 *   - Exactly 9 digits
 *   - Area number (digits 1-3) cannot be 000, 666, or 900-999
 *   - Group number (digits 4-5) cannot be 00
 *   - Serial number (digits 6-9) cannot be 0000
 */
export function validateFullSsn(raw: unknown): { ok: true; digits: string; formatted: string; last4: string; masked: string } | { ok: false; error: string } {
  const digits = normalizeSsnDigits(raw);
  if (digits.length !== 9) {
    return { ok: false, error: 'Complete 9-digit Social Security Number (XXX-XX-XXXX) is required.' };
  }
  const area = parseInt(digits.slice(0, 3), 10);
  const group = parseInt(digits.slice(3, 5), 10);
  const serial = parseInt(digits.slice(5, 9), 10);

  if (area === 0 || area === 666 || area >= 900) {
    return { ok: false, error: 'Invalid SSN: first three digits cannot be 000, 666, or 900–999.' };
  }
  if (group === 0) {
    return { ok: false, error: 'Invalid SSN: middle two digits cannot be 00.' };
  }
  if (serial === 0) {
    return { ok: false, error: 'Invalid SSN: last four digits cannot be 0000.' };
  }
  return {
    ok: true,
    digits,
    formatted: formatFullSsn(digits),
    last4: digits.slice(-4),
    masked: `XXX-XX-${digits.slice(-4)}`,
  };
}

async function importAesKey(): Promise<CryptoKey> {
  const rawB64 = Deno.env.get('SSN_ENCRYPTION_KEY');
  if (!rawB64) throw new Error('SSN_ENCRYPTION_KEY is not configured');
  const keyBytes = base64ToBytes(rawB64);
  if (keyBytes.byteLength !== 32) {
    throw new Error('SSN_ENCRYPTION_KEY must decode to 32 bytes (256 bits)');
  }
  return await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptSsn(rawOrDigits: string): Promise<string> {
  const digits = normalizeSsnDigits(rawOrDigits);
  if (digits.length !== 9) throw new Error('encryptSsn requires 9 digits');
  const key = await importAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    TEXT_ENC.encode(formatFullSsn(digits)),
  );
  return `v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ctBuf))}`;
}

export async function decryptSsn(encrypted: string): Promise<string> {
  if (!encrypted || !encrypted.startsWith('v1:')) {
    throw new Error('Unsupported or missing encrypted SSN format');
  }
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted SSN');
  const iv = base64ToBytes(parts[1]);
  const ct = base64ToBytes(parts[2]);
  const key = await importAesKey();
  const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return TEXT_DEC.decode(ptBuf);
}

export async function hashSsn(rawOrDigits: string): Promise<string> {
  const digits = normalizeSsnDigits(rawOrDigits);
  if (digits.length !== 9) throw new Error('hashSsn requires 9 digits');
  const rawB64 = Deno.env.get('SSN_HMAC_KEY');
  if (!rawB64) throw new Error('SSN_HMAC_KEY is not configured');
  const keyBytes = base64ToBytes(rawB64);
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', hmacKey, TEXT_ENC.encode(digits));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
