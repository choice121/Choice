/**
 * send-email.ts
 * Dual-provider email helper: tries Resend first, falls back to GAS relay,
 * then falls back to Gmail via nodemailer.
 * Failure is non-fatal — callers should log errors but not crash.
 */

import nodemailer from 'npm:nodemailer@6.9.16';

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
  if (gasUrl && gasSecret && (payload.template || payload.html)) {
    try {
      const gasTemplate = payload.template || 'raw_html';
      const gasData = gasTemplate === 'raw_html'
        ? { ...(payload.data ?? {}), subject: payload.subject || 'Choice Properties', html: payload.html || '' }
        : (payload.data ?? {});
      const r = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: gasSecret,
          template: gasTemplate,
          to: payload.to,
          cc: payload.cc ?? null,
          data: gasData,
        }),
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
