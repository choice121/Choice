# PHASE 01 — State-Aware Templating Engine

> Read `LEASE_IMPLEMENTATION.md` first. Then read this file fully. Then mark this phase `IN PROGRESS` in the master status table. Push that marker before writing any other code.

**Status:** `TODO`
**Owner:** unassigned
**Estimated AI session size:** medium (1 focused session)
**Depends on:** nothing — this is the foundation phase.
**Blocks:** every other phase (do not start anything else until this is `DONE`).

---

## 1. Goal (one sentence)

Replace the current flat `{{var}}` substitution in `supabase/functions/_shared/pdf.ts` with a real templating engine that supports conditionals, loops, partials, state-scoped includes, and a standardized disclaimer helper — so future phases can write `{% if state == "CA" %}` and `{% include "addenda/lead_paint" %}` instead of duct-taping strings together.

## 2. Why this phase exists

Today every clause in the lease body has to be present for every state, because there is no way to conditionally include text. That's why the only template we have is `Michigan Standard Residential Lease` — we couldn't write a single all-states template even if we wanted to. Conditionals unblock everything else.

## 3. Scope — IN

- A new shared module `supabase/functions/_shared/template-engine.ts` exporting:
  - `renderTemplate(body: string, ctx: object): string`
  - Supports: `{{ var }}`, `{{ var | filter }}`, `{% if ... %}`/`{% elsif %}`/`{% else %}`/`{% endif %}`, `{% for x in arr %}...{% endfor %}`, `{% include "partial/path" %}`, `{% comment %}...{% endcomment %}`.
  - Filters required: `money`, `date`, `datetime`, `upper`, `lower`, `default:'fallback'`, `escape_pdf` (sanitizes for pdf-lib WinAnsi).
- Partials live as rows in a new table `lease_template_partials (slug TEXT PK, body TEXT, updated_at TIMESTAMPTZ)`. The engine resolves `{% include "x/y" %}` via slug lookup. Partials may include other partials but cycles must be detected and refused.
- A new shared module `supabase/functions/_shared/legal-disclaimer.ts` exporting `STANDARD_DISCLAIMER` (the exact wording in master §5.4) and `disclaimerBlock()` which returns the disclaimer formatted for PDF inclusion.
- Refactor `_shared/pdf.ts`:
  - Remove the inline `substituteVars()`.
  - Use `renderTemplate()` instead.
  - The PDF builder still owns layout (page breaks, signature block, cert page later), but text rendering goes through the engine.
- Refactor every edge function that calls `substituteVars` directly (search the codebase) to import from the engine instead.
- Backwards compatibility: any existing `{{var}}` references in the seeded MI template MUST keep working. Acceptance criteria includes re-rendering the existing template byte-for-byte.

## 4. Scope — OUT (do NOT do these in this phase)

- Do NOT add any new state templates. That's Phase 03.
- Do NOT add any new disclosures. That's Phase 04.
- Do NOT touch the signing flow.
- Do NOT change the wire format of `lease_template_versions` or `lease_template_versions.template_body`. (The body just becomes richer; the column stays a TEXT.)

## 5. Files to CREATE

```
supabase/functions/_shared/template-engine.ts
supabase/functions/_shared/legal-disclaimer.ts
supabase/functions/_shared/__tests__/template-engine.test.ts   (Deno test file)
supabase/migrations/20260427_phase01_template_partials.sql
```

## 6. Files to MODIFY

```
supabase/functions/_shared/pdf.ts                  # use renderTemplate
supabase/functions/generate-lease/index.ts         # no longer call substituteVars directly
supabase/functions/sign-lease/index.ts             # ditto
supabase/functions/sign-lease-co-applicant/index.ts # ditto
supabase/functions/countersign/index.ts            # ditto
supabase/functions/create-amendment/index.ts       # ditto
supabase/functions/sign-amendment/index.ts         # ditto
```

## 7. Database migration (full SQL — copy into the migration file)

```sql
-- Phase 01 — lease template partials and engine support
-- Public-domain reference: this is internal infrastructure; no statute citation needed.

CREATE TABLE IF NOT EXISTS lease_template_partials (
  slug         TEXT PRIMARY KEY,
  body         TEXT NOT NULL,
  description  TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lease_template_partials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lease_template_partials_admin_all"
  ON lease_template_partials
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));

CREATE POLICY "lease_template_partials_anon_read"
  ON lease_template_partials
  FOR SELECT
  TO anon
  USING (false);  -- only edge functions with service role read these

-- updated_at trigger
CREATE OR REPLACE FUNCTION lease_template_partials_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lease_template_partials_touch ON lease_template_partials;
CREATE TRIGGER lease_template_partials_touch
  BEFORE UPDATE ON lease_template_partials
  FOR EACH ROW EXECUTE FUNCTION lease_template_partials_touch_updated_at();

-- Seed the standard disclaimer partial so templates can include it
INSERT INTO lease_template_partials (slug, body, description, created_by) VALUES (
  'common/disclaimer',
  'This document is statute-derived and has not been individually attorney-reviewed for every jurisdiction. Choice Properties is not a law firm and does not provide legal advice. Tenants and landlords are encouraged to consult a licensed attorney in their state before signing.',
  'Standard non-attorney-review disclaimer required on every generated lease document.',
  'system'
) ON CONFLICT (slug) DO NOTHING;
```

