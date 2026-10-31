# AI Handoff — Choice Properties Marketplace Redesign

Read this file, then `docs/MARKETPLACE_REDESIGN_PLAN.md`, `docs/REDESIGN_PROGRESS.md`, `AGENTS.md`, `AI_AGENT_GUIDE.md`, and applicable `.agents/` instructions before working.

## User goal
Redesign the existing Choice Properties public rental marketplace as a unified, high-quality experience benchmarked against Zillow across homepage, search results, property cards, property details, galleries, valid video/3D tours, and supported communities/floor plans/units. Do not copy Zillow branding/assets/exact UI. Work phase by phase; document every phase and push it to GitHub.

## Preserve
Do not casually rewrite or break application/submission/payment flows, admin, tenant/landlord dashboards, auth, Supabase integrations, property importer/browser extension, scraper/publishing pipeline, or policy pages. Do not change database schema/data or ingestion behavior without explicit approval.

## Critical repository rules
- Follow root instructions and `.agents/` rules.
- Existing HTML comments specify edit → GitHub push → Cloudflare Pages and prohibit `npm install`, starting a server, creating `config.js`, local DB connections/migrations, and runtime/workflow/environment configuration.
- Never reveal or commit secrets.
- Preserve authentic addresses and original photo order; first source image remains the primary image.
- Never invent listing facts/media.
- Verify actual build/deploy behavior before introducing React/TypeScript or changing tooling.
- Never claim a test, push, or deployment succeeded without evidence.

## Known architecture
- Public pages: `index.html`, `listings.html`, `property.html`.
- Homepage loads multiple CSS layers: `cp-design.css`, `cp-marketing.css`, `premium-design.css`, `home-experience.css`.
- `package.json` contains React/Vite dependencies, but `scripts/copy-static-to-dist.js` copies static HTML/assets. Verify actual production build behavior.
- Cloudflare Pages is documented as the host. Cloudflare control-plane access is unverified.
- GitHub repository: `choice121/Choice`.
- GitHub write access was confirmed after the user completed setup: repository listing showed admin/push permissions and branch `docs/marketplace-redesign-plan` was created successfully.

## Current state
The implementation plan, progress tracker, and AI handoff documents are being committed to `docs/` on branch `docs/marketplace-redesign-plan`. No redesign implementation code has been changed. Confirm the files and commits on GitHub before continuing.

## Next actions
1. Finish committing `docs/MARKETPLACE_REDESIGN_PLAN.md`, `docs/REDESIGN_PROGRESS.md`, and `docs/AI_HANDOFF.md` to the documentation branch.
2. Verify file contents and commit SHAs; open a pull request to `main` rather than bypassing branch protections.
3. Continue Phase 0 discovery in the master plan.
4. Update progress docs when build/deployment facts are verified.
5. Only then start Phase 1. After every phase, make scoped changes, validate, inspect diffs, update docs, commit/push, and verify deployment where possible.
6. If blocked, record evidence, the exact blocker, next action, and required access/approval. Do not silently skip the phase or begin unrelated work.
