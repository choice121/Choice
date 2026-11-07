# Choice Properties — Full System Audit Report

Date: November 7, 2026 | Auditor: Antigravity AI | Scope: End-to-End

IMPORTANT

This is a read-only audit and recommendation report. No code changes have been made. All findings are categorized by severity. Await your review and explicit approval before any implementation begins.

## Executive Summary

Choice Properties is a well-structured, production-ready rental property platform deployed on Cloudflare Pages with Supabase as its backend. The core pipeline (Chrome Extension → Edge Function → Supabase DB → Public Site) is solid and thoughtfully engineered. The codebase shows strong security awareness, good CSP implementation, mobile-first design, and a layered CSS design system.

However, there are meaningful gaps in several areas that limit it from being a true market-standard platform:

| Category | Grade | Notes |
|---|---|---|
| Security & Access Control | B+ | Good RLS/CSP, some gaps |
| Database Schema | B | Solid base, missing indexes & constraints |
| Frontend UI/UX | B | Good design system, needs polish |
| Property Type Features | C+ | Apartment model started but incomplete |
| Chrome Extension | A- | Mature, well-versioned, broad coverage |
| CI/CD & Deployment | A- | Strong GitHub Actions pipeline |
| Performance | B | Good caching, some bottlenecks |
| SEO | B- | Basic meta tags, missing structured data |
| Tenant/Landlord Portal | C+ | Functional but minimal features |

## 🔴 CRITICAL ISSUES

### 1. CSP Uses unsafe-inline + unsafe-eval on script-src
Location: unctions/_middleware.js

The nonce-based CSP rotation is excellent engineering — but it's completely undermined by 'unsafe-inline' and 'unsafe-eval' being left in the script-src directive. These override nonce-gating entirely, meaning any inline script injection attack succeeds regardless of nonce.

`js
// Current (BROKEN — unsafe-inline defeats nonce)
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net ..."
// Should be (nonce-only, no unsafe-inline):
"script-src 'self' 'nonce-__NONCE__' https://cdn.jsdelivr.net ..."
`

Risk: XSS vector wide open. Any injected <script> tag runs. Fix: Remove 'unsafe-inline' and 'unsafe-eval' from script-src. Audit all inline scripts to ensure they all carry 
once="__CSP_NONCE__".

### 2. OG Meta Injection Uses Unescaped Property Title
Location: unctions/_middleware.js

`js
html = html.replace('<title>Property – Choice Properties</title>', <title></title>);
// and
const ogTags = <meta property="og:title" content="">...
`

pageTitle comes from the database (p.title) with zero HTML escaping. A property title containing " or > or </head> would break the HTML or be exploitable.

Fix: HTML-escape pageTitle before interpolation.

### 3. Pipeline Import Hardcodes Supabase URL as Fallback
Location: unctions/_middleware.js

`js
const supabaseUrl = (context.env && context.env.SUPABASE_URL) || "https://tlfmwetmhthpyrytrcfo.supabase.co";
`

The Supabase project URL is hardcoded as a fallback in production middleware. If the env var is ever unset (e.g., misconfigured Cloudflare env), it silently falls back to the hardcoded value — masking misconfiguration. It also reveals the project URL in source code.

Fix: Fail loudly if SUPABASE_URL is not set. Never hardcode.

### 4. Tenant Auth — Magic Login Session Stored in Cookie Without Secure Flag
Location: js/cp-api.js — _dualStorage.setItem()

The dual-storage cookie written for session persistence uses SameSite=Lax but no Secure flag. On non-HTTPS environments (local dev) the cookie is transmitted in plain text. While production is HTTPS-only, omitting Secure is a bad practice that could leak sessions in misconfigured or test environments.

Fix: Add ; Secure to the cookie string.

## 🟠 HIGH PRIORITY ISSUES

### 5. Property Type — Apartment/Multi-Unit Model Is Incomplete on the Frontend
Location: Database migrations exist (20261106000005_apartment_inventory_model.sql), but the public property detail page (property.html / js/property.js) has no UI for displaying units, floor plans, or multi-unit inventory.

