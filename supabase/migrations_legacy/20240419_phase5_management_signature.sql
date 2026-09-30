-- Phase 5: Add management signature columns to applications table
-- Run this against your Supabase database via the SQL Editor or supabase CLI

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS management_signed        BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS management_signer_name   TEXT,
  ADD COLUMN IF NOT EXISTS management_signed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS management_notes         TEXT,
  -- These may already exist from earlier migration — safe with IF NOT EXISTS
  ADD COLUMN IF NOT EXISTS management_cosigned      BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS management_cosigned_by   TEXT,
  ADD COLUMN IF NOT EXISTS management_cosigned_at   TIMESTAMPTZ;

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_applications_management_signed ON applications(management_signed);
