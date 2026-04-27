-- ============================================================
-- MIGRATION: Holding fee + payment tracking columns
-- Run against Supabase project: tlfmwetmhthpyrytrcfo
-- ============================================================

-- Holding fee workflow columns (referenced by send-email edge function)
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS holding_fee_requested     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS holding_fee_requested_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS holding_fee_amount        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS holding_fee_due_date      DATE,
  ADD COLUMN IF NOT EXISTS holding_fee_paid          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS holding_fee_paid_at       TIMESTAMPTZ;

-- Payment confirmation tracking (referenced by send-email + tenant portal)
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS payment_confirmed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_amount_collected   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_method_confirmed   TEXT,
  ADD COLUMN IF NOT EXISTS payment_transaction_ref    TEXT;

-- Manual payment recording (used by admin Mark Paid modal)
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS payment_amount_recorded    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_method_recorded    TEXT,
  ADD COLUMN IF NOT EXISTS payment_notes              TEXT;
