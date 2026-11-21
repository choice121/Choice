# Choice Properties — AI Handoff, Rules & Phase Progress Tracker

> **CRITICAL NOTICE FOR EVERY AI AGENT WORKING IN THIS REPOSITORY**  
> Read this file **first** in every session before modifying any file, database object, Edge Function, or deployment.  
> **CLEANUP RULE:** This entire directory (`docs/platform-evolution/`) **must be completely deleted in Phase 10** after all 10 phases pass live & advanced end-to-end verification. Permanent operational docs (`docs/MANUAL_BROWSER_EXTENSIONS_GUIDE.md` and `docs/APIFY_AUTOMATED_SCRAPING_GUIDE.md`) remain in `docs/`.

---

## 1. Current Execution Pointer

| Field | Value |
|---|---|
| **Active / Next Available Phase** | **`PHASE 2`** — Four-Digit Batch Identities, Disposable Folders & Legacy Batch Compatibility |
| **Current Baseline Commit (`main`)** | `edfdb99` (`choice121/Choice`) |
| **Overall Plan Progress** | `1 / 10 Phases Completed` (`READY FOR USER APPROVAL TO START PHASE 2`) |
| **Last Updated** | `2026-11-21` |

---

## 2. Mandatory Operating Rules for Every AI Agent

Every AI agent working on this evolution plan **must strictly follow** all rules below without exception:

### Rule A — Single Phase Per Session & Automatic Next-Phase Selection
1. **Execute ONE Phase Only**: Implement only the single current unblocked phase (start with the phase listed in **Current Execution Pointer** above). Do not jump ahead or bundle multiple phases together.
2. **Never Ask the User Which Phase to Do Next**: Once you complete and verify your phase, automatically determine the **next unblocked `READY` phase** from the Phase Status Matrix below. Ask the user strictly for confirmation to proceed with that exact next phase (e.g., *"Phase 1 is complete and verified live. Should I proceed with Phase 2 (Four-Digit Batch Identities & Disposable Folders)?"*).
3. **Final Completion Behavior**: When **Phase 10** is complete (including deletion of `docs/platform-evolution/`), do **not** ask to start another phase. Clearly report that **all 10 phases are finished, deployed, and verified**, and invite the user to test everything live.

### Rule B — Coexistence of Manual Browser Extensions & Apify Scraping (Non-Negotiable)
1. **Never remove, replace, or break** the Chrome Desktop Extension (`chrome-extension/`) or Orion Mobile Extension (`.pages-orion/`).
2. Both **Apify automated scraping** AND **manual browser extensions** must work side by side at all times so the operator can choose either method at any time.
3. Whenever modifying any file inside `src/extractors/`, `chrome-extension/`, or `.pages-orion/`, you **must** run:
   ```bash
   node scripts/sync-and-bump-extension.mjs
   node .pages-orion/test-extractors.js
   node scripts/validate-extension.mjs
   ```
   and update `docs/EXTENSION_CHANGELOG.md` and `docs/MANUAL_BROWSER_EXTENSIONS_GUIDE.md`.

### Rule C — Legacy Data & Existing Batch ID Preservation
1. **Keep all 18 existing `PB-2026...` batch IDs untouched** in `public.publishing_batches`, `public.publishing_batch_properties`, and `pipeline.pipeline_recovery_archive`.
2. **Use 4-digit numeric IDs (`^[0-9]{4}$`, e.g., `4821`) strictly for new batches**. Visually and structurally distinguish `"Batch #4821"` from the existing renter `"4-digit ID"` in Customer Memory (`admin/dashboard.html`, `lib/customer-store.js`).
3. Preserve all `2,998+` existing properties, `64,423+` property photos, `134+` active `property_shares`, public browsing, `/rent/<state>/<city>/<slug>` SSR, `#share={token}`, application submissions, and lease signing workflows.

