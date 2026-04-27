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
- **Last completed batch**: BATCH_03 — Featured listings snap-scroll on mobile
- **Last commit on main**: `8ad9213e`
- **Last verified deploy**: `8e6109da` → https://choice-properties-site.pages.dev/
- **Blocked**: _none_

---

## Backlog (high-impact → low-impact)

### BATCH_04 — Save without signup (localStorage favorites)

**Goal**: Heart icon on each property card. Tap toggles favorite in
localStorage. After 3 saves in a session, a small inline prompt offers to
"Save these to your account" (links to existing signup), but never blocks
saving.

**Files touched**:
- `js/cp-favorites.js` — NEW. Exposes `window.cpFavorites = { toggle, has, list, count }`.
- `js/card-builder.js` — render the heart button on each card; call
  `cpFavorites.toggle(propertyId)` on click; reflect state.
- `css/cp-marketing.css` — heart button styles, prompt banner styles.
- `index.html` — load `cp-favorites.js`; add `<!-- batch-marker: BATCH_04 -->`.

**Acceptance**:
- Tapping a heart toggles its filled state and persists across page reloads.
- After the 3rd save in a session, an inline banner appears offering signup;
  dismissible; never re-shown for that session after dismissal.
- Existing card click-through behavior unchanged.

---

### BATCH_05 — Editorial typography pass

**Goal**: Lean fully into Fraunces (already loaded) for display headings.
Tighten visual identity toward "Editorial / Architectural" lane.

**Files touched**:
- `css/cp-marketing.css` — `.mv2-headline`, `.mv2-headline--md`, section
  headers, eyebrow tweaks. Increase letter-spacing in eyebrows, adjust line-height.
- `css/cp-design.css` — review base typographic scale only if needed.
- `index.html` — add `<!-- batch-marker: BATCH_05 -->`.

**Acceptance**:
- Hero headline + section headlines render in Fraunces with proper italic
  treatment for the existing `<em>` accents.
- Body copy stays in Inter.
- No layout shift > 0.05 CLS introduced by font swap.

---

### BATCH_06 — Backdrop-blur sticky nav

**Goal**: Once the user scrolls past the hero, the top nav becomes
position-fixed with a `backdrop-filter: blur(14px)` and a soft 1px hairline.
iOS-native feel.

**Files touched**:
- `js/cp-chrome.js` (or `js/components.js`, whichever owns the nav) — add a
  scroll listener that toggles `data-scrolled="true"` on `#site-nav`.
- `css/cp-marketing.css` — `#site-nav[data-scrolled="true"]` rules with
  backdrop blur, fallback solid background for browsers that don't support it.
- `index.html` — add `<!-- batch-marker: BATCH_06 -->`.

**Acceptance**:
- Nav becomes blurred-frosted after 80px of scroll, smooth transition.
- Falls back to a solid white `rgba(255,255,255,0.96)` background on browsers
  without `backdrop-filter` support.

---

### BATCH_07 — Warm dark mode (`prefers-color-scheme`)

**Goal**: Respect OS dark-mode preference with a warm (not pure-black) dark
theme. No user toggle in this batch — just system preference.

**Files touched**:
- `css/cp-design.css` — add `@media (prefers-color-scheme: dark)` overriding
  CSS custom properties (`--mv2-bg-warm`, `--mv2-ink`, etc.) to a warm dark
  palette (e.g. `#161311` background, `#F2EAD9` ink, `#3a3733` hairlines).
- `css/cp-marketing.css` — review hero overlay opacity in dark mode (likely
  needs to lift slightly).
- `index.html` — `<meta name="theme-color">` add a `media="(prefers-color-scheme: dark)"`
  variant; add `<!-- batch-marker: BATCH_07 -->`.

**Acceptance**:
- macOS / iOS / Android in dark mode renders the full homepage in the warm
  dark palette with WCAG AA contrast on all text.
- Light-mode users see no change.

---

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
