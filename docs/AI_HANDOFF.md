# AI Handoff — Choice Properties Marketplace Redesign

Read this file, then `docs/MARKETPLACE_REDESIGN_PLAN.md`, `docs/REDESIGN_PROGRESS.md`, `AGENTS.md`, `AI_AGENT_GUIDE.md`, and applicable `.agents/` instructions before working.

## User goal
Redesign the existing Choice Properties public rental marketplace as a unified, high-quality experience benchmarked against Zillow across homepage, search results, property cards, property details, galleries, valid video/3D tours, and supported communities/floor plans/units. Do not copy Zillow branding/assets/exact UI. Work phase by phase; document every phase and push it to GitHub.

## Preserve
Do not casually rewrite or break application/submission/payment flows, admin, tenant/landlord dashboards, auth, Supabase integrations, property importer/browser extension, scraper/publishing pipeline, or policy pages. Do not change database schema/data or ingestion behavior without explicit approval.

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
- Supabase public schema read-only inspection confirmed `properties`, `property_photos`, `property_media`, `property_units`, `property_buildings`, `property_floors`, `property_shares`, and `property_share_properties`. Current schema metadata reported 2,477 property rows, 67,102 photos, 13 property_media rows, and 0 rows in the unit/building/floor tables at inspection time.
- Listing queries restrict normal public browsing to `status = active`; private-placement detail access is token-aware. The frontend supports property photo ordering, video/3D media, buildings/floors, unit/floor-plan data, and share-token links.
- `package.json` build script is `AIS_BUILD=true node generate-config.js && AIS_BUILD=true node scripts/copy-static-to-dist.js`; copy script populates `dist/` with static files. Vite/React are declared but are not invoked by this script. Do not install dependencies or run local build/server under the current repository instruction.
- `_headers`, `_redirects`, and `.cfpagesignore` show Cloudflare Pages static routing/security setup. Actual Cloudflare dashboard values (build command, output directory, production branch, auto-deploy) are still unverified.
- The root pages reference `.agents/instructions.md`, but the path is absent on `main` (404 and no `.agents/` directory in the root listing). Follow available `AGENTS.md` and `AI_AGENT_GUIDE.md`; do not invent missing rules.
- No local runtime, browser test, build, migration, or database write was run. No production behavior has been changed.

## Separate security finding (do not silently remediate)
The Supabase project advisor reports `public.description_enrichment_audit` has RLS disabled (critical). No changes were made. Owner should review required access and policies before enabling RLS; enabling without a policy may break legitimate workflows. This is separate from the visual redesign.
## Current state
- Plan, progress tracker, and handoff documents were merged to `main` through PR #56. The full redesign stack #56–#63 was merged by commit `70e1eba5e009b153fbc3b6c99763031e838fcd50`.
- Phase 0 repository architecture and read-only Supabase schema discovery are documented in `docs/REDESIGN_PROGRESS.md`.
- Phase 0 repository-side discovery is complete; Cloudflare Pages dashboard settings still require confirmation.
- Phase 1 has started on branch `phase-1/design-system`. An additive set of shared public-site tokens was added to `css/cp-marketing.css` in commit `1b8373d848b54fd61957e36a0c3b794e25c290c4` (font scale, line-height, control heights, focus-ring, content widths, motion durations). The shared `.btn` component now consumes the 15px type, 44px minimum height, and standard motion tokens in commit `39305eee825dec35fd31e8c9cbc9f12d46fe8820`. A scoped accessibility baseline was added in commit `bb693c6e64cfcf04e70b819abd5a4dee73ff126d`: 44px common form controls, 16px common form text, visible keyboard focus for common controls, and reduced-motion behavior. No markup, JavaScript, routes, listing data, application flow, database, or portal logic changed.
- No local build/server or browser test was performed because repository instructions prohibit local runtime steps. Cloudflare production deployment is still unverified.

## Next actions
1. Core redesign PRs #56–#63 are merged to `main` at `70e1eba5e009b153fbc3b6c99763031e838fcd50`. The redesign added shared public tokens, homepage/search copy improvements, card/gallery accessibility changes, a read-only multi-unit data audit, and image-priority optimization. Follow-up branch `fix/marketplace-release-readiness` removes unsupported “verified” and application-duration marketing claims, replaces unsupported named testimonials with feature descriptions, aligns core public copy with the marketplace model, updates navigation labels, and fixes malformed metadata at the start of `how-it-works.html`. It is not yet merged. Source-level assertions only; no browser/build/network tests were run. Preserve search IDs (`searchInput`, `bedroomsFilter`, `maxRentFilter`, `searchBtn`), query behavior, active/private placement rules, property IDs/canonical URLs, original photo order/hero image, application links, and all account workflows. Respect `AGENTS.md` display restrictions. Browser validation and Cloudflare production deployment verification remain pending.
2. Do not run prohibited local build/server/install commands. Record exact validation limitations and review every diff.
3. Review the follow-up branch diff/PR, complete browser regression testing in an approved environment, and verify Cloudflare Pages build/output/production branch/auto-deploy settings before claiming the production site is updated.
4. Keep the security finding on `public.description_enrichment_audit` separate from the redesign; owner decides policy/remediation.
5. Preserve search parameters, active/private placement rules, property IDs/canonical URLs, application links, image order, and all account/application/admin workflows.
6. After each phase, update plan/progress/handoff, commit/push, and verify deployment only where evidence is available.
7. If blocked, record the evidence and exact next action; do not silently skip controls or begin unrelated work.