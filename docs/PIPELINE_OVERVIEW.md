# Choice Properties — Pipeline Overview

## What This Document Is

This is the **single source of truth** for understanding how properties get into the Choice Properties pipeline. If you're an AI assistant or a human developer, read this first.

---

## Property Intake Channels

There are **5 active channels** that add properties to `pipeline.pipeline_properties` in Supabase:

| # | Channel | Platforms | Entry Point | When to Use |
|---|---------|-----------|-------------|-------------|
| 1 | **Apify Two-Stage Cloud Pipeline** | Zillow (`maxcopell/zillow-scraper` Stage 1 → `maxcopell/zillow-detail-scraper` Stage 2) | `orchestrate-batch` / `apify-scrape-worker` | Primary operator-triggered bulk sourcing with 3-layer verification |
| 2 | **Legacy Bulk Scraper** | Realtor.com, Zillow, Opendoor | Standalone scraper tooling (deprecated for production batching) | Historical reference only |
| 3 | **Chrome Extension** | Zillow, Realtor.com, Apartments.com, Redfin | `chrome-extension/content.js` | One-off saves from desktop browser |
| 4 | **Orion Extension** (iOS/macOS) | Same 4 sites | `.pages-orion/` (live-loaded from Cloudflare) | One-off saves from iPhone/iPad |
| 5 | **Admin "Import URL" Button** | Zillow only | `js/admin/pipeline.js` → `supabase/functions/import-from-url/index.ts` | Desktop admin panel paste-URL import |

### Removed Channels (as of Aug 2026)

| Channel | Reason Removed |
|---------|---------------|
| iOS Scriptable (`shortcuts/`) | Not used — Orion extension + PWA cover this |
| PWA Import (`import/`) | Not used — Admin panel + extension cover this |
| Bookmarklet (`bookmarklet.js`) | Not used — extension covers this |

> **Full Apify Architecture & 6-Phase Spec:** See [`docs/APIFY_AUTOMATED_SCRAPING_GUIDE.md`](./APIFY_AUTOMATED_SCRAPING_GUIDE.md) and [`docs/APIFY_EXTRACTION_UPGRADE_AUDIT_AND_ROADMAP.md`](./APIFY_EXTRACTION_UPGRADE_AUDIT_AND_ROADMAP.md).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROPERTY INTAKE CHANNELS                      │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Python Scraper │  Chrome/Orion   │  Admin Import URL           │
│  (bulk)         │  Extension      │  (single URL)               │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    pipeline_properties (Supabase)                │
│  - All records land here with status='scraped'                   │
│  - Admin reviews/edits in admin/pipeline.html                    │
│  - pipeline_publish RPC promotes to properties table             │
└─────────────────────────────────────────────────────────────────┘
```

---

## The 13-Step Pipeline (Python Bulk Scraper)

`scraper/pipeline.py` is the **mandatory entry point** for all bulk scraping jobs. It enforces all platform rules automatically:

1. **Scrape** — HomeHarvest (Realtor.com) or Zillow direct
2. **Availability + dedup** — active/available only, no duplicates
3. **Filter** — criteria + competitor watermark rejection
4. **Pricing** — apply pricing_fn or cap/floor
5. **Image pre-check** — min 6 source photos
6. **Enrichment** — cleanup, branding, fee normalization
7. **Pre-publish validation** — validate_for_publish()
8. **Stage** — insert into pipeline_properties
9. **Publish** — call pipeline_publish RPC
10. **Activate** — set status=active
11. **Photos** — download + upload to ImageKit
12. **Cleanup** — remove temp ImageKit folders
13. **Summary** — log results

---

## Which Tool to Use for Which Job

| Job | Tool | Command/Entry |
|-----|------|---------------|
| **Bulk scrape a city** | Python pipeline | `python scraper/<city>_batch.py --target 10` |
| **Scrape Realtor.com** | HomeHarvest via pipeline | `scraper/pipeline.py` (default source) |
| **Scrape Zillow** | Zillow direct scraper | `scraper/zillow_scraper.py` (requires residential IP) |
| **Scrape Zillow via 3rd-party** | Apify/ScrapeBadger/Oxylabs | `scraper/zillow_services.py` |
| **Scrape Opendoor** | Opendoor scraper | `scraper/opendoor_scraper.py` (opt-in) |
| **Scrape CJ Properties** | CJ Properties scraper | `scraper/cjproperties_scraper.py` |
| **Save one listing (desktop)** | Chrome extension | Click "Save to Pipeline" button |
| **Save one listing (iPhone)** | Orion extension | Click "Save to Pipeline" button |
| **Import URL from admin** | Admin panel | Admin → Pipeline → "Import URL" button |

---

## Environment Variables

### Required for Python scraper (`scraper/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin access) |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private key |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit URL endpoint |

### Required for Edge Functions (Supabase secrets)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `SUPABASE_ANON_KEY` | Anon key |
| `SHORTCUT_IMPORT_SECRET` | Shared secret for extension imports |

### Extension config (`chrome-extension/config.js` / `.pages-orion/config.js`)

