# Choice Properties — Platform Documentation

Choice Properties is a modern rental listing platform with integrated client portals, an admin Control Center, an operator-triggered on-demand Apify Zillow pipeline, and a universal 8-portal browser extension.

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
     │ Universal Chrome Extension │                     │ Apify On-Demand Zillow    │
     │  (1-click stage / Orion)   │                     │ Scraper (Admin Triggered) │
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

- `admin/` — Admin management dashboards (Pipeline, Leases, Inspections, Applications, Watermark Sniper, Inquiry Assistant).
- `chrome-extension/` — Chrome Extension source files (v37.0.0).
- `lib/` — AI Inquiry Assistant engine, customer memory store, and mobile router.
- `scripts/` — CLI utilities, policy sync, and extension build scripts.
- `src/extractors/` — Single source-of-truth extractor & search-card engine (`shared-extractors.js`, `shared-card-engine.js`).
- `supabase/` — Database schemas, security rules, migrations, and edge function endpoints.
- `docs/` — System manuals, extension changelogs, and integration guides.

---

## AI Rental Inquiry Assistant & iPhone Copilot

Choice Properties features an autonomous tenant communication engine and iOS Shortcut integration:
- **Zero-Manual Data Entry**: Automatically extracts lead phone suffixes, bedroom needs, monthly budgets, target cities, and Section 8 voucher details.
- **iPhone 1-Tap & Back-Tap Copilot**: Works directly inside **Google Voice**, **WhatsApp**, and **iMessage** via clipboard automation with under 1-second response generation.
- **Independent Company Knowledge**: Confidently answers qualification, background check, co-signer, voucher, and landlord intake inquiries.
- **Full Guide**: [docs/AI_INQUIRY_ASSISTANT_AND_IPHONE_COPILOT.md](docs/AI_INQUIRY_ASSISTANT_AND_IPHONE_COPILOT.md)
- **Support Policies**: [docs/customer-support-ai/](docs/customer-support-ai/)

---

## Email Infrastructure (Google Apps Script)

Transactional emails are sent through the Google Apps Script relay. Supabase Edge Functions call the shared `gasSend()` helper, which signs payloads with HMAC and sends them to `GAS_EMAIL_URL`; Apps Script sends through the Google account that owns the web app.
- **Provider**: Google Apps Script relay + `GmailApp` (with `MailApp` fallback)
- **Configuration**: Supabase Edge Function secrets `GAS_EMAIL_URL` and `GAS_RELAY_SECRET`
- **Guide and deliverability**: [docs/GAS_EMAIL_SETUP_AND_DELIVERABILITY.md](docs/GAS_EMAIL_SETUP_AND_DELIVERABILITY.md)
- **Domain note**: `choice-properties-site.pages.dev` is a web host, not a sender domain you control; it cannot be used for SPF/DKIM/DMARC alignment.

---

## Essential Developer & AI Rules

- **`AGENTS.md`**: Highest-priority system law covering all ingestion, enrichment, publishing, and extension versioning rules.
- **`docs/AI_INQUIRY_ASSISTANT_AND_IPHONE_COPILOT.md`**: Full manual for the AI Inquiry Assistant, iOS Shortcut setup, and API reference.
- **`docs/APIFY_AUTOMATED_SCRAPING_GUIDE.md`**: Guide for running on-demand operator-triggered Apify Zillow batches.
- **`docs/GAS_EMAIL_SETUP_AND_DELIVERABILITY.md`**: GAS relay setup and deliverability guidance.
- **`docs/EXTENSION_CHANGELOG.md`**: Detailed changelog of every Chrome extension version.
