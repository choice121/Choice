# Apartment & Multi-Unit Inventory Status & Architecture

## Overview & Resolution Status

This document records the architecture, data structures, and implementation status for the **Apartment / Multi-Floor / Multi-Unit Community Inventory** system across Choice Properties.

### Key Milestones Completed:
1. **Community Detection & Ingestion Architecture**:
   - `js/property.js` detects apartment communities dynamically using `isCommunityProperty()` by checking:
     - Flag `is_multi_unit: true` or `total_units > 1`
     - Price indicators (`community_starting_rent`, `price_range`)
     - Normalized tables (`property_units`, `property_floor_plans`)
     - Embedded inventory fallback (`unit_options` or `original_data.units`)
     - Property classification types (`apartment`, `multi_family`)
   - Normalization preserves `building_name`, `floor_plan_name`, `floor_number`, `unit_photos`, `photo_urls`, and `rent_basis`.
2. **Robust Fallback for Staged & Live Listings**:
   - `initCommunityInventory()` in `js/property.js` ensures listings with embedded `unit_options` in PostgreSQL render accurately on both `active` public pages and `private_placement` magic links without being suppressed by unapproved status gates.
   - Floor plans and available rentable units are distinctly rendered with tabs/selectors.
   - If specific unit pricing is provided, unit apply buttons construct verified links via `buildApplyURL()` without modifying the core `apply/` workflow.
   - If units are unpriced or undergoing staging, a clean "Inquire About Availability" action is presented.
3. **Decommissioning of Legacy Landlord Portal**:
   - In accordance with platform simplification, the landlord portal (`/landlord/`) and platform agreements have been decommissioned.
   - All public navigation bars, mobile drawers, and footers across all HTML pages have been scrubbed of landlord links and redirected to tenant search/application tracking and general informational pages.
   - Routing rules in `_redirects` and `functions/_middleware.js` enforce 404 blocks on `/landlord/*`.
4. **Universal Chrome Extension Bump**:
   - Extension version bumped to `v54.0.0` with full test suite passing (`57/57 Chromium`, `16/16 Orion`).

---

## Data Schema & Persistence Standards

### 1. Database Model
- Parent record: `public.properties` (stores master community info: title, address, description, community starting rent, total units).
- Child tables:
  - `public.property_buildings` (identifies towers/buildings within communities).
  - `public.property_floors` (identifies floor levels associated with buildings).
  - `public.property_floor_plans` (model layouts, bed/bath specs, sqft range).
  - `public.property_units` (rentable units with unit number, rent, deposit, bed/bath precision, and `unit_photos` JSONB).
- Fallback storage:
  - `unit_options` JSONB column on `public.properties` or `pipeline_properties`.

### 2. Invariant Rules (AGENTS.md)
- **Application Fee**: Exactly $50.
- **Deposit**: 1x rent in DB, strictly zero mention in descriptions.
- **Photo Integrity**: Original source photo order preserved; hero photo remains hero; direct CDN ingestion.
- **Bathroom Precision**: Never truncate fractional baths (`1.5`, `2.5`).
- **Private Placement**: Default visibility is `private_placement`. Anonymous visitors access private listings only via SHA-256 validated share tokens.

---

## Testing & Verification

- `tests/community-inventory.test.mjs`: Tests community detection, unit extraction, building/floor preservation, and application URL generation.
- `tests/property-photo-utils.test.mjs`: Tests photo deduplication, normalization, and placeholder fallbacks.
- `scripts/validate-extension.mjs`: Tests extension manifest, update XML, zip archives, and extractor parity.
