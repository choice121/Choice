-- ============================================================================
-- Phase 10: Multi-Key Apify Key Pool, Instant Failover & Run Continuation
-- ============================================================================
-- 1. Creates pipeline.apify_api_keys to store encrypted admin-managed keys,
--    health/cooldown/quota telemetry, and Edge-secret key state tracking.
-- 2. Extends pipeline.pipeline_scrape_runs with key_fingerprint, key_label,
--    parent_scrape_run_id, continuation_depth, and failover_events.
-- 3. Adds least-privilege SECURITY DEFINER RPCs for atomic key recovery,
--    run-start usage tracking, and instant cooldown/exhaustion transitions.
-- 4. Updates public.pipeline_list_scrape_runs to expose failover metadata.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline.apify_api_keys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label             TEXT NOT NULL,
  key_fingerprint   TEXT NOT NULL UNIQUE,
  encrypted_token   TEXT,
  token_suffix      TEXT NOT NULL,
  source            TEXT NOT NULL DEFAULT 'admin_pool',
  priority          INTEGER NOT NULL DEFAULT 100,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  status            TEXT NOT NULL DEFAULT 'active',
  cooldown_until    TIMESTAMPTZ,
  monthly_reset_at  TIMESTAMPTZ,
  usage_usd_cached  NUMERIC(10, 4),
  limit_usd_cached  NUMERIC(10, 4),
  apify_username    TEXT,
  last_error        TEXT,
  last_error_code   INTEGER,
  runs_started      INTEGER NOT NULL DEFAULT 0,
  failover_count    INTEGER NOT NULL DEFAULT 0,
  last_used_at      TIMESTAMPTZ,
  last_checked_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pipeline.apify_api_keys
  DROP CONSTRAINT IF EXISTS chk_apify_api_keys_source;
ALTER TABLE pipeline.apify_api_keys
  ADD CONSTRAINT chk_apify_api_keys_source
  CHECK (source IN ('admin_pool', 'edge_secret'));

ALTER TABLE pipeline.apify_api_keys
  DROP CONSTRAINT IF EXISTS chk_apify_api_keys_status;
ALTER TABLE pipeline.apify_api_keys
  ADD CONSTRAINT chk_apify_api_keys_status
  CHECK (status IN ('active', 'rate_limited', 'exhausted', 'invalid', 'disabled'));

CREATE INDEX IF NOT EXISTS idx_apify_api_keys_selection
  ON pipeline.apify_api_keys (enabled, status, priority, created_at);

REVOKE ALL ON TABLE pipeline.apify_api_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE pipeline.apify_api_keys TO service_role;

ALTER TABLE pipeline.pipeline_scrape_runs
  ADD COLUMN IF NOT EXISTS key_fingerprint       TEXT,
  ADD COLUMN IF NOT EXISTS key_label             TEXT,
  ADD COLUMN IF NOT EXISTS parent_scrape_run_id  BIGINT REFERENCES pipeline.pipeline_scrape_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS continuation_depth    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failover_events       JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_scrape_runs_parent_run
  ON pipeline.pipeline_scrape_runs (parent_scrape_run_id)
  WHERE parent_scrape_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scrape_runs_key_fingerprint
  ON pipeline.pipeline_scrape_runs (key_fingerprint)
  WHERE key_fingerprint IS NOT NULL;

-- Auto-promote keys whose rate-limit cooldown or monthly quota window has elapsed
CREATE OR REPLACE FUNCTION public.pipeline_apify_auto_recover_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_recovered INTEGER := 0;
BEGIN
  UPDATE pipeline.apify_api_keys
  SET
    status = 'active',
    cooldown_until = NULL,
    last_error = NULL,
    last_error_code = NULL,
    updated_at = now()
  WHERE enabled = true
    AND (
      (status = 'rate_limited' AND cooldown_until IS NOT NULL AND cooldown_until <= now())
      OR (status = 'exhausted' AND monthly_reset_at IS NOT NULL AND monthly_reset_at <= now())
    );

  GET DIAGNOSTICS v_recovered = ROW_COUNT;
  RETURN v_recovered;
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_apify_auto_recover_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pipeline_apify_auto_recover_keys() TO service_role;

