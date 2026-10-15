# Choice Properties — AI Agent Rules & Directives

> ### ⚠️ TEMPORARY DIRECTIVE — ADDRESS CHANGING & IMAGE REORDERING DISABLED
> **STATUS: TEMPORARILY DISABLED ACROSS ENTIRE PROJECT & PIPELINE UNTIL FURTHER DECISION**
> 
> 1. **Address Changing / Aliasing Disabled**:
>    - Address changing, same-block aliasing (+8 offset), synthetic relocation, and address alteration are **TEMPORARILY DISABLED** across the entire pipeline, scraper scripts, admin tools, and publishing workflows.
>    - **Do NOT remove the code**: The underlying functions (`aliasAddress`, `relocateProperty`, relocation modals, etc.) must remain in the project so the capability exists, but they must NOT be used or executed for now.
>    - **Authentic Original Addresses Mandatory**: All properties ingested, processed in the pipeline, or published to the live database must retain and display their authentic, original source address (`address`, `city`, `state`, `zip`, and `title`).
>    - Let the pipeline and everyone/anyone dealing with the project know that address changing exists in the codebase but is temporarily disabled and must NOT be used until explicitly decided by the owner.
> 
> 2. **Image Reordering Disabled — Strict Original Order**:
>    - Automated image reordering (such as shifting exterior photos deeper or promoting interior/kitchen photos to hero) is **COMPLETELY DISABLED**.
>    - **All images must be ordered exactly as they came from the original source.**
>    - The first image from the original listing/feed must remain the primary hero cover photo (`display_order: 0` / `is_hero: true`).

## 1. UI Guidelines
- **Smoking Policy**: The "smoking" tab / smoking policies are removed from property details pages. Do not show smoking restrictions or information on property pages.
- **No Lease Term / Lease Duration Display**: Lease terms, lease lengths, and minimum lease duration are completely removed from all property details pages, overview cards, and listing views. No properties show lease terms or minimum lease duration. Future AIs must never display lease terms on property pages.
- **No Available Date / Move-In Display or Tables**: Available dates, availability tables/rows ("Available From"), move-in dates, and move-in status are completely removed from all property details pages, overview cards, sidebar tables, and listing views. No properties show available dates or move-in timelines. Future AIs must never display available dates or move-in tables on property pages.

## 2. Pipeline Pre-Publishing Rules & Enrichment
- **Source Details & Amenities Verification**: Verify all property details (address, rent, beds, baths, sqft) and amenities match the original listing from the source, but do not leave anything connected to the original listing (no external URLs, portal IDs, MLS cross-links, or broker contact information). Verification is strictly an internal accuracy requirement.
- **No Photo Count Gate**: The 6 photos gate is removed. Properties with any photo count (including below 6 images) are published, as properties are already pre-screened on import.
- **Visual Screening Removed**: Automated visual screening and vision audit gating are removed from the pipeline; user previews and screens listings prior to importing into the pipeline.
- **Application Fee**: Always exactly $50. The structured database field must always be `application_fee: 50`. In listing descriptions, the application fee must strictly state "$50 application fee" or "Application Fee: $50." Descriptions must NEVER state, imply, or include "0 application fee", "$0 fee", "free application", "fee is waived", or any non-$50 fee amount. All non-$50 or zero fee mentions must be normalized to $50 during enrichment (`normalize_application_fee_in_description`).
- **Pet Friendly**: Always pet-friendly.
- **Security Deposit**: Always 1x monthly rent in the structured database field, but **NEVER mentioned in descriptions**. All security deposit amounts, quotes, clauses, and references must be completely stripped from listing descriptions during description enrichment (`strip_security_deposit_from_description`). Listing descriptions must remain 100% free of security deposit mentions.
- **No Lease Term in Enrichment or Properties**: Lease terms are removed from all enrichment documentation and pipelines so no properties show that. Scrapers, enrichment logic, and AI assistants must never extract, populate, or assign lease terms (`lease_terms`, `minimum_lease_months`). All properties must have lease terms omitted.
- **No Available Date or Move-In in Enrichment or Descriptions**: All available dates, availability clauses ("available now", "available on [date]", "available immediately", "available for rent"), and move-in status ("move-in ready", "ready for move-in", "move-in date") must be completely stripped from listing descriptions during description enrichment (`strip_availability_from_description`). Listing descriptions must remain 100% free of availability dates and move-in mentions. Scrapers and enrichment logic must omit available dates from pipeline ingestion and public listings (`available_date = None`).

