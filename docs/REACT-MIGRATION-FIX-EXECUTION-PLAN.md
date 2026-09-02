# React Migration Fix Execution Plan

## Purpose

This is the working handoff document for restoring the migrated Choice
Properties public site. It is intentionally written so another agent can
continue after an interruption without relying on chat history.

The repair is incremental. Each phase has an explicit exit checkpoint. Do not
advance a phase when its exit criteria are not met. Keep the existing Cloudflare
Pages, Supabase, storage, authentication, Edge Function, admin, landlord,
tenant, lease, scraper, and extension architecture unless a later checkpoint
proves an equivalent replacement is safe.

## Operating rules

1. Read this file, `AGENTS.md`, `docs/PROJECT_GUIDE.md`, and the current git
   status before changing code.
2. Work on one phase at a time.
3. After each coherent batch, run the phase verification and record the result
   below. Never record a checkpoint as complete from inspection alone.
4. Preserve the legacy implementation until its React replacement passes the
   relevant comparison and failure-state checks.
5. Do not weaken CSRF, idempotency, consent, validation, server-authoritative
   pricing, or public/private data boundaries to make migration easier.
6. Use the existing contracts in `js/cp-api.js`, `js/listings.js`,
   `js/property.js`, and the Supabase Edge Functions as the compatibility
   baseline.
7. If blocked, record the exact command, error, attempted alternatives, and
   the next safe action. Do not silently skip the blocked behavior.
8. Keep changes small enough to review and revert. Run `git diff --check`
   before handing off.

## Current status

**Last updated:** 2026-09-02

**Current phase:** Phase 2 — safe routing and deployment handoff

**Current next action:** Map every public, application, protected, and blocked
route against the built `dist/` tree. Fix the `/apply/` entry mismatch without
removing the legacy fallback, then verify deep links in a built preview.

**Completed in this repair session:**

- Changed the Replit runtime request from Node 18 to Node 20.
- Declared Node 20 as the minimum runtime in the root and frontend package
  manifests and lockfile metadata.
- Changed the nested frontend build install from `npm install` to `npm ci` so
  the checked-in `frontend/package-lock.json` is authoritative.
- Created this resumable execution plan.
- Made build-time config, cache-busting, CSP nonce, nav/footer, and listing
  snapshot processing target `dist/` instead of rewriting checked-in source
  HTML.
- Made the root `lint` script run the frontend linter.

**Not completed yet:**

- No routing or application behavior has been changed yet.
- No routing, application, listings, property detail, or visual parity work
  should be considered complete yet.

## Phase order

### Phase 1 — Establish a reproducible build baseline

**Goal:** Produce a clean frontend build and lint result from the checked-in
lockfile under Node 20.

**Actions:**

- Reload the workspace runtime after the `.replit` module change.
- Confirm `node --version` is 20.x or newer.
- Run the root build, which uses `npm ci` for the frontend.
- Run the frontend lint command.
- Inspect `frontend/dist/` output and record the result.
- If the native Tailwind/Oxlint packages fail, resolve installation/runtime
  compatibility before touching feature code.

**Verification:**

```bash
node --version
npm --version
npm run build
cd frontend && npm run lint
git diff --check
```

**Exit criteria:**

- Node reports 20.x or newer.
- `npm run build` exits 0.
- frontend lint exits 0.
- `dist/index.html` and referenced assets exist.
- No build step relies on an unlocked nested install.

**Checkpoint result — 2026-09-02: PASSED**

- Runtime: Node `v20.20.0`, npm `10.8.2`.
- `npm run build`: passed, including frontend compile, Vite output, config
  generation, static copy, HTML processing, and React merge.
- `npm run lint`: passed with three existing non-blocking Oxlint warnings in
  `useSavedProperties.ts` and `ApplyPage.tsx`.
- Clean `dist/` output contains the React entry and hashed JS/CSS assets.
- Clean-build source immutability check: passed; no source HTML files changed.
- `git diff --check`: passed.

**Evidence to record:** exact versions, commands, exit status, and any
remaining warnings in the Phase 1 log below.

### Phase 2 — Make routing and the deployment handoff safe

**Goal:** Every public React route, application alias, legacy protected route,
and static asset resolves to the intended document in a built preview.

**Actions:**

- Define the route matrix before changing redirects.
- Choose `/apply/` as the canonical React application URL.
- Make React emit or receive a real `/apply/` entry without deleting the
  legacy fallback prematurely.
- Update React CTAs, resume links, redirects, and fallback links to the
  canonical route.
- Preserve compatibility aliases such as `/apply/index.html`, `/apply.html`,
  and historical dashboard links.
- Prevent the SPA catch-all from swallowing admin, landlord, tenant, auth,
  extension, function, source, and blocked documentation paths.
- Verify generated config, asset paths, headers, CSP middleware, and redirects
  together.

**Verification:**

- Build from a clean install.
- Serve `dist/` with a static server or Cloudflare Pages preview.
- Check `/`, `/listings`, `/property.html?id=<known-id>`, `/apply/`,
  `/apply.html`, `/apply/index.html`, `/admin/login.html`,
  `/landlord/login.html`, `/tenant/login.html`, `/auth/callback.html`, and
  representative blocked paths.
- Confirm the returned document and browser console behavior for each.

**Exit criteria:** route aliases resolve intentionally, protected legacy pages
remain legacy, application CTAs do not target a deleted directory, and no
protected route is captured by the public SPA.

### Phase 3 — Restore shared data and auth contracts

