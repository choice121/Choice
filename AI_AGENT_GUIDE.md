# AI Agent Guide — Choice Properties Pipeline

> **Read this first.** This file tells you everything you need to know to scrape,
> enrich, and publish rental listings to the Choice Properties website.
> No external AI services are needed — the entire pipeline runs locally.

---

## The One Command

All scraping and publishing goes through one universal runner:

```bash
python3 scraper/run_ai_job.py --instructions '<json>'
```

Or from a file:

```bash
python3 scraper/run_ai_job.py --instructions-file job.json
```

Or quick CLI mode:

```bash
python3 scraper/run_ai_job.py \
  --location "Dallas, TX" \
  --beds-exact 2 \
  --baths-min 1.0 \
  --rent-min 1300 \
  --rent-max 1800 \
  --rent-cap 1500 \
  --target 10
```

---

## What You Must Know (Read These Files)

| File | Why |
|---|---|
| `scraper/PLATFORM_RULES.md` | **Mandatory rules** — never bypass these |
| `scraper/RULES.md` | Quick reference for what is/isn't allowed |
| `scraper/PIPELINE_USAGE.md` | How the 13-step pipeline works |
| `scraper/enrichment.py` | All enrichment logic (cleaning, fees, watermarks, CTA) |
| `scraper/pipeline.py` | The `PipelineOrchestrator` class — the engine |

---

## Workflow for Any AI Agent

```
1. USER GIVES YOU INSTRUCTIONS
   Example: "Find 10 2-bedroom houses in Dallas, TX between $1300-1800"

2. YOU READ THE RULES
   - Read scraper/PLATFORM_RULES.md
   - Read scraper/RULES.md
   - Understand the mandatory requirements

3. YOU CONSTRUCT THE JOB
   - Translate user instructions into JSON criteria
   - Use run_ai_job.py --instructions '<json>'

4. YOU RUN THE PIPELINE
   - Execute: python3 scraper/run_ai_job.py --instructions '<json>'
   - The pipeline runs 13 steps automatically:
     1. Scrape Realtor.com (HomeHarvest + Phase 2 detail pages)
     2. Filter active/available + deduplicate
     3. Apply criteria filters + watermark detection
     4. Apply pricing rules
     5. Verify 6+ source photos
     6. Enrich (clean descriptions, normalize fees, add CTA, etc.)
     7. Pre-publish validation
     8. Stage in pipeline_properties
     9. Patch pricing + description
     10. Publish via RPC
     11. Activate property
     12. Upload photos to ImageKit
     13. Return live URLs

5. YOU RETURN LIVE URLS
   - Parse stdout for "Published URLs:" section
   - Or use --json-output and parse the JSON
   - Return the URLs to the user so they can view live listings
```

---

## Job Instructions JSON Format

```json
{
  "locations": ["Dallas, TX"],
  "fallback_locations": ["Fort Worth, TX"],
  "beds_exact": 2,
  "beds_min": 2,
  "beds_max": 3,
  "baths_min": 1.0,
  "baths_max": 2.0,
  "rent_min": 1300,
  "rent_max": 1800,
  "rent_floor": 1300,
  "rent_cap": 1500,
  "allowed_types": ["SINGLE_FAMILY", "TOWNHOMES"],
  "target": 10,
  "past_days": 90,
  "limit": 200,
  "min_score": 75,
  "batch_name": "Dallas 2BR Batch",
  "folder_name": "Dallas Q3",
  "dry_run": false,
  "strict_watermarks": false
}
```

### Field Reference

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `locations` | list[str] or str | **yes** | — | Cities to scrape, e.g. `["Dallas, TX", "Arlington, TX"]` |
| `fallback_locations` | list[str] or str | no | [] | Extra cities if primary doesn't hit target |
| `beds_exact` | int | no | — | Exact bedroom count (overrides min/max) |
| `beds_min` / `beds_max` | int | no | — | Bedroom range |
| `baths_min` / `baths_max` | float | no | 1.0 / — | Bathroom range |
| `rent_min` / `rent_max` | int | no | 800 / 3500 | Scraped rent filter |
| `rent_floor` / `rent_cap` | int | no | — | Published rent range (pricing rule) |
| `allowed_types` | list[str] or str | no | all types | Property types: `SINGLE_FAMILY`, `TOWNHOMES`, `APARTMENT`, `CONDOS` |
| `zip_codes` | list[str] | no | [] | Per-ZIP scraping for full metro coverage |
| `target` | int | no | 10 | How many listings to publish |
| `past_days` | int | no | 90 | How far back to scrape |
| `limit` | int | no | 200 | Max listings per location per source |
| `min_score` | int | no | 75 | Minimum data quality score (0-100) |
| `batch_name` | str | no | auto | Label shown in logs |
| `folder_name` | str | no | — | Assign published listings to this pipeline folder |
| `dry_run` | bool | no | false | Preview without database writes |
| `strict_watermarks` | bool | no | false | Reject listings with ANY branded photo |