## 3. Post-Publishing Mandatory AI Response Format
After publishing properties, the AI assistant MUST send the user the published properties link(s) in this exact format in the chat for them to verify:

1. 5804 N Meadows Blvd, Columbus, OH 43229 ($1,199/mo | 2 Bed / 1 Bath) — https://choice-properties-site.pages.dev/property.html?id=c054a5e9-fe6a-4c2d-a1dd-08c15744bc07

2. 2609 Avalon Pl, Columbus, OH 43219 ($1,175/mo | 2 Bed / 1 Bath) — https://choice-properties-site.pages.dev/property.html?id=ba875845-a65c-4620-bd1c-105d4b8a0a1e

**Template:**
`{n}. {Address}, {City}, {State} {Zip} (${Rent}/mo | {Beds} Bed / {Baths} Bath) — https://choice-properties-site.pages.dev/property.html?id={property_id}`

Numbered sequentially according to the number of properties published in that activity.

### 3B. Client Multi-Property Magic Link Workflow (Private Placement & Single Link)
When the user asks to create a **Client Multi-Property Magic Link** or publish/share listings so they **"do not appear on the public page"**:
1. **Private Placement Shield:** The properties must be stored with `status: 'private_placement'` in `public.properties` (or published via `pipeline_publish(p_id, NULL, 'private_placement')`). Because the public marketplace (`listings.html` and `index.html`) queries strictly `status = 'active'`, private placement listings are completely hidden from public search, browse, and indexing.
2. **Generate Token & Link Share:**
   - Create a 32-byte URL-safe base64 token and store its SHA-256 hash in `public.property_shares` (`token_hash`, `expires_at` set to 90 days).
   - Insert rows into `public.property_share_properties` linking `share_id` with each `property_id`.
3. **Single Master Magic Link Response:**
   - Output **ONE SINGLE LINK** that allows the client to view all of those houses together on one page:
     `https://choice-properties-site.pages.dev/listings.html#share={token}`
   - Do NOT output a long list of separate individual links unless explicitly asked. The user requires the single master link to send directly to their client.
4. **No "Private Placement" or "Verified Private Placement" Badges/Banners:**
   - Listings must look 100% normal and standard to clients.
   - Do NOT display "Verified Private Placement" or "Private Placement" banners, badges, or labels anywhere on property cards or property details pages. There must be zero signs of private or off-market labeling shown to the client.

## 4. User Pre-Screening & Photo Ingestion Policy
- Visual screening and vision gating are removed from the pipeline because listings are pre-screened before importing.
- The 6-photo minimum gate is removed from the project code, pipeline, and publishing workflows. If a property is below 6 images, still publish it.

## 5. Permanent Scraping, Enrichment & Publishing Engine

These rules are permanent and must automatically apply to every property scraping, processing, enrichment, correction, and publishing task unless a future instruction explicitly overrides a specific rule for that particular batch.

Temporary scraping requirements such as location, property type, bedroom count, quantity, source price, and final published price must remain separate from these permanent rules.

The system must complete the entire workflow automatically without requiring additional instructions after the initial scraping request.

## 6. Property Details Precision & Classification Standards

### A. Bathroom Extraction & Decimal Precision (No Truncation)
- **Zero Truncation**: Fractional bathroom counts (`1.5`, `2.5`, `3.5`) must never be rounded down or truncated to integer values.
- **Narrative Cross-Check**: Scrapers and enrichment engines must deep-parse both structured fields and the original narrative text. If the original source text mentions a half-bath, powder room, or "1.5 baths" (e.g. 1 full bath + 1 powder room), the database must strictly store `bathrooms: 1.5` and `half_bathrooms: 1`.
- **Consistency**: The bathroom count in the title, structured database, badge displays, and enriched description must 100% align with verified reality.

### B. Architectural Property Classification
- **Physical Reality Over Portal Defaults**: MLS and aggregate feeds frequently bucket half-duplexes and townhomes under generic `SINGLE_FAMILY` tags. AI agents and scrapers must verify the physical architectural structure:
  - **DUPLEX**: Any half-duplex, duplex unit, 1/2 duplex, or side-by-side attached two-unit property must be classified as `DUPLEX`.
  - **TOWNHOUSE**: Any attached multi-story townhome or rowhouse must be classified as `TOWNHOUSE`.
  - **SINGLE_FAMILY**: Only standalone, detached single-family houses with independent parcel footprints are classified as `SINGLE_FAMILY`.
  - **APARTMENT**: Multi-family apartment complex units are classified as `APARTMENT`.

