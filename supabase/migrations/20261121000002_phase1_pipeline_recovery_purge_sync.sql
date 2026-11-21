-- =============================================================================
-- Phase 1 — Pipeline Recovery & Purge Synchronization Helpers
-- Date: 2026-11-21
-- Purpose:
--   1. Expose an idempotent admin/service diagnostic RPC
--      `public.pipeline_recovery_health()` summarizing `pipeline_recovery_archive`
--      row counts, next expiry window, and active pg_cron job schedules (#7/#10).
--   2. Keep all existing 24h recovery guarantees and raw Storage payload purge
--      semantics 100% intact.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pipeline_recovery_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline', 'cron'
AS $$
DECLARE
  v_counts       jsonb;
  v_jobs         jsonb;
  v_next_expiry  timestamptz;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  SELECT COALESCE(jsonb_object_agg(recovery_status, cnt), '{}'::jsonb)
  INTO v_counts
  FROM (
    SELECT recovery_status, count(*)::int AS cnt
    FROM pipeline.pipeline_recovery_archive
    GROUP BY recovery_status
  ) s;

  SELECT min(recovery_expires_at)
  INTO v_next_expiry
  FROM pipeline.pipeline_recovery_archive
  WHERE recovery_status = 'recoverable';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'jobid', jobid,
    'jobname', jobname,
    'schedule', schedule,
    'active', active
  ) ORDER BY jobid), '[]'::jsonb)
  INTO v_jobs
  FROM cron.job
  WHERE jobname IN ('mark-expired-pipeline-recovery', 'purge-expired-property-recovery');

  RETURN jsonb_build_object(
    'ok', true,
    'status_counts', v_counts,
    'next_recoverable_expiry', v_next_expiry,
    'cron_jobs', v_jobs,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_recovery_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pipeline_recovery_health() TO authenticated, service_role;