## 8. Templating engine spec (implementation guidance)

Build a small, dependency-free Liquid-subset parser. Approximate API:

```ts
export interface RenderContext {
  [key: string]: unknown;
}

export interface RenderOptions {
  partials?: (slug: string) => Promise<string | null>;  // resolver
  maxIncludeDepth?: number;                              // default 8
  strict?: boolean;                                       // default true — unknown vars throw
}

export async function renderTemplate(
  body: string,
  ctx: RenderContext,
  opts?: RenderOptions,
): Promise<string>;
```

Required tag and filter behavior:

| Construct                          | Behavior                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `{{ var }}`                        | Plain output. Throws if `strict` and `var` undefined. Otherwise empty string.         |
| `{{ var \| money }}`               | `$1,234.56`. Null/undefined → empty.                                                  |
| `{{ var \| date }}`                | `April 27, 2026`.                                                                     |
| `{{ var \| datetime }}`            | `April 27, 2026 02:15 PM`.                                                            |
| `{{ var \| default:"N/A" }}`       | Fallback if empty/null.                                                               |
| `{{ var \| upper }}` / `lower`     | Case.                                                                                 |
| `{{ var \| escape_pdf }}`          | Use the existing `sanitizeForPDF` logic from `pdf.ts`.                                |
| `{% if expr %} ... {% endif %}`    | `expr` supports `==`, `!=`, `>`, `>=`, `<`, `<=`, `and`, `or`, `not`, parens.         |
| `{% elsif %}`, `{% else %}`        | Standard.                                                                             |
| `{% for x in arr %} ... {% endfor %}` | `arr` must be array; provides `forloop.index` (1-based), `forloop.first`, `last`. |
| `{% include "slug" %}`             | Resolves via `opts.partials(slug)`. Renders with same ctx. Cycle detection required.  |
| `{% comment %} ... {% endcomment %}`| Stripped at render time.                                                             |

Implementation tip: tokenize → parse to AST → render. Don't try to render with regex alone — that won't survive Phase 03 templates.

## 9. Acceptance criteria — every item must be checkable

- [ ] `template-engine.test.ts` covers: bare var, missing var (strict throws, non-strict returns ''), each filter, nested if/elsif/else, for-loop with `forloop.first/last/index`, include with cycle detection, max-depth enforcement.
- [ ] All tests pass when run with `deno test supabase/functions/_shared/__tests__/template-engine.test.ts`.
- [ ] The existing seeded "Michigan Standard Residential Lease" template renders byte-for-byte identically through the new engine vs the old `substituteVars`. (Write a comparison test that loads the seed text and compares outputs against the legacy implementation.)
- [ ] `generate-lease`, `sign-lease`, `sign-lease-co-applicant`, `countersign`, `create-amendment`, `sign-amendment` all import from the new engine — `grep -r 'substituteVars' supabase/functions` returns zero matches outside the test file and the deprecated re-export.
- [ ] `legal-disclaimer.ts` exports `STANDARD_DISCLAIMER` matching the master §5.4 wording exactly.
- [ ] Migration runs cleanly on a fresh database (test by applying it twice — must be idempotent).
- [ ] `lease_template_partials` row `common/disclaimer` exists after migration.
- [ ] No new npm imports beyond `npm:@supabase/supabase-js@2` and `npm:pdf-lib@1.17.1`.

## 10. Manual test steps (run before pushing)

1. In admin → Edit Template, paste a test template containing `{% if state_code == "MI" %}MI ONLY{% else %}OTHER{% endif %}` and `{% include "common/disclaimer" %}`.
2. Generate a lease for a real test application with `lease_state_code = "MI"`.
3. Open the resulting PDF — confirm `MI ONLY` appears, `OTHER` does not, and the disclaimer renders.
4. Repeat with `lease_state_code = "CA"` — confirm `OTHER` appears.
5. Confirm previously-snapshotted leases still render unchanged (check a known prior PDF version in `lease_pdf_versions`).

## 11. Push checklist

- [ ] All Acceptance Criteria boxes checked.
- [ ] Master `LEASE_IMPLEMENTATION.md` status table: row 01 set to `DONE`, "Completed" date filled, "Completed by" filled (e.g. `agent:claude-2026-04-27`), files listed in this file's Completion Notes.
- [ ] Files committed via the §3 push procedure in master file.
- [ ] Commit message: `Lease Phase 01 — state-aware templating engine`.
- [ ] STOP. Do not start Phase 02.

## 12. Blocked Questions

(None at start. If you hit one, log here, set status to `BLOCKED`, push, stop.)

## 13. Completion Notes

(Filled in by the AI that completes this phase. Include: 1-paragraph summary, list of files created/modified, any deviations from this brief, anything the next phase should know.)
