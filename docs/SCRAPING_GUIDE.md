# Choice Properties Scraping Guide

Use this guide when asking an AI assistant or operator to run a property intake
job. The mandatory entry point for bulk scraping is `scraper/pipeline.py`.

## Before running

1. Read `docs/PIPELINE_OVERVIEW.md`.
2. Read `scraper/PLATFORM_RULES.md`.
3. Confirm the target market, bedroom/bathroom range, rent range, and target count.
4. Confirm scraper credentials are available without printing them.
5. Run a dry-run first.

Required scraper variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
IMAGEKIT_PRIVATE_KEY
IMAGEKIT_URL_ENDPOINT
```

Optional AI enrichment variables depend on the selected workflow. Keep all of
them in the secure scraper environment or GitHub Actions secrets.

## Standard operator prompt

> Run the existing Choice Properties batch script for `<market>` using the
> mandatory `PipelineOrchestrator`. First run `--dry-run` and report the number
> scraped, filtered, rejected, and eligible. Confirm every eligible property
> has at least six genuine property photographs and no promotional banners,
> realtor flyers, contact cards, competitor watermarks, portal UI, external
> listing URLs, MLS IDs, or broker contact information. Verify address, rent,
> beds, baths, and square footage against the source internally. Keep the
> platform defaults: $50 application fee, pet-friendly, and security deposit
> equal to one month’s rent. Do not alter the private `pipeline` schema. Only
> run the live publish command after the dry-run results are reviewed.

## Commands

```powershell
python scraper\charleston_sc_batch.py --dry-run
python scraper\charleston_sc_batch.py --target 10
```

Use the matching existing batch script for another market. For new markets,
follow `scraper/PIPELINE_USAGE.md` and define only the search criteria and
pricing function.

## Image and publishing rules

- Keep only genuine property photographs.
- Harmful text includes promotional offers, competitor/MLS watermarks, agent
  contact information, URLs, and portal controls.
- Harmless in-world text such as house numbers, street signs, appliance brands,
  camera timestamps, and unbranded floor plans may remain.
- A property must retain at least six clean photos.
- If filtering leaves fewer than six, reject or unpublish the property and
  hard-delete all associated remote images to prevent orphaned storage.
- Do not bypass enrichment or validation.

## After publishing

Run the listing audit in report-only mode, inspect rejected photos and records,
and provide each published property link for verification. Never publish source
portal links, broker details, or private credentials in the final report.
