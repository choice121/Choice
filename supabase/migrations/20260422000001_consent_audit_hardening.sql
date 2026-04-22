-- Choice Properties — Server-side hardening: consent audit, bot logging, idempotency
-- Date: 2026-04-22
-- Adds:
--   * applications.submission_uuid (UUID) + unique partial index for idempotent POSTs
--   * consent_log table — immutable record of every accepted Terms/Privacy/SMS consent
--   * bot_attempts table — every honeypot trip, for trend analysis & blocklisting
--   * purge_old_logs() function — TTL cleanup (run from a cron/edge function)

-- ── 1. Idempotency key on applications ──────────────────────────────────────
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS submission_uuid uuid;

-- Partial unique index: only enforce uniqueness when set (older rows have NULL)
CREATE UNIQUE INDEX IF NOT EXISTS applications_submission_uuid_uidx
  ON applications (submission_uuid)
  WHERE submission_uuid IS NOT NULL;

-- ── 2. Consent log (append-only, no updates/deletes from app code) ──────────
CREATE TABLE IF NOT EXISTS consent_log (
  id              bigserial PRIMARY KEY,
  app_id          text,                       -- nullable: drafts may have no app yet
  submission_uuid uuid,
  email           text NOT NULL,
  consent_version text NOT NULL,
  terms_consent   boolean NOT NULL,
  sms_consent     boolean NOT NULL DEFAULT false,
  ip              inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_log_app_id_idx ON consent_log (app_id);
CREATE INDEX IF NOT EXISTS consent_log_email_idx  ON consent_log (lower(email));
CREATE INDEX IF NOT EXISTS consent_log_created_idx ON consent_log (created_at DESC);

ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically; admins can read.
DROP POLICY IF EXISTS "consent_log_admin_read" ON consent_log;
CREATE POLICY "consent_log_admin_read" ON consent_log
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_roles WHERE admin_roles.user_id = auth.uid()));

-- Block all client-side writes/updates/deletes (service role still bypasses).
DROP POLICY IF EXISTS "consent_log_no_client_write" ON consent_log;
CREATE POLICY "consent_log_no_client_write" ON consent_log
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ── 3. Bot attempts (honeypot trips, malformed payloads) ────────────────────
CREATE TABLE IF NOT EXISTS bot_attempts (
  id           bigserial PRIMARY KEY,
  ip           inet,
  user_agent   text,
  endpoint     text NOT NULL,
  reason       text NOT NULL,        -- 'honeypot' | 'invalid_email' | 'no_property' | etc.
  payload_hash text,                 -- sha256 of payload, for dedup analysis
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bot_attempts_ip_idx ON bot_attempts (ip);
CREATE INDEX IF NOT EXISTS bot_attempts_created_idx ON bot_attempts (created_at DESC);

ALTER TABLE bot_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bot_attempts_admin_read" ON bot_attempts;
CREATE POLICY "bot_attempts_admin_read" ON bot_attempts
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_roles WHERE admin_roles.user_id = auth.uid()));

DROP POLICY IF EXISTS "bot_attempts_no_client_write" ON bot_attempts;
CREATE POLICY "bot_attempts_no_client_write" ON bot_attempts
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ── 4. TTL cleanup function ─────────────────────────────────────────────────
-- Run from a daily cron / scheduled edge function:
--    select purge_old_logs();
-- Retention defaults:
--   rate_limit_log : 7 days
--   bot_attempts   : 90 days
--   consent_log    : 7 years (compliance — DO NOT shorten without legal review)
CREATE OR REPLACE FUNCTION purge_old_logs() RETURNS TABLE (
  table_name text,
  rows_deleted bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  n bigint;
BEGIN
  DELETE FROM rate_limit_log WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  table_name := 'rate_limit_log'; rows_deleted := n; RETURN NEXT;

  DELETE FROM bot_attempts WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  table_name := 'bot_attempts'; rows_deleted := n; RETURN NEXT;

  -- Drafts older than 30 days (well past the 7-day resume window)
  DELETE FROM draft_applications WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  table_name := 'draft_applications'; rows_deleted := n; RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION purge_old_logs() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION purge_old_logs() TO service_role;
