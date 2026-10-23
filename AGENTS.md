# Choice Properties — AI Agent Rules & Directives

> ### 🚀 DIRECTIVE 1 — ADDRESS CHANGING, RELOCATION & VERIFIED MUNICIPAL STREET PROTOCOL
> **STATUS: FULLY ENABLED ACROSS ENTIRE PROJECT & PIPELINE (OWNER AUTHORIZED)**
> 
> 1. **Universal Multi-City Verified Municipal Protocol (ANY US City / ANY State)**:
>    - Relocation is universal across all 50 states and any municipality (e.g. Dallas TX, Denver CO, Tampa FL, Phoenix AZ, Atlanta GA, Charlotte/Matthews/Monroe NC, Oklahoma City OK, etc.). Yukon was merely an initial test job.
>    - Addresses must strictly use real, postal-recognized residential streets and valid parcel ranges discovered and verified against the official **US Census Bureau TIGER-line geocoder**, paired with exact live rooftop coordinates. Synthetic, fake, or unverified street names are strictly prohibited. Original source identifiers remain preserved in pipeline metadata (`original_description`, `source_url`, `source_listing_id`).
> 2. **Flexible In-State & Out-of-State Sourcing with In-State Area Separation Protocol**:
>    - Sourcing may be out-of-state OR within the same destination state depending on the operator target.
>    - **In-State Area Separation Enforcement**: When sourcing properties within the same destination state, the system strictly enforces publishing to a distinct geographic area/corridor.
>    - The relocated address must NEVER share the same ZIP code (`target_zip !== source_zip`) or immediate local neighborhood/street block as the original source listing, ensuring complete privacy and preventing local collision.
> 3. **Multi-ZIP Geographic Distribution Rule**:
>    - When publishing or relocating to any destination municipality, you must **NOT** dump all properties into a single ZIP code.
>    - Distribute properties across the valid residential ZIP codes covering that municipality and its adjacent residential corridors, unless the user explicitly mandates a single specified ZIP code (e.g. "all in 75217").
> 4. **The Mandatory Universal CLI Runner for Future AIs**:
>    - Future AI assistants MUST NOT write custom or unverified scraping code. Always execute the unified, Census-validated runner:
>      ```bash
>      node scripts/publish-relocated.mjs --source opendoor --count 5 --target "<City, State>"
>      # Advanced filters: beds, baths, sqft, price targeting, and status
>      node scripts/publish-relocated.mjs --source opendoor --target "Matthews, NC" --beds 4 --baths-min 2 --baths-max 3 --sqft-min 2000 --sqft-max 2500 --status private_placement --count 5
>      ```
>    - The runner automatically enforces flexible sourcing with in-state area separation, Census TIGER geocoding, multi-ZIP distribution, original image sequence preservation, zero photo count gate, realistic regional market rent calculation, and Choice platform rule enforcement.

> ### 🚀 DIRECTIVE 2 — STRICT ORIGINAL IMAGE ORDER & DIRECT SOURCE CDN INGESTION
> 1. **Zero Photo Count Gate (Complete Removal of Photo Count Restrictions Across Entire Project)**:
>    - The photo count gate is **PERMANENTLY AND COMPLETELY REMOVED** across the entire project.
>    - Do NOT consider photo counts when sourcing or scraping: whether 5, 4, or any number of authentic photos are available on the source property, proceed with it and publish immediately.
>    - Never skip, reject, or abort a property due to having fewer than 6 or 8 photos. As long as authentic source photos exist, ingest and publish.
> 2. **Automated Photo Reordering Disabled**:
>    - Automated image reordering (such as shifting exterior photos deeper or promoting interior photos) is **COMPLETELY DISABLED**.
>    - All images must be ordered exactly as they came from the original source feed/listing.
>    - The first image from the source must remain the primary hero cover photo (`display_order: 1` / `is_hero: true`).
> 3. **Direct Source CDN Ingestion (No ImageKit Upload Latency)**:
>    - Ingest high-resolution source CDN photo URLs (Zillow CDN, Opendoor CDN, Realtor CDN) directly into `original_image_urls` and `property_photos`. Do not upload to ImageKit.

---

## 1. Non-Negotiable Platform Invariants & Content Cleanup
Every property across the database, pipeline, and public site must adhere to these absolute rules:

- **Application Fee**: Always exactly $50. Structured DB field must be `application_fee: 50`. In listing descriptions, state strictly "$50 application fee" or "Application Fee: $50." Descriptions must NEVER state "$0 fee", "free application", or "fee is waived".
- **No Pet Information Display**: Pet information, pet policies, and pet deposits are completely removed from property details pages, overview cards, and descriptions (`pets_allowed: null`, `pet_types_allowed: null`, `pet_deposit: null`). Never display pet policies on property pages.
- **Security Deposit**: Always exactly 1x monthly rent in the structured DB field (`security_deposit: monthly_rent`), but **STRICTLY ZERO MENTIONS IN DESCRIPTIONS**. All deposit amounts, clauses, and quotes must be stripped from listing descriptions during enrichment (`strip_security_deposit_from_description`).
- **No Lease Term / Lease Duration Display**: Lease terms, lease lengths, and minimum lease duration are completely removed from all property details pages, overview cards, and descriptions (`lease_terms: null`, `minimum_lease_months: null`). Never display lease terms anywhere.
- **No Available Date / Move-In Display or Tables**: Available dates, availability tables ("Available From"), move-in dates, and move-in status are completely removed from all property pages, overview cards, sidebar tables, and descriptions (`strip_availability_from_description`). Never display available dates or move-in timelines.
- **No Smoking Policy**: Smoking policies and smoking tabs are removed from property details pages. Never display smoking policies on property pages.
- **Third-Party Sanitization**: Strip all broker contacts, agent phone numbers, MLS cross-links, portal URLs, external showing links, and tour/showing language. Replace management references with Choice Properties.

---

## 2. Property Precision & Architectural Classification Standards

### A. Bathroom Extraction & Decimal Precision (Zero Truncation)
- Fractional bathroom counts (`1.5`, `2.5`, `3.5`) must never be rounded down or truncated to integers.
- Scrapers and enrichment engines must deep-parse both structured fields and narrative text. If the source mentions a half-bath, powder room, or 2.5 baths, the database must strictly store `bathrooms: 2.5` and `half_bathrooms: 1`.

### B. Architectural Property Classification
Physical structural reality takes precedence over MLS portal defaults:
- **DUPLEX**: Any half-duplex, duplex unit, 1/2 duplex, or attached two-unit property.
- **TOWNHOUSE**: Any attached multi-story townhome or rowhouse.
- **SINGLE_FAMILY**: Standalone, detached single-family houses with independent parcel footprints.
- **APARTMENT**: Multi-family apartment complex units.

### C. Standardized Short Property Titles
- Titles in `properties.title` and `pipeline_properties.title` must strictly follow the clean address standard:
  `{Street Address}, {City}, {State} {Zip}` (e.g., `608 Maple Ave, Yukon, OK 73099`).
- Avoid marketing fluff or redundant spec prefixes in titles (specs are rendered in dedicated badges).

---

## 3. Authentic Source Description Preservation Protocol (No Rewriting)
- **Zero Synthetic Rewriting**: Descriptions must NEVER be rewritten, lengthened, or transformed into fabricated multi-paragraph AI walkthroughs. All synthetic description generation is decommissioned.
- **Preserve Authentic Source Text**: Use the authentic human-written source description directly as provided by the property manager or MLS listing.
- **Basic Privacy Scrubbing (Strictly Minimal)**:
  - Strip external MLS broker/agent direct phone numbers and personal emails so prospective tenants contact Choice Properties.
  - Strip external third-party portal URLs (Zillow, Apartments.com, TurboTenant, etc.) and showing links.
  - Strip mentions of security deposits, lease terms/durations, and available/move-in dates per platform invariants.
- **Standard Choice Application Note**: Ensure the description concludes with the standard application fee note: *"Application Fee: $50. Submit your rental application today at Choice Properties."*

---

## 4. Post-Publishing Mandatory AI Response Formats

### Standard Public Listings Response Format:
After publishing properties to the live site, the AI assistant MUST output the published property link(s) in this exact sequential format:

1. 608 Maple Ave, Yukon, OK 73099 ($1,595/mo | 3 Bed / 2.5 Bath) — https://choice-properties-site.pages.dev/property.html?id=f0470af2-573a-4b58-89d1-a1775ced83f1
2. 7400 Melrose Ln, Oklahoma City, OK 73127 ($1,750/mo | 4 Bed / 2.5 Bath) — https://choice-properties-site.pages.dev/property.html?id=a443c7da-59c9-4d0c-919b-f5f56d502ede

