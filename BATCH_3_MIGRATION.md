# Phase 7 Batch 3 — Heavy Public Pages Migration

**Status:** sub-phases 7.3.1 + 7.3.2 + 7.3.3 CODE-COMPLETE (April 22–24 2026); 7.3.4 (legacy CSS deletion) blocked on Cloudflare branch-preview verification.
**Scope:** migrate the three highest-traffic public pages off legacy CSS onto the unified `cp-design.css` + `cp-marketing.css` system.
**Audience:** any developer (human or AI) picking up this work mid-stream. Read this first; you do not need to re-read the rest of the design history.

---

## Why this document exists

Batch 3 is the only remaining frontend migration. It is **the highest visual-regression risk in the project** because:

- `index.html` (708 lines) is the SEO-critical landing page.
- `listings.html` (1,260 lines) is the primary search/browse surface and uses Supabase, map, filters, and the property-card component.
- `property.html` (1,560 lines) is the conversion page (every "Apply" click starts here) and renders structured data, photo carousels, and the lease-application URL builder.

Doing all three in one PR is unsafe. This document splits batch 3 into **four sub-phases**, in order. Each is one PR, owner-approved before the next begins, per `.agents/instructions.md`.

---

## Sub-phase order

| # | Page / scope | Risk | Effort | Status |
|---|---|---|---|---|
| **7.3.1** | `index.html` (homepage) — hero, search, trust strip, featured listings, how-it-works, why-us | Medium | 1 day | ✅ DONE (April 22 2026) |
| **7.3.2** | `listings.html` (browse) — filter bar, property grid, map panel, pagination | High | 1–2 days | ✅ DONE (April 22 2026) — pending owner verification on a Cloudflare branch preview |
| **7.3.3** | `property.html` (detail) — gallery + lightbox, info panels, contact form + mobile drawer, structured data | High | 1–2 days | ✅ DONE (April 24 2026) — pending owner verification on a Cloudflare branch preview |
| **7.3.4** | Phase 8 final cleanup — delete `css/main.css`, `css/mobile.css`, `css/listings.css`, `css/property.css` | Low (deletes only) | 1 hour | ⏳ Blocked on Cloudflare branch-preview verification of 7.3.2 + 7.3.3 |

After 7.3.4, the project's "active CSS surface" comment in `PROJECT_STATUS.md` becomes the entire CSS surface. ~5,634 lines of legacy CSS will be deleted.

---

## What "migrated" means (the contract for every page)

A page is migrated when **every one** of these is true:

1. The `<head>` loads exactly two stylesheets: `/css/cp-design.css` and `/css/cp-marketing.css` (plus Font Awesome and Inter from Google Fonts). It does NOT load `main.css`, `mobile.css`, `listings.css`, or `property.css`.
2. `<html>` carries `data-theme="light"`. `<body>` carries `data-portal="public"` and a `data-page="<slug>"` attribute.
3. The shared nav and footer are loaded by `js/components.js` from `components/nav.html` + `components/footer.html` — i.e. the body contains only `<div id="site-nav"></div>` and `<div id="site-footer"></div>` slots, NOT inline nav/footer markup.
4. Every CSS class used by the page exists inside `cp-marketing.css` (scoped under `body[data-portal="public"]`) or `cp-design.css`. No page-specific `<style>` block in the HTML except the critical-CSS inline block (small, above-fold only).
5. All cache-bust query strings on CSS/JS imports use one date: today's date in `YYYYMMDD` format.
6. **R6 / R7 preserved** (DESIGN_EXTENSION_PLAN.md §0):
   - Every `id`, `name`, and `data-*` attribute used by JavaScript stays in place. Grep `js/*.js` for any element id before removing or renaming it.
   - Every SEO tag stays: `<title>`, `<meta name="description">`, `<meta property="og:*">`, `<link rel="canonical">`, JSON-LD `<script type="application/ld+json">` blocks, `<h1>` text content.
7. Verified on a Cloudflare branch preview at 375 / 768 / 1280 px in Chrome, Safari, Firefox. No console errors. All forms submit and all Supabase queries fire.

---

## Cache-bust convention for batch 3

All CSS/JS references in the touched HTML files MUST use the **same** `?v=YYYYMMDD` string in a single PR. Use today's date when you start the sub-phase. Recent in-repo precedent: `20260424` (used by `about.html`).