### C. Standardized Short & Professional Property Titles
- **Clean Standard Format**: Property titles in `properties.title` and `pipeline_properties.title` must strictly follow the short, professional, and straightforward address standard:
  `{Street Address}, {City}, {State} {Zip}` (e.g., `5914 Wilkes Dr, Fort Worth, TX 76119` or `2023 W 93rd St #1, Cleveland, OH 44102`).
- **No Clutter or Redundant Specs in Titles**: Do not clutter titles with marketing fluff or redundant spec prefixes (e.g. avoid *"Stunning 3 Bedroom 2 Bathroom Single Family Home..."*). The specs (beds, baths, rent, sqft) are prominently rendered in dedicated specification badges immediately beneath the title.

---

### 1. Complete Automated Workflow
Every property must go through this complete workflow:
**Scrape → Verify → Deduplicate → Enrich → Clean → Process Images → Synchronize Data → Generate Description → Validate → Auto-Correct → Re-Validate → Publish**

Do not treat description writing, enrichment, image processing, validation, or cleanup as optional follow-up tasks.
The property is not considered complete until every applicable stage has passed.

---

### 2. Source of Truth
Use verified property information as the source of truth.
When information conflicts, do not allow the generated description to determine the property’s factual information.

Use this hierarchy:
1. Verified original listing/source information
2. Verified extracted property information
3. Approved Choice Properties processing rules
4. Generated description

Never change verified structured property facts merely to make a description sound better.
Never invent missing information.

---

### 3. Existing Property Check
Before creating a new property:
* Check the Choice Properties website/database for an existing listing at the same address.
* Check relevant property identifiers when available.
* Do not create duplicate listings.

If the property already exists:
* Update/enrich the existing property when appropriate.
* Preserve the existing property ID whenever possible.
* Preserve the existing listing URL whenever possible.
* Do not create a second record unnecessarily.

---

### 4. Complete Property Enrichment
For every qualifying property, collect and preserve as much verified information as available.
This may include:
* Address, City, State, ZIP code
* Property type, Bedrooms, Bathrooms, Square footage, Lot size
* Rent, Security deposit (1x rent in database, never in description), Listing date, Availability
* Kitchen details, Appliances, Flooring, Living spaces, Dining areas
* Bedrooms, Primary bedroom, Bathrooms, Closets, Storage
* Laundry, Washer/dryer, Garage, Parking, Basement
* Yard, Fencing, Patio, Deck, Balcony, Fireplace, HVAC, Windows, Lighting, Renovations, Fixtures
* Pet information (always pet-friendly)
* Smoking information (never display smoking policies on property pages)
* Community amenities, Building amenities, Nearby verified amenities
* Schools, Parks, Shopping, Restaurants, Transportation, Major roads, Employment areas, Medical facilities, Walkability information
* Any other verified property information

Do not create information simply because a field exists. If information is unavailable, leave it unavailable.

---

### 5. Description Enrichment & Context Preservation (Deep, Non-Basic Standard)
- **Original Description Preservation (`original_description`)**: Every property scraped or imported into the pipeline MUST permanently store the raw, unmodified listing text in `original_description`. This field serves as the immutable ground-truth anchor of the property's authentic details.
- **Manual AI Verification & Mapping (Simulating Human Due Diligence)**:
  - Enrichment and verification is strictly an active, manual, deep inspection process carried out by the AI agent handling the pipeline—NEVER an automated, uninspected black-box script.
  - The AI manually inspects the pipeline record alongside the original Zillow/source listing URL (`source_url`) and raw extracted facts (`original_data`).
  - If the browser extension omitted any property details, features, or appliances, the AI manually compares both listings, extracts every missing feature (appliances, heating/cooling, laundry type, parking, yard, square footage), and populates them into the pipeline record before publishing.
