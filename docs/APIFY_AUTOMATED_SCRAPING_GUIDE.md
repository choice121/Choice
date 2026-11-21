# Choice Properties — Apify Automated Scraping Pipeline Documentation

> **Status:** Target Default Automated Scraper (Coexists Side-by-Side with Manual Chrome/Orion Extensions)  
> **Primary Source:** Zillow (`zillow.com`)  
> **Default Provider:** **Apify** (never HomeHarvest by default)  
> **Runtime:** Supabase Edge Functions (Deno) + PostgreSQL (`pipeline.*` & `public.*`) + `pg_cron` (Cloudflare-Only Repo Guard compliant — zero Node server dependencies in `package.json`)  

---

## 1. Purpose & Coexistence Policy

The **Apify Automated Scraping Pipeline** provides centralized, multi-worker, rule-enforced automated property discovery and staging for Choice Properties.

**Permanent Coexistence & Default Provider Rules:**
1. **Apify is the Default Automated Scraping Provider**: Whenever automated scraping is invoked, `scraping_providers` resolves to `apify` by default (Zillow primary target). HomeHarvest or other third-party scrapers are non-default fallbacks and must never be treated as equal defaults.
2. **Coexistence with Manual Browser Extensions**: Automated Apify scraping runs alongside the manual Chrome Desktop (`chrome-extension/`) and Orion Mobile (`.pages-orion/`) extensions. Both channels normalize through `supabase/functions/_shared/pipeline-record.ts` into `pipeline.pipeline_properties` and can write into the same or separate 4-digit batch folders cleanly.
3. **Cloudflare-Only Architecture Compliance**: Because `.github/workflows/cloudflare-only.yml` enforces a zero-Node-backend static site repo, automated scraping runs inside **Supabase Edge Functions (Deno)** and **PostgreSQL RPCs**, never via local Python scripts or Express/Postgres Node packages added to `package.json`.

---

## 2. Automated Scraping Architecture Flow

```
Task Config (Batch ID: 4 digits, Location, Rent Range, Qty, Target Price Rule)
         │
         ▼
[job-manager Edge Function]
  1. Validates 4-digit batch_id (rejects if already used)
  2. Pins active Rules & Policies version (rules-engine)
  3. Creates permanent batch row (batch_jobs / publishing_batches) + disposable working folder
  4. Claims batch atomically for worker (heartbeat + lease TTL)
         │
         ▼
[apify-scrape-worker Edge Function]
  5. Reads Apify provider config & run parameters from scraping_providers + Supabase Secrets
  6. Triggers Apify Zillow Actor run (with webhook callback or bounded poll)
  7. Archives raw Apify JSON payload into Storage bucket `pipeline-raw-payloads`
  8. Normalizes items via `_shared/pipeline-record.ts` -> batch-scoped `pipeline.pipeline_properties`
     - Enforces intra-batch deduplication `(batch_id, source, source_listing_id)`
     - Permits cross-batch reuse when same ZPID satisfies two separate batch jobs
  9. Logs execution telemetry to `pipeline.pipeline_scrape_runs`
         │
         ▼
[Downstream Automated Pipeline Gates]
  - `property-validator`: Source profile / landlord proof, prohibited profile blacklist,
                          property type & single-apartment check, >= 4 usable photos & watermark scan
  - `enrich-description`: Baseline-preserving rewrite of `original_description` + Choice sanitization
  - `calculate-pricing`:  `none` / `fixed` / `individual_map` / `proportional_range`
  - `pipeline_publish`:   Batch-scoped publish (`private_placement`) + link/registry persistence
  - `verify-batch-publication`: Live rendered & visibility checks
  - Safe folder cleanup + 24h recovery archive
```

---

## 3. Provider & Source Controls

### Approved Scraping Providers Registry (`public.scraping_providers`)
- **`apify`** (`is_default = true`, `enabled = true`): Primary Zillow search & detail actor integration. Credentials (`APIFY_API_TOKEN`) live strictly in Supabase Edge Function secrets, never in client JS or repo files.
- **`browser_extension_chrome` / `browser_extension_orion`** (`is_default = false`, `channel_type = 'manual'`): Manual 1-click browser capture via `receive-pipeline-import`.
- **`admin_url_import`** (`is_default = false`, `channel_type = 'manual'`): Admin single-URL server fetch via `import-from-url`.
- **Optional / Non-Default Fallbacks** (e.g., `homeharvest`): Disabled or secondary unless explicitly enabled by admin in Rules & Policies.

