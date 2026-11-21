# Choice Properties — Target Architecture & Data Model Specification

> **Applies To:** Choice Properties (`choice121/Choice`)  
> **Runtime:** Cloudflare Pages + Cloudflare Pages Functions + Supabase (PostgreSQL 17, Deno Edge Functions, Storage, `pg_cron`) + Chrome/Orion Manual Extensions  
> **Note:** Temporary architecture specification under `docs/platform-evolution/`; deleted in **Phase 10** upon final verified completion.

---

## 1. Core Architectural Principle

> **"The prompt describes the current job. The Choice Properties application supplies and enforces the permanent operating rules."**

Instead of duplicating platform rules across recurring scraping prompts, the application stores permanent operating rules in versioned PostgreSQL tables, exposes deterministic + AI/Vision Edge Functions, coordinates concurrent AI workers via a lease-based Job Manager, and continues supporting both **Apify automated scraping (default)** and **Manual Chrome/Orion Browser Extensions (coexisting full-featured channel)**.

---

## 2. Proposed End-to-End Architecture Diagram

```
 ┌─────────────────────────────────────┐   ┌──────────────────────────────────────┐
 │ AI Worker Prompts (Short Job Brief) │   │ Human Operator (Browser Tab / URL)   │
 │ - 4-digit Batch ID (e.g. 4821)      │   │ - Chrome Extension v34+ (Desktop)    │
 │ - Location, Rent Range, Qty, Target │   │ - Orion Extension v34+ (iOS/macOS)   │
 └──────────────────┬──────────────────┘   │ - Admin "Import URL" Button          │
                    │                      └──────────────────┬───────────────────┘
                    ▼                                         │
 ┌─────────────────────────────────────┐                      │
 │ job-manager (Edge Function)         │                      │
 │ - Validates 4-digit batch_id        │                      │
 │ - Rejects already-used batch IDs    │                      │
 │ - Pins active policy_version_id     │                      │
 │ - Creates batch + disposable folder │                      │
 │ - Claims atomic worker lease        │                      │
 └──────────────────┬──────────────────┘                      │
                    │                                         │
                    ▼                                         ▼
 ┌─────────────────────────────────────┐   ┌──────────────────────────────────────┐
 │ apify-scrape-worker (Default Auto)  │   │ receive-pipeline-import /            │
 │ - Reads scraping_providers (apify)  │   │ import-from-url                      │
 │ - Calls Apify Zillow Actor          │   │ - Preserves 1-click Save + save_nonce│
 │ - Logs to pipeline_scrape_runs      │   │ - Supports 4-digit batch OR folder   │
 └──────────────────┬──────────────────┘   └──────────────────┬───────────────────┘
                    │                                         │
                    └────────────────────┬────────────────────┘
                                         ▼
           ┌──────────────────────────────────────────────────────────┐
           │ pipeline-record.ts -> pipeline.pipeline_properties       │
           │ - Isolated to batch_id & disposable folder ({4-digit})   │
           │ - Intra-batch unique: (batch_id, source, source_listing) │
           │ - Cross-batch reuse allowed across independent batches   │
           │ - Raw payload archived to `pipeline-raw-payloads` bucket │
           └─────────────────────────────┬────────────────────────────┘
                                         ▼
           ┌──────────────────────────────────────────────────────────┐
           │ Centralized Application Engines (Supabase Edge)          │
           │ 1. property-validator:                                   │
           │    - Owner/Landlord explicit proof (never name-only)     │
           │    - prohibited_source_profiles fuzzy/alias screening    │
           │    - Single-unit apartment vs complex structure gate     │
           │    - >= 4 usable photos & watermark/branding check       │
           │ 2. enrich-description:                                   │
           │    - Baseline rewrite of original_description (~length)  │
           │    - Choice sanitization + $50 application fee anchor    │
           │    - Separate original vs draft vs approved storage      │
           │ 3. calculate-pricing:                                    │
           │    - none | fixed | individual_map | proportional_range  │
           │    - Keeps original_monthly_rent separately; range guard │
           └─────────────────────────────┬────────────────────────────┘
                                         ▼
           ┌──────────────────────────────────────────────────────────┐
           │ Batch Publishing, Link Registry & Live Verification      │
           │ - `pipeline_publish` (batch-scoped, partial-success safe)│
           │ - Creates/links `property_shares` (90-day `#share=` URL) │
           │ - Saves Permanent Registry (`publishing_batches` +       │
           │   batch_properties overlay for multi-batch rent/copy)    │
           │ - `verify-batch-publication`: verifies DB, live HTTP/SPA │
           │   render, media, price, copy, and zero internal leaks    │
           └─────────────────────────────┬────────────────────────────┘
                                         ▼
           ┌──────────────────────────────────────────────────────────┐
           │ Safe Cleanup & 24-Hour Recovery                          │
           │ - Archives raw JSON under `recovery/{batch_id}/` (24h)   │
           │ - Removes ONLY verified succeeded rows from staging      │
           │ - Keeps failed/review rows safely                        │
           │ - Deletes empty eligible disposable folder               │
           │ - Preserves properties, photos, shares, & registry rows  │
           │ - >24h purge deletes raw blobs only (`purge-expired-*`)  │
           └──────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & Entity Relationships

