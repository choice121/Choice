# Choice Properties — ImageKit Integration & Storage Architecture

## 1. Overview
Choice Properties utilizes ImageKit as its authoritative, optimized CDN for all property photographs across the marketplace. This prevents hotlink expiration (from Zillow, Realtor, or local MLS CDNs), improves page load speeds via WebP compression, and ensures consistent asset management.

---

## 2. Storage Metrics & Capacity Analysis (Live Telemetry)

As of September 2026, live telemetry from the ImageKit API (`/v1/accounts/usage`) and Supabase database confirms the following metrics:

| Metric | Current Value | Notes |
|---|---|---|
| **ImageKit Plan Tier** | **Free Forever Tier** | Default tier |
| **Storage Quota** | **20.00 GB** | 20,000,000,000 bytes |
| **Media Library Storage Used** | **2.70 GB** (13.5%) | 2,704,796,779 bytes |
| **Free Storage Remaining** | **17.30 GB** (86.5%) | Massive runway |
| **Active ImageKit Photos** | **20,730+ photos** | Completely served via CDN |
| **Average Photo Size** | **127.4 KB** | Optimized WebP |
| **Average Photos / Property** | **~17.8 photos** | Full property galleries |
| **Average Storage / Property** | **~2.21 MB** | 17.8 photos × 127.4 KB |
| **Additional Properties Capacity** | **~7,446 more properties** | 17.30 GB / 2.21 MB per property |

### Key Takeaway
At current usage rates, Choice Properties can onboard **over 7,400 additional properties** (approx. 135,000+ more photos) before exhausting the free ImageKit storage tier. Even migrating all existing properties in the database requires only ~14.25 GB, safely below the 20 GB ceiling.

---

## 3. Scraper Ingestion & Automated Image Handling

### How It Works Automatically
1. **Universal Credential Resolution**:
   Both Python (`scraper/imagekit_upload.py`, `scraper/pipeline.py`) and Node.js (`scripts/migrate_hotlinks_to_imagekit.mjs`) automatically resolve ImageKit secrets from any common alias:
   - `IMAGEKIT_PRIVATE_KEY` or `Imagekitprivate` or `IMAGEKIT_PRIVATE`
   - `IMAGEKIT_URL_ENDPOINT` or `IMAGEKIT_URL` (defaulting to `https://ik.imagekit.io/21rg7lvzo`)

2. **Automatic Pre-Staging Upload**:
   When `python scraper/scraper.py` runs, it calls `imagekit_upload.upload_images()` for every listing before staging:
   - Source images are downloaded concurrently.
   - Files are uploaded to `properties/PP-XXXX` folders on ImageKit.
   - Verified ImageKit CDN URLs are saved into `local_image_paths`.
   - The admin pipeline (`pipeline_publish` RPC) only publishes listings with valid source and ImageKit images.

3. **Edge Function Auto-Transfer**:
   When listings are approved in the Admin Pipeline (`admin/pipeline.html`), the `import-pipeline-photos` Supabase Edge Function automatically transfers source photos to ImageKit if not already done.

4. **Automated Scheduled Shield (`.github/workflows/imagekit-hotlink-shield.yml`)**:
   Runs daily at 04:00 UTC right after daily scraping. It executes `scripts/migrate_hotlinks_to_imagekit.mjs` to automatically detect any stray hotlinked images and migrate them to ImageKit without manual intervention.

---

## 4. Deletion & Orphan Asset Purge (AGENTS.md Rule 4.C)

### Watermark Sniper Deletion Fix
The Watermark Sniper (`js/admin/watermark-sniper.js`) now features a 4-tier resilient cascading deletion engine:
1. **Tier 1**: `window.CP.Properties.deleteCascadeBulk` (authoritative client API).
2. **Tier 2**: `window.CP.Properties.deleteCascade` (per-listing fallback).
3. **Tier 3**: Direct Supabase RPC `delete_properties_cascade`.
4. **Tier 4**: Direct multi-table REST cascading delete (deletes `property_photos`, `saved_properties`, `inquiries`, unlinks `applications`, and deletes `properties`).

When listings are deleted:
- All related `property_photos` rows are retrieved and deleted.
- Asynchronous calls are dispatched to the `imagekit-delete` Edge Function to permanently remove the files from ImageKit storage, preventing orphaned files and saving quota.

---

## 5. Maintenance Commands

- **Run hotlink migration manual wave**:
  ```bash
  node scripts/migrate_hotlinks_to_imagekit.mjs --batch 50
  ```
- **Check live ImageKit storage usage**:
  ```bash
  node -e '/* queries https://api.imagekit.io/v1/accounts/usage */'
  ```
- **Rebuild production dist bundle**:
  ```bash
  npm run build
  ```
