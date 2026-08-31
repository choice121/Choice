# Choice Properties

A rental property marketing platform and automated listing pipeline.

> **AI assistants and developers:** Read [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) first. This is a Cloudflare Pages/Supabase project, not a Replit-hosted application.

---

## What This Is

**Choice Properties** is a rental marketplace at https://choice-properties-site.pages.dev with an automated Python scraping pipeline that finds, enriches, and publishes rental listings from Realtor.com.

This repo contains:

| Component | Location | Purpose |
|---|---|---|
| **Python Scraper** | `scraper/` | **Main tool.** Scrapes Realtor.com via HomeHarvest, enriches listings, publishes to the live site |
| **Chrome Extension** | `chrome-extension/` | Secondary tool. Browser button for manually importing a single open listing page |
| **Static site config** | `package.json`, `manifest.json` | Cloudflare Pages deployment — site is NOT hosted on Replit |

---

## Quick Start — Running a Scraping Job

```bash
# Install Python dependencies (one time)
pip install homeharvest requests pillow

# Run an existing city batch (dry run first)
python3 scraper/charleston_sc_batch.py --dry-run

# Live run — scrape and publish 10 listings
python3 scraper/charleston_sc_batch.py --target 10
```

To run a job for a new city, create a batch script following the template in `scraper/PIPELINE_USAGE.md`.

For the standard scraping workflow and prompt format, see [docs/SCRAPING_GUIDE.md](docs/SCRAPING_GUIDE.md).

---

## Scraper Architecture

```
Realtor.com (HomeHarvest)
        │
        ▼
 pipeline.py — PipelineOrchestrator (13 steps)
        │  scrape → filter → enrich → validate → publish → photos
        ▼
 Supabase: pipeline.pipeline_properties  →  public.properties
        │                                          │
        ▼                                          ▼
 Admin review panel                         Live site (Cloudflare Pages)
 /admin/pipeline.html               choice-properties-site.pages.dev
```

All platform rules (watermark detection, ImageKit upload, description cleaning, fee normalization, duplicate detection, validation) are enforced automatically by `pipeline.py` + `enrichment.py`. **None can be skipped.**

---

## Credentials

Credentials must be supplied through local environment variables, GitHub Actions secrets, Cloudflare Pages variables, or the secure scraper environment. Never commit credential values.

---

## Key Documentation

| File | What it covers |
|---|---|
| `docs/PROJECT_GUIDE.md` | Project architecture, deployment, credentials, and validation |
| `docs/SCRAPING_GUIDE.md` | Copy-paste workflow for AI-assisted scraping jobs |
| `scraper/PIPELINE_USAGE.md` | `PipelineOrchestrator` API, `BatchCriteria` reference, new-city template |
| `scraper/PLATFORM_RULES.md` | Mandatory platform rules enforced by `enrichment.py` |
| `scraper/SEARCH_PREFERENCES.md` | Active markets and content rules |

---

## Chrome Extension

The `chrome-extension/` folder contains a Manifest V3 browser extension that adds a "Save to Pipeline" button on Zillow/Realtor.com/Apartments.com/Redfin listing pages.

To load it: `chrome://extensions` → Enable Developer mode → Load unpacked → select `chrome-extension/`

This is a secondary manual-import tool — not the primary scraping method.
