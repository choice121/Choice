# Import to Choice Properties — Orion Extension

One-click listing to Pipeline importer for **Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, CJ Real Estate, and Invitation Homes**.

The Orion build uses bundled UI and extractor files from this directory, so the importer remains available when a remote script cannot load.

## One-tap mobile save — v28.0.6 (2026-10-16)

On phones, the importer opens as a compact property-and-rent bar with a touch-friendly **Save** action. You do not need to open the full panel or refresh Zillow before saving. Failed saves expand the panel and offer a retry action.

The extension checks for single-page property navigation at a short interval and updates the compact summary when the same listing finishes loading more facts. Before saving, it checks that the listing ID and address are available and retries extraction briefly; it will not send the previous listing after a Zillow navigation.

Listing data and photos are sent as source facts and source CDN URLs. The mobile content script does not download, base64-encode, optimize, or re-upload listing photos; their source order is preserved, with the first photo remaining first. This avoids making photo processing part of the save tap.

### Mobile save and troubleshooting

1. Open a supported property detail page. The compact Choice bar should appear without a manual refresh.
2. Check the displayed address and rent, then tap **Save**.
3. Wait for **Saved**, **Queued**, or a duplicate result. If saving fails, the panel expands with an error and a **Retry** action.
4. If the listing is still loading, wait for the page facts to appear and tap **Retry**. If the property changed, the extension refreshes its summary and requires a save for the current listing.
5. Open the [admin pipeline](https://choice-properties-site.pages.dev/admin/pipeline.html) to confirm the staged record.

The extension first asks its background worker to save. If that message bridge does not respond, it tries the import endpoint directly. A network outage can be queued for later synchronization; a server validation error is shown for correction rather than reported as a successful save.

### v28.0.6 verification

The automated browser test in `tests/visual/orion-mobile-widget.spec.js` simulates an iPhone viewport and Zillow single-page navigation, checks that the compact bar updates without a reload, and verifies that one tap submits the new listing's ID, address, and rent. This test uses a mocked import endpoint; it does not replace testing the installed extension on a physical iPhone in Orion.

## How it works

When you open any supported listing detail page, the extension injects a purple **"Save to Pipeline"** button in the bottom-right corner. Click it to send the fields the extractor can verify from the page and the source photo URLs to your Choice Properties pipeline.

**Why it never gets blocked:** The extension reads the page's embedded JSON (`__NEXT_DATA__` / Redux state) directly from the already-loaded page (same data your browser is already displaying). No outbound fetch to the listing site, no datacenter IP, nothing to block.

## Latest data-accuracy update — v28.0.2 (2026-10-15 23:33 UTC)

Zillow's generic cooling flags and window units are not treated as central air, explicit "No basement" facts are retained as false, and missing feature facts remain unknown. The release covers Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, CJ Real Estate, and Invitation Homes.

## Location enrichment integration — v28.0.3 (2026-10-15 23:49 UTC)

The shared property details experience can now display cached Geoapify nearby-place results and approximate neighborhood context through a Supabase Edge Function. It does not infer school ratings, attendance boundaries, Walk Score, or route times. See [`docs/LOCATION_ENRICHMENT.md`](../docs/LOCATION_ENRICHMENT.md) for the source, cache, and deployment details.

## Features

- **Multi-site support** — Zillow, Realtor.com, Apartments.com, Redfin, Opendoor, Progress Residential, CJ Real Estate, and Invitation Homes (per-site extractors in `shared-extractors.js`)
- **Offline queue** — if a network failure prevents a save, the listing can be queued in extension local storage and retried when connectivity returns
- **Settings** — enable/disable Download-to-PC and Offline queue from the popup

---

## Install on Orion for iPhone

Download the packaged Orion build:

[choice-properties-orion-extension.zip](https://choice-properties-site.pages.dev/choice-properties-orion-extension.zip)

Install or enable the ZIP using Orion's extension manager, then reload the listing tab so the new content script is active. Orion's exact install prompts can vary by app version. Chromium desktop users should install the separate `chrome-extension/` package instead.

---

## What gets captured

| Field | Source |
|---|---|
| Address, city, state, ZIP | `address` object |
| Lat / lng | `latitude`, `longitude` |
| Rent, deposit, fees | `price`, `resoFacts.*` |
| Beds, baths, sqft, lot, year built | Direct fields |
| Property type | `homeType` → normalized |
| Description | `description` |
| Pets | Choice policy: pet-friendly |
| HVAC, laundry, parking | `resoFacts.heating/cooling/laundry/parking` |
| Appliances, amenities, utilities | `resoFacts.appliances/communityFeatures/…` |
| Walk / transit / bike scores | `walkScore`, `transitScore`, `bikeScore` |
| Availability, lease terms, smoking policy | Intentionally omitted |
| Virtual tour URL | `virtualTourUrl` |
| All photos (up to 50) | `responsivePhotosOriginalRatio` (full-res JPEG) |
| Agent / broker name | `attributionInfo` |

Photos retain their source URLs and original order through publication; the first source photo remains the hero image.

---

## Updating

For an installed Orion package, download the latest ZIP above and update/reload it using Orion's extension manager. For repository development:

1. Edit the canonical extractor in `src/extractors/shared-extractors.js`, or Orion UI files in `.pages-orion/`.
2. Run `node scripts/sync-and-bump-extension.mjs --patch` to rebuild synchronized artifacts and packages.
3. Run `node .pages-orion/test-extractors.js`, `node scripts/validate-extension.mjs`, and `npx playwright test tests/visual/orion-mobile-widget.spec.js`.
4. Reload the updated extension and reload open listing tabs.

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
| `live-content.js` | Injected mobile UI, listing navigation detection, save flow, and retry handling |
| `content.css` | Floating button styles |
| `background.js` | Service worker — session count, offline queue flush, badge |
| `popup.html` / `popup.js` | Toolbar popup — session count, queue status, settings toggles |
| `test-extractors.js` | Node test harness for the extractor registry |
| `generate-icons.js` | One-time icon generator (pure Node.js, no deps) |
| `icons/` | Generated PNG icons (16 / 32 / 48 / 128 px) |
