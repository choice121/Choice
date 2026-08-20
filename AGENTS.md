# Choice Properties — AI Agent Rules & Directives

## 1. UI Guidelines
- **Smoking Policy**: The "smoking" tab / smoking policies are removed from property details pages. Do not show smoking restrictions or information on property pages.

## 2. Pipeline Pre-Publishing Rules & Enrichment
- **Gallery Images Review**: Before publishing any property, review all gallery images to verify that promotional banners, realtor flyers, contact cards, and discount graphic cards are removed — keeping ONLY genuine property photographs.
- **Source Details & Amenities Verification**: Verify all property details (address, rent, beds, baths, sqft) and amenities match the original listing from the source, but do not leave anything connected to the original listing (no external URLs, portal IDs, MLS cross-links, or broker contact information). Verification is strictly an internal accuracy requirement.
- **Minimum Photos**: Must have at least 6 genuine property photographs.
- **Application Fee**: Always $50.
- **Pet Friendly**: Always pet-friendly.
- **Security Deposit**: Always 1x monthly rent.

## 3. Post-Publishing Mandatory AI Response Format
After publishing properties, the AI assistant MUST send the user the published properties link(s) in this exact format in the chat for them to verify:

1. 5804 N Meadows Blvd, Columbus, OH 43229 ($1,199/mo | 2 Bed / 1 Bath) — https://choice-properties-site.pages.dev/property.html?id=c054a5e9-fe6a-4c2d-a1dd-08c15744bc07

2. 2609 Avalon Pl, Columbus, OH 43219 ($1,175/mo | 2 Bed / 1 Bath) — https://choice-properties-site.pages.dev/property.html?id=ba875845-a65c-4620-bd1c-105d4b8a0a1e

**Template:**
`{n}. {Address}, {City}, {State} {Zip} (${Rent}/mo | {Beds} Bed / {Baths} Bath) — https://choice-properties-site.pages.dev/property.html?id={property_id}`

Numbered sequentially according to the number of properties published in that activity.
