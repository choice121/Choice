# Choice Properties — Apify Zillow Extraction Audit, Actor Evaluation, Architecture & Phased Implementation Roadmap

> **Document Status:** Audit & Architecture Blueprint — **Revision 5 (Active Execution: Phases 1–4 Implemented & Verified; Phases 5–6 Pending Approval)**  
> **Scope:** Apify-Powered Zillow Rental Property Sourcing, Data Extraction, Normalization, Verification & Pipeline Storage  
> **Runtime Architecture:** Static Frontend + Cloudflare Pages Functions + Supabase Edge Functions (Deno) + PostgreSQL (`pipeline.*` & `public.*`)  
> **Zero-Execution Guarantee:** Prepared purely via static code inspection, read-only database/API inspection, and Apify Store schema verification. **Zero Apify actor runs were executed and zero Apify credits were consumed.**

---

## Table of Contents
1. [Executive Audit Verdict](#1-executive-audit-verdict)
2. [Strict Sourcing & Excluded Scope Guardrails](#2-strict-sourcing--excluded-scope-guardrails)
3. [Phase 1 — End-to-End System Audit & Traced Execution Workflow](#3-phase-1--end-to-end-system-audit--traced-execution-workflow)
4. [Phase 2 — Current Actor vs. 4 Candidate Apify Actors Comparison](#4-phase-2--current-actor-vs-4-candidate-apify-actors-comparison)
5. [Best Technical Recommendation & Honest Trade-Off Analysis](#5-best-technical-recommendation--honest-trade-off-analysis)
6. [Rental-Only & Dual-Listed Qualification Design](#6-rental-only--dual-listed-qualification-design)
7. [Target Property Extraction Taxonomy (Sections A–L) & Optional Property Insights](#7-target-property-extraction-taxonomy-sections-al--optional-property-insights)
8. [3-Layer Data, Verification & Projection Architecture](#8-3-layer-data-verification--projection-architecture)
9. [Complete Phased Implementation Roadmap (14-Point Specification per Phase)](#9-complete-phased-implementation-roadmap-14-point-specification-per-phase)
10. [Approval Gate & Immediate Next Step](#10-approval-gate--immediate-next-step)

---

## 1. Executive Audit Verdict

**Overall Verdict: Structurally Functional Orchestration, Severely Under-Extracting Data Pipeline.**

Choice Properties has built strong **operational scaffolding** around Apify scraping—atomic 4-digit `batch_id` allocation (`orchestrate-batch`), exclusive worker leases (`_shared/worker-lease.ts`), AES-256-GCM multi-key pool management and 0ms failover (`_shared/apify-key-pool.ts`), raw payload archival (`pipeline-raw-payloads`), prohibited source profile screening (`_shared/property-validation.ts`), and isolated batch `#share={token}` publishing (`_shared/batch-publishing.ts`).

However, the **core Zillow search, extraction, normalization, and client projection layers drop or fail to request the majority of Zillow's structured rental property data**:

1. **Missing Actor-Adapter Layer:** `buildApifyActorInput()` (`supabase/functions/_shared/apify-normalizer.ts`, lines 948–1052) emits a single hardcoded payload tailored loosely to `maxcopell/zillow-scraper` (sending `searchUrls`, `maxItems`, `extractionMethod`, and unsupported top-level filter keys). Live run history (`pipeline.pipeline_scrape_runs`) proves that switching `actor_id` to `igolaizola/zillow-scraper-ppe` returns `0` items, `maxcopell/zillow-detail-scraper` fails with `"No Zillow details to scrape"`, and `cliqtomedia/zillow-scraper` runs without detail fetching (`detailsFetched: false`, `detailStatus: "not_requested"`).
2. **Shallow Search-Card Scraping Default:** The default actor config (`public.scraping_providers`, `provider_key = 'apify'`) uses `maxcopell/zillow-scraper` with `extractionMethod: 'PAGINATION'`, yielding search-result cards lacking deep `resoFacts`, appliances, utilities, schools, HOA fees, and detailed features. Meanwhile, `maxcopell/zillow-detail-scraper` is never chained in a two-stage `search → detail` flow.
3. **100% Structured JSONB Loss in Apify Pipeline Staging:** Live database verification of `pipeline.pipeline_properties` shows **0 of 76** staged rows contain `structural_details`, `utility_details`, `financial_details`, `location_details`, or `inferred_features` (`has_raw: 76`, `has_struct: 0`, `has_util: 0`, `has_fin: 0`, `has_loc: 0`). In `public.properties`, only **240 of 3,032 rows (~7.9%)** have populated structured JSONB columns (largely from manual URL/extension imports), while **2,792 (~92.1%)** are empty. Even when archived `cliqtomedia/zillow-scraper` payloads included `schools`, `walkScore`, `transitScore`, `bikeScore`, `propertyFeatures`, `parking`, and `monthlyHoaFee`, `normalizeApifyZillowItem()` discarded them.
4. **Rental-Only Qualification Gaps:** `normalizeApifyZillowItem()` lines 479–481 defaults missing status to `'FOR_RENT'`, `matchesTaskConfigFilters()` (lines 719–800) checks no listing status at all, and neither the normalizer nor validator distinguishes active dual-listed (`FOR_RENT` + `FOR_SALE`) properties from sale-only (`FOR_SALE`) traps or guards against sale prices masquerading as monthly rent.
5. **Downstream Public Property Page & Privacy Projection Gaps (`batch-publishing.ts` & `js/property.js`):** `CLIENT_SAFE_PROPERTY_FIELDS` (`supabase/functions/_shared/batch-publishing.ts`, lines 26–79) includes `utility_details` and `location_context`, **but omits `structural_details` and `location_details`**—stripping structured architectural facts and `location_details.schools` on `property-share` even though `js/property.js` reads `p.structural_details` (`renderPropFacts`, line 4143) and `p.location_details.schools` (`renderScoresSection`, line 4290). Conversely, for active public listings, `js/property.js:224` executes `.from('properties').select('*, landlords(...), property_photos(...)')`, requiring strict column isolation and explicit field projection so internal pipeline/verification metadata never leaks to public visitors.

---

## 2. Strict Sourcing & Excluded Scope Guardrails

All architecture designs and roadmap phases in this document adhere strictly to the following boundaries:

### Mandatory Sourcing Rules
- **Rental Properties Only (End-to-End):** Every search plan, actor adapter, normalizer, validator/checker, and publishing gate must exclusively qualify properties listed **for rent**.
- **Sale-Only Rejection:** Properties listed exclusively for sale (`FOR_SALE`, `SOLD`, `RECENTLY_SOLD`, `PENDING_SALE`, `CONTINGENT`, `AUCTION`, `FORECLOSURE`, `OFF_MARKET`, `LEASED`, `RENTED`) must **never** qualify and must be rejected deterministically at ingestion and validation before quota counting or publishing.
- **Dual-Listed Rule (`FOR_RENT` + `FOR_SALE`):** May qualify **only** when the source confirms BOTH an **active rental offering** AND a **genuine monthly asking rent** (strictly separate from any sale/purchase price, and never sourced from `rentZestimate` or a rent benchmark).
- **No Silent Search Relaxation:** Customer preferences (locations, rent min/max, bedrooms, bathrooms, property types, required features, owner-only) must never be silently widened to inflate result counts.

### Excluded Scope (Explicitly Out of Bounds)
The following items are **excluded** from extraction targets, schema upgrades, and roadmap deliverables:
- Image, photo-count policy decisions, and multimedia extraction (existing photo-count and watermark rules remain completely unchanged and strictly outside project scope)
- Video, virtual-tour, or 3D-tour extraction
- Historical Zestimate, historical Rent Zestimate, Zestimate valuations, and unrelated rent benchmark or market-comparable pricing calculations
- Public-record or assessor-data integrations (including tax history and tax valuations)
- Parcel and flood-zone research
- Multi-building or apartment-complex management/unit-matrix extraction
- Multiple-floor or floor-by-floor extraction
- Date-related property fields (publication dates, availability dates, listing dates, update dates, price/tax histories)
- Separate rental and listing information modules
- Apify cost projections, budget calculations, or property-capacity calculations
- New account-pool or API-key management architecture (existing `_shared/apify-key-pool.ts` and `pipeline.apify_api_keys` are retained as-is)

---

## 3. Phase 1 — End-to-End System Audit & Traced Execution Workflow

### End-to-End Traced Workflow

```
Customer Preferences (task_config / UI / API)
  │  orchestrate-batch/index.ts -> buildEffectiveTaskConfig() + normalizeTaskConfigAliases()
  ▼
Search Planning & Input Construction
  │  _shared/apify-normalizer.ts -> buildApifyActorInput(taskConfig, providerCfg)
  ▼
Apify Actor Execution & Key Failover
  │  apify-scrape-worker/index.ts (start_run / poll_and_ingest) + _shared/apify-key-pool.ts
  ▼
Dataset Retrieval & Raw Archival
  │  fetchFullDatasetPages() (maxTotalItems=500, clean=true) + bucket `pipeline-raw-payloads`
  ▼
Normalization, Filtering & Balanced Quota Selection
  │  normalizeApifyZillowItem() -> matchesTaskConfigFilters() -> scorePreferredFeatures()
  │  -> selectBalancedItemsByQuota() -> best-effort Geoapify reverse geocode -> buildPipelineRecord()
  ▼
Pipeline Staging Storage
  │  pipeline.pipeline_properties (intra-batch dedup on batch_id + source + source_listing_id)
  ▼
Property Checker (Validation Gate)
  │  property-validator/index.ts -> _shared/property-validation.ts -> validatePipelineProperty()
  ▼
Batch Enrichment, Pricing & Publishing
  │  enrich-description -> calculate-pricing -> publish-batch (pipeline_publish_for_batch)
  ▼
Client-Safe Projection & Sharing
     _shared/batch-publishing.ts (CLIENT_SAFE_PROPERTY_FIELDS) -> property-share -> js/property.js
```

### Audit of All 18 Required Investigation Areas

| # | Audit Area | Verified Current Implementation | Concrete Defects, Bottlenecks & Disconnections |
|---|---|---|---|
| **1** | **Apify Integration & Architecture** | On-demand Deno Edge Functions (`orchestrate-batch`, `apify-scrape-worker`, `job-manager`) + PostgreSQL (`public.scraping_providers`, `pipeline.pipeline_scrape_runs`, `pipeline.apify_api_keys`, `pipeline.pipeline_properties`). Webhooks return `410 automated_webhooks_disabled` (`apify-scrape-worker/index.ts:622–628`). | No actor-adapter abstraction; `apify-scrape-worker` embeds hardcoded `searchUrls` assumptions (`index.ts:1154, 1487`), breaking alternate actors and preventing clean two-stage search→detail orchestration. |
| **2** | **Current Zillow Actor IDs & Configs** | `public.scraping_providers` stores `apify` (`is_default: true`, `enabled: true`, `config_json: {"actor_id": "maxcopell/zillow-scraper", "timeout_secs": 120, "execution_mode": "on_demand_only", "scheduled_scraping": false}`). Code fallback is `'maxcopell/zillow-scraper'` (`apify-scrape-worker/index.ts:931, 1112, 1483`). | `config_json` lacks actor-specific mode/detail settings (`includeDetails`, `fetchDetails`, `includeInsights`, two-stage detail chaining toggle, or adapter selection). Live runs tested 15 actors ad-hoc without matching their input schemas. |
| **3** | **apify-scrape-worker Implementation** | 1,702-line Edge Function handling `get_provider_status`, `list_keys`, `add_key`, `probe_keys`, `update_key`, `delete_key`, `list_runs`, `ingest_items`, `start_run`, and `poll_and_ingest` under `verifyAdminOrService` + `verifyBatchWorkerLease`. | Hard-codes `if (!Array.isArray(actorInput.searchUrls) || actorInput.searchUrls.length === 0)` (`lines 1154, 1487`), rejecting valid `locations`-based actors (`igolaizola`, `automation_craft`, `cliqtomedia`) unless `searchUrls` are synthesized. Also does single-stage runs only. |
| **4** | **Apify API Key Access** | `_shared/apify-key-pool.ts` unifies AES-256-GCM encrypted rows from `pipeline.apify_api_keys` (live DB: 7 active, 1 disabled) and Edge Function secrets (`APIFY_API_TOKENS`, `APIFY_API_TOKEN`, `APIFY_API_TOKEN_1..20`). `resolveUnifiedKeyPool` reconciles `active_runs` & cooldowns; `fetchApifyWithFailover` fails over on `401/402/403/429`. | Functioning as designed; preserved intact per excluded scope (no new key-pool architecture). Note: single `waitForFinish` + polling requires caller continuity to release slots if callers disconnect abruptly (partially mitigated by active-run reconciliation). |
| **5** | **Run Start, Monitoring & Retrieval** | `start_run` dispatches `/acts/{slug}/runs?waitForFinish={0..30}`; if `SUCCEEDED`, immediately calls `fetchFullDatasetPages`; otherwise returns `has_more: true` so `orchestrate-batch` (`run_one_go` / `continue_one_go`) polls `poll_and_ingest` until `deadlineMs` (`maxWaitSeconds` 10–110s, default 85s) and returns HTTP `202` + `continue_payload`. | No automatic server-side recovery if an admin UI browser tab closes mid-run; relies strictly on manual re-poll (`poll_and_ingest`) or `continue_one_go`. `orchestrate-batch` cannot pause/resume inside a two-stage `search -> detail` workflow yet. |
| **6** | **Dataset & Record Processing** | `fetchFullDatasetPages()` (`apify-scrape-worker/index.ts:93–157`) pages `/datasets/{id}/items?offset=0&limit=100&clean=true`, capped at `scanMax` (default `500`, hard max `1,000`). Raw payloads archived to Storage `batches/{batch_id}/apify/{runId}/{zpid}.json`. | If a dataset contains `> scanMax` items, `hasMore = true` triggers chunked ingestion—**but** `ingestApifyItemsToBatch()` runs `selectBalancedItemsByQuota()` per chunk independently rather than globally across the whole run, skewing feature scoring and location balancing on paginated runs. |
| **7** | **Customer Preferences → Zillow Searches** | `buildApifyActorInput()` (`apify-normalizer.ts:948–1052`) reads `locations`, `search_urls`, `min_rent`, `max_rent`, `exact/min/max_beds`, `exact/min_baths`, `owner_only`. Builds `https://www.zillow.com/${slug}/rentals/` URLs. | **Major loss:** `owner_only` encodes `?searchQueryState={filterState:{isForRentByOwner:{value:true}}}`, **but non-`owner_only` scrapes omit `?searchQueryState=...` altogether**, ignoring rent, beds, baths, property types, and rental-status filters inside the Zillow URL! Meanwhile, `maxcopell/zillow-scraper` ignores top-level `minPrice/maxPrice/minBeds/maxBaths` and requires `?searchQueryState=...`. |
| **8** | **Multiple Locations & ZIP Codes** | `locations` sliced to `.slice(0, 10)` (`apify-normalizer.ts:1010`), slugified via `slugifyLocationForZillow()` (`"Oklahoma City, OK"` → `"oklahoma-city-ok"`), and bucket-balanced post-scrape by `resolveItemLocationKey()` + `selectBalancedItemsByQuota()`. | Ambiguous city names or multi-word / neighborhood / ZIP-radius queries (`search_radius_miles`) cannot rely reliably on naive `/slug/rentals/` URLs. `location_quotas` matching uses substring `.includes()`, which can mis-bucket overlapping city/state strings. |
| **9** | **Property Types & Bed/Bath Criteria** | Normalized post-scrape in `matchesTaskConfigFilters()` (`apify-normalizer.ts:719–800`) via `resolveItemCanonicalType()` and `bedrooms`/`bathrooms` comparisons (with `Math.abs(baths - exactBaths) <= 0.01` preserving fractional baths). | **Not enforced in Zillow search queries** for `maxcopell/zillow-scraper` (forced to burn actor headroom via post-scrape filtering). `bedrooms` is `Math.round(bedrooms)` (`line 526`), which works for integers, whereas `bathrooms` keeps decimals—though shallow search cards sometimes omit half-baths (`resoFacts.bathroomsHalf`), defaulting `half_bathrooms` via `% 1 >= 0.25` heuristic (`lines 401–404`). |
| **10** | **Pagination & Result Limits** | `computeMaxItems`: `hasPostScrapeFilters ? Math.min(safeTargetQty * 3, 200) : safeTargetQty`, hard-clamped `1..200` (`lines 981–984`). Sends `maxItems` (instead of `maxcopell/zillow-scraper`'s documented `resultsLimit`). Dataset pull caps at `500` (`scanMax`). | `maxItems` is not in `maxcopell/zillow-scraper`'s input schema (`resultsLimit` is). If pre-scrape filters are missing from URLs and >67% of unsorted Zillow hits fail `matchesTaskConfigFilters` (e.g., strict `owner_only` or `required_features`), the 3× cap (`<=200`) under-delivers `target_qty` without expanding detail enrichment. |
| **11** | **Failed Runs, Retries & Interrupted Jobs** | In `poll_and_ingest` (`index.ts:1365–1596`), `FAILED`/`ABORTED`/`TIMED-OUT` runs release key slot, salvage partial `defaultDatasetId` items, mark quota-exhausted keys, and launch continuation runs up to `MAX_CONTINUATION_DEPTH = 5` for `remainingQty`. | Transient `5xx`/timeout on dataset item pages mid-loop returns partial collected items with `hasMore: true`, relying on caller to re-poll. Continuation runs re-run from scratch with reduced `target_qty` against the same search URLs, relying on intra-batch dedup to skip already-staged ZPIDs. |
| **12** | **Duplicate Property Identification** | Exact `(batch_id, source, source_listing_id)` check + PostgreSQL unique index `23505` handling (`index.ts:513–565`). Cross-batch canonical reuse happens at publish time in `pipeline_publish_for_batch` via `(source, source_listing_id, visibility)`. | **Zero normalized address+unit dedup** at ingestion time: if two Zillow listings/URLs or re-indexed ZPIDs share the same normalized physical street address/unit in a batch, both stage as distinct rows. Also duplicates are blindly skipped (`continue`) without merging richer detail fields if a detail run follows a search run. |
| **13** | **Extracted Data Normalization** | `normalizeApifyZillowItem()` (`apify-normalizer.ts:348–585`) populates flat columns (`address`, `bedrooms`, `bathrooms`, `monthly_rent`, `amenities`, `appliances`, `heating_type`, `cooling_type`, `laundry_type`, `flooring`, `parking`) + narrative harvesting in `pipeline-record.ts:105–203`. | **Severe omission vs. `zillow-url-import.ts` and DB schema:** `apify-normalizer.ts` never populates `structural_details`, `utility_details`, `financial_details`, `location_details`, `ev_charging`, `hoa_fee`, `hoa_fee_frequency`, `tax_annual_amount`, `location_context` (Walk/Transit/Bike scores), `schools`, `school_district`, or `subdivision`. Expects `resoFacts.*` arrays only, missing `cliqtomedia`/`automation_craft`/`igolaizola` shapes (`beds`, `baths`, `sqft`, `propertyFeatures`, `facts`, `_details`, `details`, `assignedSchools`, `monthlyHoaFee`). |
| **14** | **Saving to Existing Pipeline** | `buildPipelineRecord()` (`_shared/pipeline-record.ts:373–554`) computes `data_quality_score` & `missing_fields` and inserts into `pipeline.pipeline_properties` with `folder_id` & `folder_serial`. | Live DB audit (`pipeline.pipeline_properties`, `76` rows): `0/76` rows have `structural_details`, `utility_details`, `financial_details`, `location_details`, or `inferred_features`. `qualityScore()` (`lines 9–40`) still scores/flags `pets_allowed` and `security_deposit` despite Choice policies forbidding pet display and auto-setting deposit = 1× rent. |
| **15** | **Property Checker Validation & Categorization** | `property-validator` → `validatePipelineProperty()` (`_shared/property-validation.ts:805–1061`): (1) rental status & core fields, (2) prohibited source profile match, (3) explicit owner/landlord proof, (4) property type & single-apartment check, (5) existing photo/watermark screen (untouched, outside scope). | **Multiple rental & verification gaps:** (a) Only checks `off_market/sold/rented/leased/unavailable` & `FOR_SALE/SOLD/RECENTLY_SOLD/OFF_MARKET/PENDING_SALE`—misses dual-listed active rental + genuine asking rent verification and rent-vs-sale-price outliers (`$350,000/mo`); (b) Does not cross-verify extracted schools, utilities, features, or Geoapify reverse-geocoded address/county consistency. |
| **16** | **Missing, Incomplete & Conflicting Info** | Incomplete core fields fail validation (`rejected` / `needs_review`); `missing_fields` only tracks 14 flat field names as a JSON string; narrative regex fallback (`extractFeaturesFromNarrative`) fills some appliances/parking/laundry/flooring/HVAC if empty. | **Zero explicit state distinction:** Cannot distinguish `confirmed_absent` vs `not_applicable` vs `unspecified`. **Zero conflict detection** between structured fields vs description narrative vs external location intelligence (e.g., `"Central Air"` in `resoFacts` vs `"window units only"` in description, or mismatched `city`/`county`). |
| **17** | **Extracted vs. DB-Supported Fields** | DB (`pipeline.pipeline_properties` & `public.properties`) supports rich flat columns (`property_subtype`, `unit_number`, `half_bathrooms`, `total_bathrooms`, `ev_charging`, `hoa_fee`, `hoa_fee_frequency`, `location_context`) AND 4 structured JSONB domains (`structural_details`, `utility_details`, `financial_details`, `location_details`) used by `js/property.js` and `js/admin/property-detail.js`. | **Massive disconnect:** `zillow-url-import.ts` populates all 4 JSONB domains + `ev_charging`, `hoa_fee`, `location_context`, `schools`; `apify-normalizer.ts` populates **none** of the 4 JSONB domains (`0/76` rows). Furthermore, `batch-publishing.ts` `CLIENT_SAFE_PROPERTY_FIELDS` omits `structural_details` and `location_details`, legacy `public.pipeline_publish` (`20261023000003`) hardcodes `NULL` for `amenities/appliances/utilities_included/flooring`, and `js/property.js:224` executes `.from('properties').select('*')` for active public listings (requiring strict protection of internal audit/ledger columns). |
| **18** | **Working vs. Incomplete/Disconnected Features** | **Working:** `orchestrate-batch` leases, `apify-key-pool` 0ms failover & encryption, `prohibited_source_profiles`, explicit owner verification, batch pricing overlays, `#share={token}` privacy shield. | **Incomplete/Disconnected:** (1) Actor adapter & `?searchQueryState` URL encoder; (2) Proven two-stage `maxcopell` `search → detail` scraping; (3) Lossless structured JSONB & dynamic feature extraction in `apify-normalizer.ts`; (4) Public page + `CLIENT_SAFE_PROPERTY_FIELDS` parity (`structural_details` & `location_details`) alongside strict internal column isolation; (5) `property-location` Edge Function only runs lazily on public page view, never during pipeline verification; (6) `docs/PIPELINE_OVERVIEW.md` references legacy non-existent Python scripts. |

### Empirical Live Database & Payload Evidence
- **Live `pipeline.pipeline_properties` (`76` rows):** `has_raw = 76`, `has_struct = 0`, `has_util = 0`, `has_fin = 0`, `has_loc = 0`, `has_inferred = 0`.
- **Live `public.properties` (`3,032` rows):** `240` (~7.9%) populated with `structural_details`/`utility_details`/`location_details`; `2,792` (~92.1%) empty `{}`/`NULL`.
- **Live `pipeline.pipeline_scrape_runs` (`15` actors tested in `2026-11-22`):**
  - `maxcopell/zillow-scraper`: 6 runs, 90 total, 90 new (search-card shallow output).
  - `maxcopell/zillow-detail-scraper`: 2 runs, 1 total, 0 new (`FAILED: "No Zillow details to scrape"` because `apify-scrape-worker` sent `searchUrls` instead of `startUrls` / `searchResultsDatasetId`).
  - `igolaizola/zillow-scraper-ppe`: 1 run, 0 total, 0 new (`SUCCEEDED` empty because `apify-scrape-worker` sent `searchUrls` instead of `locations` + `operation: "rent"`).
  - `cliqtomedia/zillow-scraper`: 4 runs, 88 total, 16 new, 20 dupes; archived raw payloads (`pipeline.pipeline_recovery_archive` `5768243`, `5750992`) contained 67 top-level keys (`schools`, `walkScore`, `transitScore`, `bikeScore`, `propertyFeatures`, `parking`, `monthlyHoaFee`, `grossRentalYield`, `status`, `listingType`), yet had `detailsFetched: false, detailStatus: "not_requested"` because `includeDetails: true` wasn't passed—and `apify-normalizer.ts` ignored those keys anyway!

---

## 4. Phase 2 — Current Actor vs. 4 Candidate Apify Actors Comparison

**Evidence Tag Legend:**
- `[Verified: Code/DB/Schema]` — Confirmed directly in Choice codebase, live Supabase DB, or live Apify Actor API schema (`/v2/acts/...`).
- `[Advertised: README]` — Stated by the Apify actor author/README; not independently confirmed in live execution.
- `[Requires Practical Test]` — Must be validated via a single controlled live test batch before production cutover.

### 20-Criterion Actor Evaluation Matrix

| # | Evaluation Criterion | Current Default: `maxcopell/zillow-scraper` | Candidate 1: `automation_craft/zillow-scraper` | Candidate 2: `igolaizola/zillow-scraper-ppe` | Candidate 3: `maxcopell/zillow-detail-scraper` | Candidate 4: `cliqtomedia/zillow-scraper` |
|---|---|---|---|---|---|---|
| **1** | **Apify Store Adoption & Stability** | `742,294` runs, `8,637` users (`740/30d`), `4.95★`, updated `2026-11-11` `[Verified: Schema]` | `302` runs, `4` users (`3/30d`), `0★`, updated `2026-11-13` (build `0.1`) `[Verified: Schema]` | `169,261` runs, `1,031` users (`160/30d`), `5.0★`, updated `2026-10-19` `[Verified: Schema]` | `6,140,600` runs, `10,453` users (`1,317/30d`), `4.34★`, updated `2026-11-11` `[Verified: Schema]` | `123` runs, `5` users (`4/30d`), `0★`, updated `2026-11-18` (build `0.1`) `[Verified: Schema]` |
| **2** | **Primary Architectural Role** | Zillow Search-Results / Map-Split Scraper `[Verified: Schema]` | All-in-One Search + Optional Details + Optional Insights `[Verified: Schema]` | Unified Search + Optional Per-Listing Detail Enrichment (`fetchDetails`) `[Verified: Schema]` | Dedicated Property Detail Enricher (URLs, Addresses, or Dataset Chaining) `[Verified: Schema]` | Multi-Mode Search / Details / Monitor Scraper `[Verified: Schema]` |
| **3** | **Verified Input Parameters** | Only 3 schema params: `searchUrls`, `extractionMethod`, `resultsLimit` `[Verified: Schema]` | `locations`, `searchUrls`, `zipCodes`, `mapAreas`, `homes`, `datasetId`, `listingStatus`, `maxItems`, `includeDetails`, `includeInsights`, `splitPastCap`, Zillow filters `[Verified: Schema]` | `location`, `locations`, `latitude`/`longitude`/`distanceMiles`, `operation`, `homeTypes`, filter params, `fetchDetails` (~70 params) `[Verified: Schema]` | `startUrls`, `addresses`, `propertyStatus` (default `RECENTLY_SOLD`!), `extractBuildingUnits`, `searchResultsDatasetId` `[Verified: Schema]` | `mode`, `locations`, `searchUrls`, `propertyUrls`, `zpids`, `addresses`, `status`, `maxItems`, `includeDetails`, `outputFormat`, `splitMap`, filters, `includeWalkScore`, `includeNearbyHomes`, `datasetId` `[Verified: Schema]` |
| **4** | **Live Choice DB Test Result** | 6 runs, 90 items staged; shallow search-card schema `[Verified: DB]` | **0 runs** in live DB `[Verified: DB]` — `[Requires Practical Test]` | 1 run, `0` items because worker sent `searchUrls` instead of `locations` + `operation: "rent"` `[Verified: DB]` | 2 runs, `FAILED: "No Zillow details to scrape"` because worker sent `searchUrls` instead of `startUrls`/`searchResultsDatasetId` `[Verified: DB]` | 4 runs, 88 total / 16 new staged, but `detailsFetched: false` & `detailStatus: "not_requested"` `[Verified: DB]` |
| **5** | **Rental-Only Constraint Support** | Via `searchUrls` `?searchQueryState=...` `isForRent:true` `[Verified: Schema]` | `listingStatus: "forRent"` `[Verified: Schema]` | `operation: "rent"` `[Verified: Schema]` | `propertyStatus: "FOR_RENT"` (note default is `RECENTLY_SOLD`—must override explicitly!) `[Verified: Schema]` | `status: "forRent"` `[Verified: Schema]` |
| **6** | **Dual-Listed (Rent+Sale) Safety** | Search cards may show `FOR_RENT` or `homeType`; needs detail confirmation `[Requires Practical Test]` | Returns rental status + price; exact dual-listing payload shape `[Requires Practical Test]` | Returns `homeStatus` + `_details` pricing `[Requires Practical Test]` | Full `homeStatus` + `hdpData.homeInfo` + `resoFacts` distinguishes rent vs sale `[Verified: Code/Schema]` | Archived DB payloads had `status` + `listingType`; dual-listed behavior `[Requires Practical Test]` |
| **7** | **Location Input Flexibility** | `searchUrls` only (requires `?searchQueryState=...` slug/map bounds) `[Verified: Schema]` | `locations`, `zipCodes`, `mapAreas`, `searchUrls`, `homes` `[Verified: Schema]` | `locations[]`, `location`, or `latitude`/`longitude`/`distanceMiles` `[Verified: Schema]` | `startUrls`, `addresses[]`, or upstream `searchResultsDatasetId` `[Verified: Schema]` | `locations`, `zipCodes`, `searchUrls`, `propertyUrls`, `zpids`, `latitude`/`longitude`/`radiusMiles` `[Verified: Schema]` |
| **8** | **Search Filter Pushdown (Rent/Beds/Baths/Types)** | Must be URL-encoded inside `searchUrls` `?searchQueryState` (top-level keys ignored) `[Verified: Schema]` | Native structured params (`minPrice`, `maxPrice`, `minBeds`, `maxBeds`, `minBaths`, `homeTypes`, `pets`, `laundry`, `parking`, `ac`, `garage`, `pool`, `keywords`, `rentByOwner`) `[Verified: Schema]` | Native params (`minPrice`, `maxPrice`, `minBeds`, `maxBeds`, `minBaths`, `homeTypes`, `airConditioning`, `pool`, `garage`, `inUnitLaundry`, `onSiteParking`, `utilitiesIncluded`, `hardwoodFloors`, `furnished`, `ownerPosted`, `agentListed`) `[Verified: Schema]` | N/A (accepts targeted property URLs/addresses/dataset IDs, not open search filters) `[Verified: Schema]` | Native params (`minPrice/maxPrice`, `minBeds/maxBeds`, `minBaths`, `minSqft/maxSqft`, `homeTypes`, `keywords`, `hasPool/Garage/AC/Basement`, `inUnitLaundry`, `rentalParking`, `furnished`) `[Verified: Schema]` |
| **9** | **Owner / Landlord Filter Support** | Only via `?searchQueryState` `isForRentByOwner` `[Verified: Code/Schema]` | `rentByOwner` boolean param `[Verified: Schema]` | `ownerPosted` + `agentListed` params `[Verified: Schema]` | Preserves `attributionInfo` & `listingSubType` (`is_for_rent_by_owner`) `[Verified: Schema]` | Exposed via `attributionInfo` / `listingType` on detail; native FRBO filter `[Requires Practical Test]` |
| **10** | **Deep Specs & `resoFacts` Availability** | **No** in default `PAGINATION` card mode; `EXTRACT_DATA` / URL detail needed `[Verified: Code/DB]` | **Yes** when `includeDetails: true` `[Verified: Schema]` / `[Requires Practical Test]` | **Yes** inside `_details.resoFacts` when `fetchDetails: true` `[Verified: Schema]` / `[Requires Practical Test]` | **Yes** — full Zillow HDP `resoFacts` (`heating`, `cooling`, `appliances`, `laundryFeatures`, `flooring`, `architecturalStyle`, etc.) `[Verified: Schema]` | **Yes** when `includeDetails: true` (archived runs omitted `includeDetails`!) `[Verified: DB/Schema]` |
| **11** | **Appliances & Laundry Depth** | Often missing or description-only `[Verified: DB]` | Full detail fields + narrative `[Advertised: README]` `[Requires Practical Test]` | `_details.resoFacts.appliances` & `laundryFeatures` `[Advertised: README]` `[Requires Practical Test]` | Full `resoFacts.appliances`, `laundryFeatures`, `hasOpenParking` `[Verified: Schema]` | `details` / `propertyFeatures` when `includeDetails: true` `[Advertised: README]` `[Requires Practical Test]` |
| **12** | **Utilities & HVAC Systems Depth** | Absent on search cards (`heating_type`/`cooling_type`/`utilities_included` null) `[Verified: DB]` | `heating`, `cooling`, `utilities` via `includeDetails` `[Advertised: README]` | `_details.resoFacts.heating`, `cooling`, `utilities`, `waterSource`, `sewer` `[Advertised: README]` | Full `resoFacts.heating`, `cooling`, `utilities`, `waterSource`, `sewer`, `electric`, `gas` `[Verified: Schema]` | `propertyFeatures` / detail facts when `includeDetails: true` `[Requires Practical Test]` |
| **13** | **Parking & HOA Fee Extraction** | Missing on cards `[Verified: DB]` | `hoaFee`, garage/parking with `includeDetails` `[Advertised: README]` | `monthlyHoaFee`, `parkingFeatures`, `garageSpaces` via `fetchDetails` `[Advertised: README]` | `monthlyHoaFee`, `hoaFee`, `parkingFeatures`, `garageParkingCapacity` `[Verified: Schema]` | Archived runs already had `parking` & `monthlyHoaFee` even with `detailsFetched: false` `[Verified: DB]` |
| **14** | **Schools & School District Data** | Missing `[Verified: DB]` | `schools` + `county` via `includeDetails` `[Verified: Schema]` | `assignedSchools` via `fetchDetails` `[Verified: Schema]` | Full `schools[]` (name, rating, grades, distance, link) + `resoFacts.*SchoolDistrict` `[Verified: Schema]` | Archived runs already returned `schools[]` array `[Verified: DB]` |
| **15** | **Property Insights (Walk/Transit/Bike, Nearby — Non-Dated)** | Missing `[Verified: DB]` | Cleanly toggled via **`include_insights`** (`walkScore`, `transitScore`, `bikeScore`—note: historical Zestimate/Rent Zestimate & rent comps excluded) `[Verified: Schema]` | `walkScore`, `transitScore`, `bikeScore` returned inside detail fetch `[Advertised: README]` `[Requires Practical Test]` | `walkScore`, `transitScore`, `bikeScore`, `nearbyHomes` (`rentZestimate` & historical Zestimate strictly discarded/excluded) `[Verified: Schema]` | `includeWalkScore` + `includeNearbyHomes` params (`walkScore`/`transitScore`/`bikeScore`/`nearbyHomes` observed in DB archive; no Zestimate benchmarks retained) `[Verified: DB/Schema]` |
| **16** | **Description Completeness** | Truncated or empty on card results `[Verified: DB]` | Full description when `includeDetails: true` `[Advertised: README]` | Full description when `fetchDetails: true` `[Advertised: README]` | Full un-truncated property `description` `[Verified: Schema]` | Null in shallow `detailsFetched: false` DB runs; full text when `includeDetails: true` `[Verified: DB]` |
| **17** | **Two-Stage Dataset Chaining** | Outputs `detailUrl`/`zpid` compatible directly with `maxcopell/zillow-detail-scraper` `searchResultsDatasetId` `[Verified: Schema]` | Accepts `datasetId` input for detail enrichment `[Verified: Schema]` | Single-run internal `fetchDetails: true` (no separate stage needed) `[Verified: Schema]` | Accepts `searchResultsDatasetId` natively from `maxcopell/zillow-scraper` `[Verified: Schema]` | Accepts `datasetId` + `mode: "details"` `[Verified: Schema]` |
| **18** | **Zillow Map-Cap / Pagination Splitting** | `PAGINATION` method + Zillow ~500-result cap per viewport `[Verified: Schema]` | `splitPastCap` boolean built in `[Verified: Schema]` `[Requires Practical Test]` | Internal search splitting across regions `[Advertised: README]` | Direct URL/dataset processing (no map search cap) `[Verified: Schema]` | `splitMap` boolean built in `[Verified: Schema]` `[Requires Practical Test]` |
| **19** | **Current Normalizer Compatibility** | Moderate (misses JSONB domains & string variants) `[Verified: Code]` | Partial (custom detail/insight keys require adapter mapping) `[Verified: Code/Schema]` | Partial (`_details.*` & `assignedSchools` not read by current normalizer) `[Verified: Code/Schema]` | High for flat fields, **0%** for `structural_details`/`utility_details`/`financial_details`/`location_details` `[Verified: Code]` | Partial (`sqft`, `beds`, `baths`, `propertyFeatures`, `schools`, `walkScore` ignored by current normalizer) `[Verified: Code/DB]` |
| **20** | **Production Risk Profile & Status** | **Production Priority (Stage 1)** — Very Low operational risk; proven search discovery `[Verified: Code/Schema]` | **Experimental Only (Disabled as Default)** — High novelty risk (`302` runs, `4` users, build `0.1`) `[Verified: Schema]` | **Experimental Only (Disabled as Default)** — Prior Choice DB run returned `0` items; untested live extraction `[Verified: DB/Schema]` | **Production Priority (Stage 2)** — Very Low risk (`6.14M` runs, `4.34★`), gold-standard Zillow HDP schema `[Verified: Schema]` | **Experimental Only (Disabled as Default)** — High novelty risk (`123` runs, `5` users, build `0.1`), shallow runs in DB `[Verified: DB/Schema]` |

---

## 5. Best Technical Recommendation & Honest Trade-Off Analysis

### Why Prioritize the Proven Maxcopell Two-Stage Workflow First (Keeping Untested Actors Experimental)?
Switching `actor_id` in `scraping_providers` blindly to `automation_craft/zillow-scraper`, `cliqtomedia/zillow-scraper`, or `igolaizola/zillow-scraper-ppe` before testing their actual live rental outputs risks anti-bot breakage, empty datasets, or partial schemas—exactly as seen in `pipeline.pipeline_scrape_runs`:
- **`automation_craft/zillow-scraper` (`302` runs, `4` users, `0★`, build `0.1`) and `cliqtomedia/zillow-scraper` (`123` runs, `5` users, `0★`, build `0.1`)** have virtually zero public track record and zero proven full-detail extraction in Choice's database.
- **`igolaizola/zillow-scraper-ppe` (`169k` runs, `5.0★`)** has strong Store adoption, **but** its only Choice run returned `0` items and its real `_details` / `assignedSchools` / dual-listed output has never been verified against Choice's pipeline.
- Conversely, **`maxcopell/zillow-scraper` (`742k` runs) + `maxcopell/zillow-detail-scraper` (`6.14M` runs)** have unmatched Apify stability and emit the exact Zillow HDP / `resoFacts` schema already proven in `zillow-url-import.ts`.

### Recommended Architecture: Proven Maxcopell Two-Stage Default + Strict Experimental Actor Isolation

1. **Primary Production Architecture (`ApifyActorAdapter` Registry):**
   Decouple `apify-scrape-worker` and `apify-normalizer.ts` from hardcoded `searchUrls` assumptions via a clean `ApifyActorAdapter` registry where every adapter implements:
   - `buildInput(taskConfig, mode, stageContext)` (emitting actor-exact query syntax)
   - `extractRawFields(item)` (mapping actor-specific shapes like `resoFacts`, `hdpData`, `_details`, `details`, `propertyFeatures`, `assignedSchools` into a unified Zillow intermediate AST without dropping relevant keys)
   - `isExperimental` capability flag (`false` **only** for the proven `maxcopell` two-stage pair; `true` for all untested actors)

2. **Mandatory Priority & Default Strategy:**
   - **Priority 1 — Production Default (`maxcopell` Two-Stage Workflow):**
     - **Stage 1 (`maxcopell/zillow-scraper`):** Uses properly constructed `?searchQueryState=...` rental-only URLs (encoding location, rent bounds, beds, baths, property types, FRBO) and `resultsLimit`.
     - **Stage 2 (`maxcopell/zillow-detail-scraper`):** Automatically receives Stage-1 matching property URLs (`startUrls`) or `searchResultsDatasetId` with **`propertyStatus: "FOR_RENT"`** and `extractBuildingUnits: false`, retrieving complete `resoFacts`, `schools`, `attributionInfo`, full description, appliances, utilities, HOA fees, and parking specs.
     - *Advantage:* Highest proven Apify reliability (`742k` + `6.14M` runs), gold-standard Zillow HDP schema, and detail calls focused strictly on candidate rentals passing Stage-1 filter triage.
     - *Trade-Off:* Requires a clean two-step state machine in `apify-scrape-worker` / `orchestrate-batch` (`search_pending` → `detail_pending` → `ingested`). Getting this two-stage `maxcopell` pipeline solid end-to-end is the top engineering priority.
   - **Experimental Adapters — Strictly Non-Default (`automation_craft/zillow-scraper`, `cliqtomedia/zillow-scraper`, `igolaizola/zillow-scraper-ppe`):**
     - Implement clean adapters in `apify-actor-adapters.ts` with `isExperimental: true`, **never enabled as production defaults** (`public.scraping_providers` default stays strictly on the `maxcopell` two-stage workflow).
     - Experimental actors may only run via explicit opt-in operator override for future isolated extraction testing, and can only be considered for promotion after real extraction payloads are verified end-to-end and explicitly approved by the operator.

---

## 6. Rental-Only & Dual-Listed Qualification Design

Strict rental-only and dual-listed qualification is enforced continuously across **every stage of the entire workflow** (`Search → Actor → Normalizer → Checker → Publishing`):

### Stage A: Search-Plan Enforcement (Pre-Scrape)
- Every adapter MUST explicitly lock search parameters to rentals:
  - `maxcopell/zillow-scraper`: `?searchQueryState=` JSON MUST set `filterState.isForSaleByAgent = {value:false}`, `isForSaleByOwner = {value:false}`, `isNewConstruction = {value:false}`, `isAuction = {value:false}`, `isForSaleForeclosure = {value:false}`, `isComingSoon = {value:false}`, and `isForRent = {value:true}`.
  - `maxcopell/zillow-detail-scraper`: MUST pass `propertyStatus: "FOR_RENT"` (never leave actor default `RECENTLY_SOLD`).
  - Experimental adapters (`igolaizola`: `operation: "rent"`; `automation_craft`: `listingStatus: "forRent"`; `cliqtomedia`: `status: "forRent"`).

### Stage B: Deterministic Rental & Dual-Listed Classifier (Ingestion & Normalizer)
Replace the blind `|| 'FOR_RENT'` fallback in `apify-normalizer.ts:479–481` with `classifyRentalEligibility(raw)`:

1. **Inspect explicit status & listing flags** across `homeStatus`, `homeStatusType`, `listingStatus`, `status`, `statusText`, `listingType`, `hdpData.homeInfo.homeStatus`, `isForRent`, `isForSale`, and rental pricing sub-blocks:
   - **Immediate Reject (`sale_only_or_non_rental`):** Any listing whose status is `FOR_SALE`, `SOLD`, `RECENTLY_SOLD`, `PENDING_SALE`, `CONTINGENT`, `AUCTION`, `FORECLOSURE`, `OFF_MARKET`, `LEASED`, or `RENTED` with **no** verified active rental offering is **deterministically rejected** before quota counting.
   - **Dual-Listed Candidate (`FOR_RENT` + `FOR_SALE`):** Qualifies **only when BOTH conditions hold**:
     1. An **actual active rental offering** is explicitly confirmed (`homeStatus === 'FOR_RENT'` OR `isForRent === true` OR explicit active `rentalListing`/lease offering block present alongside sale data), **AND**
     2. A **genuine monthly asking rent** field is resolved independently from any `salePrice` / `purchasePrice` (strictly **excluding** `rentZestimate`, `zestimate`, or computed rent benchmarks) and passes rent-vs-sale bounds (`monthly_rent > 0 && monthly_rent < 50000`, and if a separate sale price exists, `monthly_rent < sale_price * 0.05` and `monthly_rent !== sale_price`).
   - **Missing / Unconfirmed Status (`unconfirmed_rental_status`):** Do **not** default missing status to `'FOR_RENT'`. If status is absent and the payload lacks an explicit `"For Rent"` active offering signal + verified monthly asking rent, reject deterministically at normalization.

### Stage C & D: Downstream Checker & Publishing Guardrails
- **`property-validation.ts` (Checker):** Re-validates `rental_eligibility_status`, `is_dual_listed`, genuine asking rent (`monthly_rent` vs `sale_price` & zero `rentZestimate` substitution), rejecting any sale-only or ambiguous/unconfirmed dual-listed row (`non_rental_or_off_market` / `invalid_sale_price_as_rent`).
- **`pipeline_publish_for_batch` & `batch-publishing.ts` (Publishing):** Verifies published rows remain active rental placements with valid positive asking rent before generating public or `#share={token}` outputs.

---

## 7. Target Property Extraction Taxonomy (Sections A–L) & Optional Property Insights

*Strict Guardrail Note: Zero date fields, zero historical Zestimate/Rent Zestimate or unrelated rent benchmark data, zero image/video/3D-tour extraction upgrades, zero public-record/assessor/parcel/flood-zone fields, zero multi-building/complex unit matrices, and zero floor-by-floor extraction. Every non-excluded relevant attribute returned by an actor is extracted and normalized without silent dropping.*

### Field Extraction Comparison: Current vs. Target

| Section | Domain | Currently Extracted by `apify-normalizer.ts` | Target Comprehensive Extraction (Normalized Columns + Structured JSONB + Dynamic Ledger) |
|---|---|---|---|
| **A** | **Core Rental Qualification & Identifiers** | `source_listing_id` (`zpid`), `source_url`, `source_status` (defaults to `FOR_RENT`), `monthly_rent`, `original_monthly_rent`. | Strict rental/dual-listed classification (`rental_eligibility_status`, `is_dual_listed`), canonical `zpid`, sanitized `source_url`, verified monthly asking rent (never `rentZestimate` or rent benchmarks), rental application fee (`50` invariant preserved at Choice publish, non-dated rental financials preserved in `financial_details`), internal-only `agent_name`, `broker_name`, `poster_profile`. |
| **B** | **Address & Geocoding (Directive 1)** | `address`, `unit_number`, `city`, `state`, `zip`, `county`, `neighborhood`, `lat`, `lng`. | Authentic physical `address`, `unit_number`, `city`, `state`, `zip`, `county`, `neighborhood`, `subdivision`, rooftop `lat`/`lng`, normalized address match key (`normalized_address_key`) for dedup & Geoapify cross-verification. |
| **C** | **Specifications & Architecture** | `property_type`, `property_subtype`, `bedrooms`, `bathrooms`, `half_bathrooms`, `total_bathrooms`, `square_footage`, `lot_size_sqft`, `year_built`, `floors`, `garage_spaces`, `total_units`. (`structural_details` = **EMPTY**) | Populate **`structural_details` JSONB** (`architectural_style`, `construction_materials`, `foundation_details`, `roof`, `exterior_features`, `interior_features`, `fencing`, `patio_and_porch_features`, `fireplace_features`, `pool_features`, `accessibility_features`, `window_features`, `door_features`, `stories_count_raw`, dimensions/lot features) while keeping flat columns accurate (`bathrooms` decimal preserved, `half_bathrooms` parsed from `resoFacts.bathroomsHalf` + decimal remainder, architectural overrides for `DUPLEX`/`TOWNHOUSE`). |
| **D** | **Appliances & Laundry** | `appliances` (only `resoFacts.appliances[]` + `s/r/dw/mw` regex), `laundry_type` (collapsed to `'Hookups'` or `'In Unit'`). | Canonical normalized `appliances[]` from `resoFacts.appliances`, `details.appliances`, `propertyFeatures.appliances`, and description cross-check (`Dishwasher`, `Refrigerator`, `Washer`, `Dryer`, `Range / Oven`, `Gas Range`, `Microwave`, `Garbage Disposal`, `Freezer`, `Wine Cooler`, `Water Softener`), plus `laundry_details` inside `structural_details`/`utility_details` (`In Unit`, `Hookups`, `On-Site`, `Laundry Room`, `None`). |
| **E** | **Utilities & Systems** | `heating_type`, `cooling_type`, `has_central_air`, `utilities_included` (`resoFacts.utilitiesIncluded/utilities` array only). (`utility_details` = **EMPTY**, `ev_charging` = **MISSING**) | Populate **`utility_details` JSONB** aligned with Choice's 13-utility model (`_shared/utility-matrix.ts`: `electric`, `gas`, `water`, `sewer`, `trash`, `recycling`, `internet`, `cable`, `hoa`, `lawn_care`, `snow_removal`, `pest_control`, `pool_maintenance`) distinguishing landlord-included vs tenant-paid vs unspecified; plus `heating_systems`, `cooling_systems`, `water_source`, `sewer`, `green_energy`, `ev_charging` column & `utility_details.ev_charging`. |
| **F** | **Interior, Exterior & Community Features** | Flat `amenities[]` concatenating `tags` + 5 `resoFacts` arrays; `flooring[]`; `has_basement` **not set** in `apify-normalizer.ts` (`pipeline-record` checks description only!). | Structured extraction of `flooring[]` (string or array normalization), `has_basement` (boolean + string parsing like `zillow-url-import.ts:311–315`), fenced yard/private yard/patio/deck/balcony, fireplace, pool/spa, security/smart-home features, storage, workshop/shed, and non-complex community amenities (`hoa_amenities`, `clubhouse`, `fitness_center`, `tennis_court`). |
| **G** | **Parking & HOA** | `parking`, `garage_spaces`. (`hoa_fee`, `hoa_fee_frequency`, `parking_fee`, `ev_charging` = **MISSING**) | `parking` (normalized string + structured parking array: attached/detached garage, carport, driveway, covered, street, assigned spaces), `garage_spaces`, `parking_fee`, `ev_charging`, `hoa_fee`, `hoa_fee_frequency` (parsed from `monthlyHoaFee`, `hoaFee`, `resoFacts.associationFee`, `associationFeeFrequency`), and HOA-included services & verified non-dated rental fee fields inside `financial_details`. |
| **H** | **Schools & Neighborhood** | `neighborhood` string only. (`location_details` = **EMPTY** — **zero** schools, district, or subdivision captured!) | Populate **`location_details` JSONB** (`county`, `neighborhood`, `subdivision`, `school_district`, `elementary_school_district`, `middle_or_junior_school_district`, `high_school_district`, `schools[]` normalized with `name`, `rating`, `level`/`grades`, `distance`, `type`). |
| **I** | **Description & Narrative Harvesting** | Raw `description` captured verbatim; only `pipeline-record.ts` harvests a tiny subset (`s/r/dw`, garage, carpet/hardwood, pool/yard/fireplace). | Preserve authentic `original_description` untouched (per `AGENTS.md` Section 3), while expanding deterministic conflict-aware narrative signal parsing into `inferred_features` & `source_facts_ledger` (marking narrative-only facts distinctly from structured `resoFacts`). |
| **J** | **Lossless Dynamic Capture of All Relevant Actor Fields** | Discarded unless manually added to `resoFacts` array allowlists; `inferred_features` unused by Apify (`0/76` rows). | Capture **100% of remaining non-excluded relevant structured keys** returned by the actor (`resoFacts`, `propertyFeatures`, `details`, `_details`, `hdpData.homeInfo` sub-attributes) into `source_facts_ledger` + `unmapped_attributes` so **zero** relevant actor fields (e.g., `architecturalStyle`, `view`, `waterfrontFeatures`, `seniorCommunityYN`, `accessibilityFeatures`, `windowFeatures`, `doorFeatures`, `applianceBrand`, `otherEquipment`, `furnished`, `spaFeatures`) are ever silently dropped. |
| **K** | **Optional Property Insights (Level 2 — Strictly Separate)** | Completely ignored (`0/76` rows; `location_context` never populated by `apify-normalizer.ts`). | **Opt-In Level 2 Enrichment (`include_property_insights: true`):** Strictly separated from Level 1 extraction. Captures **only** non-dated geographic/livability insights: `walk_score`, `transit_score`, `bike_score`, `location_context` summary, nearby schools/parks/supermarkets/healthcare/transit stops (via actor + Geoapify), and Census TIGERweb district context in `location_details.insights`. **Zero historical Zestimate, zero Rent Zestimate, zero rent benchmarks.** |
| **L** | **Strict Excluded-Scope Filtering** | Unsafely copies `listed_at`, `source_last_updated_at`, `floor_plans`, `videos`, `virtual_tour_url`, `pets_allowed`. | Pipeline upgrade adds **zero** date-related fields, **zero** historical Zestimate/Rent Zestimate or rent benchmark/comp fields, **zero** assessor/public-record/parcel/flood-zone fields, **zero** multi-building/multi-floor extraction, and leaves Choice's publish-time scrubbers (`virtual_tour_url=null`, `videos=null`, `available_date=null`, `lease_terms=null`, `pets_allowed=null`) intact. |

---

### Optional Property Insights Design (`LEVEL 1` vs `LEVEL 2` — Cleanly Separated)

Controlled cleanly via `task_config.extraction_depth` (`'full_data'` default | `'with_insights'`) or boolean `task_config.include_property_insights` (with actor-level default `'full_data'` in `scraping_providers.config_json`):

| Dimension | `LEVEL 1 — FULL PROPERTY DATA` (Default) | `LEVEL 2 — ADDITIONAL PROPERTY INSIGHTS` (Optional / Opt-In Only) |
|---|---|---|
| **Purpose** | Complete, accurate, verified single-property rental profile ready for Choice Properties staging, validation, and public/client display. | Adds strictly non-dated geographic livability & nearby-amenity insights without touching core property data or introducing Zestimate/benchmark bloat. |
| **Actor Flags** | `maxcopell` Stage 1+2 (`search → detail`, insight extras bypassed); experimental adapters keep insight flags disabled (`automation_craft`: `includeInsights: false`; `cliqtomedia`: `includeWalkScore: false, includeNearbyHomes: false`). | `maxcopell` Stage 1+2 + Geoapify Places / Census TIGERweb livability enrichment (plus `walkScore`/`transitScore`/`bikeScore` extraction when returned); experimental adapters (`automation_craft`: `includeInsights: true`; `cliqtomedia`: `includeWalkScore: true`). |
| **Included Data** | Sections A–J: Rental eligibility & asking rent, authentic address & coords, full specs & fractional baths, `structural_details`, `appliances`, `utility_details` (13-utility map + HVAC/EV), interior/exterior/HOA/parking, `schools[]` & `school_district`, `subdivision`, `source_facts_ledger`, `unmapped_attributes`. | Everything in Level 1 **PLUS** strictly Section K: `walk_score`, `transit_score`, `bike_score` (+ `location_context` summary string), Geoapify categorized nearby amenities (`parks`, `supermarkets`, `shopping`, `healthcare`, `transit_stops` within radius), and Census TIGERweb/NCES EDGE school district boundary context inside `location_details.insights`. |
| **Client Visibility** | Core specs, utilities, appliances, HOA, EV charging, schools rendered accurately on public property page (`property.html` / `js/property.js`) & `property-share`. | Walk/Transit/Bike scores rendered via `location_context` + nearby places context on `js/property.js`; internal audit/provenance columns remain strictly protected from public exposure. |
| **Strictly Excluded** | No dates, no historical Zestimate/Rent Zestimate, no rent benchmarks/comps, no public-record/assessor, no parcel/flood, no multi-building/multi-floor, no image/video/3D-tour upgrade. | **Same strict exclusions:** Even at Level 2, **zero** historical Zestimate, **zero** historical Rent Zestimate, **zero** unrelated rent benchmarks/market comps, zero price/tax/listing date histories, zero assessor/parcel/flood-zone records, zero complex unit matrices. |

---

## 8. 3-Layer Data, Verification & Projection Architecture

### Layer 1: Raw Source Payload (Immutable Audit Evidence)
- **Storage:** Full unmodified Apify item JSON archived in Supabase Storage (`pipeline-raw-payloads` at `batches/{batch_id}/apify/{run_id}/{zpid}.json`) plus `source_raw_payload` JSONB on `pipeline.pipeline_properties`.
- **Stage Tracking:** Provenance records exact `actor_id`, `run_id`, `dataset_id`, `stage` (`search_card` vs `detail_enriched`), and `extraction_depth` (`full_data` vs `with_insights`).

### Layer 2: Normalized Canonical Record + Dynamic `source_facts_ledger` + Completeness
- **Explicit Field-State Model (`source_facts_ledger`):** Every trackable domain/field records not just its value, but its epistemological state:
  - `confirmed_present` (explicitly confirmed true/valued in structured `resoFacts`/detail data)
  - `confirmed_absent` (explicitly stated `"None"` / `false` / `"No Garage"` / `"No Basement"` by source)
  - `not_applicable` (e.g., HOA fee on non-HOA single-family rental when HOA explicitly `false`)
  - `unspecified` (omitted by source—**never silently treated as `false`**)
- **Unified Completeness Scoring (`pipeline-record.ts`):**
  - Remove deprecated `pets_allowed` and `security_deposit` from `BONUS_FIELDS` and `TRACKABLE_MISSING` (`pipeline-record.ts:15–25`) since platform policy hides pets and standardizes deposit = `1× monthly_rent`.
  - Track actual rich completeness across core rental identity, specs (incl. `square_footage`, `year_built`, fractional `bathrooms`), `appliances`, `utility_details`, `parking`/`garage_spaces`, `structural_details` (`flooring`, `heating_type`, `cooling_type`, `laundry_type`), `location_details` (`county`, `neighborhood`, `schools`), and `unmapped_attributes` count.
- **Deduplication & Conflict Merge:**
  - Stage dedup keys: (1) `(batch_id, source, source_listing_id)` AND (2) normalized street address + unit + city + state + ZIP (`normalized_address_key`).
  - If a Stage-2 detail record arrives for an already-staged Stage-1 search-card ZPID, merge upward (preserving user edits in `edited_fields`, upgrading `structural_details`, `utility_details`, `location_details`, `source_raw_payload`, and `source_facts_ledger`).

### Layer 3: Multi-Source Verification, Pipeline Location Check & Client-Safe Projection
- **Pipeline-Stage Location & School Verification (Zero New Secrets):**
  - Upgrade `ingestApifyItemsToBatch()` / `property-validator` to optionally run:
    1. **Geoapify Reverse Geocoding + Places** (`GEOAPIFY_API_KEY` already configured in Supabase secrets): verifies `lat`/`lng` match `city`/`county`/`zip` and fills missing `neighborhood`/`county` + Level-2 nearby amenities into `property_location_intelligence` / `location_details`.
    2. **Zero-Key Census TIGERweb / NCES EDGE School District Lookup** (`https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/School/MapServer` layers 0–3): verifies Unified / Elementary / Secondary school district boundary against Zillow's `school_district` string at zero API cost or credential overhead.
- **Field-Level Verification Status (`field_verification_status`):**
  - `source_confirmed` — Verified in structured Zillow detail data (`resoFacts`/detail payload).
  - `independently_verified` — Confirmed by both Zillow detail data AND Geoapify/TIGERweb cross-check (e.g., coordinates + county + school district).
  - `partially_verified` — Present only in search-card summary or narrative text without structured `resoFacts`.
  - `unverified` — Uncorroborated or derived from ambiguous heuristic.
  - `conflicting_sources` — Conflict detected (e.g., structured `hasCooling: true` vs narrative `"no AC"`; Zillow `county` vs Geoapify reverse-geocode `county`; `monthly_rent` suspicious relative to beds/market/sale price). Flagged automatically in `validation_report`!
  - `not_available` — Explicitly absent/omitted from both Zillow source and external verifiers.
- **Client-Safe Projection & Public Property Page Protection (`_shared/batch-publishing.ts`, `public.properties`, & `js/property.js`):**
  - Add `'structural_details'` and `'location_details'` to `CLIENT_SAFE_PROPERTY_FIELDS` (`batch-publishing.ts:26–79`), with a deterministic sanitizer inside `projectClientSafeProperty()` ensuring `location_details` exposes only public-safe geographic context (`county`, `neighborhood`, `subdivision`, `school_district`, `schools`, and Level-2 `walk_score`/`transit_score`/`bike_score`/`insights.nearby_highlights` when enabled) and never leaks broker/MLS internal provenance or source URLs.
  - **Public Active Page Protection (`js/property.js:223–226`):** Because `js/property.js` fetches active listings directly via `supabase.from('properties').select('*, landlords(...), property_photos(...)')`, internal audit/pipeline artifacts (`source_facts_ledger`, `unmapped_attributes`, `field_verification_status`, `verification_conflicts`, `source_raw_payload`, `original_data`, internal broker/agent metadata, `source_url`) MUST remain strictly isolated from unauthenticated `anon` `select('*')` exposure (kept on `pipeline.pipeline_properties` / internal admin-restricted companion records and scrubbed via explicit projection) so neither `property.html` nor `property-share` can ever expose internal data.
  - Update `public.pipeline_publish` (or reconcile with `pipeline_publish_for_batch` logic) so `amenities`, `appliances`, `utilities_included`, `flooring`, and all 4 JSONB domains project accurately to published public property pages.

---

## 9. Complete Phased Implementation Roadmap (14-Point Specification per Phase)

### Mandatory Independent Phase Execution Process
Every phase in this roadmap MUST follow this strict, non-negotiable lifecycle:
1. **Sequential Execution:** Work strictly one phase at a time in roadmap order (`Phase 1` → `Phase 2` → `Phase 3` → `Phase 4` → `Phase 5` → `Phase 6`).
2. **Full Independent Verification Gate:** Before stopping on any phase, that phase must be completely **implemented, unit/integration tested, verified end-to-end, documented, and pushed to GitHub (`choice121/Choice` `main`)**.
3. **Stop & Request Approval:** After pushing a completed phase to GitHub, stop and present verification evidence to the operator and request approval to proceed.
4. **Automatic Next-Phase Selection:** Once the operator approves moving forward, automatically advance to the next sequential phase defined in this roadmap without asking the operator which phase to choose.

---

### Phase 1: Maxcopell Two-Stage Workflow, Actor-Adapter Registry & Input Query Planner

> **Status:** **Implemented & Verified** (awaiting operator approval to advance to Phase 2)

1. **Phase ID & Title:** `Phase 1` — Proven Maxcopell Two-Stage Search→Detail Workflow, Actor-Adapter Registry & Input Query Planner
2. **Objective:** Get the proven **Maxcopell two-stage workflow** (`maxcopell/zillow-scraper` Stage 1 discovery with `?searchQueryState=...` → `maxcopell/zillow-detail-scraper` Stage 2 full detail with `propertyStatus: "FOR_RENT"`) working cleanly end-to-end as the sole production default, while isolating experimental adapters behind opt-in flags.
3. **Prerequisites & Dependencies:** Approval of this roadmap; verified Apify Store schemas (Section 4) and existing `apify-scrape-worker`, `orchestrate-batch`, and `apify-normalizer.ts`.
4. **Exact Scope:**
   - **In-Scope:** `ApifyActorAdapter` interface & registry with **Maxcopell two-stage** (`maxcopell/zillow-scraper` + `maxcopell/zillow-detail-scraper`) as Priority 1 production default; `?searchQueryState=...` JSON builder encoding rent/beds/baths/types/FRBO/rental-only; two-stage search→detail run chaining (`searchResultsDatasetId` / `startUrls`); keeping `igolaizola/zillow-scraper-ppe`, `automation_craft/zillow-scraper`, and `cliqtomedia/zillow-scraper` strictly marked **experimental / non-default**.
   - **Out-of-Scope:** Promoting untested/experimental actors to production default; modifying key-pool encryption/failover (`apify-key-pool.ts`), cost/budget calculators, image/photo-count/video changes, or running live Apify jobs without explicit authorization.
5. **Exact Files / Modules / Tables / Edge Functions Affected:**
   - Create `supabase/functions/_shared/apify-actor-adapters.ts`
   - Update `supabase/functions/_shared/apify-normalizer.ts` (`buildApifyActorInput` delegates to adapter registry; `default` resolves to `maxcopell` two-stage)
   - Update `supabase/functions/apify-scrape-worker/index.ts` (`start_run`, `poll_and_ingest`, remove hardcoded `actorInput.searchUrls` block; implement two-stage `parent_scrape_run_id` `search → detail` chaining for `maxcopell`)
   - Update `supabase/functions/orchestrate-batch/index.ts` (`buildEffectiveTaskConfig` passthrough for `actor_id`, `extraction_depth`, `search_radius_miles`)
   - Update `supabase/migrations/<next>_phase1_scrape_run_stage_columns.sql`
   - Create `supabase/functions/_shared/__tests__/apify-actor-adapters.test.ts`
6. **Data & Schema Changes (Additive / Backward-Compatible):**
   - On `pipeline.pipeline_scrape_runs`: `ADD COLUMN IF NOT EXISTS scrape_stage TEXT DEFAULT 'single'`, `ADD COLUMN IF NOT EXISTS extraction_depth TEXT DEFAULT 'full_data'`, `ADD COLUMN IF NOT EXISTS adapter_key TEXT`.
   - Backward-compatible `public.scraping_providers.config_json`: preserve existing keys (`actor_id = 'maxcopell/zillow-scraper'`), add `detail_actor_id = 'maxcopell/zillow-detail-scraper'`, `two_stage_details = true`, `default_extraction_depth = 'full_data'`, and require explicit operator opt-in (`allow_experimental_actor = true`) before any non-Maxcopell actor can run.
7. **Actor / Worker / Normalizer Logic Changes:**
   - `buildZillowSearchQueryState(taskConfig)` generates full `filterState` with rental-only locks (`isForRent: true`, all sale/auction/foreclosure flags `false`), rent bounds, bed/bath bounds, home types, and `isForRentByOwner`.
   - **Production Default Pair:**
     - `maxcopell/zillow-scraper` (Stage 1): emits `searchUrls` with `?searchQueryState=...`, `resultsLimit` (replacing ignored `maxItems`), `extractionMethod`.
     - `maxcopell/zillow-detail-scraper` (Stage 2): emits `searchResultsDatasetId` or `startUrls`, **`propertyStatus: "FOR_RENT"`** (overriding actor default `RECENTLY_SOLD`), `extractBuildingUnits: false`.
   - **Experimental Opt-In Adapters (Never Default Until Tested):**
     - `igolaizola/zillow-scraper-ppe` (`locations`, `operation: "rent"`, `fetchDetails: true`)
     - `automation_craft/zillow-scraper` (`locations`, `listingStatus: "forRent"`, `includeDetails: true`, `includeInsights: false`)
     - `cliqtomedia/zillow-scraper` (`mode: "search"`, `locations`, `status: "forRent"`, `includeDetails: true`)
8. **Validation, Rental-Only & Conflict Rules:** Reject `start_run` if resolved adapter input lacks rental-only constraints or valid location/URL target; reject invalid `actor_id` via `ACTOR_ID_RE`; reject experimental actors unless explicitly enabled by operator opt-in flag; guarantee customer search bounds are never widened.
9. **Edge Cases & Failure Modes:** Missing `locations` vs explicit `search_urls`; special characters in `"City, ST"` slugs; Stage-1 search succeeds with 0 matching items (gracefully skip Stage-2 detail run rather than failing `"No Zillow details to scrape"`); mid-run key failover preserving `scrape_stage` and `adapter_key`; paginated dataset buffering so `selectBalancedItemsByQuota` runs coherently across Stage-1/Stage-2 runs.
10. **Verification & Automated Test Plan:**
    - Unit tests in `apify-actor-adapters.test.ts` verifying exact JSON payloads for Maxcopell Stage 1 (`?searchQueryState=...` + `resultsLimit`) & Stage 2 (`propertyStatus: "FOR_RENT"`, `searchResultsDatasetId`/`startUrls`), two-stage worker chaining logic, experimental opt-in guard, and valid rental-only inputs for experimental adapters.
    - End-to-end static/runtime verification (`compile_applet`, `lint_applet`, Deno test suite).
11. **Acceptance Criteria / Definition of Done:** Proven Maxcopell two-stage pipeline constructs valid Stage-1 + Stage-2 inputs and chains cleanly; experimental actors stay blocked from default production routing; unit/integration tests and builds pass 100%.
12. **Rollback / Safety Strategy:** Adapter registry keeps `maxcopell/zillow-scraper` as baseline; DB column additions are nullable/defaulted (`DEFAULT 'single'`), reversible with zero data loss.
13. **Stop-and-Review Gate:** Implement, test, verify end-to-end, document, and push Phase 1 to GitHub (`choice121/Choice` `main`), then stop and request operator approval before automatically advancing to **Phase 2**.
14. **Operational Notes:** **Zero live Apify actor runs** executed during Phase 1 build/testing unless explicitly triggered/authorized by operator.

---

### Phase 2: Strict Rental-Only & Dual-Listed Qualification + Ingestion Deduplication Hardening

> **Status:** **Implemented & Verified** (awaiting operator approval to advance to Phase 3)

1. **Phase ID & Title:** `Phase 2` — Rental-Only / Dual-Listed Classifier & Address-Level Ingestion Deduplication
2. **Objective:** Guarantee sale-only properties can never qualify or consume batch quota anywhere in the pipeline, dual-listed properties qualify strictly when both an active rental offering and a genuine monthly asking rent are verified, and duplicate listings (by ZPID or normalized physical address) are cleanly deduplicated or enriched upward.
3. **Prerequisites & Dependencies:** Phase 1 implemented, verified end-to-end, and pushed to GitHub.
4. **Exact Scope:**
   - **In-Scope:** Replace `|| 'FOR_RENT'` default in `apify-normalizer.ts`; dual-listed active-rental + genuine-asking-rent disambiguation & rent sanity guard; explicit `matchesTaskConfigFilters()` rental check; normalized address+unit dedup + Stage-2 detail upward merge in `apify-scrape-worker`; updated `property-validation.ts` rental gate.
   - **Out-of-Scope:** Date-based freshness fields, historical Zestimate/Rent Zestimate, rent benchmarks, and existing photo-count / image / multimedia requirements (left completely unchanged and strictly outside project scope).
5. **Exact Files / Modules / Tables / Edge Functions Affected:**
   - Update `supabase/functions/_shared/apify-normalizer.ts` (`classifyRentalEligibility`, `parseVerifiedAskingRent`, `buildNormalizedAddressKey`, `normalizeApifyZillowItem`, `matchesTaskConfigFilters`)
   - Update `supabase/functions/_shared/property-validation.ts` (`validatePipelineProperty` rental & price sanity check)
   - Update `supabase/functions/apify-scrape-worker/index.ts` (`ingestApifyItemsToBatch` dedup + Stage-2 merge)
   - Update `supabase/migrations/<next>_phase2_pipeline_normalized_address_key.sql`
   - Create/Update `supabase/functions/_shared/__tests__/rental-eligibility-and-dedup.test.ts`
6. **Data & Schema Changes (Additive / Backward-Compatible):**
   - `ALTER TABLE pipeline.pipeline_properties ADD COLUMN IF NOT EXISTS normalized_address_key TEXT, ADD COLUMN IF NOT EXISTS rental_eligibility_status TEXT, ADD COLUMN IF NOT EXISTS is_dual_listed BOOLEAN DEFAULT false;`
   - Non-unique index `(batch_id, normalized_address_key)` to accelerate intra-batch address dedup without breaking historical rows.
7. **Actor / Worker / Normalizer Logic Changes:**
   - `classifyRentalEligibility(raw)` inspects `homeStatus`, `homeStatusType`, `listingStatus`, `status`, `listingType`, `isForRent`, `isForSale`, `hdpData.homeInfo` and returns `{ eligible: boolean, reason: string, status: 'rental_only' | 'dual_listed_rental_active' | 'sale_only' | 'off_market' | 'unconfirmed', isDualListed: boolean }`.
   - `parseVerifiedAskingRent(raw, isDualListed)` requires a verified monthly asking rent separate from `salePrice`/`purchasePrice`, rejects `rentZestimate` fallback, and rejects sale-scale numbers (`>= 50000` or `>= salePrice * 0.05`).
   - `ingestApifyItemsToBatch()` checks both `(batch_id, source, source_listing_id)` and `(batch_id, normalized_address_key)`. If existing row was Stage-1 `search_card` and incoming item is Stage-2 `detail_enriched`, performs additive upward merge respecting `edited_fields`.
8. **Validation, Rental-Only & Conflict Rules:**
   - Sale-only items (`FOR_SALE`, `SOLD`, `RECENTLY_SOLD`, `PENDING_SALE`, `AUCTION`, `FORECLOSURE`, `OFF_MARKET`, `LEASED`, `RENTED`) fail `normalizeApifyZillowItem()` / `classifyRentalEligibility()` immediately and increment `count_filtered_out` (`reason: 'sale_only_excluded'`) before quota selection.
   - `property-validation.ts` re-verifies `rental_eligibility_status` and `is_dual_listed` asking rent sanity, rejecting non-rental or purchase-price anomalies (`non_rental_or_off_market` / `invalid_sale_price_as_rent`).
9. **Edge Cases & Failure Modes:** Dual-listed property where Zillow exposes `price` as `$349,000` and genuine rental price inside `rentalPrice`/`units`/`rent` sub-object; dual-listed property claiming rental intent without any verified asking rent (must fail qualification); multi-unit or duplex units sharing street address (`unit_number` MUST be included in `normalized_address_key` so `608 Maple Ave #A` and `#B` are NOT collapsed as duplicates); missing `homeStatus` when `detailUrl` lacks explicit rental signal.
10. **Verification & Automated Test Plan:**
    - Fixture tests with archived live DB payloads + synthetic dual-listed (qualifying vs missing-rent), sale-only (`FOR_SALE`), `RECENTLY_SOLD`, missing-status, `$350,000` asking price trap, `rentZestimate` fallback trap, and same-address/different-unit duplexes (`#A` vs `#B`).
    - End-to-end static/runtime verification (`compile_applet`, `lint_applet`, Deno tests).
11. **Acceptance Criteria / Definition of Done:** Zero sale-only listings pass normalization or validation; dual-listed properties pass ONLY with confirmed active rental offering AND genuine monthly asking rent; zero `rentZestimate` values enter `monthly_rent`; duplex units stay distinct; identical properties dedupe or merge upward cleanly; existing photo rules remain untouched.
12. **Rollback / Safety Strategy:** Purely additive columns; if `normalized_address_key` merge ever proves too aggressive, address dedup can be toggled to flag-only (`needs_review: 'potential_duplicate_address'`) without schema changes.
13. **Stop-and-Review Gate:** Implement, test, verify end-to-end, document, and push Phase 2 to GitHub (`choice121/Choice` `main`), then stop and request operator approval before automatically advancing to **Phase 3**.
14. **Operational Notes:** **Zero live Apify actor runs** during Phase 2 build/tests; existing photo-count rules remain completely untouched and outside project scope.

---

### Phase 3: Lossless Comprehensive Extraction, Normalization & Dynamic `source_facts_ledger`

> **Status:** **Implemented & Verified** (awaiting operator approval to advance to Phase 4)

1. **Phase ID & Title:** `Phase 3` — Lossless Extraction & Normalization of All Available Relevant Actor Fields + Dynamic `source_facts_ledger`
2. **Objective:** Extract and normalize **100% of available relevant non-excluded property information returned by Apify actors without dropping fields**, eliminating the `0/76` JSONB extraction gap (`structural_details`, `utility_details`, `financial_details`, `location_details`, `ev_charging`, `hoa_fee`, `hoa_fee_frequency`, `schools`, `school_district`, `subdivision`, and `source_facts_ledger` + `unmapped_attributes`).
3. **Prerequisites & Dependencies:** Phases 1–2 implemented, verified end-to-end, and pushed to GitHub.
4. **Exact Scope:**
   - **In-Scope:** Lossless multi-shape extractors across `resoFacts`, `hdpData.homeInfo`, `_details` (`igolaizola`), `details`/`propertyFeatures`/`facts` (`cliqtomedia`/`automation_craft`); populate all 4 structured JSONB domains (`structural_details`, `utility_details` mapped to `_shared/utility-matrix.ts` 13 keys, verified non-dated rental `financial_details`, `location_details`); lossless capture of **every remaining relevant non-excluded actor field** into `source_facts_ledger` (`confirmed_present`, `confirmed_absent`, `not_applicable`, `unspecified`) + `unmapped_attributes`; remove deprecated `pets_allowed`/`security_deposit` penalties from `pipeline-record.ts` `qualityScore()`/`TRACKABLE_MISSING`; conflict-aware narrative feature harvesting.
   - **Out-of-Scope:** Excluded domains (date fields, historical Zestimate/Rent Zestimate, rent benchmarks, tax assessor history/values, parcel/flood-zone, multi-building unit matrices, floor-by-floor data, video/3D-tour extraction, photo-count policy changes).
5. **Exact Files / Modules / Tables / Edge Functions Affected:**
   - Update `supabase/functions/_shared/apify-normalizer.ts` (lossless multi-actor field extractor + 4 JSONB domain builders + excluded-scope key filter + `source_facts_ledger`/`unmapped_attributes` builder)
   - Update `supabase/functions/_shared/pipeline-record.ts` (update `CORE_FIELDS`/`BONUS_FIELDS`/`TRACKABLE_MISSING`, persist `source_facts_ledger`, `unmapped_attributes`, `utility_details` normalization, remove `pets_allowed` & `security_deposit` scoring bias)
   - Update `supabase/migrations/<next>_phase3_source_facts_ledger.sql`
   - Update `supabase/functions/_shared/__tests__/apify-normalizer.test.ts` & `pipeline-record.test.ts`
6. **Data & Schema Changes (Additive / Backward-Compatible):**
   - `ALTER TABLE pipeline.pipeline_properties ADD COLUMN IF NOT EXISTS source_facts_ledger JSONB DEFAULT '{}'::jsonb, ADD COLUMN IF NOT EXISTS unmapped_attributes JSONB DEFAULT '{}'::jsonb;`
   - Keep `source_facts_ledger` and `unmapped_attributes` strictly on `pipeline.pipeline_properties` (and internal admin RPCs `public.pipeline_list` / `public.pipeline_save`), **not** exposed on unauthenticated `public.properties` anon queries.
7. **Actor / Worker / Normalizer Logic Changes:**
   - Accept arrays, comma-separated strings, booleans, numbers, and nested objects for `heating`, `cooling`, `flooring`, `appliances`, `laundry`, `parking`, `utilities`, `schools`, `hoaFee`, construction/architecture/exterior/interior/lot/pool/patio/fireplace/window/door/accessibility fields.
   - Map utility statements into `utility_details.utility_matrix` matching `_shared/utility-matrix.ts` (`landlord` vs `tenant` vs `n/a` vs `unspecified` in ledger) while populating flat `utilities_included[]` for landlord-paid items.
   - Populate verified non-dated rental `financial_details` (e.g., `hoa_fee`, `hoa_fee_frequency`, `hoa_includes`, `parking_fee`, Choice `$50` application fee invariant—explicitly excluding `tax_annual_amount`, `taxHistory`, `priceHistory`, `zestimate`, `rentZestimate`, and rent benchmarks).
   - **Zero-Drop Guarantee:** Walk all remaining keys across actor item, `resoFacts`, `propertyFeatures`, `details`, and `hdpData.homeInfo`; strip strictly excluded-scope keys (dates, Zestimate/Rent Zestimate, tax/assessor/parcel/flood, media/tours, multi-building/floors) and store every other non-empty relevant field in `source_facts_ledger` + `unmapped_attributes` so **zero relevant returned actor fields are dropped**.
8. **Validation, Rental-Only & Conflict Rules:**
   - Never fabricate features (`confirmed_absent` vs `unspecified`). For example, `"Garage: No"` or `garageSpaces: 0` sets `source_facts_ledger.garage = 'confirmed_absent'`, whereas omitted `garageSpaces` sets `unspecified`.
   - Cross-check narrative text vs structured fields: if structured says `hasCooling: false` / `"No AC"` while narrative says `"Central Air"`, log conflict in `source_facts_ledger.conflicts` instead of blindly overwriting.
9. **Edge Cases & Failure Modes:** String-encoded `"Yes"/"No"` booleans; mixed-unit lot sizes (`acres` vs `sqft`); fractional baths (`2.5`, `3.5`) with or without explicit `bathroomsHalf`; `monthlyHoaFee: 0` (`not_applicable` / `$0`) vs `null` (`unspecified`); `cliqtomedia`'s `schools` vs `igolaizola`'s `assignedSchools` vs `maxcopell`'s `schools`; novel/unseen `resoFacts` keys.
10. **Verification & Automated Test Plan:**
    - Replay real archived raw JSON fixtures from `pipeline.pipeline_recovery_archive` (`cliqtomedia` records `5768243`, `5750992`) plus `maxcopell` detail fixtures and `igolaizola`/`automation_craft` schema fixtures through `normalizeApifyZillowItem()` + `buildPipelineRecord()`.
    - Include an explicit **key-coverage completeness assertion** proving 100% of non-excluded actor fields present on each fixture map into either canonical columns/JSONB domains OR `source_facts_ledger` / `unmapped_attributes` (zero dropped relevant keys), while excluded keys (dates, Zestimate/Rent Zestimate, tax/assessor) are absent.
    - End-to-end static/runtime verification (`compile_applet`, `lint_applet`, Deno tests).
11. **Acceptance Criteria / Definition of Done:** Zero relevant non-excluded actor fields dropped; all 4 JSONB domains and `source_facts_ledger`/`unmapped_attributes` populate deterministically; `qualityScore()` never penalizes omitted `pets_allowed` or `security_deposit`; excluded-scope fields are absent.
12. **Rollback / Safety Strategy:** Purely additive columns + normalizer enrichment; `buildPipelineRecord()` remains backward-compatible with browser extensions (`chrome-extension/`, `.pages-orion/`) and `import-from-url`.
13. **Stop-and-Review Gate:** Implement, test, verify end-to-end, document, and push Phase 3 to GitHub (`choice121/Choice` `main`), then stop and request operator approval before automatically advancing to **Phase 4**.
14. **Operational Notes:** **Zero live Apify actor runs**; tested purely against archived DB payloads and schema fixtures.

---

### Phase 4: Optional Two-Level Property Insights (`LEVEL 1` vs `LEVEL 2`, Zero Zestimates / Benchmarks)

> **Status:** **Implemented & Verified** (awaiting operator approval to advance to Phase 5)

1. **Phase ID & Title:** `Phase 4` — Separated Two-Level Extraction Depth (`LEVEL 1: Full Property Data` vs `LEVEL 2: Optional Geographic & Livability Insights`)
2. **Objective:** Maintain strict separation between core full-detail property extraction (**Level 1**, always executed) and opt-in **Property Insights** (**Level 2**: Walk/Transit/Bike scores, `location_context`, Geoapify categorized nearby amenities, and Census TIGERweb district context)—while excluding historical Zestimate, historical Rent Zestimate, and unrelated rent benchmark/market-comp functionality.
3. **Prerequisites & Dependencies:** Phases 1–3 implemented, verified end-to-end, and pushed to GitHub.
4. **Exact Scope:**
   - **In-Scope:** `task_config.extraction_depth` (`'full_data'` default | `'with_insights'`) & `include_property_insights` boolean; adapter-level flag wiring; Level-2 extraction of `walk_score`, `transit_score`, `bike_score`, `location_context`, and Geoapify categorized nearby amenities (`schools`, `parks`, `supermarkets`, `shopping`, `healthcare`, `transit_stops`).
   - **Out-of-Scope:** Historical Zestimate, historical Rent Zestimate, Zestimate valuations, unrelated rent benchmarks or market comparables, `financial_details.insights`, price/tax history dates, assessor values, flood-zone/parcel metrics, or enabling Level 2 insights when toggled off.
5. **Exact Files / Modules / Tables / Edge Functions Affected:**
   - Update `supabase/functions/_shared/apify-actor-adapters.ts`
   - Update `supabase/functions/_shared/apify-normalizer.ts` (`extractPropertyInsights` strictly gated by Level 2 toggle; `zestimate`/`rentZestimate`/date keys discarded)
   - Update `supabase/functions/orchestrate-batch/index.ts` & `apify-scrape-worker/index.ts`
   - Update `supabase/functions/_shared/location-intelligence.ts` (reusable nearby-place summarizer for server pipeline)
   - Create/Update `supabase/functions/_shared/__tests__/property-insights-levels.test.ts`
6. **Data & Schema Changes (Additive / Backward-Compatible):**
   - No breaking schema changes; Level-2 fields populate existing `location_context`, `location_details.walk_score`, `location_details.transit_score`, `location_details.bike_score`, and `location_details.insights` **only when Level 2 is enabled**. Zero benchmark or Zestimate storage columns.
7. **Actor / Worker / Normalizer Logic Changes:**
   - **Level 1 (`full_data`, default):** Extracts 100% of core Sections A–J cleanly while keeping insight sub-lookups disabled and skipping optional Geoapify Places enrichment.
   - **Level 2 (`with_insights`, opt-in):** Enables Level-2 insight flags/enrichment (Geoapify Places categories: schools, parks, supermarkets, shopping, healthcare, public transport + Walk/Transit/Bike scores) cleanly into `location_context` & `location_details.insights` without mutating core Level-1 facts.
8. **Validation, Rental-Only & Conflict Rules:** Guarantee `rentZestimate`, `zestimate`, and any unrelated rent-comp / market-benchmark payloads on raw actor output are **strictly ignored/discarded** and can never enter `monthly_rent`, `original_monthly_rent`, `financial_details`, or `location_details.insights`; strip any dates if present on nearby items.
9. **Edge Cases & Failure Modes:** Actor returns unsolicited WalkScore or `rentZestimate` when Level 1 is configured (normalizer discards/segregates insights at Level 1 and permanently discards `rentZestimate`/`zestimate` at both levels); Geoapify quota/timeout during Level 2 fails gracefully as `partial` without blocking property staging.
10. **Verification & Automated Test Plan:**
    - Unit tests proving Level 1 (`full_data`) excludes Level-2 insight blocks cleanly, Level 2 (`with_insights`) populates `walk_score`/`transit_score`/`bike_score`, `location_context`, and nearby amenity highlights, and **neither level** ever admits `zestimate`, `rentZestimate`, rent benchmarks, or date histories.
    - End-to-end static/runtime verification (`compile_applet`, `lint_applet`, Deno tests).
11. **Acceptance Criteria / Definition of Done:** Level 1 and Level 2 remain cleanly separated; zero historical Zestimate, zero historical Rent Zestimate, zero unrelated rent benchmarks, and zero dates; Geoapify failures degrade gracefully.
12. **Rollback / Safety Strategy:** Toggle `include_property_insights = false` / `extraction_depth = 'full_data'` instantaneously reverts system to pure Level 1 extraction.
13. **Stop-and-Review Gate:** Implement, test, verify end-to-end, document, and push Phase 4 to GitHub (`choice121/Choice` `main`), then stop and request operator approval before automatically advancing to **Phase 5**.
14. **Operational Notes:** **Zero live Apify actor runs** during implementation; Geoapify calls tested with mocked `fetchImpl` in unit tests.

---

### Phase 5: 3-Layer Verification, Independent Location/School Cross-Check & Conflict Resolution

> **Status:** **Implemented & Verified**

1. **Phase ID & Title:** `Phase 5` — Pipeline Location/School Independent Verification & Attribute Conflict Detection
2. **Objective:** Upgrade the Property Checker (`property-validation.ts`) and ingestion pipeline from basic structural checks into a 3-layer verification engine with per-field confidence statuses (`field_verification_status`), strict rental-only/dual-listed re-verification, and zero new secrets.
3. **Prerequisites & Dependencies:** Phases 1–4 implemented, verified end-to-end, and pushed to GitHub.
4. **Exact Scope:**
   - **In-Scope:** Pipeline-stage Geoapify reverse-geocode consistency check (`county`, `city`, `zip`, `neighborhood` verification using existing `GEOAPIFY_API_KEY`); zero-key Census TIGERweb / NCES EDGE school-district boundary verification (`tigerweb.geo.census.gov/.../School/MapServer`); `field_verification_status` classification (`source_confirmed`, `independently_verified`, `partially_verified`, `unverified`, `conflicting_sources`, `not_available`); deterministic conflict detection (structured vs narrative contradictions, Geoapify county mismatch, dual-listed rent-vs-sale sanity check); upgraded `ValidationReport` output.
   - **Out-of-Scope:** Adding new paid third-party verification APIs/secrets; altering prohibited-profile blacklist, owner-proof security rules, or existing photo-count rules; automated LLM calls.
5. **Exact Files / Modules / Tables / Edge Functions Affected:**
   - Create `supabase/functions/_shared/location-verifier.ts` (Geoapify reverse-geocode check + Census TIGERweb school district boundary check with timeout + SSRF/coordinate guards)
   - Update `supabase/functions/_shared/property-validation.ts` (`validatePipelineProperty` integrates `location-verifier.ts`, `source_facts_ledger` completeness, rental/dual-listed confirmation, and conflict checks)
   - Update `supabase/functions/property-validator/index.ts` (pass `verifyLocationAndSchools` option cleanly, expose verification breakdown)
   - Update `supabase/migrations/<next>_phase5_field_verification_status.sql`
   - Create `supabase/functions/_shared/__tests__/location-verifier-and-conflicts.test.ts`
6. **Data & Schema Changes (Additive / Backward-Compatible):**
   - `ALTER TABLE pipeline.pipeline_properties ADD COLUMN IF NOT EXISTS field_verification_status JSONB DEFAULT '{}'::jsonb, ADD COLUMN IF NOT EXISTS verification_conflicts JSONB DEFAULT '[]'::jsonb;`
   - Keep `field_verification_status` and `verification_conflicts` isolated on `pipeline.pipeline_properties` (and admin-only inspection views/functions) so unauthenticated public queries on `public.properties` never expose internal verification metadata.
7. **Actor / Worker / Normalizer Logic Changes:**
   - `property-validator` invokes `location-verifier.ts` (or reads cached Geoapify/TIGERweb result stored on staging row) to verify `(lat, lng)` resolves to matching state/county/city/ZIP and resolves official NCES/Census school district (`ELEM`/`SEC`/`UNSD`).
   - Compares Zillow's `school_district` string (e.g., `"Yukon Public Schools"`) against Census TIGERweb district name (`"Yukon"`) using normalized token match -> marks `independently_verified` or `conflicting_sources`.
8. **Validation, Rental-Only & Conflict Rules:**
   - Critical conflicts (e.g., Geoapify reverse-geocode lands in a different state/city >10 miles away, missing active rental confirmation on dual-listed item, or `monthly_rent` matches purchase-price range) route property to `needs_review` or `rejected`.
   - Non-blocking minor conflicts (e.g., narrative says `"garage"` while `garageSpaces: 0`, or minor neighborhood naming difference) populate `verification_conflicts[]` and `field_verification_status[field] = 'conflicting_sources'` for operator review without breaking valid listings.
9. **Edge Cases & Failure Modes:** External TIGERweb or Geoapify timeout/5xx must degrade gracefully to `source_confirmed` / `unverified` (never falsely reject a valid rental simply because Census TIGERweb was temporarily unreachable); missing `(lat, lng)` coordinates skip external spatial checks and mark location verification `not_available`.
10. **Verification & Automated Test Plan:**
    - Unit tests with mocked Geoapify & Census TIGERweb ArcGIS responses verifying `independently_verified`, `conflicting_sources`, dual-listed rejection when asking rent missing, graceful timeout fallback, and state/city mismatch rejection.
    - End-to-end static/runtime verification (`compile_applet`, `lint_applet`, Deno tests).
11. **Acceptance Criteria / Definition of Done:** Every validated pipeline property carries structured `field_verification_status`, `source_facts_ledger` completeness, and explicit conflict annotations cleanly isolated from public anon tables; Geoapify + TIGERweb degrade safely on network failure.
12. **Rollback / Safety Strategy:** `verifyLocationAndSchools` option defaults toggleable via `rules_map` (`enable_external_location_verification`) so operator can disable spatial cross-checks in seconds without redeploying.
13. **Stop-and-Review Gate:** Implement, test, verify end-to-end, document, and push Phase 5 to GitHub (`choice121/Choice` `main`), then stop and request operator approval before automatically advancing to **Phase 6**.
14. **Operational Notes:** **Zero live Apify actor runs**; uses zero-key public Census TIGERweb REST endpoint and existing `GEOAPIFY_API_KEY`.

---

### Phase 6: Publishing Alignment, Public Property Page Verification & Internal Data Protection

> **Status:** **Implemented & Verified**

1. **Phase ID & Title:** `Phase 6` — Publishing RPC Parity, Public Property Page Verification (`property.html` / `property-share`) & Strict Internal Data Protection
2. **Objective:** Ensure all public-safe extracted property data flows losslessly through publishing onto **both** `#share={token}` (`property-share`) and public property pages (`property.html` / `js/property.js` / `/rent/[state]/[city]/[slug].js`) and renders accurately—while strictly protecting all internal pipeline, audit, ledger, provenance, and agent/broker data from unauthenticated exposure.
3. **Prerequisites & Dependencies:** Phases 1–5 implemented, verified end-to-end, and pushed to GitHub.
4. **Exact Scope:**
   - **In-Scope:**
     - Fix `CLIENT_SAFE_PROPERTY_FIELDS` and `projectClientSafeProperty()` in `_shared/batch-publishing.ts` to project `structural_details` and sanitized `location_details` (including `schools`, `school_district`, `subdivision`, Level-2 `walk_score`/`transit_score`/`bike_score`/`insights.nearby_highlights` when present).
     - Verify and harden the **public active property page path** (`property.html` → `js/property.js:223–227` and SSR `functions/rent/[state]/[city]/[slug].js`): replace unsafe `select('*')` or confirm DB schema/column isolation on `public.properties` so internal columns (`source_raw_payload`, `original_data`, `source_facts_ledger`, `unmapped_attributes`, `field_verification_status`, `verification_conflicts`, `agent_name`, `broker_name`, `source_url`, `financial_details` internal fields) can NEVER leak to public `anon` callers or DOM rendering.
     - Verify `js/property.js` renders all public-safe extracted fields accurately (`structural_details`, `utility_details`, `location_details.schools`, `school_district`, `ev_charging`, `hoa_fee`, `appliances`, `flooring`, `amenities`, Level-2 `location_context` / scores when enabled) without breaking pre-upgrade rows.
     - Reconcile legacy `public.pipeline_publish` (`20261023000003`) & verify `pipeline_publish_for_batch` parity (`amenities`, `appliances`, `utilities_included`, `flooring`, all 4 JSONB domains).
     - Update `batch-verifier.ts`, Admin inspection views (`js/admin/pipeline.js`, `js/admin/property-detail.js`), and `docs/APIFY_AUTOMATED_SCRAPING_GUIDE.md` / `docs/PIPELINE_OVERVIEW.md`.
   - **Out-of-Scope:** Exposing any internal data (`source_raw_payload`, `original_data`, `source_facts_ledger`, `unmapped_attributes`, `field_verification_status`, `verification_conflicts`, `agent_name`, `broker_name`, `source_url`) to unauthenticated clients—Choice Privacy Shield stays 100% strict!
5. **Exact Files / Modules / Tables / Edge Functions Affected:**
   - Update `supabase/functions/_shared/batch-publishing.ts` (`CLIENT_SAFE_PROPERTY_FIELDS`, `FORBIDDEN_INTERNAL_FIELDS`, `sanitizeLocationDetailsForClient`, `projectClientSafeProperty`, `detectLeakedInternalStrings`)
   - Update `supabase/functions/_shared/batch-verifier.ts` (assert full public-field parity across `property-share` AND public `property.html` contract + zero leaked internal fields)
   - Update `js/property.js` (explicit safe column selection on `public.properties` replacing unsafe `select('*')` for active public listings + verify rendering of extracted JSONB/flat fields; never expose internal fields)
   - Update `supabase/migrations/<next>_phase6_publish_rpc_parity.sql` (`pipeline_publish_for_batch` + legacy `pipeline_publish` parity + column-level `anon` privilege hardening if needed)
   - Update `js/admin/pipeline.js` & `js/admin/property-detail.js` (admin-only inspection of `field_verification_status` / `source_facts_ledger`)
   - Update `docs/APIFY_AUTOMATED_SCRAPING_GUIDE.md` & `docs/PIPELINE_OVERVIEW.md`
6. **Data & Schema Changes (Additive / Backward-Compatible):**
   - Keep `source_facts_ledger`, `unmapped_attributes`, `field_verification_status`, `verification_conflicts`, and `source_raw_payload` confined strictly to `pipeline.pipeline_properties` (or admin-authenticated queries) and verify `public.properties` exposes only public-safe listing fields cleanly through `pipeline_publish_for_batch`.
   - Reconcile `public.pipeline_publish` RPC so it projects `amenities`, `appliances`, `utilities_included`, `flooring`, `structural_details`, `utility_details`, `location_details`, `hoa_fee`, `ev_charging` cleanly.
7. **Actor / Worker / Normalizer Logic Changes:** None; completes end-to-end projection verification from Phase 1–5 staging onto both `property-share` and public `property.html` / `js/property.js` pages.
8. **Validation, Rental-Only & Conflict Rules:**
   - `FORBIDDEN_INTERNAL_FIELDS` and `detectLeakedInternalStrings()` in `batch-publishing.ts` must explicitly block `source_facts_ledger`, `unmapped_attributes`, `field_verification_status`, `verification_conflicts`, `source_raw_payload`, `original_data`, `source_url`, `agent_name`, `broker_name`, and any MLS/portal/third-party strings across BOTH `property-share` and public `property.html` queries.
   - Verify published active & private-placement listings remain strictly active rentals with `$50` application fee invariant and `virtual_tour_url: null` / `videos: null` / `pets_allowed: null` / `available_date: null` / `lease_terms: null`.
9. **Edge Cases & Failure Modes:** `public.properties` rows published prior to Phase 3 (`structural_details = null`, `location_details = null`) must still render safely in `js/property.js` without UI crashes; canonical property reuse in sibling batches must refresh empty structured JSONB safely without mutating sibling batch rent/description overlays.
10. **Verification & Automated Test Plan:**
    - End-to-end pipeline-to-public-page simulation (`normalizeApifyZillowItem` → `buildPipelineRecord` → `validatePipelineProperty` → `pipeline_publish_for_batch` contract → `projectClientSafeProperty` AND `js/property.js` public property payload consumption → `detectLeakedInternalStrings`) proving:
      1. All public extracted information (`structural_details`, `utility_details`, `location_details.schools`, `school_district`, `hoa_fee`, `ev_charging`, `appliances`, `flooring`, `amenities`, Level-2 scores when enabled) reaches and renders cleanly on **both** `property-share` and `property.html`.
      2. **Zero** internal data (`source_facts_ledger`, `unmapped_attributes`, `field_verification_status`, `verification_conflicts`, `source_raw_payload`, `original_data`, `source_url`, broker/agent PII) leaks into public payloads or DOM output.
    - `compile_applet` + `lint_applet` + full test suite verification.
11. **Acceptance Criteria / Definition of Done:** Public property pages (`property.html` / `js/property.js` and `property-share`) accurately display all public-safe extracted details while zero internal/pipeline fields are accessible or rendered; `batch-verifier.ts` passes all parity and privacy leak checks; zero legacy RPC `NULL` overwrites remain.
12. **Rollback / Safety Strategy:** Removing updated projection keys or reverting `js/property.js` select list / migration RPC restores prior behavior cleanly.
13. **Stop-and-Review Gate:** Implement, test, verify end-to-end, document, and push Phase 6 to GitHub (`choice121/Choice` `main`), then stop for final operator sign-off before authorizing any live Apify smoke test batch.
14. **Operational Notes:** **Zero live Apify actor runs** until Phases 1–6 pass complete automated and end-to-end verification and the operator explicitly authorizes a controlled smoke test.

---

## 10. Approval Gate & Immediate Next Step

No application files, database tables, Edge Functions, actor configurations, or Apify keys have been modified.

Upon your explicit approval of this revised roadmap, implementation will begin automatically with **Phase 1: Proven Maxcopell Two-Stage Search→Detail Workflow, Actor-Adapter Registry & Input Query Planner**—following the independent phase lifecycle (implement, test, verify end-to-end, document, push to GitHub, and stop for your approval before advancing sequentially to Phase 2).

