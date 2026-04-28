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
 *   - 2026-04-28 (E-5a): briefly switched to URL-based sig but the
 *     query parameters were not surviving the GAS web-app redirect in
 *     practice, so we reverted to the in-body scheme. The new GAS
 *     verifier accepts both canonicalisations (plain JSON.stringify
 *     and the historical jsonAscii escape), so plain stringify is
 *     enough — no separate jsonAscii helper is needed on this side.
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
// Wire format (in-body sig, the proven scheme):
//   POST {GAS_EMAIL_URL}
//   body: JSON.stringify({ ...inner, sig })
//   inner = { ts, template, to, cc, data }
//   sig   = HMAC-SHA256(RELAY_SECRET, ts + '.' + JSON.stringify(inner))  hex
//
// The GAS verifier (authorizeRequest) re-canonicalises body-with-sig-stripped
// using both jsonAscii and plain JSON.stringify and accepts whichever matches,
// so we don't need a separate ASCII-escape pass on this side.

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
  const inner = {
    ts,
    template: input.template,
    to:       input.to,
    cc:       input.cc ?? null,
    data:     input.data ?? {},
  };
  const innerJson = JSON.stringify(inner);
  const sig       = await hmacSha256Hex(gasSecret, ts + '.' + innerJson);
  const fullBody  = JSON.stringify({ ...inner, sig });

  try {
    const r = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    fullBody,
    });
    let json: { success?: boolean; error?: string } = {};
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
