# Choice Properties

## STATIC SITE — Deployed exclusively on Cloudflare Pages

This repository contains a **pure static frontend** deployed via Cloudflare Pages. There is no application server, no Node.js runtime server, no Python server, no Docker configuration, and no Replit dependency in this codebase.

> **Cloudflare-only policy:** This project runs exclusively on Cloudflare Pages. No other hosting platform is permitted. CI enforces this on every push via `.github/workflows/cloudflare-only.yml`.

All server-side logic runs on fully hosted third-party platforms:

- **Cloudflare Pages** — serves the static HTML / CSS / JS
- **Supabase Edge Functions** — handles all API logic (10 Deno functions deployed to Supabase's cloud)
- **Supabase PostgreSQL** — database with Row Level Security on all tables
- **Google Apps Script** — email relay (deployed separately to Google's platform)
- **ImageKit.io** — property photo CDN
- **Geoapify** — address autocomplete API

## Architecture

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for a full breakdown of every component, all Edge Functions, database tables, the security model, and an explicit list of what does **not** exist in this repository.

## Deployment

- **Cloudflare Pages root directory:** `/` (repository root)
- **Build command:** `node generate-config.js`
- **Build output directory:** `.`
- **Production URL:** `https://choice-properties-site.pages.dev`

No npm packages are installed at runtime. The build step uses only Node.js built-in modules.

---

## Development Workflow

**The editor is Replit. The deployment target is Cloudflare Pages.**

```
Edit code in Replit
       ↓
Preview locally via _dev_preview.js (port 5000, real Supabase data)
       ↓
git push origin main
       ↓
GitHub CI validates the push (blocks forbidden files)
       ↓
Cloudflare Pages auto-builds and deploys (~1–2 min)
```

### Gitignored files (Replit-local only — never pushed to GitHub)

| File | Purpose |
|------|---------|
| `_dev_preview.js` | Static file server for Replit preview |
| `config.js` | Generated from live Cloudflare values for local preview |
| `replit.md` | Replit workspace notes |
| `.replit` | Replit project config |
| `.agents/` | AI agent instructions |

These files support local development in Replit but must never appear in GitHub or Cloudflare.
The `.gitignore` excludes them, and the GitHub CI workflow actively rejects any push that
contains `server.js`, `replit.md`, or similar files.

### What gets committed to GitHub

Only the actual product files: HTML pages, CSS stylesheets, JavaScript, static assets,
Edge Function source, build script (`generate-config.js`), and documentation.

See [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) for the full step-by-step workflow.

---

## Local Application Form Integration

This platform serves the rental application frontend from:

**`/apply/`**

When a user clicks "Apply Now" on any property listing, they are routed to the local application frontend with all relevant property data passed as URL query parameters. The application frontend is copied from `apply-choice-properties (separate project, no connection to this repo)`; the external repository is left untouched and the Google Apps Script backend remains the processing system.

### How it works

The `buildApplyURL(property)` function in `js/cp-api.js` constructs the redirect URL with all available property context:

| Parameter | Source field | Purpose in the form |
|---|---|---|
| `id` | `property.id` | Stored for logging |
| `pn` | `property.title` | Property name display + pre-fill |
| `addr` | `property.address` | Pre-fills the address field |
| `city` | `property.city` | Property context banner |
| `state` | `property.state` | Context banner + lease jurisdiction |
| `rent` | `property.monthly_rent` | Income-to-rent ratio display |
| `beds` | `property.bedrooms` | Context display |
| `baths` | `property.bathrooms` | Context display |
| `pets` | Derived from pet fields | Pet policy display |
| `term` | `property.lease_terms` | Lease term display |

### What this platform does NOT do with applications

- Does **not** receive or store application submissions — all data goes to the application form's Google Sheets backend
- Does **not** generate leases — handled by the GAS admin panel
- Does **not** track application status in Supabase — applicants use the local application dashboard at `/apply/?path=dashboard`

### Configuration

`APPLY_FORM_URL` is set in `generate-config.js` and defaults to `/apply`. It can be overridden via the `APPLY_FORM_URL` environment variable if the form route ever changes.

### Platform separation contract

- This site passes data **one-way only** via URL parameters — no API calls from the listing pages to the form backend
- The form backend does **not** call back to this site
- The listing pages and form share only the local route and display-only URL params

---

## Where things live

For new contributors and AI agents, the documentation map:

| File | Read it when… |
|---|---|
| `PROJECT_STATUS.md` | You're picking up the project — single source of truth for what's done and what's left. |
| `ARCHITECTURE.md` | You need to understand how a piece of the system works. |
| `DESIGN_EXTENSION_PLAN.md` | You're touching CSS, page layouts, or migrating a page to the unified design system. |
| `KNOWN_ISSUES.md` | You hit a bug — check whether it's already documented (all entries currently resolved). |
| `SETUP.md` | You're standing up a fresh Supabase project, Cloudflare Pages project, or GAS deployment. |
| `MIGRATION.md` + `MIGRATION_*.sql` | You're applying or rolling back a database schema change. |
| `DEPLOYMENT_GUIDE.md` | You're configuring the Cloudflare Pages project itself. |
| `.agents/instructions.md` | You are an AI agent — read this BEFORE writing any code. |

---

## Change History

| Date | Changes |
|---|---|
| April 22 2026 | **Sub-phase 7.3.4 — legacy CSS deleted.** Removed `css/main.css`, `css/mobile.css`, `css/listings.css`, `css/property.css` (~5,634 lines) after sub-phases 7.3.1 / 7.3.2 / 7.3.3 migrated `index.html`, `listings.html`, and `property.html` onto `cp-design.css` + `cp-marketing.css`. Active CSS surface is now just `cp-design.css`, `cp-marketing.css`, and `apply.css`. Verify on the next Cloudflare branch preview at 375 / 768 / 1280 px (Chrome, Safari, Firefox). |
| April 22 2026 | **Phase 7 batch 2 — legal/policy pages migrated.** All 7 legal/policy pages (`terms`, `privacy`, `fair-housing`, `application-credit-policy`, `holding-deposit-policy`, `rental-application-policy`, `landlord-platform-agreement`) migrated from legacy `main.css`/`mobile.css` + page-specific `<style>` blocks to the unified `cp-design.css` + `cp-marketing.css` system. Inline nav/footer replaced with `components.js` slots. Migration is idempotent via `scripts/migrate-legal-pages.js`. cp-marketing.css extended with `.info-body`, `.info-doc`, `.info-section h3`/`h4`/`ol`, `.policy-nav`, `.effective-date`. |
| April 22 2026 | **Documentation reconciliation.** Updated ARCHITECTURE.md (Edge Function count corrected to 14, added stylesheet/component map, send-email type list). Created PROJECT_STATUS.md as a single source of truth for project state. DESIGN_EXTENSION_PLAN.md change log updated to credit work that had already shipped (Phase 4 landlord pages, Phase 6.1 lease-sign, Phase 6.2 404, partial Phase 8 legacy file removals). |
| April 2026 | **Local application frontend consolidation.** Copied the application frontend into `/apply/`, updated Apply/Track links to use the local route, preserved the original form design and behavior, and left the external application repository untouched. Cloudflare Pages for the main site must use `APPLY_FORM_URL=/apply` or leave it unset. |
| April 2026 | **Security hardening.** Removed exposure of Geoapify API key from the Apply repo source code. Added build system to Apply site (`generate-config.js` + `package.json`). Synced Cloudflare Pages preview environment variables (was missing 14 vars). Documented correct deployment process for both platforms. |
| April 2026 | **Legacy external application integration superseded.** This project previously sent Apply/Track traffic to the separate Pages app. The active configuration now routes that traffic internally to `/apply/`; keep any historical external repo untouched unless explicitly requested. |
| April 2026 | **Frontend audit & mobile optimisation.** Responsive layouts, 44px touch targets, local Font Awesome hosting, CSS preload strategy, image lazy loading, critical CSS inlining, shared nav component, portal links, route highlighting, inline style cleanup, semantic HTML improvements. |

---

## Notes

- Supabase Edge Functions have their own uptime dashboard at [app.supabase.com](https://app.supabase.com) → your project → Edge Functions.
- GAS (Google Apps Script) email relay does **not** have a public health endpoint. Monitor email delivery by reviewing the Email Logs page in the admin panel regularly, or set up a daily cron alert via UptimeRobot pointed at your live site.
- The internal `/apply/` directory is active and is the tenant-facing application frontend. Do not restore redirects that send `/apply/*` to the old external Apply site.