**Goal:** React and legacy public flows use the same records, query semantics,
availability rules, public-safe fields, auth state, and saved-property behavior.

**Actions:**

- Inventory the established `CP.Properties` and auth contracts before writing a
  second query implementation.
- Build a typed adapter around the existing public listing/detail behavior.
- Replace fixed-batch browser filtering with server-side query state.
- Expand property and photo types to cover legacy card/detail fields.
- Add an auth/session provider with subscription, loading, and error states.
- Reconcile anonymous local saves with authenticated saves without loss.
- Turn Supabase failures into visible retryable states.

**Exit criteria:** the same query and property ID produce matching records,
ordering, photos, availability, and public-safe fields in legacy and React
flows.

### Phase 4 — Restore public UI and visual parity

**Goal:** React preserves the old Choice Properties information hierarchy,
brand, interaction states, and responsive behavior.

**Actions:**

- Extract tokens and breakpoints from `css/cp-design.css`; do not invent a
  second brand system.
- Rebuild the shared navigation, mobile drawer, focus behavior, footer, route
  highlighting, theme persistence, and compatibility links.
- Rebuild listings search, filters, sort, pagination, map, cards, loading,
  empty, retry, and saved states.
- Rebuild property gallery/lightbox, facts, map fallback, landlord card,
  inquiry flow, similar listings, unavailable states, and application CTAs.
- Classify every public informational/legal page as React, legacy-compatible,
  or intentionally protected. Do not let the catch-all silently replace
  complete policy content.
- Preserve the project rule that smoking information is not shown on property
  pages.

**Exit criteria:** representative mobile, tablet, and desktop comparisons
match the old content hierarchy and all important interaction states.

### Phase 5 — Port the application flow safely

**Goal:** React applications are complete, server-authoritative, retryable, and
never report persistence when the server rejected the request.

**Actions:**

- Treat legacy HTML `name` attributes and
  `supabase/functions/receive-application/index.ts` as the canonical contract.
- Type every persisted field, including co-applicant, supervisor, references,
  emergency relationship, vehicle, payment/contact preferences, disclosures,
  and consent.
- Port CSRF nonce, idempotency UUID, duplicate-submit protection, attachment
  behavior, validation, progress, auto-save, draft/resume, and error states.
- Display only server-returned `appId` and `portal_login_url`.
- Keep the legacy application entry as a rollback path until React passes the
  contract checks.

**Exit criteria:** valid submissions create exactly one correct record;
invalid, failed, and duplicate submissions do not show false success; drafts,
attachments, consents, and server response links are preserved.

### Phase 6 — SEO, accessibility, and production hardening

**Goal:** The migrated public surface is usable, indexable, secure, and free
of critical browser errors.

**Actions:**

- Add route-specific title, description, canonical, Open Graph, Twitter, and
  structured metadata.
- Verify keyboard navigation, focus management, labels, error announcements,
  dialogs, menus, reduced motion, and responsive layouts.
- Verify ImageKit transforms, lazy loading, alt text, and fallback images.
- Review CSP, CORS, Supabase RLS assumptions, and public/private boundaries.
- Verify generated config and caching behavior do not leak or become stale.

**Exit criteria:** supported public routes have no critical console errors,
keyboard/accessibility regressions, or private data leaks.

### Phase 7 — Incremental cutover and rollback readiness

**Goal:** Move public routes to React only after evidence exists, with a tested
rollback path.

**Actions:**

- Run the full browser matrix against a built preview.
- Compare legacy and React using the same property IDs and application cases.
- Cut over one public surface at a time.
- Monitor client errors and Edge Function responses.
- Keep a documented rollback switch until stable.
- Update `docs/PROJECT_GUIDE.md` so it matches the final architecture.

**Exit criteria:** all in-scope public routes use the verified React surface,
protected legacy portals still work, applications are trustworthy, and
rollback is documented.

## Progress log

### Phase 1 log

- **2026-09-02 — Started:** baseline was blocked under Node 18; `.replit`
  requested Node 18 while current frontend dependencies require Node 20+.
- **2026-09-02 — Changes made:** runtime request moved to Node 20; package
  engine constraints aligned; frontend build install made lockfile-driven.
- **2026-09-02 — Passed:** Node `v20.20.0` / npm `10.8.2`; clean `npm run
  build` and root `npm run lint` succeeded. The build produced React assets,
  copied legacy protected pages, generated runtime config, and completed the
  React merge. Lint reports three existing non-blocking warnings in
  `useSavedProperties.ts` and `ApplyPage.tsx`.
- **2026-09-02 — Passed:** source immutability was checked after each stage
  (frontend build, static copy, config generation, and React merge); no source
  HTML files changed. `git diff --check` also passed.
- **Next evidence required:** runtime reload followed by clean build and lint.

### Phase 2 log

- Not started.

### Phase 3 log

- Not started.

### Phase 4 log

- Not started.

### Phase 5 log

- Not started.

### Phase 6 log

- Not started.

### Phase 7 log

- Not started.

## Interruption and continuation protocol

When resuming:

1. Read this file from top to bottom.
2. Run `git status --short` and `git diff --check`.
3. Find the first phase whose exit criteria are not satisfied.
4. Read only the files named by that phase and inspect the last progress-log
   entry.
5. Run the “current next action” before making speculative edits.
6. Update the current phase, next action, and evidence after verification.
7. If a change is unsafe or broad, leave the legacy path intact and record the
   blocker instead of deleting it.

The plan is not complete until every phase has an evidence-backed exit
criterion. A successful TypeScript compile alone is never sufficient.
