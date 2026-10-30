# Chrome Extension Changelog & Version History

All modifications, extractor enhancements, and UI upgrades to the Choice Properties Chrome Extension are recorded here.

---

## [v44.0.1] - 2026-10-30
### Use Zillow Pricing Table Labels
- **Avoid page-wide false matches**: Read rent basis from pricing-table column headings and leave conflicting or absent labels unknown.
- **Actionable diagnostics**: Preserve rent-basis labels in safe extension diagnostic facts and unit summaries.
- **Regression coverage**: Verify the visible table heading wins over unrelated page text and ambiguous labels remain unknown.
- **Synchronized Packages**: Rebuild Chromium and Orion packages as v44.0.1.

---

## [v44.0.0] - 2026-10-30
### Preserve Zillow Unit Price Basis
- **Avoid rent ambiguity**: Record whether Zillow labels unit prices as base rent or total monthly price; leave unclear labels unknown.
- **Pipeline review**: Display each unit's captured price basis and warn when legacy imports have no basis recorded.
- **Publishing guard**: Block community records from the single-rental publish flow instead of encouraging operators to copy one unit's facts to the building.
- **Regression coverage**: Verify both known price labels and unknown labels are preserved in extraction and diagnostics.
- **Synchronized Packages**: Rebuild Chromium and Orion packages as v44.0.0.

---

## [v43.0.0] - 2026-10-30
### Correct Zillow Community Inventory
- **Reject prose as unit identifiers**: Accept apartment unit numbers only when they match a unit-label shape, preventing words like “to”, “for”, and “types” from becoming fake units or rents.
- **Deduplicate inventory**: Merge repeated unit and floor-plan records by identity and keep the most complete available facts.
- **Preserve building metadata**: Carry the community name, multi-unit flag, reported unit count, building stories, and source price range into the pipeline record.
- **Review inventory clearly**: Show separate available-unit, floor-plan, total-building-unit, story, source price-range, and deduplicated-photo counts in the extension and pipeline detail panel.
- **Regression coverage**: Verify malformed unit rejection, duplicate resolution, source photo deduplication, and pipeline metadata persistence.
- **Synchronized Packages**: Rebuild Chromium and Orion packages as v43.0.0.

---

## [v42.0.0] - 2026-10-30
### Harden Zillow JSON-LD Fallback
- **Preserve primary extraction**: Treat Zillow JSON-LD as an optional fallback so malformed structured data cannot discard valid NextData or DOM listing results.
- **Support schema type arrays**: Normalize JSON-LD `@type` strings and arrays safely, including schema URLs.
- **Regression Coverage**: Verify Zillow still returns primary address and rent when JSON-LD uses an array-valued type.
- **Synchronized Packages**: Rebuild Chromium and Orion packages as v42.0.0.

---

## [v41.0.0] - 2026-10-30
### Privacy-Safe Extraction Error Locations
- **Actionable failures**: Include allowlisted extension source filenames, line/column numbers, and function names for direct extractor exceptions.
- **Privacy boundaries**: Never upload exception text, URLs, extension IDs, or arbitrary stack frames; the Edge Function independently filters frame metadata.
- **Regression Coverage**: Verify diagnostic stack frames identify extension code without leaking message text or external URLs.
- **Synchronized Packages**: Rebuild Chromium and Orion packages as v41.0.0.

---

## [v40.1.0] - 2026-10-30
### Opt-in Extraction Diagnostics
- **One-click reports**: Add a "Run & Send Diagnostics" control to send a report even when extraction fails.
- **Useful evidence**: Include extracted property/unit facts, parser status, media/photo counts, DOM element counts, and a bounded embedded-data shape (field names and value types only).
- **Privacy boundaries**: Exclude cookies, session state, full page text/HTML, descriptions, contact details, exception messages, and raw photo/media URLs. Server-side validation enforces the report schema.
- **Private inbox**: Store reports in a service-role-only public-schema table, expose reads only to authenticated admins, and expire reports after 30 days.
- **Regression Coverage**: Verify report URL stripping and that descriptions/page text values are not included.
- **Synchronized Packages**: Rebuild Chromium and Orion packages as v40.1.0.

---

