# Choice Properties — Universal Opendoor Scraping, Relocation & Publishing Master Prompt

> **Purpose**: Copy and paste this complete prompt into any AI agent (Google AI Studio, Cursor, Claude, Windsurf, ChatGPT, etc.) that is working in this codebase. It provides end-to-end instructions for scraping Opendoor sale listings, converting them to rentals, relocating them via the Verified Municipal Street Protocol, enriching descriptions, adjusting pricing, publishing to Supabase, and generating client magic links.

---

```markdown
Subject: Autonomous Opendoor Scraping, Verified Relocation & Publishing Workflow

Target Task: Scrape [INSERT COUNT, e.g. 5] for-sale single-family listings from Opendoor in [INSERT SOURCE CITY, e.g. Dallas, TX], convert them to rentals, relocate them to [INSERT TARGET DESTINATION, e.g. Yukon, OK 73099] using the Verified Municipal Street Protocol, enrich according to Choice Properties standards, adjust rent to the target bracket [INSERT TARGET PRICE BRACKET, e.g. $1,200 - $1,300/mo or "Original Formula"], publish to Supabase, and clear the pipeline.

Target Destination Override: [e.g. Yukon, OK 73099 / Same-Block Aliasing / Target City]
Target Publishing Mode: [e.g. Private Placement Shield with Magic Link / Active Public Marketplace]
Target Rent Bracket: [e.g. $1,200 - $1,300/mo / Original Multiplier]

--------------------------------------------------------------------------------
CORE DIRECTIVES & PROTOCOLS (NON-NEGOTIABLE):
--------------------------------------------------------------------------------

1. OPENDOOR EXTRACTION & FOR-SALE TO RENTAL CONVERSION:
   - Fetch active listing URLs from the Opendoor sitemap (https://www.opendoor.com/sitemaps/listings.xml) or provided URLs.
   - Extract raw JSON from <script id="__NEXT_DATA__"> in the page HTML:
     • street, city, state, zip, bedrooms, bathrooms, sqFtTotalLiving, yearBuilt, listPrice.
     • photosXl / photosLg / photos array (direct high-resolution CDN images).
   - Rent Calculation:
     • If a target price bracket is specified (e.g. $1,200 - $1,300), align rent to that target while respecting property hierarchy (largest/highest list price gets max price, e.g. $1,300, smaller homes step down, e.g. $1,250, $1,200). If original rent is already below the target minimum, preserve the lower rent.
     • Otherwise, use the state-aware multiplier: monthly_rent = round((listPrice * 0.0085) / 25) * 25.

2. VERIFIED MUNICIPAL STREET MAPPING PROTOCOL (RELOCATION):
   - CRITICAL: Never invent fictional street names (e.g. avoid arbitrary combinations like "Traditions Dr").
   - Every relocated address MUST be an authentic, recognized municipal residential street and valid parcel range in the target destination verified against municipal geocoders (OpenStreetMap Nominatim or US Census Geocoder).
   - MULTI-ZIP GEOGRAPHIC DISTRIBUTION RULE (CRITICAL):
     • When a target location is specified (e.g. Yukon, OK), DO NOT publish all properties in the same single ZIP code.
     • Distribute the properties across the different valid residential ZIP codes covering that municipality and its adjacent metro corridors (e.g. for Yukon: 73099, 73127, 73132, 73064), unless the user explicitly mandates a single specified ZIP code (e.g. "all in 73099").
   - Verified Yukon & West Metro Multi-ZIP Reference:
     • 73099: 704 Oak Ave (35.504644, -97.753636) | 820 Elm Ave (35.506739, -97.755214) | 412 Holly Ave (35.503075, -97.751478) | 624 Cedar Ave (35.508870, -97.752619) | 408 S 8th St (35.503461, -97.754781) | 3216 Vandament Ave (35.493472, -97.729211)
     • 73127: 7400 Melrose Ln (35.471517, -97.641661) | 6800 NW 16th St (35.485994, -97.631896) | 2400 N Council Rd (35.482437, -97.654301)
     • 73132: 7800 NW 50th St (35.522258, -97.650047) | 6200 NW 63rd St (35.536593, -97.561532)
     • 73064: 400 S Mustang Rd (35.388585, -97.724463)
   - For Same-Block Aliasing (+8 offset): Retain the authentic street name, city, state, zip, and shift the house number by +8.
   - Assign exact verified GPS coordinates matching the target street so interactive maps and Geoapify location intelligence pin accurately.
   - Retain original source metadata/URL in legal_address or pipeline history for internal audit.

3. STRUCTURED DATA PRECISION & CLASSIFICATION:
   - Bathroom Decimal Precision: Exact decimals (1.5, 2.0, 2.5, 3.0, 3.5). Never truncate or round down.
   - Architectural Classification: Standalone detached home is SINGLE_FAMILY; half-duplex is DUPLEX; attached rowhome is TOWNHOUSE.
   - Structured Fields in public.properties:
     • bedrooms, bathrooms, square_footage, year_built, monthly_rent.
     • security_deposit: Strictly equal to 1x monthly rent in the database (NEVER mentioned in description).
     • application_fee: Strictly 50 in database.
     • pets_allowed: true (always).
     • smoking_allowed: false.
     • laundry_type: 'In-Unit Washer & Dryer Hookups' or 'In-Unit Washer/Dryer'.
     • parking: 'Attached Garage + Driveway'.
     • amenities & appliances: Postgres text[] arrays.

4. SURGICAL DESCRIPTION ENRICHMENT (7-TIER WALKTHROUGH STANDARD):
   Write an independent, professional real estate walkthrough:
   1. Architecture & Property Setting: Property style, square footage, neighborhood setting in target city.
   2. Main Living & Interior Flow: Living room scale, natural light, flooring materials.
   3. Kitchen & Dining Details: Countertops, cabinetry, pantry, full itemized appliance list (refrigerator, range/oven, dishwasher, microwave).
   4. Bedrooms & Bathrooms: Primary suite dimensions, closet space, secondary bedrooms, vanity and fixtures.
   5. Utility, Laundry & Comfort: Central heating and air conditioning, dedicated laundry hookups.
   6. Outdoor Living, Grounds & Parking: Private yard, fencing, driveway, attached garage.
   7. Inclusions & Choice Closing: Utilities tenant is responsible for, pet policy ("Pet-Friendly"), application fee (strictly "$50 application fee"), closing invitation: "Submit your rental application today at Choice Properties."
   
   PROHIBITIONS (CRITICAL):
   • NEVER mention security deposit amounts or quotes in description text.
   • NEVER mention lease duration or lease terms (no "12-month lease", no "1 year lease").
   • NEVER mention available dates or move-in timelines (no "available now", no "ready for move-in").
   • NEVER include broker contacts, phone numbers, MLS numbers, or portal URLs.

5. DIRECT SOURCE CDN IMAGE INGESTION (NO IMAGEKIT):
   - Insert original high-resolution source CDN photo URLs (photosXl/photosLg) directly into public.property_photos.
   - Strict Original Order: Do NOT reorder photos.
   - The first photo from the source must remain the primary hero photo (is_hero: true, display_order: 0).

6. PUBLISHING & STATUS SHIELD:
   - If Target Publishing Mode is "Private Placement Shield":
     • Set status: 'private_placement' in public.properties (completely hidden from public browse/search).
     • Generate a 32-byte URL-safe base64 token.
     • Hash token with SHA-256 and insert into public.property_shares (expires_at = now() + 90 days).
     • Insert links for all published property IDs into public.property_share_properties.
     • Single Master Share Link: https://choice-properties-site.pages.dev/listings.html#share={token}
   - If Target Publishing Mode is "Active Public Marketplace":
     • Set status: 'active' in public.properties.

7. PIPELINE HYGIENE & CLEANUP:
   - When all properties are successfully published, clear pipeline_properties (or pipeline_9_properties.json) so the inbox remains clean and empty for the next batch.

--------------------------------------------------------------------------------
REQUIRED AI RESPONSE FORMAT:
--------------------------------------------------------------------------------
If publishing via Private Placement Magic Link:
Output the SINGLE Master Magic Link at the top:
https://choice-properties-site.pages.dev/listings.html#share={token}

Followed by the standardized verification list:
1. {Address}, {City}, {State} {Zip} (${Rent}/mo | {Beds} Bed / {Baths} Bath) — https://choice-properties-site.pages.dev/property.html?id={property_id}
2. {Address}, {City}, {State} {Zip} (${Rent}/mo | {Beds} Bed / {Baths} Bath) — https://choice-properties-site.pages.dev/property.html?id={property_id}

Provide a concise breakdown of the source Dallas addresses mapped to their verified Yukon municipal addresses, applied rents, and photo counts.
```
