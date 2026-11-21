# Choice Properties — Complete Technical System Audit Report

> **Audit Baseline:** GitHub `choice121/Choice` (`main` @ `d8602db`) · Supabase `tlfmwetmhthpyrytrcfo` (`us-east-1`, Postgres `17.6.1.104`) · Cloudflare Pages `choice-properties-site` (`https://choice-properties-site.pages.dev`)  
> **Note:** This temporary audit document lives under `docs/platform-evolution/` and is scheduled for complete removal in **Phase 10** after all implementation phases pass live verification.

---

## 1. Executive Summary

Choice Properties is an operational nationwide rental marketplace and private-placement leasing platform running on a static/SPA frontend deployed to **Cloudflare Pages** (with Cloudflare Pages Functions for SSR property detail pages, sitemap generation, and AI assistant proxying), **Supabase PostgreSQL + Storage + Deno Edge Functions**, **ImageKit** media utilities, and **two active manual browser extensions** (`chrome-extension/` for Desktop Chromium and `.pages-orion/` for Orion iOS/macOS, v34.0.0).

On `2026-11-16` (commit `02b8f17`), legacy automated Python/Node scraping and batch-publishing scripts (`scraper/*`, `scripts/engine/*`, `scripts/publish-universal-batch.mjs`) were removed from the repository, leaving **manual browser extension imports**, **Admin single-URL Zillow import**, and **manual admin pipeline review/publishing** as the active ingestion channels. Meanwhile, historical migrations (`20261112000001`–`20261112000003`, `20261113000001`, `20261114000001`, `20261120000001`, `20261121000001`) left substantial database infrastructure already provisioned (`publishing_batches`, `publishing_batch_properties`, `pipeline.pipeline_folders`, `pipeline.pipeline_scrape_runs`, `pipeline.pipeline_recovery_archive`, `description_enrichment_audit`, `property_shares`).

**Intended Transformation:**  
Evolve the project into a **centralized, rule-enforced, multi-worker platform** where *"the prompt describes the current job, and the Choice Properties application supplies and enforces the permanent operating rules"*—adding:
1. Centralized Rules & Policies Engine + Prohibited Profiles + Scraping Provider registry (**Apify default** automated scraper).
2. **Coexistence** of Apify automated scraping **and** preserved Manual Chrome/Orion Browser Extensions (both active side-by-side).
3. Unique **4-digit Batch IDs** (`0000`–`9999`) + isolated disposable batch working folders for **future batches** (while preserving all **18 existing `PB-2026...` batches** intact).
4. **Permanent Private-Placement Registry** retaining batch history and exact generated `#share={token}` links indefinitely after disposable folder cleanup.
5. **Concurrent Multi-AI Job Manager** with atomic batch claiming, heartbeats, leases, intra-batch dedup + cross-batch ZPID reuse.
6. Built-in **Property Validation Engine** (owner/landlord proof vs name-only, prohibited profiles, single-unit apartment restriction, `>= 4` usable photos & watermark screening), **Baseline Description Enrichment Engine**, **Task-Specific Pricing Engine** (including proportional rent mapping), **Batch-Scoped Publishing + Post-Publish Verification**, and **Safe Cleanup + 24h Recovery**.

---

## 2. Existing Architecture Map & Workflow Traces

### 2.1 Technology Stack & Deployment Guardrails
- **Frontend & Marketing/Public Pages:** Static HTML + vanilla ES Modules (`/js/*.js`, `/css/*.css`) plus Vite build step (`generate-config.js` + `scripts/copy-static-to-dist.js` -> `dist/`).
- **Cloudflare Pages Functions (`functions/`):**
  - `functions/rent/[state]/[city]/[slug].js` — Canonical property SSR & metadata
  - `functions/property.html.js` — Dynamic property meta/rendering helper
  - `functions/sitemap-properties.xml.js` — Dynamic XML sitemap for active listings
  - `functions/_middleware.js` — Request middleware & headers
  - `functions/api/*` — `agent-helper.js`, `assistant/quick-draft.js`, `assistant/version.js`, `tenant/auto-login.js`
- **Cloudflare-Only Enforcement (`.github/workflows/cloudflare-only.yml`):** Fails CI if Node backend frameworks (`express`, `pg`, `prisma`, `drizzle-orm`, `sqlite`, `mysql`, etc.) appear in `package.json` or if `config.js` is tracked in git. All backend automation **must** execute in Supabase Edge Functions (Deno) + PostgreSQL RPCs/`pg_cron` + Cloudflare Pages Functions.
- **Database (`tlfmwetmhthpyrytrcfo`):** PostgreSQL `17.6.1.104` across `public` and `pipeline` schemas (`183` applied entries in `_migration_history`).
- **Supabase Edge Functions:** **59 active functions deployed live**, vs **26 function folders tracked locally in git** (`supabase/functions/`). **33 deployed Edge Functions have no source folder in git** (`extract-listing-ai`, `imagekit-upload`, `imagekit-delete`, `imagekit-watermark`, `import-pipeline-photos`, `pipeline-media`, `pipeline-photo-upload`, `property-hierarchy`, `property-media`, `property-units`, `proxy-image`, `extension-diagnostics`, `zillow-gallery-reference`, `run-migration`, etc.).
- **Supabase Storage (`6` buckets):**
  - Private buckets: `pipeline-raw-payloads`, `application-docs`, `lease-inspection-photos`, `lease-pdfs`
  - Public buckets: `property-photos`, `profile-photos`