- **Deep, Non-Basic Walkthrough Architecture**:
  - Descriptions must NEVER be basic, brief 2-sentence summaries, nor robotic AI fluff. They must read like comprehensive, high-end real estate walkthroughs that thoroughly articulate everything included:
    1. **Architecture & Property Setting**: Property style, square footage, neighborhood context, exterior presence.
    2. **Main Living & Interior Flow**: Living room scale, floor plan connectivity, natural lighting, flooring materials.
    3. **Kitchen & Dining Details**: Cabinets, countertops, pantry, and a full itemized appliance inventory (refrigerator, range/oven, dishwasher, microwave, disposal).
    4. **Bedrooms & Bathrooms**: Primary bedroom dimensions/suite features, closet space, secondary bedrooms, full & half bath fixtures, vanities, tile work (with exact decimal bath counts matching structured data).
    5. **Utility, Basement, Laundry & Comfort**: Finished/unfinished basement storage, laundry connections or in-unit washer/dryer, central heating and air conditioning systems.
    6. **Outdoor Living, Grounds & Parking**: Yard space, private fencing, patio/deck, driveway, garage capacity (attached/detached).
    7. **Lease Terms, Inclusions & Choice Closing**: Utilities tenant is responsible for, pet policy (always pet-friendly), application fee (strictly $50), and the official invitation: *"Submit your rental application today at Choice Properties."*
- **Surgical Cleaning vs Wholesale Replacement**: Enrichment operates via surgical enhancement:
  - Clean out prohibited text: broker/agent contacts, phone numbers, MLS IDs, portal URLs, external showing/application links, security deposit quotes, smoking policies, lease duration clauses, and availability/move-in dates.
  - Elevate the tone to Choice Properties standards with natural phrasing, active voice, and professional flow.
  - DO NOT replace an authentic, informative description with a generic AI summary template.
- **Dual-State Availability**: Both the current enriched `description` and the untouched `original_description` must be preserved in the pipeline so admins can compare them side-by-side or revert if necessary.

---

### 6. True Description Uniqueness
Every description must be independently written.
Do not use a master description template.
Do not merely substitute address, price, bedroom count, or bathroom count into the same structure.

Descriptions must naturally vary in:
* Opening and opening sentence construction
* Storytelling approach
* Paragraph structure and paragraph count
* Sentence length and rhythm
* Vocabulary and transitions
* Feature order
* Layout explanation
* Kitchen, bedroom, bathroom, outdoor, and location discussions
* Closing and overall voice

The property itself must determine what receives emphasis.

---

### 7. Property-Specific Storytelling
Before writing each description, identify the property’s most meaningful verified characteristics.
Examples:
* Updated kitchen
* Finished basement
* Large yard
* Garage
* Open floor plan
* Spacious primary bedroom
* Multiple bathrooms
* Renovated interior
* Strong storage
* Outdoor living area
* Convenient verified location features

Use those characteristics to determine the description’s structure.
Different properties should naturally tell different stories.
Do not force every listing into the same feature order.

---

### 8. Natural Writing
Descriptions should sound like professional human-written rental listings.
Use:
* Natural language
* Clear sentences
* Realistic descriptions
* Professional but approachable wording
* Useful information
* Property-specific detail

Avoid excessive marketing language.
Do not repeatedly use phrases such as:
* Welcome to
* Discover
* Step inside / Step into
* This beautiful / This charming / This stunning / This lovely
* Nestled in
* Experience
* Don’t miss
* Perfect / Dream home / Amazing / Gorgeous / Incredible / Exceptional
* Boasts / Perfect blend / Ideal for those seeking / You’ll love / A must-see

These phrases may be used occasionally when genuinely appropriate, but they must never become recurring templates.

---

### 9. Natural Length Variation
Do not force every description to have the same length.
Description length should depend on the amount and importance of verified information available.
Some properties may naturally require fewer paragraphs. Others may require substantially more detail.
Do not pad descriptions simply to reach an artificial word count.

---

### 10. Location Enrichment
Where verified information is available, naturally incorporate useful location context:
* Shopping, Restaurants, Parks, Schools, Transportation, Major roads, Employment areas, Medical facilities, Entertainment

Only use verified location information.
Never invent:
* Distances, Drive times, School ratings, Walkability, Neighborhood characteristics, Nearby businesses, Commute times

Do not end every description with the same location paragraph.

---

### 11. Absolute No-Fabrication Rule
Never invent or assume:
* Appliances, Renovations, Materials, Room sizes, Amenities, Parking, Garage capacity, Yard size, Basement details, Views, Utilities, Pet restrictions, Smoking rules, School information, Distances, Commute times, Neighborhood characteristics, Community features, Availability dates, Property features