---

## Hard Requirements (Never Bypass)

These are enforced automatically by the pipeline. You don't implement them — the system does. But you must know them:

| Rule | What It Means |
|---|---|
| **Min 6 photos** | Every listing must have at least 6 source images before publishing |
| **All photos on ImageKit** | No external/hotlinked photo URLs in final listings |
| **Application fee = $50** | Both the `application_fee` field and description must say $50 |
| **Security deposit = 1x rent (DB only)** | `security_deposit` in the database equals `monthly_rent`; **NEVER** quote or mention deposits in descriptions |
| **No security deposit in descriptions** | All security deposit mentions, amounts, and clauses are completely stripped from listing descriptions during enrichment |
| **No lease terms / duration** | Lease terms are removed from enrichment documentation so no properties show that. Never extract, assign, or display `lease_terms` or `minimum_lease_months` |
| **Pets allowed = Yes** | Every listing is published as pet-friendly |
| **No competitor branding** | Listings from FirstKey, Invitation Homes, Progress Residential, Tricon, Coldwell Banker, Keller Williams, RE/MAX, Century 21, Berkshire Hathaway, Main Street Renewal, AMH, eXp Realty, etc. are dropped |
| **No tour/showing language** | "Schedule a tour", "Book a showing", "Open house", etc. is stripped |
| **No external portal refs** | TurboTenant, Zillow application, Apartments.com instructions are stripped |
| **No agent/owner names** | Personal contact references are stripped |
| **Apply CTA at end** | Every description ends with "Apply now at Choice Properties" |
| **Rent consistency** | Description rent figure must match published `monthly_rent` |
| **monthly_rent required** | Listing cannot be published without rent set |

---

## Watermark Avoidance

The system automatically protects against watermarked/branded content:

### Text/ Metadata Watermarks (Automatic)
The pipeline checks every listing's text fields for competitor brand names:
`is_watermarked()` in `scraper/enrichment.py` scans:
- `agent_name`, `broker_name`
- `description`, `showing_instructions`
- `original_data` JSON blob

Any match → **entire listing is dropped** before staging.

### Branded Photo Filtering (Automatic)
`filter_branded_photos()` removes individual photos that show:
- Competitor brand names in URLs (`firstkeyhomes`, `invitationhomes`, etc.)
- Agent/broker headshot paths (`/agent-photo`, `/headshot`, `/team-photo`, etc.)
- Known corporate CDNs (`agent.realtor.com`, `photos.cbkw.com`, etc.)
- URL path segments containing `/watermark` or `/logo.`

If ALL photos are branded, the listing is dropped entirely.
If only SOME are branded, the clean ones are kept.

### Strict Mode
Use `"strict_watermarks": true` in instructions to be more aggressive:
- Any listing with branded photos is rejected, even if clean photos remain
- Useful when you want zero branded content in your inventory

### Post-Upload Content Check (Future)
The `property_photos` table has a `watermark_status` column.
A future edge function can scan uploaded images for visible watermarks
using lightweight OCR or perceptual hashing.

---

## How to Get Live URLs Back

### Method 1: Parse stdout (default)

```
Published URLs:
  https://choice-properties-site.pages.dev/rent/tx/dallas/2br-single-family-abc123/
  https://choice-properties-site.pages.dev/rent/tx/dallas/2br-single-family-def456/
```

Extract all lines starting with `https://` under "Published URLs:".

### Method 2: JSON output (recommended for AI)

```bash
python3 scraper/run_ai_job.py --instructions '<json>' --json-output
```

Output:
```json
{
  "ok": true,
  "published_urls": [
    "https://choice-properties-site.pages.dev/rent/tx/dallas/2br-single-family-abc123/",
    ...
  ],
  "stats": { "published": 10, ... },
  "errors": []
}
```

Parse `result["published_urls"]` — that's your deliverable.

---

## Error Handling

