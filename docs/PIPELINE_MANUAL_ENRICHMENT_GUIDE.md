# Choice Properties — Manual Pipeline Verification, Enrichment & Publishing Guide

This document establishes the permanent, human-grade manual verification, surgical description enrichment, source CDN photo ingestion, and publishing standards for Choice Properties.

---

## 1. Core Operating Principles

1. **Human-Simulated AI Craftsmanship**:
   - Automated black-box pipeline scripts are discontinued for description writing and property enrichment.
   - Every property staged in `pipeline.pipeline_properties` must undergo a deliberate, manual-grade verification by the AI or operator before publication.
   - The AI inspects the source listing facts, compares them with the pipeline data, fills missing attributes, crafts a rich walkthrough description, and publishes the listing with complete fidelity.

2. **Zero Tolerance for "Basic" Descriptions**:
   - Descriptions must never be brief, generic 2-sentence summaries or repetitive AI filler templates (*"Welcome to your dream home..."*).
   - They must read like professional, comprehensive real estate walkthroughs that itemize everything included while remaining 100% faithful to authentic source facts.

3. **Direct Source CDN Photos (No ImageKit Upload Overhead)**:
   - Direct ImageKit uploading during import and publishing is stopped.
   - High-resolution source CDN URLs (e.g. `photos.zillowstatic.com`, `ap.rdcpix.com`) are ingested directly into `pipeline_properties.original_image_urls` and published straight into `public.property_photos`.
   - This delivers uncompressed 1536px photo quality with zero upload latency, zero conversion failures, and zero third-party storage costs.

4. **Standard Short & Professional Titles**:
   - Clean address standard: `{Street Address}, {City}, {State} {Zip}` (e.g. `5914 Wilkes Dr, Fort Worth, TX 76119` or `2023 W 93rd St #1, Cleveland, OH 44102`).
   - Specification badges (`3 Beds`, `2 Baths`, `1,450 Sq Ft`, `$1,495/mo`) handle specifications beneath the title.

---

## 2. Authentic Source Description Preservation Protocol

The legacy "Deep Walkthrough" rewriting architecture is completely decommissioned. Listing descriptions must preserve authentic human-written source text directly from the listing source (MLS, Zillow, Opendoor) without synthetic multi-paragraph rewriting:

- **Preserve Source Narrative**: Keep the property manager's or listing agent's actual narrative description intact.
- **Basic Privacy Scrubbing Only**:
  - Strip direct agent phone numbers and personal emails so all inquiries route through Choice Properties.
  - Strip external third-party portal links (Zillow, Apartments.com, etc.).
  - Strip mentions of security deposits, lease durations, and move-in/availability dates.
- **Standard Application Fee & Closing Note**:
  Ensure the listing closes with the standard application fee statement:  
  `Application Fee: $50. Submit your rental application today at Choice Properties.`

---

## 3. Strict Prohibited Language Checklist

During description rewriting, surgically remove:
1. **Agent / Broker Info**: Names, brokerage brands, agent phone numbers, email addresses, license numbers.
2. **External Links & IDs**: MLS numbers, portal URLs (Zillow, Trulia, Realtor), third-party screening links.
3. **Showing / Tour Requests**: *"Call to schedule a tour"*, *"showing instructions"*, *"book an appointment"*.
4. **Security Deposit Quotes**: Forbidden in text. (Stored as 1x monthly rent in the database only).
5. **Lease Terms & Durations**: Forbidden in text and UI (*"12-month lease required"*, *"minimum 1-year"*).
6. **Available / Move-In Dates**: Forbidden in text and UI (*"available immediately"*, *"move-in ready"*, *"ready for move-in"*).
7. **Free or Non-$50 Application Fees**: Descriptions must never state or imply $0 or free application. Fee is strictly $50.

---

## 4. Manual Source Mapping & Gap Filling

When reviewing a listing in `pipeline.pipeline_properties`:

1. **Access Source Data**:
   - `source_url`: Live Zillow or portal link.
   - `original_description`: Full unmodified original text.
   - `original_data`: JSON payload containing all RESO facts, interior features, and badges.

2. **Check for Omissions**:
   - If `appliances` is empty, extract all appliances mentioned in `original_data` or the text narrative.
   - If `parking` or `garage_spaces` is null, identify garage capacity or driveway space from facts.
   - If `laundry_type` is blank, resolve whether hookups or units exist.
   - If `cooling_type` or `heating_type` is null, check for Central A/C or Forced Air.
   - If `square_footage` is missing, verify from `original_data`.

3. **Verify Physical Architecture**:
   - Multi-unit attached side-by-side: `DUPLEX`.
   - Multi-story attached rowhouse: `TOWNHOUSE`.
   - Detached single parcel: `SINGLE_FAMILY`.
   - Multi-family building unit: `APARTMENT`.

