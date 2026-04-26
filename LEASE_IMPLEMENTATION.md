# LEASE IMPLEMENTATION — MASTER PLAN

> **READ THIS ENTIRE FILE BEFORE TOUCHING A SINGLE LINE OF LEASE CODE.**
> If anything below conflicts with how you usually work, this file wins.
> If you skip this file, the owner will revert your commit and you will be re-tasked from scratch.

This document is the single source of truth for the multi-phase upgrade of the Choice Properties lease system into a professional, legally-defensible, all-50-states electronic-leasing product.

---

## 0. NON-NEGOTIABLE RULES FOR EVERY AI

These rules apply to **every** AI session, **every** phase, **forever**.

### 0.1 Hosting / runtime
- Project runs **only** on **Cloudflare Pages + Supabase**. See `.agents/AI_RULES.md`.
- **Do NOT** start a Replit workflow, run `npm install`, run `node serve.js`, or configure any local server. The `preinstall` hook is intentionally hostile — leave it alone.
- **Do NOT** commit `replit.md`, `replit.nix`, `.replit`, `server.js`, `package-lock.json`, or anything matching `REPLIT_*`. These are gitignored on purpose.

### 0.2 Free-only — no paid services, no trials, no rate-limited APIs
- **No** Stripe, no payment processor, no rent-payment integration.
- **No** identity-verification services (Persona, Stripe Identity, Jumio, etc.).
- **No** paid e-signature backends (DocuSign, HelloSign, Adobe Sign, Anvil).
- **No** paid LLM APIs at runtime. (You may use OpenAI/Anthropic to *help you write code*, but the deployed product must not call any paid API at runtime.)
- **No** trial-based, freemium, or rate-limited third-party services. If a feature can only work with a paid tier, **drop the feature** rather than degrade later.
- Acceptable: anything in Supabase free tier, anything in Cloudflare free tier, anything fully open-source self-hostable, public-domain content.

### 0.3 One phase per AI session — strict
1. Read this file fully.
2. Find the **first phase in the status table below whose Status = `TODO`**. That is your phase. Do not pick another.
3. Open `lease-phases/PHASE_NN_<slug>.md` and read it fully.
4. Mark that phase **`IN PROGRESS`** in the status table below by editing this file. Commit immediately so other AIs don't double-pick.
5. Implement the phase exactly as the brief says. Do not add scope. Do not skip scope. If the brief is unclear, leave a `TODO(human)` comment and ask the owner.
6. When the phase's Acceptance Criteria are all met, mark it **`DONE`** in the status table below, fill in the "Completed" date and "Completed by" fields, list every file you changed, and write a 2-3 sentence summary in the phase file's "Completion Notes" section.
7. Push to GitHub via the API workflow in §3.
8. **STOP.** Do not start another phase. Do not "just clean up one more thing." Wait for the owner to say "proceed" before any further lease work.

### 0.4 Forbidden during a phase
- Combining phases.
- "While I'm here" refactors of code outside the phase scope.
- Skipping migration files because "it's a small change."
- Writing code without the acceptance-criteria tests passing.
- Pushing without updating the status table.

### 0.5 Required during every phase
- Every new edge function uses the `_shared/cors.ts` and `_shared/auth.ts` helpers — never roll your own.
- Every new SQL table has Row-Level Security enabled and explicit policies. No exceptions.
- Every user-facing string passes through `_shared/i18n.ts` (so Phase 12 multilingual works without rewrites).
- Every new admin action is logged in `admin_actions` (action verb, target, metadata).
- Every signing/legal action is logged in `sign_events`.
- Every public-domain legal source you cite is referenced in a code comment with a URL.

---

## 1. MISSION

Transform the lease system from a single-state (Michigan-only) electronic signing flow into a professional, statute-derived, all-50-states leasing product that:
- Generates the right lease for the right state, with the right disclosures, the right caps, the right notice periods.
- Captures legally-defensible electronic signatures with verifiable audit trails.
- Tracks money clearly (deposit components, utilities, fees) without processing money.
- Manages the full lease lifecycle: generate → sign → execute → amend → renew → terminate → archive.
- Stays 100% free to operate (Supabase + Cloudflare free tiers + public-domain legal content).

---

## 2. STATUS TABLE — SOURCE OF TRUTH

