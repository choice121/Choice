-- Phase 7: Add holding fee and payment tracking columns to applications table
-- Run this against your Supabase database via the SQL Editor or supabase CLI

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS holding_fee_requested    BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS holding_fee_amount        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS holding_fee_due_date      DATE,
  ADD COLUMN IF NOT EXISTS holding_fee_paid          BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS holding_fee_paid_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_amount_collected  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_method_confirmed  TEXT,
  ADD COLUMN IF NOT EXISTS payment_transaction_ref   TEXT;
