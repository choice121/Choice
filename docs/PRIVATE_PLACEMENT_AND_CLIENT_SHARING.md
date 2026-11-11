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

4. **Photo interaction deterrents are not access control**:
   - `referrerpolicy="no-referrer"`, gallery overlays, disabled context menus, and CSS filters only affect browser behavior. They do not make a public CDN image private or prevent direct URL access.
   - Treat a listing as private only when its data and assets are served through a validated share flow. Never rely on image overlays or fingerprint changes for confidentiality.

---

## 2. Technical Implementation

### A. Database Status and Share Authorization
- Public marketplace queries and the `get_properties_by_ids` RPC return only `status = 'active'` rows.
- Client shares use `property_shares` and `property_share_properties`. The browser receives a 256-bit random token; only its SHA-256 hash is stored in the database.
- Share creation must be restricted to authenticated admins. Resolution must check the token hash, expiry, revocation state, and property membership before returning an explicit client-safe field list. Do not use `select('*')` for shared property responses.
- Share tokens expire after 90 days. Anyone who possesses the link can use it; the link is a bearer credential and is not bound to a verified client identity.
- The token is placed in the URL fragment so it is not sent in HTTP requests or referrer headers. Property-to-application navigation preserves the fragment and submits the token in the POST body, not a query parameter.
- The `receive-application` Edge Function validates expiry, revocation, and property membership for `private_placement` before accepting an application. It receives the token in the POST body; never put it in a query parameter.
- Never embed listing data in static HTML. Property status can change after a build; public pages must fetch current active rows, while private rows must come only from a validated share response.
- `property.html` allows private-placement viewing only through a valid share, with the existing authenticated admin/owner access path retained.

### B. Visibility and publishing
- `active` means publicly discoverable; `private_placement` means hidden from public browse and available only through an authorized share or admin/owner access.
- Never bulk-promote `private_placement` rows to fill public search results. Change status only for listings explicitly approved for public release.
- Do not display a private-placement badge or banner to clients. The share link is the access mechanism; UI labels do not enforce privacy.

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
   - Before release, verify that creating a share requires an admin, revoked/expired tokens fail resolution, and private applications are rejected unless the submitted token includes that property.

## 4. Release Checklist
- Confirm `generate-config.js` does not serialize property rows into `listings.html`.
- Confirm `/property.html` metadata lookup filters `status=active`.
- Confirm private apply links preserve the fragment token and the deployed application server validates it against `property_shares` and `property_share_properties`.
- Run the focused property/share and application tests before deploying the Edge Function and static site.
- Deploy the Edge Functions after merge with `supabase functions deploy property-share --project-ref tlfmwetmhthpyrytrcfo` and `supabase functions deploy receive-application --project-ref tlfmwetmhthpyrytrcfo`; verify both deploys before relying on the new checks.