### 3.1 Preserving Existing Records vs Adding New Entities

1. **All 18 Existing `PB-2026...` Batches**: Stay untouched in `public.publishing_batches` and `public.publishing_batch_properties` with `batch_format = 'legacy_pb'`.
2. **Future 4-Digit Batches**: Stored with `batch_format = 'four_digit'` (`batch_id ~ '^[0-9]{4}$'`, e.g., `'4821'`), paired with an internal `batch_uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid()` for relational foreign keys.

### 3.2 Five-Layer Property & Batch Representation

| Layer | Table(s) | Purpose |
|---|---|---|
| **1. Canonical Property** | `public.properties`, `public.property_photos` | Shared physical property identity, verified address, coordinates, rooms, media gallery |
| **2. Source Listing & Raw Provenance** | `pipeline-raw-payloads` Storage bucket + `source_raw_payload`, `field_provenance`, `original_description`, `original_monthly_rent` | Immutable raw scraped snapshot + attribution preserved cleanly |
| **3. Batch-Scoped Staging (Disposable)** | `pipeline.batch_folders`, `pipeline.pipeline_properties` | Isolated temporary working folder named `{batch_id}` (`'4821'`); supports duplicate guard per batch + concurrent cross-batch reuse |
| **4. Batch-Scoped Published Association & Overrides** | `public.publishing_batch_properties` (extended with `batch_uuid`, `published_rent`, `published_description`, `pricing_method`, `pricing_meta`, `validation_status`, `verification_status`) | Allows Batch `4821` and Batch `7364` to reference the same canonical property UUID with independent pricing/copy/outcomes |
| **5. Permanent Private-Placement Registry** | `public.publishing_batches` + `public.property_shares` + `public.property_share_properties` + `public.private_placement_registry` view | Permanent history and direct `magic_link_url` lookup (`"Give me batch 4821"`) even after disposable folder deletion |

### 3.3 Core New / Extended Tables

