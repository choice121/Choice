# Changelog — Choice Properties

All notable changes to this project are documented here.
Every task, fix, or update must add an entry. Most recent changes appear first.


## [2026-03-31] — Session 027: Photo Upload Deep Audit & Fix (I-062–I-067)

**Session type:** Targeted bug fix — comprehensive audit of the entire photo upload pipeline. 6 issues found and resolved.

### Root Cause
Every photo upload was silently failing even with all environment variables correctly set. The primary cause was a data URI format mismatch: `imagekit.js` sends a full data URI (`data:image/jpeg;base64,...`) but ImageKit's upload API requires raw base64 only. The Edge Function was forwarding the prefixed value verbatim, causing ImageKit to reject or misinterpret every upload.

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/imagekit-upload/index.ts` | I-062: Strip `data:...;base64,` prefix before `formData.append('file', ...)` |
| `js/imagekit.js` | I-063: Throw clear error when compression fails on file >4 MB (was silent body-cap failure) |
| `js/imagekit.js` | I-066: `xhr.timeout` corrected from 120 s to 55 s (Supabase hard limit is 60 s) |
| `js/cp-api.js` | I-064: `getAccessToken()` no longer signs user out on network failure — only on confirmed auth rejection |
| `js/cp-api.js` | I-065: `sb()` now throws a clear diagnostic error if `window.supabase` or `CONFIG` not ready |
| `ISSUES.md` | I-062 through I-067 documented and resolved |
| `CHANGELOG.md` | This entry |
| `SESSION.md` | Handoff document updated |

### Issue Registry
- **Resolved this session:** I-062, I-063, I-064, I-065, I-066, I-067
- **Total resolved:** 67 | **Total tracked:** 69 | **Open:** 0




**Session type:** Infrastructure — full Cloudflare Pages deployment pipeline configured end-to-end.

### Infrastructure
- **Supabase project linked:** `supabase/config.toml` updated with `project_id = "cfsdhylbwzyuvcvbnrel"`. All 11 edge functions deployed (`generate-lease`, `get-application-status`, `imagekit-delete`, `imagekit-upload`, `mark-movein`, `mark-paid`, `process-application`, `send-inquiry`, `send-message`, `sign-lease`, `update-status`).
- **Supabase secrets set:** `GAS_EMAIL_URL`, `GAS_RELAY_SECRET`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`, `ADMIN_EMAIL`, `DASHBOARD_URL`, `FRONTEND_ORIGIN` all configured in Supabase Edge Function secrets.
- **Cloudflare Pages configured:** Build command set to `node generate-config.js`. All required environment variables set for both production and preview environments (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `IMAGEKIT_URL`, `IMAGEKIT_PUBLIC_KEY`, `SITE_URL`, `GEOAPIFY_API_KEY`, `COMPANY_EMAIL`, `COMPANY_PHONE`, `COMPANY_ADDRESS`). `SKIP_DEPENDENCY_INSTALL=true` added to bypass intentional npm preinstall block on static site.

### Fixes
- **`generate-config.js` — Supabase credential validator false-positive on schema-restricted projects:** The build-time credential check tested `GET /rest/v1/` and treated any `401` as an invalid key. Supabase projects with schema listing restricted to `service_role` return `401 Access to schema is forbidden` even for valid anon keys. Fixed by reading the response body on 401 and distinguishing "schema restricted" (valid key, passes build) from "truly invalid key" (fails build).

### Documentation
- `SETUP.md` and `ARCHITECTURE.md` updated with real project ref (`cfsdhylbwzyuvcvbnrel`) replacing `YOUR_PROJECT_REF` placeholder.
- `replit.md` updated: `IMAGEKIT_URL_ENDPOINT` added to the Supabase secrets table.


## [2026-03-31] — Session 025: SETUP.sql Audit & Database Hardening

**Session type:** Bug fixes — resolved 5 SQL compatibility errors blocking fresh-install execution of `SETUP.sql`. Script now runs cleanly on any Supabase project from a blank slate.

### Fixes
- **SETUP.sql — `ADD CONSTRAINT IF NOT EXISTS` invalid syntax:** PostgreSQL does not support `IF NOT EXISTS` on `ADD CONSTRAINT`. Six instances replaced with `DO $$ ... END $$` blocks that check `pg_constraint` before adding each constraint. Fully idempotent on re-run.
- **SETUP.sql — `is_admin()` undefined at policy creation:** RLS policies referencing `is_admin()` appeared before the function definition. Function moved to line 422, above its first use at line 433.
- **SETUP.sql — Co-applicant migration fails on fresh install:** A data migration `INSERT INTO co_applicants` referenced columns (`co_applicant_first_name`, etc.) that only exist after a prior schema migration, causing an error on fresh installs. Wrapped in a `DO` block that checks for column existence first — skips silently on fresh installs, executes correctly on upgrades.
- **SETUP.sql — `GENERATED ALWAYS AS` immutability error:** Full-text search generated columns used `array_to_string` (not immutable) and a bare string literal `'english'` (not recognised as `regconfig` in this context). Fixed by: adding a new `IMMUTABLE` wrapper function `immutable_array_to_text()`, casting `'english'` to `'english'::regconfig`, and casting `'{}'` to `'{}'::text[]`. Resolves `ERROR: generation expression is not immutable`.
- **SETUP.sql — `schema "cron" does not exist`:** `SELECT cron.schedule(...)` had a `WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')` guard, but PostgreSQL parses the full statement before evaluating `WHERE` — so the schema reference fails at parse time when pg_cron is not installed. Replaced with a `DO $outer$ ... END $outer$` block that checks for the extension at runtime using `IF EXISTS` before calling `PERFORM cron.schedule(...)`. SETUP.sql now runs on any Supabase project regardless of whether pg_cron is enabled.


## [2026-03-30] — Session 024 Part 2: Security, Performance & SEO Audit (Complete)

**Session type:** Audit + Fixes — remaining 6 issues from Session 024 audit resolved.

### Medium
- **I-056: send-message length cap** — Server-side 4,000-char limit added. Returns HTTP 400 for oversized or empty messages before DB insert.
- **I-057: Rate limit cold-start caveat documented** — Prominent inline comment added to `process-application` and `send-inquiry` explaining the in-memory store resets on Deno isolate cold start, and the upgrade path to persistent rate limiting.
- **I-058: noindex on all private pages** — `noindex, nofollow` added to 6 landlord portal pages and 9 admin pages. All auth-gated pages are now properly excluded from search indexing.
- **I-059: property.html JSON-LD completed** — Added `potentialAction` (RentAction), `geo`, `datePosted`, `numberOfRooms`, `numberOfBathroomsTotal`, `floorSize`, `amenityFeature` array, and `availability`. Added separate `BreadcrumbList` block. Property pages are now eligible for Google RentalListing rich results.

### Low
- **I-060: Homepage + listings JSON-LD** — `index.html` gets `WebSite` + `SearchAction` (Sitelinks Searchbox) and `Organization` schema. `listings.html` gets `CollectionPage` schema.
- **I-061: Leaflet defer on property.html** — `defer` added to Leaflet JS script tag. Map no longer blocks initial paint of property title, price, and photos.


## [2026-03-30] — Session 024: Security, Performance & SEO Audit (Part 1)

**Session type:** Audit + Fixes — 5 critical/high issues resolved. 6 medium/low issues queued.

### Critical
- **I-051: `SITE_URL` now required at build** — `generate-config.js` added `SITE_URL` to the required env var array. Build exits with code 1 if unset, preventing `YOUR-DOMAIN.com` from ever shipping to production in `sitemap.xml` or `robots.txt`.

### High
- **I-052: CSP nonce injection** — `generate-config.js` now generates a cryptographic nonce per build and injects it into all 40 inline `<script>` blocks across all HTML files. `_headers` CSP `script-src` updated from `'unsafe-inline'` to `'nonce-<value>'`. XSS protection now meaningful.
- **I-053: Render-blocking scripts eliminated** — `defer` added to `config.js` and `components.js` across all 34 HTML pages. Both scripts were previously blocking HTML parser on every page load.
- **I-054: Leaflet moved from unpkg to cdnjs** — `property.html` and `listings.html` now load Leaflet 1.9.4 from `cdnjs.cloudflare.com` with SRI `integrity=` hashes. `unpkg.com` removed from CSP entirely.
- **I-055: imagekit-upload hardened** — Extension whitelist (jpg/jpeg/png/webp only), filename sanitization (path traversal prevention), and 15 MB payload cap added server-side before forwarding to ImageKit.

### Open (queued for next session)
- I-056 · send-message unbounded text (MED)
- I-057 · In-memory rate limit resets on cold start (MED)
- I-058 · apply.html missing OG tags + noindex (MED)
- I-059 · property.html JSON-LD incomplete (MED)
- I-060 · Homepage/listings no JSON-LD (LOW)
- I-061 · property.html Leaflet missing defer (LOW)


## [2026-03-30] — Session 023: Full Cleanup & Modernization Audit

**Session type:** Cleanup — 14 issues resolved. No feature logic changed.

