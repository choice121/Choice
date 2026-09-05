# Choice Properties — Permanent Platform Rules

**These rules are mandatory and apply to every scraper, publisher, and enrichment
step — current or future. They must never be bypassed without an explicit
administrator decision.**

---

## 1. Image Requirements (Highest Priority)

Every property **must** have source images present before it can be published.
Photos are transferred to ImageKit by `import-pipeline-photos` immediately
after publish — the pre-publish gate is that at least one source URL exists in
`original_image_urls`.

### Two-tier image rule

| Scenario | Gate |
|---|---|
| **First publish** (no `choice_property_id` yet) | `original_image_urls` must be a non-empty JSON array. ImageKit transfer runs automatically post-publish via `import-pipeline-photos`. |
| **Re-publish** (already has `choice_property_id`) | `property_photos` table must have ≥ 1 row for this property (photos already on ImageKit). |

This rule is enforced in three places — all must remain consistent:
1. **`pipeline_publish` PostgreSQL RPC** — checks `original_image_urls` server-side, blocks with a clear error
2. **`js/admin/pipeline.js` `validateForPublish()`** — client-side gate before the RPC call
3. **`scraper/enrichment.py` `validate_for_publish()`** — scraper-side gate

### Additional image standards
- Download every original image at the highest quality available from the source.
- Upload every image to the Choice Properties ImageKit account.
- **Never** store external/hotlinked image URLs as the final `property_photos.url`.
- If ImageKit is unavailable or any upload fails:
  - Keep the property in the pipeline with status `pending_images`.
  - Log the reason for the failure.
  - Retry when ImageKit becomes available.
- Preserve the original image order; use the first image as the featured image.

---

## 2. Description Enrichment

All the following rules run automatically via `apply_enrichment_pipeline()` in
`enrichment.py`. **Do not skip or bypass this pipeline.**

### 2a. Tour & Showing Language — REMOVE
Strip any phrasing that invites a visitor to schedule a tour or contact the
owner/agent, including but not limited to:

- "Schedule a tour / showing / viewing"
- "Book a tour / showing"
- "Request a viewing"
- "Tour today / now"
- "Open house"
- "Showing available"
- "Contact for viewing / showing"
- Equivalent rewordings detected by regex

### 2b. External Application Instructions — REMOVE
Remove any instruction that directs applicants to another platform:

- TurboTenant, Zillow, Apartments.com, Realtor.com, Homes.com, RentSpree, etc.
- "Copy Property ID", "Listing ID", "Property ID #XXXX"
- "Apply on [other site]"
- External application links or portal instructions

### 2c. Property Manager / Owner References — REMOVE / REPLACE
Remove personal agent/owner/management references. Replace public-facing
phrases with **Choice Properties** where appropriate:

- Property Manager, Leasing Office, Leasing Agent
- Contact Owner / Contact Landlord
- Management Company
- Call / Text / Email [agent name]

### 2d. Third-Party Branding — REMOVE
Strip brokerage names, MLS identifiers, and other platform branding from
descriptions.

