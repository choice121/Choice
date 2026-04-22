# Choice Properties — Project Status

**Last reconciled:** April 22, 2026
**Purpose:** A single, accurate snapshot of where the codebase stands. Read this first when picking up the project.

This file replaces the need to read FIXES.md, DESIGN_EXTENSION_PLAN.md, KNOWN_ISSUES.md, and the README change history just to figure out "what's done and what isn't."

---

## TL;DR

- **Backend (Edge Functions, DB, email, storage):** all 8 phases of `FIXES.md` shipped. Stable.
- **Frontend design system:** unified system rolled out to admin (100%), landlord (100%), tenant (100%), auth pages (100%), public informational pages (100%), legal/policy pages (100%). The only remaining migration is the three high-traffic public pages: `index.html`, `listings.html`, `property.html`.
- **Documentation:** reconciled with code. ARCHITECTURE.md, README.md, DESIGN_EXTENSION_PLAN.md, this file, and KNOWN_ISSUES.md are all current.
- **Production deployment:** Cloudflare Pages auto-deploys from `main`. Supabase project is live. No outstanding bugs in `KNOWN_ISSUES.md`.

---

## Hard ground rules

These are non-negotiable. They are enforced by code, by CI, and by `.agents/instructions.md`.

1. **Cloudflare Pages is the only production runtime.** No Express, no Node server, no Docker, no other host.
2. **Supabase is the only backend.** Postgres + Auth + Storage + 14 Edge Functions. Plus Google Apps Script for email relay and ImageKit for photo CDN.
3. **Replit is for editing code only.** Never set up a workflow, never run a server, never `npm install` here. `scripts/enforce-cloudflare-only.js` is wired into the `preinstall` npm hook and will hard-fail the install.
4. **Never commit Replit-only files to GitHub.** `.gitignore` lists them; `.github/workflows/cloudflare-only.yml` actively rejects any push that contains them.
5. **Cache-bust on CSS/JS edits.** Bump `?v=YYYYMMDD` on changed assets. Date-based, not semver.
6. **One phase at a time, owner-approved.** Per `.agents/instructions.md`: read FIXES.md (or DESIGN_EXTENSION_PLAN.md) fully, mark the phase IN PROGRESS, ship it, then STOP and wait for the owner to say "proceed."

---

## Backend status — `FIXES.md`

| Phase | Topic | Status |
|---|---|---|
| 1 | Email infrastructure consolidation (single `send-email` function, 10 email types) | ✅ DONE |
| 2 | Lease generation + dry-run preview | ✅ DONE |
| 3 | Lease signing — email-identity verification | ✅ DONE |
| 4 | Countersign function + admin UI | ✅ DONE |
| 5 | Magic-link branded sender (`send-magic-link`) | ✅ DONE |
| 6 | Application draft autosave (`save-draft`) | ✅ DONE |
| 7 | Rate-limit hardening (DB-backed `rate_limit_log`) | ✅ DONE |
| 8 | Storage bucket + signed-URL workflow | ✅ DONE |

**Active Edge Functions (14):** countersign, download-lease, generate-lease, get-lease, imagekit-delete, imagekit-upload, receive-application, request-upload-url, save-draft, send-email, send-inquiry, send-magic-link, send-message, sign-lease.

---

## Frontend design system status — `DESIGN_EXTENSION_PLAN.md`

| Phase | Scope | Status |
|---|---|---|
| 1 | Admin dashboard chrome injector + reduced-motion guard | ✅ DONE |
| 2 | `cp-design.css` + `cp-chrome.js` + `cp-shell.js` foundation | ✅ DONE |
| 3 | `admin/login.html` on `.auth-shell` | ✅ DONE |
| Batch B | `landlord/login`, `landlord/register`, `tenant/login` on light `.auth-shell` | ✅ DONE |
| 4 | All 7 landlord CRUD pages (dashboard, applications, inquiries, edit-listing, new-listing, profile, settings) | ✅ DONE |
| 5.1 | `tenant/login.html` | ✅ DONE (in Batch B) |
| 5.2 | `tenant/portal.html` | ✅ DONE (with bespoke topbar, see open question §3) |
| 6.1 | `lease-sign.html` (multi-step + signature canvas) | ✅ DONE |
| 6.2 | `404.html` | ✅ DONE |
| 7 batch 1 | Informational public pages: about, faq, how-it-works, how-to-apply | ✅ DONE |
| 7 batch 2 | Legal/policy pages: terms, privacy, fair-housing, application-credit-policy, holding-deposit-policy, rental-application-policy, landlord-platform-agreement | ✅ DONE (April 22 2026) |
| 7 batch 3 | Heavy public pages: `index.html`, `listings.html`, `property.html` | ⏳ NOT STARTED |
| 8 partial | Delete admin/landlord legacy CSS + JS shims (`admin.css`, `admin-v2.css`, `landlord.css`, `dashboard-system.css`, `js/admin-chrome.js`, `js/admin-shell.js`) | ✅ DONE |
| 8 final | Delete `main.css`, `mobile.css`, `listings.css`, `property.css` | ⏳ BLOCKED on 7 batch 3 |

