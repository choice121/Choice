# Choice Properties — Universal Chrome Extension (v37.0.0)

A browser extension that allows Choice Properties agents to save rental listings directly from **8 major rental portals** into the Choice Properties staging pipeline with 1 click.

---

## Supported Portals (8 Total)

| Platform | URL Patterns Supported | Extraction Method |
| :--- | :--- | :--- |
| **Zillow** | `zillow.com/homedetails/*`, `zillow.com/b/*`, search grids (`zillow.com/*/rentals/`, `zillow.com/homes/*`), & Favorites (`zillow.com/myzillow/favorites`, `/saved-homes`, `/lists`) | `__NEXT_DATA__` + `gdpClientCache` + Silent 4-Tier HDP Card Hydration + Adaptive Micro-Batching + JSON-LD |
| **Realtor.com** | `realtor.com/realestateandhomes-detail/*` | `__NEXT_DATA__` (`pageProps.initialState`) |
| **Apartments.com** | `apartments.com/*` | Microdata / JSON-LD + Dynamic DOM Table |
| **Redfin** | `redfin.com/*` | `__NEXT_DATA__` + `reactServerState` |
| **Opendoor** | `opendoor.com/properties/*`, `opendoor.com/homes/*` | React Query Dehydrated State + Script Scanner + Slug Parser + DOM |
| **Progress Residential** | `rentprogress.com/houses-for-rent/*`, `rentprogress.com/homes/*` | Hydrated State (`pageProps.property`) + Script Scanner + Fastly CDN |
| **CJ Real Estate** | `cjproperties.org/*`, `cjrealestate.com/*`, `appfolio.com/*` | AppFolio Schema + high-res s3 galleries |
| **Invitation Homes** | `invitationhomes.com/property/*`, `invitationhomes.com/homes-for-rent/*` | JSON-LD + server-rendered Svelte DOM |

---

## Features

- **Multi-Batch Private Placement Reuse & Active-Only Site Guard (v37.0.0)**: One property can now be saved and enriched independently across unlimited regular folders and 4-digit private placement batches without triggering false "Already Published" / "Already on site" blocks; only `status = 'active'` public listings display `✓ Live on Site`.
- **Zero-Tab Zillow Search-Card & Favorites Bulk Save (v36.0.0)**: Save directly from Zillow search grids **and** Zillow Favorites / Saved Homes (`/myzillow/favorites`, `/saved-homes`, `/myzillow/lists`, `/favorites`). Detects true Favorites count including off-screen paginated homes (`?p=2..`), injects `+ Save` pills even on cards omitting `data-testid="property-card"`, hydrates full HDP details at adaptive concurrency (`4` desktop / `2` mobile with dynamic backoff), enforces strict lossless HDP quality before saving, flushes micro-batched `import_batch` uploads (`10` items per call) with automatic per-item fallback, and tracks any failed item in an explicit HUD Retry panel so zero properties fail silently.
- **Universal Drag Anywhere on Screen**: Both the listing page widget (expanded header & minimized pill) and the search/Favorites HUD (expanded header & minimized pill) smoothly drag anywhere on desktop (mouse) and mobile (touch) with `localStorage` position persistence and automatic viewport clamping.
- **Instant 0ms SPA Mount**: Detects client-side navigations and transitions immediately without lag.
- **Smart Pre-Flight HUD**:
  - Shows the detected photo count (green badge for 4+ photos, red warning indicator under 4); properties with 4 or more photos resolve cleanly via Tier-1 extraction and save without photo-count blocking.
  - Exact detected photo total shown for the current listing (no ambiguous `+N` remainder).
  - Mini photo thumbnail ribbon for instant visual preview.
  - Detected architectural structure tag (`DUPLEX`, `SINGLE_FAMILY`, etc.) for review.
  - Complete policy overview (Deposit 1x Rent, $50 App Fee).
- **Dual Ingestion & REST Fallback**: Dual-layer saving via Supabase Edge Function with seamless direct REST API fallback to eliminate any "unsupported source" or network interruptions.
- **Compact Folder Pill & Auto-Collapsing Popover**: Minimal 1-line folder pill above the Save button opens an on-demand popover to switch regular folders or `📦 Batch #XXXX` disposable batch folders, or create a new folder directly on Zillow, auto-collapsing immediately once configured.
- **Sticky Default Folder Persistence & Scoped Dedup**: Any folder or 4-digit batch selected automatically becomes the persistent default target for subsequent 1-click "Save to Pipeline" imports until changed, with intra-batch duplicate checking scoped cleanly per active batch or inbox.
- **Global Keyboard Shortcut**: Press `Cmd+Shift+S` (or `Ctrl+Shift+S`) to save immediately from anywhere on the page.
- **Resilient Auto-Retry Background Worker**: Automatically retries with exponential backoff on transient network drops to guarantee zero dropped listings.
- **Rule Compliance Enforced**:
  - **Rule 6A Zero Truncation**: Fractional baths (`1.5`, `2.5`, `3.5`) are never rounded down.
  - **Rule 6B Architectural Classification**: Side-by-side attached units and 1/2 duplexes are auto-classified as `DUPLEX`.
  - **Strict Stripping**: Never outputs lease duration or smoking policies.
- **Direct Edge Ingestion**: Sends data securely to the `receive-pipeline-import` Supabase Edge Function with auto deduplication.
- **SPA Listing Safety**: Re-reads the active listing before saving so replacing a property in the same tab cannot submit the previous property's data.
- **Source-Fact Accuracy**: Zillow estimates are not substituted for asking rent, and unavailable, lease-term, and smoking-policy fields are omitted from imports. Unknown feature facts stay unknown; generic cooling/window units do not imply central air, while explicit "No basement" wording is captured as false.
- **Location Intelligence Integration**: Property pages can load cached, server-side Geoapify nearby places and approximate neighborhood context. Details are documented in [`docs/LOCATION_ENRICHMENT.md`](../docs/LOCATION_ENRICHMENT.md); no school ratings, attendance boundaries, or walk/travel times are inferred.

---

## Installation

### Method A: Install ZIP in Developer Mode
1. Download `choice-properties-extension.zip` from [Choice Properties Site](https://choice-properties-site.pages.dev/choice-properties-extension.zip).
2. Unzip to a local folder.
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the unzipped `chrome-extension` folder.

---

## Development & Build Workflow

Whenever making modifications to the extension:
1. Edit the source extractor definitions in `src/extractors/shared-extractors.js` or `chrome-extension/content.js`.
2. Run the automated sync and bump tool:
   ```bash
   node scripts/sync-and-bump-extension.mjs
   ```
3. Verify test suite:
   - Compiles all 3 variants (`chrome-extension`, `.pages-orion`, `supabase/functions`).
   - Executes 20 automated test cases.
   - Bumps version and updates `extension-meta.json` and `public/choice-properties-extension.zip`.
4. Record all changes in `docs/EXTENSION_CHANGELOG.md`.
