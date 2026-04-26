-- 20260426000003_client_errors_and_monitoring.sql
--
-- Phase 1 of the AI-monitoring loop (no payment, no new accounts).
-- Adds:
--   1. public.client_errors                   raw browser-side error log
--   2. public.report_client_error()           rate-limited public RPC
--   3. extra columns on public.agent_issues   (kind, detector, evidence,
--                                              fingerprint, auto_fix_attempts)
--
-- All three pieces let the existing public.agent_issues table act as the
-- single nervous system for monitoring + future auto-fix work.

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. client_errors  — JS errors captured by /js/cp-error-reporter.js
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_errors (
  id              BIGSERIAL PRIMARY KEY,
  fingerprint     TEXT NOT NULL,
  message         TEXT NOT NULL,
  stack           TEXT,
  page_path       TEXT,                  -- query string + hash always stripped
  user_agent      TEXT,
  browser_lang    TEXT,
  hit_count       INTEGER NOT NULL DEFAULT 1,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT client_errors_fingerprint_uniq UNIQUE (fingerprint)
);

CREATE INDEX IF NOT EXISTS client_errors_last_seen_idx
  ON public.client_errors (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS client_errors_hit_count_idx
  ON public.client_errors (hit_count DESC);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

-- anon and authenticated cannot read or write the table directly. All
-- inserts go through report_client_error() (SECURITY DEFINER, rate-limited).
DROP POLICY IF EXISTS deny_all_anon_clienterrors ON public.client_errors;
CREATE POLICY deny_all_anon_clienterrors ON public.client_errors
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_all_auth_clienterrors ON public.client_errors;
CREATE POLICY deny_all_auth_clienterrors ON public.client_errors
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Admins can read.
DROP POLICY IF EXISTS admin_read_client_errors ON public.client_errors;
CREATE POLICY admin_read_client_errors ON public.client_errors
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid()
  ));

-- ────────────────────────────────────────────────────────────
-- 2. report_client_error RPC — anon-callable, rate-limited
-- ────────────────────────────────────────────────────────────
-- Caps:
--   * Field-level length limits applied silently (never errors back to caller).
--   * Per-fingerprint rate limit: drop if same fp already hit > 60 times in
--     the last minute (catches runaway in-page error loops).
--   * Empty fingerprint or empty message → no-op.
--   * On conflict the row's hit_count++ and last_seen_at refresh, so storage
--     stays bounded by the number of distinct error fingerprints.
CREATE OR REPLACE FUNCTION public.report_client_error(
  p_fingerprint  TEXT,
  p_message      TEXT,
  p_stack        TEXT,
  p_page_path    TEXT,
  p_user_agent   TEXT,
  p_browser_lang TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent_hits INTEGER;
BEGIN
  p_fingerprint  := substr(coalesce(p_fingerprint,  ''), 1, 64);
  p_message      := substr(coalesce(p_message,      ''), 1, 1000);
  p_stack        := substr(coalesce(p_stack,        ''), 1, 4000);
  p_page_path    := substr(coalesce(p_page_path,    ''), 1, 256);
  p_user_agent   := substr(coalesce(p_user_agent,   ''), 1, 256);
  p_browser_lang := substr(coalesce(p_browser_lang, ''), 1, 32);

  IF length(p_fingerprint) = 0 OR length(p_message) = 0 THEN
    RETURN;
  END IF;

  SELECT hit_count INTO v_recent_hits
    FROM public.client_errors
    WHERE fingerprint = p_fingerprint
      AND last_seen_at > NOW() - INTERVAL '1 minute';

  IF v_recent_hits IS NOT NULL AND v_recent_hits > 60 THEN
    RETURN;  -- silently drop runaway errors
  END IF;

  INSERT INTO public.client_errors AS ce
    (fingerprint, message, stack, page_path, user_agent, browser_lang)
  VALUES
    (p_fingerprint, p_message, p_stack, p_page_path, p_user_agent, p_browser_lang)
  ON CONFLICT (fingerprint) DO UPDATE
    SET hit_count    = ce.hit_count + 1,
        last_seen_at = NOW(),
        message      = EXCLUDED.message,
        stack        = EXCLUDED.stack,
        page_path    = EXCLUDED.page_path;
END;
$$;

REVOKE ALL ON FUNCTION public.report_client_error(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_client_error(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT)
  TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 3. agent_issues — extra columns to make it a real work queue
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.agent_issues
  ADD COLUMN IF NOT EXISTS kind                TEXT,
  ADD COLUMN IF NOT EXISTS detector            TEXT,
  ADD COLUMN IF NOT EXISTS evidence            JSONB,
  ADD COLUMN IF NOT EXISTS fingerprint         TEXT,
  ADD COLUMN IF NOT EXISTS auto_fix_attempts   INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS agent_issues_fingerprint_uniq
  ON public.agent_issues (fingerprint)
  WHERE fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_issues_kind_status_idx
  ON public.agent_issues (kind, status);

COMMIT;
