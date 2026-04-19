# CHOICE PROPERTIES — AGENT INSTRUCTIONS

---

## ══════════════════════════════════════════════════════════
## ACTIVE FIXES — READ FIXES.md BEFORE DOING ANYTHING
## ══════════════════════════════════════════════════════════
##
## There is an active multi-phase fix plan in progress.
## Before writing any code, open FIXES.md and read it fully.
##
## RULES FOR ALL AI AGENTS ON THIS PROJECT:
##
## 1. Read FIXES.md completely before any action.
## 2. Work ONLY ONE PHASE at a time.
## 3. Mark your phase IN PROGRESS in FIXES.md before coding.
## 4. Mark your phase DONE (with files changed listed) before pushing.
## 5. Push to GitHub. Then STOP.
## 6. Wait for the owner (choice121) to explicitly say "proceed to Phase X"
##    before starting the next phase. No assumed consent. No self-authorization.
## 7. Never combine phases without owner approval.
## 8. The first TODO phase in FIXES.md is the one you work on.
##
## ══════════════════════════════════════════════════════════

---

## Permanent Architecture

This repository is a **pure static HTML/CSS/JavaScript website**. Production is served
exclusively by **Cloudflare Pages**, automatically deployed from the `main` branch on GitHub.
**Supabase** is the only backend — PostgreSQL, Auth, Storage, and Edge Functions all run on
Supabase's cloud. No other runtime or backend is permitted in production.

**Replit is the active code editor and preview environment.** It is used to write, test,
and preview changes before they are pushed to GitHub. Replit-specific files that support this
workflow are listed below and are strictly gitignored — they must never reach GitHub.

---

## The Three-Environment Model

Understanding these three layers is critical before taking any action.

### 1. Replit (Development — local only, never pushed)

| File | Purpose | Git status |
|------|---------|-----------|
| `_dev_preview.js` | Static file server — serves the site on port 5000 for Replit preview | **Gitignored** |
| `config.js` | Generated locally from live Cloudflare values for real-data preview | **Gitignored** |
| `replit.md` | Replit workspace notes | **Gitignored** |
| `.replit` | Replit project config | **Gitignored** |
| `.agents/` | This instructions directory | **Gitignored** |

These files exist only in the Replit workspace. They are excluded from git and will never
appear in the GitHub repository or the Cloudflare build.

### 2. GitHub (Source of truth — what gets committed)

Only these types of files are ever committed and pushed:
- Static HTML pages (`*.html`)
- CSS stylesheets (`css/*.css`)
- Browser JavaScript (`js/*.js`)
- Static assets (`assets/`, `webfonts/`, `components/`)
- Build script (`generate-config.js`)
- Supabase Edge Function source (`supabase/functions/`)
- Documentation (`*.md`, `SETUP.sql`, `GAS-EMAIL-RELAY.gs`)
- Configuration files (`_headers`, `_redirects`, `.gitignore`, `package.json`, `manifest.json`)

### 3. Cloudflare Pages (Production — auto-deployed from GitHub)

On every push to `main`, Cloudflare runs `node generate-config.js` which:
1. Reads all environment variables from the Cloudflare Pages dashboard
2. Writes `config.js` with public API keys baked in (this is generated fresh — never committed)
3. Rewrites `sitemap.xml` and `robots.txt` with the production `SITE_URL`
4. Cache-busts all HTML files by replacing `?v=__BUILD_VERSION__` tokens

The site is then served as static files from Cloudflare's global CDN.

---

## Full Deployment Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  REPLIT (Development)                                       │
│                                                             │
│  Edit HTML / CSS / JS files                                 │
│  _dev_preview.js serves site on port 5000                   │
│  config.js gives real Supabase data in preview              │
│  [_dev_preview.js, config.js, replit.md stay local]         │
└──────────────────────┬──────────────────────────────────────┘
                       │  git push origin main
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  GITHUB (choice121/Choice — main branch)                    │
│                                                             │
│  GitHub Actions CI runs:                                    │
│  ✓ Rejects forbidden files (server.js, replit.md, etc.)     │
│  ✓ Rejects forbidden backend packages                       │
│  ✓ Rejects committed config.js                              │
│  ✓ Validates generate-config.js runs cleanly                │
└──────────────────────┬──────────────────────────────────────┘
                       │  CI passes → Cloudflare picks up push
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  CLOUDFLARE PAGES (Production)                              │
│                                                             │
│  Build: node generate-config.js                             │
│  Output: . (repository root)                                │
│  URL: choice-properties-site.pages.dev                      │
│  Auto-deploys in ~1–2 minutes                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Absolute Prohibitions

These actions will either break the Cloudflare deployment, leak secrets, or corrupt the
codebase. Do not do any of the following under any circumstances.

### Files — Never create or commit these
1. `server.js` — blocked by GitHub CI and Cloudflare preinstall hook
2. `replit.md`, `.replit`, `replit.nix`, `REPLIT_SAFETY.md` — blocked by GitHub CI
3. `scripts/generate-config-replit.js` — blocked by GitHub CI
4. Any `.env` file — secrets belong only in Supabase and Cloudflare dashboards
5. `config.js` — must never be committed; it is gitignored and generated at build time

