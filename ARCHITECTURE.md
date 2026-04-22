# Choice Properties — System Architecture

---

## ══════════════════════════════════════════════════════════
## STOP — AI AGENTS READ THIS FIRST — NON-NEGOTIABLE
## ══════════════════════════════════════════════════════════
##
## THIS PROJECT IS A STATIC WEBSITE. IT IS NOT BEING MIGRATED.
## IT IS FULLY SET UP. DO NOT TOUCH THE DATABASE. DO NOT MIGRATE.
##
## MANDATORY: Read `.agents/instructions.md` before any action.
## It contains the complete rule set that governs this project.
##
## ACTIVE FIX PLAN: Read `FIXES.md` before writing any code.
## It lists all pending phases. Work ONE phase at a time.
## Stop after each phase and wait for owner approval to continue.
##
## WORKFLOW SUMMARY:
## - Replit = code editor + local preview (_dev_preview.js, gitignored)
## - GitHub = source of truth (HTML/CSS/JS only — no Replit files)
## - Cloudflare Pages = production (auto-deploys from GitHub main)
##
## SHORT VERSION — NEVER, UNDER ANY CIRCUMSTANCES:
## - Push server.js, replit.md, _dev_preview.js, or config.js to GitHub
## - Provision or connect to Replit/Neon PostgreSQL
## - Use DATABASE_URL, PGHOST, PGPASSWORD, or any PG variable
## - Install Drizzle, Prisma, Sequelize, or any ORM
## - Run db:push, db:migrate, or any database command
## - Create backend server files or api/ directories
## - Run wrangler or any Cloudflare CLI command
##
## YOUR ONLY JOB: Edit static HTML, CSS, and frontend JS files.
## Push to GitHub. Cloudflare deploys automatically.
## ══════════════════════════════════════════════════════════

---

## Overview

Choice Properties is a **pure static frontend** connected to fully hosted backend services. There is no application server in this repository. Every component runs either in the browser or on a third-party hosted platform.

```
Browser
  │
  ├── Cloudflare Pages CDN  ← serves static HTML / CSS / JS
  │
  ├── Supabase              ← database, auth, realtime, storage
  │     ├── PostgreSQL (RLS enforced on all tables)
  │     ├── Supabase Auth (landlord + admin login)
  │     ├── Realtime (application status updates)
  │     ├── Storage (lease PDFs, application docs — private)
  │     └── Edge Functions (14 active Deno functions)
  │
  ├── Google Apps Script    ← email relay (deployed separately)
  │
  ├── ImageKit.io           ← property photo CDN + transforms
  │
  ├── Geoapify              ← address autocomplete API
  │
  └── /apply/                ← internal application frontend
        (served from this repo; submits directly to Supabase Edge Functions)
```

---

## Component Breakdown

### Frontend — Cloudflare Pages

| Type | Details |
|---|---|
| Language | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| Framework | None |
| Design system | Single unified system: `css/cp-design.css` (tokens + components, both themes) + `css/cp-marketing.css` (public-page layer, light-only). Loaded by `data-portal="admin\|landlord\|tenant\|public"` on `<body>`. Chrome injection via `js/cp-chrome.js`, runtime via `js/cp-shell.js`, public-page nav/footer via `js/components.js`. See "Stylesheet & component map" below. |
| Build step | `node generate-config.js` — injects env vars into `config.js`, rewrites `sitemap.xml` + `robots.txt` with `SITE_URL`, and cache-busts `?v=__BUILD_VERSION__` tokens in HTML files |
| Structured data | JSON-LD on `index.html` (WebSite+SearchAction), `listings.html` (CollectionPage), `property.html` (RealEstateListing+BreadcrumbList) |
| Deployment | Cloudflare Pages (auto-deploy on push to `main`) |
| CDN | Cloudflare global CDN (automatic, no configuration needed) |
| Security headers | `_headers` file (X-Frame-Options, CSP, HSTS, etc.) — CSP `script-src` uses `'unsafe-inline'` intentionally (CSS preload pattern requires it; nonce-based CSP was planned in I-052 but removed due to CSP mismatches on Cloudflare deploys) |
| 404 handling | `_redirects` file (catch-all → `404.html`) |

