# AI Agent Guide — Choice Properties Pipeline

> ### 🚀 DIRECTIVE — STRICT AUTHENTIC PHYSICAL ADDRESSES & ORIGINAL IMAGE ORDER
> **STATUS: PERMANENT PLATFORM POLICY (OWNER DIRECTIVE)**
>
> 1. **Strict Authentic Physical Address Protocol (Zero Relocation / Zero Aliasing)**:
>    - Address changing, synthetic relocation, same-block aliasing (+8 offset), cross-city shifting, and multi-city address modifications are **COMPLETELY AND COMPLETELY PROHIBITED** across the entire project.
>    - Every property must strictly use its genuine, authentic real-world physical street address, city, state, postal ZIP code, and rooftop coordinates.
> 2. **Zero Photo Count Gate**:
>    - Accept and ingest authentic source photos cleanly in their exact source order (validated per batch gates; never drop properties prematurely for arbitrary legacy 6-photo or 8-photo thresholds).
> 3. **Image Reordering Disabled — Strict Original Source Order & Direct CDN**:
>    - Automated image reordering is **COMPLETELY DISABLED**.
>    - All images stay ordered exactly as returned by the source feed (`display_order: 1` / `is_hero: true` is the original lead photo).
>    - Ingest high-resolution source CDN photo URLs directly (`original_image_urls` / `property_photos`). Do not upload to ImageKit.
> 4. **Virtual Tour & Video Walkthrough Links [TEMPORARILY DISABLED ON PUBLISH]**:
>    - While `DISABLE_TOUR_AND_VIDEO_LINKS_ON_PUBLISH = true`, publishing RPCs/workers drop `virtual_tour_url` and `videos` (`null`) on `public.properties` while preserving upstream staging extraction.

---

## Architecture Overview (Supabase Edge Functions + Cloudflare Static Site)

Choice Properties runs as a static Cloudflare Pages storefront (`https://choice-properties-site.pages.dev`) backed by **Supabase Edge Functions (Deno)** and **PostgreSQL (`pipeline.*` & `public.*`)**. There are no local Python scraper scripts or Node backend servers in this repository (`scripts/enforce-cloudflare-only.js` enforces zero server packages).

All Apify API tokens live strictly server-side in **Supabase (`pipeline.apify_api_keys` encrypted vault + Edge Function secrets)**. AI workers **never** read or supply raw Apify keys or database service keys directly in client payloads.

---

## The One-Go Command (`orchestrate-batch`)

To execute an entire concurrent AI scraping -> validation -> enrichment -> pricing -> isolated publishing batch in a single endpoint, invoke:

`POST https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/orchestrate-batch`

### Minimal `run_one_go` Request Payload
```json
{
  "action": "run_one_go",
  "batch_id": "auto",
  "batch_name": "Yukon & OKC 3BR Private Batch",
  "worker_id": "ai-agent-alpha",
  "visibility": "private_placement",
  "max_wait_seconds": 85,
  "task_config": {
    "locations": ["Yukon, OK", "Oklahoma City, OK"],
    "target_qty": 10,
    "min_rent": 1400,
    "max_rent": 1950,
    "exact_beds": 3,
    "min_baths": 2,
    "property_types": ["SINGLE_FAMILY", "TOWNHOUSE"],
    "owner_only": false,
    "required_features": ["garage"],
    "preferred_features": ["fenced yard", "patio"]
  },
  "pricing": {
    "method": "proportional_range",
    "source_min": 1400,
    "source_max": 1950,
    "target_min": 1550,
    "target_max": 1850
  }
}
```

### Handling Long Apify Runs (`HTTP 202` Continuation)
If the Apify Actor takes longer than `max_wait_seconds` (default `85s`, max `110s` inside Edge Function budget), `orchestrate-batch` returns `HTTP 202` with `status: "in_progress"` and a ready-to-send `continue_payload`. Poll with `continue_one_go` using the exact `worker_id` and `lease_token` returned until `status: "completed"`:

```json
{
  "action": "continue_one_go",
  "batch_id": "4821",
  "worker_id": "ai-agent-alpha",
  "lease_token": "<lease_token_from_202>",
  "scrape_run_id": "<scrape_run_id_from_202>",
  "visibility": "private_placement",
  "verify": true,
  "cleanup_folder": true,
  "pricing": { ... }
}
```

---

## Multi-AI Concurrency & Isolation Rules

Two or more AIs can launch independent One-Go jobs simultaneously without interfering with one another:

1. **Atomic 4-Digit Batch Allocation (`batch_id: "auto"`)**:
   - Pass `batch_id: "auto"` (or omit `batch_id`). PostgreSQL (`public.job_register`) acquires `pg_advisory_xact_lock` and atomically assigns an unused 4-digit ID (`1000`–`9999`), checking `publishing_batches`, `pipeline_folders`, `pipeline_recovery_archive`, and `batch_jobs`.
2. **Exclusive Worker Lease Enforcement**:
   - Every batch registers a unique `worker_id` and secret `lease_token`.
   - `job_verify_lease` blocks uncredentialed or expired workers from mutating another AI's active batch (`batch_id_required_for_ai_workers` is also enforced on `property-validator`, `enrich-description`, and `calculate-pricing`).