## [v40.0.0] - 2026-10-30
### Zillow Multi-Unit Extraction Reliability
- **Keep Unit-Only Communities**: Do not discard valid apartment-community results when Zillow omits a street address or a single-property rent.
- **Broader Inventory Parsing**: Read nested unit inventory alongside Zillow's property cache, and parse labeled unit rows and floor-plan cards with distinct prices.
- **Community Preview**: Show the community name and extracted unit/floor-plan facts in the widget; retain all parsed options in the existing pipeline `original_data`.
- **Content Rules**: Keep unit rents separate from community starting rent and do not display pet policies, lease terms, or availability dates.
- **Regression Coverage**: Add missing-address, unnumbered floor-plan, and nested inventory cases; retain single-family Zillow tests.
- **Synchronized Packages**: Rebuild Chromium and Orion packages as v40.0.0.

---

## [v39.0.0] - 2026-10-30
### Zillow Apartment Community Extraction
- **Community-Level Accuracy**: Keep building-page rent and bedroom/bathroom/square-footage fields empty instead of copying the first unit's facts.
- **Unit Rows**: Preserve unit numbers, beds, baths, square footage, and unit-specific rent in the source order; keep floor-plan starting rents distinct.
- **Media Coverage**: Improve rendered video, poster, virtual-tour, and floor-plan media detection and show media/unit counts in the importer.
- **Pipeline Preservation**: Store unit options in the existing `original_data` field without altering the pipeline schema; omit unit availability dates and pet policies.
- **Community Starting Rent**: Display building-level starting rent separately without treating it as an individual unit's monthly rent.
- **Regression Coverage**: Add a 12-row Range Vista-style fixture and retain support for single-family Zillow pages.
- **Synchronized Packages**: Rebuild Chromium and Orion packages as v39.0.0.

---

## [v38.0.1] - 2026-10-30
### Use Asking Rent for Zillow Imports
- **Estimate Rejection**: Keep Zillow rent estimates out of staged asking-rent fields when no explicit listing price is available.
- **Generated Extractors**: Regenerated browser and Edge Function extractors from the canonical shared source.
- **Regression Coverage**: Added Edge Function tests for estimate-only and explicit asking-rent payloads.
- **Synchronized Packages**: Rebuilt Chromium and Orion packages as v38.0.1.

---

## [v36.0.0] - 2026-10-30
### Cross-Portal DOM Media Fallbacks
- **DOM Fallback Coverage**: Reuse the labeled media collector for Opendoor, Progress Residential, Invitation Homes, and CJ listing pages when structured metadata is incomplete.
- **JSON-LD Preservation**: Merge DOM-discovered media with existing JSON-LD media instead of discarding either source.
- **Legacy Tour Compatibility**: Continue filling `virtual_tour_url` from the first detected 3D tour while retaining all media entries.
- **Synchronized Packages**: Rebuilt Chromium and Orion packages as v36.0.0.

---

## [v35.0.0] - 2026-10-30
### Zillow DOM Media Fallback
- **DOM-Only Media**: Detect clearly labeled floor-plan images, video elements, and named 3D-tour embeds when structured listing data is unavailable.
- **Source Ordering**: Preserve DOM order for mixed media and merge distinct media from Zillow's structured, DOM, and JSON-LD extraction tiers.
- **Floor Labels**: Keep full labels such as “Main Floor” and “Second Floor” for multi-floor grouping.
- **Regression Coverage**: Added a DOM fixture covering a tour, walkthrough video, and floor-plan image.
- **Synchronized Packages**: Rebuilt Chromium and Orion packages as v35.0.0.

---

## [v34.0.0] - 2026-10-30
### Cross-Portal Structured Media Extraction
- **Portal Coverage**: Extract source-provided floor plans, videos, and virtual tours from Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, Zillow, and JSON-LD listing data.
- **Video Classification**: Keep Apartments.com video URLs in the video media type instead of incorrectly copying them into the legacy 3D-tour field.
- **Compatibility**: Preserve `virtual_tour_url` for existing listing integrations while adding structured `media[]` items.
- **Regression Coverage**: Added cross-portal fixtures for floor plans, videos, virtual tours, and JSON-LD media.
- **Synchronized Packages**: Rebuilt Chromium and Orion packages as v34.0.0.