### Rule D — Stack & Repository Guardrails
1. **Cloudflare-Only Static + Edge Guard (`.github/workflows/cloudflare-only.yml`)**: **NEVER** add backend Node packages (`express`, `fastify`, `koa`, `pg`, `postgres`, `mysql`, `sqlite`, `prisma`, `drizzle-orm`, etc.) or `.replit`/`server.js` artifacts to `package.json` or the repo. All new backend logic must run on **Supabase Edge Functions (Deno)**, **PostgreSQL RPCs / `pg_cron`**, and **Cloudflare Pages Functions** (`functions/`).
2. **Never commit `config.js` or raw credentials/tokens** into git (`.env` / `config.js` remain gitignored; Cloudflare builds generate `config.js` via `generate-config.js`).

### Rule E — Mandatory End-to-End Deploy & Live Verification Before Marking `DONE`
You may **not** mark any phase `DONE` until ALL 5 steps below pass cleanly:
1. **Local Checks Pass**: Run `npm run build`, `deno cache --no-check` on modified Edge Functions, and relevant test scripts cleanly.
2. **Supabase Applied & Verified**: Apply new SQL migrations (and record them in `_migration_history` if applied directly or verify `.github/workflows/supabase-deploy.yml` applied them cleanly) and deploy updated/new Edge Functions to project `tlfmwetmhthpyrytrcfo`.
3. **GitHub Pushed (`main`)**: Commit all phase code + migration + test files cleanly to `choice121/Choice` branch `main` and confirm `.github/workflows/cloudflare-only.yml` and `.github/workflows/supabase-deploy.yml` pass with zero errors.
4. **Cloudflare Pages Live Verified**: Confirm `choice-properties-site` (`https://choice-properties-site.pages.dev`) production deployment succeeded for that commit.
5. **Live Functional Verification**: Execute concrete live verification checks against the live Cloudflare Pages site, live Supabase DB/RPCs, and live Edge Functions matching every Acceptance Criterion of that phase.
6. **Update This Tracker & Push**: Change the phase's status below to `DONE`, fill in the Commit SHA / Migration / Edge Function Versions / Verification Summary, advance the **Current Execution Pointer** to the next `READY` phase, and **push the updated tracker commit to `main`**.

---

## 3. Environment & Deployment Topology Reference

| Platform | Target | Build / Deploy Mechanism |
|---|---|---|
| **GitHub Repo** | `choice121/Choice` (`main` branch) | Source of truth; push triggers GitHub Actions & Cloudflare Pages |
| **Supabase Project** | `tlfmwetmhthpyrytrcfo` (`us-east-1`, Postgres `17.6.1.104`) | `supabase/migrations/*.sql` + `supabase/functions/*/index.ts` via `.github/workflows/supabase-deploy.yml` or Supabase API/CLI |
| **Cloudflare Pages** | `choice-properties-site` (`https://choice-properties-site.pages.dev`) | Production branch `main`, Build command: `npm run build`, Output dir: `dist`, Functions dir: `functions/` |

---

## 4. Phase Status Matrix (Source of Truth)

| Phase | Title | Dependencies | Status | Next Action / Notes | Commit SHA |
|---|---|---|---|---|---|
| **Phase 1** | Platform Sync, Canonical Edge Function Recovery & Baseline Stabilization | None | `DONE` | Verified live across GitHub, Supabase & Cloudflare Pages (`v34.0.1` + cron + config parity) | `d1de6ce`, `edfdb99` |
| **Phase 2** | Four-Digit Batch Identities, Disposable Folders & Legacy Batch Compatibility | Phase 1 | `READY` | **NEXT AVAILABLE PHASE** — Awaiting approval to execute | — |
| **Phase 3** | Permanent Private-Placement Registry & Batch Link Retrieval | Phase 2 | `BLOCKED` | Unlocks after Phase 2 is `DONE` | — |
| **Phase 4** | Centralized Rules & Policies Engine + Versioned Policy Admin | Phase 1, Phase 2 | `BLOCKED` | Unlocks after Phase 1 & 2 are `DONE` | — |
| **Phase 5** | Apify Default Scraping Engine & Dual-Channel Worker Integration | Phase 2, Phase 4 | `BLOCKED` | Unlocks after Phase 2 & 4 are `DONE` | — |
| **Phase 6** | Automated Property Eligibility, Source Profile & Image Validation Engine | Phase 4, Phase 5 | `BLOCKED` | Unlocks after Phase 4 & 5 are `DONE` | — |
| **Phase 7** | Centralized Description Enrichment & Task-Specific Pricing Engines | Phase 4, Phase 6 | `BLOCKED` | Unlocks after Phase 4 & 6 are `DONE` | — |
| **Phase 8** | Batch-Scoped Private-Placement Publishing, Visibility Shielding & Verification | Phase 3, Phase 6, Phase 7 | `BLOCKED` | Unlocks after Phase 3, 6 & 7 are `DONE` | — |
| **Phase 9** | Concurrent Multi-AI Job Manager, Worker Isolation & Disposable Folder Cleanup | Phase 5, Phase 8 | `BLOCKED` | Unlocks after Phase 5 & 8 are `DONE` | — |
| **Phase 10** | Unified Admin Control Center, Full E2E Test Suite, Live Verification & Plan Cleanup | Phase 1–9 | `BLOCKED` | Final phase — includes deletion of `docs/platform-evolution/` | — |

