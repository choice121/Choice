/**
 * Signed HMAC-SHA256 upload tokens scoped to an application ID so applicants in
 * post-submission and guest Tenant Portal sessions can upload documents directly
 * via request-upload-url without triggering 401 errors.
 */

const TEXT_ENC = new TextEncoder();
const TEXT_DEC = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getSigningKey(): Promise<CryptoKey | null> {
  const secret =
    Deno.env.get('PORTAL_UPLOAD_SECRET') ||
    Deno.env.get('SSN_HMAC_KEY') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    '';
  if (!secret) return null;
  const hash = await crypto.subtle.digest('SHA-256', TEXT_ENC.encode('cp-portal-upload-v1:' + secret));
  return await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export interface PortalUploadClaims {
  app_id: string;
  email?: string;
  exp: number;
}

export async function createPortalUploadToken(
  appId: string,
  email?: string,
  ttlMs = 24 * 60 * 60 * 1000,
): Promise<string | null> {
  if (!appId) return null;
  const key = await getSigningKey();
  if (!key) return null;
  const claims: PortalUploadClaims = {
    app_id: String(appId).trim(),
    email: email ? String(email).trim().toLowerCase() : undefined,
    exp: Date.now() + ttlMs,
  };
  const payloadB64 = bytesToBase64Url(TEXT_ENC.encode(JSON.stringify(claims)));
  const sigBuf = await crypto.subtle.sign('HMAC', key, TEXT_ENC.encode(payloadB64));
  return `${payloadB64}.${bytesToBase64Url(new Uint8Array(sigBuf))}`;
}

export async function verifyPortalUploadToken(token: string): Promise<PortalUploadClaims | null> {
  const raw = String(token || '').trim();
  const dot = raw.indexOf('.');
  if (dot <= 0 || dot === raw.length - 1) return null;
  const payloadB64 = raw.slice(0, dot);
  const sigB64 = raw.slice(dot + 1);
  const key = await getSigningKey();
  if (!key) return null;
  try {
    const sigBytes = base64UrlToBytes(sigB64);
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, TEXT_ENC.encode(payloadB64));
    if (!valid) return null;
    const claims = JSON.parse(TEXT_DEC.decode(base64UrlToBytes(payloadB64))) as PortalUploadClaims;
    if (!claims?.app_id || !claims?.exp || Number(claims.exp) <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