DB has: property_units, property_buildings, property_floors, property_floor_plans tables with full RLS. But on the public site:

- No unit availability table
- No floor plan cards
- No "Select a unit" CTA for apartments
- No building/floor selector UI
- No community_starting_rent / community_max_rent display

Fix: Build a "Units & Floor Plans" section on the property detail page. This is a major market-standard feature gap.

### 6. src/types/property.ts TypeScript Interface Is Stale / Orphaned
Location: src/types/property.ts

Reflects old schema (MLS-focused, mls_id, mls_status, gent_name, roker_name) that doesn't match live public.properties (has monthly_rent, property_type, unit_options, menities, etc.). Loaded by src/App.tsx but React app appears unused/experimental.

Fix: Sync types or remove stale src/ directory if dead.

### 7. serve.js Is a Wildcard Access-Control-Allow-Origin: * Server
Location: serve.js

Local dev server responds with Access-Control-Allow-Origin: * to all requests, including sensitive admin and landlord pages. Local-only, but creates bad habits and doesn't reflect production CSP.

### 8. Missing Database Indexes — High-Traffic Queries Will Be Slow
Likely missing composite indexes:

| Table | Missing Index | Query Pattern |
|---|---|---|
| properties | (state, status, monthly_rent) | Browse by state + price filter |
| properties | (city, status, bedrooms) | Browse by city + beds filter |
| properties | (status, created_at DESC) | "Newest" sort |
| properties | (status, monthly_rent ASC) | Price sort |
| pplications | (property_id, status) | Admin application review |
| pipeline.pipeline_properties | (folder_id, scraped_at DESC) | Pipeline folder browsing |

Fix: Add composite indexes matching common query patterns.

### 9. Chrome Extension — VERSION Variable Referenced Before Declaration
Location: chrome-extension/content.js

`js
if (window.__CP_CONTENT_LOADED__ && window.__CP_CONTENT_VERSION__ === VERSION) return;
// ...
var VERSION = '52.7.13';  // declared AFTER use
`

In strict mode this is a ReferenceError. ar hoisted to undefined so guard never matches, extension may inject UI multiple times on SPA navigation.

Fix: Move ar VERSION = '...' to top of IIFE.

### 10. Apply Form (apply/index.html) Has No Supabase Client — Uses Legacy GAS Backend
Header says "Backend: Google Apps Script". eceive-application edge function exists but unclear if form actually calls it. Creates split architecture.

Fix: Confirm backend and consolidate to Supabase Edge Functions if not already done.

## 🟡 MEDIUM PRIORITY ISSUES

### 11. No Structured Data (JSON-LD) for SEO
Property detail pages have OG tags but no Schema.org JSON-LD (e.g. Residence with Offer). Needed for rich results.

### 12. No Sitemap for Public Listings
unctions/sitemap-properties.xml.js exists but not confirmed routed to /sitemap.xml. Google may not discover all property detail pages.

### 13. Property Detail Page — Photo Gallery Not Keyboard/Accessibility Accessible
No ria-label on prev/next, no ole="listitem", no keyboard left/right, lt not derived from address. ADA concern.

### 14. listings.js — Global State Variables, No Module Encapsulation
Many module-level let globals. Encapsulate in class/store object.

### 15. No Rate Limiting on Public API Queries
Anon key access to properties via PostgREST has no rate limiting. Add Cloudflare Rate Limiting for /rest/v1/properties*.

### 16. property.html — Dark Mode Theme Inconsistency
index.html defaults to data-theme="light" and ignores prefers-color-scheme on first visit. Align with property.html pattern.

### 17. Chrome Extension Manifest — Overly Broad host_permissions
Requests https://*.amazonaws.com/*, https://*.cloudinary.com/*, https://*.fastly.net/*. These are CDNs, not content script targets. May be flagged by Chrome Web Store. Remove from host_permissions (use etch in background worker).