### Critical
- **CSS cache-busting** — All 38 HTML files had stale `?v=` strings (v3–v8) while CSS files were internally versioned at v16. Cloudflare's immutable cache rule was serving stale CSS to returning visitors. All CSS query strings bumped to `?v=16` across every HTML file.
- **`document_urls` display fixed** — `admin/applications.html` and `landlord/applications.html` only checked the legacy `document_url` (singular TEXT field). Now both pages read the `document_urls` JSONB array (added in Session 022), generate Supabase Storage signed URLs per document, and display human-readable labels (Photo ID, Proof of Income, Additional Document). Legacy `document_url` fallback retained for older records.

### High
- **`CP.UI.confirm()` removed** — `cp-api.js` had a `confirm()` method that called `window.confirm()` directly (the banned native dialog API). Removed. `CP.UI.cpConfirm()` is the only confirm dialog.
- **`IMPLEMENTATION-PLAN-020.md` deleted** — 21KB completed planning doc for Sessions 020–021. All work done; file was historical clutter.
- **`supabase` CLI devDependency removed** from `package.json` — The CLI package had no role in this project's mobile-first Supabase Dashboard deployment workflow. `package-lock.json` regenerated clean (0 external packages).
- **Font Awesome async preload** — 9 admin pages and `landlord/new-listing.html` upgraded from render-blocking `<link rel="stylesheet">` to async preload pattern with `<noscript>` fallback.
- **Supabase CDN pinned** — All 29 HTML files that load Supabase now use `@supabase/supabase-js@2.49.1` instead of the floating `@2` tag. Prevents silent breakage from any `@2.x` minor-version change.

### Medium
- **`.replit-guard.js` restored** — Was neutered to a 4-line `process.exit(0)` no-op. Restored to full implementation: detects all 6 Postgres ghost vars (`DATABASE_URL`, `PGHOST`, `PGPASSWORD`, `PGUSER`, `PGDATABASE`, `PGPORT`), prints actionable diagnostic, and exits with code 1 if contamination is found.
- **`SESSION.md` trimmed** — Was 400+ lines with 3 full session handoffs. Now contains only the current session. Prior sessions archived in `CHANGELOG.md`.
- **`SETUP.sql` comment** — Trailing `ALTER TABLE` migration for `document_urls` now clearly states it is for existing databases only; fresh installs already have the column via `CREATE TABLE`.
- **`ISSUES.md`** — Added "🟢 Active Issues: None" summary banner at the top.
- **`replit.md` rewritten** — Was 344 lines with duplicated rules and stale Replit framing. Rewritten as a clean 99-line developer reference with current CSS version table, secrets reference, and accurate rules.

### Low
- **`_redirects`** — Improved comment explaining intentional emptiness.
- **Geocoding error (`js/apply.js`)** — Silent `console.error` in address autocomplete catch block now also fires a `CP.UI.toast()` with an actionable message for the applicant.
- **`health.html`** — Added missing `defer` to Supabase CDN script for consistency with all other pages.

### Files changed
All 38 HTML files (CSS versions + Supabase pin), `js/cp-api.js`, `js/apply.js`, `health.html`, `package.json`, `package-lock.json`, `SETUP.sql`, `ISSUES.md`, `SESSION.md`, `replit.md`, `_redirects`, `.replit-guard.js`, `generate-config.js`, `CHANGELOG.md`

### Files deleted
`IMPLEMENTATION-PLAN-020.md`

---



**Session type:** Implementation — 1 critical bug fixed across 4 files.

**Issue resolved:** I-043 — Applicant-uploaded documents (Photo ID, Proof of Income, Additional Document) were silently discarded at submission and never reached the server. Applicants believed their documents were submitted; they were not.

### Root cause
`apply-submit.js` built the POST payload via `new FormData(form)`, which only serialises standard HTML form controls. The `File` objects stored in `this._uploadedDocs` by `apply-files.js` were invisible to `FormData` and were never included in the payload. The Edge Function received `document_url: null` unconditionally.

### Changes made

**`js/apply-submit.js`**
- Added `uploadDocumentsToStorage()` method. Before the main POST, it resolves the applicant's OTP auth session, uploads each `File` in `this._uploadedDocs` to Supabase Storage (`application-docs` bucket) at path `{user_id}/{doc_type}_{timestamp}.{ext}` — matching the existing RLS policy. Returns the array of storage paths. On partial failure, successfully uploaded paths are retained and a warning toast is shown; the application is not aborted.
- Wired the upload into `handleFormSubmit()`: upload runs between payload build and Edge Function POST. `jsonPayload.document_urls` receives the returned paths.
- Submission progress overlay now shows "Uploading document N of M: {filename}" during Step 1 when documents are present.
- Auth header in the main Edge Function POST now uses the applicant's real JWT when available (previously always sent the anon key, preventing server-side user linking for applicants who had authenticated).

**`supabase/functions/process-application/index.ts`**
- Added `document_urls` to the application record: `Array.isArray(formData.document_urls) ? formData.document_urls : []`. Stored as JSONB array of storage paths.

**`SETUP.sql`**
- Added `document_urls JSONB DEFAULT '[]'::jsonb` to `CREATE TABLE applications` definition.
- Added idempotent `ALTER TABLE applications ADD COLUMN IF NOT EXISTS document_urls JSONB DEFAULT '[]'::jsonb` migration at end of file for existing databases.

### Files changed
`js/apply-submit.js`, `supabase/functions/process-application/index.ts`, `SETUP.sql`, `ISSUES.md`, `CHANGELOG.md`

---

## [2026-03-29] — Session 021: Photo upload overhaul — I-050

**Session type:** Implementation — 7 fixes in imagekit.js, new-listing.html, landlord.css

- **I-050a** Canvas compression before upload — fixes 6 MB edge function body cap, ~80% faster mobile uploads
- **I-050b** XHR real upload progress — bar moves smoothly 40→85% instead of freezing
- **I-050c** Per-file error isolation — one failed photo no longer aborts entire batch
- **I-050d** HEIC rejection at selection time — actionable message with iOS Settings path
- **I-050e** Photo deduplication — same file selected twice no longer double-uploads
- **I-050f** File size badge on thumbnails — immediate feedback at selection, not submit
- **I-050g** Preview blob URL fix — data URLs used instead of blob: URLs (iOS Safari cross-tab fix)
- **I-050h** Dropzone hint text updated with accepted formats and iPhone guidance

## [2026-03-28] — Session 020: Implementation — I-037 through I-049

**Session type:** Implementation — 12 issues closed across listing form, application form, and Edge Function.

### Listing Form (`landlord/new-listing.html`)
- **I-037** — Replaced `window.confirm()` duplicate address dialog with `CP.UI.cpConfirm()` modal
- **I-038** — Added `min="1"` to rent, `min="0"` to sqft and deposit inputs; added `CHECK (monthly_rent > 0)` constraint to `SETUP.sql`
- **I-039** — Added `maxlength="2000"` to description textarea; updated `validate5()` to enforce the limit if bypassed
- **I-040** — Moved duplicate address check to run before photo uploads (was after); eliminates wasted upload bandwidth on cancel
- **I-041** — Set `availDate.min` to today on page init; past dates no longer selectable in the date picker
- **I-042** — Added photo-not-saved warning note to draft resume banner

### Application Form (`apply.html` + companions)
- **I-044** — Added `maskGovernmentId()` to `process-application` Edge Function; government ID numbers stored as `***-XXXX`, never plaintext
- **I-045** — Application fee now fetched server-side from the property record in the Edge Function; client-supplied fee value is ignored. Landlord ID resolved in the same query (one fewer DB round-trip)
- **I-046** — Replaced `alert()` calls with `CP.UI.toast()` in both `apply.html` inline script and `js/apply-files.js`
- **I-047** — Added `maxlength` attributes to all free-text inputs across the application form (44 total)
- **I-048** — Removed income-to-rent ratio widget from `apply.html`; removed ratio calculator from `js/apply.js`; removed `_updateRatio` call from `js/apply-property.js`
- **I-049** — Updated contact method hint text to "Select at least one — you can choose both"; updated English and Spanish translations in `apply-translations.js`

### Deferred
- **I-043** — Document upload silent discard — remains deferred to Session 021 (requires Storage bucket + schema change)

### Files changed
`landlord/new-listing.html`, `apply.html`, `js/apply-files.js`, `js/apply.js`, `js/apply-property.js`, `js/apply-translations.js`, `supabase/functions/process-application/index.ts`, `SETUP.sql`, `ISSUES.md`, `CHANGELOG.md`, `SESSION.md`

---

## [2026-03-28] — Session 020: Deep Audit + Replit Protection + Implementation Planning

**Session type:** Audit, environment hardening, and documentation — no feature code changed.

This session covered three workstreams:

### 1. Replit Import Protection (all 7 layers implemented)

Replit was auto-provisioning a local PostgreSQL instance on import, injecting `DATABASE_URL`,
`PGHOST`, and related ghost variables that mislead AI agents into treating the project as a
Node+Postgres app. A 7-layer defence was implemented:

- **`.replit` rewritten** — `postgresql-16` removed from `modules`. Run button rewired from
  `node serve.js` → `node .replit-guard.js`. `[userenv]` block with plaintext Supabase
  credentials removed (credentials must live in Replit Secrets only). Detailed comments explain
  every decision for future agents and humans.