The build step uses only Node.js built-in modules (`fs`, `process.env`). No npm packages are installed during the build.

---

### Backend API — Supabase Edge Functions

  All 14 Deno-based Edge Functions are active and deployed to Supabase.

  #### Active Functions

  | Function | Purpose | Auth required |
  |---|---|---|
  | `send-inquiry` | Send property inquiry to landlord | Public (rate-limited) |
  | `send-message` | Send message in thread | Admin only |
  | `send-magic-link` | Branded magic-link email for tenant/landlord login | Public |
  | `imagekit-upload` | Authenticated photo upload to ImageKit | Authenticated user |
  | `imagekit-delete` | Delete photo from ImageKit CDN | Authenticated user |
  | `send-email` | Transactional emails — handles all 10 types: `approved`, `denied`, `waitlisted`, `movein_confirmed`, `holding_fee_request`, `holding_fee_received`, `payment_confirmed`, `move_in_prep`, `lease_signing_reminder`, `lease_expiry_alert` | Admin/system |
  | `receive-application` | Application intake from internal `/apply/` form | Public |
  | `save-draft` | Save in-progress application draft | Public |
  | `generate-lease` | Lease PDF generation (with dry-run preview support) | Admin only |
  | `sign-lease` | Tenant e-signature processing (with email identity verification) | Authenticated user |
  | `countersign` | Landlord/management countersignature | Admin only |
  | `get-lease` | Retrieve lease data | Authenticated user |
  | `download-lease` | Signed lease PDF download | Authenticated user |
  | `request-upload-url` | Pre-signed upload URL for application docs | Authenticated user |

  **Deployment:** `npx supabase functions deploy --project-ref tlfmwetmhthpyrytrcfo` (see SETUP.md → Step 7)

  These functions are NOT part of this repository's local runtime. They run on Deno in Supabase's cloud.
---

### Stylesheet & component map (post-Phase-7-batch-2)

The site uses a single design system. Every page falls into one of four portals selected by `<body data-portal="…">`:

| Portal value | Pages | Stylesheets loaded | Chrome injected by |
|---|---|---|---|
| `admin` | every page in `/admin/*` | `cp-design.css` (dark theme via `data-theme="dark"`) | `cp-chrome.js` + `cp-shell.js` |
| `landlord` | every page in `/landlord/*` (auth pages omit chrome) | `cp-design.css` (light theme) | `cp-chrome.js` + `cp-shell.js` |
| `tenant` | `tenant/portal.html` (auth omits chrome) | `cp-design.css` (light theme) | `cp-ui.js` + page-local topbar (intentionally bespoke for tenant — see Phase 5.2 note in `DESIGN_EXTENSION_PLAN.md`) |
| `public` | `index.html`, `listings.html`, `property.html`, `about.html`, `faq.html`, `how-it-works.html`, `how-to-apply.html`, all legal/policy pages, `404.html` | `cp-design.css` + `cp-marketing.css` (light only) | `components.js` (loads `components/nav.html` + `components/footer.html`) |

**Auth pages** (`admin/login.html`, `landlord/login.html`, `landlord/register.html`, `tenant/login.html`, `lease-sign.html`) intentionally omit `data-portal` and the chrome scripts — they use only `cp-design.css` with `.auth-shell` markup.

**Diagnostic pages** (`count.html`, `health.html`) are exempt from the design system per locked decision §7.4 in `DESIGN_EXTENSION_PLAN.md`. `count.html` loads no CSS; `health.html` loads only `cp-design.css`.

**The full active CSS surface is just three files:**

