-- ============================================================
-- Choice Properties: New columns migration
-- Run on Supabase dashboard → SQL Editor
-- All columns are nullable / have defaults — safe to run on live table
-- ============================================================

-- ── Contacted tracking ────────────────────────────────────────
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS contacted          BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contacted_at       TIMESTAMPTZ;

-- ── Holding fee tracking ──────────────────────────────────────
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS holding_fee_requested    BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS holding_fee_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS holding_fee_amount       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS holding_fee_due_date     DATE,
  ADD COLUMN IF NOT EXISTS holding_fee_paid         BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS holding_fee_paid_at      TIMESTAMPTZ;

-- ── Payment / receipt tracking ────────────────────────────────
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS payment_method_confirmed  TEXT,
  ADD COLUMN IF NOT EXISTS payment_transaction_ref   TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount_collected  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_confirmed_at      TIMESTAMPTZ;

-- ── Management countersign ────────────────────────────────────
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS management_cosigned        BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS management_cosigned_by     TEXT,
  ADD COLUMN IF NOT EXISTS management_cosigned_at     TIMESTAMPTZ;

-- ── Withdrawn status support ──────────────────────────────────
-- status column already exists; 'withdrawn' is a new allowed value
-- No schema change needed — it's a free-text column.
-- If you have a CHECK constraint, run:
--   ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
--   ALTER TABLE applications ADD CONSTRAINT applications_status_check
--     CHECK (status IN ('pending','approved','denied','withdrawn','cancelled'));

-- ── lease_status: co_signed value ────────────────────────────
-- lease_status is already free-text; 'co_signed' just becomes a new value.
-- No schema change needed.

-- ── Verify new columns ────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM   information_schema.columns
WHERE  table_name = 'applications'
  AND  column_name IN (
         'contacted','contacted_at',
         'holding_fee_requested','holding_fee_requested_at','holding_fee_amount',
         'holding_fee_due_date','holding_fee_paid','holding_fee_paid_at',
         'payment_method_confirmed','payment_transaction_ref',
         'payment_amount_collected','payment_confirmed_at',
         'management_cosigned','management_cosigned_by','management_cosigned_at'
       )
ORDER  BY column_name;