### Source & Profile Validation Rules (Enforced Application-Side)
1. **Owner / Landlord Priority Without Name-Only Guessing**:
   - Individual owners/landlords are prioritized **only** when source metadata explicitly classifies the poster/profile category as `Property Owner` or `Landlord`.
   - A human-sounding name alone (`attributionInfo.agentName`, listing signature, etc.) **never** proves owner/landlord status. Unverified/ambiguous profiles are held in `needs_review` (`review_reason = 'unverified_source_profile'`).
2. **Centralized Prohibited Profiles Blacklist (`public.prohibited_source_profiles`)**:
   - Seeded mandatory entries (with case-insensitive, normalized punctuation/suffix/alias matching to prevent false positives):
     - `Tricon Residential`
     - `MYNE`
     - `The Wayne`
     - `Main Street Renewal`
     - `American Avenue`
     - `American Homes 4 Rent` (`AMH`)
   - Expandable dynamically through Admin Rules & Policies without code redeployment.
   - Checked against `agent_name`, `broker_name`, `attributionInfo`, management blocks in `description`, and `source_raw_payload`.

---

## 4. Property Eligibility & Media Quality Gates

Applied deterministically (plus vision/AI checks where needed) to Apify-ingested records before promotion:

| Check | Rule | Outcome on Failure |
|---|---|---|
| **Property Type** | Accept qualifying `SINGLE_FAMILY` and `TOWNHOUSE` / `TOWNHOMES`. Accept `APARTMENT` **only** if verified as 1 discrete unit with 1 fixed asking rent and zero multi-unit/floor-plan/price-range selectors. | Complex/multi-unit -> `rejected`; ambiguous -> `needs_review` |
| **Minimum Usable Photos** | Must have `>= 4` usable, reachable, non-duplicate property images in original source order. Broken/irrelevant assets do not count. | `< 4` usable -> `rejected` or `needs_review` |
| **Watermark / Branding Scan** | Inspect images for visible third-party branding, logos, watermarks, copyright stamps, or contact overlays. **Never** crop, blur, or obscure watermarks to force eligibility; **never** substitute stock or AI-generated images. | Watermarked / unclear rights -> `needs_review` / `rejected` media |
| **Required Core Facts** | Valid real physical street address, city, state, asking rent (`> 0`, never Zestimate fallback), bedrooms, fractional bathrooms (`1.5`, `2.5`, etc. preserved per Rule 6A), authentic `original_description`. | Missing required fields -> `needs_review` |
| **Freshness & Status** | Listing must be active for rent (`FOR_RENT` / `available`), not `FOR_SALE`, `OFF_MARKET`, or `LEASED`. | Non-rental/off-market -> `rejected` |
| **Intra-Batch Duplicate** | Unique `(batch_id, source, source_listing_id)` enforced atomically per batch. Same ZPID in *different* batches is explicitly permitted. | Same batch duplicate -> idempotent skip/update |

---

## 5. Task-Specific Prompt Simplification & Worker Contract

Once the Apify scraping worker + Rules Engine are deployed, AI workers no longer receive multi-page boilerplate system rules in every prompt. Instead, the prompt supplies **only temporary task configuration**:

- **4-digit Batch ID** (e.g., `4821`)
- **Target location(s)** (city/state/ZIPs)
- **Quantity target**
- **Requested property type(s) & bed/bath/feature criteria**
- **Original advertised rent range** (for search & proportional pricing source bounds)
- **Target publishing pricing instruction** (`none`, `fixed`, `individual_map`, or `proportional_range` target min/max)
- **Explicit job-level exceptions** (if any)

Task-specific parameters live on that single `batch_jobs` record and **never bleed forward** into subsequent batches.

---

## 6. Operational Telemetry, Retries & Isolation

- **Telemetry**: Every Apify run records `count_total`, `count_new`, `count_duplicate`, `count_watermarked`, `count_validation_rejected`, `count_image_failed`, `batch_id`, `provider_run_id`, and `idempotency_key` into `pipeline.pipeline_scrape_runs`.
- **Rate Limits & Retries**: Apify 429/5xx errors trigger exponential backoff with jitter inside `apify-scrape-worker`. One failed listing never halts valid sibling listings in the batch; one failed batch never impacts concurrent batches.
- **Worker Isolation**: Each concurrent AI worker claims a single batch lease (`worker_id`, `lease_expires_at`, periodic heartbeat) and operates strictly within its assigned `batch_id` / disposable working folder.
