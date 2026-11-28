# Choice Properties — Apify On-Demand Scraping Pipeline Documentation

> **Status:** Operator-Triggered On-Demand Scraper Only (Zero Scheduled or Background Scraping)  
> **Primary Source:** Zillow (`zillow.com`)  
> **Default Provider:** **Apify** (runs strictly when triggered by your decision via Admin Control Center)  
> **Runtime:** Supabase Edge Functions (Deno) + PostgreSQL (`pipeline.*` & `public.*`) (Cloudflare-Only Repo Guard compliant — zero Node server dependencies in `package.json`)  
> **Upgrade Audit & Phased Roadmap:** See [`docs/APIFY_EXTRACTION_UPGRADE_AUDIT_AND_ROADMAP.md`](./APIFY_EXTRACTION_UPGRADE_AUDIT_AND_ROADMAP.md) for the complete system audit, 5-actor comparison, 3-layer extraction architecture, and 6-phase implementation roadmap.

---

## 1. Purpose & On-Demand Execution Policy

The **Apify On-Demand Scraping Pipeline** provides centralized, rule-enforced property discovery and staging for Choice Properties **strictly when initiated by an operator**. There is **no automated/scheduled/cron scraping** and unattended scraping webhooks are disabled.

**Permanent Execution & Coexistence Rules:**
1. **Strictly On-Demand Execution**: Apify never runs on a background timer or cron schedule. Every scrape run starts solely when you decide to click **Launch Apify Scrape** (or invoke `start_run` as an admin). Once started, multi-key failover completes that run seamlessly across available free Apify keys.
2. **Coexistence with Manual Browser Extensions**: On-demand Apify scraping runs alongside the manual Chrome Desktop (`chrome-extension/`) and Orion Mobile (`.pages-orion/`) extensions. Both channels normalize through `supabase/functions/_shared/pipeline-record.ts` into `pipeline.pipeline_properties` and can write into the same or separate 4-digit batch folders cleanly.
3. **Cloudflare-Only Architecture Compliance**: Because `.github/workflows/cloudflare-only.yml` enforces a zero-Node-backend static site repo, scraping workers execute inside **Supabase Edge Functions (Deno)** and **PostgreSQL RPCs**, never via local Python scripts or Express/Postgres Node packages added to `package.json`.

---

## 2. On-Demand Scraping Architecture Flow (Modular or Single-Call One-Go)

AI workers can invoke **`orchestrate-batch`** (`run_one_go` / `continue_one_go`) for single-call end-to-end execution, or call each modular Edge Function individually with an exclusive batch lease:

