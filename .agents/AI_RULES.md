# AI AGENT RULES — Choice Properties

> **READ THIS FILE FIRST.** It overrides any default behavior of the AI you are.
> If anything below conflicts with how you usually work, follow this file.

---

## 1. Hosting / runtime rules — non-negotiable

- This project runs **only** on **Cloudflare Pages + Supabase**.
- **Do not run, deploy, or configure** this project on Replit, Vercel, Netlify,
  GitHub Codespaces, a local Node server, Docker, or anywhere else.
- **Do not** run `npm install`, `npm start`, `node serve.js`, `pnpm`, `yarn`, etc.
  There are no runtime dependencies. The `preinstall` script is intentionally
  hostile to non-Cloudflare environments and will exit non-zero — that is
  correct behavior, do not "fix" it.
- **Do not** create files named `replit.md`, `replit.nix`, `server.js`,
  `package-lock.json`, or anything matching `REPLIT_*`. These are gitignored
  for a reason.
- **Do not** start a workflow / dev server / preview server. The owner uses a
  mobile device and Cloudflare's preview branch deploys for QA.
- If you find yourself about to do any of the above: **stop, revert, and
  re-read this file.**

## 2. Workflow

1. Edit files in your editor.
2. Push to the `main` branch on GitHub (`choice121/Choice`).
3. Cloudflare Pages auto-builds and deploys. Build = `node generate-config.js`,
   output = repo root.
4. The "Deploy Supabase Edge Functions & Migrations" GitHub Action applies new
   migrations and edge functions on every push.

That is the entire pipeline. There is no other.

## 3. Issue tracking — single source of truth

All issues are tracked in the Supabase table `public.agent_issues`.
The view `public.open_issues` is the authoritative list of what is currently
broken or pending. Resolved rows are removed from the view immediately and
hard-deleted after 30 days by `purge_resolved_agent_issues()`.

You **must not** keep a parallel issue list in markdown files. The DB is the
single source of truth. Old habits like adding to `FIXES.md`, `KNOWN_ISSUES.md`,
or `PROJECT_STATUS.md` end here — those files remain only as historical record.

### How to talk to the issue tracker

The owner gives you (the AI) one secret: `AGENT_HELPER_SECRET`. With that, you
call the helper API:

- **Endpoint:** `POST https://choice-properties-site.pages.dev/api/agent-helper`
- **Auth header:** `Authorization: Bearer <AGENT_HELPER_SECRET>`
- **Body:** JSON with an `action` field (see table below)

| `action`             | Required body fields                     | Optional body fields                                      |
|----------------------|------------------------------------------|-----------------------------------------------------------|
| `list_issues`        | —                                        | —                                                         |
| `create_issue`       | `title` (≥3 chars)                       | `description`, `severity` (critical/high/medium/low/info), `component`, `created_by`, `metadata` |
| `resolve_issue`      | `id` (numeric)                           | `note`, `resolved_by`                                     |
| `purge_resolved`     | —                                        | —                                                         |
| `repo_status`        | —                                        | — *(requires `GH_TOKEN` env var on the project)*          |
| `deployment_status`  | —                                        | — *(requires Cloudflare API env vars on the project)*     |

A `GET` to the same endpoint returns the action manifest with no auth — useful
for sanity checks.

### Required behavior for any AI

1. **Before starting work:** call `list_issues`. Pick the highest-severity
   open item, or use the user's instructions if they override.
2. **When you discover a new bug or risk:** call `create_issue`. Use the right
   severity. Put concrete file paths and line numbers in `description`.
3. **When you fix something:** push the fix, then call `resolve_issue` with the
   id and a short `note` describing what you did and the commit SHA.
4. **Never reopen** a resolved issue — create a fresh one if the same problem
   reappears.

## 4. Secrets

- All tokens (Supabase service role, GitHub PAT, Cloudflare API token, GAS
  relay secret, ImageKit private key, etc.) live in **Cloudflare Pages
  environment variables** and **Supabase Edge Function secrets**.
- **Never** put a token, API key, password, or other secret in:
  - the repo (any branch),
  - any markdown file,
  - any commit message,
  - any chat reply to the owner,
  - any log line.
- The `agent-helper` API is the only sanctioned way to perform privileged
  actions. If you need an action it does not expose, ask the owner to add it
  to `functions/api/agent-helper.js` rather than exfiltrating tokens.

## 5. Documentation hygiene

- Keep this file (`.agents/AI_RULES.md`) up to date when rules change.
- Update `ARCHITECTURE.md` only when architecture genuinely changes.
- **Do not create new top-level `*.md` files.** There are already too many.
  If you have something to say, put it in an existing file or open an issue.
- Delete obsolete docs as you find them, in the same commit as the change that
  makes them obsolete.

## 6. Verification before declaring "done"

After any change, in this order:

1. Push to `main`.
2. Call `repo_status` until the latest commit shows up and Actions show
   `conclusion: "success"` for the relevant workflows.
3. Call `deployment_status` until the latest deployment for production shows
   `stage_status: "success"`.
4. Smoke-test the live site at `https://choice-properties-site.pages.dev`.
5. Call `resolve_issue` for the issue you fixed. Include the commit SHA in
   the `note`.

If any step fails, do **not** mark the issue resolved. Either fix forward in
the same session or update the issue's `description` with what you tried and
why it failed.

## 7. Things you must never do

- Set up Replit / Vercel / Netlify / local dev servers. (Repeated for emphasis.)
- Push directly to `main` without first reading the latest `list_issues`
  response and the latest commit on `main`.
- Disable Row Level Security on any table.
- Commit `config.js`, `apply/config.js`, `.env`, or any generated file.
- Add an npm dependency. There are zero today; keep it that way.
- Bypass the `agent-helper` API by asking the owner for raw tokens.