### Active CSS surface

```
css/cp-design.css       ← tokens + components, both themes (every portal)
css/cp-marketing.css    ← public-page layer on top of cp-design (light only)
css/apply.css           ← internal /apply/ form only (separate sub-app)
```

### Legacy CSS still in repo (kept only because batch 3 hasn't shipped)

```
css/main.css            ← used by index.html, listings.html, property.html
css/mobile.css          ← same three pages
css/listings.css        ← listings.html only
css/property.css        ← property.html only
```

---

## Open questions / decisions waiting on the owner

1. **Phase 7 batch 3 timing.** When to attempt `index.html`, `listings.html`, `property.html` migration. Highest visual-regression risk in the project — owner approval required before starting.
2. **Tenant chrome unification.** `tenant/portal.html` currently uses a bespoke topbar. Should it adopt `cp-chrome.js`/`cp-shell.js` like landlord and admin, or stay bespoke? No-op until decided.
3. **`SETUP_2.sql` cleanup decision.** Decide whether `MIGRATION_drop_applications_tables.sql` should be run to remove the legacy Supabase applications table, or kept as a safety archive (see ARCHITECTURE.md → "Application System Architecture Decision (2026-04-09)").

---

## Tooling and helpers in this repo

| Path | Purpose |
|---|---|
| `generate-config.js` | Build step. Generates `config.js`, rewrites `sitemap.xml` and `robots.txt`, cache-busts `?v=__BUILD_VERSION__` placeholders. Runs on every Cloudflare Pages build. Uses only Node.js built-ins (no npm deps). |
| `scripts/enforce-cloudflare-only.js` | `preinstall` hook. Fails any attempted `npm install` in a Replit/dev environment. The reason this repo refuses to "just run." |
| `scripts/migrate-legal-pages.js` | Idempotent migrator that converted the 7 legal pages off legacy CSS onto `cp-design.css` + `cp-marketing.css`. Re-runnable for reference. |
| `js/components.js` | Hydrates `<div id="site-nav">` and `<div id="site-footer">` slots with `components/nav.html` and `components/footer.html`. Used on every public page. |
| `js/cp-chrome.js` | Injects portal chrome (sidebar, topbar) for admin and landlord portals. Parameterized by `body[data-portal="…"]`. |
| `js/cp-shell.js` | Runtime helpers (toast, modal, drawer) shared across admin and landlord. Exposes `window.CPShell` and the legacy `window.AdminShell` alias. |
| `js/cp-ui.js` | Lightweight UI helpers used by the tenant portal. |
| `js/cp-api.js` | Single Supabase client wrapper. All `signIn`, `signUp`, `getSession`, RPC, and storage calls go through here. |
| `health.html` | Diagnostic page. Pings Supabase, GAS relay, and ImageKit. Exempt from the design system. |
| `count.html` | Diagnostic page. Counts rows in each table. Exempt from the design system. No CSS loaded. |

---

## Where to look when…

| Symptom | Start here |
|---|---|
| New Edge Function or email-template work | `FIXES.md` (history) + `supabase/functions/<name>/index.ts` |
| New page or CSS work | `DESIGN_EXTENSION_PLAN.md` §0 rules + `css/cp-design.css` + `css/cp-marketing.css` |
| Production bug report | `KNOWN_ISSUES.md` (search by symptom), then `ARCHITECTURE.md` |
| DB schema change | `MIGRATION.md` template + new `MIGRATION_*.sql` file in repo root |
| Auth regression | `js/cp-api.js` (signIn / getSession / resetPassword) and the relevant auth page |
| "I want to run the site locally" | You can't, by design. Push to a Cloudflare Pages branch preview and verify there. |

---

## Verification before any merge

Per DESIGN_EXTENSION_PLAN.md §6, every CSS/page change must pass on Cloudflare branch-preview (NOT locally — there is no local runtime):

1. Page renders in both light and dark theme as appropriate for its portal.
2. No console errors.
3. All form `id`s and `name`s match the version before the change (cp-api.js binds by id).
4. Mobile (≤390 px) and desktop (≥1280 px) both lay out correctly.
5. Cache-bust `?v=YYYYMMDD` updated on any modified CSS/JS asset.
6. `health.html` on the preview reports all services green.