```
Task Config (batch_id: "auto" or 4 digits, Location, Rent Range, Qty, Pricing Rule)
         │
         ▼
[orchestrate-batch Edge Function]  (or manual call to [job-manager])
  1. Validates pricing config pre-flight (`normalizeAndValidatePricingConfig`)
  2. Allocates an unused 4-digit `batch_id` atomically (`pg_advisory_xact_lock`) or validates explicit ID
  3. Pins active Rules & Policies version (`rules-engine`), creates permanent batch + disposable folder
  4. Claims exclusive worker lease (`worker_id` + `lease_token` verified across every stage)
         │
         ▼
[apify-scrape-worker Edge Function]
  5. Selects least-busy healthy key (`active_runs ASC`, `runs_started ASC`, deterministic `batch_id` seed)
     and claims slot (`pipeline_apify_key_claim_slot` / `release_slot`) with 0ms failover on 401/402/403/429
  6. Executes Priority-1 **Maxcopell two-stage workflow** (`maxcopell/zillow-scraper` Stage 1 search with `?searchQueryState=...`
     -> `maxcopell/zillow-detail-scraper` Stage 2 detail with `propertyStatus: "FOR_RENT"`), returning HTTP 202 + `continue_payload` if > max_wait_seconds
  7. Archives raw Apify JSON payload into Storage bucket `pipeline-raw-payloads` + `source_raw_payload`
  8. Filters strictly for eligible active rentals & active-rental dual-listed items (excluding sale-only, off-market, `rentZestimate` fallbacks),
     losslessly captures all non-excluded fields into canonical columns + 4 JSONB domains (`structural_details`, `utility_details`, `financial_details`, `location_details`) + dynamic `source_facts_ledger` & `unmapped_attributes`,
     segregates Level-1 (`full_data`) vs optional Level-2 (`with_insights`: Walk/Transit/Bike + Geoapify nearby amenities),
     dedupes by `(batch_id, source, source_listing_id)` AND `(batch_id, normalized_address_key)`, and stages into `pipeline.pipeline_properties`
         │
         ▼
[Downstream Worker Pipeline Gates (All batch_id + Lease Enforced)]
  - `property-validator`: 3-layer verification engine: source profile / landlord proof, prohibited profile blacklist,
                          rental-only & dual-listed confirmation, Geoapify reverse-geocode + Census TIGERweb school-district boundary cross-check,
                          `field_verification_status` + `verification_conflicts`, single-apartment check, usable photos & watermark scan
  - `enrich-description`: Baseline-preserving enrichment of `original_description` + Choice sanitization
  - `calculate-pricing`:  `none` / `fixed` / `individual_map` / `proportional_range` (`proportional` alias)
  - `publish-batch`:      Calls `pipeline_publish_for_batch` under canonical `(source, source_listing_id, visibility)`
                          advisory lock -> per-batch rent/description overlay + isolated `#share={token}` link (`virtual_tour_url = null`, `videos = null`)
  - `verify-batch-publication`: Confirms rendered visibility, public contract column parity (`property-share` & `property.html`),
                                anon internal-column isolation, zero leakage, and AGENTS.md invariants
  - `cleanup_disposable_folder`: Archives disposable folder for 24h recovery while preserving permanent batch + share link