- **`package-lock.json` regenerated** — 14 ghost `pg`-related packages (`pg`, `pg-pool`,
  `pg-cloudflare`, `pg-connection-string`, `pg-protocol`, `pg-types`, `pgpass`, and 7 more)
  removed. Lockfile now has 0 external packages, matching `package.json`.
- **`.replit-guard.js` created** — new Node script wired to the Run button. Checks for Postgres
  ghost env vars (`DATABASE_URL`, `PGHOST`, `PGPASSWORD`, `PGUSER`, `PGDATABASE`, `PGPORT`)
  before starting `serve.js`. If any are detected, prints a loud diagnostic and exits with code 1.
  If Supabase keys are missing, prints a friendly warning but continues. Safe starts log a clean
  confirmation before launching the preview server.
- **`.npmrc` created** — `ignore-scripts=true` blocks postinstall/prepare scripts from running
  automatically on `npm install`, preventing any installed package from mutating the project.
- **`REPLIT_USAGE.md` created** — prominently named hard-stop document for AI agents and humans.
  Contains: what Replit is used for, what it is not, a table of poison env vars and what to do
  with them, a protected file list, and pointers to `.agents/instructions.md`.
- **`.agents/instructions.md` strengthened** — Replit-specific tripwire block inserted at the
  very top of the file (above all existing rules). Names the environment explicitly, lists all
  poison vars, explains the guard script, and scopes agent work to static files only.

All 6 new/modified files are tracked in Git and survive GitHub push → new Replit import → ZIP
download. The guard script catches Postgres injection at runtime even if `.replit` reverts.

### 2. Deep Form Audit — 13 New Issues Identified

Full read of `landlord/new-listing.html`, `apply.html`, `js/apply-validation.js`,
`js/apply-submit.js`, `js/apply-files.js`, and `supabase/functions/process-application/index.ts`.

**Listing form (6 issues, I-037 to I-042):**
- I-037 🟠 `window.confirm()` banned API for duplicate address check
- I-038 🟠 Negative numbers accepted for rent, sqft, deposit (no `min` attribute)
- I-039 🟡 Description has no maximum length enforced (counter shows 2000 but no cap)
- I-040 🟠 Duplicate check runs after photo upload — orphans CDN assets on cancel
- I-041 🟡 Available date accepts past dates (no `min` attribute)
- I-042 🟡 Draft resume banner does not warn that photos are not saved

**Application form (7 issues, I-043 to I-049):**
- I-043 🔴 Documents silently discarded — `_uploadedDocs` never read at submit time (CRITICAL)
- I-044 🟠 Government ID number stored in plaintext — should be masked like SSN
- I-045 🟠 Application fee resolved from stale cached client data — not re-fetched server-side
- I-046 🟠 `alert()` used in document upload validation — banned API (two locations)
- I-047 🟡 Free-text fields have no `maxlength` — unbounded input accepted
- I-048 🔵 Income-to-rent ratio display — owner requests removal
- I-049 🟡 Contact method preference label says optional but validation requires it

### 3. Session 020 Implementation Plan Written

`IMPLEMENTATION-PLAN-020.md` created — full implementation plan for all issues scheduled for
Session 020 (I-037 to I-042, I-044 to I-049) and Session 021 (I-043). Each issue includes:
exact file and line-level changes, execution order, blast radius, verification steps, and
CSS version bump requirements.

**Files changed:** `.replit`, `package-lock.json`, `.agents/instructions.md`,
`ISSUES.md`, `CHANGELOG.md`, `SESSION.md`
**Files created:** `.replit-guard.js`, `.npmrc`, `REPLIT_USAGE.md`, `IMPLEMENTATION-PLAN-020.md`
**Feature code changed:** None — documentation and environment hardening only.

---

## [2026-03-28] — Session 019: Documentation & Configuration Audit (15 findings)

Full project scan of all docs, config, build scripts, security headers, and SQL.
No feature code changed. All findings were documentation errors, config bugs, or dead files.

**🔴 Critical fixes:**
- **`build.js` deleted** — was a stale duplicate of `generate-config.js` that overwrote the correct
  config on every deploy, silently undoing the I-032 ImageKit preset fix and removing validation.
  `package.json` build script changed from `node generate-config.js && node build.js` →
  `node generate-config.js`. `generate-config.js` is now the single authoritative config generator.
- **`pg` devDependency removed** from `package.json` — PostgreSQL client had no place on a static
  site and was a footgun for AI agents that could use it to justify database connections.
- **`ARCHITECTURE.md` ghost file refs fixed** — two sections referenced `SCHEMA.sql` and
  `SECURITY-PATCHES.sql` (deleted long ago, merged into `SETUP.sql`). Updated to `SETUP.sql`.
- **`ARCHITECTURE.md` stale Known Active Bugs section removed** — listed I-018 and I-023 as active
  (both resolved). ImageKit gaps table also showed I-015, I-016, I-028 as OPEN (all resolved).
  Replaced with a clean Issue Registry pointer to `ISSUES.md`.

**🟠 High fixes:**
- **`SITE_URL` added to SETUP.md Step 6** — was missing from the Cloudflare env vars table despite
  being required for the I-029 sitemap/robots.txt domain rewrite fix.
- **`COMPANY_TAGLINE` added to SETUP.md Step 6** — env var was read by `generate-config.js` but
  never documented in the setup guide.
- **`ADMIN_EMAILS` clarified in SETUP.md** — explained the plural/singular split: `ADMIN_EMAILS`
  (Cloudflare, UI display only) vs `ADMIN_EMAIL` (Supabase secret, server-side notifications).

**🟡 Medium fixes:**
- **`generate-config.js` external URL fallback fixed** — was proxying external URLs (Zillow CDN, S3)
  through ImageKit (`encodeURIComponent(url)` branch), which breaks those URLs. Now matches
  `config.example.js`: external URLs are returned directly without transformation.
- **CSP `connect-src` updated** — added `https://api.imagekit.io` alongside existing
  `upload.imagekit.io`. Prevents silent CSP violations on ImageKit auth endpoint calls.
- **`scripts/` directory deleted** — `check_db.js` and `check_landlords.js` were debug-only scripts
  with no production purpose. Removed to reduce AI agent confusion and repo noise.
- **`robots.txt` placeholder comment improved** — replaced vague TODO with a clear note that the
  `YOUR-DOMAIN.com` placeholder is automatically rewritten at build time when `SITE_URL` is set.

**🔵 Low / cleanup:**
- **`replit.md` de-Replit-ified** — retitled "Developer Reference", removed all Replit-specific
  framing and identity ("Replit Agent", "Replit Secrets panel"), removed references to deleted
  scripts, added `DASHBOARD_URL` / `ADMIN_EMAIL` distinction to secrets table. Useful content
  (auth ground truth, CSS architecture, DB functions, mobile rules) preserved in full.
- **`ARCHITECTURE.md` Deployment Checklist updated** — corrected `SCHEMA.sql` ref, added
  mobile/dashboard deploy note for Edge Functions, added listings seed step.
- **`.agents/instructions.md` I-031 entry updated** — noted that `build.js` is deleted and
  `generate-config.js` is now the sole build script. Prevents future AI from recreating `build.js`.

**Files changed:** `package.json`, `generate-config.js`, `_headers`, `robots.txt`, `SETUP.md`,
`ARCHITECTURE.md`, `replit.md`, `.agents/instructions.md`, `ISSUES.md`, `CHANGELOG.md`, `SESSION.md`
**Files deleted:** `build.js`, `scripts/check_db.js`, `scripts/check_landlords.js`

---

## [2026-03-28] — Session 018: Phase 2 fixes (I-035, I-036) — all issues resolved

Final two open issues closed. The issue registry is now fully resolved (36 RESOLVED, 1 WONT FIX).

- **I-035 — `property.html`:** Replaced the silent redirect-to-`/index.html` with a proper
  `CP.UI.toast('Property not found.', 'error')` call followed by an 800ms delayed redirect
  to `/listings.html`. Fallback to an immediate redirect if `CP.UI` is not yet available.
  Applies when `?id=` param is missing or empty and `?preview=true` is not set.
- **I-036 — `SETUP.md`:** Expanded the `DASHBOARD_URL` row in the Supabase Secrets table
  with a full description explaining its role in `generate-lease` and `sign-lease` Edge Functions.
  Added a ⚠️ callout block warning that missing this value produces broken tenant signing links.
  Also clarified the `FRONTEND_ORIGIN` row (must match exactly, no trailing slash).

**Files changed:** `property.html`, `SETUP.md`, `ISSUES.md`, `CHANGELOG.md`, `SESSION.md`
**Open issues remaining:** 0
**Platform status:** ✅ Feature-complete. All issues resolved. Ready for launch.

---

## [2026-03-28] — Session 018: Phase 1 launch fixes (I-029 through I-034)

All 5 launch blockers resolved. 1 medium fix (I-034) also applied.

- **I-029 — `generate-config.js`:** Added `SITE_URL` env var. At build time, reads `sitemap.xml`
  and `robots.txt` and replaces all `YOUR-DOMAIN.com` occurrences with the real domain.
  Emits a warning (not a hard failure) if `SITE_URL` is not set.
