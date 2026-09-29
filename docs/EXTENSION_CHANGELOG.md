# Chrome Extension Changelog & Version History

All modifications, extractor enhancements, and UI upgrades to the Choice Properties Chrome Extension are recorded here.

---

## [v18.0.11] - 2026-09-29
### Fast Pipeline Saves & SPA Listing Refresh Reliability
- **Fast Acknowledgement**: Pipeline imports now return immediately after the property insert while Edge Runtime background work handles ImageKit photo processing and records explicit upload failures.
- **Lower Save Latency**: Folder responses use the extension’s selected folder name and skip two nonessential count/name reads; the extension no longer starts a duplicate client-side photo upload after the server accepts a listing.
- **Batch Reliability**: Offline queued listings flush with bounded parallel workers, coalesce overlapping flush triggers, and preserve per-item retry state.
- **SPA Refreshing**: Chromium and Orion widgets debounce DOM changes, re-extract after hydration, detect listing-data changes, and hook history navigation so new SPA listings refresh without a browser reload.
- **Release Validation**: Rebuilt Chromium and Orion packages with all 25 extractor cases passing.

## [v18.0.10] - 2026-09-29
### Invitation Homes Activation & Progress Residential AEM Detail Hardening
- **Invitation Homes**: Added Chromium and Orion host/content matches plus a dedicated extractor for Invitation Homes property routes, JSON-LD, Svelte-rendered address/spec data, and Cloudinary galleries.
- **Progress Residential**: Added explicit support for current AEM property-detail pages, preserving decimal rents, fractional baths, property IDs, server-rendered specs, and `photos.rentprogress.com` galleries.
- **Shared Builds**: Regenerated Chromium and Orion extractor variants from the canonical source and added fixtures for both live page structures.
- **Release Validation**: Required Invitation Homes matches in both packages and kept archive/version parity checks enabled.

## [v18.0.9] - 2026-09-29
### AppFolio/CJ Domain Activation & Cloudflare Release Artifact Fixes
- **Portal Activation**: Added Chromium and Orion content-script matches for AppFolio and `cjrealestate.com`, and added AppFolio URL dispatch to the canonical CJ Real Estate extractor.
- **Cloudflare Release Paths**: Published extension metadata, update XML, and both Chromium/Orion ZIP packages at the Cloudflare Pages root so the URLs used by the extension and release documentation resolve correctly.
- **Release Validation**: Added coverage for required portal matches, current README versions, and generated `dist/` release artifacts.
- **Extractor Tests**: Added AppFolio detection and payload coverage.

## [v18.0.8] - 2026-09-29
### v18 Package Alignment, Queue Recovery & Release Validation
- **Canonical v18 Packaging**: Chromium and Orion/Safari sources now use one synchronized version and the release script generates both ZIP packages from the current source directories.
- **Legacy Package Cleanup**: The root and `dist/` manifest copies are synchronized to the current v18 release instead of advertising the retired v2 package.
- **Portal Status Alignment**: The popup now recognizes Opendoor, Progress Residential, and CJ Real Estate in addition to the original four portals.
- **Queue Recovery**: Offline queue items retain retry counts and the latest failure reason, and users can export the queue for recovery before retrying.
- **Payload Guardrails**: Oversized listing payloads are rejected before upload with a visible error.
- **Permission Reduction**: Removed unused `downloads` and `alarms` permissions; direct photo fallback fetches do not send browser credentials.
- **Build Validation**: Added package validation for manifest versions, required files, generated extractor parity, JavaScript syntax, ZIP contents, and the 20-case extractor suite.

---