**Template:**
`{n}. {Address}, {City}, {State} {Zip} (${Rent}/mo | {Beds} Bed / {Baths} Bath) — https://choice-properties-site.pages.dev/property.html?id={property_id}`

### Client Multi-Property Magic Link Workflow (Section 3B):
When the user asks to create a **Client Multi-Property Magic Link** or publish listings so they **"do not appear on the public page"**:
1. **Private Placement Shield**: Store properties with `status: 'private_placement'` in `public.properties`. Because public browse queries strictly `status = 'active'`, private placement listings are completely hidden from public search, browse, and indexing.
2. **Generate Token & Share**: Create a 32-byte URL-safe base64 token, store its SHA-256 hash in `public.property_shares` (90-day expiry), and insert rows into `public.property_share_properties`.
3. **Single Master Magic Link Response**: Output **ONE SINGLE LINK** allowing the client to view all of those houses together:
   `https://choice-properties-site.pages.dev/listings.html#share={token}`
4. **No Private Placement Badges**: Listings must look 100% standard to clients. Do NOT display "Private Placement" badges, banners, or labels anywhere on cards or detail pages.

---

## 5. Private Placement Architecture & Privacy Protocols
- **Anti-Google Lens Shield**: The gallery main image is covered by `.mosaic-touch-shield` with `-webkit-touch-callout: none !important;` to prevent mobile users from triggering "Search with Google Lens" or "Save Image". Subtle micro-filters disrupt automated image-hash match bots. Right-click context menus are disabled on galleries.
- **Soft Spec Rounding**: Square footage may be rounded to the nearest 25 or 50 sqft (e.g. `1,438` → `~1,450 sqft`) to eliminate exact mathematical fingerprint searches.
- **Unlisted Status Isolation**: Listings with `status: 'private_placement'` are only accessible via validated share tokens (`#share={token}`) or direct authorized admin sessions.

---

## 6. Mandatory Browser Extension Versioning & Sync Protocol
Any future AI agent modifying the Chrome Extension (`chrome-extension/`, `.pages-orion/`, `src/extractors/`, `supabase/functions/receive-pipeline-import/`) MUST adhere to:
1. **Never Make Silent Edits**: Whenever ANY file or extractor in the extension is modified, bump the semantic version (e.g., `v18.0.0` ➔ `v19.0.0`).
2. **Execute Automated Sync & Package Script**: You MUST run:
   ```bash
   node scripts/sync-and-bump-extension.mjs
   ```
   This compiles all extractor variants, updates `manifest.json`, `extension-meta.json`, `public/extension-updates.xml`, repackages `public/choice-properties-extension.zip`, and runs the automated extractor test suite (`20/20 test cases`).
3. **Documentation**: Record every version bump in `chrome-extension/README.md` and `docs/EXTENSION_CHANGELOG.md`.

---

## 🚀 DIRECTIVE 3 — LIVE SERVER HEARTBEAT & VERSION INDICATOR PROTOCOL
Any future AI agent making changes to backend API routes (`serve.js`, `lib/assistant-router.js`, `lib/inquiry-assistant-engine.mjs`) MUST adhere to:
1. **Never Assume Deployment State**: Always maintain and respect the live heartbeat endpoint (`GET /api/assistant/version`) and the visual version indicator banners in the admin/setup consoles (`/admin/mobile-setup.html`, `/admin/inquiry-assistant.html`).
2. **Version Bumping & Verification**: When modifying backend logic or AI prompts, update the version string in `lib/assistant-router.js` (e.g. `v2.5.0` ➔ `v2.6.0`), run `compile_applet`, run test suites (`node scripts/test-inquiry-assistant.mjs && node scripts/test-mobile-assistant.mjs`), and verify the heartbeat indicator.

---

## 7. Quality Audit & Automated Workflow
Every property follows this complete lifecycle:
**Scrape → Census Verify → Deduplicate → Basic Privacy Clean → Process Images → Synchronize Data → Validate → Publish**

- **Source of Truth**: Preserve authentic source descriptions and facts; never synthesize room sizes or rewrite listing text.
- **Final Pre-Publishing Audit**: Verify $50 application fee, 1x deposit in DB / 0 in description, no lease terms, no available dates, strict original photo order, decimal bath accuracy, and verified Census GPS coordinates.
