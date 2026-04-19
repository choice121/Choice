-- Migration: draft_applications table
-- Purpose: Store temporary form progress for cross-device Save & Resume Later.
-- Drafts are keyed by a random token included in the resume URL that is emailed
-- to the applicant. Rows expire after 7 days and are cleaned up by the app.
--
-- Run this against your Supabase project once before deploying the save-draft
-- Edge Function.

CREATE TABLE IF NOT EXISTS draft_applications (
  token                TEXT        PRIMARY KEY,
  email                TEXT        NOT NULL,
  data                 JSONB       NOT NULL DEFAULT '{}',
  property_fingerprint TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS draft_applications_token_idx ON draft_applications (token);

-- Index to support expiry queries and email-based lookups
CREATE INDEX IF NOT EXISTS draft_applications_created_at_idx ON draft_applications (created_at);
CREATE INDEX IF NOT EXISTS draft_applications_email_idx ON draft_applications (email);

-- RLS: drafts are accessed only via the service-role key from Edge Functions,
-- so no client-facing policies are needed. Disable RLS entirely for this table.
ALTER TABLE draft_applications DISABLE ROW LEVEL SECURITY;
