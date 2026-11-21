# Choice Properties — Phased End-to-End Implementation Plan

> **Execution Model:** Independent, sequential/dependency-gated phases (`Phase 1` through `Phase 10`).  
> **Strict AI Rule:** Each AI session executes **ONE phase end-to-end** across GitHub (`choice121/Choice` `main`), Supabase (`tlfmwetmhthpyrytrcfo`), and Cloudflare Pages (`choice-properties-site`), verifies live deployment and acceptance tests, updates `docs/platform-evolution/00_AI_HANDOFF_AND_PHASE_TRACKER.md`, pushes to `main`, and asks permission strictly to advance to the next single unblocked phase.  
> **Final Phase Self-Cleanup:** In **Phase 10**, after all advanced & live regression checks pass, remove the entire `docs/platform-evolution/` directory cleanly and push final repository state.

---

## Dependency Overview

```
Phase 1 (Sync & Baseline Stabilization)
  ├──▶ Phase 2 (4-Digit Batches, Disposable Folders, Cross-Batch Model)
  │       ├──▶ Phase 3 (Permanent Private-Placement Registry & Link Lookup)
  │       └──▶ Phase 4 (Centralized Rules Engine & Version Admin)
  │               ├──▶ Phase 5 (Apify Default Scraper + Dual Manual Extension Parity)
  │               │       └──▶ Phase 6 (Automated Validation Engine)
  │               │               └──▶ Phase 7 (Baseline Enrichment & Pricing Engines)
  │               │                       └──▶ Phase 8 (Batch Publishing, Privacy & Verification) [needs P3,P6,P7]
  │               │                               └──▶ Phase 9 (Multi-AI Job Manager, Isolation & Cleanup) [needs P5,P8]
  │               └──────────────────────────────────────▶ Phase 10 (Unified Admin UI, Full E2E Tests & Final Doc Cleanup)
```

---

## PHASE 1 — Platform Sync, Canonical Edge Function Recovery & Baseline Stabilization

1. **Objective**: Reconcile git repository vs live Supabase Edge Functions, fix disconnected recovery purge cron scheduling, align Chrome/Orion manual extension photo cap constants (`MAX_PHOTOS`), and confirm clean end-to-end deploy pipeline across GitHub + Supabase + Cloudflare Pages.
2. **Existing Components Involved**:
   - `supabase/functions/` (26 local vs 59 live deployed), `.github/workflows/supabase-deploy.yml`, `.github/workflows/cloudflare-only.yml`
   - `pg_cron` job `#7` (`mark-expired-pipeline-recovery`) and `purge-expired-pipeline-recovery` Edge Function
   - `chrome-extension/background.js`, `chrome-extension/content.js`, `.pages-orion/`
3. **Proposed Functionality & Exact Scope**:
   - Audit all 33 live-only deployed Edge Functions; check callers across `js/`, `admin/`, `chrome-extension/`, `.pages-orion/`; recover active dependencies into `supabase/functions/` (or document intentionally external functions cleanly) so `.github/workflows/supabase-deploy.yml` has zero broken gaps.
   - Align `chrome-extension/background.js` `MAX_PHOTOS` desktop cap (`50`, mobile `20–25`) with `content.js` & `zillow-extract.ts` without breaking Orion or Desktop 1-click capture; run `node scripts/sync-and-bump-extension.mjs --patch` + validator if any extension file changes.
   - Schedule `purge-expired-pipeline-recovery` execution via `pg_cron` (right after `mark-expired-pipeline-recovery` or hourly at `:30`) cleanly using `net.http_post` / vault cron config so expired archive payloads purge on schedule (>24h).