- **Scheduled Jobs (`pg_cron`, `6` active jobs):**
  - `#1` `cleanup-expired-drafts` (`0 3 * * *`)
  - `#2` `nudge-expiring-drafts` (`0 9 * * *`)
  - `#3` `cleanup_expired_client_collections` (`0 2 * * *`)
  - `#6` `expire-property-reservations` (`*/5 * * * *`)
  - `#7` `mark-expired-pipeline-recovery` (`15 * * * *`) — marks archive/batch rows `'expired'`, **does NOT call `purge-expired-pipeline-recovery`**.
  - `#10` `purge-expired-property-recovery` (`*/15 * * * *`) — purges `property_recovery_archive` (live properties trash), not `pipeline.pipeline_recovery_archive`.

### 2.2 End-to-End Existing Workflow Trace

```
  ┌──────────────────────────────────┐       ┌──────────────────────────────────┐
  │ Manual Chrome / Orion Extensions │       │ Admin "Import URL" Button        │
  │ (8 Portals, Pre-Flight HUD v34)  │       │ (admin/pipeline.html -> Zillow)  │
  └────────────────┬─────────────────┘       └────────────────┬─────────────────┘
                   │ POST + x-import-secret                   │ POST + Admin Bearer
                   ▼                                          ▼
       [receive-pipeline-import v120]                 [import-from-url v95]
                   │                                          │
                   └──────────────────┬───────────────────────┘
                                      ▼
                     `supabase/functions/_shared/pipeline-record.ts`
                      - buildPipelineRecord(), qualityScore(), missingFields()
                      - Geoapify reverse-geocode fallback
                      - Raw payload JSON uploaded to `pipeline-raw-payloads`
                      - Direct Source CDN image URLs saved (`complete`)
                                      ▼
                       `pipeline.pipeline_properties` (118 columns)
                        * Global dedup currently blocks repeat (source, source_listing_id)
                        * `folder_id` optional -> `pipeline.pipeline_folders`
                                      ▼
                 Admin Review / Watermark Sniper / Save (`admin/pipeline.html`)
                  - Calls `pipeline_list`, `pipeline_save`, `validateForPublish()`
                                      ▼
                Publish (`pipeline_publish` / `pipeline_publish_with_status` RPC)
                  - Promotes to `public.properties` + `public.property_photos`
                  - Enforces Choice fee ($50) & public field sanitization
                                      ▼
                  Client Share Generation (`property-share` action: 'create')
                  - Generates 256-bit URL-safe token -> stores SHA-256 hash in `property_shares`
                  - Links `property_share_properties` (90-day expiry)
                  - Client visits `https://choice-properties-site.pages.dev/listings.html#share={token}`
                                      ▼
                24-Hour Recovery (`pipeline-recovery` & `pipeline.pipeline_recovery_archive`)
                  - `pipeline_archive_and_remove` snapshots row to archive & clears staging row
                  - `purge-expired-pipeline-recovery` exists but is NOT triggered by pg_cron #7