| File | Purpose |
|---|---|
| `css/cp-design.css` | Tokens (colors, spacing, radii, shadows), components (`.btn-*`, `.card`, `.field-*`, `.list-row`, `.kpi-strip`, `.auth-shell`, `.stepper`, `.dropzone`, etc.), both light and dark themes. Single source of truth for all portals. |
| `css/cp-marketing.css` | Public-page layer on top of `cp-design.css`. Adds hero, info-section, contact-card, info-cta, legal-doc layout, FAQ accordion, marketing footer. Scoped to `body[data-portal="public"]`. |
| `css/apply.css` | Internal application form `/apply/index.html` only. Untouched by the design extension — the apply form is treated as a separate sub-app (`apply-choice-properties` external project lineage). |

**Legacy stylesheets — REMOVED in sub-phase 7.3.4:**

All four legacy public stylesheets (`css/main.css`, `css/mobile.css`, `css/listings.css`, `css/property.css`) were deleted in sub-phase 7.3.4 (April 22 2026) after Phase 7 batch 3 migrated `index.html`, `listings.html`, and `property.html` onto `cp-design.css` + `cp-marketing.css`. `css/admin.css`, `css/admin-v2.css`, `css/landlord.css`, `css/dashboard-system.css` and the JS shims `js/admin-chrome.js`, `js/admin-shell.js` were removed earlier in Phase 8 partial. The active CSS surface is now exactly three files: `cp-design.css`, `cp-marketing.css`, `apply.css`.

---

### Database — Supabase PostgreSQL

| Table | Description |
|---|---|
| `properties` | Rental listings |
| `landlords` | Landlord profiles |
| `applications` | Tenant applications (SSN masked to last-4) |
| `co_applicants` | Co-applicant data linked to applications |
| `messages` | Application thread messages |
| `inquiries` | Property inquiry submissions |
| `email_logs` | All email send attempts with status |
| `admin_roles` | Admin user registry |
| `admin_actions` | Admin audit trail — records every admin action with actor and timestamp |
| `saved_properties` | Tenant saved listings |
| `rate_limit_log` | DB-backed rate limiting — stores IP, endpoint, and timestamp |

Row Level Security (RLS) is enabled on all tables. The complete schema, RLS policies, triggers, indexes, and **table-level grants** are all in `SETUP.sql` — one file, one run.

**Key helper database functions:**
- `is_admin()` — returns `true` if the current session's user exists in `admin_roles`. Used in RLS policies across all tables.
- `immutable_array_to_text(arr text[], sep text)` — `IMMUTABLE` wrapper around `array_to_string`. Required for use in generated column expressions (PostgreSQL requires all functions in generated columns to be immutable).

> **Important:** RLS policies alone are not enough. PostgreSQL requires both a table-level `GRANT` (giving the role permission to touch the table at all) AND an RLS policy (determining which rows that role can see). Without the grants, all queries return `permission denied` even when valid RLS policies exist. `SETUP.sql` includes both. If you ever see `permission denied for table X`, run the grant block in `SETUP.sql` section 14 manually in the SQL Editor.

---

### Email — Google Apps Script Relay

A Google Apps Script Web App receives email requests from Supabase Edge Functions and sends them via Gmail. The script source is in `GAS-EMAIL-RELAY.gs` and must be manually deployed to Google's platform.

Secret verification (`RELAY_SECRET`) is enforced on every request. The GAS URL and secret live only in Supabase Edge Function secrets — never in the frontend.

---

### Image Storage — ImageKit.io

Property photos and landlord avatars are served through ImageKit's global CDN. Upload is handled by the `imagekit-upload` Edge Function (private key stays in Supabase secrets). The frontend receives CDN URLs and applies transform presets for different display sizes.