---

## [v33.0.0] - 2026-10-29
### Structured Property Media Import
- **Zillow Media Extraction**: Capture structured floor plans, walkthrough videos, and virtual tours from supported listing fields, preserving floor labels, providers, poster URLs, and display order.
- **Pipeline Media Preservation**: Carry normalized media arrays through browser imports while retaining the legacy `virtual_tour_url` field for existing listings.
- **Public Media Publishing**: Publish imported media items into `public.property_media` alongside the existing photo gallery.
- **Regression Coverage**: Added a Zillow fixture for floor plans, videos, and 3D tours; Chromium and Orion package tests pass.
- **Synchronized Packages**: Rebuilt Chromium and Orion extension packages as v33.0.0.

---

## [v31.0.4] - 2026-10-26
### Zillow Apartment Building Extraction Recovery
- **Preserve Rendered Listing Data**: Zillow NextData objects with empty address, rent, or photo fields no longer erase more complete values extracted from the visible page.
- **Nested Building Cache Support**: Added bounded traversal of nested Zillow `gdpClientCache` payloads to locate building property records.
- **Visible Building Details**: DOM extraction now recognizes full street addresses, labeled rent fields, additional image attributes, and stable building IDs from city/slug/id apartment routes.
- **Regression Coverage**: Added a Paseo-shaped fixture and Orion mocked-save browser test confirming address, starting rent, building ID, and all 11 gallery URLs reach the save payload.

---

## [v31.0.3] - 2026-10-26
### Zillow Apartment Lazy-Loaded Photo Capture
- **Gallery Attribute Coverage**: Zillow DOM extraction now checks rendered and lazy-loaded image URLs in `src`, `data-src`, `data-lazy-src`, `data-original`, `srcset`, `data-srcset`, and background images.
- **Photo-Only CDN Filtering**: Only Zillow CDN URLs under `/fp/` are accepted, avoiding logos and unrelated page assets in the listing gallery.
- **Regression Coverage**: Added an 11-photo lazy-loading fixture and verified both Chrome and Orion show all photos; Orion save tests confirm all 11 source URLs are submitted.
- **Synchronized Extension Packages**: Rebuilt shared extractor variants and Chromium and Orion packages as v31.0.3.

---

## [v31.0.2] - 2026-10-26
### Zillow Starting-Rent Imports and Orion Apartment-Page Detection
- **Consistent Zillow Route Recognition**: Orion now consults the shared extractor registry before applying its legacy URL patterns, so Zillow `/apartments/{slug}/{id}` building pages without a `_zpid` suffix receive the Save widget.
- **Safe DOM Rent Parsing**: Zillow's rendered price text now uses the shared rent parser. Starting prices such as `$1,450+` and ranges such as `$1,500–$2,000` resolve to the first displayed rent instead of concatenating all digits into an invalid amount.
- **Regression Coverage**: Added extractor tests for DOM starting/range prices and browser tests for the Chrome and Orion widgets on Zillow apartment building URLs; Orion also verifies a successful mocked save.
- **Synchronized Extension Packages**: Rebuilt the shared extractors, Chromium and Orion ZIP packages, and version metadata as v31.0.2.

---

## [v31.0.1] - 2026-10-25
### Zillow Multi-Unit Apartment Page Detection
- **Recognize Zillow Building Pages**: Added support for Zillow `/apartments/{slug}/{id}` detail URLs that omit the `_zpid` suffix, allowing the importer widget to appear on multi-unit building listings.
- **Starting Rent Coverage**: Added regression coverage confirming a Zillow `$1,450+` price is imported as the numeric starting rent while preserving the building's unit count.
- **Synchronized Extension Packages**: Rebuilt Chromium and Orion packages and the shared extractor variants as v31.0.1.

---

