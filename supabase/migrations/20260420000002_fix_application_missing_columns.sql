-- Migration: Fix application submission failure
  -- Issue: receive-application edge function inserts 6 columns that did not exist
  -- in the applications table, causing every submission to fail with
  -- "Failed to save application".
  -- Fix: Add the missing columns and relax phone NOT NULL constraint.

  -- 1. Add missing columns that the edge function inserts
  ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS reference_1_relationship  TEXT,
    ADD COLUMN IF NOT EXISTS reference_2_relationship  TEXT,
    ADD COLUMN IF NOT EXISTS co_applicant_first_name   TEXT,
    ADD COLUMN IF NOT EXISTS co_applicant_last_name    TEXT,
    ADD COLUMN IF NOT EXISTS co_applicant_email        TEXT,
    ADD COLUMN IF NOT EXISTS co_applicant_phone        TEXT;

  -- 2. Make phone nullable -- edge function passes null when applicant omits phone,
  --    but the column was NOT NULL, causing a constraint violation on every insert
  --    where the applicant did not provide a phone number.
  ALTER TABLE applications ALTER COLUMN phone DROP NOT NULL;
  