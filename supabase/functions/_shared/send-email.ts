/**
 * send-email.ts
 * Dual-provider email helper: tries Resend first, falls back to GAS relay,
 * then falls back to Gmail via nodemailer.
 * Failure is non-fatal — callers should log errors but not crash.
 *
 * Also exports `gasSend()`: a dedicated helper for callers that already
 * know they want to hit the GAS relay directly with a named template
 * (send-inquiry, send-message). It centralises the HMAC signing introduced
 * in M-3 so every GAS call uses the same payload shape.
 */

import nodemailer from 'npm:nodemailer@6.9.16';

// ── M-3: HMAC-SHA256 helper for the GAS-relay request signature ─────────────
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
// Resolves issue #25 — send-inquiry and send-message previously built the GAS
// payload by hand and only sent the legacy `secret` field, so any GAS-side
// rollout that drops legacy auth would break those two functions. Funnel
// every GAS call through this helper so they all sign identically.
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

/**
 * POST a signed payload to the GAS email relay. Issue #24 (Apr 26 2026):
 * the legacy `secret` field has been removed — every call is now HMAC-signed
 * (`ts` + `sig`). The companion change in `GAS-EMAIL-RELAY.gs` removes the
 * legacy acceptance path on the relay side.
 */
export async function gasSend(input: GasSendInput): Promise<GasSendResult> {
  const gasUrl    = Deno.env.get('GAS_EMAIL_URL');
  const gasSecret = Deno.env.get('GAS_RELAY_SECRET');
  if (!gasUrl || !gasSecret) {
    return { ok: false, status: 0, error: 'GAS_EMAIL_URL or GAS_RELAY_SECRET not configured' };
  }

  const ts = Math.floor(Date.now() / 1000);
  // Signed mode only — no legacy `secret` field. The HMAC is computed over
  // the EXACT body that gets serialised below so re-serialisation can never
  // shift a byte and invalidate the signature.
  const inner = {
    ts,
    template: input.template,
    to: input.to,
    cc: input.cc ?? null,
    data: input.data ?? {},
  };
  const innerJson = JSON.stringify(inner);
  const sig = await hmacSha256Hex(gasSecret, ts + '.' + innerJson);

  try {
    const r = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...inner, sig }),
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
  provider: 'resend' | 'gas' | 'gmail' | 'none'
  error?: string
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const gasUrl    = Deno.env.get('GAS_EMAIL_URL');
  const gasSecret = Deno.env.get('GAS_RELAY_SECRET');
  const gmailUser = Deno.env.get('GMAIL_USER');
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');

  // ── 1. Try Resend ─────────────────────────────────────────────────────────
  if (resendKey && payload.html) {
    try {
      const from = Deno.env.get('RESEND_FROM') || `Choice Properties <${gmailUser}>`;
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
        body: JSON.stringify({ from, to: payload.to, subject: payload.subject || 'Choice Properties', html: payload.html }),
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok && json.id) return { ok: true, provider: 'resend' };
      console.warn('Resend failed:', r.status, JSON.stringify(json), '— trying next provider');
    } catch (e) { console.warn('Resend threw:', (e as Error)?.message, '— trying next provider'); }
  }

  // ── 2. Try GAS relay (via shared signed helper) ───────────────────────────
  if (gasUrl && gasSecret && (payload.template || payload.html)) {
    const template = payload.template || 'raw_html';
    const data = template === 'raw_html'
      ? { ...(payload.data ?? {}), subject: payload.subject || 'Choice Properties', html: payload.html || '' }
      : (payload.data ?? {});
    const res = await gasSend({ template, to: payload.to, cc: payload.cc ?? null, data });
    if (res.ok) return { ok: true, provider: 'gas' };
    console.warn('GAS relay failed:', res.error, '— trying Gmail');
  }

  // ── 3. Fall back to Gmail (nodemailer) ────────────────────────────────────
  if (gmailUser && gmailPass && payload.html) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });
      await transporter.sendMail({
        from: `"Choice Properties" <${gmailUser}>`,
        to:      payload.to,
        subject: payload.subject || 'Choice Properties',
        html:    payload.html,
      });
      return { ok: true, provider: 'gmail' };
    } catch (e) {
      const msg = (e as Error)?.message || 'unknown error';
      console.error('Gmail send failed:', msg);
      return { ok: false, provider: 'gmail', error: msg };
    }
  }

  console.warn('sendEmail: no provider configured/usable for this payload');
  return { ok: false, provider: 'none', error: 'No email provider available' };
}