## [v18.0.0] - 2026-09-21
### Universal Static Zip Serving, Dual Direct REST Ingestion & Opendoor/Progress Residential Hardening
- **Universal Static Zip Serving**: Configured server with direct MIME mapping and root-level fallback to serve `choice-properties-extension.zip` directly from development and preview URLs (`/choice-properties-extension.zip`), eliminating stale CDN cached v15 downloads.
- **Opendoor Multi-Pattern URL & DOM Scanner**: Upgraded Opendoor detection to support `/properties/`, `/homes/`, and address-slug formats; enriched DOM query selectors for SPA client-side rendering with automatic retry and script tag asset extraction.
- **Progress Residential Direct REST Pipeline Ingestion**: Completely bypassed Edge Function "unsupported source" limitation for `progress_residential` by adding direct Supabase REST API insertion (`/rest/v1/pipeline_properties`) with automatic duplicate detection, target folder assignment, and background photo upload.
- **Automated Root & Dist Package Synchronization**: Enhanced `scripts/sync-and-bump-extension.mjs` to continuously package and synchronize `choice-properties-extension.zip` across `public/`, `./`, and `dist/` directories.
- **Test Suite Verification**: Verified 20/20 automated extractor test cases passing across all 7 supported portals.

---

## [v17.0.0] - 2026-09-20
### Universal Fallback Engine & Deep Opendoor/Progress Residential Ingestion
- **Opendoor Address Slug Parser**: Implemented resilient regex parser extracting street, city, state, and ZIP from Opendoor URL slugs (`/properties/street-city-OH-43229/...`) to guarantee 100% extraction even if DOM rendering is deferred or lazy.
- **Deep Script Tag Photo Scanners**: Added full-document script tag scanners across Opendoor and Progress Residential pages to capture high-res Cloudinary, S3, Fastly, and CDN gallery photos directly from hydrated states.
- **Direct Supabase REST Dual-Save Fallback**: If the Edge function is unreachable or returns a transient error/unsupported source response, the extension automatically falls back to direct Supabase REST API insertion (`/rest/v1/pipeline_properties`), assigns the target folder, and triggers photo upload with zero disruption to the user.
- **Folder List Fallback**: Extension folder dropdown query falls back directly to Supabase REST (`/rest/v1/pipeline_folders`) if Edge API is unavailable.
- **Repackaged Distribution Zip**: Compiled and repackaged `choice-properties-extension.zip` v17.0.0 with synced test suite passing (20/20 test cases).

---

## [v16.0.0] - 2026-09-20
### Opendoor Deep Extraction & Edge Quality Ingestion Fix
- **Deep React Query & DOM Scraper**: Added deep traversal for Opendoor's Next.js dehydrated query cache (`dehydratedState.queries`) alongside comprehensive DOM fallbacks for address, rent, beds, baths, sqft, and high-resolution photo galleries.
- **JSON-LD Place / Area Search Filter**: Strengthened JSON-LD parsers to reject generic `@type: "Place"` / city-level items that lacked street addresses or offers, preventing search result pages from overriding specific property data.
- **Edge Function Portal Support**: Updated `normalizeSource` in `receive-pipeline-import` and `pipeline-record.ts` to fully support `opendoor`, `progress_residential`, and `cj_real_estate` imports.
- **Synchronized Artifacts & Build**: Freshly compiled all 3 extractor bundles (`chrome-extension`, `.pages-orion`, `supabase/functions`) and repackaged distribution zip `choice-properties-extension.zip` v16.0.0 (20/20 test cases passing).

---

## [v15.0.0] - 2026-09-20
### Policy & Package Alignment Update
- **Deposit & Badge Policy Alignment**: Aligned client ingestion standards with platform rules (hidden security deposit from display, removed "Just listed" freshness badges).
- **Repackaged Distribution Zip**: Compiled and repackaged `choice-properties-extension.zip` v15.0.0 with synced test suite passing (20/20 test cases).
- **Edge & Content Scripts Synchronized**: All extractor variants (`chrome-extension`, `.pages-orion`, `supabase/functions`) compiled and verified.

---

## [v14.0.0] - 2026-09-20
### Opendoor Sale-to-Rent Conversion & For-Sale Stripping Engine
- **Opendoor For-Sale Jargon Stripper**: Integrated comprehensive regex stripping for mortgage, buyer financing, escrow, closing costs, earnest money, investor/ARV tags, open house announcements, and Opendoor broker assurances.
- **Dual-Field Context Preservation**: Captures immutable `original_description` while providing a 100% rental-cleaned `description` field for pipeline staging.
- **Canonical Rental Rules Enforcement**: Automatically applies $50 application fee, 1x rent security deposit (in DB, stripped from descriptions), pet-friendly default (`pets_allowed: true`), and omits lease terms across all Opendoor ingestion points.
- **Synced Extractor Variants**: Rebuilt and tested all extractor targets (`chrome-extension`, `.pages-orion`, `supabase/functions`) passing 20/20 test cases.

