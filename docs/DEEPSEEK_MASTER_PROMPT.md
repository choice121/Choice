# Choice Properties — Updated Permanent DeepSeek Master Prompt

Copy everything inside the template block below into DeepSeek. DeepSeek fills in only the temporary `[JOB_PARAMETERS]` placeholders for each batch. When pasting the generated prompt to the Web Builder AI, it executes as an **ephemeral, stateless job** using the permanent publishing engine (`scripts/engine/publish-runner.mjs`) — leaving the codebase clean and active pipeline empty of finished work.

---

```text
CHOICE PROPERTIES — EPHEMERAL PUBLISHING EXECUTION PROMPT
(Stateless Single-Job Instruction — DO NOT save job parameters into project files)

[JOB_PARAMETERS]
WORKFLOW_MODE: {{workflow_mode}}                    # pipeline_publish | scrape_and_publish
TARGET_MARKET: "{{city_state}}"                     # e.g., "Dallas, TX"
PUBLICATION_VISIBILITY: {{visibility}}              # private_placement | active
SCRAPE_SOURCE: {{scrape_source}}                    # realtor | zillow | redfin | opendoor | url_import (used only for scrape_and_publish)
TARGET_COUNT: {{target_count}}                      # e.g., 10
BEDROOMS_FILTER: {{bedrooms}}                       # exact number or "any"
BATHS_MIN: {{baths_min}}                            # decimal or "any"
BATHS_MAX: {{baths_max}}                            # decimal or "any"
MAX_RENT: {{max_rent}}                              # monthly dollar ceiling or "none"
PIPELINE_IDS: "{{comma_separated_pp_ids}}"          # optional specific PP-XXXXXXXX IDs, or ""
IMPORT_URLS: "{{comma_separated_urls}}"             # optional explicit URLs for scrape_and_publish, or ""
CUSTOM_INSTRUCTIONS: "{{batch_notes_or_none}}"      # temporary rent/filter rules for THIS batch only

================================================================================
MANDATORY EXECUTION & ISOLATION RULES
================================================================================

1. TEMPORARY & STATELESS EXECUTION (STRICT ISOLATION)
- Treat this entire prompt and [JOB_PARAMETERS] as strictly TEMPORARY for THIS batch only.
- NEVER save these parameters, target cities, custom instructions, or generated commands into AGENTS.md, config files, Edge Functions, or new standalone scripts.
- NEVER reuse cities, pricing adjustments, counts, or rules from any earlier conversation or batch.
- Execute exclusively through the existing permanent engine:
  - Audit:   npm run audit-pipeline -- --target "<City, State>"
  - Publish: npm run publish-batch -- --workflow <workflow_mode> --market "<City, State>" --visibility <visibility> --count <count> [temporary CLI flags]

2. RECOVERY ARCHIVE ISOLATION (NEVER AUTOMATICALLY SEARCH OR RETRIEVE)
- Active pipeline work comes ONLY from `pipeline.pipeline_properties` (status in `scraped`, `edited`) or freshly scraped listings in Workflow B.
- STRICTLY PROHIBITED unless the operator explicitly commands a restoration:
  * Searching `pipeline.pipeline_recovery_archive` for past properties.
  * Restoring previously deleted batches or reusing previously processed payloads.
  * Treating archived or expired records as new scraping candidates.

3. WORKFLOW DISPATCH
- If WORKFLOW_MODE = pipeline_publish:
  1. Run pre-flight audit against active `pipeline.pipeline_properties` for TARGET_MARKET (and optional PIPELINE_IDS).
  2. Do NOT run scrapers; work strictly with matching pending rows in the active pipeline.
- If WORKFLOW_MODE = scrape_and_publish:
  1. Invoke approved scraper/importer (`scraper/scraper.py` without `--publish`, or `import-from-url`) for TARGET_MARKET / IMPORT_URLS to stage fresh rows into `pipeline.pipeline_properties`.
  2. Immediately proceed through the identical enrichment, verification, publishing, history logging, and cleanup pipeline as Workflow A.

4. NON-NEGOTIABLE CHOICE PROPERTIES STANDARDS
- Application Fee: Strictly `50` in DB; descriptions MUST state `"Application Fee: $50. Submit your rental application today at Choice Properties."` Never zero/free/waived fee language.
- Security Deposit: Strictly `1x monthly_rent` in `public.properties.security_deposit`, and ZERO mentions of security deposits in descriptions.
- Prohibited Display Fields: Strictly `null` and stripped from descriptions:
  * No pet info (`pets_allowed: null`, `pet_types_allowed: null`, `pet_deposit: null`)
  * No lease terms (`lease_terms: null`, `minimum_lease_months: null`)
  * No available/move-in dates (`available_date: null`)
  * No smoking policy (`smoking_allowed: null`)
  * Strip external broker/agent phones, emails, MLS cross-links, portal URLs, and showing/tour CTAs.
- Bathroom Decimal Precision: Never truncate fractional baths (`1.5`, `2.5`, `3.5`). Check both structured counts and listing text.
- Architectural Classification: `DUPLEX` / `TOWNHOUSE` / `APARTMENT` / `CONDO` / `SINGLE_FAMILY` based on physical structure over portal defaults.
- Titles: Clean standardized address format: `{Address}, {City}, {State} {Zip}`.
- Photos: Direct source CDN URLs in strict original source order (`display_order: 1`, `is_hero: true` for photo 1). Zero photo count gate and zero automated reordering.
- Independent Cross-Batch Republication & Intra-Batch Deduplication: Every new publishing batch is independent. A property that was previously published (publicly, privately, or in any earlier batch at the same or different rent) is NEVER skipped and must be processed again as an independent publishing instance linked to its physical property parent (`parent_property_id`). Within the same batch only, duplicate entries for the same physical property are detected and deduplicated so the property is not processed twice in one batch. Retrying a completed or partial batch (`--retry-batch <PB-ID>`) remains idempotent and never creates duplicate properties, shares, or logs.

5. VERIFY -> RECORD HISTORY -> STAGE 1 CLEANUP (24-HOUR RECOVERABLE)
1. Verify every inserted row in `public.properties` + `public.property_photos` exists with exact counts.
2. If PUBLICATION_VISIBILITY = private_placement: create single 90-day entry in `public.property_shares` + `public.property_share_properties`, and verify live resolution against `/functions/v1/property-share`. (NEVER render any "Private Placement" badge/label on cards or pages.)
3. Record lightweight batch + property snapshots in `public.publishing_batches` and `public.publishing_batch_properties` BEFORE pipeline cleanup. (No giant raw Zillow JSON, no full photo arrays, no raw secret exposure.)
4. Stage 1 Cleanup (ONLY verified succeeded pipeline IDs — NEVER delete failed rows or wipe entire queue):
   - Archive verified rows into `pipeline.pipeline_recovery_archive` with `recovery_expires_at = now() + 24 hours`.
   - Move associated raw payload blobs in `pipeline-raw-payloads` to `recovery/<batch_id>/`.
   - Remove ONLY the verified rows from `pipeline.pipeline_properties`.
   - Published rows in `public.properties`, `public.property_photos`, and `public.property_shares` remain live and untouched.
5. Run post-cleanup verification probe confirming processed IDs are absent from `pipeline.pipeline_properties` while published properties & magic link remain live.

6. 24-HOUR RECOVERY & AUTOMATIC STAGE 2 PERMANENT PURGE
- Within 24 hours of Stage 1 deletion, properties remain recoverable ONLY on explicit administrator instruction (`npm run recovery-manager -- --restore-batch <PB-ID>` or Admin UI), restoring them into `pipeline.pipeline_properties` under their original batch grouping WITHOUT auto-republishing.
- After 24 hours, automated cron (`purge-expired-pipeline-recovery`) permanently deletes expired snapshots (`pipeline_row_snapshot = NULL`) and removes raw Storage blobs, marking history status `permanently_deleted` while preserving the lightweight historical audit record.

7. MANDATORY OUTPUT FORMAT
- Report the Batch ID (`PB-YYYYMMDD-XXXX`), counts (processed / published / failed), verification results, Stage 1 cleanup + 24h recovery expiration timestamp, and:
  * If PUBLICATION_VISIBILITY = private_placement: output ONE single master magic link:
    https://choice-properties-site.pages.dev/listings.html#share={token}
  * If PUBLICATION_VISIBILITY = active: output numbered live property links in exact format:
    1. {Address}, {City}, {State} {Zip} (${Rent}/mo | {Beds} Bed / {Baths} Bath) — https://choice-properties-site.pages.dev/property.html?id={property_id}
```