| Situation | What Happens | What You Should Do |
|---|---|---|
| Missing env vars | Fatal error, exit 1 | Tell user to set credentials in `.env` |
| Missing packages | Fatal error, exit 1 | Tell user to `pip install requests homeharvest` |
| No listings found | Error in output, exit 1 | Broaden criteria (wider rent range, more locations, more past_days) |
| All blocked by watermark | Listed in dropped count | Normal — try different locations or criteria |
| All fail validation | Listed in invalid count | Check photo counts, fix descriptions |
| Partial publish | Some URLs returned | Return what was published, note failures |

### When Things Go Wrong

1. **Zillow blocked** — Zillow blocks datacenter IPs. Use Realtor.com instead (`--source realtor` is default).
2. **Not enough photos** — Lower `rent_min`/`rent_max` or add more `locations`/`fallback_locations`.
3. **All watermarked** — The market may be dominated by corporate landlords. Try a different city.
4. **Validation failures** — Check that descriptions don't mention wrong fees, tours, or external portals.

---

## Quality Targeting

To get the best results:

1. **Set `min_score: 75` or higher** — only keeps listings with rich data
2. **Use `rent_floor`/`rent_cap`** — controls pricing without a custom function
3. **Provide `fallback_locations`** — if primary cities are thin, the pipeline automatically tries nearby areas
4. **Use ZIP codes** — `zip_codes: ["75201", "75202"]` gives 200 results per ZIP vs 200 for the whole city

---

## Source Sites

| Source | IP Restriction | Data Richness |
|---|---|---|
| **Realtor.com** (default) | None — works from anywhere | Phase 1: search data. Phase 2: up to 50 HD photos, full description, virtual tours |
| **Zillow** | Requires residential IP (mobile data, home WiFi) | Richer data but blocked from Replit/datacenters |

**Always use Realtor.com from Replit or CI.** Zillow only works from residential IPs (iSH on iPhone, home network).

---

## Credentials

All credentials are in `scraper/.env` (already configured):

```
SUPABASE_URL=https://tlfmwetmhthpyrytrcfo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
IMAGEKIT_PRIVATE_KEY=...
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/21rg7lvzo
```

Never commit or expose these. The runner reads them automatically.

---

## Quick Reference: The 13 Steps

| Step | What Happens | You Do? |
|---|---|---|
| 1. Scrape | HomeHarvest + Phase 2 detail fetch | Nothing — automatic |
| 2. Dedup | Remove duplicates within batch | Nothing — automatic |
| 3. Filter | Apply criteria + watermark check | Nothing — automatic |
| 4. Price | Apply rent adjustments | Nothing — automatic (or provide `pricing_fn`) |
| 5. Photo gate | Verify 6+ source images | Nothing — automatic |
| 6. Enrich | Clean, normalize, CTA, fee normalization | Nothing — automatic |
| 7. Validate | Pre-publish gate checks | Nothing — automatic |
| 8. Stage | Insert into `pipeline_properties` | Nothing — automatic |
| 9. Patch | Update pricing + description | Nothing — automatic |
| 10. Publish | Create live property record | Nothing — automatic |
| 11. Activate | Set status = active | Nothing — automatic |
| 12. Photos | Upload to ImageKit + verify | Nothing — automatic |
| 13. URLs | Build and return live URLs | **You return these to the user** |

---

## Example: Complete AI Agent Session

```
USER: Find me 10 pet-friendly 2BR houses in Dallas, TX around $1500/month

AI (you):
  1. Read PLATFORM_RULES.md, RULES.md, PIPELINE_USAGE.md
  2. Construct JSON:
     {
       "locations": ["Dallas, TX"],
       "beds_exact": 2,
       "baths_min": 1.0,
       "rent_min": 1300,
       "rent_max": 1700,
       "rent_cap": 1500,
       "target": 10,
       "past_days": 90,
       "min_score": 75,
       "allowed_types": ["SINGLE_FAMILY", "TOWNHOMES"]
     }
  3. Run: python3 scraper/run_ai_job.py --instructions '<json>' --json-output
  4. Parse JSON output for published_urls
  5. Return to user:
     "Here are your 10 live listings:
      - https://choice-properties-site.pages.dev/rent/tx/dallas/2br-single-family-abc123/
      - https://choice-properties-site.pages.dev/rent/tx/dallas/2br-single-family-def456/
      ..."
```

---

*Last updated: 2026-08-12*
*For the complete technical reference, see `scraper/PIPELINE_USAGE.md`*
