# AI Handoff — Choice Properties Marketplace Redesign

Read this file, then `docs/MARKETPLACE_REDESIGN_PLAN.md`, `docs/REDESIGN_PROGRESS.md`, `AGENTS.md`, `AI_AGENT_GUIDE.md`, and applicable `.agents/` instructions before working.

## User goal
Redesign the existing Choice Properties public rental marketplace as a unified, high-quality experience benchmarked against Zillow across homepage, search results, property cards, property details, galleries, valid video/3D tours, and supported communities/floor plans/units. Do not copy Zillow branding/assets/exact UI. Work phase by phase; document every phase and push it to GitHub.

## Preserve
Do not casually rewrite or break application/submission/payment flows, admin, tenant/landlord dashboards, auth, Supabase integrations, property importer/browser extension, scraper/publishing pipeline, or policy pages. Do not change database schema/data or ingestion behavior without explicit approval.

## Current active work
- PRs #65 (listing request race), #66 (property media), and #67 (homepage search submission) are merged to `main` as confirmed through GitHub's pull-request API.
- The owner reports that Cloudflare deployment succeeded, but the live site is still reported to display the old design. The current release patch adds a final public-marketplace stylesheet, versions its stylesheet URLs, marks the expected HTML revision, and disables caching for the root HTML route.
- Next release gate: confirm the live homepage exposes `data-ui-release="2026-10-31-final"` and that the new CSS loads, then test homepage search, rapid filters, pagination/back-forward, property photos/tours, keyboard controls, and mobile layouts in a real browser.
- The property detail page supports photo gallery, tour modal, floor-media grouping, and unit/building/floor rendering. A read-only database snapshot showed 0 unit, building, and floor rows and only 13 property-media rows, so multi-floor functionality cannot be considered verified against populated live records.
- Do not claim the complete Zillow-inspired experience is verified until browser/device tests, real media checks, performance measurement, and Cloudflare deployment configuration are confirmed.
- Do not create or populate unit/building/floor data or change schema without explicit approval.

## Critical repository rules
- Follow root instructions and `.agents/` rules.
- Existing HTML comments specify edit → GitHub push → Cloudflare Pages and prohibit `npm install`, starting a server, creating `config.js`, local DB connections/migrations, and runtime/workflow/environment configuration.
- Never reveal or commit secrets.
- Preserve authentic addresses and original photo order; first source image remains the primary image.
- Never invent listing facts/media.
- Verify actual build/deploy behavior before introducing React/TypeScript or changing tooling.
- Never claim a test, push, or deployment succeeded without evidence.

## Verified architecture and data flow
- Public entry pages: `index.html`, `listings.html`, and `property.html`.
- Shared frontend: `js/cp-api.js` (Supabase client/query helpers), `js/card-builder.js` (property cards), `js/listings.js` (results/search/map), `js/property.js` (details/gallery/tours), `js/property-units.mjs` (floor plans/units), and `js/tour-media.mjs` (supported media URL checks).
- Homepage CSS stack: `css/cp-design.css`, `css/cp-marketing.css`, `css/premium-design.css`, `css/home-experience.css`. Listings use the shared design/marketing styles; property detail has its own inline styles plus shared CSS.
- Supabase public schema read-only inspection confirmed `properties`, `property_photos`, `property_media`, `property_units`, `property_buildings`, `property_floors`, `property_shares`, and `property_share_properties`. Current direct read-only SQL count: 2,477 properties, 52,232 photos, 13 property_media rows, and 0 rows in the unit/building/floor tables. Earlier table metadata reported 67,102 photos; reconcile this discrepancy before setting a performance baseline.
- Listing queries restrict normal public browsing to `status = active`; private-placement detail access is token-aware. The frontend supports property photo ordering, video/3D media, buildings/floors, unit/floor-plan data, and share-token links.
- `package.json` build script is `AIS_BUILD=true node generate-config.js && AIS_BUILD=true node scripts/copy-static-to-dist.js`; copy script populates `dist/` with static files. Vite/React are declared but are not invoked by this script. Do not install dependencies or run local build/server under the current repository instruction.
- `_headers`, `_redirects`, and `.cfpagesignore` show Cloudflare Pages static routing/security setup. Actual Cloudflare dashboard values (build command, output directory, production branch, auto-deploy) are still unverified.
- The root pages reference `.agents/instructions.md`, but the path is absent on `main` (404 and no `.agents/` directory in the root listing). Follow available `AGENTS.md` and `AI_AGENT_GUIDE.md`; do not invent missing rules.
- No local runtime, build, or browser test was run. No migration or database write was performed. The final release patch is currently on `fix/final-marketplace-release` and is not yet merged.