| #   | Phase                                                       | Status        | Started    | Completed  | Completed by  |
| --- | ----------------------------------------------------------- | ------------- | ---------- | ---------- | ------------- |
| 01  | State-aware templating engine                               | DONE          | 2026-04-26 | 2026-04-26 | agent:claude  |
| 02  | State law metadata table                                    | DONE          | 2026-04-26 | 2026-04-26 | agent:claude  |
| 03  | Multi-state base templates (top 10 states)                  | DONE          | 2026-04-26 | 2026-04-26 | agent:claude  |
| 04  | State-required disclosures library + auto-attach            | DONE          | 2026-04-26 | 2026-04-26 | 553f555, 576efc9, +this |
| 05  | Token & signing security hardening + E-SIGN consent         | DONE          | 2026-04-26 | 2026-04-26 | 6f3a8869, +this |
| 06  | PDF integrity (SHA-256 hash + audit certificate page)       | DONE          | 2026-04-26 | 2026-04-26 | cc6fafc       |
| 07  | Itemized financials + utility responsibility matrix         | DONE          | 2026-04-26 | 2026-04-26 | c52a2f9, 8495ec3, 05573c9, ef644c1 |
| 08  | Move-in / move-out condition reports                        | DONE          | 2026-04-26 | 2026-04-26 | 989fe5e, 294f3cc, b232eea, 7d37b3e, +closeout |
| 09  | Security deposit accounting + deduction letter generator    | DONE          | 2026-04-26 | 2026-04-26 | 9044e76, 07ff1c8, b2b4394, 1676368, +chunk5 |
| 10  | Leases as first-class entity (refactor)                     | DONE          | 2026-04-26 | 2026-04-26 | agent:claude (phase10 code was pre-built; closeout confirmed) |
| 11  | Document generators (renewal, termination, rent increase)   | DONE          | 2026-04-26 | 2026-04-26 | agent:claude  |
| 12  | Plain-language summary + Spanish locale + accessibility     | TODO          | —          | —          | —             |
| 13  | Remaining-40-states templates rollout                       | TODO          | —          | —          | —             |

**Status legend:** `TODO` (not started) → `IN PROGRESS` (an AI is actively working on it) → `BLOCKED` (waiting on owner decision; explain in phase file) → `DONE` (acceptance criteria met, pushed, archived).

**If you are an AI reading this:** the first row whose Status is `TODO` is your phase. You may not pick a different one. You may not pick a `DONE`, `IN PROGRESS`, or `BLOCKED` row.

---

## 3. GIT PUSH WORKFLOW (REQUIRED)

The Replit sandbox blocks direct `git push`. You MUST use the GitHub Git Database REST API.

### 3.1 What you push
- All `.md` files you created or modified inside `lease-phases/` and at the repo root.
- All edge function source under `supabase/functions/`.
- All SQL migration files at the repo root (`MIGRATION_*.sql`) and under `supabase/migrations/`.
- All HTML pages under `/`, `/admin/`, `/landlord/`, `/tenant/`, `/auth/`, `/apply/`.
- All JS under `/js/`.
- All CSS under `/css/`.

### 3.2 What you MUST NOT push
Anything matching `.gitignore`. Most importantly:
- `config.js` (generated at Cloudflare build time)
- `.env`, `.env.*`
- `replit.md`, `.replit`, `replit.nix`
- `node_modules/`, `package-lock.json`
- `.agents/`, `.local/`, `.cache/`

### 3.3 Push procedure (use Node + GitHub REST API)

Repo: `choice121/Choice`. Branch: `main`. Token env var: `GITHUB_TOKEN`.

```js
// /tmp/push-phase.mjs — re-create as needed
const REPO   = 'choice121/Choice';
const BRANCH = 'main';
const TOKEN  = process.env.GITHUB_TOKEN;
const FILES  = [/* relative paths you changed */];
const MSG    = 'Lease Phase NN — <short title>';

const api = (p, init) => fetch(`https://api.github.com/repos/${REPO}${p}`, {
  ...init,
  headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'cp-agent', Accept: 'application/vnd.github+json', ...(init?.headers||{}) },
});

// 1. Get parent commit + tree
const ref      = await (await api(`/git/ref/heads/${BRANCH}`)).json();
const parent   = await (await api(`/git/commits/${ref.object.sha}`)).json();