When `js/cp-api.js`, `cp-shell.js`, `cp-chrome.js`, or `js/components.js` are updated in the same PR, bump those references too.

---

## Sub-phase 7.3.1 — `index.html`

### Files touched

| File | Change |
|---|---|
| `css/cp-marketing.css` | Append **homepage components** section: hero, search bar, trust strip, featured listings, how-it-works (dark), why-us (dark), scroll-top, toast, skeleton, property card. ~700 lines added. |
| `index.html` | Full rewrite of `<head>`, drop inline nav/footer (use slots), keep all SEO + JSON-LD + JS + structured data. Bump cache-bust on every asset reference. |
| `PROJECT_STATUS.md` | Update batch-3 status row to mark 7.3.1 done. |
| `DESIGN_EXTENSION_PLAN.md` | Update batch-3 status to mark 7.3.1 done. |
| `BATCH_3_MIGRATION.md` (this file) | Tick the status table. |

**Do NOT touch** in this sub-phase: `css/main.css`, `css/listings.css`, `css/mobile.css`, `css/property.css` (they're still used by `listings.html` and `property.html`); `landlord/*`, `admin/*`, `tenant/*`, `apply/*`, `supabase/*`.

### CSS components added to `cp-marketing.css`

All scoped to `body[data-portal="public"]` so admin/landlord/tenant pages remain unaffected. Section banner: `/* ── HOMEPAGE COMPONENTS (sub-phase 7.3.1) ── */`.

| Component group | Selectors | Source of original styles |
|---|---|---|
| Hero | `.hero`, `.hero-atmosphere`, `.hero-grain`, `.hero-rule`, `.hero-vertical-rule`, `.hero-inner`, `.hero-content`, `.hero-eyebrow`, `.hero-eyebrow-pulse`, `.hero-headline em`, `.hero-sub`, `.hero-stats`, `.hero-stat`, `.hero-stat-num`, `.hero-stat-label`, `.hero-stat-divider` + `@keyframes heroPulse` | `css/listings.css` lines 17–103 |
| Search bar | `.search-bar`, `.search-bar-top`, `.search-field`, `.search-btn`, plus mobile responsive overrides | `css/listings.css` 108–`*` and `css/mobile.css` 137–162 |
| Trust strip | `.trust-strip`, `.trust-strip-inner`, `.trust-strip-item` | `css/main.css` 1941–1974 |
| Featured listings | `.featured-section`, `.featured-section::before`, `.featured-header`, `.featured-title`, `.featured-subtitle`, `.featured-view-all`, `.featured-cta`, `.property-grid` (3-col responsive) | `css/listings.css` 711–760 + 581–600 |
| Property card | `.property-card`, `.property-card-img`, `.property-card-body`, `.property-card-title`, `.property-card-addr`, `.property-card-tags`, `.property-card-tag`, `.property-card-save`, `.property-card-share`, `.property-card-skeleton`, `.skeleton-img`, `.skeleton-line`, `.badge-*`, `cp-card-visible` animation | `css/listings.css` 600–654 + card-builder.js dependencies |
| How-it-works | `.hiw-section`, `.hiw-section-glow`, `.hiw-header`, `.hiw-eyebrow`, `.hiw-title`, `.hiw-subtitle`, `.hiw-track`, `.hiw-connector`, `.hiw-steps`, `.hiw-step`, `.hiw-step-bubble`, `.hiw-step-bubble--last`, `.hiw-step-body`, `.hiw-step-icon`, `.hiw-step-title`, `.hiw-step-desc`, `.hiw-cta`, `.hiw-cta-link` | `css/main.css` 1977–2123 |
| Why-us | `.why-section`, `.why-bg`, `.why-grid`, `.why-card`, `.why-card-num`, `.why-card-icon`, `.why-cta-btn`, `.section-title` (dark variant) | `css/listings.css` 762–780 |
| Scroll-top | `.scroll-top`, `.scroll-top:hover`, `.scroll-top.visible` | `css/listings.css` 808–819 |
| Toast | `.toast-container`, `.toast`, `.toast.toast-success`, `.toast.toast-error` + `@keyframes toastIn` | `css/main.css` 1486–1489 |
| Btn variants used here | `.btn-lg` (already present in cp-marketing.css), `.btn i` icon spacing | `css/listings.css` 824 |

The dark sections (`.hiw-section`, `.why-section`) are intentionally light-page-with-dark-strip — they use `--m-ink` / `--m-ink-2` from cp-marketing.css for their backgrounds and white text inline.

### `index.html` rewrite plan

Preserve from the original:

- Lines 1–12: agent-instruction comment block.
- Lines 16–34: every `<meta>` (charset, theme-color, manifest, viewport, title, description, og:*, twitter:*) and the Inter font preconnect+stylesheet. Drop the `main.css` and `listings.css` `<link>` lines and the duplicate `<noscript>` lines.
- Lines 40–72: critical CSS — KEEP, but trim references to legacy classes that no longer exist in cp-marketing.css. The point of the inline critical CSS is paint-blocking elimination on slow 3G; do not delete it wholesale, just narrow it.
- Lines 73–77: script tags — KEEP. Ensure load order: `config.js` → `supabase.min.js` → `cp-api.js` → `components.js` → `card-builder.js`.
- Lines 80–111: both JSON-LD `<script type="application/ld+json">` blocks (WebSite + Organization) — KEEP exactly.
- Lines 187–406: hero, trust strip, featured section, how-it-works, why-section — KEEP all markup, IDs, classes, ARIA attributes intact. Only the `<head>` and nav/footer wrappers change.
- Lines 470–705: the entire inline `<script type="module" nonce="…">` block — KEEP, including the CSP-safe image handlers, `loadFeaturedListings`, `goToListings`, `setupScrollTop`, `setupSmoothScrollSections`. Preserve the `nonce` attribute exactly (Cloudflare CSP enforces it).

Replace:

- The inline `<div id="site-nav" data-server-injected="1">…</div>` (lines 116–184) with `<div id="site-nav"></div>` — let `js/components.js` inject the nav from `components/nav.html`.
- The inline `<div id="site-footer" data-server-injected="1">…</div>` (lines 409–465) with `<div id="site-footer"></div>` — same treatment.
- All `<link rel="stylesheet" href="/css/...">` references — replace with cp-design.css + cp-marketing.css at the new cache-bust.
- `<body>` opening tag — set `data-portal="public" data-page="home"`.

### Validation checklist (pre-merge)

- [ ] Cloudflare branch preview URL responds 200 on `/`.
- [ ] No console errors at `/`, Chrome desktop + Chrome mobile emulation 375 px.
- [ ] Hero gradient renders, search bar layout matches the legacy site at 375/768/1280 px.
- [ ] Trust strip is hidden < 480 px (matches legacy mobile.css behavior).
- [ ] Featured listings load from Supabase (or show "Listings Coming Soon" empty state if none).
- [ ] How-it-works section: 3 steps in row at desktop, stacked at < 700 px.
- [ ] Why section: 3 cards in row at desktop, stacks at narrow viewport.
- [ ] Scroll-top button appears after scrolling 400 px.
- [ ] Search bar submission to `/listings.html` works with all three params.
- [ ] Mobile drawer open/close still works (delegated to `js/components.js`).
- [ ] `health.html` on the preview reports all services green.
- [ ] Lighthouse Performance not worse than -5 from prior production score; SEO ≥ prior.

### Rollback

Single PR revert. Cloudflare auto-redeploys the previous version in ~2 min. Bust cache-bust string by +1 day on the next attempt to force re-fetch.

---

## Sub-phase 7.3.2 — `listings.html`

### Files touched

| File | Change |
|---|---|
| `css/cp-marketing.css` | Append **listings components** section: filter bar, advanced filter panel, sort/results bar, pagination, list/map view toggle. Map-popup styles. ~500 lines added. |
| `listings.html` | Full rewrite per the same pattern as 7.3.1. |
| `js/card-builder.js` | NO change. Card markup is shared with index.html; CSS now lives in cp-marketing.css. |
| Docs | Tick status. |

### Key risks

- **Map panel** uses Leaflet (loaded inline). The `#mapPanel`, `#listingsMap`, `.map-marker-price`, `.map-popup-card`, `.map-popup-img`, `.map-popup-price`, `.map-popup-title`, `.map-popup-meta`, `.map-popup-apply`, `#mapLoadingSpinner` selectors must all be ported. See `css/listings.css` 670–709.
- **Filter bar** has a sticky header on scroll. Test sticky behavior at every breakpoint.
- **Pagination + infinite scroll** — `listings.html` may use one or the other; preserve both selectors and handlers.

### Components to add to `cp-marketing.css`

| Component | Source |
|---|---|
| Filter bar (basic + advanced panel) | `css/listings.css` (search for `.filter`, `.adv`, `.sort-bar`) |
| Listings results header | `css/listings.css` |
| Map panel | `css/listings.css` 670–709 |
| Pagination | `css/listings.css` |
| Empty state (already partially in cp-marketing for legal pages) | `css/listings.css` 657–667 |

---

## Sub-phase 7.3.3 — `property.html`

### Files touched

| File | Change |
|---|---|
| `css/cp-marketing.css` | Append **property-detail components** section: photo gallery + lightbox, info panels, sidebar pricing card, contact form, amenities grid, structured-data fallback. ~600 lines added. |
| `property.html` | Full rewrite per the same pattern. |
| Docs | Tick status. |

### Key risks

- **Photo gallery** uses a custom carousel implementation. Preserve every `data-*` attribute on the slide elements — the JS depends on them.
- **`renderProperty(p)`** writes inline `<style>` for OG meta dynamically; this is **server-render-time** SEO content. Do not touch the OG meta logic.
- **`buildApplyURL(property)`** in `js/cp-api.js` is the contract with `/apply/`. Do not change the contract; the `Apply` button on this page just calls it.
- The page has been flagged "highest visual-regression risk" — extra care with photo gallery layout, sticky pricing card, and amenity grids.

---

## Sub-phase 7.3.4 — Legacy CSS deletion

**Pre-conditions:**

1. Sub-phases 7.3.1, 7.3.2, 7.3.3 are merged and live on production for **at least 2 weeks** with no rollbacks.
2. `grep -r "main\.css\|mobile\.css\|listings\.css\|property\.css" --include="*.html" --include="*.js"` returns **zero matches** outside of `/apply/` (which keeps its own `apply.css` per R3).
3. Cloudflare Pages analytics show no 404s on the deprecated CSS file paths in the last 7 days.

**Actions:**

1. `git rm css/main.css css/mobile.css css/listings.css css/property.css`.
2. Update `ARCHITECTURE.md` "stylesheet map" section.
3. Update `DESIGN_EXTENSION_PLAN.md` §1.2 — mark these four files as DELETED.
4. Update `PROJECT_STATUS.md` — remove the "Legacy CSS still in repo" block.

**Total lines removed:** 5,634 (main 2,159 + mobile 1,221 + listings 1,052 + property 1,202).

---

## Decisions reached during 7.3.1 (for 7.3.2 / 7.3.3 implementers)

- **Property card CSS lives in `cp-marketing.css`**, not in a separate file. It is shared by index/listings/property and must stay coherent across all three.
- **Critical inline CSS is preserved** in each migrated HTML page (small subset for above-fold paint), but trimmed to only reference selectors that exist in cp-marketing.css.
- **The dark-strip sections** (hiw, why) use `--m-ink` and `--m-ink-2` for backgrounds — they are NOT a "dark theme," they are dark-painted strips inside a light page. Do not introduce a `[data-theme="dark"]` block on these pages.
- **Cache-bust date is single-PR-wide.** Every CSS/JS reference in a PR uses the same date, even if some assets weren't actually edited. This avoids confusion when checking which version a browser fetched.
- **Nav/footer slot pattern is non-negotiable.** Any inline nav/footer markup in a public page is a regression. `components/nav.html` and `components/footer.html` are the only sources.

---

## Reference: file paths used by these pages

- Stylesheets in scope: `css/cp-design.css`, `css/cp-marketing.css`.
- Stylesheets being phased out: `css/main.css`, `css/mobile.css`, `css/listings.css`, `css/property.css`.
- Shared JS: `js/cp-api.js` (Supabase wrapper), `js/components.js` (nav/footer injector), `js/card-builder.js` (property card builder), `js/imagekit.js` (photo CDN), `js/supabase.min.js`.
- Shared HTML partials: `components/nav.html`, `components/footer.html`.
- Build script: `generate-config.js` (writes `config.js` at Cloudflare build time).

## Reference: SEO contract

Every public page MUST keep, at minimum:

- `<title>` matching its current text.
- `<meta name="description" content="…">`.
- `<link rel="canonical" href="https://choice-properties-site.pages.dev/<page>">`.
- All Open Graph and Twitter Card meta tags currently present.
- All `<script type="application/ld+json">` JSON-LD blocks currently present.
- Original `<h1>` text content on every page.

If you change a heading or remove a tag, you have committed an SEO regression. Revert.