### 18. Pipeline Admin — No Bulk Edit / Mass Update UI
Bulk selection exists but only delete. Need bulk status change, rent adjustment, folder move.

### 19. Tenant Portal — Very Thin Feature Set
Missing: maintenance requests, rent payment tracking/history, lease download, inspection scheduling, move-in checklist, comms thread with landlord.

### 20. Landlord Portal — No Financial Dashboard
No rent collection, payment tracking, P&L summary.

## 🟢 IMPROVEMENTS & ENHANCEMENTS

### 21. Property Features — Missing Market-Standard Fields
Walk Score/Transit Score, school district, crime, 3D tour embed (field exists but not surfaced), video walkthrough, move-in specials/concessions, utility responsibility, HOA fees, parking details, internet/cable included, accessibility features, energy efficiency rating.

### 22. Multi-Unit / Apartment Property UI Roadmap
Need: Community Summary, Available Units tab (filters, unit cards with Apply), Floor Plans tab, Building Map, Gallery (community + unit photos). DB schema exists.

### 23. Search & Discovery — Major UX Gaps
Map view with pins (appears incomplete), draw on map search, saved search alerts, commute time filter, price history, days on market.

### 24. Application Journey — No Application Status Page
After submission, no public status tracker. Tenant portal auth exists but needs status view.

### 25. Admin Dashboard — Missing KPIs
Rent roll, vacancy rate, application conversion rate, days to lease, renewal tracking.

### 26. No Automated Photo Quality Check
Watermark-review/sniper/vision-audit exist but manual. Automate in pipeline.

### 27. Extension — .pages-orion/ Is a Duplicate Codebase
Two near-identical trees. Refactor to single source + build script (sync-and-bump-extension.mjs partially does this).

### 28. No End-to-End Test Coverage for Critical Flows
Missing E2E for application submission, share link access, pipeline import→publish, auth flows. Wire test scripts into GitHub Actions CI.

### 29. Performance — Font Loading Is Blocking
Multiple Google Font families on some pages. Reduce families, use ont-display: optional, self-host from /assets/.

### 30. GitHub Actions — Supabase Migration Script Uses python3 Fragilely
Replace shell JSON parsing with Node script or official supabase db push.

## RECOMMENDED PRIORITY ACTION PLAN

### Phase 1 — Security & Stability (Do First)
1. Fix CSP: remove unsafe-inline / unsafe-eval from script-src
2. HTML-escape OG tag injection in _middleware.js
3. Remove hardcoded Supabase URL fallback from middleware
4. Add Secure flag to session cookie in cp-api.js
5. Fix VERSION variable hoisting in content.js
6. Add composite DB indexes for browse queries

### Phase 2 — Property Type Features (Core Business)
7. Build Apartment Units & Floor Plans UI on property detail page
8. Surface irtual_tour_url on property detail page
9. Add Walk Score / utility responsibility / parking details
10. Add JSON-LD structured data to property pages

### Phase 3 — UX & Discovery
11. Complete map view on listings page
12. Add saved search alerts
13. Fix dark mode consistency across all pages
14. Make photo gallery keyboard accessible
15. Add application status tracker in tenant portal

### Phase 4 — Admin & Operations
16. Add bulk edit actions to pipeline admin
17. Build admin financial dashboard (rent roll, vacancy rate)
18. Integrate E2E tests into GitHub Actions CI
19. Consolidate chrome-extension/ + .pages-orion/ into single source
20. Add automated watermark/quality check in pipeline

## TOOLS TO INSTALL
- 
px playwright install chromium
- 
pm install -g supabase
- Deno (https://deno.land)
- GitHub CLI (gh)
- Cloudflare Wrangler (wrangler)

## Architecture Note
Property sharing (magic links), private placement architecture, RLS policies, and Chrome Extension ingestion pipeline are production-quality. Main gaps: apartment UI, SEO structured data, CSP hardening, tenant/landlord portal depth. Addressable in focused sprints.

Audit complete.
