# Marketplace Redesign — Progress Tracker

**Last updated:** 2026-10-31  
**Repository:** `choice121/Choice`  
**Overall status:** Core redesign and marketplace-copy accuracy work is merged. Phase 8 property-media reliability is in progress on branch `phase-8/property-media-reliability`. Browser regression testing, full visual verification, and independent Cloudflare production deployment verification remain pending.

## Current phase
Phase 8 — property-media reliability and accessible floor/media controls. This phase validates tours before presenting them, improves Vimeo URL support, makes media-card actions keyboard-operable, and corrects floor filter semantics. Browser regression testing remains a required release gate.

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
- [x] Phase 1 — shared design/accessibility foundation implemented (PR #57; visual validation pending)
- [x] Phase 2 — homepage/search-entry copy and mobile text improvements implemented (PR #58; visual validation pending)
- [x] Phase 3 — property-card and listing-control accessibility improvements implemented (PR #59; browser validation pending)
- [x] Phase 4 — property gallery accessibility and detail-content corrections implemented (PR #60; browser validation pending)
- [x] Phase 5 — community/unit/floor-plan schema audit documented (PR #61; no synthetic data added)
- [x] Phase 6 — property-card image-loading priority optimization implemented (PR #62; network validation pending)
- [x] Phase 7 — release handoff documented; production deployment and browser validation remain open release gates

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

## Phase 3 work log — 2026-10-30
- Property-card save buttons now include a property-specific accessible label and `aria-pressed` state. Homepage and listings-page handlers update that state and label as a property is saved/unsaved.
- Carousel dot controls now use a labelled group rather than `tablist` (they are buttons, not ARIA tabs), and labels identify the photo and property. Decorative icon glyphs are hidden from assistive technology.
- Added explicit `for` associations to advanced filter labels. The Grid/Map switch is now a labelled group with `aria-pressed` state synchronized by the view-toggle handlers.
- Fixed carousel-dot usability: indicators have 24×24px hit areas, their parent accepts pointer events, keyboard focus is visible, and hidden desktop arrows reveal when keyboard focus enters the image area.
- Changed files: `js/card-builder.js`, `js/listings.js`, `index.html`, `listings.html`, `css/cp-marketing.css`.
- Validation: source-level checks confirmed expected snippets and successful GitHub file updates. No browser/build/local-server test was run because repository instructions prohibit local runtime steps.
- Deployment status: Unverified; Cloudflare settings have not been inspected.

## Phase 4 work log — 2026-10-30
- Made the primary photo mosaic keyboard-operable with button semantics, focusability, an accessible name, and Enter/Space activation.
- Made secondary mosaic cells keyboard-operable with button semantics, focusability, property-photo labels, and Enter/Space activation.
- Changed main-gallery activation to open the currently displayed photo rather than always resetting to photo 1. Photo array order and first-source-photo hero behavior are unchanged.
- Added visible focus treatment for gallery controls and accessible labels/controls for previous/next photo buttons.
- Renamed the visible “Lease” tab to “Fees & details” because its contents are application fee, certain listing-specific fees/specials, and showing instructions—not lease terms.
- Added a public-detail filter to suppress pet-policy and smoking-policy terms from amenity, appliance, flooring, and utility labels; empty filtered groups no longer create placeholder amenity content.
- Changed files: `property.html`, `js/property.js`, `css/cp-marketing.css`.
- Validation: source-level checks and successful GitHub updates only. No browser/build/local-server test was run because repository instructions prohibit local runtime steps.
- Deployment status: Unverified; Cloudflare settings have not been inspected.

## Phase 5 work log — 2026-10-30
- Read-only schema discovery snapshot: `property_units` 0 rows, `property_buildings` 0 rows, `property_floors` 0 rows, `property_media` 13 rows. Counts are a discovery snapshot, not a permanent guarantee.
- Reviewed `renderPropertyUnits` and `renderMultiFloorMedia`: the unit/floor-plan section is hidden when no unit markup exists, and the media section is hidden when no valid media items exist. No fake unit counts, rent ranges, floor plans, or building data were added.
- Current unit/floor-plan behavior remains driven by `property_units`, `property_buildings`, `property_floors`, and valid `property_media` records. Original media ordering rules remain in place.
- Changed files: documentation only (`docs/REDESIGN_PROGRESS.md`, `docs/AI_HANDOFF.md`, `docs/MARKETPLACE_REDESIGN_PLAN.md`).
- Validation: repository source inspection and prior read-only schema snapshot only; no browser/build/local-server test was run because repository instructions prohibit local runtime steps.
- Deployment status: Unverified.

## Phase 6 work log — 2026-10-30
- Changed the shared card builder so all card images default to lazy loading; only callers explicitly setting `priorityFirstImage: true` make the first card image eager/high priority.
- Updated listing rendering to pass the card index and prioritize only the first result card image. Homepage featured cards remain lazy by default because they appear below the hero and city content.
- This reduces the previous behavior where every property card's first photo was marked eager/high priority, which could cause many listing images to compete for bandwidth.
- Changed files: `js/card-builder.js`, `js/listings.js`.
- Validation: source-level checks only; no browser, network waterfall, build, or local-server test was run because repository instructions prohibit local runtime steps.
- Deployment status: Unverified.

## Phase 7 work log — 2026-10-30
- Source-level assertions passed for key requirements: homepage copy no longer claims all homes are managed by Choice; property card save state exposes `aria-pressed`; carousel group labels and 24×24px controls are present; Grid/Map state and advanced filter label associations are present; property gallery keyboard activation and focus styles are present; pet/smoking terms are filtered from structured amenity lists; photo reordering remains disabled; first result image alone is high priority.
- GitHub PRs #56–#63 were merged to `main`; final redesign merge commit is `70e1eba5e009b153fbc3b6c99763031e838fcd50`. This corrects the earlier staged-PR status recorded when this work log was written.
- GitHub combined status for Phase 6 head commit `2c6d83159ddd8eb7d3e60c2389c80620a1c0b54e` returned no status checks (`statuses: []`). This is not a passing test result.
- No build, browser, visual regression, network waterfall, or live deployment test was run because repository instructions prohibit local runtime steps and browser/Cloudflare control-plane access is unavailable in this workflow.
- Cloudflare build command, output directory, production branch, auto-deploy behavior, and current production deployment remain unverified.
- Separate security risk remains open: RLS disabled on `public.description_enrichment_audit`; no database changes were made.

## Follow-up marketplace-copy accuracy pass — 2026-10-31
- Removed unsupported verification and fixed-duration application claims from core homepage/listing metadata and listing-page hero copy.
- Replaced named renter testimonials that had no supporting source in the repository with neutral descriptions of actual marketplace functions.
- Reworked homepage trust/process sections so they describe browsing, comparing, reviewing details, and application instructions rather than claiming all properties are Choice-managed, photos are always verified, or fees/holding arrangements apply uniformly.
- Aligned public navigation labels and the About / How It Works pages with the rental-marketplace model; corrected the How It Works page's stray pre-doctype metadata fragment and renter/landlord title mismatch.
- Added `aria-controls`/`aria-expanded` to the advanced/mobile filter disclosure buttons and synchronized both controls with the dropdown's open/closed state in the listings-page JavaScript.
- Changed files: `index.html`, `listings.html`, `property.html`, `js/listings.js`, `components/nav.html`, `components/footer.html`, `about.html`, `how-it-works.html`. Follow-up PR #64 was squash-merged to `main` on 2026-10-31 as commit `87af1b1d7722669bcb3836f0961c73d14026959e`.
- Validation: GitHub source reads and targeted string assertions only. No local build, browser, live HTTP, or Cloudflare deployment test was run; repository rules prohibit local runtime steps and Cloudflare control-plane access is unavailable.

## Release follow-up — 2026-10-31
- PR #64 (`fix/marketplace-release-readiness`) was squash-merged to `main`; merge commit: `87af1b1d7722669bcb3836f0961c73d14026959e`.
- The owner reported completing the Cloudflare deployment confirmation in chat. This is owner-reported status only; no Cloudflare control-plane record or live HTTP check was available to this workflow.
- The GitHub Cloudflare-Only Enforcement workflow associated with the PR head completed successfully, but it is not a browser regression test and does not prove production deployment.
- Browser/visual, responsive, network, and end-to-end application-flow regression checks remain pending. Repository rules prohibit local runtime/build steps; use an approved browser environment.

## Next exact action
Run the browser regression checklist against the deployed site: homepage and navigation; search/filter state and URL parameters; listing cards, save controls, grid/map switching and pagination; property detail/gallery keyboard controls and application links; About and How It Works pages; mobile layout, focus visibility, reduced motion, and image failures. Record pass/fail and screenshots or reproduction steps. Do not change Supabase schema or the `description_enrichment_audit` RLS finding as part of this UI phase; it remains a separate security review.


## Phase 8 work log — 2026-10-31 (in progress)
- Audited the production property detail path against the existing tour validator and read-only Supabase media inventory.
- Current read-only row counts: 2,477 properties, 52,232 property photos, 13 property-media rows, and 0 rows each in property_units, property_buildings, and property_floors. The media rows include virtual tours, floor plans, and videos; counts are a snapshot and may change. This means multi-building/floor rendering exists in code but cannot be validated against populated building/floor/unit records yet.
- Found that the production property page did not use the existing playable-tour validator when collecting/rendering tours. A non-tour URL or image thumbnail could therefore be presented as a walkthrough. Added a shared utility to validate supported media, deduplicate tours, keep legacy tour URLs when valid, and reject unsupported tour/provider URLs instead of showing broken viewers.
- Extended playable URL validation for common public Vimeo numeric URLs, which the existing viewer already knows how to embed.
- Enabled Enter/Space activation for media thumbnail controls implemented as role=button elements. Recast floor filter controls as a labelled group of toggle buttons using aria-pressed rather than tab semantics, because they filter visible sections rather than switch a single tab panel.
- Updated the property page script cache key so Cloudflare/browser caches can pick up the change after deployment.
- Added regression assertions around the shared tour extraction utility, common Vimeo URLs, unsupported providers, valid Matterport URLs, and multi-tour grouping. Tests have not been executed in a runtime because repository instructions prohibit local runtime/build steps; source inspection only.
- No database/schema changes, media ingestion changes, application-flow changes, or hosting/workflow changes.
- Remaining release checks: run the existing property-media test suite in an approved CI environment; browser-test property pages with valid and invalid media, keyboard interaction, mobile layout, floor filtering, legacy tour fallback, and listing-to-application links; verify Cloudflare Pages deployment and network/performance behavior.