3. **Least-Busy Apify Key Pool & Deterministic Spread**:
   - `pipeline.apify_api_keys` tracks live `active_runs`, `runs_started`, and `priority`.
   - When multiple idle keys are available, `orderCandidateKeys` sorts by `active_runs ASC`, `runs_started ASC`, and a deterministic `batch_id` hash (`selectionSeed`), spreading concurrent AIs onto separate Apify accounts with automatic slot claim/release and `0ms` failover on `401`/`402`/`403`/`429`.
4. **Full-Dataset Evaluation & Quota Balancing**:
   - `apify-scrape-worker` paginates up to 500 completed Apify dataset items before running `scorePreferredFeatures` + `selectBalancedItemsByQuota`, guaranteeing multi-city and preference-heavy runs are scored across the full dataset rather than truncated to the first chunk.
5. **Advisory-Locked Canonical Publish & Per-Batch Token Isolation**:
   - `public.pipeline_publish_for_batch` serializes concurrent publishes of the same `(source, source_listing_id, visibility)` with a transaction advisory lock, preventing duplicate canonical rows.
   - Each batch persists its own `publishing_batches` overlay (batch rent + enriched description), isolated `property_shares` SHA-256 token hash (`90-day` expiry), and single master `#share={token}` collection link.
   - Frontend detail/listing pages (`js/property.js`, `js/listings.js`, `js/card-builder.js`) scope cached share tokens strictly per `property_id` (`cp_share_token_for_<id>`) so viewing different client links never bleeds between batches.

---

## Normalized Task Config & Pricing Field Reference

Both canonical field names and common aliases are accepted cleanly by `normalizeTaskConfigAliases` and `normalizeAndValidatePricingConfig`:

| Concept | Canonical Field | Accepted Aliases |
|---|---|---|
| Target Locations | `locations: ["Yukon, OK"]` | `location: "Yukon, OK"`, `target_market` |
| Quantity Target | `target_qty` | `target_quantity`, `target` |
| Scraped Rent Bounds | `min_rent` / `max_rent` | `rent_min` / `rent_max`, `source_min` / `source_max` |
| Bedrooms | `exact_beds`, `min_beds`, `max_beds` | `bedrooms_exact`, `bedrooms_min`, `bedrooms_max` |
| Bathrooms | `exact_baths`, `min_baths`, `max_baths` | `bathrooms_exact`, `bathrooms_min`, `bathrooms_max` |
| Property Types | `property_types` (`SINGLE_FAMILY`, `TOWNHOUSE`, `DUPLEX`, `APARTMENT`) | `property_type` |
| Owner Filter | `owner_only: true \| false` | — |
| Feature Criteria | `required_features`, `preferred_features` | comma-separated string or array |
| Location Split | `location_quotas: { "Yukon, OK": 5 }` | balanced round-robin default |
| Pricing Method | `method: "none" \| "fixed" \| "individual_map" \| "proportional_range"` | `pricing_method`, `"proportional"` -> `"proportional_range"` |
| Pricing Range Bounds | `source_min`, `source_max`, `target_min`, `target_max` | `source_rent_min`/`max`, `target_rent_min`/`max`, `original_min`/`max` |
| Fixed / Mapped Rent | `fixed_rent`, `individual_map` | `target_rent`, `rent` / `price_map`, `map` |

---

## Modular Step-by-Step Endpoints (Alternative to `orchestrate-batch`)

1. `job-manager` (`allocate_and_register` / `register_job`, `heartbeat`, `complete_stage`, `cleanup_disposable_folder`)
2. `apify-scrape-worker` (`start_run`, `status_and_ingest`)
3. `property-validator` (`validate_batch` — requires `batch_id`)
4. `enrich-description` (`enrich_batch` — requires `batch_id`)
5. `calculate-pricing` (`calculate_batch` — requires `batch_id`)
6. `publish-batch` (`publish_batch` — calls `pipeline_publish_for_batch` + `verify-batch-publication` when `verify: true`)

---

## Non-Negotiable Platform Invariants (`AGENTS.md`)

1. **Application Fee**: Strictly `$50` (`application_fee: 50`) in DB and description (`Application Fee: $50. Submit your rental application today at Choice Properties.`).
2. **Security Deposit**: Strictly `1x` monthly rent in DB (`security_deposit: monthly_rent`), with **ZERO** mentions in descriptions.
3. **Removed Fields**: Never output or display pet policies (`pets_allowed: null`), lease terms/durations (`lease_terms: null`), available/move-in dates, or smoking policies anywhere on public or client-shared pages.
4. **Authentic Source Text**: Preserve genuine source descriptions cleanly with minimal privacy scrubbing (strip external broker/agent phones/emails, third-party portal links, tour/showing language, deposits, lease durations, and availability dates).
5. **Fractional Bathrooms**: Preserve exact decimal bathroom counts (`1.5`, `2.5`, `3.5`) — never truncate.
6. **No Private Placement Badges**: Shared listings render natively without "Private Placement" banners or badges.

---

## Mandatory Output Format

- **Client Multi-Property Magic Link (`private_placement`)**: Return the single verified master collection link from `publish-batch` / `orchestrate-batch`:
  `https://choice-properties-site.pages.dev/listings.html#share={token}`
- **Standard Public Listings (`active`)**:
  `{n}. {Address}, {City}, {State} {Zip} (${Rent}/mo | {Beds} Bed / {Baths} Bath) — https://choice-properties-site.pages.dev/property.html?id={property_id}`