4. **Database Changes**: New migration adding scheduled invocation for `purge-expired-pipeline-recovery` (idempotent `cron.schedule`).
5. **Backend / Edge Function Changes**: Reconcile local `supabase/functions/` parity & verify `deno cache --no-check` passes for every function directory.
6. **Frontend / Extension Changes**: Align `chrome-extension/background.js` `MAX_PHOTOS` constant if modified + rebuild extension bundles cleanly via `sync-and-bump-extension.mjs`.
7. **Dependencies**: None (First Phase).
8. **Risks & Compatibility**: Ensure recovered Edge Functions don't regress live deployed versions (`verify_jwt` settings in `supabase/config.toml` must match live settings). Preserve manual extension save UX (`v34+`).
9. **Testing & Acceptance Criteria**:
   - `npm run build` exits `0`; all extension tests (`chrome-extension/test-extractors.js`, `.pages-orion/test-extractors.js`, `validate-extension.mjs`) pass.
   - `deno cache --no-check` passes on 100% of Edge Functions in `supabase/functions/`.
   - Dry-run `POST /functions/v1/purge-expired-pipeline-recovery` (`{"dry_run": true}`) returns `200 OK` listing expired count cleanly.
   - Manual extension pre-flight HUD and `check_listing` endpoint work identically on live site.

---

## PHASE 2 — Four-Digit Batch Identities, Disposable Folders & Legacy Batch Compatibility

1. **Objective**: Implement strict 4-digit numeric Batch IDs (`^[0-9]{4}$`) with internal `batch_uuid`s for all future batches while preserving all 18 existing `PB-2026...` batches untouched; implement 1:1 disposable batch folders and intra-batch deduplication enabling the same ZPID across separate concurrent batches.
2. **Existing Components Involved**:
   - `public.publishing_batches`, `public.publishing_batch_properties`, `pipeline.pipeline_folders`, `pipeline.pipeline_properties`
   - `supabase/functions/receive-pipeline-import/index.ts`, `supabase/functions/import-from-url/index.ts`
   - `supabase/functions/_shared/pipeline-record.ts`, `js/admin/pipeline.js`
3. **Proposed Functionality & Exact Scope**:
   - Extend `public.publishing_batches` with `batch_uuid UUID UNIQUE DEFAULT gen_random_uuid()`, `batch_format TEXT DEFAULT 'legacy_pb'` (`CHECK` enforcing `'^[0-9]{4}$'` whenever `batch_format = 'four_digit'`), and `namespace_stats` check. Backfill existing 18 `PB-*` rows cleanly as `legacy_pb`.
   - Create batch registration RPC `public.batch_create(p_batch_id text, p_task_config jsonb, ...)` that:
     - Validates `p_batch_id ~ '^[0-9]{4}$'` (rejects invalid format).
     - Checks `public.publishing_batches` and active/archived `pipeline.pipeline_folders` so any previously assigned 4-digit ID fails immediately **before** creating any folder or importing properties (`{ ok: false, error: 'batch_id_already_used' }`).
     - Creates the permanent batch row AND 1:1 linked disposable folder (`pipeline.pipeline_folders.name = p_batch_id`, `is_disposable_batch = true`, `batch_id = p_batch_id`, `batch_uuid = ...`).
   - Update `pipeline.pipeline_properties` indexing & dedup in `receive-pipeline-import` and `import-from-url`:
     - Enforce unique `(COALESCE(batch_id, '__manual_inbox__'), source, source_listing_id)`.
     - Allow the same ZPID to enter two distinct `batch_id` folders (`4821` and `7364`) without conflict while blocking duplicates within the same batch (and preserving `save_nonce` idempotency for extension double-tap retries!).
   - Allow Manual Chrome/Orion extensions' Folder Pill to display and select disposable 4-digit batch folders (`📁 Batch #4821`) OR regular named folders seamlessly (`receive-pipeline-import` binds `batch_id` automatically when saving to a batch folder).
4. **Database / Backend / Frontend Changes**: Migration for schema/RPCs (`batch_create`, `batch_lookup`, updated `pipeline_list`/`pipeline_folder_list`), Edge updates in `receive-pipeline-import` & `import-from-url`, badge differentiation in `admin/pipeline.html`/`pipeline.js` (`Batch #4821` vs Customer Memory).
5. **Dependencies**: Phase 1.
6. **Testing & Acceptance Criteria**:
   - Existing 18 `PB-*` batches remain intact and queryable.
   - Creating Batch `4821` creates permanent batch row + disposable folder `4821`; attempting `4821` again fails before folder/import creation.
   - Same ZPID imported into Batch `4821` and Batch `7364` succeeds in both; importing it a second time into Batch `4821` returns intra-batch duplicate (unless matching `save_nonce`).
   - Manual Chrome/Orion extension can still save to normal folders OR `Batch #4821`.