---

## [v13.0.1] - 2026-09-20
### Dual-Field Ingestion & Context Preservation
- **Original Description Ingestion**: Added explicit `original_description` capture across all 7 supported platform extractors (`Zillow`, `Realtor`, `Apartments.com`, `Redfin`, `Opendoor`, `Progress Residential`, `CJ Real Estate`) in `src/extractors/shared-extractors.js`.
- **Pipeline Edge Function Payload Alignment**: Ingests raw unedited listing text into both `original_description` and `description` upon initial extraction so downstream AI enrichment never loses original context.

---

## [v13.0.0] - 2026-09-20
### High-Performance Engine & Smart Pre-Flight HUD
- **0ms Instant SPA Mount**: Replaced polling with `History.pushState` / `History.replaceState` hooks and MutationObserver for instantaneous 0ms widget mounting when browsing listings on single-page applications (Zillow, Realtor, Redfin).
- **In-Memory & LocalStorage Folder Cache**: Target folder dropdown now loads instantly with zero network delay using background cached folders, and automatically revalidates in the background.
- **Smart Pre-Flight HUD**:
  - Live photo quality indicators (Green if $\ge 6$, Red warning if $< 6$).
  - Mini photo preview ribbon showing the first 5 high-res extracted thumbnails with full count.
  - Verified architectural classification badge (`DUPLEX`, `SINGLE_FAMILY`, etc.).
  - Real-time rent, deposit, app fee, and pet policy breakdown.
- **Global Keyboard Shortcut**: Added `Cmd+Shift+S` / `Ctrl+Shift+S` hotkey to save listings to the pipeline with a single keystroke.
- **Resilient Auto-Retry Background Worker**: Implemented automatic exponential backoff retries on network blips so listings are reliably saved without dropping.
- **Folder Serial Feedback**: Real-time confirmation feedback displays the exact destination folder name and sequential folder item number (`Saved to <Folder Name> (#N)`).

---

## [v12.0.0] - 2026-09-20
### Added
- **Pipeline Source Badges**: Added distinct high-contrast color badges and filter tabs for all 7 supported portals (`Zillow`, `Realtor`, `Opendoor`, `Progress Residential`, `CJ Real Estate`, `Apartments.com`, `Redfin`) in `admin/pipeline.html`.
- **Smart Duplicate Toast**: Re-assigning an already existing pipeline property to a new folder now displays a positive green status toast (`Updated Folder (<folder_name>)`) instead of an ambiguous warning.

---

## [v11.0.0] - 2026-09-20
### Added
- **Target Folder Selection**: Added dynamic folder selection dropdown inside the in-page widget.
- **Dynamic API Sync**: Fetches active pipeline folders from `receive-pipeline-import?action=list_folders` on widget mount.
- **Payload Binding**: Injects `folder_id` into the JSON payload for instant automated staging folder assignment.

---

## [v10.0.0] - 2026-09-20
### Added
- **Expanded Portal Coverage (7 Portals Total)**: Added dedicated extractor modules for:
  - `Opendoor` (Hydrated state & gallery extraction).
  - `Progress Residential` (Corporate single-family rental feed normalization).
  - `CJ Real Estate` (AppFolio/Propertyware syndication engine).
- **Rule 6A Zero Truncation**: Enforced strict fractional bathroom decimal retention (`1.5`, `2.5`, `3.5`) across all extractors.
- **Rule 6B Smart Architectural Classifier**: Auto-classifies attached duplexes/side-by-side units as `DUPLEX`.
- **High-Res Hydration**: Scrapes full-scale 1536px uncropped photography directly from application cache states.

---

## [v9.0.0] - Earlier Build
### Added
- Core 4-portal support (`Zillow`, `Realtor`, `Apartments.com`, `Redfin`).
- In-page injection widget with draggable coordinates and Supabase edge function proxy.
