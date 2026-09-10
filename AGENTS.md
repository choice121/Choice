# Choice Properties — AI Agent Rules & Directives

## 1. UI Guidelines
- **Smoking Policy**: The "smoking" tab / smoking policies are removed from property details pages. Do not show smoking restrictions or information on property pages.
- **No Lease Term / Lease Duration Display**: Lease terms, lease lengths, and minimum lease duration are completely removed from all property details pages, overview cards, and listing views. No properties show lease terms or minimum lease duration. Future AIs must never display lease terms on property pages.

## 2. Pipeline Pre-Publishing Rules & Enrichment
- **Gallery Images Review**: Before publishing any property, review all gallery images to verify that promotional banners, realtor flyers, contact cards, and discount graphic cards are removed — keeping ONLY genuine property photographs.
- **Source Details & Amenities Verification**: Verify all property details (address, rent, beds, baths, sqft) and amenities match the original listing from the source, but do not leave anything connected to the original listing (no external URLs, portal IDs, MLS cross-links, or broker contact information). Verification is strictly an internal accuracy requirement.
- **Minimum Photos**: Must have at least 6 genuine property photographs.
- **Application Fee**: Always $50.
- **Pet Friendly**: Always pet-friendly.
- **Security Deposit**: Always 1x monthly rent in the structured database field, but **NEVER mentioned in descriptions**. All security deposit amounts, quotes, clauses, and references must be completely stripped from listing descriptions during description enrichment (`strip_security_deposit_from_description`). Listing descriptions must remain 100% free of security deposit mentions.
- **No Lease Term in Enrichment or Properties**: Lease terms are removed from all enrichment documentation and pipelines so no properties show that. Scrapers, enrichment logic, and AI assistants must never extract, populate, or assign lease terms (`lease_terms`, `minimum_lease_months`). All properties must have lease terms omitted.

## 3. Post-Publishing Mandatory AI Response Format
After publishing properties, the AI assistant MUST send the user the published properties link(s) in this exact format in the chat for them to verify:

1. 5804 N Meadows Blvd, Columbus, OH 43229 ($1,199/mo | 2 Bed / 1 Bath) — https://choice-properties-site.pages.dev/property.html?id=c054a5e9-fe6a-4c2d-a1dd-08c15744bc07

2. 2609 Avalon Pl, Columbus, OH 43219 ($1,175/mo | 2 Bed / 1 Bath) — https://choice-properties-site.pages.dev/property.html?id=ba875845-a65c-4620-bd1c-105d4b8a0a1e

**Template:**
`{n}. {Address}, {City}, {State} {Zip} (${Rent}/mo | {Beds} Bed / {Baths} Bath) — https://choice-properties-site.pages.dev/property.html?id={property_id}`

Numbered sequentially according to the number of properties published in that activity.

## 4. AI Vision Image Filtering & Storage Purge Policy
Future AI agents modifying the ingestion pipeline MUST adhere to these multimodal vision rules for processing property gallery images:

**A. Harmless Text (KEEP the image):**
- "Virtually Staged" or "Furniture not included" liability disclaimers.
- In-world/Diegetic natural text (e.g., street signs, house numbers, appliance brands, text on TVs/posters).
- Camera timestamps (e.g., 2023-10-12 in the corner).
- Unbranded floor plans (e.g., "Master Bedroom 12x14").

**B. Harmful Text (DELETE the image):**
- Promotional flyers, discount banners ("1 Month Free", "$99 Move-In").
- Competitor/MLS watermarks (faint, transparent, solid, LLC initials).
- Agent contact info (names, headshots, emails, phone numbers, URLs).
- Portal UI artifacts (screenshots of "Contact Agent" buttons, arrows).

**C. Property Rejection & Storage Cleanup (CRITICAL):**
- After filtering harmful images, a property MUST retain at least 6 clean photos.
- If clean photos drop below 6:
  1. The property is REJECTED (if scraping) or UNPUBLISHED (if doing a live cleanup).
  2. ALL images associated with this property MUST be hard-deleted from ImageKit (or any remote photo storage) to prevent orphaned files and storage bloat.

## 5. Permanent Scraping, Enrichment & Publishing Engine

These rules are permanent and must automatically apply to every property scraping, processing, enrichment, correction, and publishing task unless a future instruction explicitly overrides a specific rule for that particular batch.

Temporary scraping requirements such as location, property type, bedroom count, quantity, source price, and final published price must remain separate from these permanent rules.

The system must complete the entire workflow automatically without requiring additional instructions after the initial scraping request.

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

### 5. Description Enrichment
Every property must receive a fully enriched, detailed, natural, property-specific description.
The description must use the verified information available for that particular property.
Preserve useful richness from the original listing.
Do not unnecessarily shorten detailed source information.
Do not convert a rich original listing into a generic short paragraph.
Richness must come from verified information, not filler.
If limited information is available, write naturally using only what is known. Do not artificially lengthen the description.

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

---

### 15. Image Processing
For every property:
* Obtain original listing images.
* Preserve original image order.
* Use the first image as the featured image.
* Upload images to ImageKit.
* Verify every required ImageKit URL.
* Publish only ImageKit-hosted images.
* Do not use synthetic/generated property images.
* Do not publish watermarked images (remove promotional flyers, contact cards, agent headshots, MLS logos).
* Do not publish duplicate images.
* Minimum Photos: Must retain at least 6 genuine property photographs. If clean photos drop below 6, the property is rejected or unpublished, and all remote storage images are purged.
* Do not publish until image requirements pass.

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
✓ No prohibited language (no lease terms, no smoking, no tour/showing language)
✓ No third-party application instructions
✓ No third-party contact information
✓ Correct Choice Properties branding
✓ $50 application fee
✓ Images uploaded to ImageKit
✓ ImageKit URLs verified
✓ No watermarks
✓ Minimum 6 genuine property photos
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
