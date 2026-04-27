// supabase/functions/send-magic-link/index.ts
//
// Generates a Supabase magic-link via the Admin API and ships the email
// ourselves through our existing branded sender (Resend → GAS → Gmail SMTP),
// so the inbox copy comes from Choice Properties — not Supabase's default
// unbranded "noreply@mail.app.supabase.io" template.
//
// CALLED PUBLICLY (verify_jwt = false). Rate-limited per email.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { buildCorsHeaders, corsResponse } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/send-email.ts";
import { isDbRateLimited } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Static CORS headers for non-OPTIONS responses — pinned to production origin.
// OPTIONS preflights use corsResponse(origin) for preview-deploy support.
const CORS = {
  ...buildCorsHeaders(null),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Per-email send cap: 3 sends / 10 min. Backed by the shared rate_limit_log
// table so the cap survives Edge Function cold starts and is consistent across
// every isolate (the previous in-memory Map was per-instance and bypassable
// under autoscaling, allowing email-bomb attacks against any address).
const MAGIC_LINK_MAX_PER_WINDOW = 3;
const MAGIC_LINK_WINDOW_MS      = 10 * 60 * 1000;

function brandedHtml(actionLink: string, email: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Sign in to Choice Properties</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e">
<span style="display:none!important;opacity:0;height:0;width:0;overflow:hidden">Your secure sign-in link for Choice Properties.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f7;padding:40px 16px">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)">
      <tr><td style="background:#1e3a8a;padding:24px 32px;color:#fff;font-size:18px;font-weight:700;letter-spacing:.02em">Choice Properties</td></tr>
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a2e">Sign in to your tenant portal</h1>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#3b3b52">Hi <strong>${email}</strong>,</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#3b3b52">Click the button below to securely sign in. This link expires in 1 hour and can only be used once.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px"><tr><td align="center" bgcolor="#1e3a8a" style="border-radius:8px">
          <a href="${actionLink}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background:#1e3a8a">Sign In Securely</a>
        </td></tr></table>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.5">If the button does not work, copy &amp; paste this link:</p>
        <p style="margin:0 0 24px;font-size:12px;color:#1e3a8a;word-break:break-all">${actionLink}</p>
        <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">If you did not request this email, you can safely ignore it. Need help? Reply to this email or call 707-706-3137.</p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 32px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb">
        Choice Properties · <a href="mailto:support@choiceproperties.com" style="color:#6b7280;text-decoration:none">support@choiceproperties.com</a>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

function brandedText(actionLink: string): string {
  return `Sign in to your Choice Properties tenant portal

Use the secure link below to sign in. It expires in 1 hour and can only be used once.

${actionLink}

If you did not request this email, you can safely ignore it.
Need help? Reply to this email or call 707-706-3137.

— Choice Properties
support@choiceproperties.com`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req.headers.get("origin"));
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: { email?: string; redirectTo?: string };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }); }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "invalid_email" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  if (await isDbRateLimited('email:' + email, 'send-magic-link', MAGIC_LINK_MAX_PER_WINDOW, MAGIC_LINK_WINDOW_MS)) {
    return new Response(JSON.stringify({ error: "rate_limited", message: "Too many sign-in requests. Please wait a few minutes and try again." }), {
      status: 429, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const SITE_URL = (Deno.env.get("SITE_URL") || "https://choice-properties-site.pages.dev").replace(/\/$/, "");
  const redirectTo = body.redirectTo || `${SITE_URL}/tenant/portal.html`;

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (error) throw error;

    // Build a cross-browser-safe link that points at our own callback page
    // and uses the token_hash flow (no PKCE verifier required, so the link
    // works when opened in a different browser than the one that requested it).
    const tokenHash = data?.properties?.hashed_token;
    let actionLink: string;
    if (tokenHash) {
      const cb = new URL(`${SITE_URL}/auth/callback.html`);
      cb.searchParams.set("token_hash", tokenHash);
      cb.searchParams.set("type", "magiclink");
      cb.searchParams.set("next", redirectTo);
      actionLink = cb.toString();
    } else {
      actionLink = data?.properties?.action_link;
    }
    if (!actionLink) throw new Error("no_action_link");

    await sendEmail({
      to: email,
      subject: "Sign in to Choice Properties",
      html: brandedHtml(actionLink, email),
      text: brandedText(actionLink),
      replyTo: "support@choiceproperties.com",
    });

    // Always return 200 with `sent` to avoid leaking whether the email exists.
    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-magic-link error", err);
    return new Response(JSON.stringify({ error: "send_failed", message: String(err?.message || err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