- **I-030 — `js/components.js`:** After component injection, sets `og:url` meta tag content
  to `location.href`. One line covers all 7 affected pages. `property.html` unaffected.
- **I-031 — `package.json`:** Build script changed from `node generate-config.js` to
  `node generate-config.js && node build.js`. Both generators now run on every deploy.
- **I-032 — `generate-config.js`:** Added `gallery_2x` (`tr:w-2400,q-85,f-webp`) and
  `strip` (`tr:w-80,h-60,c-maintain_ratio,q-70,f-webp`) to `CONFIG.img` transforms.
  Matches `config.example.js` exactly. Fixes silent fallback on `property.html` retina images.
- **I-033 — `index.html`:** `loadFeaturedListings()` now renders a warm empty state
  (🏡 icon, "Listings Coming Soon" heading, subtext, CTA button) when DB returns no listings.
  Section is shown rather than hidden. CSS tokens only — no hardcoded colours.
- **I-034 — `generate-config.js`:** `COMPANY_EMAIL` fallback changed from `''` to
  `'hello@choiceproperties.com'`. Prevents blank `mailto:` links in nav/footer.

**Owner action required:** Add `SITE_URL` env var in Cloudflare Pages dashboard to activate I-029.
**Launch blockers remaining:** 0
**Open issues remaining:** 2 (I-035, I-036 — Phase 2, can be done post-launch)

---

## [2026-03-28] — Session 017: Launch readiness audit — documentation update

No source code was changed this session. A full-platform launch readiness audit
identified 5 launch blockers and 3 medium issues. All findings were translated
into the project documentation system:

- **`.agents/instructions.md`:** Added "LAUNCH FIX BACKLOG" section with ordered
  Phase 1/2/3 fix tables, per-issue implementation instructions, and the
  PAYMENT FLOW OWNER-PROTECTED clause (DF-002 closed as WONT FIX).
- **`ISSUES.md`:** Added Group G (I-029 through I-036) + DF-002 WONT FIX.
  Updated Summary Snapshot: 28 resolved, 8 open, 1 wont fix.
- **`SESSION.md`:** Replaced with Session 017 handoff. Next session target is
  Phase 1 code fixes (I-029 through I-034).

**Launch readiness score at session start:** 74/100 (external audit)
**Launch blockers remaining:** 5 (I-029 through I-033)

---

## [2026-03-28] — I-022: Draft storage moved from sessionStorage to localStorage (Session 016)

- **`landlord/new-listing.html`:** Replaced all 8 draft key references (`cp_draft_s1`, `cp_draft_propid`) from `sessionStorage` to `localStorage`. Drafts now persist across tab closes and browser restarts, making the existing 7-day expiry logic meaningful. The preview key (`cp_listing_preview`) intentionally remains in `sessionStorage` — it is consumed by `property.html?preview=true` opened in a new tab from the same session and should not persist between sessions.



- **`js/imagekit.js` line 62:** Changed throw threshold from `20 * 1024 * 1024` to `10 * 1024 * 1024`. Error message updated to "exceeds 10MB." The dropzone hint in `new-listing.html` already read "up to 10MB each" — no change needed there. Code and UI now consistently enforce 10MB per photo.



- **`js/cp-api.js` line 222:** Replaced `.eq('parking', true)` with `.not('parking', 'is', null).neq('parking', '').neq('parking', 'None')`. The `parking` column is `TEXT` — comparing it to a boolean `true` always returned zero rows in PostgreSQL. The fix correctly matches any property with a real parking option (Street, Driveway, 1-car garage, 2-car garage, Parking lot) while excluding null and "None" values. The Parking filter pill on listings.html now works correctly.



- **`js/imagekit.js` line 89:** Renamed `fileBase64:` to `fileData:` in the JSON body sent to the `imagekit-upload` Edge Function. The Edge Function destructures `{ fileData, fileName, folder }` — the previous key name `fileBase64` caused `fileData` to be `undefined` on every call, returning `{ success: false, error: 'fileData and fileName required' }`. All property photo uploads (new listings and edits) were completely broken. One-character key rename; no other files changed.



**No source code was changed.** This entry covers the audit findings and documentation updates only. Code fixes will each get their own changelog entries as they are applied.

### Audit Scope
Full audit of the property upload/posting system across 8 core files:
`new-listing.html`, `edit-listing.html`, `imagekit.js`, `imagekit-upload/index.ts`, `cp-api.js`, `listings.html`, `property.html`, `SETUP.sql`.

### 17 New Issues Identified (I-012 through I-028)

**Critical (2):**
- **I-012:** `fileBase64` vs `fileData` field name mismatch between `imagekit.js` and the `imagekit-upload` Edge Function. All photo uploads fail completely.
- **I-013:** Parking filter pill in `cp-api.js` uses `.eq('parking', true)` against a TEXT column. Returns zero results on every search.

**High (4):**
- **I-014:** Draft autosave (`autosaveDraft`) does not save utilities, amenities, or lease term checkbox state. `applyDraftToForm` cannot restore them.
- **I-015:** Photos removed from a listing or deleted with a listing are never removed from ImageKit CDN. `fileId` is returned by the upload function but discarded by the client.
- **I-016:** `uploadMultipleToImageKit()` is a sequential `for...await` loop. 20 photos upload one-at-a-time — severe UX degradation on mobile.
- **I-017:** Dropzone hint says "up to 10MB" but `imagekit.js` only throws at 20MB. Inconsistent documentation.
- **I-018:** `applications_count` and `saves_count` columns in `properties` are permanently 0. No DB triggers exist to update them.

**Medium (6):**
- **I-019:** Geocoding race condition — coordinates may be null at submit if the landlord moves quickly between steps.
- **I-020:** Duplicate listing detection is client-side only (confirm dialog); no server-side enforcement.
- **I-021:** "Preview as Tenant" shows placeholder image — `photo_urls: []` hardcoded; pending File objects not converted to object URLs.
- **I-022:** Draft stored in `sessionStorage` — lost when the tab is closed despite a 7-day expiry claim.
- **I-023:** State dropdown defaults to Michigan for all users via hardcoded `selected` attribute.
- **I-024:** Full-text search index (`search_tsv`) covers only title/city/state/address — excludes description and amenities.
- **I-025:** No photo reordering on new listing form. First uploaded photo becomes cover with no way to change until after submission.

**Low (3):**
- **I-026:** `Properties.create()` in `cp-api.js` is unused — `new-listing.html` has its own parallel insert path.
- **I-027:** Submit button not disabled immediately — double-submit window exists before photo upload begins.
- **I-028:** `fileId` returned from `imagekit-upload` Edge Function is silently discarded by `imagekit.js`.

### Documentation Files Updated
- `ISSUES.md` — Added I-012 through I-028; summary updated to 17 OPEN, 11 RESOLVED, 28 total
- `SESSION.md` — Replaced with Session 016 handoff doc
- `CHANGELOG.md` — This entry
- `ARCHITECTURE.md` — Photo upload section updated with known gaps and planned improvements

## [2026-03-28] — Performance Pass: wiring fixes (Session 015 — scan pass)

Four pages were found during the post-session audit to be bypassing the updated `cp-api.js` methods entirely, using direct Supabase queries instead. Fixed to use the correct API methods so the performance improvements take effect.

- **`admin/email-logs.html`:** Replaced inline `CP.sb().from('email_logs')...limit(500)` with `CP.EmailLogs.getAll({ perPage: 500 })`. Now uses the paginated method with correct error handling via the `{ ok, data, error }` shape.
- **`admin/landlords.html`:** Replaced inline `CP.sb().from('landlords').select('*')` (unbounded) with `CP.Landlords.getAll({ perPage: 500 })`. Same shape fix. The `toggleVerify` write call is unchanged — it targets a single row by ID and does not need pagination.
- **`landlord/dashboard.html` — `loadInquiries()`:** Replaced two-query waterfall (`properties` fetch → `inquiries` fetch) with `CP.Inquiries.getForLandlord(landlordId)`. Reduces load from 2 round-trips to 1.
- **`landlord/inquiries.html`:** Replaced two-query waterfall with `CP.Inquiries.getForLandlord(profile.id)`. Property data now comes back nested as `inq.properties` from the `!inner` join — `propMap` is built from that instead of a separate fetch. `renderInquiries` updated to read `inq.properties || propMap[inq.property_id]` (safe fallback). `markAllRead` updated to derive property IDs from `allInquiries` instead of the now-removed `propIds` variable.



### Database — `SETUP.sql`
- **Composite indexes on `properties`:** Added `idx_properties_status_type`, `idx_properties_status_rent`, `idx_properties_status_beds`, `idx_properties_status_avail`. Covers the four most common compound filter combinations on the listings page; Postgres can now satisfy these with an index-only scan instead of post-filtering a full `status` index range.
- **GIN full-text index:** Added `search_tsv tsvector GENERATED ALWAYS AS ... STORED` column on `properties`, built from `title || city || state || address` via `to_tsvector('english', ...)`. Added `idx_properties_search_gin` GIN index. Replaces the previous `ilike '%term%'` four-column scan (which could not use any B-tree index due to the leading wildcard).

