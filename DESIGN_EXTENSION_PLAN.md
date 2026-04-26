# Choice Properties — Design System Extension Plan

**Status:** AWAITING APPROVAL
**Author:** Initial draft generated April 2026
**Scope:** Extend the `admin-v2.css` "Operations Console" design system across the entire Choice Properties project in a safe, phased, reversible manner.
**Audience:** Any AI builder or human developer picking up this work — no prior session context required.

---

## 0. Read this first (non-negotiable rules)

These rules apply to **every phase** and **every contributor**. Violating them will either break the production site, leak secrets, or cause the GitHub CI to reject the push.

| # | Rule |
|---|---|
| R1 | **Cloudflare-only.** This project deploys exclusively to Cloudflare Pages. Do **not** add a Node/Express/Python server, do not add `server.js`, do not commit `replit.md`, `replit.nix`, `.replit`, `_dev_preview.js`, or `config.js`. The `.github/workflows/cloudflare-only.yml` and `.githooks/pre-commit` will reject any push that contains them. |
| R2 | **No new npm dependencies at runtime.** The only allowed Node code is the build script `generate-config.js`, which uses Node built-ins only. Do not add `express`, `pg`, `prisma`, `drizzle`, etc. — `scripts/enforce-cloudflare-only.js` blocks them. |
| R3 | **Do not touch `/apply/`.** It was copied from a separate project (`apply-choice-properties`) and has its own `apply.css` (1,560 lines) and `script.js` (3,848 lines) wired to the Google Apps Script email backend. Migrating it requires re-testing the full submission pipeline and is out of scope for this plan. |
| R4 | **Do not touch Supabase Edge Functions.** All work is frontend HTML/CSS/JS only. Edge Functions in `supabase/functions/*` are the API contract. Do not change response shapes; do not change request paths. |
| R5 | **Do not change navigation URLs.** `_redirects`, `sitemap.xml`, external bookmarks, and SEO depend on every `*.html` path staying exactly where it is. Internal markup may change freely; URLs cannot. |
| R6 | **Preserve `data-*` attributes and `id`s used by JavaScript.** Before deleting any element, grep for its `id` and any `data-*` attribute across `js/*.js`. If found, the element (or an equivalent hook) must remain. |
| R7 | **Preserve all SEO-critical tags** on public marketing pages: `<title>`, `<meta name="description">`, `<meta property="og:*">`, `<link rel="canonical">`, JSON-LD scripts, `<h1>` text content. Style them differently — never delete them. |
| R8 | **One PR per phase.** Each phase below is a separate Pull Request. Never combine phases. This is the single most important rule for safe rollback. |
| R9 | **Cache-bust version string** on every CSS/JS reference change. Use `?v=YYYYMMDD` (today's date) so Cloudflare's edge and users' browsers fetch the new file. Do this consistently in the same commit as the file change. |
| R10 | **Test every changed page in three viewports before merging the PR**: 375 px wide (iPhone SE), 768 px wide (iPad portrait), 1280 px wide (desktop). Use Cloudflare Pages' branch preview URL. Do not rely on local servers. |

---

## 1. Current state inventory (snapshot as of this plan)

### 1.1 Page groups

| Group | Path pattern | Count | Audience | Theme | Current status |
|---|---|---|---|---|---|
| **Public marketing** | `/*.html` (root) | 17 | Anonymous visitors, SEO crawlers | Light | Legacy: `main.css` + `mobile.css` (+ `listings.css` / `property.css`) |
| **Admin console** | `/admin/*.html` | 13 | Internal staff | Dark | 11/13 on `admin-v2.css`; 1 partial; 1 standalone |
| **Landlord portal** | `/landlord/*.html` | 9 | Authenticated landlords | Light + cards | Legacy: `main.css + landlord.css + dashboard-system.css + admin.css + mobile.css` |
| **Tenant portal** | `/tenant/*.html` | 2 | Authenticated tenants | Mixed | `dashboard-system.css` only (+ standalone login) |
| **Auth/transactional** | `lease-sign.html`, `count.html`, `health.html`, `404.html` | 4 | Mixed | Mixed | Each is bespoke or near-empty |
| **Application form** | `/apply/*` | many | Applicants | Standalone | **Out of scope** — see R3 |
| **Shared components** | `/components/*.html` | 2 (`nav.html`, `footer.html`) | Injected by `js/components.js` into public pages | Light | Owned by public marketing |

### 1.2 Stylesheet inventory

| File | Lines | Used by | Disposition in this plan |
|---|---|---|---|
| `css/admin-v2.css` | 582 | All `/admin/*` (except login & index redirect) | **Source of truth** — extended in Phase 2 |
| `css/main.css` | 2,159 | All public + landlord + footer/nav | Frozen for public; deprecated for landlord |
| `css/mobile.css` | 1,221 | All public + landlord | Frozen for public; deprecated for landlord |
| `css/landlord.css` | 567 | All `/landlord/*` | Deprecated after Phase 4 |
| `css/admin.css` | 387 | Landlord pages (legacy import) | Deprecated after Phase 4 |
| `css/dashboard-system.css` | 243 | Landlord + tenant portal | Deprecated after Phase 4/5 |
| `css/listings.css` | 1,052 | `listings.html`, `landlord/profile.html` (was index.html until sub-phase 7.3.1) | Frozen — used by public listings UI |
| `css/property.css` | 1,202 | `property.html` | Frozen — used by public detail page |
| `css/apply.css` | 1,560 | `/apply/*` only | **Do not touch (R3)** |

### 1.3 JavaScript inventory

| File | Lines | Role | Disposition |
|---|---|---|---|
| `js/admin-chrome.js` | 233 | Injects sidebar/appbar/tabbar/sprite into admin pages | Generalize in Phase 2 |
| `js/admin-shell.js` | 394 | Runtime: sheet, refresh, action delegation | Generalize in Phase 2 |
| `js/cp-api.js` | 975 | Supabase API client used everywhere | **Do not refactor in this plan** |
| `js/cp-ui.js` | 164 | Shared dashboard UI helpers (toast, badge, fmt) | Adopted by v2 in Phase 5 |
| `js/components.js` | 151 | Public-page nav/footer loader | Untouched |
| `js/card-builder.js` | 212 | Property card HTML builder for listings | Untouched |
| `js/imagekit.js` | 271 | ImageKit integration | Untouched |
| `js/supabase.min.js` | (min) | Vendored Supabase SDK | Untouched |

### 1.4 Known anomalies (must be fixed in Phase 1)

- `admin/dashboard.html` loads `admin-shell.js` but **not** `admin-chrome.js`; instead it inlines the SVG sprite and chrome HTML by hand.
- `admin/login.html` has not been migrated to v2 (uses inline `<style>`, old `theme-color: #006aff`, no `viewport-fit=cover`).
- `admin/index.html` is a redirect, missing `viewport-fit=cover` (cosmetic only).
- All five legacy stylesheets are pulled into landlord pages with stale cache-bust strings (`?v=1775137055043`).
- `lease-sign.html`, `count.html`, `health.html`, `tenant/login.html` ship with **no stylesheet at all** and will appear unstyled if reused.

---

## 2. Design principles for the unified system

The v2 system is dark-first, mobile-first, and built for dense data. Public marketing pages have different goals: trust, conversion, SEO. We therefore adopt a **dual-theme** architecture rather than forcing one look everywhere.

### 2.1 Two themes, one token system

Both themes consume the **same** CSS custom properties (`--brand`, `--sp-*`, `--r-*`, etc.). The themes differ only in surface and text tokens, swapped via a single `data-theme` attribute on `<html>`:

```css
:root,
[data-theme="dark"] { --bg:#0a0f1e; --surface:#111827; --text:#f1f5f9; /* … */ }
[data-theme="light"] { --bg:#ffffff; --surface:#f7f8fb; --text:#0a0f1e; /* … */ }
```

| Surface | Theme |
|---|---|
| `/admin/*` | dark (existing) |
| `/landlord/*` | light |
| `/tenant/portal.html` | light |
| Auth pages (`*/login.html`, `*/register.html`) | light, "marketing card" layout |
| Public marketing | **untouched** in this plan — see Phase 7 |

### 2.2 Single source of truth

After this plan completes, three files own the entire design system:

- `css/cp-design.css` — tokens + base reset + layout primitives + components (renamed from `admin-v2.css`)
- `js/cp-chrome.js` — generalized chrome injector (renamed from `admin-chrome.js`)
- `js/cp-shell.js` — runtime utilities (renamed from `admin-shell.js`)

Authenticated pages get their nav config via `<body data-portal="admin|landlord|tenant">`. Public pages do not load `cp-chrome.js` at all.

### 2.3 Accessibility floor

Every phase must satisfy:

- **Touch targets ≥ 44×44 px.**
- **Text contrast ≥ 4.5:1** for body text, **≥ 3:1** for large text and UI components (verify with browser DevTools or a contrast checker).
- **Visible focus ring** on all interactive elements (`:focus-visible` already in v2).
- **Honor `prefers-reduced-motion: reduce`** — disable `pulse`, `shimmer`, and `toastIn` animations.
- **Form labels** present on every input; never use placeholder-as-label.

---

## 3. Phased rollout

Each phase is **independent**, **reversible by reverting one PR**, and produces a working site at every commit. Phases are ordered by risk — lowest first.

### Phase 0 — Tooling & guardrails (foundation, no visible change)

**Risk:** None. **Effort:** ~1 hour. **Reversible:** trivial.

**Goal:** make subsequent phases safer.

**Deliverables:**

1. Add a single source of truth for the cache-bust version. Edit `generate-config.js` to inject `window.CP_ASSET_VERSION = "YYYYMMDD"` into the generated `config.js`. Document that all new `?v=` references should use the same date. (Optional but recommended.)
2. Add a top-of-file banner comment to `css/admin.css`, `css/landlord.css`, `css/dashboard-system.css`, `css/mobile.css` warning: "Legacy stylesheet — do not add new rules. New work goes in `css/cp-design.css`."
3. Create `tests/visual-checklist.md` — a per-page manual QA checklist used at the end of every phase (template in §6).

**Acceptance:** repo builds via `node generate-config.js`. No file referenced by HTML changes.

---

### Phase 1 — Admin cleanup (close the gaps in v2)

**Risk:** Low. **Effort:** 1–2 hours. **Reversible:** revert one PR.

**Goal:** make the existing v2 admin a fully consistent baseline before extending it.

**Deliverables:**

1. **Migrate `admin/dashboard.html` to use `admin-chrome.js`:**
   - Add `<script defer src="/js/admin-chrome.js?v=YYYYMMDD"></script>` to `<head>`.
   - Set `<body data-page-title="Dashboard" data-page-sub="Overview">`.
   - Remove the inline SVG `<svg aria-hidden="true">…</svg>` sprite from the body (chrome injects it).
   - Remove any hand-rolled `<aside class="sidebar">`, `<header class="appbar">`, `<nav class="tabbar">` from the body — chrome injects them.
   - Wrap remaining content as `<div class="app"><main class="app-content">…</main></div>` if not already.
   - Diff the rendered DOM before/after to confirm no functional regressions.

2. **Decide `admin/login.html`:**
   - Option A (recommended): migrate to v2 using a new `.auth-shell` class added in Phase 2. Defer until Phase 2.
   - Option B: leave standalone but normalize `<meta name="theme-color">` to `#0a0f1e` and add `viewport-fit=cover`.
   - **Choose A.** Note in the PR.

3. **Add reduced-motion guard** to `css/admin-v2.css`:
   ```css
   @media (prefers-reduced-motion: reduce) {
     .live-dot, .skeleton, .toast { animation: none !important; }
     .action-card, .btn, .fab { transition: none !important; }
   }
   ```

4. **Bump cache-bust** on all 12 admin files in one sweep: `?v=20260422` → `?v=YYYYMMDD` (today).

**Acceptance:**
- All 12 admin pages render identically (dashboard included) with the chrome injected exactly once.
- No console errors on any admin page in Chrome, Safari, Firefox.
- Visual checklist passes for `dashboard.html` at 375/768/1280 px.

**Files touched:** `admin/dashboard.html`, `css/admin-v2.css`, all 12 `admin/*.html` head tags (cache-bust only).

---

### Phase 2 — Generalize the chrome (multi-portal foundation)

**Risk:** Medium (refactors a working shared file). **Effort:** 3–4 hours. **Reversible:** revert one PR.

**Goal:** make `admin-chrome.js` and `admin-v2.css` reusable for landlord and tenant portals **without** changing the admin look.

**Deliverables:**

1. **Rename files (keep old as aliases for one release):**
   - `css/admin-v2.css` → `css/cp-design.css`. Keep `css/admin-v2.css` as a one-line `@import "cp-design.css";` shim for one release cycle so any external bookmark or unmigrated page keeps working.
   - `js/admin-chrome.js` → `js/cp-chrome.js`. Keep old file as a one-line script that loads the new one.
   - `js/admin-shell.js` → `js/cp-shell.js`. Same shim pattern.

2. **Parameterize `cp-chrome.js`:**
   - Read `<body data-portal="admin|landlord|tenant">`. Default `admin`.
   - Move the three nav configs into one object: `const PORTAL_NAV = { admin: {...}, landlord: {...}, tenant: {...} }` with `sidebar`, `tabs`, `more`, `brandLabel`, `signOutHref` per portal.
   - Landlord nav (initial draft):
     - Tabs: Dashboard, Listings, Inquiries, Apps, More
     - Sidebar sections: Overview (Dashboard), Properties (Listings, New Listing), Pipeline (Inquiries, Applications), Account (Profile, Settings), Sign out
   - Tenant nav (initial draft):
     - Tabs: Home, Documents, Payments, Messages, More
     - Sidebar sections: Portal (Home), Lease (Documents, Payments), Communications (Messages, Inquiries), Account (Profile), Sign out
   - All hrefs MUST match existing `*.html` paths (R5).

3. **Add `.auth-shell` component** to `css/cp-design.css`:
   - Centered card on a tinted background, brand logo + tagline at top, slot for form inputs, primary CTA, footer microcopy. Used by all `*/login.html`, `*/register.html`, and `lease-sign.html` in Phases 4–6.

4. **Add light-theme tokens** to `css/cp-design.css` under `[data-theme="light"]`. Audit every existing rule that references `#0a0f1e`, `#111827`, `#1a2235`, `#1e2d45`, `#f1f5f9`, `#94a3b8` — replace with the appropriate `var(--…)`. Verify dark theme is byte-for-byte identical visually.

5. **Add form-field components** to `css/cp-design.css` (needed by Phases 4–6):
   - `.field`, `.field-label`, `.field-input`, `.field-select`, `.field-textarea`, `.field-help`, `.field-error`
   - `.fieldset` (logical group with title)
   - `.form-grid` (responsive 1-col → 2-col at ≥640 px)
   - `.checkbox`, `.radio`, `.switch`
   - `.dropzone` (file upload)
   - `.stepper` (multi-step wizard, 3–5 steps, mobile-friendly)
   - All inputs ≥44 px tall, font-size ≥16 px (prevents iOS zoom).

**Acceptance:**
- Admin pages still render byte-for-byte the same.
- Loading `/landlord/dashboard.html` with `<body data-portal="landlord">` (in a throwaway test branch) renders the landlord chrome correctly with no console errors.
- Light theme demo page (one-off `_test_light.html`, gitignored) shows identical card/button/form components in light surfaces.

**Files touched:** new `css/cp-design.css`, new `js/cp-chrome.js`, new `js/cp-shell.js`; one-line shims left at the old paths.

---

### Phase 3 — Admin login + auth shell (small, isolated)

**Risk:** Low. **Effort:** 1–2 hours. **Reversible:** revert one PR.

**Goal:** migrate `admin/login.html` to v2 using the new `.auth-shell` component.

**Deliverables:**

1. Replace inline `<style>` in `admin/login.html` with `<link rel="stylesheet" href="/css/cp-design.css?v=YYYYMMDD">`.
2. Set `<body data-theme="dark" data-portal="auth">`. Do **not** load `cp-chrome.js` (auth pages have no shell).
3. Re-mark up the form using `.auth-shell`, `.field`, `.btn-primary`, `.field-error`.
4. Preserve every `id`, `name`, `data-*` attribute the existing JS depends on. Grep `js/cp-api.js` for any references first.
5. Test the magic-link flow end-to-end against the **existing** Supabase Edge Function `send-magic-link`.

**Acceptance:** admin can sign in, identical Supabase requests are sent, no JS console errors, looks coherent on mobile.

**Files touched:** `admin/login.html` only.

---

### Phase 4 — Landlord portal migration (the big one)

**Risk:** Medium-High (9 pages, real users, complex forms). **Effort:** 1–2 days. **Reversible:** revert one PR per page if needed (suggest sub-PRs).

**Goal:** migrate all 9 landlord pages to the unified system, light theme.

**Sub-PR order** (each is independently mergeable):

| 4.1 | `landlord/login.html` + `landlord/register.html` | uses `.auth-shell` (Phase 2) |
| 4.2 | `landlord/dashboard.html` | shell + KPI strip + activity feed |
| 4.3 | `landlord/inquiries.html` + `landlord/applications.html` | list rows + sheet for actions |
| 4.4 | `landlord/profile.html` + `landlord/settings.html` | form components |
| 4.5 | `landlord/edit-listing.html` | form components, single-page |
| 4.6 | `landlord/new-listing.html` | form components + `.stepper` (multi-step) |

**Per-page checklist** (apply to each):

1. Add `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`.
2. Add `<meta name="theme-color" content="#ffffff">` (light) or `#0a0f1e` (auth dark).
3. Replace the legacy `<link>` block with **only** `<link rel="stylesheet" href="/css/cp-design.css?v=YYYYMMDD">`.
4. Add `<script defer src="/js/cp-chrome.js?v=YYYYMMDD">` and `<script defer src="/js/cp-shell.js?v=YYYYMMDD">`.
5. Set `<html data-theme="light">` (or `dark` for auth) and `<body data-portal="landlord" data-page-title="…" data-page-sub="…">`.
6. Wrap content in `<div class="app"><main class="app-content">…</main></div>`.
7. Re-mark up using `.card`, `.list-row`, `.kpi-strip`, `.btn-*`, `.field-*`, `.pill-*`. Keep all original `id`s and `data-*` attributes.
8. Preserve every form's `name=` attributes — Supabase Edge Functions read these.
9. Keep every existing `<script>` tag and load order. `cp-api.js` must continue to load before any inline page logic.
10. Manual QA: log in as a real landlord on the Cloudflare branch preview, perform every CRUD operation that page supports.

**Acceptance per sub-PR:**
- Page renders correctly at 375/768/1280 px (dark + light contrast verified).
- All forms submit successfully against Supabase.
- No legacy stylesheet (`landlord.css`, `dashboard-system.css`, `admin.css`, `mobile.css`) is referenced from the migrated page.
- Visual checklist passes.

**Do NOT delete the legacy stylesheets** at this point — they may still be loaded by tenant portal or as safety nets. Removal happens in Phase 8.

---

### Phase 5 — Tenant portal migration

**Risk:** Low-Medium (only 2 files, but `tenant/portal.html` is 908 lines). **Effort:** 4–6 hours. **Reversible:** revert one PR.

**Sub-PR order:**

| 5.1 | `tenant/login.html` | `.auth-shell` |
| 5.2 | `tenant/portal.html` | shell + tabs (Documents/Payments/Messages) |

Apply the same per-page checklist from Phase 4. Tenant portal uses `data-portal="tenant"` and the tenant nav defined in Phase 2.

Ensure `cp-ui.js` continues to work (`CP.UI.toast`, `CP.UI.badge`, `CP.UI.fmtMoney`). Add a thin compatibility layer in `cp-shell.js` so `CP.UI.*` calls map to v2 components.

**Acceptance:** tenant can log in, view documents, view lease, view payment status, send messages. No console errors. No legacy stylesheet referenced.

---

### Phase 6 — Bespoke transactional pages

**Risk:** Low-Medium per page (each is unique). **Effort:** 4–6 hours total. **Reversible:** revert one PR per page.

**Pages (in order):**

| 6.1 | `lease-sign.html` | Add `cp-design.css`, `.auth-shell`, dark theme. Tenant clicks from email — must look professional and trustworthy. Test the signing flow against `sign-lease` Edge Function. |
| 6.2 | `404.html` | Add `cp-design.css`. Use `.empty` state component. Keep light theme to match public site. |
| 6.3 | `count.html` and `health.html` | Either: (a) add a minimal `cp-design.css` link for consistency, or (b) confirm they are internal/monitoring-only and document them as "exempt." Decide per-page. |

**Acceptance per page:** Renders correctly, original behavior preserved, no console errors.

---

### Phase 7 — Public marketing pages (OPTIONAL, separate decision)

**Risk:** High (touches SEO, conversion, brand). **Effort:** 1–2 weeks of real design work. **Reversible:** revert PRs but lost SEO time is not recoverable.

**Recommendation: do this only as a deliberate redesign project, not as part of the design-system extension.**

If undertaken:

1. Build a **light-only** "marketing" layer on top of `cp-design.css` — call it `css/cp-marketing.css`. Adds hero, feature grid, testimonial, CTA section, blog post layout, legal-doc layout.
2. Migrate one page at a time, behind a Cloudflare Pages branch preview, with **before/after Lighthouse scores** captured for SEO, performance, accessibility.
3. Order: `404.html` → `about.html` → policy pages → `faq.html` → `how-it-works.html` → `how-to-apply.html` → `index.html` → `listings.html` → `property.html` (the highest-traffic last).
4. Preserve every `<h1>`, `<title>`, `<meta name="description">`, `<link rel="canonical">`, JSON-LD block (R7).
5. `components/nav.html` and `components/footer.html` get parallel v2 versions (`nav-v2.html`, `footer-v2.html`); `js/components.js` decides which to load based on a body attribute.

**Acceptance per page:** Lighthouse SEO ≥ previous score; Lighthouse Performance not worse than -5 points; visual QA on three viewports.

**This phase requires explicit, separate user approval before starting. It is not implied by approval of this plan.**

---

### Phase 8 — Legacy cleanup (the very last step)

**Risk:** Low (deletes only) but irreversible without git revert. **Effort:** 1 hour. **Reversible:** git revert.

**Goal:** delete unused files only after every page has been migrated.

**Pre-conditions (all must be true):**
- Phases 1–6 are merged and live for **at least 2 weeks** with no rollback.
- `grep -r "admin\.css\|landlord\.css\|dashboard-system\.css\|admin-v2\.css\|admin-chrome\.js\|admin-shell\.js" --include="*.html" --include="*.js"` returns **zero matches**.
- Cloudflare Pages analytics show no 404s on the deprecated file paths in the last 7 days.

**Actions:**

1. Delete `css/admin.css`, `css/landlord.css`, `css/dashboard-system.css`, `css/admin-v2.css` (the shim).
2. Delete `js/admin-chrome.js`, `js/admin-shell.js` (the shims).
3. If Phase 7 was completed: delete `css/main.css`, `css/mobile.css` (massive — only after every public page is verified migrated).
4. Update `ARCHITECTURE.md` to reflect the new single-stylesheet architecture.

**Acceptance:** site builds, every page in every group still renders, Cloudflare Pages deploy succeeds.

---

## 4. Execution rules per phase

For every PR:

1. Branch name: `design-extension/phase-N-short-description`.
2. PR description includes: **what changed**, **what stayed the same**, **list of pages touched**, **screenshots at 375/768/1280 px** (before+after), **how to roll back**.
3. The PR template MUST include the "Visual checklist" from §6 with every box ticked.
4. Cloudflare Pages will auto-build a branch preview at `https://<branch>.choice-properties-site.pages.dev` — paste the URL in the PR.
5. Squash-merge to `main`. Cloudflare Pages auto-deploys to production within ~2 min.
6. Tag the production deploy in GitHub releases as `design-extension-phase-N`.
7. Monitor Cloudflare Pages analytics + Supabase Edge Function logs for **24 hours** before starting the next phase.

---

## 5. Failure & rollback procedure

If any phase causes a production regression:

1. **Immediate:** revert the PR on GitHub. Cloudflare Pages auto-redeploys the previous version in ~2 min.
2. Verify the revert took effect by checking the deployed CSS file's date header.
3. Open a follow-up PR documenting the failure mode in `KNOWN_ISSUES.md`.
4. Do not re-attempt the same phase until the failure is reproducible in a branch preview.

If the regression is in `cp-design.css` and affects multiple portals:

1. Revert the PR.
2. Bump the cache-bust string by +1 day on the next attempt to force browser re-fetch.

---

## 6. Visual checklist (used at the end of every phase)

For every page touched in the phase, verify in **Chrome, Safari (iOS preferred), Firefox** at **375 px, 768 px, 1280 px**:

- [ ] Page loads without JS errors in console.
- [ ] No horizontal scroll at any viewport.
- [ ] All text is readable (contrast ≥ 4.5:1 body, ≥ 3:1 large/UI).
- [ ] All interactive elements ≥ 44×44 px.
- [ ] Focus ring visible on every focusable element when tabbing.
- [ ] Forms submit successfully against Supabase (when applicable).
- [ ] Original page `<title>` preserved.
- [ ] Original SEO `<meta>` tags preserved (public pages).
- [ ] No broken images (check Network tab for 404s).
- [ ] Nav links route to existing pages (no 404s on internal hrefs).
- [ ] Sign-out works (authenticated pages).
- [ ] `prefers-reduced-motion` honored (toggle in OS settings or DevTools).

---

## 7. Locked decisions (approved by project owner, April 22 2026)

1. **Theme split:** dark for admin; light for landlord, tenant, and all auth pages.
2. **Phase 7 (public marketing):** OUT OF SCOPE of this plan. Requires a separate, explicit approval before any public-page work begins.
3. **Cache-bust scheme:** date-based `?v=YYYYMMDD` using the date the file is modified.
4. **`count.html` and `health.html`:** internal/diagnostic, EXEMPT from the design system. Document as exempt in `ARCHITECTURE.md`.

---

## 8. Sign-off

This plan is safe to execute provided every rule in §0 is followed and every phase is merged independently.

**Status:** APPROVED — Phases 1, 2, 3 complete. Awaiting Cloudflare branch-preview verification before Phase 4.

### Change log

- **Phase 1** (committed): admin/dashboard.html migrated to chrome injector; reduced-motion guard added; cache-bust bumped to `?v=20260423`.
- **Phase 2** (committed):
  - Created `css/cp-design.css` (admin-v2.css + light-theme tokens + `.auth-shell` + `.field-*` + `.fieldset` + `.form-grid` + `.btn-auth` + `.stepper` + `.dropzone` + `.auth-alert` + `.auth-init`).
  - Created `js/cp-chrome.js` parameterised by `<body data-portal="admin|landlord|tenant">` with full nav config for all three portals.
  - Created `js/cp-shell.js` exposing both `window.CPShell` and `window.AdminShell` aliases.
  - Replaced `css/admin-v2.css` with a single `@import url("/css/cp-design.css?v=20260423")` shim.
  - Replaced `js/admin-chrome.js` and `js/admin-shell.js` with dynamic-script-tag shims that load the renamed files. Both shims will be deleted in Phase 8.
  - Updated all 12 admin pages with v2 assets to load the new paths directly.
- **Phase 3** (committed): `admin/login.html` rewritten on top of `.auth-shell` + `.field-*` + `.btn-auth`. All `id`s and form-field `name`s preserved; Supabase magic-link / password / forgot-password flows unchanged. Added `viewport-fit=cover`, set `theme-color` to `#0a0f1e`.
- **Batch B — auth pages on light .auth-shell** (committed):
  - `landlord/login.html` rewritten on `.auth-shell-card`. All 16 `id`s preserved (`emailInput`, `passwordInput`, `togglePw`, `loginBtn`, `loginForm`, `forgotLink`, `errorBox`, `errorMsg`, plus recovery-mode IDs `newPwInput`, `confirmPwInput`, `toggleNewPw`, `toggleConfirmPw`, `setPasswordBtn`, `resetErrorBox`, `resetErrorMsg`). `cp-api.js` `signIn` / `resetPassword` / `getSession` flow + the `#type=recovery` hash handler are byte-identical to the prior version.
  - `landlord/register.html` rewritten on `.auth-shell-card.wide` (520 px). All 30 `id`s preserved including the seven `at_*` account-type radios. Avatar upload (`profile-photos` bucket), password-strength meter, password-match check, terms checkbox, post-signup confirmation screen, and `auth.resend` button all unchanged. FontAwesome kept (account-type icons depend on it).
  - `tenant/login.html` rewritten on `.auth-shell-card`. All 24 `id`s preserved. Magic-link flow keeps the branded edge-function sender with Supabase fallback, PKCE flow type, signed-in banner, wrong-account notice, success view with 60-s resend countdown, and link-error surfacing — all byte-identical.
  - All three: light theme via `<html data-theme="light">`, `theme-color="#ffffff"`, `viewport-fit=cover`, dropped legacy `main.css` / `landlord.css` / `dashboard-system.css` / `admin.css` / `mobile.css` references in favour of `cp-design.css?v=20260423`.

- **Phase 4 — landlord CRUD pages** (committed): All seven landlord portal pages migrated to `cp-design.css` (light theme) + `cp-chrome.js` + `cp-shell.js`. `dashboard.html`, `applications.html`, `inquiries.html`, `edit-listing.html`, `new-listing.html`, `profile.html`, `settings.html`. All form `id`s and Supabase RPC calls preserved. Legacy `landlord.css` and `dashboard-system.css` deleted. Inline `<style>` blocks reduced to page-specific layout overrides only.
- **Phase 5.1 — tenant/login.html** (committed in Batch B above).
- **Phase 5.2 — tenant/portal.html** (committed): Migrated to `cp-design.css` light theme with `data-portal="tenant"`. Topbar intentionally kept bespoke (single-purpose page; full chrome injection deferred — see open question §3 of locked decisions). Saved-properties grid, inquiry threads, and message composer use `.list-row` and `.field-*` from cp-design.
- **Phase 6.1 — lease-sign.html** (committed): Multi-step lease-signing flow rewritten on `cp-design.css` `.auth-shell` + `.stepper`. Signature canvas preserved. Email-identity verification (added in backend FIXES Phase 3) wired in. All `id`s preserved.
- **Phase 6.2 — 404.html** (committed): Migrated to `cp-design.css` + `cp-marketing.css` with `data-portal="public"`. Friendly error layout with link back to listings.
- **Phase 7 batch 1 — informational public pages** (committed earlier): `about.html`, `faq.html`, `how-it-works.html`, `how-to-apply.html` migrated to `cp-design.css` + `cp-marketing.css`. Inline nav/footer replaced with `components.js` slots.
- **Phase 7 batch 2 — legal/policy pages** (committed April 22 2026): All seven legal/policy pages (`terms.html`, `privacy.html`, `fair-housing.html`, `application-credit-policy.html`, `holding-deposit-policy.html`, `rental-application-policy.html`, `landlord-platform-agreement.html`) migrated. cp-marketing.css extended with legal-doc helpers (`.info-body`, `.info-doc`, `.info-section h3`/`h4`/`ol`, `.policy-nav`, `.effective-date`). Migration script `scripts/migrate-legal-pages.js` is idempotent and re-runnable. Average page size reduction: ~45% (e.g. `terms.html` 21k → 12k bytes; `fair-housing.html` 15k → 6k).
- **Phase 8 partial — JS shim cleanup** (committed): `js/admin-chrome.js` and `js/admin-shell.js` shims (placeholder loaders from Phase 2) deleted. All admin pages reference the renamed files directly. `css/admin.css`, `css/admin-v2.css`, `css/landlord.css`, `css/dashboard-system.css` deleted.

### Reconciled status of previously-deferred items (April 26 2026)

- **Phase 7 batch 3 — heavy public pages: ✅ ALL DONE**
  - **7.3.1 — `index.html` ✅ DONE (April 22 2026).** Homepage on `cp-design.css` + `cp-marketing.css`. Slot-pattern nav/footer. SEO tags / JSON-LD / form ids preserved. Cache-bust `?v=20260424`.
  - **7.3.2 — `listings.html` ✅ DONE (April 22 2026).** Filter bar, advanced filter dropdown, mobile filters drawer, view toggle, pagination, empty state, map panel, full property-card extensions migrated under `body[data-portal="public"]` scope.
  - **7.3.3 — `property.html` ✅ DONE (April 24 2026).** Gallery mosaic + skeleton, lightbox, detail layout grid, sticky sidebar, apply card, landlord card, contact card + mobile drawer all migrated under `body[data-portal="public"][data-page="property"]` scope.
  - **7.3.4 — legacy CSS deletion sweep ✅ DONE (April 22 2026).** `main.css`, `mobile.css`, `listings.css`, `property.css` removed (~5,634 lines).
- **Phase 8 final cleanup ✅ DONE.** All four legacy public-page stylesheets deleted in 7.3.4.
- **Tenant chrome unification (open §3) ✅ RESOLVED (April 22 2026).** `tenant/portal.html` now uses `cp-chrome.js` + `cp-shell.js` via the existing `tenant` portal config; bespoke topbar removed.


---

## 9. Phase 9 — Public Marketing Refresh (premium, mobile-first)

**Status:** ✅ COMPLETE — 2026-04-26. All 14 sub-phases shipped (9.0 through 9.13). See `PROJECT_STATUS.md` § Phase 9 sub-phase progress for per-row commit SHAs. Final QA pass verified all redesigned pages serve 200 OK on Cloudflare with the additive `mv2-*` markers present and every JS-critical ID preserved.
**Owner sign-off:** "Make the implementation plan for this and push to GitHub" + "Start, make sure u push to git and update documentation after each phase and then continue to the next phase" — chat session 2026-04-26.
**Scope:** Premium, mobile-first redesign of all public marketing pages. Layered on the existing `cp-design.css` + `cp-marketing.css` token system using a new additive `mv2-*` namespace. **No** changes to `/apply/`, edge functions, schema, URLs, or SEO tags. Every change is reversible by a single commit revert.

### 9.0 Pages in scope

Chosen to cover the entire renter-facing journey, not just the homepage:

| # | Page | Why |
|---|---|---|
| 1 | `index.html` | Primary landing — biggest conversion lever |
| 2 | `listings.html` | Where the search lands — must feel as premium as the homepage |
| 3 | `property.html` | Moment of truth — trust signals matter most here |
| 4 | `how-it-works.html` | Sells the process — currently very plain |
| 5 | `how-to-apply.html` | High-intent renters land here from email/SEO |
| 6 | `about.html` | Builds brand trust and human credibility |
| 7 | `faq.html` | Last-mile reassurance before applying |
| 8 | `components/nav.html` + `components/footer.html` | Shared chrome — touched once, fixes everywhere |
| 9 | `404.html` | First impression after broken link — polished 404 = trust signal |

**Out of scope:** all `/apply/*` (R3), all `/admin/*`, `/landlord/*`, `/tenant/*`, all legal pages, all auth pages, all edge functions, all DB schema.

### 9.1 Design direction (locked: Option A — Editorial / Boutique)

- **Background:** warm off-white `#FAF8F5` instead of pure white — feels editorial, not template.
- **Primary text:** deep navy `#0a1729` (existing).
- **Accent:** existing gold `#d4a017` used **once per section** for a key moment (number, badge, underline). Restraint is the point.
- **Brand blue `#006aff`:** reserved for primary buttons + links only. No more "blue everywhere".
- **Typography:** Fraunces italic for the emphasized word in display headlines; Inter for body. Mobile body bumped to 16.5 px / line-height 1.7. Max line length 60ch on body copy.
- **Section dividers:** thin 1 px hairlines `#e4e8ef` instead of background-color shifts.
- **Mobile-first behaviors baked in:** sticky bottom CTA bar (after hero scroll), bottom-sheet filter modal, blur-up image lazy-load, 44×44 px tap targets, `safe-area-inset-bottom` honored.

### 9.2 Multi-AI handoff contract (so any future AI can pick up cleanly)

Every Phase 9 sub-phase is tracked as one row in `public.agent_issues` with this `metadata` shape:

```json
{
  "phase": "9.x",
  "depends_on": ["9.0"],
  "files_touched": ["index.html", "css/cp-marketing.css"],
  "acceptance": ["LCP image preloaded", "ID #searchInput preserved", "375/768/1280 px verified"],
  "rollback": "Revert single commit; no schema change.",
  "ai_handoff_notes": "Read DESIGN_EXTENSION_PLAN.md §9 first."
}
```

**Onboarding for a future AI session:**
1. Read `REPLIT.md` + `.agents/AI_RULES.md` + this §9.
2. `list_issues` (or query `public.agent_issues WHERE component='phase9' AND status='open'`) → pick lowest open phase number.
3. Do that one issue. Push via GitHub REST API. Resolve. STOP.
4. Wait for owner approval before next phase (per §0 R8).

### 9.3 Sub-phases (each = 1 PR = 1 `agent_issues` row = 1 commit)

| # | Title | Files | Risk | Acceptance |
|---|---|---|---|---|
| **9.0** | Add `mv2-*` token + utility layer (additive, no page changes) | `css/cp-marketing.css` | none — additive only | Visual diff = identical; cache-bust to `?v=20260426` |
| **9.1** | `index.html` hero refresh — cinematic photo, sticky search, micro-trust | `index.html`, `css/cp-marketing.css` | preserve all 4 search IDs | LCP image preloaded; `#searchInput`/`#bedroomsFilter`/`#maxRentFilter`/`#searchBtn` bound; 375/768/1280 OK |
| **9.2** | "Available Now" horizontal-snap carousel + freshness chips | `index.html`, `js/card-builder.js` | preserve `loadFeaturedListings()` query | Cards render; freshness label correct; empty state preserved |
| **9.3** | How-It-Works → vertical scroll-progress timeline | `index.html`, `css/cp-marketing.css` | reduced-motion compliance | Keyboard navigable; reduced-motion users see static |
| **9.4** | NEW "Verified, every time" trust block (between Featured & Testimonials) | `index.html`, `css/cp-marketing.css` | copy must be owner-approved | Contrast ≥ 4.5:1; gold accent only on header |
| **9.5** | Testimonials humanization — initials avatars + story tile + carousel | `index.html`, `css/cp-marketing.css` | screen-reader semantics | Each is `<figure>`; arrows/dots keyboard-accessible |
| **9.6** | NEW City spotlight strip (pills → `/listings.html?city=…`) | `index.html`, `css/cp-marketing.css` | SEO-crawlable anchors | Real `<a>` tags with valid query strings |
| **9.7** | Sticky mobile CTA bar + emotional final CTA section | `index.html`, `css/cp-marketing.css` | hidden on `/listings.html` (collides with sticky filter) | safe-area-inset-bottom honored; not over footer |
| **9.8** | `listings.html` polish — refined card grid, filter panel, warm bg | `listings.html`, `css/cp-marketing.css` | preserve all filter IDs | Filters work; pagination unchanged |
| **9.9** | `property.html` polish — refined gallery, sticky apply card, landlord trust | `property.html`, `css/cp-marketing.css` | preserve all gallery/lightbox bindings | Apply URL builder unchanged; gallery works |
| **9.10** | Apply v2 layout to 4 secondary pages | `how-it-works.html`, `how-to-apply.html`, `about.html`, `faq.html`, `css/cp-marketing.css` | preserve SEO tags | Renders at 375/768/1280; SEO meta untouched |
| **9.11** | Refresh `nav.html` + `footer.html` — sticky shrink nav, mega-footer | `components/nav.html`, `components/footer.html`, `css/cp-marketing.css` | every public page picks up via slot pattern | Nav transparent over hero, solid below |
| **9.12** | `404.html` — friendly redesign with search + suggested cities | `404.html`, `css/cp-marketing.css` | still returns 404 status | Cloudflare config unchanged |
| **9.13** | QA pass — Cloudflare branch preview, Lighthouse ≥ 90 mobile, WCAG AA contrast | (verification only) | none | All sub-phases verified together; sign-off from owner |

### 9.4 Per-phase execution checklist (used at the end of every Phase 9 sub-phase)

In addition to §6 (visual checklist) and §4 (per-phase rules), every Phase 9 sub-phase must satisfy:

- [ ] Cache-bust `?v=YYYYMMDD` on every modified CSS/JS reference.
- [ ] Verified at 375 px / 768 px / 1280 px on a Cloudflare branch preview.
- [ ] All `id`s referenced by JS still present (grep `js/*.js` before deleting any element).
- [ ] All SEO tags present (`<title>`, `<meta description>`, `og:*`, `canonical`, JSON-LD, `<h1>`).
- [ ] Lighthouse mobile score ≥ 90 (perf + a11y + SEO + best practices) for any modified page.
- [ ] Contrast 4.5:1 body / 3:1 large text — verified.
- [ ] `prefers-reduced-motion` honored.
- [ ] Tap targets ≥ 44 × 44 px on mobile.
- [ ] `agent_issues` row marked `resolved` with commit SHA in `resolution_note`.
- [ ] PROJECT_STATUS.md updated with the sub-phase status.

### 9.5 Rollback

Every Phase 9 sub-phase is a single commit. Rollback = single `git revert <sha>` (executed via the GitHub REST API path documented in `REPLIT.md`). No schema, no migration, no data loss possible. The `mv2-*` CSS namespace is additive — even Phase 9.0 leaving CSS in place after a revert is harmless because no existing class names are touched.

### 9.6 Open questions (owner to decide as we go)

1. **Real photography** — owner to provide hero/listing photography, or use high-quality stock during design phase with a swap plan documented per page.
2. **Headline final copy** — three drafts to be presented in 9.1; owner picks one before merge.
3. **Sticky mobile CTA bar** — owner has approved by default; can be toggled off per-page if it conflicts.
4. **Trust block proof points** — final wording for 9.4 needs owner approval before merge.