---

## PHASE 3 — Permanent Private-Placement Registry & Batch Link Retrieval

1. **Objective**: Build the permanent Private-Placement Registry retaining batch metadata, generated `#share={token}` links, properties, pricing summaries, expiration status, and instant `"Give me batch {4821}"` retrieval independent of disposable folder deletion.
2. **Existing Components Involved**:
   - `public.publishing_batches`, `public.publishing_batch_properties`, `public.property_shares`, `public.property_share_properties`
   - `supabase/functions/property-share/index.ts`, `supabase/functions/pipeline-recovery/index.ts`
3. **Proposed Functionality & Exact Scope**:
   - Add permanent summary & link columns to `public.publishing_batches`: `pricing_summary jsonb`, `location_summary jsonb`, `category_summary jsonb`, `link_verified_at timestamptz`, `replaced_from_share_id uuid`, `replacement_reason text`.
   - Create `public.private_placement_registry` view + `public.registry_get_batch(p_batch_id text)` RPC + `private-placement-registry` Edge Function returning:
     - Exact stored `magic_link_url` (`https://choice-properties-site.pages.dev/listings.html#share={token}`) for any completed batch (both 4-digit and legacy `PB-*`) **without** inspecting `pipeline.pipeline_folders`, re-scraping, republishing, or creating a replacement token.
     - Computed real-time link status (`active`, `expired`, `revoked`, `not_generated`), exact `expires_at`, days remaining/expired, associated published property IDs & categories, and cleanup/recovery status.
   - Implement explicit admin-authorized link replacement (`action: 'replace_expired_link'`) requiring explicit reason + admin session, marking old share superseded/revoked and auditing replacement—never silent on read.
4. **Dependencies**: Phase 2.
5. **Testing & Acceptance Criteria**:
   - Requesting Batch `4821` after its disposable pipeline folder is deleted returns the exact original `#share={token}` URL with identical token hash.
   - Requesting an expired batch returns `{ status: 'expired', expires_at: ... }` cleanly without silently minting a new link.
   - Legacy `PB-*` batches also appear accurately in the registry with their stored `magic_link_url` and property lists.

---

## PHASE 4 — Centralized Rules & Policies Engine + Versioned Policy Admin

1. **Objective**: Centralize all permanent scraping, validation, enrichment, pricing, publishing, and cleanup policies in versioned database tables + Edge Function (`rules-engine`) so AI workers automatically fetch and obey active policies instead of repeating long instructions in prompts.
2. **Existing Components Involved**: `AGENTS.md`, `scripts/description-sanitizer.mjs`, `js/admin/pipeline.js` (`validateForPublish`).
3. **Proposed Functionality & Exact Scope**:
   - Create tables: `public.policy_sets`, `public.policy_rules`, `public.policy_change_log`, `public.prohibited_source_profiles`, `public.scraping_providers`.
   - Seed `policy_sets` `v1` (`active`) with all permanent Choice rules:
     - Immutable system rules (`is_immutable = true`): `application_fee = 50`, `security_deposit_multiplier = 1`, `require_authentic_address = true`, `min_usable_photos = 4`, `forbid_watermark_cropping = true`, `forbid_stock_or_ai_photos = true`, `forbid_name_only_owner_proof = true`, `preserve_original_description = true`, `forbid_batch_id_reuse = true`, `require_post_publish_verification = true`.
     - Configurable preferences (`is_immutable = false`): `description_mode = 'baseline_rewrite'` (options: `'baseline_rewrite' | 'sanitize_only'`), `max_description_length_variance_pct = 25`, `show_pet_policy_on_client_page`, `show_lease_summary_on_client_page`, `recovery_retention_hours = 24`, `share_link_ttl_days = 90`.
   - Seed `prohibited_source_profiles`: `Tricon Residential`, `MYNE`, `The Wayne`, `Main Street Renewal`, `American Avenue`, `American Homes 4 Rent` (with aliases like `AMH`, `AMH Homes`, `MSR`, `Tricon`).
   - Seed `scraping_providers`: `apify` (`is_default = true`, `channel_type = 'automated'`), `browser_extension_chrome` (`channel_type = 'manual'`), `browser_extension_orion` (`channel_type = 'manual'`), `admin_url_import` (`channel_type = 'manual'`), `homeharvest` (`enabled = false`, `is_default = false`).
   - Build `rules-engine` Edge Function supporting: `get_active_policy`, `pin_policy_to_batch`, `evaluate_dry_run` (test draft changes before activation), `activate_version`, and `prohibited_profiles` CRUD (blocking modification of `is_immutable` core rules by ordinary workers).
