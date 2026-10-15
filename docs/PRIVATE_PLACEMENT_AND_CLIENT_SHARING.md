# Choice Properties — Private Placement & Client Sharing Architecture

## Executive Overview

This document details the architectural specifications, frontend shielding, database schema, and client distribution protocol for **Private Placement Listings** and **Multi-Property Tailored Sharing**.

Future AI agents, engineers, and administrators must maintain these standards across all scrapers, browser extensions, pipeline enrichments, and frontend components.

---

## 1. Core Principles

1. **No Clunky / Cheesy "Curated Selection" Pages**:
   - Clients must never see artificial "handpicked for you" or dedicated one-off landing pages.
   - Tailored homes are delivered through the standard Choice Properties listings interface using a validated bearer link at `/listings.html#share={token}`.
   - The user interface appears identical to regular organic search results with familiar filters, pagination, and map markers.

2. **Decoupled Search Footprint [TEMPORARILY DISABLED]**:
   - *Temporary Directive*: Address changing and block aliasing (+8 offset) are temporarily disabled across the project until further decision. The capability remains preserved in the codebase, but all properties must use their authentic source address.
   - Exact square footage numbers are softly rounded (e.g., `1,438` → `~1,450 sqft`) to eliminate mathematical query fingerprinting on search engines.

3. **Interior-First Visual Anchor [TEMPORARILY DISABLED]**:
   - *Temporary Directive*: Automated image reordering is disabled. All images must be ordered exactly as they came from the original source.
   - The photo reordering logic in `js/property.js`, `js/card-builder.js`, and `scripts/pipeline_standardizer.mjs` is preserved in the codebase but inactive.

4. **Client-Side Anti-Google Lens Shield**:
   - High-resolution source CDN photos are loaded with `referrerpolicy="no-referrer"` to bypass CDN hotlinking restrictions.
   - Photos are protected against mobile long-press Google Lens searches via `.mosaic-touch-shield` with `-webkit-touch-callout: none !important;` and `pointer-events: none;` on `<img>` elements.
   - Context menus (`contextmenu`) and dragging (`dragstart`) are disabled across all gallery and card image containers.
   - Subtle CSS micro-filters (`filter: contrast(101.5%) brightness(99.5%) saturate(101%)`) modify pixel hashes against automated screenshot reverse-image matchers.

---

## 2. Technical Implementation

### A. Database Status and Share Authorization
- Public marketplace queries and the `get_properties_by_ids` RPC return only `status = 'active'` rows.
- Client shares use `property_shares` and `property_share_properties`. The browser receives a 256-bit random token; only its SHA-256 hash is stored in the database.
- `property-share` requires an admin session to create a share. Resolution checks the token hash, expiry, revocation state, and membership before returning the associated public-safe listing fields.
- Share tokens expire after 90 days. Anyone who possesses the link can use it; the link is a bearer credential and is not bound to a verified client identity.
- The token is placed in the URL fragment so it is not sent in HTTP requests or referrer headers. The listings page and property detail page both resolve through the Edge Function; property details are limited to the share membership.
- `property.html` allows private-placement viewing only through a valid share, with the existing authenticated admin/owner access path retained.

### B. Badging & Authority
- Listing cards render `<div class="property-card-badge badge-private">...</div>` with the "Verified Private Placement" shield.
- Property details pages display a high-trust dark-slate pill badge:
  ```html
  <div id="privatePlacementBadge">
    <i class="fas fa-shield-alt" style="color:#38bdf8"></i> Verified Private Placement
  </div>
  ```

### C. Application Confirmation Email Template
- Application submissions for all properties strictly require the **$50.00 application fee**.
- The confirmation email template (`supabase/functions/_shared/email.ts`) presents:
  - 💰 Application Fee Due — $50.00
  - Next Steps: Immediate text coordination from assigned billing specialist for payment routing.
  - Queue priority for prompt completions.

---

## 3. Workflow for Sending Properties to Clients

1. **Select or Ingest Properties**:
   - Ingest from the 7 supported platforms via Chrome extension or Python pipeline scraper into `pipeline_properties`.
   - Run `scripts/pipeline_standardizer.mjs` to validate bathroom precision (Rule 6A), architectural type (Rule 6B), policy enforcement ($50 fee, pet-friendly, zero security deposit in text, zero lease terms), and interior-first photo reordering.

2. **Publish**:
   - Publish properties with `status: 'private_placement'` (for unlisted exclusive client delivery) or `status: 'active'` (for open marketplace).

3. **Share Link**:
   - Format: `https://choice-properties-site.pages.dev/listings.html#share={token}`
   - When the client opens this link, the site shows their tailored collection in the standard marketplace layout without any awkward "curated" framing.