```

---

## 3. Provider & Source Controls

### Approved Scraping Providers Registry (`public.scraping_providers`)
- **`apify`** (`is_default = true`, `enabled = true`): Primary on-demand Zillow search & detail actor integration (`maxcopell/zillow-scraper` Stage 1 + `maxcopell/zillow-detail-scraper` Stage 2; experimental actors stay opt-in behind `allow_experimental_actor = true`). Credentials (`APIFY_API_TOKENS`, `APIFY_API_TOKEN`, `APIFY_API_TOKEN_1..20`, plus AES-256-GCM encrypted Admin Pool keys in `pipeline.apify_api_keys`) live strictly on the server side in Supabase Edge Function secrets / encrypted DB vault, never in client JS or repo files.
- **`browser_extension_chrome` / `browser_extension_orion`** (`is_default = false`, `channel_type = 'manual'`): Manual 1-click browser capture via `receive-pipeline-import`.
- **`admin_url_import`** (`is_default = false`, `channel_type = 'manual'`): Admin single-URL server fetch via `import-from-url`.

### Multi-Key Pool, Least-Busy Balancing, Zero-Delay Failover & Mid-Run Handoff
1. **Unified Key Pool (`supabase/functions/_shared/apify-key-pool.ts`)**:
   - Combines keys added dynamically in **Admin Control Center → Scrape Batches → Apify API Key Pool** (`pipeline.apify_api_keys`, encrypted at rest with AES-256-GCM) with Edge Function secret pools (`APIFY_API_TOKEN`, comma/newline-separated `APIFY_API_TOKENS`, and `APIFY_API_TOKEN_1..20`).
   - Tracks `active_runs` and `last_dispatched_at` per key (auto-reconciled against active `pipeline.pipeline_scrape_runs` rows) so concurrent AIs automatically land on separate Apify accounts instead of piling onto the first priority key.
   - Only masked 4-character suffixes (`••••xxxx`), live Apify quota telemetry (`usage_usd_cached` / `limit_usd_cached`), and status badges are ever returned to the browser.
2. **Instant 0ms Preflight & Request Failover**:
   - On `402` (monthly usage limit / insufficient funds), `403` (quota/account block), `429` (rate/concurrency limit), or `401` (invalid token), the failing key is immediately persisted as `exhausted`, `rate_limited` (90s cooldown), or `invalid`, any active key slot is released cleanly, and `fetchApifyWithFailover` advances to the next healthy key in the same request with **zero sleep**.
   - Expired `cooldown_until`, expired `monthly_reset_at`, and stale `active_runs` counts auto-recover before every key resolution.
3. **Run-Key Affinity & Mid-Run Auto-Continuation**:
   - Each `pipeline.pipeline_scrape_runs` record stores `key_fingerprint` and `key_label` so status polls and dataset fetches stay bound to the launching Apify account and release its `active_runs` slot on completion or abort.
   - If an active Apify actor run aborts or fails mid-scrape due to quota/credit exhaustion, `apify-scrape-worker` first salvages and ingests any completed items in `defaultDatasetId` (deduped by ZPID), marks the depleted key `exhausted`, and automatically launches a linked continuation run (`parent_scrape_run_id`, up to `continuation_depth = 5`) on the next least-busy healthy key for the remaining `target_qty`.

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
| **Property Type** | Accept qualifying `SINGLE_FAMILY`, `TOWNHOUSE` / `TOWNHOMES`, and `DUPLEX`. Accept `APARTMENT` **only** if verified as 1 discrete unit with 1 fixed asking rent and zero multi-unit/floor-plan/price-range selectors. | Complex/multi-unit -> `rejected`; ambiguous -> `needs_review` |
| **Rental Eligibility & Dual-Listed Check** | Strictly exclude `FOR_SALE`, `SOLD`, `RECENTLY_SOLD`, `PENDING_SALE`, `AUCTION`, `FORECLOSURE`, `OFF_MARKET`, `LEASED`. Dual-listed homes qualify **only** with verified active rental offering + genuine monthly asking rent (zero `rentZestimate` or sale-scale fallback). | Sale-only / unconfirmed rental / missing rent -> `rejected` (`excluded_before_quota` in ingestion) |
| **Usable Photos & Strict Order** | Must contain reachable, non-duplicate, authentic source photos in **exact source feed order** (zero reordering, direct CDN URLs). Zero photo count floor rejections in sourcing; batch DB gates enforce usable photo integrity. | Unreachable/missing media -> `needs_review` |
| **Watermark / Branding Scan** | Inspect images for visible third-party branding, logos, watermarks, copyright stamps, or contact overlays. **Never** crop, blur, or obscure watermarks to force eligibility; **never** substitute stock or AI-generated images. | Watermarked / unclear rights -> `needs_review` / `rejected` media |
| **Required Core Facts** | Valid real physical street address, city, state, asking rent (`> 0`, never Zestimate fallback), bedrooms, fractional bathrooms (`1.5`, `2.5`, etc. preserved), authentic `original_description`. | Missing required fields -> `needs_review` |
| **3-Layer Verification & Location Cross-Check** | Cross-check `(lat, lng)` against Geoapify reverse-geocode + Census TIGERweb NCES school district boundaries; compare structured specs vs narrative statements and record per-field `field_verification_status` & `verification_conflicts`. | Major location mismatch or price anomaly -> `needs_review` / `rejected` |
| **Intra-Batch Duplicate & Cross-Batch Lock** | Unique `(batch_id, source, source_listing_id)` plus `(batch_id, normalized_address_key)` (unit-aware so duplex `#A` vs `#B` stay distinct; Stage-2 details merge upward cleanly). `pipeline_publish_for_batch` acquires a transaction advisory lock on `(source, source_listing_id, visibility)`. | Same batch duplicate -> idempotent skip / upward merge; concurrent publish -> lock-serialized reuse |

---

## 5. Task-Specific Prompt Simplification & Worker Contract

Once `orchestrate-batch` + Rules Engine are deployed, AI workers no longer receive multi-page boilerplate system rules in every prompt. Instead, the prompt supplies **only temporary task configuration** (both canonical names and aliases such as `target_quantity`, `rent_min`/`rent_max`, `bedrooms_exact`, `bathrooms_min`, single string `location`, and `method: "proportional"` are normalized automatically):

