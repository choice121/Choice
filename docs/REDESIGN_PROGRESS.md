# Marketplace Redesign — Progress Tracker

**Last updated:** 2026-10-30  
**Repository:** `choice121/Choice`  
**Overall status:** IN PROGRESS — Phase 1 shared design/accessibility foundation implemented; Phase 2 homepage/search-entry improvements started.

## Current phase
Phase 2 — homepage and search entry (in progress; messaging and mobile search input readability updated; visual validation pending).

## Verified architecture and data flow
- Root rules in `AGENTS.md` and `AI_AGENT_GUIDE.md` were reviewed. The HTML pages repeat a deploy-only instruction: edit → GitHub push → Cloudflare Pages; do not install dependencies, start a server, create `config.js`, connect to a local database, run migrations, or change runtimes/workflows/environments.
- The referenced `.agents/instructions.md` does **not** exist on `main` (GitHub contents API returned 404; root listing has no `.agents/` directory). The same path is excluded by `.cfpagesignore` and blocked in `_redirects`. Treat root `AGENTS.md` as the available project-level rule source unless the owner supplies the missing file.
- `package.json` declares `npm run build` as `AIS_BUILD=true node generate-config.js && AIS_BUILD=true node scripts/copy-static-to-dist.js`. The copy script creates/populates `dist/` with static HTML and asset folders. `vite.config.ts` and React/Vite dependencies exist, but the declared build script does not invoke Vite. Do not run the build locally under the current no-runtime instruction.
- The repository describes Cloudflare Pages as the host and points to GitHub push → Pages deployment. `_headers`, `_redirects`, and `.cfpagesignore` confirm static Pages routing/security configuration. Actual Pages dashboard build command, output directory, connected branch, and auto-deploy settings cannot be independently verified with the available access. Expected repository-side build output is `dist/`; confirm dashboard values before release.
- Public entry pages are `index.html`, `listings.html`, and `property.html`. Homepage and results share `cp-design.css`, `cp-marketing.css`, and `card-builder.js`; homepage additionally loads `premium-design.css` and `home-experience.css`. Property detail logic is in `js/property.js`; results logic is in `js/listings.js`; common API/query logic is in `js/cp-api.js`; unit rendering is in `js/property-units.mjs`; tour URL validation is in `js/tour-media.mjs`.
- Listing queries use Supabase `public.properties` with `status = active`; public results are paginated and filtered through `CP.Properties.getListings`. Property cards use ordered `property_photos` and supported media metadata. Detail pages read `properties`, `property_photos`, `property_media`, `property_units`, `property_buildings`, and `property_floors`; share-token handling supports private placement listings.
- Read-only Supabase schema discovery completed for project `Choice` (`tlfmwetmhthpyrytrcfo`). Schema confirms `properties`, `property_photos`, `property_media`, `property_units`, `property_buildings`, `property_floors`, `property_shares`, and `property_share_properties`. Current table counts reported by metadata: 2,477 properties; 67,102 photos; 13 media rows; 0 rows in units/buildings/floors. These counts are only a discovery snapshot, not product guarantees.
- Critical journeys located in code: homepage search → `listings.html` query params → paginated results → `property.html?id=...` → configured application URL; property detail also exposes inquiry/contact, saved-property, photo gallery, tour, map, and related listings logic. Existing admin/tenant/landlord/auth/apply routes and importer/publishing files are separate and must remain untouched by visual-only changes.
- Validation constraints: repository reads and read-only Supabase schema metadata were used. No build, local server, install, migrations, database writes, or live visual/browser tests were run.

## Findings requiring separate attention
- Supabase's project advisor reports **critical: Row Level Security disabled** on `public.description_enrichment_audit`. The table currently reports zero rows, but disabled RLS can expose any future/current rows to roles with Data API access. No remediation was applied because enabling RLS without a reviewed policy can break intended access. This is outside the visual redesign; owner should review access requirements and decide on a policy. Suggested starting SQL from the advisor: `ALTER TABLE public.description_enrichment_audit ENABLE ROW LEVEL SECURITY;` — do not run until access requirements/policies are reviewed.
- Phase 0 cannot fully verify Cloudflare Pages dashboard settings because the hosting control plane is not available through current access. This is a release verification item, not a reason to change deployment architecture.

## Phase checklist
- [x] Phase 0 — repository architecture and read-only schema discovery
- [ ] Phase 0 — verify Cloudflare Pages dashboard build/output/branch/auto-deploy settings
- [ ] Phase 1 — design system and shared public UI (in progress)
- [ ] Phase 2 — homepage and search entry (in progress)
- [ ] Phase 3 — search results and property cards
- [ ] Phase 4 — property detail and rich media
- [ ] Phase 5 — communities/buildings/floor plans/units
- [ ] Phase 6 — integration, accessibility, performance
- [ ] Phase 7 — regression and release handoff

## Phase 1 work log — 2026-10-30
- Added an additive shared public design-token set to `css/cp-marketing.css`: font-size aliases, line-height values, control heights, focus-ring token, content-width aliases, and motion-duration aliases. Applied the shared 15px type token, 44px minimum control-height token, and standard motion token to the common public `.btn` component.
- Added scoped public form-control sizing (44px minimum height and 16px input text for common form fields) and visible keyboard-focus outlines for common public forms/buttons. Added reduced-motion handling for shared public buttons, cards, and city pills.
- Existing token values and component rules were left intact; this change creates a common vocabulary for incremental adoption in later public-page phases. No markup, JavaScript, routes, data, application flows, or portal logic was changed.
- Validation: inspected the existing token block and reduced-motion rules before editing; verified the expected insertion point and successful GitHub file update. No browser, build, local server, or visual regression test was run because repository instructions prohibit those local runtime steps.
- Commits: `1b8373d848b54fd61957e36a0c3b794e25c290c4` (tokens) and `39305eee825dec35fd31e8c9cbc9f12d46fe8820` (shared button adoption) on `phase-1/design-system`.
- Deployment status: Unavailable / not verified. Cloudflare dashboard settings are still unknown; do not claim this is live.

## Phase 2 work log — 2026-10-30
- Updated homepage hero copy to describe browsing rental listings rather than implying every listing is managed by Choice Properties.
- Replaced trust-strip claims about verified landlords, management, encryption, and real-time updates with functional descriptions of search, browsing, comparing, online applications, and next steps. This avoids presenting unverified operational guarantees as facts.
- Increased homepage hero search input/select text to 16px on mobile to improve legibility and avoid iOS automatic input zoom.
- Changed files: `index.html`, `css/home-experience.css`.
- Validation: confirmed exact source blocks and successful GitHub file updates. No browser, build, local server, or visual regression test was run because repository instructions prohibit local runtime steps.
- Deployment status: Unverified; Cloudflare settings have not been inspected.

## Next exact action
Continue Phase 2 review of homepage responsive layout and search semantics, then move into Phase 3 listing cards/results. Phase 1 implementation is in PR #57; this work is on child branch `phase-2/homepage-search-entry` and will be proposed separately. Keep visual validation explicitly pending. Cloudflare build/output/branch/auto-deploy settings remain a separate release-verification item.
## Required record for each phase
- Status: Not started / In progress / Blocked / Complete
- Goal and work completed
- Files changed and reasons
- Validation run and exact outcomes
- Commit SHA/GitHub URL
- Deployment status: Verified / Pending / Unavailable
- Known issues/risks
- Next exact action

## Immediate next action
Continue Phase 1 on `phase-1/design-system`; verify token adoption and public shared styles without running prohibited local build/server steps. Keep Cloudflare dashboard settings marked unverified and do not claim deployment.