### API Client — `js/cp-api.js`
- **`Properties.getListings()` text search:** Switched from `.or(ilike…)` across four columns to `.textSearch('search_tsv', term, { type: 'websearch', config: 'english' })`. Falls back to a single `ilike` on `title` only if the input contains characters unsafe for tsquery (bare punctuation, etc.).
- **`Inquiries.getForLandlord()` N+1 fix:** Replaced the two-query waterfall (fetch property IDs → fetch inquiries) with a single PostgREST `!inner` join query using `.eq('properties.landlord_id', landlordId)`. Saves one round-trip on every dashboard and inquiries page load.
- **`CP.UI.lqipUrl(url)`:** Promoted from a private function inside `property.html` to a first-class `CP.UI` method. Returns a tiny (30px wide, blur-20, q-20, webp) ImageKit URL for blur-up placeholder loading. Returns `null` gracefully when ImageKit is not configured.
- **`EmailLogs.getAll(filters)`:** Added `perPage` (default 50) and `page` support with `.range()` and `count: 'exact'`. Removed hardcoded `limit(500)`. Returns `{ ok, data, error, count, page, perPage }`.
- **`Landlords.getAll(filters)`:** Added `perPage` (default 50) and `page` support with `.range()` and `count: 'exact'`. Previously fetched all rows unbounded.

### Config — `config.example.js`
- **Added `gallery_2x` preset:** `tr:w-2400,q-85,f-webp` — used by `property.html` hero `srcset` for retina displays. Was previously absent from the template, causing a silent fallback to `gallery`.
- **Added `strip` preset:** `tr:w-80,h-60,c-maintain_ratio,q-70,f-webp` — used by `property.html` thumbnail strip. Same issue.

### Frontend
- **`landlord/dashboard.html` — listing thumbnails:** `listing-thumb` images now use `CONFIG.img(photo, 'thumb')` (120×120 webp q-75) instead of the raw full-resolution URL. Reduces thumbnail payload by ~90% on average.
- **`listings.html` — LQIP blur-up:** Card slide wrappers now receive a `background-image` set to `CP.UI.lqipUrl(url)` before the full image loads. The full image fades in via the existing `cp-img-loaded` transition, eliminating the blank flash on slower connections.
- **`index.html` — LQIP blur-up:** Same treatment applied to featured listing cards on the homepage.
- **`property.html` — `lqipUrl()` delegate:** The standalone private `lqipUrl()` function body (12 lines) replaced with a one-line delegate: `function lqipUrl(url) { return CP.UI.lqipUrl(url); }`. Behaviour identical; `cp-api.js` is now the single source of truth.



- **`supabase/functions/process-application/index.ts`:** Added `cors` to the existing `_shared/cors.ts` import. Removed the inline `corsHeaders` constant (line 9). Replaced all 5 `{ ...corsHeaders, … }` response header spreads with `{ ...cors, … }`. Zero behaviour change — values were identical. I-002 is now fully clean across all Edge Functions.

## [2026-03-28] — I-009: Lease template extracted to shared module (Session 014)

- **`supabase/functions/_shared/lease-template.ts` — new file:** Extracted `buildLeaseHTML(app, coApp)` from `sign-lease/index.ts` into a dedicated shared module. Exports a single named function. Includes its own `fmt` and `fmtDate` helpers (private to the module). Imports `escHtml` from `_shared/utils.ts`.
- **`supabase/functions/sign-lease/index.ts`:** Removed inline `buildLeaseHTML` definition (~130 lines). Added `import { buildLeaseHTML } from '../_shared/lease-template.ts'`. No behaviour changes — identical output.
- **`generate-lease/index.ts`:** No changes. The `STATE_COMPLIANCE` table, `getStateCompliance()`, and `extractState()` helpers are only used there; they remain in place.

## [2026-03-28] — I-010: Consistent loading/empty-state pattern (Session 013)

- **`js/cp-api.js` — three new `UI` helpers:**
  - `UI.skeletonRows(rows, cols)` — returns `rows` shimmer placeholder `<tr>` rows, each with `cols` animated `<div class="sk-cell">` cells. Drop-in for any `tbody.innerHTML` call before a fetch.
  - `UI.emptyState(message, icon, cols)` — returns a centred empty-state block. When `cols > 0`, wraps in `<tr><td colspan="cols">` for table use; otherwise returns a bare `<div>` for card/div containers.
  - `UI.errorState(message, cols)` — same shape as `emptyState` but styled in error red with a ⚠️ icon. Used whenever a Supabase query returns an `error` object on a page-load fetch.
- **`css/admin.css` → v3:** Added `@keyframes cp-shimmer`, `.sk-row td`, `.sk-cell` (shimmer animation), `.cp-empty-state`, `.cp-empty-icon`, `.cp-empty-msg`, `.cp-error-state`, `.cp-error-icon`, `.cp-error-msg`.
- **`css/landlord.css` → v3:** Same skeleton and state CSS added (identical classes, uses landlord-side CSS tokens).
- **7 admin pages wired:**
  - `admin/email-logs.html` — skeleton on load, `emptyState` on no results, `errorState` on fetch failure.
  - `admin/landlords.html` — skeleton on load, `emptyState`, `errorState`.
  - `admin/leases.html` — skeleton inside `load()` (called on init + realtime), `emptyState`, `errorState`.
  - `admin/listings.html` — skeleton inside `load()`, `emptyState`, `errorState`.
  - `admin/move-ins.html` — skeleton on load, `emptyState`, `errorState`.
  - `admin/dashboard.html` — skeleton rows in both `#recent-apps` and `#lease-pipe` tbodies before data arrives; `emptyState` and `errorState` for both.
  - `admin/messages.html` — div-based: initial `cp-empty-state` spinner replaced, `emptyState` on no threads, `errorState` on fetch failure.
- **3 landlord pages wired:**
  - `landlord/dashboard.html` — skeleton rows in `#listingsTbody` and initial loading state in `#appsContent` before fetch; `emptyState` for no-listings and no-apps states; `errorState` on listings fetch failure. Also fixed a corrupted `if (!data.length)` guard in `loadApplicationSummaries` left by a prior partial edit.
  - `landlord/inquiries.html` — `errorState` replaces ad-hoc inline error HTML on fetch failure; `emptyState` already wired in prior session confirmed intact.
  - `landlord/applications.html` — `emptyState` in the message-thread modal for the no-messages case.
- **No backend changes** — no Edge Functions, no SQL schema changes, no Supabase RLS changes.
- **Files not touched:** `admin/login.html`, `admin/applications.html` (card layout), all `apply/` pages, all `supabase/functions/`, `index.html`, `listings.html`, `property.html`.

## [2026-03-28] — I-008: Server-side listings filtering + pagination (Session 012)

- **`cp-api.js` — new `Properties.getListings(filters)` method:** Replaces the previous all-rows fetch with a fully server-side query. Accepts `{ q, type, beds, min_baths, min_rent, max_rent, sort, page, per_page }`. Applies text search via Supabase `.or()` across `title`, `city`, `state`, and `address`; property type / pets / parking / available-now via `.eq()` / `.lte()`; bedroom exact-match or `gte`; bathroom and rent range filters; all 4 sort options pushed into `.order()`; pagination via `.range(from, to)` with `count: 'exact'`. Returns `{ ok, data: { rows, total, page, per_page, total_pages }, error }` — consistent with the project-wide `{ ok, data, error }` shape.
- **`listings.html` — full JS rewrite (server-side + URL sync + pagination):**
  - **No more `allProperties` array.** Every filter interaction fires a fresh `CP.Properties.getListings()` call — only the current page of 24 rows is ever in memory.
  - **URL-first state.** All filter state (`q`, `beds`, `maxrent`, `minrent`, `minbaths`, `type`, `sort`, `page`) lives in the query string. `readURL()` populates JS state from `location.search`; `pushURL()` writes state back. Filters are now bookmarkable and shareable.
  - **`popstate` listener** — browser back/forward navigation re-reads the URL and re-fetches, so history works correctly across paginated and filtered states.
  - **Pagination bar** (`#paginationBar` div, already in HTML). `renderPagination()` renders a smart page control: prev/next buttons, page number buttons for first, last, and current±1, with ellipsis gaps. Clicking any page button scrolls to top and fetches that page.
  - **Subheading now shows range:** e.g. "Showing 25–48 of 312" when multiple pages exist.
  - **Skeletons on every fetch** — `showSkeletons()` replaces the grid and clears the pagination bar immediately on each fetch call, so the loading state is always visible.
  - **Map view** now fetches its own `getListings` call (same filters, current page) rather than filtering `allProperties` client-side.
  - **`clearAllFilters()`** resets all state, calls `pushURL(true)` (replace, not push), and re-fetches.
  - **`setupFilters()`** pill active-state management simplified — pills no longer manually toggle classes; `syncControls()` handles all UI sync from state.
- **Pagination CSS** added to `listings.css`: `.pagination`, `.pg-btn`, `.pg-active`, `.pg-ellipsis`, `.pg-prev`, `.pg-next`, disabled state, mobile responsive (34px touch target at ≤480px).
- **`listings.css` version bump** — increment to `?v=7` recommended on deploy.
- **No backend changes** — no Edge Functions, no SQL schema changes, no Supabase RLS changes required.