## Separate security finding (do not silently remediate)
The Supabase project advisor reports `public.description_enrichment_audit` has RLS disabled (critical). No changes were made. Owner should review required access and policies before enabling RLS; enabling without a policy may break legitimate workflows. This is separate from the visual redesign.
## Current state
- The core redesign #56–#63 and marketplace copy #64 are merged. PRs #65, #66, and #67 are also confirmed merged to `main` through GitHub API.
- Repository architecture and read-only Supabase schema discovery are documented in `docs/REDESIGN_PROGRESS.md`.
- The owner reports successful Cloudflare deployment, but the current complaint is that the live UI still looks old. Cloudflare Pages project/build/output settings and the actual live response are not accessible in this workflow and remain to be confirmed.
- Phase 1 has started on branch `phase-1/design-system`. An additive set of shared public-site tokens was added to `css/cp-marketing.css` in commit `1b8373d848b54fd61957e36a0c3b794e25c290c4` (font scale, line-height, control heights, focus-ring, content widths, motion durations). The shared `.btn` component now consumes the 15px type, 44px minimum height, and standard motion tokens in commit `39305eee825dec35fd31e8c9cbc9f12d46fe8820`. A scoped accessibility baseline was added in commit `bb693c6e64cfcf04e70b819abd5a4dee73ff126d`: 44px common form controls, 16px common form text, visible keyboard focus for common controls, and reduced-motion behavior. No markup, JavaScript, routes, listing data, application flow, database, or portal logic changed.
- No local build/server or browser test was performed because repository instructions prohibit local runtime steps. The owner reported confirming the Cloudflare deployment in chat; this workflow did not independently inspect the Cloudflare deployment record or validate the live site.

## Next actions
1. Review and merge `fix/final-marketplace-release` after inspecting its diff; it adds the final public CSS polish, cache-busted CSS URLs, release marker, root no-store header, and reconciles the stale progress notes.
2. After deployment, inspect the live document source for `data-ui-release="2026-10-31-final"` and confirm `/css/marketplace-final-polish.css?v=20261031` returns successfully. If the marker is absent, the issue is the Cloudflare project/branch/output/deployment target rather than the new CSS rules.
3. Complete real-browser tests for homepage search, rapid filter changes, pagination/back-forward, property photos/tours, keyboard controls, and mobile layouts. Do not mark those tests as passed before running them.
4. Verify Cloudflare Pages build command, output directory, production branch, and deployed commit in the dashboard; expected repository-side output is `dist/` from `npm run build`, but dashboard values are not confirmed here.
5. Keep the security finding on `public.description_enrichment_audit` separate from the redesign; owner decides policy/remediation. Preserve search parameters, active/private placement rules, property IDs/canonical URLs, application links, original image order, and all account/application/admin workflows.

## Current regression-hardening branch — 2026-10-31
- Branch `fix/listings-request-race` contains changes to `js/listings.js` that prevent overlapping listing requests from dropping newer filter/search changes or allowing stale responses to replace current results. It also normalizes invalid URL page numbers to page 1.
- PR #64 and PR #65 are merged to main.

## Listing timeout cleanup — 2026-10-31
- Clears the request timeout handle in `fetchAndRender()`'s `finally` block so completed or superseded requests do not leave redundant timers running.

## Property media reliability & cache bust — 2026-10-31
- PR #66 (`phase-8/property-media-reliability`) merged to main: imports `tour-media.mjs` with `?v=2026103101` from `property-tour-utils.mjs`, validates tours, and supports Vimeo URLs.

## Homepage hero search form submission — 2026-10-31
- Branch `fix/home-search-form-submit` addresses the homepage hero search form in `index.html`: removes the inline `onsubmit` handler and consolidates navigation into one native submit listener calling `goToListings()`.
- Pointer and keyboard submissions now share one unified code path.