1. **Centralized Rules & Policies (`public`)**:
   - `public.policy_sets`: `id`, `version_number` (`INTEGER UNIQUE`), `version_label` (`TEXT`, e.g., `'v2026.11.1'`), `status` (`'draft' | 'active' | 'archived'`), `notes`, `created_by`, `activated_at`, `created_at`.
   - `public.policy_rules`: `id`, `policy_set_id` (FK), `rule_key` (`TEXT`), `category` (`'scraping' | 'eligibility' | 'enrichment' | 'pricing' | 'publishing' | 'cleanup'`), `value_json` (`JSONB`), `is_immutable` (`BOOLEAN`), `is_enabled` (`BOOLEAN`), `description`, `UNIQUE(policy_set_id, rule_key)`.
   - `public.policy_change_log`: `id`, `policy_set_id`, `rule_key`, `old_value`, `new_value`, `changed_by`, `reason`, `changed_at`.
   - `public.prohibited_source_profiles`: `id`, `canonical_name`, `aliases` (`TEXT[]`), `match_mode` (`'normalized_exact' | 'token_phrase'`), `is_immutable`, `enabled`, `notes`, `created_at`. Seeded with: `Tricon Residential`, `MYNE`, `The Wayne`, `Main Street Renewal`, `American Avenue`, `American Homes 4 Rent` (`AMH`).
   - `public.scraping_providers`: `id`, `provider_key` (`TEXT UNIQUE` — `'apify'`, `'browser_extension_chrome'`, `'browser_extension_orion'`, `'admin_url_import'`, `'homeharvest'`), `channel_type` (`'automated' | 'manual'`), `is_default` (`BOOLEAN`), `enabled` (`BOOLEAN`), `config_json` (`JSONB`), `updated_at`. Partial unique index enforces at most ONE automated `is_default = true` (`'apify'`).

2. **Batches, Disposable Folders & Multi-Worker Orchestration**:
   - **`public.publishing_batches` (Extended)**:
     - `batch_uuid UUID UNIQUE DEFAULT gen_random_uuid()`
     - `batch_format TEXT NOT NULL DEFAULT 'legacy_pb'` (`'legacy_pb' | 'four_digit'`)
     - `policy_set_id UUID REFERENCES public.policy_sets(id)`
     - `task_config JSONB` (locations, target_qty, property_types, bed/bath filters, original_rent_range, pricing_config, exceptions)
     - `pricing_summary JSONB`, `location_summary JSONB`, `category_summary JSONB`
     - `link_verified_at TIMESTAMPTZ`, `replaced_from_share_id UUID`, `replacement_reason TEXT`
     - Constraint: `CHECK (batch_format = 'legacy_pb' OR id ~ '^[0-9]{4}$')`
     - Capacity tracking view/metric: monitors 4-digit ID usage against `10,000` namespace (`0000`–`9999`), warning at `>= 8,500` without ever silently changing to 5 digits.
   - **`pipeline.pipeline_folders` (Extended)**:
     - `batch_id TEXT REFERENCES public.publishing_batches(id)` (unique when `is_disposable_batch = true`), `batch_uuid UUID`, `is_disposable_batch BOOLEAN DEFAULT false`, `cleanup_state TEXT DEFAULT 'open'` (`'open' | 'cleaning' | 'eligible_for_delete' | 'deleted'`), `deleted_at TIMESTAMPTZ`.
   - **`pipeline.pipeline_properties` Deduplication Update**:
     - Retain `batch_id TEXT`; replace global source uniqueness assumptions with batch-scoped uniqueness:
       `CREATE UNIQUE INDEX idx_pipeline_batch_source_listing ON pipeline.pipeline_properties (COALESCE(batch_id, '__manual_inbox__'), source, source_listing_id);`
     - Same ZPID **is permitted** across different `batch_id` values (`4821` and `7364`). Accidental duplicate within the SAME `batch_id` is blocked atomically (while `field_provenance->>'save_nonce'` keeps extension double-tap retries idempotent).
   - **`pipeline.batch_jobs` & `pipeline.batch_job_workers`**:
     - `batch_jobs`: `id UUID PK`, `batch_id TEXT UNIQUE`, `batch_uuid UUID`, `policy_set_id UUID`, `worker_id TEXT`, `lease_token UUID`, `lease_expires_at TIMESTAMPTZ`, `last_heartbeat_at TIMESTAMPTZ`, `stage TEXT` (`'queued' | 'scraping' | 'validating' | 'enriching' | 'pricing' | 'publishing' | 'verifying' | 'cleaning' | 'completed' | 'partial' | 'paused' | 'failed'`), `progress_json JSONB`, `attempt_count INT`, `idempotency_key TEXT`, `error_message TEXT`, `started_at TIMESTAMPTZ`, `completed_at TIMESTAMPTZ`.
     - `batch_job_workers`: `worker_id TEXT PK`, `worker_type TEXT`, `status TEXT`, `active_batch_id TEXT`, `last_heartbeat_at TIMESTAMPTZ`, `metadata JSONB`.