## [2026-03-28] — I-007: Nav/footer component loader (Session 011)

- **New `components/nav.html`:** Single canonical copy of the nav drawer overlay, mobile drawer, and main nav bar. All `data-nav-path` attributes added to linkable items so the active state can be set dynamically by pathname.
- **New `components/footer.html`:** Single canonical footer with logo emblem, full four-column link grid, Equal Housing line, and `data-cfg-email` / `data-cfg-phone` attribute hooks.
- **New `js/components.js`:** Fetch-based HTML include loader. Fetches both components in parallel, injects into `#site-nav` and `#site-footer` placeholders, then: sets the active nav link by `location.pathname`; wires the mobile drawer (open/close/overlay-click/Escape-key, with correct `aria-expanded` updates); adds the `.scrolled` scroll-shadow to `#mainNav`; hydrates all `data-cfg-email` / `data-cfg-phone` / `#drawerFooterEmail` elements from `window.CONFIG`; polls for `window.CP` and calls `CP.updateNav()` once the cp-api module is ready.
- **10 public pages updated** (`index.html`, `listings.html`, `about.html`, `faq.html`, `how-it-works.html`, `how-to-apply.html`, `property.html`, `privacy.html`, `terms.html`, `404.html`): nav block (~67 lines each) replaced with `<div id="site-nav"></div>`; footer block replaced with `<div id="site-footer"></div>`; all per-page inline nav scripts (drawer setup, scroll shadow, `openDrawer`/`closeDrawer` functions, `initContacts` blocks) removed; `<script src="/js/components.js"></script>` added after the `cp-api.js` tag.
- **4 pages newly load `cp-api.js`** (`how-it-works.html`, `privacy.html`, `terms.html`, `404.html`): these previously had no `cp-api.js` tag, so the "For Landlords" auth link was never updated. Now all 10 public pages consistently show the correct landlord auth state.
- **Drift fixed:** `listings.html` had `class="nav scrolled"` baked into the HTML — now removed (JS sets it dynamically). Several pages had slightly divergent drawer implementations; all replaced by the single canonical version in `components.js`.
- **No CSS changes:** no `?v=` bumps required.
- **Files not touched:** `apply.html` (custom apply-form nav), `health.html` (no nav/footer), all landlord pages, all admin pages, all Edge Functions, `cp-api.js`.

## [2026-03-28] — I-005: Extract co_applicants table (Session 010)

- **New `co_applicants` table (`SETUP.sql`):** 14 co-applicant identity and employment columns extracted from `applications` into a dedicated one-to-one child table. The table has its own RLS policies mirroring `applications` (admin all, landlord read, applicant read). A `UNIQUE (app_id)` constraint enforces the one-to-one relationship.
- **Data migration baked into `SETUP.sql`:** An `INSERT … SELECT … ON CONFLICT DO NOTHING` block backfills all existing rows where `has_co_applicant = true`. Safe to re-run.
- **Column drop guarded by `DO $$ IF EXISTS $$`:** The 14 columns are dropped from `applications` only if they still exist, making the migration safe for fresh installs and re-runs alike.
- **`has_co_applicant` flag stays on `applications`:** Used extensively for quick existence checks throughout the codebase — moving it would require changes in dozens of places for no gain.
- **Lease signing columns stay on `applications`:** `co_applicant_signature`, `co_applicant_signature_timestamp`, and `co_applicant_lease_token` remain on the main table because `sign_lease_co_applicant()` (DB function) operates atomically on a single row. Extracting these is a separate, lower-priority concern (I-009 territory).
- **`get_application_status()` updated (`SETUP.sql`):** Now fetches a `co_applicants` row via `SELECT * INTO v_coapp` and populates `co_applicant_first_name`, `co_applicant_last_name`, and `co_applicant_email` from `v_coapp.*`. Output shape is unchanged — consumer pages need no edits.
- **`get_lease_financials()` updated (`SETUP.sql`):** Last-name security gate now runs two passes — primary applicant first, then a `JOIN co_applicants` fallback if not found. Returns `co_applicant_email` from the joined row.
- **`admin_application_view` updated (`SETUP.sql`):** Added `LEFT JOIN co_applicants ca ON ca.app_id = a.app_id`. Co-applicant columns aliased to their original names so all admin pages continue to work without changes.
- **`process-application/index.ts`:** Removed 14 co-applicant fields from the `applications` insert `record`. After the main insert, a separate `supabase.from('co_applicants').insert(coRecord)` runs when `has_co_applicant` is true. Co-applicant insert failure is non-fatal (logged, not thrown) — the application is already committed.
- **`sign-lease/index.ts`:** Added `coApp` fetch (`co_applicants … maybeSingle()`) after the main `app` fetch. `buildLeaseHTML` updated to accept `coApp` as a second parameter. All `app.co_applicant_first_name/last_name/email` reads replaced with `coApp?.first_name/last_name/email`.
- **`generate-lease/index.ts`:** No changes required — it only reads `has_co_applicant` and `co_applicant_lease_token`, both of which stay on `applications`.

## [2026-03-17] — Tenant Dashboard: Auth Gate, Move-In Callout, Empty Reply Guard

- **Auth gate on reply area (`apply/dashboard.html`):** Unauthenticated users who look up an application by App ID now see a "Sign in to send a message" prompt instead of the reply textarea. Previously, anyone knowing an App ID could call `submit_tenant_reply` as that tenant without being signed in. The compose area only renders when `currentUser` is set.
- **Move-in coordination callout (`apply/dashboard.html`):** When a lease is fully signed (`signed` or `co_signed`) and `move_in_status` is not yet `completed`, a new blue "Next Step: Move-In Coordination" callout appears below the tenancy confirmation. It shows the total move-in amount (from `move_in_costs` if available, or a generic description) and the lease start date, so tenants know what to expect before the team reaches out.
- **Empty reply guard (`apply/dashboard.html`):** The Send button now starts disabled and only enables when the textarea contains non-whitespace content (`oninput` event). The existing early-return guard in the click handler remains as a second layer of defence.

## [2026-03-15] — Admin Dashboard Polish (6 Small Fixes)

- **Favicon** added to all 9 admin pages — `assets/favicon.svg` is now linked in every `<head>`, eliminating the 404 console error and showing the correct browser tab icon.
- **Login form wrapper** — email/password inputs and sign-in button are now inside a proper `<form onsubmit>` element, fixing the browser warning and enabling browser password-manager autofill/save.
- **Forgot password link** added to admin login — typing your email then clicking "Forgot password?" sends a Supabase password-reset email and shows a green success message inline. Error cases surface normally in the red error box.
- **Admin name "Loading…" default** added to 7 pages (Applications, Email Logs, Landlords, Leases, Listings, Messages, Move-Ins) — previously blank on initial render, now consistent with the dashboard's "Loading…" placeholder.
- **Table loading rows** added to Leases, Listings, Move-Ins, and Email Logs `<tbody>` elements, and a loading indicator to the Messages threads container — pages no longer show an empty table body while data is being fetched.
- **Hardcoded colour removed** from admin Listings page — listing title links now use `var(--gold)` instead of a literal `#2563eb` hex value, keeping the design token system intact.

## [2026-03-15] — Fix Admin & Landlord Dashboard Login (ES Module Scoping)

- **Root cause fixed:** `cp-api.js` uses ES module `export` statements. When loaded as a classic `<script>`, browsers throw a SyntaxError and `window.CP` is never defined, silently breaking all admin/landlord pages.
- **Fix — all 9 admin pages:** `cp-api.js` tag changed to `type="module"`. Inline data scripts reverted from `type="module"` back to classic `<script>` and their init IIFEs wrapped in `document.addEventListener('DOMContentLoaded', ...)`, which fires *after* module scripts — guaranteeing `window.CP` is set before any page logic runs.
- **`onclick` handlers preserved:** Because all page functions (`login`, `applyFilter`, `openModal`, `sendReply`, `toggleVerify`, `voidLease`, `changeStatus`, `submitStatus`, `submitLease`, `submitMessage`, `closeModal`, `openLeaseModal`, `markPaid`, `toggleDetail`, `clearFilters`, `submit`, `openMsgModal`) are defined at the top level of classic scripts, they remain on `window` and are reachable by HTML `onclick="..."` attributes and dynamically-generated button HTML.
- **Landlord pages unaffected:** Their inline scripts already used `type="module"` with explicit `import` statements; no change needed.

## [2026-03-15] — Gallery, Lightbox & Card UX Upgrade (Zillow-parity)

