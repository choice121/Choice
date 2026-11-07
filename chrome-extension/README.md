# Choice Properties — Universal Chrome Extension (v54.0.0)

A browser extension that allows Choice Properties agents to save rental listings directly from **8 major rental portals** into the Choice Properties staging pipeline with 1 click.

---

## Supported Portals (8 Total)

| Platform | URL Patterns Supported | Extraction Method |
| :--- | :--- | :--- |
| **Zillow** | `zillow.com/homedetails/*`, `zillow.com/b/*`, `zillow.com/apartments/*` | `__NEXT_DATA__` + `gdpClientCache` + JSON-LD + rendered unit rows |
| **Realtor.com** | `realtor.com/realestateandhomes-detail/*` | `__NEXT_DATA__` (`pageProps.initialState`) |
| **Apartments.com** | `apartments.com/*` | Microdata / JSON-LD + Dynamic DOM Table |
| **Redfin** | `redfin.com/*` | `__NEXT_DATA__` + `reactServerState` |
| **Opendoor** | `opendoor.com/properties/*`, `opendoor.com/homes/*` | React Query Dehydrated State + Script Scanner + Slug Parser + DOM |
| **Progress Residential** | `rentprogress.com/houses-for-rent/*`, `rentprogress.com/homes/*` | Hydrated State (`pageProps.property`) + Script Scanner + Fastly CDN |
| **CJ Real Estate** | `cjproperties.org/*`, `cjrealestate.com/*`, `appfolio.com/*` | AppFolio Schema + high-res s3 galleries |
| **Invitation Homes** | `invitationhomes.com/property/*`, `invitationhomes.com/homes-for-rent/*` | JSON-LD + server-rendered Svelte DOM |

---

## Features

- **Instant 0ms SPA Mount**: Detects client-side navigations and transitions immediately without lag.
- **Smart Pre-Flight HUD**:
  - Shows the detected photo count; listings are not blocked based on photo count.
  - Exact detected photo total shown for the current listing (no ambiguous `+N` remainder).
  - Mini photo thumbnail ribbon for instant visual preview.
  - Detected architectural structure tag (`DUPLEX`, `SINGLE_FAMILY`, etc.) for review.
  - Unit-option and video/tour/floor-plan counts for multifamily communities.
  - Deposit and application-fee defaults; pet policies are not imported or displayed.
- **Zillow Community Listings**:
  - Preserves valid, distinct available-unit rows with unit number, bed/bath count, square footage, and listed rent; prose labels are rejected.
  - Captures floor-plan starting prices separately from unit-specific rents.
  - Preserves Zillow's explicit unit price label (`Base rent` or `Total monthly price`); unknown labels stay unclassified.
  - Leaves community-level rent, beds, baths, and square footage blank rather than copying the first unit's facts.
  - Shows separate available-unit, floor-plan, total-building-unit, story, source price-range, and deduplicated-photo counts in the widget and pipeline review panel.
  - Preserves the community name, multi-unit flag, reported unit count, building stories, and source price range in the pipeline record.
  - Stores the unit breakdown in the pipeline record's existing `original_data` field without requiring staging-schema changes. Publishing writes normalized inventory to `properties.unit_options` and floor plans to `property_media`; apply `supabase/migrations/20261106000002_property_unit_options.sql` before publishing communities.
  - Community imports remain review-only because the current publishing flow requires one individual rental unit.
- **Zillow Media**: Collects ordered photo URLs, video sources/posters, 3D tours, and floor-plan links from structured and rendered page content.
- **Authenticated Background Saves**: A Choice administrator signs in from the extension popup; imports use a verified bearer token through the background worker, and transient network failures can be queued for retry. The content script never sends a shared import secret or bypasses the authenticated worker.
- **Compact Folder Pill & Auto-Collapsing Popover**: Minimal 1-line folder pill above the Save button opens an on-demand popover to switch folders or create a new folder (with any name, including numbers, and optional description) directly on Zillow, auto-collapsing immediately once configured.
- **Sticky Default Folder Persistence**: Any folder created or selected automatically becomes the persistent default folder for all subsequent 1-click "Save to Pipeline" imports until changed.
- **Global Keyboard Shortcut**: Press `Cmd+Shift+S` (or `Ctrl+Shift+S`) to save immediately from anywhere on the page.
- **Resilient Auto-Retry Background Worker**: Automatically retries with exponential backoff on transient network drops to guarantee zero dropped listings.
- **Rule Compliance Enforced**:
  - **Rule 6A Zero Truncation**: Fractional baths (`1.5`, `2.5`, `3.5`) are never rounded down.
  - **Rule 6B Architectural Classification**: Side-by-side attached units and 1/2 duplexes are auto-classified as `DUPLEX`.
  - **Strict Stripping**: Never outputs lease duration or smoking policies.