4. **Dependencies**: Phase 1, Phase 2.
5. **Testing & Acceptance Criteria**:
   - Updating a configurable rule creates a new `policy_sets` version with `policy_change_log` attribution (`changed_by`, `changed_at`), while an existing batch started under `v1` retains `policy_set_id = v1`.
   - Immutable rule mutation via worker API returns `403` / `immutable_rule_protected`.
   - `evaluate_dry_run` tests rule edits cleanly without modifying live active batches.

---

## PHASE 5 — Apify Default Scraping Engine & Dual-Channel Worker Integration

1. **Objective**: Build the centralized Apify automated Zillow scraper (`apify-scrape-worker` Edge Function) integrated with `scraping_providers`, `pipeline-record.ts`, and `pipeline_scrape_runs`, operating cleanly in parallel with the preserved Chrome & Orion manual extensions.
2. **Existing Components Involved**: `supabase/functions/_shared/pipeline-record.ts`, `supabase/functions/receive-pipeline-import/index.ts`, `pipeline.pipeline_scrape_runs`.
3. **Proposed Functionality & Exact Scope**:
   - Build `apify-scrape-worker` Edge Function reading `scraping_providers` (`apify` default) and `APIFY_API_TOKEN` from Supabase Edge secrets:
     - Triggers Apify Zillow search/detail actor for a given batch's `task_config` (locations, rent range, property types, quantity).
     - Handles Apify async run completion / polling / webhook callback cleanly within Edge timeout limits (chunked continuation / webhook resumption so large jobs never time out!).
     - Archives raw Apify payload per listing in `pipeline-raw-payloads` bucket.
     - Normalizes listings into `pipeline.pipeline_properties` via unified `pipeline-record.ts` adapter (`batch_id`, `folder_id` = disposable batch folder, `original_monthly_rent`, `source_raw_payload`, `field_provenance` including poster/profile category).
     - Enforces intra-batch dedup, rate-limit backoff, and writes structured telemetry to `pipeline.pipeline_scrape_runs` (`batch_id`, `provider_key = 'apify'`, counts).
   - Ensure `receive-pipeline-import` (manual Chrome/Orion) and `import-from-url` remain 100% functional and can optionally attach imports to a batch folder using the exact same normalization & provenance fields.
4. **Dependencies**: Phase 2, Phase 4.
5. **Testing & Acceptance Criteria**:
   - Live test run of `apify-scrape-worker` on a test 4-digit batch stages Zillow rentals cleanly into that batch's disposable folder with lossless provenance and `pipeline_scrape_runs` telemetry.
   - Simultaneous manual Chrome/Orion save still succeeds cleanly into either a named folder or a batch folder with zero regression.

---

## PHASE 6 — Automated Property Eligibility, Source Profile & Image Validation Engine

