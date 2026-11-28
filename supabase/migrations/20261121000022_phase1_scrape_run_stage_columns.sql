-- ============================================================================
-- Migration 000022: Phase 1 — Apify Scrape Run Stage Tracking & Two-Stage Defaults
-- ============================================================================
-- 1. Adds additive stage telemetry columns to pipeline.pipeline_scrape_runs:
--      - scrape_stage     ('single' | 'search' | 'detail') DEFAULT 'single'
--      - extraction_depth ('full_data' | 'with_insights') DEFAULT 'full_data'
--      - adapter_key      TEXT
-- 2. Updates public.pipeline_list_scrape_runs(TEXT, INTEGER) to expose the new
--    stage/depth/adapter metadata.
-- 3. Updates public.scraping_providers ('apify') config_json cleanly while
--    preserving all existing settings: sets Proven Maxcopell two-stage pair
--    (maxcopell/zillow-scraper -> maxcopell/zillow-detail-scraper) as default
--    and keeps experimental actors disabled without explicit opt-in.
-- ============================================================================

ALTER TABLE pipeline.pipeline_scrape_runs
  ADD COLUMN IF NOT EXISTS scrape_stage     TEXT NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS extraction_depth TEXT NOT NULL DEFAULT 'full_data',
  ADD COLUMN IF NOT EXISTS adapter_key      TEXT;

ALTER TABLE pipeline.pipeline_scrape_runs
  DROP CONSTRAINT IF EXISTS chk_pipeline_scrape_runs_scrape_stage;
ALTER TABLE pipeline.pipeline_scrape_runs
  ADD CONSTRAINT chk_pipeline_scrape_runs_scrape_stage
  CHECK (scrape_stage IN ('single', 'search', 'detail'));

ALTER TABLE pipeline.pipeline_scrape_runs
  DROP CONSTRAINT IF EXISTS chk_pipeline_scrape_runs_extraction_depth;
ALTER TABLE pipeline.pipeline_scrape_runs
  ADD CONSTRAINT chk_pipeline_scrape_runs_extraction_depth
  CHECK (extraction_depth IN ('full_data', 'with_insights'));

CREATE INDEX IF NOT EXISTS idx_pipeline_scrape_runs_parent_stage
  ON pipeline.pipeline_scrape_runs (parent_scrape_run_id, scrape_stage)
  WHERE parent_scrape_run_id IS NOT NULL;

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
      dataset_id, status, scrape_stage, extraction_depth, adapter_key,
      source, location, count_total, count_new, count_duplicate,
      count_watermarked, count_validation_rejected, count_image_failed,
      avg_score, cursor_offset, raw_archive_prefix, partial, error_message,
      idempotency_key, started_at, completed_at, key_fingerprint, key_label,
      parent_scrape_run_id, continuation_depth, failover_events, meta_json
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

UPDATE public.scraping_providers
SET
  config_json = COALESCE(config_json, '{}'::jsonb) || jsonb_build_object(
    'actor_id', 'maxcopell/zillow-scraper',
    'detail_actor_id', 'maxcopell/zillow-detail-scraper',
    'two_stage_details', true,
    'default_extraction_depth', 'full_data',
    'allow_experimental_actor', false
  ),
  updated_at = now()
WHERE provider_key = 'apify';

NOTIFY pgrst, 'reload schema';
