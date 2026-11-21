# Choice Properties — Manual Browser Extensions Documentation (Chrome & Orion)

> **Status:** Active, Permanent Operational Channel (Coexists Side-by-Side with Apify Automated Scraping)  
> **Current Extension Version:** `v34.0.1`  
> **Packages:**  
> - **Desktop Chromium:** `chrome-extension/` (`choice-properties-extension.zip`)  
> - **Mobile iOS/macOS Orion:** `.pages-orion/` (`choice-properties-orion-extension.zip`)  

---

## 1. Purpose & Coexistence Policy

The Choice Properties Manual Browser Extensions provide **1-click human/agent-driven listing capture** directly from live browser tabs across **8 major rental portals**.

**Permanent Coexistence Guarantee:**
- The **Manual Browser Extensions** (Chrome Desktop + Orion Mobile) and the **Apify Automated Scraping Pipeline** are **parallel, equal-status intake channels** feeding the same canonical staging table (`pipeline.pipeline_properties`) through the same shared record builder (`supabase/functions/_shared/pipeline-record.ts`).
- The operator may freely choose **either** Apify automated scraping **or** manual browser extension capture for any listing, folder, or 4-digit batch.
- Enhancements to Apify scraping, batch folders, validation, enrichment, pricing, or publishing **must never disable, remove, or degrade** the manual extensions.

---

## 2. Supported Portals (8 Total)

| Portal | Supported URL Patterns | Primary Extraction Mechanism |
|---|---|---|
| **Zillow** | `zillow.com/homedetails/*`, `zillow.com/homes/*_zpid`, `zillow.com/b/*`, `zillow.com/community/*`, `zillow.com/apartments/*` | `__NEXT_DATA__` -> `gdpClientCache` / `componentProps.homeDetails` + `resoFacts` + `attributionInfo` + JSON-LD + Tier-1 photos at 4+ images |
| **Realtor.com** | `realtor.com/realestateandhomes-detail/*` | `__NEXT_DATA__` (`pageProps.initialState`) + DOM fallbacks |
| **Apartments.com** | `apartments.com/*/*` | JSON-LD / Microdata + Dynamic DOM tables |
| **Redfin** | `redfin.com/*/*/*/*` | `__NEXT_DATA__` + `reactServerState` |
| **Opendoor** | `opendoor.com/properties/*`, `opendoor.com/homes/*`, `opendoor.com/listings/*` | React Query `dehydratedState` + Script Scanner + URL Slug Parser + DOM |
| **Progress Residential** | `rentprogress.com/houses-for-rent/*`, `rentprogress.com/homes/*`, `rentprogress.com/property-details/*` | Hydrated `pageProps.property` + AEM gallery + Fastly CDN |
| **CJ Real Estate** | `cjproperties.org/*`, `cjrealestate.com/*`, `appfolio.com/*` | AppFolio schema + S3 high-res galleries |
| **Invitation Homes** | `invitationhomes.com/property/*`, `invitationhomes.com/homes-for-rent/*`, `invitationhomes.com/houses-for-rent/*` | JSON-LD + Svelte-rendered DOM + Cloudinary galleries |

---

## 3. File Architecture & Canonical Build Chain

```
src/extractors/shared-extractors.js   <-- SINGLE CANONICAL SOURCE OF TRUTH
          │
          ▼  (node scripts/build-extractors.js)
          ├──▶ chrome-extension/shared-extractors.js     (Desktop Browser IIFE)
          ├──▶ .pages-orion/live-shared-extractors.js    (Orion Live-Loaded IIFE)
          ├──▶ .pages-orion/shared-extractors.js         (Orion Bundled Fallback IIFE)
          └──▶ supabase/functions/_shared/zillow-extract.ts (Edge URL Importer)
```

### Key Extension Files

| Path | Responsibility |
|---|---|
| `src/extractors/shared-extractors.js` | Canonical multi-portal DOM / JSON extractor registry |
| `chrome-extension/manifest.json` | MV3 manifest (`storage`, `tabs`, host permissions for 8 portals + Supabase + Pages) |
| `chrome-extension/config.js` | Runtime endpoints (`EDGE_URL`, extension config, `VERSION`) |
| `chrome-extension/content.js` | Desktop floating Pre-Flight HUD, SPA history observer, compact Folder/Batch pill, `⌘⇧S` / `Ctrl+Shift+S` shortcut, `save_nonce` generation, `CHECK_LISTING` pre-flight check |
| `chrome-extension/background.js` | MV3 Service Worker: edge POST (`22s` timeout), offline queue (`cp_queue`, max 75 items, exponential backoff), `LIST_FOLDERS`, `CREATE_FOLDER`, `CHECK_LISTING`, `GET/SET_DEFAULT_FOLDER`, daily badge counter |
| `chrome-extension/popup.html`, `popup.js` | Toolbar popup: current tab support indicator, session save count, pending offline queue flush/export, live cloud version check (`extension-meta.json`) |
| `.pages-orion/content.js` & `.pages-orion/live-content.js` | Orion iOS/macOS mobile compact bar + full panel fallback, bundled runtime + Cloudflare live-loader compatibility |
| `.pages-orion/background.js` | Orion-compatible worker (`chrome`/`browser` polyfill, `chrome.storage.local` date-keyed session count fallback) |
| `scripts/sync-and-bump-extension.mjs` | Automated version bump, extractor compilation, manifest/HTML/README sync, ZIP packaging (`public/choice-properties-extension.zip`, `public/choice-properties-orion-extension.zip`), `extension-meta.json`, `extension-updates.xml`, and automated test runner |
| `scripts/validate-extension.mjs` | Package parity, syntax, manifest, and archive validator |

---