**Upload flow:**
```
Browser (imagekit.js)
  → fileToBase64(file)
  → POST /functions/v1/imagekit-upload
      { fileData, fileName, folder }   ← field name must be 'fileData'
  → Edge Function authenticates caller, forwards to ImageKit Upload API
  → Returns { success, url, fileId }
  → Browser stores url in properties.photo_urls[]
```

**Previously known gaps (all resolved as of Session 019):**
| Gap | Issue | Status |
|---|---|---|
| `fileId` is discarded — cannot delete from ImageKit | I-028 | ✅ RESOLVED |
| Photos removed from a listing are never deleted from CDN | I-015 | ✅ RESOLVED |
| Uploads are sequential (one at a time) — slow on mobile | I-016 | ✅ RESOLVED |

**Post-launch improvement (Phase 3 — in progress):**
Replace `photo_urls TEXT[]` and `photo_file_ids TEXT[]` on the `properties` table with a dedicated `property_photos` table for per-photo metadata (display order, alt text, caption, watermark status, dimensions) and clean CDN deletion. Rollout is split into three sub-phases:

- **3a (shipped — `MIGRATION_property_photos.sql`)** — Creates the table, backfills from existing arrays, and installs bidirectional sync triggers so the legacy arrays and the new table stay in lockstep. **No application code change is required at this stage.**
- **3b (pending)** — Migrate the imagekit-upload + imagekit-delete edge functions and all UI surfaces (`landlord/new-listing.html`, `landlord/edit-listing.html`, `landlord/dashboard.html`, `landlord/profile.html`, `admin/properties.html`, `listings.html`, `property.html`, `js/card-builder.js`) to read/write `property_photos` directly.
- **3c (pending)** — Drop the sync triggers and the legacy `photo_urls` / `photo_file_ids` columns once 3b has been verified on production for at least one full upload+delete cycle.

---

### Application & Lease Storage — External GAS System

The tenant-facing application frontend is served internally from this repo at `/apply/`. Application intake, lease generation, e-signatures, and document storage still submit to the existing Google Apps Script application backend — not this platform's Supabase tables.

| Data | Where stored | How accessed |
|---|---|---|
| Rental applications | Google Sheets (GAS backend) | GAS admin panel at `?path=admin` |
| Lease documents | Google Sheets + Google Drive | GAS admin panel |
| Applicant-uploaded docs | Google Drive (GAS backend) | GAS admin panel |
| Application status | Google Sheets (GAS backend) | Applicant dashboard at `?path=dashboard` |

**This platform does not store, read, or process applications.** All admin pages that previously showed Supabase application data now redirect to the GAS admin panel. The Supabase `lease-pdfs` and `application-docs` storage buckets referenced in older documentation are no longer in use.

---

## Security Model

| Concern | Mechanism |
|---|---|
| Database access | Table-level grants (`GRANT`) + RLS policies on every table; service role key server-side only |
| Admin auth | JWT verified server-side against `admin_roles` table |
| SSN data | Masked to last-4 on receipt; never stored full |
| Lease signing | 192-bit random tokens per lease; verified server-side |
| Email relay | HMAC secret verified on every request |
| Rate limiting | In-memory per-IP limits on all public Edge Functions |
| File access | All sensitive buckets private; signed URLs only |
| CORS | Edge Functions use `Access-Control-Allow-Origin: *` (public API) |
| Frontend config | `config.js` generated at build time; gitignored; no-cache headers |

---

## What Does NOT Exist In This Repository

| What you might expect | Reality |
|---|---|
| Express / Fastify / Koa server | None — no server at all |
| Node.js API routes | None — Supabase Edge Functions handle all server logic |
| Python Flask / Django | None |
| Local database | None — Supabase is the database |
| Redis / queue / workers | None |
| Docker / docker-compose | None |
| `.env` file with secrets | None — secrets live in Supabase and GAS dashboards |
| npm packages for runtime | None — `generate-config.js` uses only Node.js built-ins |

---

## Local Development (Replit)