### Packages — Never add to `package.json`
6. `express`, `fastify`, `koa`, `hapi` — no backend server
7. `pg`, `postgres`, `mysql`, `mysql2`, `sqlite`, `better-sqlite3` — no local database
8. `prisma`, `drizzle-orm`, `sequelize`, `typeorm`, `knex` — no ORM
9. `@neondatabase/serverless`, `neon` — Supabase is the only database

### Commands — Never run these locally
10. `npm install` — the `preinstall` guard will detect Replit and block it
11. `npm start`, `npm run dev` — use `node _dev_preview.js` for local preview instead
12. Any migration command (`db:push`, `db:migrate`, `supabase db reset`, etc.)
13. `wrangler` or any Cloudflare CLI command — deploy only via git push

### Architecture — Never change these patterns
14. Do not move Supabase Edge Functions into local server routes
15. Do not replace Supabase SDK calls in `js/cp-api.js` with a custom API layer
16. Do not add `DATABASE_URL`, `PGHOST`, or any local database environment variable
17. Do not create Express routes, `api/` directories, or any server-side rendering

---

## Allowed Work

1. Edit static HTML files
2. Edit CSS files in `css/`
3. Edit browser JavaScript in `js/` — preserve all Supabase SDK usage patterns
4. Edit `generate-config.js` to add new public config values
5. Edit Supabase Edge Function source in `supabase/functions/` — do not run or deploy locally
6. Edit documentation files
7. Edit `_headers` and `_redirects` for Cloudflare Pages routing rules
8. Edit `GAS-EMAIL-RELAY.gs` source (deployed manually to Google's platform, not run here)
9. Add or update gitignored files (like `_dev_preview.js`, `config.js`) for local preview use
10. Answer architecture and integration questions

---

## Enforcement

Two separate mechanisms enforce these rules:

**`scripts/enforce-cloudflare-only.js`** (runs as `npm preinstall` hook)
- Detects Replit runtime environment variables and blocks npm install
- Scans for forbidden files on disk
- Detects forbidden backend packages in `package.json`
- Detects local database environment variables

**`.github/workflows/cloudflare-only.yml`** (runs on every GitHub push)
- Blocks any push containing: `server.js`, `replit.md`, `replit.nix`, `REPLIT_SAFETY.md`, `scripts/generate-config-replit.js`
- Blocks forbidden backend packages in `package.json`
- Blocks committed `config.js`
- Validates that `generate-config.js` runs cleanly with the stored GitHub secrets

If either enforcement mechanism triggers, stop, identify what caused it, and undo that change.

---

## Key Files Reference

| File | What it does |
|------|-------------|
| `generate-config.js` | Build script — run by Cloudflare at deploy time. Reads env vars, writes `config.js`, cache-busts HTML |
| `js/cp-api.js` | Main API client — all Supabase queries, auth helpers, and business logic |
| `js/supabase.min.js` | Bundled Supabase JS SDK — do not replace or upgrade without testing |
| `js/components.js` | Loads shared nav + footer HTML components into every page |
| `js/imagekit.js` | Handles property photo upload to ImageKit CDN via Edge Function |
| `SETUP.sql` | Complete database schema — one file, one run in Supabase SQL Editor |
| `GAS-EMAIL-RELAY.gs` | Google Apps Script email relay source — deployed manually to Google |
| `_headers` | Cloudflare Pages security headers (CSP, HSTS, X-Frame-Options) |
| `_redirects` | Cloudflare Pages routing rules — `/apply/*` routes to internal application frontend |
| `supabase/functions/` | Deno Edge Functions source — deployed separately via Supabase CLI or dashboard |

---

## Application Frontend

Tenant applications are handled **internally** by the `/apply/` directory in this repository.
The `/apply/index.html` form submits directly to the `receive-application` Supabase Edge Function.

The `buildApplyURL(property)` function in `js/cp-api.js` builds the internal `/apply/` URL with
property parameters pre-filled. The `_redirects` file routes all `/apply/*` paths to `/apply/index.html`.

The `apply-choice-properties.pages.dev` site (GitHub: `choice121/Apply_choice_properties`) is a
**completely separate project** with no connection to this repository. Do not reference it, link to
it, or modify it from here.

---

## Active Cloudflare Environment Variables

All of these are set in Cloudflare Pages → choice-properties-site → Settings → Environment variables.

| Variable | Status |
|----------|--------|
| `SUPABASE_URL` | Set |
| `SUPABASE_ANON_KEY` | Set (secret) |
| `IMAGEKIT_URL` | Set |
| `IMAGEKIT_PUBLIC_KEY` | Set |
| `GEOAPIFY_API_KEY` | Set |
| `SITE_URL` | Set → `https://choice-properties-site.pages.dev` |
| `APPLY_FORM_URL` | Set → `/apply` (internal route) |
| `COMPANY_NAME` | Set → Choice Properties |
| `COMPANY_EMAIL` | Set → choicepropertygroup@hotmail.com |
| `COMPANY_PHONE` | Set → 7077063137 |
| `COMPANY_ADDRESS` | Set → 2265 Livernois, Suite 500, Troy, MI 48083 |
| `COMPANY_TAGLINE` | Set → Your trust is our standard. |
| Feature flags | All set to `true` |
| Lease defaults | Set |

**Note:** `IMAGEKIT_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GAS_URL`, `GAS_RELAY_SECRET`, and `ADMIN_EMAIL` have been removed from Cloudflare. Private keys live only in Supabase Edge Function secrets.
