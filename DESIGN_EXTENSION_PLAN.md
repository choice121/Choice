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
| `css/listings.css` | 1,052 | `index.html`, `listings.html`, `landlord/profile.html` | Frozen — used by public listings UI |
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

### Deferred to later phases

- `lease-sign.html` — bespoke (signature canvas, multi-step). Will be done in Phase 6.
- Landlord CRUD pages (`dashboard`, `applications`, `inquiries`, `edit-listing`, `new-listing`, `profile`, `settings`) — Phase 4, one sub-PR at a time.
- `tenant/portal.html` — Phase 5.