The project uses **Replit** as its code editor and preview environment.
The local preview server is `_dev_preview.js` — a plain Node.js static file server
that runs on port 5000. It is **gitignored** and never committed to GitHub.

`config.js` is generated locally by fetching values from the live Cloudflare deployment.
It is also **gitignored** — it exists only in the Replit workspace.

**Files that exist only in Replit (never pushed to GitHub):**

| File | Purpose |
|------|---------|
| `_dev_preview.js` | Static server for local preview on port 5000 |
| `config.js` | Generated from live Cloudflare env vars for real-data preview |
| `replit.md` | Replit workspace notes |
| `.replit` | Replit project config |
| `.agents/` | AI agent instructions |

These are all listed in `.gitignore`. The GitHub CI workflow also actively rejects any
push that contains `server.js`, `replit.md`, or similar forbidden files.

---

## Data Flow — Tenant Applies for a Property

Applications are handled by the **local application frontend** at `/apply/`. This platform's listing pages route the tenant there with property context.

```
Tenant clicks "Apply Now" on listings.html or property.html
  │
  └── buildApplyURL(property) in js/cp-api.js
        │
        ├── Writes property context to sessionStorage (same-origin fallback)
        └── Builds redirect URL with query params:
              ?id=<id>&pn=<title>&addr=<address>&city=<city>
              &state=<state>&rent=<rent>&beds=<beds>&baths=<baths>
              &pets=<pet_policy>&term=<lease_term>
              │
              └── window.location → /apply/
                    │
                    ├── Form pre-fills from URL params
                    ├── Tenant completes 6-step application
                    ├── GAS backend stores data in Google Sheets
                    ├── Confirmation email sent to tenant
                    └── Admin notified — manages lease via GAS admin panel
```

This platform does **not** receive, store, or process application data in Supabase. All application state still lives in the Google Apps Script / Google Sheets backend.

---

## Data Flow — Property Inquiry (Contact Landlord)

```
Browser → POST /functions/v1/send-inquiry
            │
            ├── Rate limit check (in-memory, per IP)
            ├── Fetch landlord email from properties table
            └── POST to GAS relay → Gmail sends inquiry to landlord
```

---

## Local Application Frontend

Tenant applications are handled by a local copy of the frontend from `choice121/Apply_choice_properties`, while the backend remains Google Apps Script:

| Property | Value |
|---|---|
| URL | `/apply/` |
| Frontend | Vanilla HTML/CSS/JS — single `index.html` |
| Backend | Google Apps Script (`code.gs`) |
| Storage | Google Sheets (auto-managed by GAS) |
| Admin panel | `?path=admin` — served by GAS |
| Applicant dashboard | `?path=dashboard&id=<appId>` |

### Integration contract (one-way, read-only)

This platform sends the following URL params when routing to the form. The form treats them as **display-only** — they pre-fill fields and show context banners but are never used for backend validation.

| Param | Value |
|---|---|
| `id` | `property.id` |
| `pn` | `property.title` |
| `addr` | `property.address` |
| `city` | `property.city` |
| `state` | `property.state` |
| `rent` | `property.monthly_rent` |
| `beds` | `property.bedrooms` |
| `baths` | `property.bathrooms` |
| `pets` | Derived pet policy string |
| `term` | Lease term string |

**The listing pages never call the application backend API directly and the application backend never calls this platform.**

### Configuration

`APPLY_FORM_URL` in `generate-config.js` defaults to `/apply`. Override with the `APPLY_FORM_URL` environment variable if the route changes.

---

## Deployment Checklist

