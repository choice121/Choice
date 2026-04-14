# Choice Properties — Replit Setup

## Project Overview

Choice Properties is a static HTML/CSS/JavaScript rental marketplace. The backend is entirely hosted on **Supabase** (external) — there is no local database and no Node.js API server needed.

## Architecture

- **Frontend:** Static HTML/CSS/Vanilla JS — no framework
- **Backend:** Supabase cloud (PostgreSQL, Auth, Edge Functions) at `https://tlfmwetmhthpyrytrcfo.supabase.co`
- **Image CDN:** ImageKit (`https://ik.imagekit.io/21rg7lvzo`)
- **Address autocomplete:** Geoapify
- **Email relay:** Google Apps Script + Resend
- **Application form:** External site at `https://apply-choice-properties.pages.dev`
- **Production hosting:** Cloudflare Pages (deployed from GitHub)

## Replit Role

Replit serves the static files locally for **preview and development**. All data reads/writes go directly to Supabase from the browser.

## How It Runs on Replit

1. `generate-config-replit.js` reads environment variables and writes `config.js` (loaded by all HTML pages)
2. `server.js` serves all static files on port 5000
3. The workflow command is: `npm start`

## Key Files

| File | Purpose |
|---|---|
| `server.js` | Replit static file server (port 5000) |
| `generate-config-replit.js` | Generates `config.js` from env vars for Replit |
| `config.js` | Auto-generated browser config (do not edit directly) |
| `js/cp-api.js` | Supabase SDK wrapper — all data access |
| `generate-config.js` | Cloudflare Pages build-time config generator |
| `scripts/enforce-cloudflare-only.js` | Build guard (Cloudflare only) |
| `SETUP.sql` | Supabase schema reference |
| `supabase/functions/` | Supabase Edge Functions source (Deno) |

## Environment Variables (set in Replit)

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://tlfmwetmhthpyrytrcfo.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `IMAGEKIT_URL` | `https://ik.imagekit.io/21rg7lvzo` |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public upload key |
| `GEOAPIFY_API_KEY` | Address autocomplete API key |
| `SITE_URL` | `https://choicepropertiesofficial.pages.dev` |
| `COMPANY_NAME` | Choice Properties |
| `COMPANY_EMAIL` | choicepropertygroup@hotmail.com |
| `COMPANY_PHONE` | 7077063137 |
| `COMPANY_ADDRESS` | 2265 Livernois, Suite 500, Troy, MI 48083 |
| `COMPANY_TAGLINE` | Your trust is our standard. |
| `APPLY_FORM_URL` | `https://apply-choice-properties.pages.dev` |
| `PORT` | 5000 |

## Production Deployment

Production is deployed to **Cloudflare Pages** via GitHub push. The Cloudflare build command is `npm run build`, which runs the protection wall check and the full `generate-config.js`. Do not run `npm run build` on Replit.

## Important Notes

- `config.js` is auto-generated — never commit or manually edit it
- No local database — all data is in Supabase
- No migrations to run on Replit
- Supabase Edge Functions run on Supabase's infrastructure, not here
