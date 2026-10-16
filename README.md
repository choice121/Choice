# Choice Properties — Platform Documentation

Choice Properties is a modern rental listing platform with integrated client portals, an admin dashboard, automated scraping/enrichment pipelines, and a universal 8-portal browser extension.

---

## System Architecture

```
                               ┌─────────────────────────────┐
                               │  8 Supported Rental Portals │
                               │ (Zillow, Realtor, Opendoor, │
                               │  Progress, CJ, Apts, Redfin,│
                               │  Invitation Homes)           │
                               └──────────────┬──────────────┘
                                              │
                    ┌─────────────────────────┴────────────────────────┐
                    ▼                                                  ▼
     ┌────────────────────────────┐                     ┌───────────────────────────┐
     │ Universal Chrome Extension │                     │ Automated Python Pipeline │
     │  (v28.0.6 — 1-click stage) │                     │ (HomeHarvest + Orchestrator)│
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
- `chrome-extension/` — Chrome Extension source files (v18.0.14).
- `scraper/` — Python automated pipeline orchestrator and HomeHarvest scrapers.
- `src/extractors/` — Single source-of-truth extractor logic (`shared-extractors.js`).
- `supabase/` — Database schemas, security rules, and edge function endpoints.
- `docs/` — System manuals, extension changelogs, and integration guides.

---

## Email Infrastructure (Brevo / Bravo)

Transactional emails (inquiries, applications, lease signatures, receipts, and magic link logins) are delivered using **Brevo REST API v3** with automated Google Apps Script (GAS) failover:
- **Provider**: Brevo (formerly Sendinblue) via HTTPS `POST https://api.brevo.com/v3/smtp/email`
- **Authorized Sender**: `choicepropertyofficial1@gmail.com`
- **Sender Name**: `Choice Properties`
- **Guide & Setup**: See [docs/BREVO_EMAIL_SETUP.md](docs/BREVO_EMAIL_SETUP.md) for configuration details, testing instructions, and template architecture.
- **CLI Test Tool**: `node scripts/test-brevo.mjs [recipient-email]`

---

## Essential Developer & AI Rules

- **`AGENTS.md`**: Highest-priority system law covering all ingestion, enrichment, publishing, and extension versioning rules.
- **`AI_AGENT_GUIDE.md`**: Guide for running Python batch scraping jobs.
- **`docs/BREVO_EMAIL_SETUP.md`**: Complete Brevo transactional email guide and API setup.
- **`docs/EXTENSION_CHANGELOG.md`**: Detailed changelog of every Chrome extension version.
