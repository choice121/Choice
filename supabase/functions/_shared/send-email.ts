/**
 * send-email.ts
 * Dual-provider email helper: tries Resend first, falls back to GAS relay,
 * then falls back to Gmail via nodemailer.
 * Failure is non-fatal — callers should log errors but not crash.
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

  // ── 2. Try GAS relay ──────────────────────────────────────────────────────
  // M-3: send a signed (ts + sig) payload. The GAS relay still accepts the
  // legacy `secret` field for one rollout cycle, but new traffic must use
  // HMAC so a leaked secret is only valid for ±5 minutes.
  if (gasUrl && gasSecret && (payload.template || payload.html)) {
    try {
      const gasTemplate = payload.template || 'raw_html';
      const gasData = gasTemplate === 'raw_html'
        ? { ...(payload.data ?? {}), subject: payload.subject || 'Choice Properties', html: payload.html || '' }
        : (payload.data ?? {});
      const ts = Math.floor(Date.now() / 1000);
      // ROLLOUT NOTE: we include BOTH the legacy `secret` field AND the new
      // signed (`ts` + `sig`) fields. The Apps Script relay can only be
      // deployed manually by the owner; until they redeploy the updated
      // GAS code, the relay will accept us via the legacy `secret` check.
      // After the GAS update is live, the relay prefers `sig` and the
      // legacy field is ignored — at which point we can drop it here.
      const inner = {
        ts,
        secret: gasSecret,           // legacy compatibility — see comment above
        template: gasTemplate,
        to: payload.to,
        cc: payload.cc ?? null,
        data: gasData,
      };
      // Sign the (ts + body) pair. The body bytes are the inner JSON minus
      // the eventual `sig` field, so we serialise once for signing then
      // re-serialise WITH `sig` for the actual HTTP send.
      const innerJson = JSON.stringify(inner);
      const sig = await hmacSha256Hex(gasSecret, ts + '.' + innerJson);
      const r = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inner, sig }),
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok && json.success !== false) return { ok: true, provider: 'gas' };
      console.warn('GAS relay failed:', json.error || r.status, '— trying Gmail');
    } catch (e) { console.warn('GAS relay threw:', (e as Error)?.message, '— trying Gmail'); }
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
