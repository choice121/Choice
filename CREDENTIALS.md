# Choice Properties — New Developer Guide

This file covers everything a new developer or AI assistant needs to get fully operational on this project. No manual credential hunting required — everything is already committed.

---

## What You're Working With

| Component | Location | What it does |
|---|---|---|
| **Python Scraper** | `scraper/` | **The main tool.** Scrapes Realtor.com, enriches listings, publishes to the live site. Run from Replit. |
| **Chrome Extension** | `chrome-extension/` | Secondary tool. Adds a "Save to Pipeline" button on open listing pages in your browser. |
| **Live site** | Cloudflare Pages | https://choice-properties-site.pages.dev — NOT hosted on Replit. Replit only runs the scraper. |

> **AI assistants:** Read `replit.md` first. It has the full project overview, architecture diagram, and scraping instructions. Do not treat this as a Chrome extension project.

---

## Setup — Choose Your Path

### Path A: Run a scraping job (most common)

Everything is already set up. Just install deps and run:

```bash
pip install homeharvest requests pillow

# Dry run (no DB writes)
python3 scraper/charleston_sc_batch.py --dry-run

# Live run — publish 10 listings
python3 scraper/charleston_sc_batch.py --target 10
```

All credentials are in `scraper/.env` — already committed, nothing to configure.

Need to scrape a new city? Copy any existing batch script and update the locations/criteria. See `scraper/PIPELINE_USAGE.md` for the full template.

**For AI-assisted scraping jobs:** use `SCRAPING_PROMPT.md` as the copy-paste prompt template.

---

### Path B: Set up the Chrome Extension

1. Open Chrome → `chrome://extensions` → enable **Developer mode**
2. Click **Load unpacked** → select the `chrome-extension/` folder
3. Done — all credentials are already in `chrome-extension/config.js`

To use: navigate to any Zillow/Realtor.com/Apartments.com/Redfin listing page and click the **"Save to Pipeline"** button that appears.

---

### Path C: Server-side / Replit scripts

Scripts that run automated tasks on Replit use the Supabase service role key for full database automation. To configure:

1. Retrieve `SUPABASE_SERVICE_ROLE_KEY` from Supabase Dashboard → Project Settings → API → `service_role` key
2. Add it to Replit Secrets or `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`

> **Note:** `scraper/.env` already has the service role key configured — so Path A works out of the box without any extra setup.

---

## Credential Inventory

| Credential | Approved location | Notes |
|---|---|---|
| Supabase URL and anon/publishable key | Public site config | The anon key is public; database access must remain protected by RLS. |
| Supabase service-role key and access token | Trusted operator environment / secret manager | Never put these in browser code, Replit project configuration, or Git. |
| ImageKit public key and URL endpoint | Public site/extension config | Public identifiers only. |
| ImageKit private key | Trusted backend/operator secret store | Never commit or expose to browsers. |
| GAS email relay URL and HMAC secret | Supabase Edge Function secrets | Keep the HMAC secret private. |
| Extension admin session | Extension local storage | Disconnect from the extension popup to remove the refresh token. |

Repository history contained service-role, ImageKit, and other private credentials.
Treat them as compromised and rotate/revoke them at their providers before
relying on the current source cleanup. See [credential rotation guidance](docs/CREDENTIALS_SETUP.md).

---

## Key Documentation

| File | What it covers |
|---|---|
| `replit.md` | Full project overview, architecture, how to run scraping jobs, file map |
| `SCRAPING_PROMPT.md` | Copy-paste prompt for AI-assisted scraping jobs |
| `scraper/PIPELINE_USAGE.md` | `PipelineOrchestrator` API, `BatchCriteria` reference, new-city template |
| `scraper/PLATFORM_RULES.md` | Mandatory rules enforced automatically by `enrichment.py` |
| `scraper/SEARCH_PREFERENCES.md` | Active markets and their criteria |
| `scraper/RULES.md` | Scannable table of enrichment rules |

---

## Things That Will Trip You Up

- **Zillow requires a residential IP.** HomeHarvest/Realtor.com works fine from Replit; Zillow does not.
- **`main.py` at the root is unused.** Ignore it.
- **Root `manifest.json` is the Chrome extension manifest**, not a site config. Ignore it for scraping.
- **`scraper/scraper.py` is internal.** Don't call it directly — it's invoked by `pipeline.py` automatically.
- **The pipeline enforces all platform rules automatically.** You cannot skip watermark detection, ImageKit upload, fee normalization, etc. — they are not optional.
- **Published listing URLs use the slug format:**
  `https://choice-properties-site.pages.dev/rent/<state>/<city>/<beds>br-<type>-<id>/`
  The old `property.html?id=` format still works (301 redirect) but the slug URL is canonical.