1. **Objective**: Implement automated multi-check `property-validator` Edge Function enforcing all property eligibility, owner/landlord proof, prohibited profile matching, single-apartment restriction, and `>= 4` usable watermark-free image rules before enrichment/publishing.
2. **Existing Components Involved**: `pipeline.pipeline_properties` (`validation_report`, `needs_review`), `public.prohibited_source_profiles`, `public.property_photos`, Watermark Sniper helpers.
3. **Proposed Functionality & Exact Scope**:
   - Build `property-validator` Edge Function + `public.pipeline_validate_batch` SQL helper:
     1. **Source Profile & Owner/Landlord Verification**: Parses structured `attributionInfo` / seller type / listing category. Marks verified owner/landlord **only** when explicitly typed (`Property Owner` / `Landlord`). Never treats person name alone as owner proof; routes unverified/ambiguous profiles to `needs_review` (`unverified_source_profile`).
     2. **Prohibited Profile Matcher**: Normalized fuzzy + token-phrase matching against `public.prohibited_source_profiles` across `agent_name`, `broker_name`, description signatures, and `source_raw_payload`, minimizing false positives while catching variations (`Tricon`, `AMH`, `Main Street Renewal`, `MYNE`, `The Wayne`, `American Avenue`). Match -> `rejected` (`prohibited_source_profile`).
     3. **Property Type & Apartment Structure Gate**: Accepts `SINGLE_FAMILY`, `TOWNHOUSE`/`TOWNHOMES`, and strictly verified single-unit fixed-price `APARTMENT`s (`total_units` / no `floor_plans` array / no unit selector / no `price_range`). Rejects multi-unit complexes (`multi_unit_apartment_complex`); routes ambiguous structures to `needs_review`.
     4. **Media & Image Eligibility**: Validates `>= 4` live HTTP-reachable, non-broken, non-duplicate images; screens images (via AI/Vision or automated watermark/branding detector + existing Sniper flags) for visible logos, watermarks, copyright stamps, or contact overlays. Rejects/holds flagged listings; **never crops/obscures watermarks** and **never inserts stock/AI photos**.
     5. **Core Completeness & Quality Preferences**: Checks valid address, rent `> 0`, beds, fractional baths (Rule 6A), `original_description`; scores optional documented quality preferences (renovated kitchen/bath, modern appliances, etc.) strictly from source evidence without fabrication.
   - Persists full structured `validation_report` JSON (`checks[]`, `status`: `'passed' | 'needs_review' | 'rejected'`, `reasons[]`, `quality_signals[]`, `validated_at`, `policy_version`).
4. **Dependencies**: Phase 4, Phase 5.
5. **Testing & Acceptance Criteria**:
   - Prohibited profile fixture (e.g., `Main Street Renewal` / `AMH`) is automatically rejected.
   - Person name without explicit Owner/Landlord metadata is held in `needs_review` (not marked verified owner).
   - Apartment with floor-plan selector or price range is rejected; `< 4` usable photos fails gate; watermarked test image is flagged without cropping.
   - Valid `>= 4`-photo single-family house passes cleanly with full `validation_report`.

---

## PHASE 7 — Centralized Description Enrichment & Task-Specific Pricing Engines

1. **Objective**: Deploy centralized `enrich-description` (baseline-preserving rewrite + sanitization + audit) and `calculate-pricing` (`none`, `fixed`, `individual_map`, proportional range formula) Edge Functions.
2. **Existing Components Involved**:
   - `scripts/description-generator.mjs`, `scripts/description-sanitizer.mjs`, `public.description_enrichment_audit`
   - `pipeline.pipeline_properties` (`original_description`, `ai_description_draft`, `approved_description`, `original_monthly_rent`, `monthly_rent`, `description_enrichment_meta`, `enrichment_status`)
