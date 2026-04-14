# Choice Properties — Replit Environment Guide

## What This Project Is

Choice Properties is a static HTML/CSS/Vanilla JS rental property marketplace. It connects tenants with verified landlords across the US.

## Architecture

| Layer | Technology | Where it lives |
|---|---|---|
| Frontend | Static HTML/CSS/Vanilla JS | This repo |
| Local preview | Node.js static file server (`server.js`) | Runs on Replit port 5000 |
| Production host | Cloudflare Pages | `choicepropertiesofficial.pages.dev` |
| Database | Supabase PostgreSQL | `tlfmwetmhthpyrytrcfo.supabase.co` |
| Auth | Supabase Auth | Same Supabase project |
| Edge Functions | Supabase Deno functions | `supabase/functions/` |
| Image CDN | ImageKit | `ik.imagekit.io/21rg7lvzo` |
| Email relay | Google Apps Script + Resend | External |
| Application form | External static site | `apply-choice-properties.pages.dev` |

## Running on Replit

The project runs via `npm start`, which:
1. Runs `scripts/generate-config-replit.js` — generates `js/config.js` from environment variables
2. Starts `server.js` — a simple Node.js static file server on port 5000

The preview pane shows the live site. All Supabase calls go directly from the browser to the hosted Supabase project — no local database is needed.

## Deployment Flow

```
Edit code in Replit → Push to GitHub → Cloudflare Pages auto-builds and deploys
```

Cloudflare Pages runs `generate-config.js` at build time (a more thorough version with live credential validation).

## Key Files

| File | Purpose |
|---|---|
| `server.js` | Replit static file server (port 5000) |
| `scripts/generate-config-replit.js` | Generates `js/config.js` for Replit serving |
| `js/config.js` | Auto-generated browser config (gitignored) |
| `js/cp-api.js` | Supabase SDK client — all data access |
| `generate-config.js` | Cloudflare build-time config generator (more strict) |
| `SETUP.sql` | Supabase schema reference |
| `supabase/functions/` | Edge Function source (deployed to Supabase) |
| `_headers` | Cloudflare Pages security headers |
| `_redirects` | Cloudflare Pages URL routing |

## Environment Variables

All env vars are set in the Replit Secrets panel. Key ones:

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anon/public key
- `IMAGEKIT_URL` — ImageKit CDN base URL
- `IMAGEKIT_PUBLIC_KEY` — ImageKit public key
- `GEOAPIFY_API_KEY` — Address autocomplete
- `COMPANY_*` — Branding variables
