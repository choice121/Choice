/**
 * send-email.ts
 *
 * Single-purpose email helper for the Supabase edge functions.
 *
 * Sole transport: Google Apps Script relay (`GAS_EMAIL_URL` +
 * `GAS_RELAY_SECRET`). Every call is HMAC-signed (`ts` + `sig`) —
 * see `gasSend()`.
 *
 * History:
 *   - Resend was removed in Phase 14 — the project never had a
 *     `RESEND_API_KEY` provisioned, so the Resend branch was dead
 *     code that just delayed every send by one extra HTTP attempt.
 *   - Gmail SMTP fallback was removed on 2026-04-27 (audit fix E-1)
 *     so that GAS-relay failures surface to `email_logs` and the
 *     admin dashboard immediately, rather than being masked by a
 *     silent SMTP retry. The `GMAIL_USER` / `GMAIL_APP_PASSWORD`
 *     secrets can now be deleted from the Supabase function env.
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

// ── ASCII-only JSON.stringify (E-4 fix, 2026-04-28) ────────────────────────
// Apps Script V8 and Deno V8 disagree on UTF-8 round-tripping inside
// `e.postData.contents`, which broke the HMAC any time a non-ASCII
// character (em-dash, ✓, ✅, etc.) appeared in the email subject or HTML.
// Escaping every non-ASCII codepoint to its \uXXXX form keeps the signed
// canonical bytes identical on both runtimes. The matching helper exists
// in GAS-EMAIL-RELAY.gs — both must escape identically.
function jsonAscii(value: unknown): string {
  return JSON.stringify(value).replace(/[\u0080-\uffff]/g, (c) =>
    '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

// ── gasSend: shared GAS-relay caller ────────────────────────────────────────
// Every GAS call goes through this helper so they all sign identically (see
// issue #25). The legacy `secret` field acceptance was removed on the relay
// side in Apr 2026 (issue #24).
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
    to: input.to,
    cc: input.cc ?? null,
    data: input.data ?? {},
  };
  // E-4 (2026-04-28): use ASCII-only JSON for both signing AND body so that
  // GAS V8's `JSON.parse(rawBody)` -> `JSON.stringify(stripped)` produces
  // exactly the same bytes we signed. Native UTF-8 round-tripping in
  // Apps Script differs from Deno just enough to break HMAC parity for
  // any payload containing non-ASCII characters (em-dash, ✓, ✅, etc.).
  const innerJson = jsonAscii(inner);
  const sig = await hmacSha256Hex(gasSecret, ts + '.' + innerJson);

  try {
    const r = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonAscii({ ...inner, sig }),
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

  // GAS relay is the only transport. If it's not configured or the call
  // fails we surface that explicitly so the failure shows up in
  // email_logs and the admin can react. (Audit fix E-1, 2026-04-27.)
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
