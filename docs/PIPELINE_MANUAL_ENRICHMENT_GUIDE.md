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

## 2. The Deep Walkthrough Description Architecture

Descriptions must be rich, structured, and informative. Before writing, review the original description (`original_description`) and raw source data (`original_data`). Structure the description using the following multi-paragraph flow:

### Paragraph 1: Property Style, Architecture & Neighborhood Setting
- Introduce the home by its architectural type (Single-Family, Townhouse, Duplex, or Apartment complex).
- State the total interior living area (square footage) and physical location/neighborhood.
- Mention curb appeal, exterior finishes (brick, stone, siding), or private entryway.

### Paragraph 2: Interior Flow, Main Living & Natural Light
- Walk through the main living area: open layout, ceiling height, large picture windows, or dedicated foyer.
- Detail the flooring throughout the main level (hardwood, luxury vinyl plank, ceramic tile, carpet).
- Describe the transition into dining spaces or common living zones.

### Paragraph 3: Kitchen & Dining (Full Appliance Inventory)
- Detail the kitchen layout (eat-in kitchen, island, breakfast bar, dining nook).
- Note cabinetry and countertop finishes.
- **Explicitly list all appliances included**: Refrigerator, gas/electric range & oven, built-in microwave, multi-cycle dishwasher, garbage disposal.
- Mention pantry storage or direct access to outdoor dining areas.

### Paragraph 4: Bedrooms & Bathrooms (With Decimal Precision)
- Describe the primary bedroom suite: space for king/queen furniture, walk-in closets, natural light.
- Detail the primary bathroom: vanity style, soaking tub or step-in shower, tile work.
- Cover secondary bedrooms and common full baths or powder rooms (e.g. half bath on main level).
- **Strict Rule**: Decimal bath count in text must match structured fields (`1.5`, `2.5`, `3.5`).

### Paragraph 5: Utility, Basement, Laundry & Climate
- Highlight storage: full private basement (finished or unfinished), attic, or utility closets.
- **Laundry specifics**: In-unit washer & dryer included vs. dedicated washer/dryer hookups.
- **Climate systems**: Central air conditioning, forced-air heat, or heat pump.

### Paragraph 6: Grounds, Outdoor Living & Parking
- Outdoor amenities: Private fenced backyard, covered front porch, composite deck, or patio.
- **Parking details**: Attached/detached 1-car or 2-car garage, private driveway, or dedicated off-street parking.

### Paragraph 7: Inclusions, Policies & Standard Choice Closing
- Clarify utilities tenant is responsible for (gas, electric, water/sewer/trash) or municipal fees.
- **Pet policy**: Always state: `Pet friendly.`
- **Application fee**: Always state: `Application Fee: $50.`
- **Mandatory Call-to-Action**: `Submit your rental application today at Choice Properties.`

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