| Variable | Description |
|----------|-------------|
| `CP_CONFIG.IMPORT_SECRET` | Shared secret for extension imports |
| `CP_CONFIG.EDGE_URL` | Edge function URL |

---

## Canonical Extractor

**Location:** `src/extractors/shared-extractors.js`

This is the **single source of truth** for all listing extraction logic (Zillow, Realtor, Apartments, Redfin).

**Generated files (do NOT edit directly):**
- `chrome-extension/shared-extractors.js` — browser IIFE
- `.pages-orion/live-shared-extractors.js` — browser IIFE (same content)
- `supabase/functions/_shared/zillow-extract.ts` — Deno/TypeScript

**To update extraction logic:**
```bash
# 1. Edit src/extractors/shared-extractors.js
# 2. Run the build script:
node scripts/build-extractors.js
# 3. Push to GitHub → Cloudflare auto-deploys → extensions pick up changes
```

---

## Shared Pipeline Record Builder

**Location:** `supabase/functions/_shared/pipeline-record.ts`

Single source of truth for building `pipeline_properties` records. Used by both:
- `receive-pipeline-import` (extension imports)
- `import-from-url` (admin URL imports)

Contains: quality scoring, field normalization, record construction.

---

## Deployment

### Cloudflare Pages (website + live extension code)
```bash
git add -A
git commit -m "update"
git push
```
Cloudflare auto-deploys. The `.pages-orion/` directory is served at `/.pages-orion/` for the extension's live loader.

### Supabase Edge Functions
```bash
# Deploy all functions
supabase functions deploy

# Or deploy specific functions
supabase functions deploy receive-pipeline-import
supabase functions deploy import-from-url
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `scraper/pipeline.py` | 13-step pipeline orchestrator |
| `scraper/enrichment.py` | Enrichment rules (watermark, branding, fees) |
| `scraper/scraper.py` | Main scraper entry (Realtor + Zillow) |
| `scraper/zillow_scraper.py` | Zillow direct HTML scraper |
| `scraper/zillow_services.py` | 3rd-party Zillow services (Apify, etc.) |
| `scraper/opendoor_scraper.py` | Opendoor sale→rent converter |
| `scraper/cjproperties_scraper.py` | CJ Properties scraper |
| `src/extractors/shared-extractors.js` | **Canonical** listing extractor |
| `scripts/build-extractors.js` | Build script for extractor variants |
| `supabase/functions/_shared/pipeline-record.ts` | Shared lossless record builder (`source_facts_ledger`, 4 JSONB domains, quality score) |
| `supabase/functions/_shared/apify-actor-adapters.ts` | Maxcopell two-stage adapter & experimental actor guards |
| `supabase/functions/_shared/apify-normalizer.ts` | Strict rental eligibility, lossless Zillow normalization & insights segregation |
| `supabase/functions/_shared/location-verifier.ts` | Geoapify + zero-key Census TIGERweb school district cross-check |
| `supabase/functions/_shared/property-validation.ts` | 3-layer eligibility, conflict detection & `field_verification_status` gate |
| `supabase/functions/_shared/batch-publishing.ts` | Client-safe projection contract & internal leak detection |
| `supabase/functions/_shared/batch-verifier.ts` | End-to-end publication, anon isolation & privacy verification |
| `supabase/functions/_shared/zillow-extract.ts` | Generated Deno Zillow extractor |
| `supabase/functions/apify-scrape-worker/index.ts` | Two-stage Apify execution, failover & unit-aware dedup ingestion |
| `supabase/functions/receive-pipeline-import/index.ts` | Extension import edge function |
| `supabase/functions/import-from-url/index.ts` | URL import edge function |
| `chrome-extension/` | Chrome extension source |
| `.pages-orion/` | Orion extension live-loader source |
| `js/admin/pipeline.js` | Admin pipeline & 3-layer verification inspection UI |

---

## Pipeline Folders

Properties can be organized into **named folders** for easy management. Each property in a folder gets an **auto-assigned serial number** (#1, #2, #3...) based on arrival order. This lets you and AI assistants reference properties by their folder + number (e.g., "Wisdom #3").

### How It Works
- Folders are **optional** — properties exist without one by default
- Each property can only be in one folder at a time
- Serial numbers are per-folder, assigned automatically when a property is added
- Deleting a folder archives all its unpublished properties (safe, not destructive)

### Folder Sources
Folders can be assigned at intake time from **any channel**:

| Channel | How to specify folder |
|---------|---------------------|
| **Python Bulk Scraper** | `BatchCriteria(folder_name="Wisdom")` |
| **Chrome/Orion Extension** | `body.folder_name` in the extension payload |
| **Admin Import URL** | `?folder=Wisdom` query param |

### AI Commands
Natural-language commands that any AI can use. Full reference: `docs/AI_COMMANDS.md`
- "Create folder Wisdom"
- "Add property PP-ABC123 to folder Wisdom"
- "Publish property 3 in folder Wisdom"
- "Publish all in folder Wisdom"
- "How many properties in folder Wisdom?"
- "Delete folder Wisdom"
