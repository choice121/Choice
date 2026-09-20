# Choice Properties — Universal Chrome Extension (v12.0.0)

A browser extension that allows Choice Properties agents to save rental listings directly from **7 major rental portals** into the Choice Properties staging pipeline with 1 click.

---

## Supported Portals (7 Total)

| Platform | URL Patterns Supported | Extraction Method |
| :--- | :--- | :--- |
| **Zillow** | `zillow.com/homedetails/*`, `zillow.com/b/*` | `__NEXT_DATA__` + `gdpClientCache` + JSON-LD |
| **Realtor.com** | `realtor.com/realestateandhomes-detail/*` | `__NEXT_DATA__` (`pageProps.initialState`) |
| **Apartments.com** | `apartments.com/*` | Microdata / JSON-LD + Dynamic DOM Table |
| **Redfin** | `redfin.com/*` | `__NEXT_DATA__` + `reactServerState` |
| **Opendoor** | `opendoor.com/homes/*` | Hydrated State (`pageProps.home`) + DOM |
| **Progress Residential** | `rentprogress.com/houses-for-rent/*` | Hydrated State (`pageProps.property`) + Fastly CDN |
| **CJ Real Estate** | `cjproperties.org/*`, `appfolio.com/*` | AppFolio Schema + high-res s3 galleries |

---

## Features

- **1-Click Staging**: Floating on-page widget appears automatically on supported property detail pages.
- **Dynamic Folder Selection**: Choose an active pipeline folder (e.g. *Columbus SFRs*, *Short-Term Duplexes*) before saving.
- **Strict Compliance Enforcement**:
  - **Rule 6A Zero Truncation**: Fractional baths (`1.5`, `2.5`, `3.5`) are never rounded down.
  - **Rule 6B Architectural Classification**: Attached side-by-side units and 1/2 duplexes are auto-classified as `DUPLEX`.
  - **Fee & Policy Normalization**: Automatically assigns $50 application fee, pet-friendly status, and omits lease terms / smoking policies.
- **High-Resolution Photography**: Pulls uncropped full-res source photos (up to 1536px) directly from application cache states.
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
1. Edit the source extractor definitions in `src/extractors/shared-extractors.js`.
2. Run the automated sync and bump tool:
   ```bash
   node scripts/sync-and-bump-extension.mjs
   ```
3. Verify test suite:
   - Compiles all 3 variants (`chrome-extension`, `.pages-orion`, `supabase/functions`).
   - Executes 20 automated test cases.
   - Bumps version and updates `extension-meta.json` and `public/choice-properties-extension.zip`.
4. Record all changes in `docs/EXTENSION_CHANGELOG.md`.