## [v28.0.6] - 2026-10-16 09:10 UTC
### One-Tap Mobile Pipeline Save
- **Compact Property Bar**: On phones, the importer starts as a small address/rent bar with a one-tap Save button, avoiding the full floating panel over Zillow's listing content.
- **Clear Save Feedback**: The compact button shows saving, saved, queued, duplicate, and retry states. Errors expand the panel so the user can see the failure and retry.
- **Touch-Friendly Layout**: Preserves a 42px minimum save target and truncates long addresses rather than widening the bar across the screen.
- **Less Image Work**: Removed unused client-side image download, base64 conversion, and ImageKit re-upload code; the import path continues to send original source CDN URLs in original order.
- **Platform Compatibility**: Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, CJ Real Estate, and Invitation Homes; Chromium extension and Orion-compatible iPhone browser build.

---

## [v28.0.5] - 2026-10-16 09:01 UTC
### Orion Mobile Navigation and Performance
- **Automatic SPA Listing Detection**: Added lightweight URL-change checks for browsers where page-world History API hooks are isolated, so navigating to a property no longer depends on manually refreshing.
- **Hydration-Aware Saving**: Waits briefly for required listing identity and address facts to load; saves refreshed facts for the same property while still blocking stale data after navigation.
- **Lower Mobile Workload**: Throttles DOM-triggered extraction, ignores mutations inside the extension widget and image-only DOM changes, removes repeated layout scans from page mutation callbacks, and batches scroll-position updates per animation frame.
- **Reduced Mobile Rendering Cost**: Disables backdrop blur and uses a lighter shadow on narrow screens.
- **Platform Compatibility**: Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, CJ Real Estate, and Invitation Homes; Chromium extension and Orion-compatible iPhone browser build.

---

## [v28.0.4] - 2026-10-16 07:05 UTC
### Orion Mobile Save Bridge Recovery
- **Background Message Fallback**: If the Orion background service worker returns no response, reports a messaging failure, or times out, the listing save retries directly against the authenticated import endpoint instead of ending with the generic "Save failed" message.
- **Actionable Save Errors**: Server errors are preserved for the UI, and a failed direct retry reports both the background and direct-request errors.
- **Safe Retry Behavior**: The import endpoint's existing source-listing duplicate check prevents a second pipeline record if the background request completed but its response was lost.
- **Platform Compatibility**: Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, CJ Real Estate, and Invitation Homes; Chromium extension and Orion-compatible iPhone browser build.

---

## [v28.0.3] - 2026-10-15 23:49 UTC
### Cached, Source-Qualified Property Location Intelligence
- **Nearby Places & Neighborhood Context**: Added a Supabase Edge Function that can retrieve nearby schools, parks, shopping, healthcare, and public transit from Geoapify and reverse-geocode an approximate neighborhood.
- **Property Detail Map**: Adds interactive nearby-place markers and distance summaries; distances are explicitly labeled as straight-line estimates, not walking or driving routes.
- **Privacy & Cost Controls**: Provider calls run server-side, use stored property coordinates, and cache successful snapshots for 14 days (partial responses for six hours). Private-placement requests require a valid share token.
- **Accuracy Boundaries**: Does not claim school ratings, school-assignment boundaries, or Walk Score. Provider attribution, retrieval date, partial results, and stale results are shown.
- **Pipeline Cleanup**: Removed an unused embedded Geoapify fallback value from the import Edge Function; provider access uses configured environment secrets.
- **Synchronized Artifacts & Tests**: Rebuilt both extension packages and shared extractor variants as v28.0.3; location normalization assertions pass.
- **Platform Compatibility**: Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, CJ Real Estate, and Invitation Homes; Chromium extension and Orion-compatible iPhone browser build.

---

## [v28.0.2] - 2026-10-15 23:33 UTC
### Zillow Feature Fact Precision
- **Explicit Negatives vs Unknowns**: Zillow basement wording such as "No basement" is recognized as an explicit false; absent feature evidence remains unknown (`null`).
- **Central Air Accuracy**: Generic cooling indicators and window units are no longer treated as proof of central air. Central air is set only from explicit central-cooling evidence.
- **Regression Coverage**: Added matching Chromium and Orion cases for explicit basement and non-central cooling facts.
- **Synchronized Artifacts & Tests**: Rebuilt extractor variants and both v28.0.2 extension packages; Chromium extractor tests and package validation pass.
- **Platform Compatibility**: Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, CJ Real Estate, and Invitation Homes; Chromium extension and Orion-compatible iPhone browser build.

