# Choice Properties — Homepage UI/UX Implementation Plan

> **Single source of truth** for the active homepage redesign work. Replaces all
> previous `BATCH_*`, `DEPLOY_PHASE*`, `DESIGN_EXTENSION_*`, `LEASE_*`, and
> `PROJECT_STATUS` documents (deleted intentionally).

---

## How to use this file (read first — applies to any human or AI agent)

1. **One batch at a time, top of `## Backlog` first.** Never combine batches.
2. **Before coding**: copy the batch heading into `## Status → In progress`
   along with the start time. Commit nothing until the batch is functionally complete.
3. **Code edits** should be scoped strictly to the files listed under the batch.
   If you need to touch a file not listed, stop and update the plan first.
4. **Push directly to `main`** (`git push origin main`). Cloudflare Pages
   auto-deploys. There is no PR workflow for this project.
5. **Verify deployment** before declaring the batch done:
   - Poll `GET https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/choice-properties-site/deployments`
     until the newest deployment whose `deployment_trigger.metadata.commit_hash`
     matches your push has `latest_stage.status == "success"`.
   - `curl -sI https://choice-properties-site.pages.dev/` returns `200`.
   - `curl -s https://choice-properties-site.pages.dev/ | grep -q '<BATCH_MARKER>'`
     succeeds, where `<BATCH_MARKER>` is the unique HTML comment the batch added
     (each batch must add one — see Batch 01 for the pattern).
6. **On success**: delete the entire batch heading + body from `## Backlog`,
   append a one-line entry to `## Done log`, then commit and push that update
   with message `plan: complete batch NN — <name>`.
7. **On failure**: leave the plan unchanged, write a brief note under
   `## Status → Blocked`, and stop. Do not silently move on.
8. **Never** run `npm install`, start a Node server, or configure a Replit
   workflow. The repo has `scripts/enforce-cloudflare-only.js` as a `preinstall`
   hook that will hard-fail any such attempt. Replit is the editor only.
9. **Never** commit anything in `.gitignore` (`.replit`, `_dev_preview.js`,
   `config.js`, `.agents/`, `.local/`, `attached_assets/`, etc.).

### Required environment

Stored in Replit Secrets / env vars (not in this repo):

- `GITHUB_TOKEN` — fine-scoped PAT with write access to `choice121/Choice`.
- `CLOUDFLARE_API_TOKEN` — Pages-edit token for the production project.
- `CLOUDFLARE_ACCOUNT_ID` = `07299bddeb80034641a7424a5f665dac`
- `GITHUB_REPO` = `choice121/Choice`

Cloudflare Pages project name: `choice-properties-site`
Production URL: `https://choice-properties-site.pages.dev/`

### Batch marker convention

Every batch must add a single HTML comment somewhere in `index.html` of the form:

```html
<!-- batch-marker: BATCH_NN -->
```

…where `NN` is the batch's two-digit ID. Verification step 5 greps for it on
the live URL. When pruning markers from completed batches is desirable, leave
them — they are the only post-deploy proof that the batch actually shipped.

---

## Status

- **In progress**: _none_
- **Last completed batch**: BATCH_07 — Warm dark mode (prefers-color-scheme)
- **Last commit on main**: `68724b59`
- **Last verified deploy**: `afdb0b88` → https://choice-properties-site.pages.dev/
- **Blocked**: _none_

---

## Backlog (high-impact → low-impact)

### BATCH_08 — Skeleton-screen audit

**Goal**: Replace any remaining spinners with skeleton placeholders matching
existing card skeleton style.

**Files touched**:
- `css/cp-marketing.css` — extend skeleton primitives.
- `js/card-builder.js`, `js/listings.js`, `js/property.js` — swap spinners for
  skeletons during fetches.
- `index.html` — add `<!-- batch-marker: BATCH_08 -->`.

**Acceptance**:
- Grep `rg -n 'fa-spinner|spinner|loading' js/ css/` produces no UI-spinner
  references in the loading paths covered by this batch.

---

## Done log

_(append-only; one line per completed batch — `BATCH_NN — name — <commit-sha> — <deploy-id> — <iso-timestamp>`)_

- BATCH_01 — Living Hero — `e5a7564e` — deploy `935c0474` — 2026-04-27
- BATCH_02 — Sticky mobile search pill + sheet — `2115effc` — deploy `b7f36beb` — 2026-04-27
- BATCH_03 — Featured listings snap-scroll on mobile — `8ad9213e` — deploy `8e6109da` — 2026-04-27
- BATCH_04 — Save-without-signup nudge + heart pulse — `df26fc2c` — deploy `672b76e5` — 2026-04-27
- BATCH_05 — Editorial typography pass — `7c391d13` — deploy `7633567c` — 2026-04-27
- BATCH_06 — Backdrop-blur sticky nav (two-state) — `39ab5de3` — deploy `d5b711e7` — 2026-04-27
- BATCH_07 — Warm dark mode (prefers-color-scheme) — `68724b59` — deploy `afdb0b88` — 2026-04-27