- **Gallery mosaic:** Height raised 480px → 560px (1024px+), side panel changed from 1-column × 2-row to a proper 2×2 grid showing all 4 thumbnails (indices 1–4). Added gradient overlays on main image and hover image-zoom on all panels. "See all photos" button now shows a live photo count badge and uses a cleaner pill design with backdrop blur. All class/ID names preserved for JS compatibility.
- **Lightbox redesign:** Completely restructured from a flat single-image overlay to a three-zone layout: (1) header bar with pill counter + close button, (2) main image stage with larger nav arrows and a smooth fade transition (`transitioning` class toggles opacity + scale), (3) scrollable thumbnail filmstrip at bottom — thumbnails highlight the active index, auto-scroll to keep it visible, and are clickable. Added swipe support for mobile lightbox. Thumbnail strip is built lazily on first `openLightbox()` call for performance.
- **Property cards:** Image aspect ratio changed from 63% → 60% padding-top for a wider, more cinematic crop. Hover shadow upgraded with a third layer and a subtle border-color shift for added polish.
- **Meta row (property.html):** Updated to use icon+text two-line structure — each meta item now shows a brand-blue icon badge on the left and label/value stacked on the right, matching the Zillow detail style.
- **Version bump:** `property.css?v=3` → `v=4` in `property.html`; `listings.css?v=3` → `v=4` in `index.html` and `landlord/profile.html` (was v=2 there).

## [2026-03-14] — Strengthened AI Rules in replit.md

- **Deployment chain rules:** Added a mandatory top-level warning explaining that Replit is a code editor only, the live site runs on Cloudflare Pages via GitHub, and changes must be pushed to GitHub to go live. Includes the exact push steps.
- **CSS cache-busting rule:** Added a mandatory rule requiring any AI that changes a CSS file to bump the `?v=` version string in every HTML file across the project. Current versions documented (`v=3`).
- **Cloudflare Pages compatibility:** Added a ✅/❌ list of what is and isn't allowed on a static CDN — no Node.js runtime, no `process.env`, no server-side code.
- **Preview vs. live table:** Added side-by-side table distinguishing the Replit preview (`serve.js` on port 5000) from the live Cloudflare site.
- **Design system rules:** Always use CSS tokens; never hardcode hex or pixel values; do not invent new background colors.
- **JavaScript rules:** Vanilla JS only; no ES modules, no frameworks, no bundler; no `process.env`; no new CDN scripts without approval; all Supabase calls through `cp-api.js`.
- **Image rules:** All property images via ImageKit CDN using `CONFIG.img()`; no raw Supabase storage URLs.
- **Page structure rules:** New pages must copy nav/footer from `index.html`; admin/landlord/apply portals are isolated; kebab-case filenames.

Format:
**[YYYY-MM-DD] — Short title**
- What changed and why

---

## [2026-03-13] — Design Enhancement Phase: Cards, Gallery Mosaic & Animations

- **T001 — Card image & hover overhaul (`css/listings.css`):** Image area raised from 52% → 63% padding-top for a more cinematic, taller card image. Hover effect changed from jarring blue-border flash to a smooth shadow bloom (translateY -4px + deeper shadow, border stays neutral). Photo count badge moved to bottom-left with solid dark background and higher contrast. Save button enlarged from 32px → 36px.
- **T002 — Card body hierarchy (`css/listings.css` + `index.html`):** Price raised from 24px → 28px, weight 700 → 800 so it dominates the card. Meta row (bed/bath/sqft) now uses a single top border and dot separators instead of double borders with wide gaps. Apply button label changed to "Apply Now", slightly more padding. Card images now fade in via `onload="this.classList.add('cp-img-loaded')"` instead of popping in blank.
- **T003 — Staggered card entrance animation (`css/listings.css` + `index.html`):** Replaced the static CSS nth-child animation approach with an `IntersectionObserver`-driven stagger: cards start at opacity 0 / translateY 20px and animate in with a 55ms per-card delay (capped at 320ms) as they enter the viewport. `animateCards()` is called at the end of `renderProperties()`. Skeleton cards are excluded via `!important` overrides. Respects `prefers-reduced-motion`.
- **T004 — Gallery mosaic layout (`property.html` + `css/property.css`):** Replaced the flat single-image + thumbnail strip gallery with an Airbnb-style 3:2 mosaic grid — large main panel on the left, 2×2 sub-panel grid on the right. Clicking any panel opens the existing lightbox at that photo index. "See all photos" button is positioned absolute bottom-right in a clean white pill. If a property has 1 photo, side grid is hidden and main takes full width. If there are 5+ photos, the last panel shows a "+N more" overlay. Mobile collapses to single-image with nav arrows and a swipe counter. All existing lightbox JS (keyboard nav, counter, close, touch swipe) is 100% intact. `id="gallery"` preserved for the `renderUnavailable` path.
- **T005 — Filter active count badge (`index.html` + `css/listings.css`):** Added `updateFilterBadge()` function called by `refreshResults()`. A small blue pill badge appears inside the "More Filters" button showing the number of active non-default filters (type, beds, max/min rent, min baths, search). Hides when all filters are cleared.
- **T006 — Nav scroll polish (`css/main.css`):** `.nav.scrolled` now transitions background to `rgba(255,255,255,0.99)` (from 0.97) with a stronger layered shadow. Nav transition extended to cover both `box-shadow` and `background` for a crisp, intentional feel on scroll.

## [2026-03-13] — Properties Display & Rendering Fixes

- **Bug fix — Sort "Most Beds" now works (`index.html`):** The `beds_desc` sort branch was missing from `applyFilters()`, causing the "Most Beds" dropdown option to silently fall through to "Newest". Added `if (sortBy === 'beds_desc') return (b.bedrooms ?? 0) - (a.bedrooms ?? 0)` to the sort chain.
- **Bug fix — Empty-state filter screen color tokens (`index.html`):** The "No listings match your filters" empty state used unmapped legacy tokens `--slate-light`, `--slate`, and `--blue` which don't exist in the design system. Replaced with `--color-text-muted`, `--color-text-secondary`, and `--color-brand` respectively. The icon and text now render with correct muted colors instead of black.
- **Bug fix — Full property card is now clickable (`index.html`):** Cards had a hover-lift effect and `cursor:pointer` suggesting the whole card is a link, but only the photo and title were `<a>` elements. Added a click listener to each `.property-card` that navigates to the property detail page whenever the click target is not already a button or link (save button, nav arrows, apply button retain their own behavior).
- **UX — Active Listings stat hidden on load failure (`index.html`):** When Supabase is unreachable the stat counter stayed as `—` forever, looking broken. On error, the entire stat item is now hidden so the hero stats row shows only the two static items (Avg. Apply Time and Coverage).
- **UX — Contact card Save/Share buttons repositioned (`property.html`):** The Save and Share buttons were displayed below the "Questions? Message the Landlord" heading, creating a confusing layout where the heading didn't match the first visible content. The `share-row` is now rendered above the heading so save/share quick actions appear first, followed by the message form with its own label.
- **UX — Description loading state uses skeleton shimmer (`property.html`):** The description area on the property detail page initialized with a bare "Loading property details…" text string while all other loading areas on the page use animated skeleton shimmer placeholders. Replaced with four skeleton lines matching the body text height and staggered widths, consistent with the rest of the page.

---

## [2026-03-13] — Security Hardening: claim_application() email verification

- **`APPLICANT-AUTH.sql` — `claim_application()` RPC hardened:** The email verification in the function now uses `auth.email()` (the server-side JWT-verified email for the authenticated caller) instead of the client-supplied `p_email` parameter. This closes a theoretical attack vector where a malicious authenticated user who knew another applicant's `app_id` and email address could call the RPC directly via the REST API and claim that application. In normal dashboard usage, `currentUser.email` (the OTP-verified email) was always passed, so no user-facing behavior changes. The `p_email` parameter is retained in the function signature for backward compatibility but is no longer used for verification. Full audit of the applicant identity system confirmed all other components — OTP login flow, dashboard auth routing, `get_my_applications()` field exposure, `get_lease_financials()` financial gating, `co_applicant_email` display logic, `lastSuccessAppId` sessionStorage lifecycle, and all SQL migration idempotency — are working correctly.

---

## [2026-03-13] — Applicant Identity Layer (Passwordless OTP Authentication)

- **New `APPLICANT-AUTH.sql` migration:** Adds `applicant_user_id uuid` column to `applications` table with a foreign key to `auth.users`, an index, and a new RLS policy (`applications_applicant_read`) so authenticated applicants can read only their own rows. Also adds two secure RPCs: `get_my_applications()` returns the calling user's full application list (safe field subset), and `claim_application(app_id, email)` lets a newly-signed-in user link a legacy application submitted before they had an account (email-verified to prevent hijacking). Grant statements included.
- **New `apply/login.html` page:** Applicant-facing passwordless OTP email sign-in. Two-step flow — enter email → receive 8-digit code → auto-submits on 8th digit. Supports `?redirect=` URL param so users land back on whatever page triggered the sign-in. Checks existing session on load and skips the form if already signed in. Includes "Track by Application ID instead" and "Resend my Application ID" fallback paths.
- **Updated `apply/dashboard.html` — auth-aware design:** On page load, checks the Supabase session. (1) If authenticated with no `?id=` param — renders a "My Applications" list showing all linked apps as clickable cards, with status/lease pills. Clicking a card opens the detail view (same `renderDetailView` function). A "Look Up a Specific Application" section is appended below the list as a fallback. (2) If not authenticated — shows the classic App ID lookup card plus a sign-in prompt banner. (3) If `?id=` param present — always shows that app directly (works for both auth and anon). Topbar now shows signed-in email + Sign Out button when authenticated. All anonymous detail views now show a "Sign in to see all your applications" prompt so users discover the feature naturally. `signOut` routes back to `/apply/login.html` for the applicant scope.
- **Updated `js/cp-api.js` — `CP.ApplicantAuth` added:** New helper object exported on `window.CP` with `sendOTP(email)`, `verifyOTP(email, token)`, `getUser()`, `getSession()`, `signOut()`, `getMyApplications()` (calls `get_my_applications()` RPC), and `claimApplication(appId, email)` (calls `claim_application()` RPC). `Auth.signOut()` updated to route to `/apply/login.html` when on an `/apply/` path (was incorrectly routing to `/landlord/login.html`).
- **Updated `supabase/functions/process-application/index.ts`:** Added optional applicant auth block after rate-limit check. Extracts the Bearer JWT from the Authorization header; if it differs from the anon key, verifies it against Supabase Auth and extracts the user UUID. Adds `applicant_user_id` to the application insert record (null for anonymous submissions). Entirely non-breaking — no change to existing anonymous flow.
- **Setup instructions:** Run `APPLICANT-AUTH.sql` once in Supabase SQL Editor. Enable Email OTP in Supabase Auth settings (Dashboard → Auth → Providers → Email → Enable OTP). No other configuration needed.