---

## [v28.0.1] - 2026-10-15 23:25 UTC
### Zillow Fact Accuracy and Location Display Corrections
- **Asking Rent Integrity**: Zillow `rentZestimate` is no longer used as the asking rent when a listing price is absent.
- **Policy-Safe Imports**: Availability dates, lease terms, and smoking-policy fields are omitted from new pipeline records and public publish payloads; these fields no longer affect data-quality scores.
- **Unknown Feature Preservation**: Missing basement and central-air facts remain unknown rather than being stored as false.
- **Location Display Accuracy**: Removed fabricated city-based school names/ratings from the public details UI. Listing-reported school names are explicitly qualified, and no ratings, assignment, or proximity claims are invented. Removed unsupported "Verified Location" labeling and hide empty location scores.
- **Synchronized Artifacts & Tests**: Rebuilt both Chromium and Orion v28.0.1 packages and extractor bundles; extractor regression tests pass for both builds.
- **Platform Compatibility**: Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, CJ Real Estate, and Invitation Homes; Chromium extension and Orion-compatible iPhone browser build.

---

## [v28.0.0] - 2026-10-08
### Database Check Constraint Resolution on Direct Pipeline Ingestion
- **Fixed `photo_upload_status` Check Constraint**: Corrected `receive-pipeline-import` edge function to assign `photo_upload_status = 'complete'` (instead of `'ready'`), fully conforming to `pipeline_properties_photo_upload_status_check` (`'none'`, `'uploading'`, `'complete'`, `'failed'`). Eliminates "new row for relation pipeline_properties violates check constraint" failures on save.
- **Synchronized Artifacts & Test Suite**: Recompiled all distribution archives (`choice-properties-extension.zip`, `choice-properties-orion-extension.zip`), manifests, and metadata with 100% test coverage passing (29/29 tests).

---

## [v27.0.0] - 2026-10-07
### Direct Source CDN Image Ingestion Engine & Instant Pipeline Save Path
- **Direct Source CDN Ingestion (Zero ImageKit Lag)**: Updated `receive-pipeline-import` edge function and extension pipeline integration to eliminate remote ImageKit upload cycles. All high-resolution source CDN photo URLs (uncompressed 1536px photos from Zillow, Realtor, Redfin, etc.) are ingested directly into `pipeline_properties.original_image_urls` with instant `'completed'` status.
- **Sub-Second Save Latency**: Removing remote background image re-uploading reduces edge function processing overhead from minutes to sub-second saves with zero timeout risk or conversion artifacts.
- **Direct Live Publishing Integration**: Photo assets publish directly to `public.property_photos` preserving source CDN URLs, original photo sequence, and hero designation.
- **Synchronized Artifacts & Test Suite**: Recompiled all distribution archives (`choice-properties-extension.zip`, `choice-properties-orion-extension.zip`), manifests, and metadata with 100% test coverage passing (29/29 tests).

---

## [v26.0.0] - 2026-10-07
### Compact Folder Pill, Auto-Collapsing Folder Popover & Sticky Default Folder Engine
- **Minimal Compact Folder Pill**: Replaced the bulky static `<select>` dropdown above the Save button with a sleek 1-line Folder Pill (`📁 Folder: <Name> • Change / + New ▾`) so the Save to Pipeline button is never obstructed or cramped on Zillow and supported portals.
- **In-Widget Folder Creation (Zero Input Validation)**: Users can now create a new folder directly on Zillow with any folder name (including single digits like `1`, numbers like `102`, or text) and optional description without leaving the page.
- **Auto-Collapsing Popover**: The folder management popover opens on demand and automatically collapses the instant a folder is created, selected, or when Save to Pipeline is clicked, keeping the HUD minimal and clean.
- **Sticky Default Folder Persistence**: Creating a folder, selecting a folder, or saving a property to a folder automatically locks that folder as the persistent default across `chrome.storage.local` and `localStorage`. Every subsequent click on "Save to Pipeline" routes directly into that active folder until changed.
- **Synchronized Artifacts & Test Suite**: Recompiled all distribution archives (`choice-properties-extension.zip`, `choice-properties-orion-extension.zip`), manifests, and metadata with 100% test coverage passing.