---

## 5. Phase Completion & Verification Log

*(Each AI appends a concise, factual record here upon finishing a phase before pushing to GitHub.)*

- **Baseline Audit & Plan Published (`2026-11-20`)**:
  - Audited `choice121/Choice` (`main` @ `d8602db`), Supabase (`tlfmwetmhthpyrytrcfo`), and Cloudflare Pages (`choice-properties-site`).
  - Documented coexistence of Manual Browser Extensions (`docs/MANUAL_BROWSER_EXTENSIONS_GUIDE.md`) and Apify Automated Scraping (`docs/APIFY_AUTOMATED_SCRAPING_GUIDE.md`).
  - Created `01_SYSTEM_AUDIT_REPORT.md`, `02_TARGET_ARCHITECTURE_AND_SCHEMA.md`, and `03_PHASED_IMPLEMENTATION_PLAN.md`.
  - **Next Available Phase**: `Phase 1`.
- **Phase 1 Completed & Verified Live (`2026-11-21`, commits `d1de6ce` / `edfdb99`)**:
  - Updated `supabase/config.toml` with explicit `verify_jwt` parity across all 26 git-tracked Edge Functions and created canonical 59-function inventory (`docs/SUPABASE_DEPLOYED_FUNCTIONS_INVENTORY.md`).
  - Added `supabase/migrations/20261121000002_phase1_pipeline_recovery_purge_sync.sql` (`public.pipeline_recovery_health()` RPC) and scheduled hourly Stage-2 purge workflow `.github/workflows/purge-pipeline-recovery.yml` (`cron: '30 * * * *'` + `workflow_dispatch`).
  - Aligned `MAX_PHOTOS` (`25` mobile / `50` desktop) across `chrome-extension/background.js`, `.pages-orion/background.js`, and `content.js`; bumped and rebuilt both Chrome + Orion extension packages to `v34.0.1` (`sync-and-bump-extension.mjs --patch`, updated `docs/EXTENSION_CHANGELOG.md`, `chrome-extension/README.md`, `docs/MANUAL_BROWSER_EXTENSIONS_GUIDE.md`).
  - **Verification**: `npm run build` passed; `chrome-extension/test-extractors.js` (`34/34`), `.pages-orion/test-extractors.js` (`17/17`), `scripts/validate-extension.mjs`, and `scripts/test-manual-payment-workflow.mjs` (`6/6`) passed; GitHub Actions (`Cloudflare-Only Enforcement`, `Deploy Supabase Edge Functions & Migrations`, and `Purge Expired Pipeline Recovery Archive` dry-run returning `HTTP 200`, `expired_found=93`) passed; Cloudflare Pages deployment `0feb6f5d` live (`extension-meta.json` serves `v34.0.1`, extension ZIPs download HTTP 200, live `receive-pipeline-import` & `property-share` probes succeeded, `pipeline_recovery_health()` confirmed live).
  - **Next Available Phase**: `Phase 2`.
