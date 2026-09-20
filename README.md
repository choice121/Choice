# Choice Properties — Platform Documentation

Choice Properties is a modern rental listing platform with integrated client portals, an admin dashboard, automated scraping/enrichment pipelines, and a universal 7-portal browser extension.

---

## System Architecture

```
                               ┌─────────────────────────────┐
                               │  7 Supported Rental Portals │
                               │ (Zillow, Realtor, Opendoor, │
                               │  Progress, CJ, Apts, Redfin)│
                               └──────────────┬──────────────┘
                                              │
                    ┌─────────────────────────┴────────────────────────┐
                    ▼                                                  ▼
     ┌────────────────────────────┐                     ┌───────────────────────────┐
     │ Universal Chrome Extension │                     │ Automated Python Pipeline │
     │  (v12.0.0 — 1-click stage) │                     │ (HomeHarvest + Orchestrator)│
     └──────────────┬─────────────┘                     └─────────────┬─────────────┘
                    │                                                 │
                    └─────────────────────────┬───────────────────────┘
                                              ▼
                               ┌──────────────────────────────┐
                               │ Supabase Edge Functions      │
                               │ (receive-pipeline-import)    │
                               └──────────────┬───────────────┘
                                              │
                                              ▼
                               ┌──────────────────────────────┐
                               │   Pipeline Staging Engine    │
                               │    (pipeline_properties)     │
                               └──────────────┬───────────────┘
                                              │
                        ┌─────────────────────┴─────────────────────┐
                        ▼                                           ▼
         ┌────────────────────────────┐              ┌────────────────────────────┐
         │ Vision & Watermark Filter  │              │ Description Enrichment     │
         │ (AI Vision + Quality Gate) │              │ (Strict Anti-Slop, No Fee/ │
         └──────────────┬─────────────┘              │  Deposit/Lease Mentions)   │
                        │                            └──────────────┬─────────────┘
                        └─────────────────────┬─────────────────────┘
                                              ▼
                               ┌──────────────────────────────┐
                               │ Live Public Website          │
                               │ (Cloudflare Pages / Supabase)│
                               └──────────────────────────────┘
```

---

## Key Directories & Components

- `admin/` — Admin management dashboards (Pipeline, Leases, Inspections, Applications, Watermark Sniper).
- `chrome-extension/` — Chrome Extension source files (v12.0.0).
- `scraper/` — Python automated pipeline orchestrator and HomeHarvest scrapers.
- `src/extractors/` — Single source-of-truth extractor logic (`shared-extractors.js`).
- `supabase/` — Database schemas, security rules, and edge function endpoints.
- `docs/` — System manuals, extension changelogs, and integration guides.

---

## Essential Developer & AI Rules

- **`AGENTS.md`**: Highest-priority system law covering all ingestion, enrichment, publishing, and extension versioning rules.
- **`AI_AGENT_GUIDE.md`**: Guide for running Python batch scraping jobs.
- **`docs/EXTENSION_CHANGELOG.md`**: Detailed changelog of every Chrome extension version.
