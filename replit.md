# Choice Properties — Replit Environment Guide

## What Replit Is Used For

Replit is a **code editor only** for this project. All editing happens here; all running happens on Cloudflare + Supabase.

| Layer | Technology | Where it lives |
|---|---|---|
| Frontend | Static HTML/CSS/Vanilla JS | This repo |
| Production host | Cloudflare Pages | `choicepropertiesofficial.pages.dev` |
| Database | Supabase PostgreSQL | `tlfmwetmhthpyrytrcfo.supabase.co` |
| Auth | Supabase Auth | Same Supabase project |
| Edge Functions | Supabase Deno functions | `supabase/functions/` (deployed to Supabase) |
| Image CDN | ImageKit | `ik.imagekit.io/21rg7lvzo` |
| Email relay | Google Apps Script + Resend | External |
| Application form | External static site | `apply-choice-properties.pages.dev` |

## Deployment Flow

```
Edit code in Replit → Push to GitHub → Cloudflare Pages auto-builds and deploys
```

Cloudflare Pages runs `generate-config.js` at build time, which:
1. Generates `config.js` from Cloudflare environment variables
2. Injects nav/footer components, CSP nonces, and `?v=__BUILD_VERSION__` cache-bust tokens into all HTML files

## Key Files

| File | Purpose |
|---|---|
| `js/cp-api.js` | Supabase SDK client — all data access |
| `generate-config.js` | Cloudflare build-time config generator |
| `SETUP.sql` | Supabase schema reference (run on Supabase dashboard, not here) |
| `supabase/functions/` | Edge Function source (deployed to Supabase, not here) |
| `_headers` | Cloudflare Pages security headers (CSP, HSTS, etc.) |
| `_redirects` | Cloudflare Pages URL routing |

## Rules

- Do NOT run `npm install`, `npm run build`, or any npm scripts — the build is Cloudflare-only
- Do NOT create a local server, local DB, or run migrations
- Do NOT replace Supabase with any local or alternative backend
