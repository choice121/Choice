-- ============================================================================
-- Phase 5: Apify Default Scraping Engine & Dual-Channel Worker Integration
-- ============================================================================
-- 1. Extends pipeline.pipeline_scrape_runs with batch_id, batch_uuid,
--    provider_key, actor_id, provider_run_id, dataset_id, status,
--    cursor_offset, raw_archive_prefix, and task_config_snapshot.
-- 2. Adds idempotency & batch-scoped telemetry indexes.
-- 3. Adds least-privilege RPC public.pipeline_list_scrape_runs(TEXT, INTEGER)
--    for admin/worker inspection.
-- ============================================================================

ALTER TABLE pipeline.pipeline_scrape_runs
  ADD COLUMN IF NOT EXISTS batch_id             TEXT REFERENCES public.publishing_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_uuid           UUID,
  ADD COLUMN IF NOT EXISTS provider_key         TEXT NOT NULL DEFAULT 'apify',
  ADD COLUMN IF NOT EXISTS actor_id             TEXT,
  ADD COLUMN IF NOT EXISTS provider_run_id      TEXT,
  ADD COLUMN IF NOT EXISTS dataset_id           TEXT,
  ADD COLUMN IF NOT EXISTS status               TEXT NOT NULL DEFAULT 'running',
  ADD COLUMN IF NOT EXISTS cursor_offset        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_archive_prefix   TEXT,
  ADD COLUMN IF NOT EXISTS task_config_snapshot JSONB;

ALTER TABLE pipeline.pipeline_scrape_runs
  DROP CONSTRAINT IF EXISTS chk_pipeline_scrape_runs_status;
ALTER TABLE pipeline.pipeline_scrape_runs
  ADD CONSTRAINT chk_pipeline_scrape_runs_status
  CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_scrape_runs_batch_started
  ON pipeline.pipeline_scrape_runs (batch_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_provider_run
  ON pipeline.pipeline_scrape_runs (provider_key, provider_run_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scrape_runs_idempotency
  ON pipeline.pipeline_scrape_runs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

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
      partial, error_message, idempotency_key, started_at, completed_at
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
