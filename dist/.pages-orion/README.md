# Import to Choice Properties — Orion Extension

One-click listing to Pipeline importer for **Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, and CJ Real Estate**.

The Orion build uses bundled UI and extractor files from this directory, so the importer remains available when a remote script cannot load.

## How it works

When you open any supported listing detail page, the extension injects a purple **"Save to Pipeline"** button in the bottom-right corner. Click it and the listing — every field and every photo — is sent directly to your Choice Properties pipeline.

**Why it never gets blocked:** The extension reads the page's embedded JSON (`__NEXT_DATA__` / Redux state) directly from the already-loaded page (same data your browser is already displaying). No outbound fetch to the listing site, no datacenter IP, nothing to block.

## Features

- **Multi-site support** — Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, and CJ Real Estate (per-site extractors in `shared-extractors.js`)
- **Offline queue** — if the pipeline is unreachable, the listing is queued in `chrome.storage.local` and auto-synced when back online (badge shows amber count; "Sync now" button in popup)
- **Settings** — enable/disable Download-to-PC and Offline queue from the popup

---

## Install (takes ~30 seconds)

### Step 1 — Generate icons (one time only)

```bash
cd .pages-orion
node generate-icons.js
```

This creates `icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`.

### Step 2 — Load into the browser

1. Open the browser's extension manager
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `.pages-orion/` folder from this project
5. Done ✓

The extension icon appears in your Chrome toolbar.

### Step 3 — Use it

1. Browse to any supported listing detail page
   *(Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, or CJ Real Estate)*
2. Click the purple **↓ Save to Pipeline** button (bottom-right corner)
3. Button turns green: "✓ Saved! 24 photos · San Francisco · Q:88/100"
4. Open your [admin pipeline](https://choice-properties-site.pages.dev/admin/pipeline.html) to review and publish

---

## What gets captured

| Field | Source |
|---|---|
| Address, city, state, ZIP | `address` object |
| Lat / lng | `latitude`, `longitude` |
| Rent, deposit, fees | `price`, `resoFacts.*` |
| Beds, baths, sqft, lot, year built | Direct fields |
| Property type | `homeType` → normalized |
| Available date | `resoFacts.dateAvailable` |
| Description | `description` |
| Pets, smoking policy | `isPetFriendly`, `resoFacts.petsAllowed` |
| HVAC, laundry, parking | `resoFacts.heating/cooling/laundry/parking` |
| Appliances, amenities, utilities | `resoFacts.appliances/communityFeatures/…` |
| Walk / transit / bike scores | `walkScore`, `transitScore`, `bikeScore` |
| Virtual tour URL | `virtualTourUrl` |
| All photos (up to 50) | `responsivePhotosOriginalRatio` (full-res JPEG) |
| Agent / broker name | `attributionInfo` |

Photos are stored as source URLs and transferred to ImageKit automatically when you publish the listing from the pipeline.

---

## Updating

The extension lives in this repo under `.pages-orion/`. To update:

1. Edit `live-content.js`, `content.js`, or `content.css`
2. Reload the extension from the browser's extension manager
3. Reload any open listing tabs

No reinstall needed for code changes — just refresh.

---

## Works on

- Orion-compatible browser builds with Manifest V3 support
- Chromium-based browsers should use the main `chrome-extension/` package

---

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension config (MV3) |
| `shared-extractors.js` | Multi-site extractor registry (Zillow, Realtor, Apartments, Redfin) |
| `content.js` | Extension bridge for photo downloads and bundled runtime startup |
| `live-content.js` | Injected UI, save flow, retry handling, and photo upload progress |
| `content.css` | Floating button styles |
| `background.js` | Service worker — session count, offline queue flush, badge |
| `popup.html` / `popup.js` | Toolbar popup — session count, queue status, settings toggles |
| `test-extractors.js` | Node test harness for the extractor registry |
| `generate-icons.js` | One-time icon generator (pure Node.js, no deps) |
| `icons/` | Generated PNG icons (16 / 32 / 48 / 128 px) |