- **4-digit Batch ID** (`batch_id: "auto"` for atomic lock-safe assignment, or explicit 4-digit ID)
- **Target location(s)** (`locations` or `location`, preserving `"City, ST"` intact)
- **Quantity target** (`target_qty` / `target_quantity`)
- **Requested property type(s), bed/bath, owner, & feature criteria**
- **Two-Level Extraction Depth** (`extraction_depth`: `'full_data'` Level 1 default, or `'with_insights'` Level 2 opt-in)
- **Original advertised rent range** (`min_rent`/`max_rent`, `source_min`/`source_max`)
- **Target publishing pricing instruction** (`none`, `fixed`, `individual_map`, or `proportional_range` target min/max)
- **Visibility mode** (`private_placement` for isolated `#share={token}` link, or `active`)

Task-specific parameters live on that single `batch_jobs` record and **never bleed forward** into subsequent batches.

---

## 6. Strict Public-Safe Projection & Internal Data Protection

Unauthenticated clients (`property.html` / `js/property.js`, `listings.html` / `js/cp-api.js`, `index.html`, `/rent/.../[slug].js`, and `property-share`) operate under a single explicit contract (`CLIENT_SAFE_PROPERTY_FIELDS` in `supabase/functions/_shared/batch-publishing.ts`):
- **Public-Safe Fields Projected & Rendered**: Core rental identity/specs, pricing (`application_fee = 50`, `security_deposit = monthly_rent`), `amenities`, `appliances`, `utilities_included`, `flooring`, `hoa_fee`/`hoa_fee_frequency`, `ev_charging`, `structural_details` (architecture/materials/exterior/lot/windows/pool), `utility_details` (landlord vs tenant matrix), and sanitized `location_details` (`county`, `neighborhood`, `subdivision`, `school_district`, `schools`, plus Level-2 `walk_score`/`transit_score`/`bike_score`/`insights.nearby_highlights` when enabled).
- **Strictly Protected & Blocked from `anon` Queries**: PostgreSQL column-level grants (`20261121000026_phase6_publish_rpc_parity.sql`) revoke blanket `anon` `SELECT` on `public.properties` & `public.property_photos` so unauthenticated callers can **never** read `source_raw_payload`, `original_data`, `field_provenance`, `source_url`, `agent_name`, `broker_name`, `showing_instructions`, `admin_notes`, `tax_annual_amount`, `tax_value`, `financial_details`, `virtual_tour_url`, or `videos`. Pipeline ledger & verification tables (`source_facts_ledger`, `unmapped_attributes`, `field_verification_status`, `verification_conflicts`) remain strictly on `pipeline.pipeline_properties` for Admin inspection only.

---

## 7. Operational Telemetry, Retries & Concurrency Isolation

- **Telemetry**: Every Apify run records `count_total`, `count_new`, `count_duplicate`, `count_watermarked`, `count_validation_rejected`, `count_image_failed`, `batch_id`, `provider_run_id`, `scrape_stage`, `extraction_depth`, `adapter_key`, `key_fingerprint`, `key_label`, `parent_scrape_run_id`, `failover_events`, and `idempotency_key` into `pipeline.pipeline_scrape_runs`.
- **Rate Limits & Failover**: Apify `401`/`402`/`403`/`429` errors release the slot and fail over instantaneously (`0ms` wait) to the next least-busy healthy key in the pool inside `apify-scrape-worker`. Transient `5xx`/network hiccups retry once quickly before failing over.
- **Worker & Browser Share-Token Isolation**: Each concurrent AI worker claims an exclusive lease (`worker_id`, `lease_token`, `lease_expires_at`, periodic heartbeat), requires `batch_id` on downstream AI batch calls, publishes under canonical advisory locking, and emits an isolated `#share={token}` collection link persisted per-property (`cp_share_token_for_<id>`) in browser storage so concurrent clients never leak or cross-contaminate.