3. **Proposed Functionality & Exact Scope**:
   - **Description Enrichment (`enrich-description`)**:
     - Reads `original_description` strictly as baseline; preserves original meaning, factual statements, tone, writing style, and comparable length (default target variance tolerance governed by active Rules Engine policy).
     - Enforces Choice sanitization (strips broker/agent names, phones, emails, external URLs/portals, deposits, showing CTAs per policy; appends `"Application Fee: $50. Submit your rental application today at Choice Properties."`).
     - Post-check verifies zero invented facts, zero prohibited leakage, and reasonable length ratio; holds incomplete/contradictory source copy in `needs_review` (`enrichment_incomplete_source`).
     - Stores `original_description` untouched, writes draft to `ai_description_draft` and verified output to `approved_description` / `description`, and inserts audit telemetry into `public.description_enrichment_audit`.
   - **Pricing Engine (`calculate-pricing`)**:
     - Always preserves original asking rent in `original_monthly_rent` and prevents double adjustment via idempotent pricing state (`pricing_calculations`).
     - Supports all 4 modes: `none`, `fixed`, `individual_map`, and `proportional_range`:
       `ROUND(TargetMin + ((OriginalRent - SourceMin) / (SourceMax - SourceMin)) * (TargetMax - TargetMin))`
     - Validates `SourceMax > SourceMin` (stops job with clear clarification error if equal/invalid); holds properties whose `original_monthly_rent` falls outside `[SourceMin, SourceMax]` in `needs_review`; guarantees results stay clamped within `[TargetMin, TargetMax]` and preserve monotonic relative rent ordering; logs every calculation to `public.pricing_calculations`.
4. **Dependencies**: Phase 4, Phase 6.
5. **Testing & Acceptance Criteria**:
   - Proportional range calculation matches exact formula (`$1,400->$1,550`, `$1,950->$1,850`, midpoint proportional, whole-dollar rounded); re-running is idempotent (no double adjustment).
   - Out-of-range rent routes property to `needs_review`; `SourceMin === SourceMax` halts pricing cleanly requesting clarification.
   - `enrich-description` preserves original facts/length within configured variance, strips prohibited strings, preserves `original_description`, and writes `description_enrichment_audit` rows.

---

## PHASE 8 — Batch-Scoped Private-Placement Publishing, Visibility Shielding & Verification

1. **Objective**: Upgrade batch publishing so multiple batches publish independently (partial-success safe, batch-specific price/description overlay), enforce complete client-facing private-placement SEO/data privacy, generate/bind permanent registry `#share=` links, and run mandatory post-publish live verification (`verify-batch-publication`).
2. **Existing Components Involved**:
   - `pipeline_publish` / `pipeline_publish_with_status`, `property-share/index.ts`, `js/property.js`, `js/listings.js`, `functions/rent/[state]/[city]/[slug].js`, `functions/sitemap-properties.xml.js`
3. **Proposed Functionality & Exact Scope**:
   - Implement batch-scoped publisher (`publish-batch` Edge Function wrapping `pipeline_publish` per eligible validated/enriched/priced property):
     - Isolated per-property transactions: if Property #4 fails, Properties #1–3 stay published and Property #4 remains in staging/review (`failed_count` tracked).
     - Records per-batch `published_rent` & `published_description` on `public.publishing_batch_properties` so multi-batch reuse of the same canonical property never overwrites sibling batches' pricing/copy.
     - Mints 1 batch share token via `property-share` (90-day expiry) -> stores `share_id`, `magic_link_url`, summaries, and `published` associations on `public.publishing_batches`.
   - Enforce **Client Privacy & Public Discovery Hygiene**:
     - `private_placement` remains excluded from `active` feeds, public search, homepage, recommendations, `/sitemap-properties.xml`, and `/rent/<state>/<city>/<slug>` public SSR.
     - `property-share` projects strict client-safe field allowlist (no `agent_name`, `broker_name`, `landlords`, `source_url`, `original_data`, `source_raw_payload`, `field_provenance`, `showing_instructions`) and overlays batch-specific `published_rent`/`published_description` when resolved via share token.
     - `js/property.js` adds `<meta name="robots" content="noindex, nofollow">`, suppresses public canonical `/rent/...` tag & `RealEstateListing` JSON-LD on `private_placement`, and never renders `"Private Placement"` badges.
   - Build **`verify-batch-publication` Edge Function**:
     - Confirms DB rows, batch linkage, `status = 'private_placement'`, live `#share={token}` resolution (`property-share`), live rendered page check / HTTP media reachability (`>= 4` images), displayed rent & enriched description parity, and absence of internal source fields before setting `publishing_batches.link_verified_at`.