```

---

## 3. Existing Functionality Inventory

| System / Capability | Status | Location & Live State | Findings & Recommendation |
|---|---|---|---|
| **Manual Chrome & Orion Extensions (`v34.0.0`)** | **Fully Implemented & Functional** | `chrome-extension/`, `.pages-orion/`, `src/extractors/shared-extractors.js` | **Retain & Preserve.** 8-portal extractors, Pre-Flight HUD (`>=4` green badge), `save_nonce` idempotency, `CHECK_LISTING`, folder pill, offline queue. Minor align: `MAX_PHOTOS` 40 vs 50 in `background.js` & align `batch_id` selection option. |
| **Shared Record Builder (`pipeline-record.ts`)** | **Fully Implemented & Functional** | `supabase/functions/_shared/pipeline-record.ts` | **Retain & Reuse.** Canonical normalizer & lossless provenance builder used by both `receive-pipeline-import` and `import-from-url`. Extend to accept `batch_id` + Apify source payloads. |
| **Admin Single-URL Importer** | **Fully Implemented** | `supabase/functions/import-from-url/index.ts`, `zillow-extract.ts` | **Retain & Integrate.** Direct Zillow HTML fetch (`__NEXT_DATA__`). Hits Zillow anti-bot 403/429 gracefully cleanly; keep as manual fallback alongside Apify + Extensions. |
| **Apify Automated Scraping Worker** | **Missing (Previously Removed)** | Was `scraper/*` (removed in `02b8f17`) | **Build New in Deno Edge Functions.** Implement `apify-scrape-worker` with Zillow Apify actor, rate-limit retries, source provenance capture, and `pipeline_scrape_runs` logging. |
| **Centralized Rules & Policies Engine** | **Missing (Fragmented)** | Split across `AGENTS.md`, `pipeline.js` (`validateForPublish`), `description-generator.mjs`, `pipeline_standardizer.mjs` | **Build Centralized DB + `rules-engine` Function.** Store versioned rules, immutable vs configurable policy flags, prohibited profiles blacklist, and scraping provider config. |
| **4-Digit Batch Identity System** | **Missing (Legacy `PB-*` Exists)** | `public.publishing_batches` has 18 legacy `PB-YYYYMMDD-XXXX` rows | **Evolve Preserving Legacy.** Keep 18 existing `PB-*` IDs untouched; enforce strict unique 4-digit numeric IDs (`^[0-9]{4}$`) + internal `batch_uuid` for all new batches. |
| **Disposable Batch Folders** | **Implemented but Incomplete** | `pipeline.pipeline_folders` (`0` live rows), `folder_id` / `folder_serial` | **Integrate & Harden.** Wire 1:1 batch-to-disposable-folder binding, worker isolation, verified cleanup rules, and multi-batch ZPID support. |
| **Cross-Batch Property Reuse** | **Unreliable / Blocked by Dedup** | `receive-pipeline-import` lines 343–471 & `import-from-url` lines 191–211 | **Fix Scope.** Currently blocks `(source, source_listing_id)` globally in `pipeline_properties`. Refactor to intra-batch uniqueness `(batch_id, source, source_listing_id)` + batch-scoped publishing overrides. |
| **Permanent Private-Placement Registry** | **Implemented but Incomplete** | `public.publishing_batches` (18 rows), `publishing_batch_properties` (253 rows) | **Evolve & Complete.** `property_shares` only stores SHA-256 `token_hash` (irreversible), while `publishing_batches.magic_link_url` stores the full `#share=` URL for completed batches. Index by 4-digit ID, support `"Give me batch {id}"` instant lookup, explicit expiry status, and controlled link replacement. |
| **Multi-AI Job Manager & Concurrency** | **Missing** | `pipeline_scrape_runs` exists (`0` rows), no worker lease/queue tables | **Build New.** Add `batch_jobs`, `batch_job_workers`, `FOR UPDATE SKIP LOCKED` claiming, leases, heartbeats, timeout recovery, and standardized worker API. |
| **Automated Validation Engine** | **Incomplete / Fragmented** | `pipeline_properties.validation_report` column exists (`jsonb`), no Edge validator; `watermark-sniper` handles manual review | **Build Centralized `property-validator`.** Enforce source-profile owner proof, prohibited-profile fuzzy/alias check, single-apartment structure check, `>= 4` usable photo check, and watermark/branding scan. |
| **Description Enrichment Engine** | **Present but Not Integrated** | `scripts/description-generator.mjs`, `description-sanitizer.mjs`, `public.description_enrichment_audit` (`0` rows), live `extract-listing-ai` | **Build `enrich-description` Edge Function.** Implement baseline-preserving rewrite (`original_description` -> `ai_description_draft` -> `approved_description`), length/fact fidelity verification, and Choice sanitization. |
| **Task-Specific Pricing Engine** | **Missing** | `pipeline_properties.original_monthly_rent` column exists, no pricing logic | **Build `calculate-pricing` Edge Function.** Implement `none`, `fixed`, `individual_map`, and proportional range formula with range checks & audit logging. |
| **Private-Placement Visibility & Sharing** | **Implemented with Functional Leaks** | `property-share`, `js/listings.js`, `js/property.js`, `functions/rent/*`, `functions/sitemap-properties.xml.js` | **Harden Product Visibility.** Suppress `RealEstateListing` JSON-LD & canonical `/rent/...` SEO tags + add `<meta name="robots" content="noindex, nofollow">` on `private_placement` in `js/property.js`; strip owner/landlord/broker/source URLs/internal metadata from client share payloads. |
| **Cleanup & 24h Recovery** | **Implemented but Disconnected** | `pipeline-recovery` v9, `purge-expired-pipeline-recovery` v8, `pipeline.pipeline_recovery_archive` (`123` rows: `93` expired, `30` recoverable) | **Wire & Harden.** `pg_cron` #7 marks expired rows but never invokes `purge-expired-pipeline-recovery`, leaving 93 expired rows unpurged. Schedule purge execution and enforce post-verify cleanup order. |
| **GitHub ↔ Supabase Sync** | **Skewed (`33` Live-Only Functions)** | 59 deployed Edge Functions vs 26 local folders | **Reconcile in Phase 1.** Audit and recover active live-only Edge Function definitions or document external status cleanly in git. |

---

## 4. Major Architectural Findings & Live Data Snapshot

### 4.1 Live Database State Snapshot (`tlfmwetmhthpyrytrcfo`)
- **`public.properties`**: `2,998` total rows (`286` `active`, `2,712` `private_placement`).
- **`public.property_photos`**: `64,423` rows (`40,719` clean, `23,463` pending, `238` applied, `3` branding watermark statuses).
- **`public.property_shares`**: `134` shares linking `3,609` `property_share_properties` rows.
- **`public.publishing_batches`**: `18` historical batches using `PB-YYYYMMDD-XXXX` IDs (`15` completed `pipeline_publish`, `1` `scrape_and_publish`, `1` partial, `1` 17-char ID). All `18` already populate `magic_link_url` and `share_id`.
- **`public.publishing_batch_properties`**: `253` rows (`24` published/active, `96` published/permanently_deleted, `123` published/recoverable, `5` published/restored, `2` failed/active, `3` skipped/active).
- **`pipeline.pipeline_recovery_archive`**: `123` rows (`93` `expired`, `30` `recoverable`). `0` active rows in `pipeline.pipeline_properties`, `pipeline.pipeline_folders`, `pipeline.pipeline_scrape_runs`, `pipeline.pipeline_enrichment_log`, `public.description_enrichment_audit`, and `public.client_collections`.

### 4.2 Critical Design Findings to Address Across Phases
1. **4-Digit Terminology Collision**: `admin/dashboard.html` and `lib/customer-store.js` already display `"4-digit ID memory"` for renter customer profiles (`Customer #1234`). Batch UI, APIs, and docs must always qualify **4-Digit Batch ID** (`Batch #4821`) vs **Renter Customer ID** (`Customer #1234`).
2. **4-Digit Namespace Exhaustion (`10,000` possible IDs `0000`–`9999`)**: Must never silently switch to 5 digits. Track used IDs permanently; detect exhaustion early (`>8,500` active/retained), reject duplicate requests cleanly, and provide an explicit admin archival/retirement policy if reuse after long retention is ever needed.
3. **One Canonical Property vs Multi-Batch Rent/Description Overrides**: If Batch `4821` adjusts ZPID `123456` rent proportionally to `$1,625` and Batch `7364` sets it to `$1,695`, mutating one shared `public.properties.monthly_rent` row in place would corrupt Batch `4821`'s published listing! Target architecture separates **canonical property record + provenance** from **batch-scoped published representation / overrides** (`batch_properties` + share resolution overlay) when multiple active batches reference the same ZPID.
4. **Functional Policy Reconciliation Built Into Centralized Rules Engine**:
   - **Description Baseline Rewriting (`Part G`) vs Verbatim Preservation (`AGENTS.md` §3)**: Target Rules Engine enables **baseline-preserving rewriting** (keeps exact original facts, tone, structure, and ~comparable length while sanitizing contacts/fees/CTAs and appending `$50 application fee`), with configurable toggle in Rules & Policies.
   - **Photo Threshold (`>= 4`)**: Chrome/Orion extensions v33 already validate Tier-1 Zillow extraction cleanly at `>= 4` photos; formalize `min_usable_photos = 4` in centralized Rules & Policies + Property Validator.
   - **Visible Client Fields (`Part I` vs `AGENTS.md` §1)**: Model `show_pet_policy` and `show_lease_summary` as centrally controlled policy rules (defaulting to current Choice platform compliance until toggled by Admin in Rules & Policies) while strictly omitting owner/landlord/broker/agent/poster/source URL/scraping/internal notes everywhere on client-facing pages.
5. **Private-Placement Functional SEO & Metadata Hygiene**: `js/property.js` must emit `<meta name="robots" content="noindex, nofollow">` when rendering `private_placement` records, skip injecting public `canonical` `/rent/<state>/<city>/<slug>` links and `RealEstateListing` JSON-LD for private listings, and ensure share APIs project an explicit allowlist of client-safe columns (excluding `agent_name`, `broker_name`, `landlords`, `source_url`, `source_raw_payload`, `field_provenance`, `original_data`, `showing_instructions`).
6. **Scheduled Recovery Purge Gap**: `pg_cron` job `#7` only runs `UPDATE ... SET recovery_status = 'expired'`; it never invokes Edge Function `purge-expired-pipeline-recovery`, leaving 93 expired archive rows and storage payloads unpurged. Phase 1 wires scheduled purge execution cleanly.
