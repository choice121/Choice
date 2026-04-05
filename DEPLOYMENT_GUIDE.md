# Choice Properties — Deployment Guide

This site deploys automatically via Cloudflare Pages on every push to `main`. This document covers the full deployment flow, environment variables, and manual steps for first-time setup and ongoing changes.

---

## Normal Deployment (Day-to-Day)

```
Edit files locally or in your editor
       ↓
git add . && git commit -m "your message"
       ↓
git push origin main
       ↓
Cloudflare Pages detects the push → runs: node generate-config.js
       ↓
Site is live globally within ~1–2 minutes
```

No manual steps required after the initial setup is complete.

---

## What the Build Step Does

`node generate-config.js` runs at Cloudflare Pages build time and:

1. Reads all environment variables set in Cloudflare Pages dashboard
2. Writes `config.js` — injects all public config values the frontend needs
3. Injects CSP nonces into all HTML inline scripts
4. Rewrites `sitemap.xml` and `robots.txt` with `SITE_URL`

`config.js` is gitignored — it is never committed. It is generated fresh on every deploy.

---

## Environment Variables (Cloudflare Pages)

Set these in Cloudflare Pages → your project → **Settings → Environment variables**:

| Variable | Required | Value |
|---|---|---|
| `SUPABASE_URL` | ✅ Yes | Your Supabase project URL (`https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | ✅ Yes | Your Supabase anon public key |
| `SITE_URL` | ✅ Yes | Your production domain — no trailing slash (e.g. `https://choiceproperties.com`) |
| `APPLY_FORM_URL` | Optional | External application form URL. Defaults to `https://apply-choice-properties.pages.dev`. Only set this if the form URL ever changes. |
| `IMAGEKIT_URL` | ✅ Yes | `https://ik.imagekit.io/your-id` |
| `IMAGEKIT_PUBLIC_KEY` | ✅ Yes | Your ImageKit public key |
| `GEOAPIFY_API_KEY` | ✅ Yes | Your Geoapify API key |
| `COMPANY_NAME` | ✅ Yes | Your business name |
| `COMPANY_EMAIL` | ✅ Yes | Your business email |
| `COMPANY_PHONE` | ✅ Yes | Your phone number |
| `COMPANY_ADDRESS` | ✅ Yes | Your business address |
| `COMPANY_TAGLINE` | Optional | Brand tagline shown in footer |
| `ADMIN_EMAILS` | Optional | Comma-separated admin emails for UI display |

After adding or changing any variable: **trigger a redeploy** (Cloudflare Pages → Deployments → Retry deployment, or push any commit).

---

## Deploying Supabase Edge Functions

Edge Functions are deployed separately from the frontend. Only needed when you edit files inside `/supabase/functions/`.

```bash
# Log in (one time)
npx supabase login

# Deploy all functions
npx supabase functions deploy --project-ref YOUR_PROJECT_REF

# Deploy a single function
npx supabase functions deploy send-inquiry --project-ref YOUR_PROJECT_REF
```

Your project ref is visible in Supabase → Settings → General.

> If deploying from a machine without CLI access, use **Supabase Dashboard → Edge Functions → Deploy via UI**.

---

## When You Change Domains

Update **all** of these — missing even one breaks something:

1. Cloudflare Pages → your project → **Custom domains**
2. Cloudflare Pages → **Environment variables** → `SITE_URL`
3. Supabase → **Settings → Edge Functions** → secrets: `DASHBOARD_URL` and `FRONTEND_ORIGIN`
4. Supabase → **Authentication → URL Configuration**: Site URL + both Redirect URLs
5. GAS Script Properties: `DASHBOARD_URL`

---

## Verifying a Deployment

After any deploy, check these:

- `/health.html` on your live site — runs live checks against Supabase and config
- Cloudflare Pages → your project → **Deployments** — build log shows any errors
- Supabase → **Edge Functions** — each function shows its last deployment timestamp

---

## Troubleshooting

**Site loads but CONFIG errors appear in the console**
→ Environment variables not set or a redeploy hasn't run yet
→ Cloudflare Pages → Deployments → Retry deployment

**"Apply Now" button goes to wrong URL**
→ Check `APPLY_FORM_URL` in environment variables (should be `https://apply-choice-properties.pages.dev`)
→ If not set, the default in `generate-config.js` is used — also correct

**Emails not sending**
→ Supabase → Edge Functions → click the function → Logs tab for the exact error
→ Most common: `GAS_EMAIL_URL` secret wrong, or `GAS_RELAY_SECRET` doesn't match GAS Script Properties

**Images not loading**
→ `IMAGEKIT_URL` not set or wrong in Cloudflare Pages environment variables

**Admin or landlord login redirects incorrectly**
→ Update Redirect URLs in Supabase → Authentication → URL Configuration

**Lease signing link broken after domain change**
→ Update `DASHBOARD_URL` in Supabase Edge Function secrets

---

*Choice Properties · Your trust is our standard.*
