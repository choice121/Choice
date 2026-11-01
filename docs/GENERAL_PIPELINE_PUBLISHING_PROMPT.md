# Universal Pipeline Property Enrichment, Verification & Private Placement Publishing Prompt

Copy and paste the prompt below whenever you have staged new properties in the pipeline and want to run the full verification, enrichment, private placement publishing, and client magic link workflow.

---

### Universal Prompt Template

```text
Subject: Universal Pipeline Property Enrichment & Private Placement Publishing

Target: The most recent properties staged in the pipeline (pipeline.pipeline_properties), across ALL folders (including the default inbox or unassigned items) unless a specific folder name is mentioned below.
[Optional Folder Override: ALL / Inbox / (Insert Folder Name Here)]
[Optional Price Policy Override: Publish with original prices / Target Price Range: $1200-$1300 (adjust properties above max down to target tier; keep properties within or below range at original prices)]

CRITICAL INGESTION & DATA CONTRACT:
1. Query pipeline.pipeline_properties for the most recently staged, not-yet-published properties (prioritizing by newest import timestamp / batch).
2. Storage Fallback: If 0 listings are found in the pipeline table, inspect the Supabase Storage bucket 'pipeline-raw-payloads' specifically for raw_zillow_*.json payloads imported today (never use stale local backup files).
3. Deduplicate any duplicate import attempts by source_listing_id or address.
4. Price Policy: Respect original prices unless a target price range is explicitly specified above.

Your task is to perform a deep, manual verification and publishing workflow for every unique property in the target batch. Simulate a high-end real estate agent's due diligence.

Step 1: Deep Manual Verification & Zero-Empty Field Standard
- Inspect each property's source_url, original_data, and full narrative description.
- Never publish with empty appliances or amenities arrays:
  • If the browser extension or initial scrape omitted details (e.g., appliances: []), you MUST read the listing text and populate ALL appliances present (refrigerator, stove/range, oven, dishwasher, microwave, disposal, washer/dryer hookups or units).
  • Populate verified amenities (fenced yard, deck/patio, hardwood/LVP flooring, central AC/heating, fireplace, ceiling fans, storage shed).
  • Populate year_built, lot_size_sqft, and laundry_type (strictly 'In Unit' or 'Hookups', never null).
  • garage_spaces: Exact integer (1, 2) and parking description (e.g., "Attached 2-Car Garage & Driveway").
  • Bathroom Decimal Precision: Exact decimals (1.5, 2.5). Cross-check narrative text for powder rooms or half-baths; never round down.
  • Architectural Classification: Attached multi-story is TOWNHOUSE; attached half-duplex / side-by-side is DUPLEX; standalone detached home is SINGLE_FAMILY.

Step 2: Database Schema Contract Compliance
- In public.properties:
  • id: Generate a valid UUID for each property.
  • title: Follow the standardized format "{Street Address}, {City}, {State} {Zip}".
  • appliances & amenities: Must be passed as native JSON arrays of strings (PostgreSQL text[]), NOT stringified JSON.
  • security_deposit: Exactly 1x monthly rent in the database (never in description).
  • status: Set strictly to 'private_placement' so listings are shielded from the public marketplace.
  • pets_allowed: true, pet_types_allowed: ["dog", "cat"], application_fee: 50.

Step 3: Surgical Description Enrichment
- Rewrite each description into an independently structured, high-end architectural walkthrough.
- Include: Setting/Architecture, Interior Flow & Flooring, Kitchen/Dining (itemized appliance list), Bedrooms/Baths (fixtures/tile detail), Utilities/HVAC/Laundry, and Grounds/Parking.
- Strict Cleanup: Completely remove all broker/agent contacts, phone numbers, MLS IDs, and portal links.
- Formatting Standards:
  • Application Fee: Strictly state "Application Fee: $50" (never $0 or free).
  • Pets: Strictly state "Pet-Friendly" (always).
  • PROHIBITED: CRITICAL — Remove ALL mentions of security deposits, lease terms (length/duration), smoking policies, and available/move-in dates from description text.

Step 4: Image Synchronization
- Populate public.property_photos with direct high-resolution source CDN URLs (e.g., photos.zillowstatic.com). Do NOT use ImageKit.
- Strict Original Order: Keep original source order intact. Set is_hero: true and display_order: 1 for the first photo.

Step 5: Client Multi-Property Magic Link Generation
- Generate a 32-byte random URL-safe base64 token.
- Insert into public.property_shares (store SHA-256 hex hash in token_hash, expires_at = now() + 90 days).
- Link all published property IDs in public.property_share_properties.

Step 6: Atomic Pipeline Cleanup (Fail-Safe Guard)
- CRITICAL: Only clear pipeline.pipeline_properties AFTER all properties in the batch have been successfully inserted into public.properties, verified with status 'private_placement', and had their photos attached. If any property fails to publish, abort the cleanup and fix the record.

Final Response Format:
Provide ONE SINGLE master magic link for client sharing:
https://choice-properties-site.pages.dev/listings.html#share={token}

Follow with a concise bulleted summary of verified specs, itemized appliances, and enriched amenities for each published property.
```
