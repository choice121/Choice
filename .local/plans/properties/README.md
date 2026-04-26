# Properties Improvement Plan — Master Index

> **Purpose:** End‑to‑end roadmap for improving the Properties feature
> (database, public listing/detail pages, admin tools, photos, SEO,
> performance, compliance) on Choice Properties.
>
> **Audience:** Any future AI agent or human engineer picking up this
> work. Read this file first, then open the phase file you intend to
> work on.

---

## 1. How this project ships (read first, do not skip)

This is a **static site** deployed to **Cloudflare Pages**. There is
**no Node server**, no Express, no Replit workflow, no `npm run dev`.

```
edit → git commit → git push origin main → Cloudflare Pages auto-builds
```

The Replit workspace is **only an editor**. Hard rules enforced by the
repo itself:

- `.github/workflows/cloudflare-only.yml` rejects any PR that adds
  `.replit`, `replit.nix`, `replit.md`, `REPLIT_SAFETY.md`, `server.js`,
  `scripts/generate-config-replit.js`, or other server files.
- `scripts/enforce-cloudflare-only.js` is an `npm preinstall` hook that
  throws if it detects a Replit environment variable.
- Every public HTML file ships with a banner reiterating the rule.

**Consequence:** Do not configure any workflow. Do not start any local
server. Do not add Express, Fastify, or any Node runtime. Use the
Replit editor + push to GitHub. The deployed site is at
`https://choice-properties-site.pages.dev` and the GitHub repo is
`choice121/Choice` on the `main` branch.

Edge functions live in `supabase/functions/` and deploy via
`.github/workflows/supabase-deploy.yml` on every push to `main`.
Migrations live in `supabase/migrations/` and apply through the same
workflow with idempotent tracking via the `_migration_history` table.

---

## 2. Where everything lives (codebase tour)

### Public pages
| File | Purpose |
|---|---|
| `index.html` | Marketing homepage. Renders a "Featured" property strip via `card-builder.js`. |
| `listings.html` | Search/filter/grid+map page. Hydrated by `js/listings.js`. |
| `property.html` | Single‑property detail page. Hydrated by `js/property.js`. |
| `apply.html` | Application flow (downstream of property page). Out of scope here. |

### Public JavaScript
| File | Purpose |
|---|---|
| `js/card-builder.js` | **Single source of truth for the property card.** Used by both `index.html` and `listings.html`. Edit here, never duplicate. |
| `js/listings.js` | Listings page state, filters, pagination, map, sort. |
| `js/property.js` | Property detail page render, lightbox, gallery, apply CTA, share. |
| `js/cp-api.js` | Supabase client wrapper + helpers (`buildApplyURL`, `incrementCounter`, `SavedProperties`, `updateNav`). |
| `js/cp-ui.js` | DOM helpers (`CP.UI.esc`, `lqipUrl`, toast, scroll-top). |
| `js/imagekit.js` | ImageKit URL builder + responsive helpers. |
| `js/components.js` | Shared HTML hydration (e.g. nav from `/components/nav.html`). |
| `js/cp-shell.js` | Authenticated portal shell (landlord / tenant). Out of scope. |

### Admin / landlord
| File | Purpose |
|---|---|
| `admin/properties.html` + `js/admin/properties.js` | Admin list view. |
| `admin/listings.html` | Admin variant of the public listings. |
| `landlord/new-listing.html`, `landlord/edit-listing.html` | Landlord-side property CRUD. |

### Styling
| File | Purpose |
|---|---|
| `css/cp-design.css` | Design tokens (colors, radii, spacing, shadows, easing). 1,012 lines. Both light and dark themes. |
| `css/cp-marketing.css` | Public-page component styles (5,339 lines, 93 property/listing rules). |
| `css/apply.css` | Application flow styles. |

### Database
| Object | Purpose |
|---|---|
| `properties` | 60-column rich row for each listing. PK `id text` (`PROP-XXXXXXXX`). |
| `property_photos` | One row per photo. ImageKit URL + display order + watermark status. Unique on (property_id, display_order). |
| `landlords` | Owner records, joined via `landlord_id`. |
| `landlords_public` (view) | Redacted projection used by the public site (no PII). |
| `property_status` (enum) | `active`, `draft`, `archived`, … (see Phase F for the full set). |

### Edge functions touching properties
- `imagekit-upload`, `imagekit-delete` — photo lifecycle
- `request-upload-url` — pre-signed upload URL issuance
- `send-inquiry` — contact form submission

### Storage buckets
- `property-photos` — public, 15 MB cap, image MIME whitelist (set 2026-04-26)
- `profile-photos` — public, 5 MB cap, image MIME whitelist
- `lease-pdfs`, `application-docs`, `lease-inspection-photos` — private

---

## 3. The phases

Phases are intentionally ordered so that **A → B → C** are the highest
ROI items and have **no inter-phase dependencies**. After that, run any
phase in any order; check the `Depends on` line at the top of each.