If it is not verified, do not state it as fact.

---

### 12. Complete Information Consistency
Before saving each listing, compare the description against the structured property information.
Verify:
* Address, City, ZIP, Property type, Bedrooms, Bathrooms, Square footage, Lot size, Rent, Deposit, Amenities, Features, Parking, Garage, Laundry, Appliances, Pet information, Availability, Location information

Everything publicly displayed must agree.
The description must never contradict the property’s structured data.

---

### 13. Price Consistency
The final Choice Properties published rent is the authoritative public rent.
Synchronize the final rent across:
* Database, Property page, Listing cards, Search/filter results, Description, Security deposit, SEO/meta information, Structured data, Any other public-facing property information

Search the entire description for old or conflicting prices.
Recognize prices written with $, No $, Commas, Decimals, Plain numbers, Monthly wording, Deposit wording.
Remove conflicting prices.
When a pricing adjustment is part of the current batch rules, apply the final approved price everywhere.
Do not accidentally make temporary pricing rules permanent.

---

### 14. Choice Properties Content Cleanup
Before publishing:
* Remove tour language.
* Remove showing language.
* Remove viewing/scheduling language.
* Remove external application instructions.
* Remove third-party application links.
* Remove listing IDs from public-facing content.
* Remove property manager contact information.
* Remove owner/leasing-agent contact information.
* Replace appropriate management references with Choice Properties.
* Remove third-party brokerage/platform branding.
* Standardize application fee information to $50.
* Remove conflicting or outdated information.
* Security deposit: Always 1x monthly rent in structured DB, but NEVER mentioned in descriptions.
* Lease terms: Never display lease terms, durations, or minimum lease length anywhere on property pages or descriptions.
* Smoking: Never display smoking policies on property pages.
* Available / Move-in: Never display available dates, move-in status, or "Available From" tables anywhere on property pages or in descriptions.

---

### 15. Image Processing & Direct Source CDN Ingestion
For every property:
* **Stop Direct ImageKit Uploads**: Do not upload property images to ImageKit. Direct ImageKit uploads add latency, create edge function timeout risks, and consume unnecessary upload bandwidth.
* **Direct High-Resolution Source CDN URLs**: Ingest and retain high-resolution source CDN photo URLs (e.g. Zillow CDN `photos.zillowstatic.com`, Realtor CDN `ap.rdcpix.com`, etc.) directly into `original_image_urls`.
* **Pristine Quality & Global Delivery**: Source CDN images deliver uncompressed 1536px quality globally without conversion artifacts.
* **Direct Publishing into `property_photos`**: When publishing to the live database, insert the high-resolution source CDN URLs directly into `public.property_photos` with their original display order and hero designation (`is_hero: true` for the first photo).
* **Preserve Original Image Order**: Use the first image as the primary hero image.
* **No Synthetic Images**: Do not use synthetic or AI-generated property photos.
* **No Photo Count Gate**: Publish properties regardless of photo count (user pre-screens listings before import).
* **Zero Duplicates**: Ensure identical photo URLs are deduplicated.

---

### 16. Automatic Description Quality Audit
After generating all descriptions, compare the entire batch.
Check for:
* Similar openings
* Similar first sentences
* Similar paragraph structures
* Similar paragraph counts
* Similar sentence patterns
* Repeated transitions
* Repeated phrases
* Repeated adjectives
* Similar feature ordering
* Similar endings
* Similar storytelling
* Similar tone
* Similar rhythm
* Generic AI wording
* Template-like writing

Do not limit this check to exact duplicate text. The system must detect descriptions that are structurally or stylistically too similar.

---

### 17. Automatic Rewrite Loop
If any description fails the uniqueness, naturalness, accuracy, or consistency audit:
Automatically rewrite the affected description. Do not wait for another instruction.

After rewriting:
1. Re-check the description against the property’s verified information.
2. Re-check pricing.
3. Re-check prohibited language.
4. Re-check uniqueness against the batch.
5. Re-check for unsupported claims.

Continue the correction/revalidation process until the description passes.

---

### 18. Customer Test
Before publishing, simulate a customer reading multiple listings consecutively.
Ask:
“Would these listings feel as though they were independently written for each property?”
If not, rewrite the affected descriptions.
The final collection should feel like a group of individually researched and independently written rental listings, not one AI generating hundreds of variations from a single template.

