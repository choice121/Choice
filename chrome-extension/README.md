# Choice Properties — Universal Chrome Extension (v18.0.0)

A browser extension that allows Choice Properties agents to save rental listings directly from **7 major rental portals** into the Choice Properties staging pipeline with 1 click.

---

## Supported Portals (7 Total)

| Platform | URL Patterns Supported | Extraction Method |
| :--- | :--- | :--- |
| **Zillow** | `zillow.com/homedetails/*`, `zillow.com/b/*` | `__NEXT_DATA__` + `gdpClientCache` + JSON-LD |
| **Realtor.com** | `realtor.com/realestateandhomes-detail/*` | `__NEXT_DATA__` (`pageProps.initialState`) |
| **Apartments.com** | `apartments.com/*` | Microdata / JSON-LD + Dynamic DOM Table |
| **Redfin** | `redfin.com/*` | `__NEXT_DATA__` + `reactServerState` |
| **Opendoor** | `opendoor.com/properties/*`, `opendoor.com/homes/*` | React Query Dehydrated State + Script Scanner + Slug Parser + DOM |
| **Progress Residential** | `rentprogress.com/houses-for-rent/*`, `rentprogress.com/homes/*` | Hydrated State (`pageProps.property`) + Script Scanner + Fastly CDN |
| **CJ Real Estate** | `cjproperties.org/*`, `appfolio.com/*` | AppFolio Schema + high-res s3 galleries |

---

## Features

- **Instant 0ms SPA Mount**: Detects client-side navigations and transitions immediately without lag.
- **Smart Pre-Flight HUD**:
  - Live photo quality indicators ($\ge 6$ photos verified).
  - Mini photo thumbnail ribbon for instant visual preview.
  - Verified architectural structure tag (`DUPLEX`, `SINGLE_FAMILY`, etc.).
  - Complete policy overview (Deposit 1x Rent, $50 App Fee, Pet Friendly).
- **Dual Ingestion & REST Fallback**: Dual-layer saving via Supabase Edge Function with seamless direct REST API fallback to eliminate any "unsupported source" or network interruptions.
- **Instant Folder Selection**: Fast in-memory cached folder selector loads with 0ms network latency.
- **Global Keyboard Shortcut**: Press `Cmd+Shift+S` (or `Ctrl+Shift+S`) to save immediately from anywhere on the page.
- **Resilient Auto-Retry Background Worker**: Automatically retries with exponential backoff on transient network drops to guarantee zero dropped listings.
- **Rule Compliance Enforced**:
  - **Rule 6A Zero Truncation**: Fractional baths (`1.5`, `2.5`, `3.5`) are never rounded down.
  - **Rule 6B Architectural Classification**: Side-by-side attached units and 1/2 duplexes are auto-classified as `DUPLEX`.
  - **Strict Stripping**: Never outputs lease duration or smoking policies.
- **Direct Edge Ingestion**: Sends data securely to the `receive-pipeline-import` Supabase Edge Function with auto deduplication.

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