| # | File | Goal | Risk | Impact |
|---|---|---|---|---|
| **A** | [`PHASE-A-data-hygiene.md`](./PHASE-A-data-hygiene.md) | Backfill missing fields, consolidate the bathroom-column triplet, fix admin enum mismatch, dedupe addresses | low | high |
| **B** | [`PHASE-B-indexing.md`](./PHASE-B-indexing.md) | Add the missing `state/city/zip/created_at/lat-lng/pets_allowed` indexes, EXPLAIN-verify, ANALYZE | low | medium |
| **C** | [`PHASE-C-seo.md`](./PHASE-C-seo.md) | Dynamic per-property sitemap (Pages Function), per-property meta tags + JSON-LD `RealEstateListing`, slug URLs | low | very high |
| **D** | [`PHASE-D-public-ux.md`](./PHASE-D-public-ux.md) | Fix sticky-bar collision, fix hero search width, badge stack ordering, server-persisted Saved list, hover-prefetch | low | medium |
| **E** | [`PHASE-E-photo-quality.md`](./PHASE-E-photo-quality.md) | Strip third-party watermarks on import, require min 3 photos to publish, vision-model alt text, storage orphan-cleanup job | medium | high |
| **F** | [`PHASE-F-admin-tools.md`](./PHASE-F-admin-tools.md) | Fix admin chip enum, property quality score, bulk edit, activity history per property | low | medium |
| **G** | [`PHASE-G-compliance.md`](./PHASE-G-compliance.md) | Fair-housing scan on descriptions, "Verified by Choice" badge wired to actual audit trail, per-state disclosures on public page | medium | high |
| **H** | [`PHASE-H-performance.md`](./PHASE-H-performance.md) | Edge-cache property pages with SWR, idempotent counter triggers, photo CDN error monitoring, Lighthouse budget | low | medium |

---

## 4. Working conventions for any AI working on this plan

1. **Edit in place** — do not rewrite files from scratch.
2. **One phase per pull request / commit batch.** Cross-phase changes
   are an anti-pattern.
3. **Migration filenames** must follow the existing `YYYYMMDD_phaseNN_*.sql`
   convention so the deploy-time migration runner picks them up in
   order. The runner is in `.github/workflows/supabase-deploy.yml`.
4. **Never inline a >100 KB SQL file in a curl command** — the runner
   already streams via tempfile, but new tooling should follow the same
   rule.
5. **Always test edge functions locally with `deno cache --no-check`**
   before pushing — the deploy workflow runs the same parse-check first.
6. **Image URLs** must always go through `CONFIG.img(url, 'card')` /
   `CONFIG.srcset(url, 'card', 'card_2x')` — never insert a raw
   ImageKit URL into the DOM.
7. **CSP** — no inline `<script>`, no inline `onload=`/`onerror=` (use
   the global delegated handlers in `js/listings.js` /
   `js/property.js`). External scripts loaded from `'self'` or the
   nonce'd CDNs only.
8. **RLS** — every new table gets RLS ON in the same migration that
   creates it.
9. **No new "magic" enum values** — when adding a status, update the
   enum + every place that filters on it (admin chips, RPCs,
   `properties_public_read` policy if needed).

---

## 5. State of the data (snapshot — 2026‑04‑26)

```
properties:        777 total / 772 active / 5 non-active
property_photos:   9,946 rows  (avg 12.8 / property, max 50)
states represented: 19   (top: TX 204, NC 109, GA 100, TN 99, MO 83)
landlords:         distinct owner records
photos:            100% on ImageKit, 100% watermark applied
orphan photos:     0
empty URLs:        0
```

### Quality gaps on **active** listings (out of 772)
| Gap | Count | % |
|---|---|---|
| no `square_footage` | 120 | 16% |
| no `bathrooms` | 52 | 7% |
| no `bedrooms` | 38 | 5% |
| no `available_date` | 77 | 10% |
| no `security_deposit` | 79 | 10% |
| < 3 photos | 137 | 18% |
| `description` < 100 chars | 26 | 3% |
| no `lat/lng` | 7 | < 1% |
| empty `amenities` | 302 | 39% |
| empty `appliances` | 461 | 60% |
| duplicate addresses | 8 rows in 4 groups | < 1% |

---

## 6. How to verify after a phase ships

After every phase, run the smoke checks below. The full data lives in
the previous-phase scan report at `.local/SCAN_REPORT.md`.

```bash
# Live homepage smoke
curl -sI https://choice-properties-site.pages.dev/ | head -20

# Public REST sanity (anon key)
curl -s "https://tlfmwetmhthpyrytrcfo.supabase.co/rest/v1/properties?status=eq.active&select=count" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Prefer: count=exact" -H "Range: 0-0" -D -

# Edge function freshness — confirm the version bumped on a recent deploy
curl -s -H "Authorization: Bearer $SB_PAT" \
  "https://api.supabase.com/v1/projects/tlfmwetmhthpyrytrcfo/functions" \
  | jq -r 'sort_by(-.updated_at) | .[0:5] | .[] | "v\(.version) \(.slug)"'

# CF Pages last deploy state
curl -s -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/07299bddeb80034641a7424a5f665dac/pages/projects/choice-properties-site/deployments?per_page=1" \
  | jq -r '.result[] | "\(.created_on)  \(.latest_stage.name)/\(.latest_stage.status)"'
```

---

## 7. Decision log (additions append here)

- **2026-04-26** — Plan opened. Pre-deploy parse-check guard + tempfile migration runner shipped (commits `29fd1f86`, `6a26734`, `42ca0e06`).
- **2026-04-26** — Storage bucket size + MIME whitelists applied via Storage API (Management API doesn't expose the endpoint).