---

### 19. Final Property-Level Validation
Every property must pass all applicable checks before publication.
Verify:
✓ Correct property type
✓ Correct location
✓ Correct bedrooms
✓ Correct bathrooms
✓ Correct pricing
✓ Correct security deposit (1x rent in DB, stripped from description)
✓ Correct structured information
✓ Rich verified details
✓ Rich unique description
✓ Description matches structured data
✓ No fabricated information
✓ No conflicting prices
✓ No outdated information
✓ No prohibited language (no lease terms, no smoking, no available/move-in dates, no tour/showing language)
✓ No third-party application instructions
✓ No third-party contact information
✓ Correct Choice Properties branding
✓ $50 application fee
✓ High-resolution source CDN images preserved
✓ Image order preserved with primary hero image
✓ No duplicate images
✓ No duplicate property

---

### 20. Final Batch Validation
After all individual properties pass, perform one final batch-wide audit.
Check:
* Duplicate properties
* Similar descriptions
* Repeated openings
* Repeated structures
* Pricing consistency
* Property-detail consistency
* Image integrity
* Third-party content
* Missing enrichment
* Unsupported claims

If a problem is discovered, automatically correct it and re-run the appropriate validation.

---

### 21. Publishing Rule
Only publish properties that pass all applicable validation requirements.
Never publish an invalid property merely to reach the requested quantity.
Accuracy and verified quality always take priority over quantity.

---

### 22. Completion Standard
The task is not complete merely because properties were scraped.
The task is complete only when the entire workflow has successfully finished:
**Scraped → Verified → Deduplicated → Enriched → Cleaned → Images Processed → Description Generated → Data Synchronized → Audited → Automatically Corrected → Re-Audited → Published**

No additional user instruction should be required for any of these permanent processing steps.
Temporary instructions in an individual scraping request should control only that specific batch and must not overwrite or permanently modify these rules unless explicitly requested.

---

## 7. Mandatory Browser Extension Versioning, Extraction Architecture & Change Tracking

Any future AI agent working on or modifying the Choice Properties Chrome Extension (`chrome-extension/`, `.pages-orion/`, `src/extractors/`, `supabase/functions/receive-pipeline-import/`) MUST strictly adhere to these invariant rules:

### A. Strict Semantic Versioning & Sync Protocol
1. **Never Make Silent Edits**: Whenever ANY file or extractor in the extension is modified (content scripts, popup, CSS, extractors, edge functions), the version number MUST be bumped (e.g., `v12.0.0` ➔ `v13.0.0`).
2. **Execute Automated Sync & Package Script**: You MUST run `node scripts/sync-and-bump-extension.mjs` after making changes to ensure:
   - All extractor variants (`chrome-extension/shared-extractors.js`, `.pages-orion/live-shared-extractors.js`, `supabase/functions/_shared/zillow-extract.ts`) are freshly compiled from `src/extractors/shared-extractors.js`.
   - `manifest.json`, `content.js`, `popup.html`, `extension-meta.json`, and `public/extension-updates.xml` are updated with the exact matching version.
   - `public/choice-properties-extension.zip` is freshly repackaged.
   - The extractor automated test suite (`20/20 test cases`) passes.
3. **Mandatory Documentation in CHANGELOG & README**: Every version bump MUST be recorded in `chrome-extension/README.md` and `docs/EXTENSION_CHANGELOG.md` detailing:
   - Version number and timestamp.
   - Exact features, fixes, or portal adjustments implemented.
   - Updated platform compatibility list.

### B. 7-Portal Universal Ingestion Architecture
The extension extracts listings across 7 platforms directly into the Supabase pipeline staging table:
1. **Zillow**: `__NEXT_DATA__` + `gdpClientCache` + JSON-LD (full uncropped 1536px photos).
2. **Realtor.com**: `__NEXT_DATA__` (`pageProps.initialState` / RESO schema).
3. **Apartments.com**: Microdata/JSON-LD + Dynamic DOM table with base rent resolution.
4. **Redfin**: `__NEXT_DATA__` + `reactServerState` + upscaled photo CDNs.
5. **Opendoor**: Hydrated State (`pageProps.home`) + DOM photo galleries.
6. **Progress Residential**: Hydrated State (`pageProps.property`) + Fastly/Cloudinary CDNs.
7. **CJ Real Estate**: AppFolio / Propertyware Schema + high-res s3 galleries.