4. **Dependencies**: Phase 3, Phase 6, Phase 7.
5. **Testing & Acceptance Criteria**:
   - Partial publish failure leaves valid properties live in the batch share link while failing record stays recoverable.
   - Public browse/search/sitemap do not show `private_placement` listings; `#share={token}` shows batch properties with zero `"Private Placement"` badges and zero broker/source/URL strings; same property in two batches renders each batch's respective price cleanly.
   - `verify-batch-publication` checks live link + media + DB parity and fails explicitly if any check breaks.

---

## PHASE 9 — Concurrent Multi-AI Job Manager, Worker Isolation & Safe Disposable Folder Cleanup

1. **Objective**: Implement concurrent multi-worker job orchestration (`job-manager` Edge Function) with atomic claiming, leases, heartbeats, abandoned-job recovery, and verified disposable folder cleanup + 24h recovery preservation.
2. **Existing Components Involved**: `pipeline.pipeline_folders`, `pipeline.pipeline_recovery_archive`, `supabase/functions/pipeline-recovery/index.ts`, `supabase/functions/purge-expired-pipeline-recovery/index.ts`, `pg_cron`.
3. **Proposed Functionality & Exact Scope**:
   - Add `pipeline.batch_jobs` & `pipeline.batch_job_workers` + atomic claim RPC (`FOR UPDATE SKIP LOCKED`) + lease TTL + heartbeat renewal + stale-lease reaper via `pg_cron`.
   - Build `job-manager` Edge Function exposing standardized short-prompt Worker Contract actions:
     - `register_job` (validates 4-digit ID, locks policy version, creates batch + disposable folder)
     - `claim_next_or_assigned` (worker-scoped ownership check; another worker cannot mutate a leased batch without admin override)
     - `heartbeat`, `report_stage`, `pause_job`, `resume_job`, `cleanup_disposable_folder`
   - **Safe Cleanup Workflow (`cleanup_disposable_folder`)**:
     - Blocked unless `publishing_batches.link_verified_at IS NOT NULL` AND permanent registry entry is verified.
     - Calls archive snapshot to `recovery/{batch_id}/` + `pipeline.pipeline_recovery_archive` (`24h` `recovery_expires_at`).
     - Deletes ONLY `published` / verified-completed rows from active `pipeline.pipeline_properties` inside that batch folder; holds `failed` / `needs_review` records safely in staging or explicit review queue.
     - Deletes the disposable `pipeline.pipeline_folders` row ONLY when zero active/unresolved rows remain—leaving `public.properties`, `public.property_photos`, `public.property_shares`, and `public.publishing_batches` permanent registry 100% untouched!
4. **Dependencies**: Phase 5, Phase 8.
5. **Testing & Acceptance Criteria**:
   - Run 3+ concurrent simulated AI workers simultaneously on separate 4-digit batches (`4821`, `7364`, `1905`): zero cross-batch leakage, independent failures do not halt sibling batches.
   - Simulate worker interruption mid-batch: lease expires cleanly, incomplete job transitions safely for resume without losing completed properties.
   - Deleting disposable batch folder leaves published properties, photos, `#share=` URL, and `"Give me batch 4821"` registry retrieval 100% intact.

---

## PHASE 10 — Unified Admin Control Center, Full E2E Test Suite, Live Verification & Final Plan Cleanup