---

## [2026-03-13] — Verification & Polish Pass: Nav consistency, logo standardization, apply.html address fix

- **Nav drawer CTA fix (property.html):** `drawerAuthLink` was missing the `btn-full` class, making the "Landlord Login" button in the mobile drawer narrower than on all other pages. Added `btn-full` to match every other page.
- **Nav logo standardization — dark inline override removed (property.html, about.html, faq.html, how-to-apply.html, how-it-works.html, 404.html):** All six pages overrode the `nav-logo-mark` CSS class with an inline `background:#0f1117` or `background:var(--ink)` style, rendering a near-black logo while `index.html` showed the correct brand-blue `nav-logo-emblem`. Changed all instances to `nav-logo-emblem` (no inline styles), which carries the correct blue background, `flex-shrink:0`, and a subtle brand-shadow via CSS — consistent with the homepage.
- **Nav logo standardization — letter fallback replaced (terms.html, privacy.html):** Both pages used `<div class="nav-logo-mark">C</div>` (a plain blue square with the letter "C") rather than the SVG house icon used everywhere else. Replaced with the correct `nav-logo-emblem` + SVG markup.
- **SVG brand circle color unified:** The house SVG's inner circle was `rgba(37,99,235,0.9)` on several pages (the old Tailwind blue-600) vs the design-system brand blue `rgba(0,106,255,0.8)`. Standardized to `rgba(0,106,255,0.8)` across all affected pages.
- **apply.html footer address placeholder removed:** The hardcoded `<p>Your Business Address</p>` is now a hidden `<p id="footerAddressLine">` that reads `CONFIG.COMPANY_ADDRESS` on `DOMContentLoaded` and reveals itself only when that value is non-empty — consistent with how `footerContactLine` and `footerEmailLink` are already handled.
- **HTTP verification:** All 12 public pages confirmed returning HTTP 200 post-changes.

---

## [2026-03-13] — Bug fixes #1–6: Tenant dashboard, lease signing, and admin modal

- **Fix 1 — Lease deadline countdown (dashboard.html):** Replaced hardcoded "48 hours" with a `leaseDeadlineText()` helper that reads `lease_expiry_date` and renders the real remaining time (e.g. "within 3 days — by Fri, Mar 20"). Falls back to generic text if the field is absent.
- **Fix 2 — Lease text readability (lease.html):** Expanded `.lease-text` max-height from 400px to 600px so tenants can read significantly more of the lease agreement without scrolling inside a tiny box. Added a dynamic expiry-countdown banner at the top of the signing page (red for <24 h, amber otherwise).
- **Fix 3 — Download signed lease (dashboard.html):** Added "📄 Download Signed Lease" button to the `lease_status === 'signed'` and `co_signed` callouts. Uses `app.lease_pdf_url`, which the `get-application-status` edge function already generates as a fresh Supabase Storage signed URL on every dashboard load — so the link is never stale.
- **Fix 4 — Denial reason shown to tenants (dashboard.html):** The denial callout now conditionally renders `app.admin_notes` (written by the admin at denial time) as a "Reason provided:" sub-section. Sanitised via `escapeHTML()`.
- **Fix 5 — "Fee Paid" step accuracy (dashboard.html):** Step 2 of the progress bar was advancing to complete when `status === 'under_review'` regardless of `payment_status`. Removed the erroneous `|| app.status === 'under_review'` branch — step 2 now only shows complete when `payment_status === 'paid'`.
- **Fix 6 — Lease modal start-date pre-fill (admin/applications.html):** `openLeaseModal()` now accepts a `prefillMoveIn` parameter (the applicant's `requested_move_in_date`). The "Send Lease", "Resend Lease", and "Send New Lease" buttons pass this value; the modal sets `m-start` from it rather than defaulting to today.
- **Bonus fix — Dashboard lookup card HTML corruption (dashboard.html):** The lookup card block had literal `\n` and `\"` escape sequences in raw HTML (pre-existing). Unescaped all sequences so the card renders cleanly in all browsers.

## [2026-03-13] — Improvement #2: Persistent property context banner across all steps

- Added `div#propertyContextBanner` in `apply.html` between the step progress bar and the submission-progress div — outside all form sections so it persists across every step
- Reuses existing `.property-confirm-banner` CSS class (no new CSS written)
- Shows "Applying for" label, property title, address, rent/mo, and bed/bath count
- Added `_showContextBanner(prop)` and `_hideContextBanner()` methods in `apply.js`
- `onPropertySelected()` calls `_showContextBanner` on every selection (shows on pick, hides on clear/escape)
- `_activatePropertyLock()` calls `_showContextBanner` so banner appears immediately on page load when arriving from a listing
- Mobile layout handled by existing `.property-confirm-banner` media query (480px breakpoint wraps badge to full-width row)

---

## [2026-03-13] — Hardened Replit AI control — 4-layer static site enforcement

- Added `.agents/instructions.md` — dedicated agent instruction file that Replit reads on import, classifying the project as a static site and listing absolute prohibitions
- Rewrote `replit.md` — moved machine-readable `PROJECT_TYPE / DEPLOYMENT_TARGET / BACKEND` metadata to the very first lines so any AI parser reads project classification before anything else; fixed incorrect "python3" local preview reference (actual command is `node serve.js`); added explicit "NOT Replit" labels to all Cloudflare and Supabase env var sections
- Updated `package.json` description — now explicitly states static site, Cloudflare deployment, no Replit database, no ORM as the very first thing any AI sees in the manifest
- Note: `javascript_database` blueprint entry in `.replit` could not be removed (file is system-protected); mitigated by the three layers above which clearly override any database integration signals

---

## [2025-06-23] — Fix: public listings not appearing on homepage

- **Root cause**: `index.html`, `property.html`, `apply/dashboard.html`, and `apply/lease.html` all loaded `cp-api.js` as a classic `<script>`. Since `cp-api.js` contains ES6 `export` declarations, browsers throw a `SyntaxError` when parsing it as a non-module script — the entire file fails to execute, `window.CP` is never defined, and no property data loads.
- **Fix**: Changed all four pages to load `cp-api.js` as `<script type="module">` and converted their inline `<script>` blocks to `<script type="module">` as well (modules are deferred and execute in document order, so `window.CP` is guaranteed to be set before the inline module runs).
- **Additional**: Added `window.lookup`, `window.recoverById`, `window.sendRecovery` exports to `apply/dashboard.html`'s module, and `window.doSign`, `window.doCoSign` to `apply/lease.html`'s module, so `onclick` attributes in HTML templates continue to resolve these functions globally.
- **Landlord/admin pages were unaffected** — they already used `import { ... } from '../js/cp-api.js'` (ES module syntax), which is correct.

---

## [2025-03-12] — Documentation enforcement system added

- Created `CHANGELOG.md` to track all project changes going forward
- Updated `replit.md` with mandatory documentation update rule — AI must update docs as part of every task
- Defined clear ownership rules for each documentation file

## [2025-03-12] — Replit AI hard rules added to replit.md

- Added ABSOLUTE PROHIBITIONS section at the top of `replit.md`
- Blocks AI from installing databases, ORMs, server frameworks, or backend files
- Blocks any migration or provisioning attempts on import to a new Replit account
- Clarifies Replit is used as a code editor only — deployment target remains Cloudflare Pages

## [2025-03-12] — Replit-specific files removed (cleanup)

- Removed `server.js` (Express static server — not needed for Cloudflare Pages)
- Removed `server/db.ts` (Drizzle/Postgres file — wrong for this project)
- Removed `node_modules/` and `package-lock.json`
- Reverted `package.json` to original state — no dependencies, build script only
- Restored workflow to `python3 -m http.server 5000`

## [2025-03-12] — Initial Replit import from GitHub

- Project imported from GitHub into Replit for editing
- No code changes made to the core application
- Node.js 20 installed for running `generate-config.js` build script