- **Direct Edge Ingestion**: Sends staged listing data to the `receive-pipeline-import` Supabase Edge Function with auto deduplication.
- **SPA Listing Safety**: Re-reads the active listing before saving so replacing a property in the same tab cannot submit the previous property's data.
- **Opt-in Extraction Diagnostics**: The "Run & Send Diagnostics" button uploads extracted property facts, unit options, extractor status, and bounded page-structure counts—including candidate floor-plan card counts—to the admin inbox at `/admin/extension-diagnostics.html`. Reports exclude cookies, session data, descriptions, contact details, exception text, raw stack traces, and raw page HTML; safe extension file/line locations are included for extractor failures. Reports expire after 30 days.
- **Apartment Community Review**: Community-level apartment imports retain building facts, unit/floor-plan options, rent labels, and floor-plan media in the existing `original_data` field. The pipeline review panel shows that inventory and blocks publishing a community overview as if it were one rental unit.
- **Reliable Background Requests**: Fix service-worker startup in Chrome and bound import/diagnostic requests so a failed background response produces a visible error instead of an indefinite spinner.
- **Zillow Gallery Reference**: The popup can capture measured gallery image/container geometry, a small allowlist of computed layout styles, and visible photo-control labels from a Zillow page. It never uploads image URLs or bytes, full page text/HTML, cookies, or browser history. Saving requires a Choice admin sign-in and creates a durable report with a random read-only link; anyone with that link can read the minimized report.
- **Admin session management**: The extension stores a rotating Supabase refresh token in browser extension storage, never the password. Disconnect from the popup to remove the token.
- **Resilient Zillow JSON-LD Fallback**: Ignore malformed optional JSON-LD when primary listing data was extracted, and handle schema.org `@type` values supplied as strings or arrays.
- **Source-Fact Accuracy**: Zillow estimates are not substituted for asking rent, and unavailable, lease-term, and smoking-policy fields are omitted from imports. Unknown feature facts stay unknown; generic cooling/window units do not imply central air, while explicit "No basement" wording is captured as false.
- **Location Intelligence Integration**: Property pages can load cached, server-side Geoapify nearby places and approximate neighborhood context. Details are documented in [`docs/LOCATION_ENRICHMENT.md`](../docs/LOCATION_ENRICHMENT.md); no school ratings, attendance boundaries, or walk/travel times are inferred.

---

## Installation

### Method A: Install ZIP in Developer Mode
1. Download `choice-properties-extension.zip` from [Choice Properties Site](https://choice-properties-site.pages.dev/choice-properties-extension.zip).
2. Unzip to a local folder.
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
6. Open the extension popup and sign in with a Choice administrator account before saving listings.

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
   - Executes the extractor regression suite.
   - Bumps version and updates `extension-meta.json` and `public/choice-properties-extension.zip`.
4. Record all changes in `docs/EXTENSION_CHANGELOG.md`.

### Save a Zillow gallery reference
1. Apply migration `20261105000001_zillow_gallery_reference_reports.sql` and deploy the `zillow-gallery-reference` Edge Function.
2. Load or update the extension in Chrome, then open a Zillow listing and click its toolbar icon.
3. Connect with a Choice admin account. The extension stores only the Supabase refresh token in this browser; it does not retain the password.
4. Click **Capture this Zillow gallery state**. To record the full-screen photo view, open a photo on Zillow and click capture again.
5. Copy the generated report link and share it in the future conversation where you want the reference used. A click cannot deliver data directly into a separate assistant chat.

Submitted reports can be reviewed at `/admin/extension-diagnostics.html` by an authenticated admin.
