# PHASE 07 — Itemized Financials + Utility Responsibility Matrix

**Status:** `DONE` (April 26 2026 — shipped in 3 chunks)
**Depends on:** Phase 01, 02, 03 (`DONE`)
**Blocks:** Phase 09

### Shipped commits

| Chunk | Commit | What it shipped |
|-------|--------|-----------------|
| 1/3 — backend foundation | `c52a2f9` | DB schema (`applications` itemized columns, `utility_responsibilities`, `rent_due_day_of_month`, `rent_proration_method`); shared `utility-matrix.ts`, `proration.ts`; `buildLeaseRenderContext()` exposing `move_in_breakdown_html`, `utility_table_html`, `proration_explanation`, `move_in_total`, `utility_summary` |
| 2/3 — admin UI | `8495ec3` | Itemized financial inputs + utility matrix grid wired into the admin lease-generation form; lease body renders the Phase 07 HTML for new applications |
| 3/3 — template seed refresh | _(this commit)_ | Two new partials (`common/move_in_breakdown`, `common/utility_matrix`); all 10 active state templates refactored to delegate to those partials so Section 6 owns the financial breakdown and Section 7 owns the utility matrix; `lease_template_versions` snapshot row inserted per template |

---

## 1. Goal

Replace the single `move_in_costs` lump sum with itemized financial fields (deposit components, fees) and add a structured per-utility responsibility matrix that renders into the lease and surfaces in the tenant portal.

## 2. Why

Today landlords enter "$5,000 move-in costs" as one number. At move-out we have no way to know which $1,500 is refundable security deposit vs first-month rent vs non-refundable cleaning fee. State laws treat these very differently (especially CA, MA, NY). And "Utilities: tenant" as free text fails to reflect the common reality that gas may be tenant-paid while water is landlord-paid.

## 3. Scope — IN

### 3.1 Financial schema split
Add nullable columns to `applications` (and to the future `leases` table once Phase 10 lifts it):

```sql
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS first_month_rent      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS last_month_rent       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pet_deposit           NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pet_rent              NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS admin_fee             NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS key_deposit           NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS parking_fee           NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cleaning_fee          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cleaning_fee_refundable BOOLEAN,
  ADD COLUMN IF NOT EXISTS rent_due_day_of_month INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rent_proration_method TEXT NOT NULL DEFAULT 'daily';  -- 'daily'|'30day'|'none'
```

`move_in_costs` stays for backward compatibility but becomes a **derived computed column** going forward (sum of components). Add a helper view `lease_money_summary` that returns the breakdown and total.

### 3.2 State validations (uses Phase 02 metadata)
- `security_deposit + pet_deposit > law.security_deposit_max_months × monthly_rent` → admin form rejects with state-cited error.
- `cleaning_fee_refundable = false` while state law requires it refundable (CA, MD, IL Chicago) → reject.
- `last_month_rent + security_deposit > combined cap` (NY, MA rules) → reject.

### 3.3 Utility responsibility matrix
- Add column `utility_responsibilities JSONB NOT NULL DEFAULT '{}'::jsonb` on `applications`.
- Standard keys: `electric`, `gas`, `water`, `sewer`, `trash`, `recycling`, `internet`, `cable`, `hoa`, `lawn_care`, `snow_removal`, `pest_control`, `pool_maintenance`.
- Each value is one of: `tenant` | `landlord` | `shared` | `n/a` (with optional `notes` per-key).
- Admin form: structured matrix UI (one row per utility, dropdown for responsibility, optional notes).
- Template engine renders this as a table in the lease body using a `{% for utility in utilities %}` partial.

### 3.4 Pro-ration helper
- New shared `_shared/proration.ts`: `computeFirstMonthProration({ moveInDate, monthlyRent, dueDay, method }): { proratedAmount, fullMonthAmount, prorationDays, explanation }`.
- Admin "Generate Lease" UI shows proposed pro-rated first month + explanation, editable.

## 4. Scope — OUT

- Actually charging or collecting money. Off-roadmap forever (master §6).
- Late-fee auto-application. Off-roadmap.
- Rent receipts / payment ledger. (May come in a future phase.)

## 5. Files to CREATE / MODIFY

```
CREATE: supabase/migrations/20260503_phase07_itemized_financials.sql
CREATE: supabase/functions/_shared/proration.ts
CREATE: supabase/functions/_shared/utility-matrix.ts
MODIFY: admin/lease-detail.html                 (financial breakdown UI)
MODIFY: js/admin/lease-detail.js
MODIFY: supabase/functions/generate-lease/index.ts  (validate against state law)
MODIFY: supabase/functions/_shared/pdf.ts            (utility table renderer)
MODIFY: lease templates seeded in Phase 03           (use new variables)
```

## 6. Acceptance criteria

- [ ] Admin form has discrete inputs for first_month, last_month, security, pet_deposit, pet_rent, admin_fee, key_deposit, parking_fee, cleaning_fee + cleaning refundability checkbox.
- [ ] Utility matrix UI shows all 13 standard utilities with dropdown + notes.
- [ ] Generated lease PDF renders financial breakdown table and utility responsibility table.
- [ ] CA app with security_deposit > 1 month rent rejects with `"CA security deposit cap exceeded (Civ. §1950.5: max 1 month rent for unfurnished as of 7/1/2024)."`.
- [ ] First-month proration shown on admin UI and matches the lease body.
- [ ] Existing applications with only `move_in_costs` still render (legacy fallback).

## 7. Push & Stop

- [ ] Master row 07 = `DONE`. Commit: `Lease Phase 07 — itemized financials + utility matrix`. STOP.