### C. Pipeline & Folder Ingestion Invariants
- **Dynamic Target Folder Dropdown**: The extension widget dynamically queries active pipeline folders from `receive-pipeline-import?action=list_folders`. Selected `folder_id` is passed with the payload for automatic staging assignment.
- **Rule Ingestion Enforcement**: Auto-$50 application fee, pet-friendly = true, 1x rent security deposit (never in descriptions), zero bathroom truncation (Rule 6A), architectural type classification (Rule 6B), no lease term displays, and no available/move-in date displays or description mentions.

---

## 8. Choice Properties Private Placement Architecture & Privacy Protocol

Any AI agent or developer publishing properties or updating the frontend must maintain this privacy architecture to prevent tenant bypass while preserving 100% legal delivery:

### A. Unified Single Client-Facing Aliased Address (Quarantined Source Address) — [TEMPORARILY DISABLED]
> **NOTE: ADDRESS CHANGING IS TEMPORARILY DISABLED ACROSS THE PIPELINE.**
> Address changing/aliasing functions remain in the codebase (`aliasAddress`, `relocateProperty`) but MUST NOT be used for now until decided by the owner. All properties must use and preserve their authentic, original source address.
- **Underlying Design (Inactive)**: The client-facing experience previously aliased addresses by +8 offset. This logic remains stored for future activation, but pipeline and scrapers currently pass through original addresses untouched.

### B. Interior-First Photo Re-Ordering — [TEMPORARILY DISABLED]
> **NOTE: PHOTO REORDERING IS TEMPORARILY DISABLED ACROSS THE PROJECT.**
> All property photos must be strictly ordered exactly as they came from the original source listing/feed. The first photo from the source must remain the hero image (`is_hero: true` / index 0). Automated reordering in `js/property.js`, `js/card-builder.js`, and `scripts/pipeline_standardizer.mjs` has been disabled.

### C. Client-Side Anti-Google Lens Shield
- **Transparent Touch Guard**: Gallery main image is covered by `.mosaic-touch-shield` with `-webkit-touch-callout: none !important;` so mobile users tapping and holding cannot trigger "Search with Google Lens" or "Save Image".
- **Pixel Hash Disruption**: Gallery images render with subtle micro-filters (`filter: contrast(101.5%) brightness(99.5%) saturate(101%)`) and container cropping, preventing automated screenshot reverse-image search bots from matching raw 4:3 portal thumbnails.
- **Interaction Lockdown**: Right-click context menus and image dragging are disabled across all property gallery containers.

### D. Soft Spec Rounding
- Square footage numbers are rounded to the nearest 25 or 50 sqft (e.g., `1,438` → `~1,450 sqft`) to eliminate exact mathematical fingerprint searches.

### E. Clean Client Experience — No Private Placement Badges
- Private Placement listings must NEVER display "Choice Private Placement", "Verified Private Placement", or "Private Placement" badges/banners on property cards or detail headers. The listings must appear completely standard and authentic to clients, with zero indication of off-market or private labeling.

### F. Native Multi-Property Client Sharing via Standard Search (`/listings.html#share=token`)
- **No Cheesy "Curated / Match" Pages**: Clunky personalized collection pages with "handpicked for you" banners are permanently abolished. Clients must always experience the authentic, corporate Choice Properties search marketplace.
- **Validated Share Links**: Admins create a database-backed share link from selected property IDs. Share only the generated URL:
  `https://choice-properties-site.pages.dev/listings.html#share={token}`. Raw `?p=` IDs are not authorization and must never be used to expose private-placement listings.
- **Unlisted Status Isolation (`status: 'private_placement'`)**:
  - Properties published with `status = 'private_placement'` are completely excluded from the general public search grid.
  - When `#share=...` is present, `js/listings.js` and `js/cp-api.js` resolve only the properties associated with that valid, unexpired share record. Public browse remains restricted to `status = 'active'`.
  - This enables sending the same underlying property to Client A at $1,800 and Client B at $1,425 with different aliased addresses and hero photos, with zero risk of either client (or public visitors) discovering the other.
- **Direct Link Viewing on `property.html`**: `js/property.js` permits private-placement viewing only through the valid share token for that property, while authenticated admins/owners retain their authorized access.