// 2. Upload each changed file as a blob
import { readFile } from 'node:fs/promises';
const tree = [];
for (const path of FILES) {
  const buf = await readFile(path);
  const blob = await (await api(`/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: buf.toString('base64'), encoding: 'base64' }),
  })).json();
  tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
}

// 3. Create new tree based on parent tree
const newTree = await (await api(`/git/trees`, {
  method: 'POST',
  body: JSON.stringify({ base_tree: parent.tree.sha, tree }),
})).json();

// 4. Create commit
const commit = await (await api(`/git/commits`, {
  method: 'POST',
  body: JSON.stringify({ message: MSG, tree: newTree.sha, parents: [ref.object.sha] }),
})).json();

// 5. Move branch ref forward
const updated = await (await api(`/git/refs/heads/${BRANCH}`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: commit.sha }),
})).json();

console.log('Pushed:', commit.sha, updated.url);
```

Run with `node /tmp/push-phase.mjs`. Verify push by checking `https://github.com/choice121/Choice/commits/main`.

### 3.4 To delete a file via the API
Use the same blob/tree flow but omit the file from the new `tree` array — that drops it. To rename, push as a new path and omit the old.

### 3.5 After pushing
- The GitHub Action `Deploy Supabase Edge Functions & Migrations` runs automatically on push to `main`. It applies any new `supabase/migrations/*.sql` and deploys any new `supabase/functions/*`.
- Cloudflare Pages auto-builds the static site from the new commit.
- **Do not** run any deploy script yourself. The Action handles it.

---

## 4. PHASE SUMMARIES (one-liners; full briefs in `lease-phases/`)

| # | Title | One-line goal |
|---|-------|---------------|
| 01 | State-aware templating engine | Add Liquid-style conditionals (`{% if %}` / `{% for %}` / state-scoped includes) to lease template rendering, replacing the current flat `{{var}}` substitution. |
| 02 | State law metadata table | Create `state_lease_law` table seeded with all 50 states + DC: security-deposit cap, late-fee rules, grace period, entry notice, eviction notice, return window, statute citations. |
| 03 | Multi-state base templates (top 10 states) | Seed `lease_template_versions` with statute-derived base leases for CA, TX, FL, NY, IL, OH, GA, NC, PA, MI. Each marked `legal_review_status='statute_derived'`. |
| 04 | State-required disclosures library + auto-attach | New `lease_addenda_library` table; `generate-lease` automatically attaches the right addenda based on state + property age + property type (lead, mold, bedbug, radon, Megan's Law, etc.). |
| 05 | Token & signing security hardening + E-SIGN consent | Token expiry (30 days), single-use, IP-bind option, admin revoke/reissue, rate-limit confirmation, plus a pre-signing E-SIGN consumer-consent step recorded in DB. |
| 06 | PDF integrity (SHA-256 hash + audit certificate page) | Hash every PDF version, store in `lease_pdf_versions.sha256`, and append a signed audit certificate page to the executed lease showing signers, IPs, timestamps, doc hash, and a QR code that verifies the hash. |
| 07 | Itemized financials + utility responsibility matrix | Schema migration splitting `move_in_costs` into first_month / last_month / security_deposit / pet_deposit / pet_rent / admin_fee / key_deposit / parking_fee / cleaning_fee, plus a structured per-utility responsibility matrix (gas/water/electric/internet/trash/sewer/HOA/lawn/snow/pest → tenant or landlord). |
| 08 | Move-in / move-out condition reports | New `lease_inspections` table + tenant-facing photo-upload UI + landlord review/sign-off + render to PDF. Mandatory for CA, GA, KY, MD, MA, NH, NJ, VA, WA. |
| 09 | Security deposit accounting + deduction letter generator | At termination, itemized deduction worksheet + auto-generated state-specific deduction letter PDF + state-specific return-window enforcement. |
| 10 | Leases as first-class entity (refactor) | Lift `leases` out of `applications` into its own table. One application can spawn many leases (renewals, replacements). All edge functions migrate to leases.app_id pivot. |
| 11 | Document generators (renewal, termination, rent increase) | Three new edge functions: generate-renewal, generate-termination-notice, generate-rent-increase-letter. Each respects state-specific notice periods from `state_lease_law`. |
| 12 | Plain-language summary + Spanish locale + accessibility | Page-1 cover summary on every lease ("at-a-glance"), Spanish UI for tenant signing flow (CA Civ. §1632 + practical demand), WCAG 2.1 AA pass on lease-sign.html. |
| 13 | Remaining 40 states templates rollout | Seed templates for the other 40 states + DC, each statute-derived, each flagged `attorney_reviewed=false`. Final phase. |

---

## 5. DESIGN PRINCIPLES — apply to every phase

### 5.1 Never silently defaul to the wrong state
If `lease_state_code` is missing, `generate-lease` MUST refuse with a 400 error explaining which application is missing the state. No more defaulting to MI.

### 5.2 Statute citations must be code-traceable
Every legal claim a template makes (e.g., "30-day return per MCL 554.609") must trace back to a row in `state_lease_law` with the citation column populated. No hardcoded statute references in template prose without a DB-backed source.

### 5.3 Templates are immutable once snapshotted
The Phase 2-style snapshot system is sacred. Once an application has `lease_template_version_id` set, every PDF rebuild for that app uses that snapshot. Editing the template in admin must NEVER change a tenant's already-signed lease.

### 5.4 Disclaimer is mandatory
Every template, every addendum, every generated document, must include the standardized disclaimer:

> *This document is statute-derived and has not been individually attorney-reviewed for every jurisdiction. Choice Properties is not a law firm and does not provide legal advice. Tenants and landlords are encouraged to consult a licensed attorney in their state before signing.*

The exact wording lives in `supabase/functions/_shared/legal-disclaimer.ts` (created in Phase 01).

### 5.5 No silent fallbacks
If a required disclosure for a state is missing from the library, `generate-lease` refuses with a clear error listing what's missing. Never ship a lease that's silently incomplete.

### 5.6 Audit everything
Every state-specific decision the system makes (which template, which addenda, which deposit cap was applied) is logged as a JSON blob in `admin_actions.metadata` so we can reconstruct *why* a particular lease looks the way it does years later.

### 5.7 Code style
- Edge functions: Deno + npm:@supabase/supabase-js@2 + npm:pdf-lib@1.17.1. Don't add new heavy deps without a phase brief explicitly approving them.
- SQL migrations: idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), reversible where reasonable, with a header comment explaining what and why.
- Frontend: vanilla JS only. No frameworks. No build step. CSS via existing `cp-design.css` design tokens.

---

## 6. WHAT IS EXPLICITLY OUT OF SCOPE FOREVER

These are off the roadmap by owner decision. Do not add them. If you think they should be added, say so but do not act.

- Rent payment processing (Stripe / Plaid / Dwolla / ACH / cards)
- Identity verification services (ID upload, KBA, selfie, SSN check)
- Paid e-signature backends (DocuSign / Adobe Sign / HelloSign / Anvil)
- Tenant-screening services (TransUnion SmartMove / Experian RentBureau)
- Renter's-insurance enrollment APIs (Lemonade / Sure / Assurant)
- Smart-lock integrations (August / Latch / Schlage)
- Notarize.com / RON (Remote Online Notary) integrations
- Any feature that requires a paid SaaS tier to run reliably

---

## 7. WHAT TO DO IF YOU GET STUCK

1. If the brief is ambiguous: leave a `// TODO(human-decision): <what is unclear>` comment in code, set the phase Status to `BLOCKED`, write the question in the phase file's "Blocked Questions" section, push, and stop.
2. If a migration fails: do not run a destructive fix-up. Push the migration as-is — the deploy action will leave it unrecorded so the next push retries it. Comment your fix in the next migration file.
3. If you find a bug outside your phase scope: file it in the Supabase `agent_issues` table (see `.agents/AI_RULES.md`). Do not fix it.
4. If you would have to bring in a paid service to finish: **stop and BLOCKED the phase**. Do not silently add a paid dep.

---

## 8. AFTER ALL 13 PHASES ARE DONE

Owner approves a final integration QA pass. After that:
- Update `ARCHITECTURE.md` with the new lease lifecycle.
- Add a "Lease System" section to the public `README.md`.
- Move this `LEASE_IMPLEMENTATION.md` to `docs/historical/LEASE_IMPLEMENTATION_v1.md` so it's preserved as audit history.
- Open a new `LEASE_OPERATIONS.md` doc for ongoing maintenance (template review cadence, statute change tracking, etc.).