3. **Pricing & Enrichment Audit**:
   - `public.pricing_calculations`: `id UUID PK`, `batch_id TEXT`, `pipeline_id TEXT`, `property_id TEXT`, `method TEXT` (`'none' | 'fixed' | 'individual_map' | 'proportional_range'`), `source_min NUMERIC`, `source_max NUMERIC`, `target_min NUMERIC`, `target_max NUMERIC`, `original_rent NUMERIC`, `calculated_rent NUMERIC`, `was_clamped BOOLEAN`, `status TEXT` (`'calculated' | 'held_out_of_range' | 'error'`), `task_config_snapshot JSONB`, `created_at TIMESTAMPTZ`.
   - `public.description_enrichment_audit` (existing 14-col table — actively populated by `enrich-description`).

---

## 4. Client-Safe Visibility & Share Overlay Design

- **`property-share` Edge Function**:
  - `action: 'resolve'` (`#share={token}`) and `action: 'resolve_property'`:
    - Return an explicit **client-safe field allowlist**: `id, title, address, unit_number, city, state, zip, neighborhood, county, lat, lng, bedrooms, bathrooms, half_bathrooms, total_bathrooms, square_footage, lot_size_sqft, year_built, floors, garage_spaces, property_type, property_subtype, monthly_rent, application_fee, parking, ev_charging, amenities, appliances, utilities_included, flooring, heating_type, cooling_type, laundry_type, has_basement, has_central_air, structural_details, utility_details, description, property_photos (url, display_order, is_hero, caption, room_label, media_type)` — **explicitly omitting** `agent_name`, `broker_name`, `landlords`, `poster_landlord_id`, `source_url`, `source`, `source_listing_id`, `original_data`, `source_raw_payload`, `field_provenance`, `showing_instructions`, `admin_notes`, `batch_id`.
    - When `share_id` is tied to a batch (`publishing_batches.share_id`), overlay batch-specific `published_rent` and `published_description` from `publishing_batch_properties` so concurrent batches sharing one canonical `properties.id` each render their own batch price & copy cleanly!
  - `js/property.js` & `js/listings.js`:
    - When rendering a `private_placement` listing, dynamically ensure `<meta name="robots" content="noindex, nofollow">`, skip public `canonical` `/rent/...` link updates, and omit `RealEstateListing` JSON-LD injection.
    - Never render any `"Private Placement"` badge or source attribution to clients.

---

## 5. Short Future AI Worker Prompt Contract

Once Phases 1–9 are complete, an AI scraping/publishing prompt shrinks to strictly job-specific parameters:

```
Job Request: Batch #4821
- Action: Scrape Zillow (default Apify), validate, enrich descriptions, price, publish private placement, verify, and clean temporary folder.
- Locations: Charlotte, NC (28205, 28215)
- Quantity: 12 properties
- Property Types: Single-Family Houses, Townhouses
- Beds / Baths: 3+ bed, 2+ bath
- Original Advertised Rent Range: $1,400 – $1,950
- Target Publishing Price Range: $1,550 – $1,850 (proportional)
```

All permanent rules (Apify default, owner/landlord check, prohibited profiles list, single-apartment rule, `>= 4` usable watermark-free photos, baseline description rewrite + Choice sanitization + `$50` fee, `#share={token}` 90-day registry persistence, post-publish live verification, safe disposable folder cleanup) are retrieved and enforced directly by the Choice Properties application via `job-manager` and `rules-engine`.