### 2e. Security Deposit Mentions — REMOVE (Mandatory)
Listing descriptions must NEVER mention, quote, or state security deposit
amounts, clauses, terms, or conditions. All references (e.g. "Security deposit:
$1,500", "Deposit is equal to 1 month rent", "Refundable security deposit
required", etc.) must be completely stripped from listing descriptions by
`strip_security_deposit_from_description()` during enrichment. While the
database stores a structured `security_deposit` field (defaulting to 1× monthly
rent), listing descriptions must remain 100% free of deposit statements.

### 2f. Lease Terms & Duration — OMIT (Mandatory)
No property should show lease terms or minimum lease duration. Scrapers,
enrichment pipelines, and AI assistants must never extract, populate, or
display lease terms (`lease_terms`, `minimum_lease_months`). All listings must
omit lease term durations so no properties display them on the platform.

---

## 3. Application Fee Normalization (Mandatory)

**Choice Properties charges a flat $50 application fee. No listing may ever
state or imply a different amount.**

### 3a. Explicit fee amounts — normalize to $50
Any mention of an application fee amount other than $50 in the description must
be replaced with "Application Fee: $50."

Examples that must be caught and corrected:

| Original wording | Corrected output |
|---|---|
| `$35 application fee` | `Application Fee: $50.` |
| `Application fee is 45` | `Application Fee: $50.` |
| `Fee: $60` | `Application Fee: $50.` |
| `40 dollars application fee` | `Application Fee: $50.` |

### 3b. Free-application language — replace with $50 statement
Any wording indicating the application is free or costs $0 must be replaced with
"Application Fee: $50." This includes but is not limited to:

| Phrase (and similar wordings) | Corrected output |
|---|---|
| `Free application` | `Application Fee: $50.` |
| `Apply for free` | `Application Fee: $50.` |
| `No application fee` | `Application Fee: $50.` |
| `Zero application fee` | `Application Fee: $50.` |
| `$0 application fee` | `Application Fee: $50.` |
| `Complimentary application` | `Application Fee: $50.` |
| `Free to apply` | `Application Fee: $50.` |
| `No fee to apply` | `Application Fee: $50.` |

---

## 4. Rent Consistency & Description Sanitization

### 4a. Rent Consistency
Every mention of rent in the description must match the property's
published `monthly_rent` field. Conflicting amounts are replaced by
`enforce_price_consistency()` in the enrichment pipeline.

### 4b. Security Deposit Removal
Listing descriptions must never state or quote security deposit amounts.
Security deposits are managed strictly through structured database records
and must remain omitted from all description prose.

### 4c. Lease Terms Prohibited & Omitted
No properties show lease terms or minimum lease duration. Scrapers,
enrichment pipelines, and AI assistants must never extract, populate, or
display lease terms (`lease_terms`, `minimum_lease_months`). All listings
must omit lease terms.

---

## 5. Pre-Publish Validation Gate

Before any property transitions from the pipeline to a live listing, it must
pass `validate_for_publish()` in `enrichment.py`. The check verifies:

- [ ] Images successfully uploaded to ImageKit
- [ ] No "free application" language in description
- [ ] No application fee other than $50 referenced in description
- [ ] No tour/showing/contact CTA language
- [ ] No external portal application instructions
- [ ] `monthly_rent` is set

A property that fails any check **must not be published**. Log all failures.

---

## 6. Structured Field Enforcement

The `application_fee` database field must always be `50`. This is enforced by
`rule_based_enrich()` in the enrichment pipeline (step 5, application fee floor).

---

## 7. Inheriting These Rules

Every new scraper or import script added to the project must call
`apply_enrichment_pipeline()` from `scraper/enrichment.py` before inserting
records into the pipeline. This single call enforces all rules above
automatically.

```python
from enrichment import apply_enrichment_pipeline, validate_for_publish

records, watermarked_count = apply_enrichment_pipeline(records, verbose=True)

# Optional: gate individual records before publish
ok, failures = validate_for_publish(record)
if not ok:
    print("Publish blocked:", failures)
```

---

*Last updated: 2026-07-14*
*These rules are enforced in: `scraper/enrichment.py` → `apply_enrichment_pipeline()`*

### AI Vision Image Filtering (Watermarks & Promos)
Future scrapers and cleanup scripts must use Multimodal AI (Gemini Vision) to audit images before they reach the public site:
1. **Harmless (Keep):** "Virtually Staged" text, street signs, house numbers, appliance brands, timestamps, unbranded floor plans.
2. **Harmful (Delete Photo):** Promotional flyers ("1 Month Free"), competitor/MLS watermarks (faint or solid), agent info (headshots, emails, phone numbers, URLs), portal UI screenshots.
3. **Property Minimums:** If after deletion a property has < 6 clean photos, the property is REJECTED/UNPUBLISHED.
4. **Storage Purge:** If a property is rejected due to image filtering, ALL associated images must be hard-deleted from ImageKit to prevent storage bloat.
