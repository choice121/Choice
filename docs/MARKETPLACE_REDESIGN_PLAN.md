# Choice Properties Marketplace Redesign — Implementation Plan

**Status:** In progress — Phase 1 design-token foundation  
**Last updated:** 2026-10-30  
**Repository:** `choice121/Choice`

## Mission
Unify the existing Choice Properties public website into a polished, responsive rental marketplace benchmarked against leading property-search experiences such as Zillow, without copying proprietary branding, assets, or exact UI. This is an incremental redesign of a live system, not a greenfield rewrite. Every phase must be documented and committed so another AI/developer can resume without chat history.

## Non-negotiable rules
1. Before code changes, read `AGENTS.md`, `AI_AGENT_GUIDE.md`, this plan, `docs/REDESIGN_PROGRESS.md`, `docs/AI_HANDOFF.md`, and applicable `.agents/` instructions.
2. Existing project instructions describe the deploy path as edit → GitHub push → Cloudflare Pages. Do not change hosting/deployment architecture without explicit approval.
3. Existing HTML comments prohibit `npm install`, starting a server, creating `config.js`, connecting to a local database, running migrations, or configuring workflows/runtimes/environments. Follow these restrictions unless the owner changes them.
4. Never reveal or commit credentials, API keys, service-role keys, tokens, passwords, or private configuration values.
5. Preserve existing application/submission/payment flows, admin, tenant/landlord dashboards, auth, Supabase integrations, property importer/browser extension, scraper/publishing pipeline, and policy pages. Do not change them for visual polish unless essential and separately authorized.
6. Preserve truthful property data, authentic source addresses, and original photo order. The first source photo stays the hero/primary image. Never invent facts, availability, photos, amenities, floor plans, or tour URLs.
7. Do not assume a stack migration is necessary. Static HTML/CSS/JS pages coexist with React/Vite dependencies. Verify the actual production build before choosing architecture/tooling.
8. Work one phase at a time. Validate within permitted constraints, update docs, commit/push, and report exact status. Never claim a test, push, or deployment succeeded without evidence.
9. Keep changes scoped. No unrelated cleanup, dependency upgrades, scraping changes, or broad refactors.
10. Stop for owner approval before schema migrations, destructive data changes, paid services, deployment-setting changes, new credential access, or material workflow changes.

## Product goals
- One consistent design system across homepage, search results, cards, property detail, and shared public components.
- Mobile-first responsive layouts for mobile, tablet, and desktop.
- Clear search, useful filters, accurate result state, consistent typography/spacing/colors/buttons/controls, accessible focus/contrast/labels/tap targets.
- Property cards show only real supported facts; optimize image loading and avoid unnecessary media payloads.
- Property detail pages have a responsive gallery and touch/keyboard navigation. Video/3D tours appear only when valid URLs exist and should load lazily. Missing media should not leave empty or broken sections.
- Multi-unit presentation should follow the actual data model: community/property → building (if available) → floor plan → unit. Standalone houses should not show irrelevant community UI.
- Preserve existing application links, property IDs, canonical URLs, metadata, redirects, and query-parameter behavior.
- Add useful loading, empty, image-failure, and recoverable-error states.

## Phase 0 — Repository discovery (must precede visual work)
- [x] Read root instructions; the referenced `.agents/instructions.md` is absent on `main` (404/no `.agents/` directory), so record this as an instruction-path discrepancy.
- [ ] Verify Cloudflare Pages dashboard build command, output directory, production branch, and auto-deploy behavior (repository-side build script inspected; dashboard values unavailable).
- [x] Trace `package.json`, `generate-config.js`, `scripts/copy-static-to-dist.js`, and `vite.config.ts` without running prohibited commands.
- [x] Map `index.html`, `listings.html`, `property.html`, shared public CSS/JavaScript, and style dependencies.
- [x] Trace listing data, photo arrays, video/3D URLs, floor plans, communities, buildings, and units.
- [x] Inspect Supabase public schema read-only; no writes/migrations.
- [x] Record critical flows: search → results → detail → application; auth; admin; tenant/landlord portals; importer.
- [x] Record permitted validation methods and limitations.
**Acceptance:** repository-side architecture, data model, and safe strategy documented; no production behavior changed. Cloudflare dashboard settings remain a release prerequisite.

**Phase 0 findings:** See `docs/REDESIGN_PROGRESS.md` and `docs/AI_HANDOFF.md` for the static build path, public page/data-flow map, missing `.agents/instructions.md` discrepancy, read-only Supabase schema summary, and the separate critical RLS advisory for `public.description_enrichment_audit`. No remediation was applied.