-- Atomically mark a key active/rate_limited/exhausted/invalid
CREATE OR REPLACE FUNCTION public.pipeline_apify_key_mark_state(
  p_key_fingerprint    TEXT,
  p_status             TEXT,
  p_error_code         INTEGER DEFAULT NULL,
  p_error              TEXT DEFAULT NULL,
  p_cooldown_seconds   INTEGER DEFAULT NULL,
  p_monthly_reset_at   TIMESTAMPTZ DEFAULT NULL,
  p_increment_failover BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_cooldown TIMESTAMPTZ;
  v_reset_at TIMESTAMPTZ;
  v_row      pipeline.apify_api_keys%ROWTYPE;
BEGIN
  IF p_status NOT IN ('active', 'rate_limited', 'exhausted', 'invalid', 'disabled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_key_status');
  END IF;

  IF p_status = 'rate_limited' THEN
    v_cooldown := now() + make_interval(secs => GREATEST(COALESCE(p_cooldown_seconds, 90), 5));
  ELSE
    v_cooldown := NULL;
  END IF;

  IF p_status = 'exhausted' THEN
    v_reset_at := COALESCE(
      p_monthly_reset_at,
      date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month'
    );
  ELSE
    v_reset_at := p_monthly_reset_at;
  END IF;

  UPDATE pipeline.apify_api_keys
  SET
    status = CASE WHEN enabled = false THEN 'disabled' ELSE p_status END,
    cooldown_until = v_cooldown,
    monthly_reset_at = COALESCE(v_reset_at, monthly_reset_at),
    last_error = CASE WHEN p_status = 'active' THEN NULL ELSE LEFT(COALESCE(p_error, ''), 500) END,
    last_error_code = CASE WHEN p_status = 'active' THEN NULL ELSE p_error_code END,
    failover_count = failover_count + CASE WHEN p_increment_failover THEN 1 ELSE 0 END,
    last_checked_at = now(),
    updated_at = now()
  WHERE key_fingerprint = p_key_fingerprint
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'key_not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'key_fingerprint', v_row.key_fingerprint,
    'status', v_row.status,
    'cooldown_until', v_row.cooldown_until,
    'monthly_reset_at', v_row.monthly_reset_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_apify_key_mark_state(TEXT, TEXT, INTEGER, TEXT, INTEGER, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pipeline_apify_key_mark_state(TEXT, TEXT, INTEGER, TEXT, INTEGER, TIMESTAMPTZ, BOOLEAN) TO service_role;

-- Atomically record a successful key invocation
CREATE OR REPLACE FUNCTION public.pipeline_apify_key_record_use(
  p_key_fingerprint TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
BEGIN
  UPDATE pipeline.apify_api_keys
  SET
    runs_started = runs_started + 1,
    last_used_at = now(),
    last_checked_at = now(),
    last_error = NULL,
    last_error_code = NULL,
    status = CASE WHEN enabled THEN 'active' ELSE 'disabled' END,
    cooldown_until = NULL,
    updated_at = now()
  WHERE key_fingerprint = p_key_fingerprint;
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_apify_key_record_use(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pipeline_apify_key_record_use(TEXT) TO service_role;

-- Expose failover/key metadata on scrape run listings
CREATE OR REPLACE FUNCTION public.pipeline_list_scrape_runs(
  p_batch_id TEXT DEFAULT NULL,
  p_limit    INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_batch_id TEXT := NULLIF(regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', ''), '');
  v_limit    INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_rows     JSONB;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.started_at DESC, r.id DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      id, batch_id, batch_uuid, provider_key, actor_id, provider_run_id,
      dataset_id, status, source, location, count_total, count_new,
      count_duplicate, count_watermarked, count_validation_rejected,
      count_image_failed, avg_score, cursor_offset, raw_archive_prefix,
      partial, error_message, idempotency_key, started_at, completed_at,
      key_fingerprint, key_label, parent_scrape_run_id, continuation_depth,
      failover_events, meta_json
    FROM pipeline.pipeline_scrape_runs
    WHERE v_batch_id IS NULL OR batch_id = v_batch_id
    ORDER BY started_at DESC, id DESC
    LIMIT v_limit
  ) r;

  RETURN jsonb_build_object('ok', true, 'batch_id', v_batch_id, 'runs', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_list_scrape_runs(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pipeline_list_scrape_runs(TEXT, INTEGER) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