---

## [v24.0.0] - 2026-10-07
### Enhanced Accessible Save to Pipeline Button & 360° Draggable Widget Interface
- **Prominent Accessible Save Button**: Completely overhauled the "Save to Pipeline" action button design. Upgraded with an ergonomic pill shape, large 48px+ click/tap target, high-contrast emerald-indigo gradient (`linear-gradient(135deg, #10b981 0%, #059669 30%, #4f46e5 100%)`), larger 20px action icon, bold 14.5px typography, glowing hover aura, and clear shortcut pill (`⌘⇧S`). Eliminates difficult mouse targeting and provides effortless one-click saves.
- **360° Draggable Widget Window**: Added full dragging support to the floating extension HUD. Users can click-and-drag or touch-and-drag the top header bar anywhere across the screen (left, right, up, down) with smooth boundary clamping so it never obscures critical listing details. Position is remembered during the session and prevents collision jumps.
- **Drag Grip Indicator & Cursors**: Added a 6-dot drag grip affordance to the header brand bar, dynamic `cursor: grab` and `cursor: grabbing` states, and smooth drag physics.
- **Synchronized Artifacts & Test Suite**: Recompiled all distribution archives (`choice-properties-extension.zip`, `choice-properties-orion-extension.zip`), manifests, and metadata with 100% test coverage passing (29/29 tests).

---

## [v22.0.0] - 2026-10-07
### Deep Feature Traversal, Narrative Fallback Extraction, Architectural Precision & Prohibited Badge Blacklist
- **Deep Zillow resoFacts Traversal**: Added recursive inspection of `resoFacts.features`, `resoFacts.featureCategories`, and `resoFacts.atAGlanceFacts` to capture appliances, parking, garage spaces, flooring, laundry, and HVAC regardless of which nesting level Zillow places them in.
- **In-Extractor Narrative Fallback (Zero Feature Blindness)**: Added regex-based heuristic extractor for narrative descriptions. If portal tables omit appliances, parking, dedicated laundry rooms, garage capacity, or flooring, the extractor automatically mines them from the raw listing text and populates structured database columns.
- **Architectural Classification & Contact Signature Isolation**: Sanitizes broker/property manager contact signatures (e.g. "Call X at Y Apartments") prior to classification so single-family houses and craftsman homes are never erroneously classified as apartments. Strictly identifies `DUPLEX`, `TOWNHOUSE`, `SINGLE_FAMILY`, and `APARTMENT` per Rule 6B.
- **Smoking Badge Blacklist**: Strictly excludes `"Non Smoking"`, `"Smoking Allowed"`, and lease duration tags from entering structured `amenities`, ensuring complete compliance with Choice Properties UI directives.
- **Synchronized Artifacts & Test Suite**: Recompiled all distribution archives (`choice-properties-extension.zip`, `choice-properties-orion-extension.zip`), manifests, and metadata with 100% test coverage passing (29/29 tests).

---

## [v21.0.0] - 2026-10-07
### Search Card Overlay Cleanup, Authoritative Manifest Versioning & Cache Invalidation
- **Search Card Overlay Removal**: Completely removed the on-card button overlays (`+ Choice` / `Saved to Tab` / `Open your save...`) from search result property cards across Zillow and supported feeds to eliminate visual clutter and ensure non-intrusive browsing.
- **Authoritative Version Pill**: Refactored `popup.js` to strictly prioritize the local installed `manifest.version` as the authoritative version display. Prevented cloud metadata responses from downgrading or falsely overwriting the installed version number.
- **Edge Cache Invalidation (`_headers`)**: Added strict `no-cache, no-store, must-revalidate, max-age=0` directives for `choice-properties-extension.zip`, `choice-properties-orion-extension.zip`, `extension-meta.json`, and `extension-updates.xml` on Cloudflare Pages to prevent browsers from downloading stale cached extensions.
- **Zillow & Detail Page Behavior**: Verified the floating "Save to Pipeline" widget on Zillow listing detail pages, ensuring fast folder selection, high-resolution photo extraction, pre-flight inspection breakdown, and instant pipeline synchronization.
- **Synchronized Artifacts & Test Suite**: Recompiled all distribution archives (`choice-properties-extension.zip`, `choice-properties-orion-extension.zip`), manifests, and metadata with 100% test coverage passing (29/29 tests).