1. **Objective**: Deliver cohesive Admin Console modules for all 8 operational domains, execute every required end-to-end & regression test live across GitHub + Supabase + Cloudflare Pages, and perform **mandatory removal of temporary audit/plan docs (`docs/platform-evolution/`)** once verified.
2. **Existing Components Involved**: `admin/*.html`, `js/admin/*.js`, `js/cp-shell.js`, existing admin nav & dashboard.
3. **Proposed Functionality & Exact Scope**:
   - Integrate streamlined functional modules into Admin Console (preserving existing `dashboard`, `pipeline`, `applications`, `leases`, `watermark-sniper`, and `"4-digit ID"` customer memory distinction):
     1. **Rules & Policies** (`admin/rules-policies.html` or tab): view active rules, edit configurable settings, prohibited profiles manager, policy version history, dry-run tester.
     2. **Batch Manager** (4-digit batch creation, disposable folders, worker ownership, status/counts).
     3. **Job Monitor** (active/concurrent workers, current stage, progress, pause/resume/retry controls).
     4. **Validation Queue** (source-profile flags, image/watermark rejections, apartment checks, review queue resolution).
     5. **Enrichment Review** (side-by-side `original_description` vs `ai_description_draft` / `approved_description`, audit view).
     6. **Pricing Audit** (original rent, source/target range, method, calculated price history).
     7. **Private Placement Registry** (instant 4-digit ID search, copy actual `#share=` link, expiration status, explicit replace-link action, property breakdown).
     8. **Recovery & Cleanup Manager** (disposable folder states, 24h recovery archive, explicit restore action, cleanup status).
   - **Full Live End-to-End Verification Suite** (automated test runner + live smoke checks covering all 12 required E2E tests + Manual Extension Chrome/Orion regression + Apify pipeline + legacy `PB-*` batch compatibility).
   - **Mandatory Final Cleanup**:
     - After ALL tests pass 100% live, delete `/docs/platform-evolution/` (`00_AI_HANDOFF_AND_PHASE_TRACKER.md`, `01_SYSTEM_AUDIT_REPORT.md`, `02_TARGET_ARCHITECTURE_AND_SCHEMA.md`, `03_PHASED_IMPLEMENTATION_PLAN.md`) cleanly while keeping permanent docs (`docs/MANUAL_BROWSER_EXTENSIONS_GUIDE.md`, `docs/APIFY_AUTOMATED_SCRAPING_GUIDE.md`).
     - Run final `npm run build`, push clean `main` commit, confirm GitHub Actions & Cloudflare Pages `choice-properties-site` green, and notify the owner that **all phases are complete and ready for live testing**.
4. **Dependencies**: Phases 1–9.
5. **Mandatory Verification Matrix (Must All Pass Live Before Cleanup Commit)**:
   - [ ] **Test 1 — Normal batch**: Valid 4-digit ID -> Apify scrape -> validate -> enrich -> price -> publish -> verify -> registry save -> folder cleanup -> actual link retrievable.
   - [ ] **Test 2 — Duplicate batch ID**: Existing 4-digit ID blocked before folder creation or scraping.
   - [ ] **Test 3 — Concurrent batches**: 3+ simultaneous batches run in isolation with distinct progress & outcomes.
   - [ ] **Test 4 — Same property across different batches**: Same ZPID in 2 separate batches succeeds with independent batch prices/associations.
   - [ ] **Test 5 — Duplicate within one batch**: Repeat import of same ZPID in same batch handled idempotently without duplicate row.
   - [ ] **Test 6 — Partial publishing failure**: 1 invalid property fails cleanly while sibling valid properties publish intact.
   - [ ] **Test 7 — Folder deletion**: Deleting verified disposable batch folder preserves published properties, media, link, token, and registry history.
   - [ ] **Test 8 — Batch link retrieval**: `"Give me batch {id}"` returns exact original `#share=` link from registry (zero rescrape/republish/token-mint).
   - [ ] **Test 9 — Expired link**: Expired batch reports actual expired status without silently generating replacement token.
   - [ ] **Test 10 — Worker interruption**: Interrupted worker lease recovers cleanly and preserves completed work.
   - [ ] **Test 11 — Policy version consistency**: Mid-run policy update leaves active batch pinned to its starting `policy_set_id`.
   - [ ] **Test 12 — Existing app + Manual Extension regression**: Public browse, `/rent/...` SSR, Chrome Extension Desktop + Orion Mobile 1-click save, apply flow, lease signing, and all 18 legacy `PB-*` batches work 100%.