- [ ] Supabase project created, `SETUP.sql` run in SQL Editor (one file, one run — includes schema, RLS, functions, grants, and storage buckets)
- [ ] Supabase Edge Function secrets set (see SETUP.md Step 4 for full list)
- [ ] Google Apps Script deployed, URL added as `GAS_EMAIL_URL` secret
- [ ] Supabase Auth redirect URLs configured (Site URL + landlord + admin redirect URLs)
- [ ] Cloudflare Pages project created, all environment variables set (see SETUP.md Step 6) — including `APPLY_FORM_URL`
- [ ] Edge Functions deployed — see SETUP.md Step 7. If deploying from mobile/no CLI, use the Supabase Dashboard → Edge Functions → Deploy via UI
- [ ] Admin account created via SQL insert into `admin_roles` (see SETUP.md Step 8)
- [ ] `health.html` checks passing on the live site
- [ ] At least 3–5 listings seeded via landlord dashboard so homepage shows live content
- [ ] Verify "Apply Now" buttons route to `/apply/` with correct property params
- [ ] Verify "Track My Application" links in nav, footer, and FAQ point to `/apply/?path=dashboard`

  ---

  ## Changelog

  ### 2026-04-07 — Property Data Completeness Improvements

  Addressed systematic gap where DB columns existed but were never collected in landlord forms.

  **Financial Fields (new inputs in Step 2 of new-listing / edit-listing):**
  - last_months_rent — Last month rent amount (was always NULL before)
  - admin_fee — One-time move-in/admin fee (was always NULL before)
  - move_in_special — Free-text move-in promotion/special (was always NULL before)

  **Structured Pet Policy (replaces single text-box in Step 3):**
  - pet_types_allowed — Array of allowed pet types: Dogs, Cats, Birds, Small Animals, Reptiles
  - pet_weight_limit — Dog weight limit in lbs (dropdown: none / 15 / 25 / 50 / 75 / 100)
  - pet_deposit — Separate pet deposit amount (was always NULL before)
  - pet_details — Free-text notes now a secondary field, not the primary input

  **Structured Parking (replaces single select in Step 3):**
  - parking — Now includes Covered, Garage (Attached/Detached), Gated options
  - garage_spaces — Number of spaces included (was always NULL before)
  - parking_fee — Monthly parking fee separate from rent (was always NULL before)
  - ev_charging — EV charging availability: none / available / included

  **Systems and Appliances (new selects added to Step 3):**
  - laundry_type — In-unit / hookups / shared / laundromat / none
  - heating_type — Gas forced air / electric / baseboard / radiant / heat pump / boiler / other
  - cooling_type — Central A/C / mini-split / window units / evaporative / none

  All fields write to columns that already existed in the DB schema (zero schema changes required).
  Draft autosave and draft restore updated to persist all new fields.


---

## Application System Architecture Decision (2026-04-09)

Rental application UI is now internal at **/apply/** in this repository. Processing still submits to the existing GAS application backend. The Supabase applications table and related database objects are legacy and should be removed by running MIGRATION_drop_applications_tables.sql in the Supabase SQL Editor only after confirming no live data is needed.

### What moved to GAS

| Capability | Was (Supabase) | Now (GAS) |
|---|---|---|
| Application submission | Edge Functions + PostgreSQL | GAS doPost + Google Sheets |
| Lease generation | sign_lease stored procedure | GAS generateAndSendLease |
| Lease e-signing | Supabase stored procedure | GAS lease signing page |
| Application status | applications table | Google Sheets row |
| Email notifications | GAS relay via Edge Function | GAS MailApp directly |
| Admin dashboard | admin_application_view | GAS web app admin panel |

### What stays in Supabase

landlords, properties, inquiries, email_logs, saved_properties, rate_limit_log, admin_roles, admin_actions, and the 4 active Edge Functions: send-inquiry, send-message, imagekit-upload, imagekit-delete.

### Cleanup actions required

1. Run MIGRATION_drop_applications_tables.sql in Supabase SQL Editor (includes pre-flight row-count check).
2. Delete the 7 decommissioned application Edge Functions from Supabase Dashboard -> Edge Functions.
3. Update or remove admin/applications.html and admin/leases.html — they reference the removed Supabase applications table and should redirect to the GAS admin dashboard.
