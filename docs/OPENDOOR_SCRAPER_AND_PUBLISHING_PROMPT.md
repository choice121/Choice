# Choice Properties — Universal Opendoor Scraper & Private Placement Publishing Prompt

> **Instructions for User**: Copy and paste the prompt below into any AI assistant (Google AI Studio, Cursor, Claude, Windsurf, ChatGPT, etc.) working in this Choice Properties repository. Fill in the quick runtime parameters at the top, and the AI will scrape Opendoor, relocate, enrich, and publish strictly as a **Private Placement with a Single Client Master Magic Link**!

***

```markdown
# TASK: Autonomous Opendoor Scraping, Relocation, Full Enrichment & Private Placement Publishing

### RUNTIME PARAMETERS (FILL IN BEFORE SENDING):
1. **Source City / URLs**: [e.g. Dallas, TX (or paste Opendoor listing URLs)]
2. **Number of Properties**: [e.g. 5]
3. **Target Destination**: [e.g. Yukon, OK (or Columbus, OH / Tampa, FL / Same-Block Aliasing)]
4. **Targeted Publishing Price**: [e.g. $1,200 - $1,300/mo (or "Keep Original Formula")]
5. **Specific ZIP Override**: [Optional: leave blank to auto-distribute across multiple valid ZIP codes, or specify e.g. "73099 only"]

---

### CRITICAL PUBLISHING DIRECTIVE — PRIVATE PLACEMENT SHIELD MANDATORY:
All properties scraped and processed through this prompt MUST be published with `status: 'private_placement'` in `public.properties`. They must NEVER be published to the public search grid. You must generate ONE SINGLE Master Client Magic Link for the client to view all listings together.

---

### INSTRUCTIONS FOR THE AI AGENT:
Execute this end-to-end publishing pipeline autonomously using the project files, scripts, and Supabase credentials. Do not stop halfway; complete all steps and output the final verified links.

---

### STEP 1: OPENDOOR FOR-SALE SCRAPING & INGESTION
1. Fetch active single-family listings for the source city from Opendoor (query https://www.opendoor.com/sitemaps/listings.xml or use provided listing URLs).
2. For each listing, extract raw JSON from `<script id="__NEXT_DATA__">` in the page HTML:
   - Address fields: `street`, `city`, `state`, `zip`.
   - Core specs: `bedrooms`, `bathrooms`, `sqFtTotalLiving`, `yearBuilt`, `listPrice`.
   - Photos: Ingest all high-resolution source CDN photo URLs from `photosXl`, `photosLg`, or `photos` array.
3. Pricing & Target Bracket Adjustment:
   - If a target price bracket is specified (e.g. $1,200 - $1,300/mo):
     • Align published monthly rent to the target bracket.
     • Maintain relative property hierarchy: the largest/highest-value homes get the top of the bracket (e.g. $1,300), and smaller homes step down (e.g. $1,250, $1,200).
     • If an original rent calculation is already below the target minimum, do not increase it; publish at the lower price.
   - If no bracket is specified, calculate rental price via standard formula: `round((listPrice * 0.0085) / 25) * 25`.

---

### STEP 2: ADDRESS RELOCATION & MULTI-ZIP DISTRIBUTION (STRICT RULES)
1. **Verified Municipal Street Mapping Protocol**:
   - NEVER invent fictional or synthetic street names (e.g. do NOT use fabricated names like "Traditions Dr").
   - Every relocated address MUST be an authentic, recognized municipal residential street and valid parcel range in the target destination, verified against municipal geocoders (OpenStreetMap Nominatim or US Census Geocoder).
2. **Multi-ZIP Geographic Distribution Rule (CRITICAL)**:
   - Unless a specific ZIP override was provided above, DO NOT publish all properties in the same single ZIP code.
   - Distribute the properties across the different valid residential ZIP codes covering the target municipality and its adjacent residential corridors (e.g., for Yukon: `73099`, `73127`, `73132`, `73064`).
   - Standard verified reference for Yukon & West Metro:
     • 73099: `704 Oak Ave` (35.504644, -97.753636) | `820 Elm Ave` (35.506739, -97.755214) | `412 Holly Ave` (35.503075, -97.751478) | `624 Cedar Ave` (35.508870, -97.752619) | `408 S 8th St` (35.503461, -97.754781) | `3216 Vandament Ave` (35.493472, -97.729211)
     • 73127: `7400 Melrose Ln` (35.471517, -97.641661) | `6800 NW 16th St` (35.485994, -97.631896) | `2400 N Council Rd` (35.482437, -97.654301)
     • 73132: `7800 NW 50th St` (35.522258, -97.650047) | `6200 NW 63rd St` (35.536593, -97.561532)
     • 73064: `400 S Mustang Rd` (35.388585, -97.724463)
3. **Exact Coordinates**:
   - Store exact GPS coordinates matching the target street so the interactive map and Geoapify location intelligence pin accurately on the real residential block.
4. **Metadata Preservation**:
   - Preserve original source URLs and raw identifiers in pipeline history or legal address fields for internal tracking.

---

### STEP 3: STRUCTURED DATA & ENRICHMENT STANDARDS
1. **Bathroom Decimal Precision**: Exact decimal values (e.g., 1.5, 2.0, 2.5). Never truncate or round down.
2. **Architectural Classification**: Standalone detached house = `SINGLE_FAMILY`; half-duplex = `DUPLEX`; attached multi-story unit = `TOWNHOUSE`.
3. **Structured Fields**:
   - `bedrooms`, `bathrooms`, `square_footage`, `monthly_rent`.
   - `security_deposit`: Strictly equal to 1x monthly rent in the database (NEVER in description).
   - `application_fee`: Strictly 50 in database.
   - `pets_allowed`: true (always).
   - `smoking_allowed`: false.
   - `heating_type`: "Central Forced Air Heat".
   - `cooling_type`: "Central Air Conditioning".
   - `laundry_type`: "In-Unit Washer & Dryer Hookups".
   - `parking`: "Attached Garage + Driveway".
   - `amenities` & `appliances`: Postgres text arrays (`text[]`).

---

### STEP 4: SURGICAL 7-TIER WALKTHROUGH DESCRIPTION WRITING
Each listing description must be written independently as a deep, high-end real estate walkthrough following this structure:
1. **Architecture & Setting**: Property style, square footage, neighborhood presence in target city.
2. **Main Living Flow**: Living room scale, natural light, floor plan connection, flooring materials.
3. **Kitchen & Dining Details**: Countertops, cabinetry, pantry, full itemized appliance inventory (refrigerator, range/oven, dishwasher, microwave).
4. **Bedrooms & Bathrooms**: Primary suite retreat, walk-in closets, secondary bedrooms, full & half bath fixtures/vanities.
5. **Utility, Laundry & Comfort**: Energy-efficient central HVAC, dedicated interior laundry hookups.
6. **Outdoor Living & Parking**: Fenced yard, patio/deck, private driveway, attached garage.
7. **Closing & Official Inclusions**: Tenant-responsible utilities, pet policy ("Pet-Friendly"), application fee (strictly "$50 application fee"), official closing call to action: *"Submit your rental application today at Choice Properties."*

**STRICT PROHIBITIONS (MANDATORY)**:
- NEVER mention security deposit amounts or terms in description text.
- NEVER mention lease lengths or durations (no "12-month lease", no "1 year lease").
- NEVER mention available dates or move-in status (no "available now", no "move-in ready").
- NEVER mention smoking policies.
- NEVER include broker contacts, agent phone numbers, MLS numbers, or external portal links.

---

### STEP 5: DIRECT SOURCE PHOTO INGESTION (NO IMAGEKIT)
1. Insert photos directly into `public.property_photos` using high-resolution source CDN URLs.
2. Strict Original Order: Do NOT reorder photos. Maintain the exact order from the source.
3. The first photo from the source MUST be the primary hero photo (`is_hero: true`, `display_order: 0`).

---

### STEP 6: PRIVATE PLACEMENT SHIELD & MASTER MAGIC LINK GENERATION
1. **Private Placement Shield (Off-Market Isolation)**:
   - All properties MUST be inserted into `public.properties` with `status: 'private_placement'`.
   - Because public marketplace pages (`listings.html` and `index.html`) query strictly `status = 'active'`, private placement listings are completely hidden from public search, browse, and search engine crawlers.
2. **Zero "Private Placement" or Off-Market Badges**:
   - The listings must look 100% normal and standard to the client.
   - Never display "Private Placement" or "Verified Private Placement" badges/banners anywhere on property cards or detail pages.
3. **Master Magic Share Link**:
   - Generate a secure 32-byte random URL-safe base64 token.
   - Compute its SHA-256 hex hash and insert into `public.property_shares` (`token_hash`, `expires_at` = now() + 90 days).
   - Insert rows into `public.property_share_properties` linking `share_id` with each published `property_id`.
   - Single Master Share Link: `https://choice-properties-site.pages.dev/listings.html#share={token}`

---

### STEP 7: PIPELINE HYGIENE & CLEANUP
- Once all properties are published and linked to the share token, clear `pipeline.pipeline_properties` (or staged JSON caches) so the pipeline inbox remains clean and empty for the next batch.

---

### REQUIRED AI RESPONSE FORMAT:
When complete, respond with:

**Master Client Magic Link:**
https://choice-properties-site.pages.dev/listings.html#share={token}

**Published Properties Verification List:**
1. {Address}, {City}, {State} {Zip} (${Rent}/mo | {Beds} Bed / {Baths} Bath) — https://choice-properties-site.pages.dev/property.html?id={property_id}
2. {Address}, {City}, {State} {Zip} (${Rent}/mo | {Beds} Bed / {Baths} Bath) — https://choice-properties-site.pages.dev/property.html?id={property_id}
(Numbered sequentially for every property published)

Follow with a concise breakdown showing:
- Original Source Address & Opendoor Sale Price
- Relocated Municipal Address, City, State, ZIP & Assigned Coordinates
- Published Rent, Beds, Baths, Sqft, and Photos Ingested
```
