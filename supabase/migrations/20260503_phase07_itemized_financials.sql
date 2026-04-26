-- Choice Properties — Phase 07 — Itemized Financials + Utility Responsibility Matrix
--
-- Splits the lump-sum `move_in_costs` field into discrete components
-- (first/last month, deposits, fees) and adds a structured per-utility
-- responsibility matrix. `move_in_costs` is preserved as a backward-compat
-- legacy column; the new `lease_money_summary` view returns a normalized
-- breakdown that prefers the itemized components when present and falls
-- back to the legacy lump sum when they are not set.
--
-- Idempotent. Safe to re-run.

BEGIN;

-- 1. Itemized financial columns -------------------------------------------------

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS first_month_rent        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS last_month_rent         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pet_deposit             NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pet_rent                NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS admin_fee               NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS key_deposit             NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS parking_fee             NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cleaning_fee            NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cleaning_fee_refundable BOOLEAN,
  ADD COLUMN IF NOT EXISTS rent_due_day_of_month   INT     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rent_proration_method   TEXT    NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS prorated_first_month    NUMERIC(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_rent_due_day_chk'
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT applications_rent_due_day_chk
      CHECK (rent_due_day_of_month BETWEEN 1 AND 28);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_proration_method_chk'
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT applications_proration_method_chk
      CHECK (rent_proration_method IN ('daily','30day','none'));
  END IF;
END$$;

-- 2. Utility responsibility matrix ---------------------------------------------
--
-- Stored as a JSON object keyed by standard utility key. Each value is an
-- object: { "responsibility": "tenant"|"landlord"|"shared"|"n/a",
--           "notes": "optional free text" }.
--
-- Standard keys (validated by application code in _shared/utility-matrix.ts):
--   electric, gas, water, sewer, trash, recycling, internet, cable,
--   hoa, lawn_care, snow_removal, pest_control, pool_maintenance.
--
-- Custom non-standard keys are permitted but the admin UI only renders the
-- standard set by default.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS utility_responsibilities JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_utility_responsibilities_chk'
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT applications_utility_responsibilities_chk
      CHECK (jsonb_typeof(utility_responsibilities) = 'object');
  END IF;
END$$;

-- 3. lease_money_summary view --------------------------------------------------
--
-- Returns the canonical money breakdown for a row in `applications`, computing
-- the total of itemized components when any are present and falling back to the
-- legacy lump-sum `move_in_costs` otherwise. Caller-friendly numeric columns,
-- never NULL on the totals.

CREATE OR REPLACE VIEW lease_money_summary AS
SELECT
  a.id                                              AS application_id,
  a.app_id                                          AS app_id,
  a.monthly_rent,
  a.first_month_rent,
  a.last_month_rent,
  a.security_deposit,
  a.pet_deposit,
  a.pet_rent,
  a.admin_fee,
  a.key_deposit,
  a.parking_fee,
  a.cleaning_fee,
  a.cleaning_fee_refundable,
  a.prorated_first_month,
  a.move_in_costs                                   AS legacy_move_in_costs,

  -- "Has any itemized component" flag
  (a.first_month_rent IS NOT NULL
    OR a.last_month_rent IS NOT NULL
    OR a.pet_deposit IS NOT NULL
    OR a.admin_fee IS NOT NULL
    OR a.key_deposit IS NOT NULL
    OR a.parking_fee IS NOT NULL
    OR a.cleaning_fee IS NOT NULL
    OR a.prorated_first_month IS NOT NULL)         AS has_itemized,

  -- Total of itemized one-time charges due at move-in (excludes recurring pet_rent)
  COALESCE(
    NULLIF(
      COALESCE(a.prorated_first_month, a.first_month_rent, a.monthly_rent, 0)
      + COALESCE(a.last_month_rent, 0)
      + COALESCE(a.security_deposit, 0)
      + COALESCE(a.pet_deposit, 0)
      + COALESCE(a.admin_fee, 0)
      + COALESCE(a.key_deposit, 0)
      + COALESCE(a.parking_fee, 0)
      + COALESCE(a.cleaning_fee, 0),
      0),
    a.move_in_costs,
    0
  )                                                 AS computed_move_in_total,

  -- Recurring monthly add-ons
  COALESCE(a.monthly_rent, 0)
    + COALESCE(a.pet_rent, 0)
    + COALESCE(a.parking_fee, 0)                    AS estimated_monthly_total

FROM applications a;

GRANT SELECT ON lease_money_summary TO authenticated, anon;

-- 4. State-cap validation helper ----------------------------------------------
--
-- Returns NULL when the proposed deposit/fee combination is allowed by state
-- law, or a human-readable error string when it is not. Used by the
-- generate-lease edge function (which also performs the same checks in TS for
-- richer error UX) and as a defense-in-depth guard before lease finalization.

CREATE OR REPLACE FUNCTION validate_lease_financials(
  p_state_code             TEXT,
  p_monthly_rent           NUMERIC,
  p_security_deposit       NUMERIC,
  p_pet_deposit            NUMERIC,
  p_last_month_rent        NUMERIC,
  p_cleaning_fee           NUMERIC,
  p_cleaning_refundable    BOOLEAN
) RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_law           RECORD;
  v_combined_dep  NUMERIC;
  v_state         TEXT;
BEGIN
  v_state := UPPER(COALESCE(p_state_code, ''));
  IF v_state = '' OR p_monthly_rent IS NULL OR p_monthly_rent <= 0 THEN
    RETURN NULL; -- nothing to validate
  END IF;

  SELECT * INTO v_law FROM state_lease_law WHERE state_code = v_state;
  IF NOT FOUND THEN
    RETURN NULL; -- unknown state, fall back to permissive
  END IF;

  v_combined_dep := COALESCE(p_security_deposit, 0) + COALESCE(p_pet_deposit, 0);

  -- Security deposit cap (months of rent)
  IF v_law.security_deposit_max_months IS NOT NULL
     AND v_combined_dep > v_law.security_deposit_max_months * p_monthly_rent THEN
    RETURN format(
      '%s security deposit cap exceeded: combined deposits of $%s exceed %s month(s) of rent ($%s).',
      v_state,
      to_char(v_combined_dep, 'FM999,999,990.00'),
      v_law.security_deposit_max_months::TEXT,
      to_char(v_law.security_deposit_max_months * p_monthly_rent, 'FM999,999,990.00')
    );
  END IF;

  -- NY/MA combined last-month + security cap (where last_month_rent is held
  -- pre-paid it counts toward the deposit cap).
  IF v_state IN ('NY','MA')
     AND v_law.security_deposit_max_months IS NOT NULL
     AND COALESCE(p_last_month_rent, 0) + COALESCE(p_security_deposit, 0)
       > v_law.security_deposit_max_months * p_monthly_rent THEN
    RETURN format(
      '%s combined cap exceeded: last-month rent + security deposit ($%s) exceed %s month(s) of rent ($%s).',
      v_state,
      to_char(COALESCE(p_last_month_rent, 0) + COALESCE(p_security_deposit, 0), 'FM999,999,990.00'),
      v_law.security_deposit_max_months::TEXT,
      to_char(v_law.security_deposit_max_months * p_monthly_rent, 'FM999,999,990.00')
    );
  END IF;

  -- Cleaning fee refundability for states that prohibit non-refundable cleaning fees.
  IF p_cleaning_fee IS NOT NULL AND p_cleaning_fee > 0
     AND COALESCE(p_cleaning_refundable, true) = false
     AND v_state IN ('CA','MD') THEN
    RETURN format(
      '%s prohibits non-refundable cleaning fees. Mark the cleaning fee refundable or remove it.',
      v_state
    );
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_lease_financials(
  TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN
) TO authenticated;

COMMIT;
