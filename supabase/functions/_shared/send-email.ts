/**
 * send-email.ts
 *
 * Single-purpose email helper for the Supabase edge functions.
 *
 * Sole transport: Google Apps Script relay (`GAS_EMAIL_URL` +
 * `GAS_RELAY_SECRET`). Every call is HMAC-signed — see `gasSend()`.
 *
 * History:
 *   - Resend was removed in Phase 14.
 *   - Gmail SMTP fallback was removed on 2026-04-27 (audit fix E-1).
 *   - 2026-04-28 (E-5): switched to URL-based signature over the raw
 *     request body. Eliminates the entire Apps-Script-V8 vs Deno-V8
 *     UTF-8 round-trip parity bug class. See gasSend() for details.
 *
 * Failure is non-fatal — callers should log errors but never crash.
 */

// ── HMAC-SHA256 helper for the GAS-relay request signature ──────────────────
// Returns lowercase hex. WebCrypto is available in the Deno Edge runtime.
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sigBuf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// ── gasSend: shared GAS-relay caller ────────────────────────────────────────
// Every GAS call goes through this helper so they all sign identically.
//
// Wire format (E-5, 2026-04-28):
//   POST {GAS_EMAIL_URL}?ts=<unix_seconds>&sig=<hex>
//   body: JSON.stringify({ template, to, cc, data })
//   sig = HMAC-SHA256(RELAY_SECRET, ts + '.' + bodyText)  (lowercase hex)
//
// Why URL params instead of in-body sig:
//   The previous in-body scheme had to JSON.parse → strip sig →
//   JSON.stringify on the GAS side to reconstruct the signed bytes.
//   Apps Script V8 and Deno V8 disagreed on UTF-8 round-tripping in
//   that re-stringify step, breaking HMAC parity for any payload with
//   a non-ASCII char (em-dash, ✓, ✅, etc.). Putting the sig in the URL
//   lets GAS verify against `e.postData.contents` directly — the exact
//   UTF-8 bytes Deno sent, no re-encoding involved.
//
// The relay accepts BOTH the URL scheme and the legacy in-body scheme
// during the deploy transition; once redeployed, both work.

export interface GasSendInput {
  template: string;                          // GAS template name (e.g. 'inquiry_reply')
  to: string;                                // recipient email
  cc?: string | null;                        // optional cc
  data?: Record<string, unknown>;            // template variables
}

export interface GasSendResult {
  ok: boolean;
  status: number;
  error?: string;
}

export async function gasSend(input: GasSendInput): Promise<GasSendResult> {
  const gasUrl    = Deno.env.get('GAS_EMAIL_URL');
  const gasSecret = Deno.env.get('GAS_RELAY_SECRET');
  if (!gasUrl || !gasSecret) {
    return { ok: false, status: 0, error: 'GAS_EMAIL_URL or GAS_RELAY_SECRET not configured' };
  }

  const ts = Math.floor(Date.now() / 1000);
  const bodyText = JSON.stringify({
    ts,
    template: input.template,
    to: input.to,
    cc: input.cc ?? null,
    data: input.data ?? {},
  });
  const sig = await hmacSha256Hex(gasSecret, ts + '.' + bodyText);

  const sep = gasUrl.includes('?') ? '&' : '?';
  const url = `${gasUrl}${sep}ts=${ts}&sig=${sig}`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyText,
    });
    let json: any = {};
    try { json = await r.json(); } catch { /* relay sometimes returns text */ }
    const ok = r.ok && json.success !== false;
    return ok
      ? { ok: true, status: r.status }
      : { ok: false, status: r.status, error: json.error || `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error)?.message || 'Network error' };
  }
}

export interface EmailPayload {
  to: string
  subject?: string
  html?: string
  template?: string
  data?: Record<string, unknown>
  cc?: string | null
}

export interface EmailResult {
  ok: boolean
  provider: 'gas' | 'none'
  error?: string
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const gasUrl    = Deno.env.get('GAS_EMAIL_URL');
  const gasSecret = Deno.env.get('GAS_RELAY_SECRET');

  if (!gasUrl || !gasSecret) {
    console.warn('sendEmail: GAS_EMAIL_URL / GAS_RELAY_SECRET not configured');
    return { ok: false, provider: 'none', error: 'GAS relay not configured' };
  }
  if (!payload.template && !payload.html) {
    return { ok: false, provider: 'none', error: 'sendEmail requires either template or html' };
  }

  const template = payload.template || 'raw_html';
  const data = template === 'raw_html'
    ? { ...(payload.data ?? {}), subject: payload.subject || 'Choice Properties', html: payload.html || '' }
    : (payload.data ?? {});
  const res = await gasSend({ template, to: payload.to, cc: payload.cc ?? null, data });
  if (res.ok) return { ok: true, provider: 'gas' };
  console.error('GAS relay send failed:', res.error);
  return { ok: false, provider: 'none', error: res.error || `GAS relay HTTP ${res.status}` };
}