---

## [v20.0.0] - 2026-10-07
### Universal Portal Fidelity, Verbatim Source Titles, 3D Panoramas & Architectural Parity
- **Verbatim Source Titles**: Property titles strictly preserve authentic source listing titles and headlines without synthetic reconstruction or artificial template tags, aligning with Zillow listing standards.
- **Universal 3D Virtual Tour & Panorama Extraction**: Extracted 3D tours, Matterport models, Zillow 3D Home/IMX walkthroughs, InsideMaps, and video tours into `virtual_tour_url` across all 8 supported rental portals.
- **Architectural Property Type Parity**: Standardized property classification (`SINGLE_FAMILY`, `DUPLEX`, `TOWNHOUSE`, `CONDO`, `APARTMENT`) matching source structural reality.
- **Dual Package & Schema Parity**: Chromium and Orion extensions synchronized with updated pipeline edge ingestion and public display interfaces.

## [v18.0.14] - 2026-10-07
### Zillow Full Fidelity Extraction, Zero Bathroom Truncation & Complete Attribute Forwarding
- **Full Attribute Ingestion**: Browser extension payload now captures and forwards the complete suite of property details parsed from Zillow (appliances, amenities, flooring, utilities included, heating type, cooling type, laundry type, parking/garage spaces, basement, central air, lot size, stories, and neighborhood).
- **Original Description Preservation**: Permanent immutable anchor of the raw, unmodified listing text (`original_description`) is captured and forwarded into the pipeline and public database.
- **Zero Bathroom Truncation**: Fractional bathroom values (`1.5`, `2.5`, `3.5`) are fully preserved end-to-end without rounding down to integer values, across extractors, pipeline records, database schema, and public rendering.
- **Pipeline Publish Full Fidelity**: `pipeline_publish` database function now transfers photos directly to `public.property_photos` with display ordering, and transfers `flooring`, `total_bathrooms`, and `original_description` into `public.properties`.
- **Public Display Resilience**: `js/property.js` safely normalizes amenities, appliances, flooring, and utilities into robust arrays regardless of incoming format (array, string, JSON).

## [v18.0.13] - 2026-09-29
### Invitation Homes Live Routes & Progress Residential AEM Reliability
- **Invitation Homes activation**: Added the current `/houses-for-rent/...` listing route to the canonical extractor, content-script widget detection, and popup supported-listing status so the Save to Pipeline action appears on live listings.
- **Progress Residential AEM hardening**: Recognize the current property-details container, rent values embedded in image alt text, query-string listing URLs, and the rendered AEM gallery so live listings retain their ID, rent, facts, and photos.
- **Platform compatibility**: Synchronized Chromium and Orion/Safari packages across Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, CJ Real Estate, and Invitation Homes.
- **Release validation**: Rebuilt both downloadable archives and added regression coverage for the current Invitation Homes route and live Progress Residential AEM markup.

## [v18.0.12] - 2026-09-29
### Exact Photo Totals & Same-Tab Listing Refresh Safety
- **Exact Photo Display**: Replaced the ambiguous thumbnail `+N` remainder with the complete detected photo total, so the current listing's image count is clear.
- **Opendoor Accuracy**: Prefer hydrated listing and rendered gallery photos over page-wide recommendation preloads, preventing unrelated assets from inflating listings to the 50-photo cap.
- **Invitation Homes Coverage**: Preserve the final property identifier on nested `/homes-for-rent/...` routes and expose Invitation Homes in the extension popup's supported-listing check.
- **Progress Residential Coverage**: Supplement hydrated property data with the rendered gallery when image hydration is delayed, and recognize current `property-details` routes.
- **Same-Tab Safety**: Re-extract before saving and invalidate pending refreshes on navigation so a stale widget cannot save the previously open property.
- **Release Validation**: Rebuilt synchronized Chromium and Orion packages with extractor regression coverage for nested Invitation Homes routes and Opendoor recommendation-photo filtering.

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