## Phase 1 — Design system and shared public UI
- [x] Audit existing shared public CSS layers and token blocks.
- [x] Add an additive shared token vocabulary in `css/cp-marketing.css` for type scale, line-height, control heights, focus-ring, content widths, and motion durations.
- [ ] Audit shared nav, buttons, form controls, badges, cards, and focus styles for duplicate/conflicting rules.
- [ ] Adopt the new tokens in selected shared public components where changes are safe and impact is understood.
- [ ] Review mobile/desktop states and document validation limitations.

**Acceptance:** documented and used shared tokens; mobile/desktop states considered; no routes or controls broken; no unjustified framework migration. Cloudflare deployment settings must be confirmed before release verification.

## Phase 2 — Homepage and search entry
Improve homepage hierarchy and search entry using supported existing functionality. Preserve listing data, links, query parameters, metadata, and redirects.
**Acceptance:** search works; property links resolve; responsive layout reviewed; results documented.

## Phase 3 — Search results and cards
Standardize card hierarchy/image treatment; review filters, sorting, URL state, pagination/loading, reset, and result counts; add suitable skeleton/empty/error states; avoid expensive per-card media loading.
**Acceptance:** filters retain meaning; only supported facts appear; listing-to-detail navigation works on mobile and desktop.

## Phase 4 — Property detail and rich media
Improve gallery, navigation, image error states, facts/description hierarchy, and valid video/3D display. Preserve original photo order and existing application behavior.
**Acceptance:** no broken media sections; original first photo remains primary; existing IDs and application path work; no invented facts.

## Phase 5 — Communities, buildings, floor plans, units
Verify actual schema/API fields and relationships before UI work. Show only real available floor plans, units, prices, facts, images, and tour links. Document data gaps; obtain approval before schema/ingestion changes.
**Acceptance:** standalone homes remain clean; unit links use real IDs; no unapproved migration.

## Phase 6 — Cross-page integration, accessibility, performance
Review keyboard focus, contrast, labels, alt text, reduced motion, image loading, layout shifts, fonts/icons, video/3D loading, canonical URLs, metadata, redirects, and deep links. Check protected flows for unintended effects.
**Acceptance:** regression results and untestable items are documented; property facts/photo order remain intact.

## Phase 7 — Regression and release handoff
Run permitted checks; inspect diffs; verify commit/deployment where access permits; update statuses, issues, and next actions.
**Acceptance:** docs match shipped code; limitations are explicit; deployment claimed only when verified.

## Mandatory per-phase delivery protocol
1. Read current progress/handoff docs and inspect current branch/commit.
2. State the phase goal and expected files.
3. Make scoped changes only.
4. Run permitted validation and record exact outcomes.
5. Review diff for secrets, accidental changes, scope creep, and regressions.
6. Update `docs/REDESIGN_PROGRESS.md`: status, completed items, files changed/reasons, checks/results, commit SHA/link, deployment status, known issues, next exact action.
7. Update this plan if verified facts or scope change.
8. Commit and push each phase. Prefer branch/PR if permissions allow and respect branch protection. If writes are blocked, do not claim a push.
9. Verify deployment before saying it is live.
10. Do not advance until acceptance criteria pass or owner explicitly accepts a documented blocker.

## Required documents
- `docs/MARKETPLACE_REDESIGN_PLAN.md`: goals, invariants, phases, acceptance criteria.
- `docs/REDESIGN_PROGRESS.md`: current status, files, validation, commits, deployment, issues, next action.
- `docs/AI_HANDOFF.md`: context and instructions for the next AI/developer.

## Known baseline facts
- Public pages identified: `index.html`, `listings.html`, `property.html`.
- The homepage loads several style layers, including `cp-design.css`, `cp-marketing.css`, `premium-design.css`, and `home-experience.css`.
- React/Vite dependencies exist, but `scripts/copy-static-to-dist.js` copies static pages/assets; verify actual build behavior before choosing a stack.
- Cloudflare Pages is the documented host; actual control-plane access is not confirmed.
- GitHub write access was confirmed on 2026-10-30. Documentation PR #56 is open and unmerged. Phase 1 implementation is being worked on separately in `phase-1/design-system`.
- Do not put credentials in project docs.

## Definition of done
Homepage, results/cards, property details, and supported media/multi-unit experiences share a coherent responsive system; existing application/account systems remain intact; validation is recorded; every phase has a GitHub commit and updated docs; another developer can resume from the handoff/progress docs without this conversation.
