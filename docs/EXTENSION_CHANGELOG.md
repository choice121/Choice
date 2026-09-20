# Chrome Extension Changelog & Version History

All modifications, extractor enhancements, and UI upgrades to the Choice Properties Chrome Extension are recorded here.

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