4. **Synchronize Financials**:
   - `monthly_rent`: Verified rent number.
   - `security_deposit`: Exactly 1x monthly rent in DB.
   - `application_fee`: Exactly 50.

---

## 5. Direct Source CDN Photo Publishing

Photos are published directly into `public.property_photos`:

```sql
INSERT INTO public.property_photos (
  id,
  property_id,
  url,
  display_order,
  is_hero,
  watermark_status,
  alt_text,
  created_at
) VALUES (
  gen_random_uuid(),
  'PROPERTY_UUID',
  'https://photos.zillowstatic.com/fp/..._p_e.jpg',
  0,
  true,
  'clean',
  '5914 Wilkes Dr, Fort Worth TX 76119 - photo 1',
  NOW()
);
```

- Hero image: `display_order = 0`, `is_hero = true`.
- Zero ImageKit conversion or re-hosting needed.

---

## 6. Post-Publishing AI Response Format

After publishing, the AI assistant must present the published properties in the mandatory format:

1. {Address}, {City}, {State} {Zip} (${Rent}/mo | {Beds} Bed / {Baths} Bath) — https://choice-properties-site.pages.dev/property.html?id={property_id}

Example:
1. 5914 Wilkes Dr, Fort Worth, TX 76119 ($1,350/mo | 3 Bed / 2 Bath) — https://choice-properties-site.pages.dev/property.html?id=c054a5e9-fe6a-4c2d-a1dd-08c15744bc07

## Apify Token Pool (Auto-Rotation)

Store all Apify API tokens in a single GitHub Secret named `APIFY_API_TOKENS` as a comma-separated list:

```
APIFY_API_TOKENS=token1,token2,token3
```

The workflow (`.github/workflows/daily-scrape.yml`) injects this as the `APIFY_API_TOKENS` env var. `scraper/zillow_services.py` splits on commas and tries each token in order, automatically rotating to the next when one returns 401/402/403/429 (quota/auth failure). No code changes are needed when adding or removing tokens — just edit the secret value.

For local runs, export the same env var:

```
export APIFY_API_TOKENS="token1,token2"
```

## End-to-End Zillow Scrape & Publish (Apify)

### Overview
The pipeline uses Apify actors to scrape Zillow rental listings, stages them in `pipeline.pipeline_properties`, then publishes via the `pipeline_publish` RPC as `private_placement` (hidden from public browse) with a single client magic link.

### Apify Token Pool
- Store all tokens in one GitHub Secret: `APIFY_API_TOKENS=token1,token2,token3`
- The workflow injects it as an env var; `scraper/zillow_services.py` splits on commas and auto-rotates on 401/402/403/429.
- Adding tokens requires only editing the secret value — no code changes.

### Scraping
- Actors used: `pro100chok/zillow-scraper-all-in-one` (search) and `sleek_waveform/zillow-scraper` (apartments with unit data).
- Locations: Dallas, Austin, Houston, San Antonio, Fort Worth (configurable).
- Required-field gate: a listing is skipped unless it has address, city, state, zip, beds, baths, price, and at least one photo.
- Dedup by address+zip before staging.

### Publishing
- `pipeline_publish` RPC (hardened migration `20261023000003`): revoke anon execute, enforce required fields + photo gate, null prohibited display fields (available_date, lease_terms, pets, amenities).
- ID generation uses `md5(random())` (no pgcrypto dependency).
- Status: `private_placement` (hidden from public browse, accessible via share token).

### Client Magic Link
- Generate a 32-byte URL-safe token, store SHA-256 hash in `public.property_shares` (90-day expiry).
- Insert rows into `public.property_share_properties` linking the share to each property.
- Single link: `https://choice-properties-site.pages.dev/listings.html#share={token}`

### Description Enrichment
- `scripts/description-generator.mjs` is now source-only: no invented claims (appliances, pet-friendly, outdoor space, etc.).
- `scraper/enrichment.py` clears available_date, lease_terms, and pet fields per AGENTS.md invariants.

### Key Files
- `scraper/zillow_services.py` — Apify service with token rotation
- `supabase/migrations/20261023000003_harden_pipeline_publish.sql` — hardened publish RPC
- `scripts/description-generator.mjs` — source-only description generator
- `.github/workflows/daily-scrape.yml` — CI workflow with APIFY_API_TOKENS secret

## Zillow/Apify Source Integration (new)
- Set `criteria.source = "zillow"` in BatchCriteria to use Apify-backed Zillow scraping instead of Realtor/HomeHarvest.
- Direct Zillow scraping is blocked on datacenter IPs (DataDome); Apify is the default reliable source.
- _map_zillow_service_property maps Apify records to the pipeline schema.
- Phase 2 detail fetch and Apify fallback handle blocked pages.
