# PHASE 03 — Multi-State Base Templates (Top 10)

**Status:** `TODO`
**Depends on:** Phase 01, Phase 02 (both `DONE`)
**Blocks:** Phase 13 (which seeds the remaining 40)

---

## 1. Goal

Seed `lease_template_versions` (or `lease_templates` if no version row yet exists per state) with one statute-derived base lease per state for the top 10 states by US rental population: **CA, TX, FL, NY, IL, OH, GA, NC, PA, MI**. Each template uses the Phase 01 templating engine and pulls per-state limits from the Phase 02 `state_lease_law` table at render time.

## 2. Why

Without this, `lease_state_code` does nothing useful — every lease is the MI template. After this phase, picking a state in the admin form generates a lease that actually reflects that state's law.

## 3. Scope — IN

- Add a `state_code CHAR(2)` column to `lease_templates` (nullable for legacy, then NOT NULL for new rows). Same column on `lease_template_versions`.
- Add `legal_review_status` enum column: `('statute_derived' | 'attorney_reviewed' | 'outdated')`, default `statute_derived`.
- Add `attorney_reviewer`, `attorney_review_date`, `attorney_bar_number` (nullable).
- Refactor `resolveLeaseTemplate()` in `_shared/lease-render.ts`: when no snapshot is pinned, pick the active template **for the application's state**, not just any active template.
- Seed migration with 10 base templates, each using `{% include %}` + `{{ }}` to render state-specific values pulled from `state_lease_law`. Each template body must include `{% include "common/disclaimer" %}` and reference statute citations from the metadata table.
- Update admin `/admin/lease-template.html` to scope the "active" toggle per state (state dropdown filter).

## 4. Scope — OUT

- Other 40 states. (Phase 13.)
- Required disclosures auto-attach. (Phase 04.)
- Spanish translations. (Phase 12.)

## 5. Files to CREATE / MODIFY

```
CREATE: supabase/migrations/20260429_phase03_state_aware_templates.sql
CREATE: supabase/migrations/20260429_phase03_seed_top10_templates.sql
MODIFY: supabase/functions/_shared/lease-render.ts        (state-scoped active selection)
MODIFY: supabase/functions/generate-lease/index.ts        (refuse if no template for state)
MODIFY: admin/lease-template.html
MODIFY: js/admin/lease-template.js
```

## 6. Schema additions (idempotent)

```sql
ALTER TABLE lease_templates           ADD COLUMN IF NOT EXISTS state_code            CHAR(2);
ALTER TABLE lease_templates           ADD COLUMN IF NOT EXISTS legal_review_status   TEXT NOT NULL DEFAULT 'statute_derived';
ALTER TABLE lease_templates           ADD COLUMN IF NOT EXISTS attorney_reviewer     TEXT;
ALTER TABLE lease_templates           ADD COLUMN IF NOT EXISTS attorney_review_date  DATE;
ALTER TABLE lease_templates           ADD COLUMN IF NOT EXISTS attorney_bar_number   TEXT;

ALTER TABLE lease_template_versions   ADD COLUMN IF NOT EXISTS state_code            CHAR(2);
ALTER TABLE lease_template_versions   ADD COLUMN IF NOT EXISTS legal_review_status   TEXT NOT NULL DEFAULT 'statute_derived';
ALTER TABLE lease_template_versions   ADD COLUMN IF NOT EXISTS attorney_reviewer     TEXT;
ALTER TABLE lease_template_versions   ADD COLUMN IF NOT EXISTS attorney_review_date  DATE;

-- Backfill: existing rows are MI Statute-derived
UPDATE lease_templates         SET state_code = 'MI' WHERE state_code IS NULL;
UPDATE lease_template_versions SET state_code = 'MI' WHERE state_code IS NULL;

-- Now enforce
ALTER TABLE lease_templates           ALTER COLUMN state_code SET NOT NULL;
ALTER TABLE lease_template_versions   ALTER COLUMN state_code SET NOT NULL;

-- Unique active template per state
CREATE UNIQUE INDEX IF NOT EXISTS idx_lease_templates_active_per_state
  ON lease_templates(state_code) WHERE is_active = true;
```

## 7. Template authoring rules

- Use templating engine v1 (Phase 01 syntax).
- Pull state-specific limits via context, e.g.:
  ```
  Security deposit: {{ security_deposit | money }} (limit per {{ state_code }} law: {{ security_deposit_max_months | default:"no statutory cap" }} months' rent).
  ```
- Late-fee clause must say "If rent is more than {{ late_fee_grace_period_days }} days late...". Render uses the state row.
- Eviction clause must cite per-state notice days from the metadata.
- Holdover clause must branch on `holdover_rule`:
  ```
  {% if holdover_rule == "double_rent" %}...{% elsif holdover_rule == "month_to_month" %}...{% else %}...{% endif %}
  ```
- Every template ends with `{% include "common/disclaimer" %}`.
- Header includes statute citation block: `Governed by {{ state_name }} law. Primary authorities: {{ statute_security_deposit }}; {{ statute_eviction }}; {{ statute_entry }}.`

## 8. `generate-lease` behavior change

- If `app.lease_state_code` is missing → refuse with 400 `"Application is missing lease_state_code; cannot select template."`
- If no `is_active=true` template exists for that state → refuse with 400 `"No active lease template for state ${state}. Configure one in Admin → Leases → Templates."`

## 9. Acceptance criteria

- [ ] 10 templates seeded, one per state in {CA, TX, FL, NY, IL, OH, GA, NC, PA, MI}.
- [ ] Each template renders without errors against a synthetic application in that state.
- [ ] Generating a lease for an application with `lease_state_code='CA'` produces a CA-flavored PDF (deposit cap mentions 1 month, eviction notice mentions 3 days, includes AB-1482 just-cause clause).
- [ ] Generating with no state set returns the new error.
- [ ] Existing MI snapshot leases still render unchanged (verify with a known prior PDF in `lease_pdf_versions`).
- [ ] Admin UI lets you filter templates by state and shows `legal_review_status` badge per template.

## 10. Push checklist

- [ ] Status table row 03 = `DONE`.
- [ ] Commit: `Lease Phase 03 — multi-state base templates (top 10)`.
- [ ] STOP.

## 11. Blocked Questions / Completion Notes

(Filled in by completer.)
