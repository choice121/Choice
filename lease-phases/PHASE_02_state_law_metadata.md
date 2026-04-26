# PHASE 02 — State Law Metadata Table

> Read `LEASE_IMPLEMENTATION.md` first. Mark this phase `IN PROGRESS` in the master status table before you write code.

**Status:** `TODO`
**Depends on:** Phase 01 (`DONE`)
**Blocks:** Phases 03, 04, 09, 11

---

## 1. Goal

Create one authoritative `state_lease_law` table seeded with all 50 states + DC, capturing the legal limits and required notice periods that vary by state. Every later phase pulls from this table instead of hardcoding rules.

## 2. Why

Today, MI rules are hardcoded in template prose ("5th day grace," "double-rent holdover," "7-day eviction notice"). With this table in place, the lease engine can read state-specific values at render time, and Phase 09's deposit-accounting logic can enforce the right return window per state.

## 3. Scope — IN

- New table `state_lease_law` with the column set in §6.
- One row per US state + DC (51 rows). Every row populated from public-domain statutes (cite each in the migration as a comment).
- Idempotent migration (re-running it does not duplicate rows; updates allowed via `ON CONFLICT (state_code) DO UPDATE`).
- New shared module `supabase/functions/_shared/state-law.ts` exposing:
  - `getStateLaw(client, state_code): Promise<StateLawRow | null>`
  - `validateLeaseAgainstState(law, lease): { ok: boolean; violations: string[] }` — checks deposit cap, late-fee structure, etc.
- Admin read-only view at `/admin/state-law.html` listing all states (no edit UI in this phase — owner-curated by SQL).

## 4. Scope — OUT

- No template changes. (Phase 03.)
- No disclosure attachments. (Phase 04.)
- No edge function changes beyond the new shared module.

## 5. Files to CREATE

```
supabase/migrations/20260428_phase02_state_lease_law.sql
supabase/functions/_shared/state-law.ts
admin/state-law.html
js/admin/state-law.js
```

## 6. Database migration — required columns

```sql
CREATE TABLE IF NOT EXISTS state_lease_law (
  state_code                          CHAR(2)     PRIMARY KEY,    -- 'CA', 'NY', 'DC' etc.
  state_name                          TEXT        NOT NULL,
  -- Security deposit
  security_deposit_max_months         NUMERIC(4,2),                -- e.g. 1.0, 1.5, 2.0; NULL = uncapped
  security_deposit_return_days        INT         NOT NULL,        -- days after move-out
  security_deposit_interest_required  BOOLEAN     NOT NULL DEFAULT false,
  security_deposit_separate_account   BOOLEAN     NOT NULL DEFAULT false,  -- FL, MA require
  security_deposit_bank_disclosure    BOOLEAN     NOT NULL DEFAULT false,  -- FL §83.49
  -- Late fees
  late_fee_grace_period_days          INT,                         -- 0 = due-day; NULL = no statutory grace
  late_fee_cap_pct_of_rent            NUMERIC(5,2),                -- e.g. 5.00 for 5%; NULL = no cap
  late_fee_cap_flat                   NUMERIC(10,2),               -- e.g. 50.00; NULL = no flat cap
  late_fee_no_fee_until_days          INT,                         -- MA = 30
  -- Entry / access
  entry_notice_hours                  INT         NOT NULL DEFAULT 24,
  entry_notice_emergency_exempt       BOOLEAN     NOT NULL DEFAULT true,
  -- Eviction notices
  eviction_notice_nonpayment_days     INT         NOT NULL,        -- e.g. CA=3, NY=14, FL=3
  eviction_notice_other_breach_days   INT         NOT NULL,
  -- Holdover
  holdover_rule                       TEXT        NOT NULL,        -- 'double_rent' | 'month_to_month' | 'court_discretion'
  -- Just-cause / rent control
  just_cause_required                 BOOLEAN     NOT NULL DEFAULT false,  -- CA AB-1482, OR SB-608
  rent_increase_notice_days           INT         NOT NULL DEFAULT 30,
  rent_increase_large_notice_days     INT,                         -- CA 90 days for >10% raise
  rent_increase_large_threshold_pct   NUMERIC(5,2),
  -- Required translations (Civ. §1632 etc.)
  required_translation_languages      JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- e.g. ["es","zh","tl","vi","ko"] for CA
  -- Statute citations (URLs to public-domain text)
  statute_security_deposit            TEXT,
  statute_late_fees                   TEXT,
  statute_entry                       TEXT,
  statute_eviction                    TEXT,
  statute_holdover                    TEXT,
  -- Meta
  notes                               TEXT,
  source_last_reviewed                DATE,
  reviewed_by                         TEXT,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE state_lease_law ENABLE ROW LEVEL SECURITY;

CREATE POLICY "state_lease_law_admin_all" ON state_lease_law FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));

CREATE POLICY "state_lease_law_anon_read" ON state_lease_law FOR SELECT TO anon USING (true);
-- Public read because we publish the values on the marketplace (no PII).
```

## 7. Seed data requirements

You MUST seed all 51 rows. For each state, derive values from these public-domain sources:
- Each state's official Code/Statutes site (e.g. `leginfo.legislature.ca.gov`, `nysenate.gov/legislation`, `flrules.elaws.us`, `legislature.mi.gov`).
- HUD's `https://www.hud.gov/topics/rental_assistance/tenantrights` overview.
- Each state attorney general's tenant-landlord guide.

Cite the source in a SQL comment above each `INSERT`. Example:

```sql
-- CA: deposit cap 1 mo (Civ. §1950.5 as amended by AB-12, eff. 2024-07-01); return 21 days;
--     just-cause AB-1482; required translations Civ. §1632.
-- Source: https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5
INSERT INTO state_lease_law (...) VALUES ('CA', 'California', 1.0, 21, ...) ON CONFLICT (state_code) DO UPDATE SET ...;
```

If you cannot confirm a value from a public-domain source within the session, set the column NULL and add a `notes` entry like `"deposit_cap unverified — flag for attorney review"`. Do NOT guess values.

## 8. Acceptance criteria

- [ ] 51 rows in `state_lease_law` after migration.
- [ ] Every row has `statute_security_deposit` and `statute_eviction` URLs populated.
- [ ] `getStateLaw('CA')` returns the CA row with deposit cap = 1.0.
- [ ] `validateLeaseAgainstState(getStateLaw('CA'), { security_deposit: 4500, monthly_rent: 2000 })` returns `{ ok: false, violations: [...] }` (because 4500 > 1×2000).
- [ ] Admin page `/admin/state-law.html` lists all 51 rows in a sortable table.
- [ ] Migration is idempotent (run twice, count stays 51).

## 9. Push checklist

- [ ] Master status table row 02 = `DONE`, completion fields filled.
- [ ] Push commit `Lease Phase 02 — state law metadata table`.
- [ ] STOP.

## 10. Blocked Questions / Completion Notes

(Filled in by completer.)