## 4. End-to-End Manual Save Workflow

1. **Page Detection & Pre-Flight Hydration (`0ms` SPA Mount)**:
   - Hooks `history.pushState` / `replaceState` plus debounced `MutationObserver` + mobile URL polling (`LISTING_REFRESH_DELAY`).
   - Runs `CP_Extractors.extract(location.href, document)` and renders the Pre-Flight HUD (address, rent, beds/baths, sqft, architectural type tag, and photo count badge: green when `>= 4` photos, warning when `< 4` without blocking save).
2. **Pre-Flight Pipeline Check (`CHECK_LISTING`)**:
   - Sends non-blocking `GET ?action=check_listing&source=...&source_listing_id=...` to `receive-pipeline-import`.
   - If already staged, immediately displays `In Pipeline ✓` with folder/status metadata and an `Open Pipeline ↗` link.
3. **Target Folder / Batch Selection**:
   - Compact 1-line **Folder Pill** above the Save button lists active folders (`LIST_FOLDERS`) and allows instant inline creation (`CREATE_FOLDER`), including numeric 4-digit batch names (e.g., `4821`).
   - Selected folder persists as sticky default across saves (`cp_default_folder`).
4. **Idempotent Submission (`Save to Pipeline`)**:
   - Re-extracts live DOM/cache state right before submit to prevent stale cross-navigation payloads.
   - Generates a unique per-click `save_nonce` inside `field_provenance.save_nonce`.
   - Dispatches `UPLOAD_PAYLOAD` through `background.js` (18s bridge wait / 22s fetch timeout), falling back cleanly to direct fetch or offline queue (`cp_queue`) on transient failure.
   - `receive-pipeline-import` stores raw payload JSON into Supabase Storage bucket `pipeline-raw-payloads`, assigns next `folder_serial`, applies `buildPipelineRecord()` (`pipeline-record.ts`) + Geoapify reverse-geocode enrichment (`2.5s` timeout), and inserts into `pipeline.pipeline_properties` with Direct Source CDN photo URLs (`photo_import_status = 'completed'`, `photo_upload_status = 'complete'`).
   - Duplicate retry handling: if a fallback retry carries the same `save_nonce` as the already-inserted record, the server returns `{ ok: true, deduped_retry: true }` cleanly instead of flagging a false duplicate.

---

## 5. Known Nuances & Evolution Integration Rules

1. **Photo Cap Alignment (`v34.0.1`)**: `chrome-extension/background.js`, `.pages-orion/background.js`, `chrome-extension/content.js`, and canonical Zillow extraction are all aligned at `MAX_PHOTOS = 50` on desktop (`25` on mobile) so full-gallery captures flow seamlessly without worker cap discrepancies.
2. **Batch Scope Compatibility**: As the 4-digit batch & disposable folder architecture rolls out, the extension continues to support both:
   - Selecting an existing **4-digit Batch Folder** (e.g., `4821`) or standard folder in the Folder Pill (`folder_id` / `folder_name` + `batch_id`).
   - Intra-batch deduplication (`(batch_id, source, source_listing_id)`), allowing a manually saved ZPID to appear in Batch `4821` even if previously used in Batch `1905`, while still warning on duplicate within the SAME active batch/folder.
3. **Rule Preservation**: All manual captures preserve `original_description`, fractional bathrooms (Rule 6A), architectural classification (`DUPLEX`, `TOWNHOUSE`, `SINGLE_FAMILY`, `APARTMENT`), strict original photo order, Direct Source CDN URLs, and lossless `source_raw_payload` / `field_provenance` / `structural_details` / `utility_details` / `financial_details` / `location_details`.

---

## 6. Mandatory Extension Modification & Release Protocol

Per `AGENTS.md` §6, **whenever ANY file in `src/extractors/`, `chrome-extension/`, or `.pages-orion/` is modified**:

1. Edit the canonical source (`src/extractors/shared-extractors.js`, `chrome-extension/content.js`, or `.pages-orion/live-content.js`) — never edit generated `shared-extractors.js` bundles directly.
2. Run:
   ```bash
   node scripts/sync-and-bump-extension.mjs
   ```
   (or `--minor` / `--patch` as appropriate). This script:
   - Synchronizes `manifest.json` across `chrome-extension/`, `.pages-orion/`, and root `manifest.json`.
   - Rebuilds all 4 generated extractor variants via `scripts/build-extractors.js`.
   - Updates `extension-meta.json`, `public/extension-meta.json`, `extension-updates.xml`, `public/extension-updates.xml`, ZIP archives, and README version headers.
   - Executes `node chrome-extension/test-extractors.js` and `node scripts/validate-extension.mjs`.
3. Also run `.pages-orion/test-extractors.js` and `npm run build` (`generate-config.js` + `copy-static-to-dist.js`).
4. Document the version bump in `chrome-extension/README.md` and `docs/EXTENSION_CHANGELOG.md`.
5. Push to GitHub `main`; Cloudflare Pages serves updated ZIPs and metadata immediately with `no-cache, no-store, must-revalidate, max-age=0` headers (`/_headers`).

---

## 7. Quick Verification Checklist for AI Agents Touching Extension Code

- [ ] `node chrome-extension/test-extractors.js` passes all cases.
- [ ] `node .pages-orion/test-extractors.js` passes all cases.
- [ ] `node scripts/validate-extension.mjs` exits `0`.
- [ ] `extension-meta.json`, `chrome-extension/manifest.json`, and `.pages-orion/manifest.json` share the exact same semver.
- [ ] Live `receive-pipeline-import` handles `action=list_folders`, `action=create_folder`, `action=check_listing`, `save_nonce` idempotent retry, and new listing staging without regression.
