-- ============================================================
-- agent_issues — self-cleaning issue tracker for AI agents
-- ============================================================
-- The DB is the single source of truth for what is currently broken.
-- Resolved rows leave the public.open_issues view immediately and are
-- hard-deleted after 30 days by purge_resolved_agent_issues().
--
-- Access path: the agent-helper Pages Function (functions/api/agent-helper.js)
-- uses the service-role key to read/write. No direct anon/authenticated access.

CREATE TABLE IF NOT EXISTS public.agent_issues (
  id              BIGSERIAL PRIMARY KEY,
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  description     TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 8000),
  severity        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (severity IN ('critical','high','medium','low','info')),
  component       TEXT NOT NULL DEFAULT 'general',
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','resolved')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  created_by      TEXT NOT NULL DEFAULT 'unknown',
  resolved_by     TEXT,
  resolution_note TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT agent_issues_resolved_consistency
    CHECK ((status = 'resolved' AND resolved_at IS NOT NULL)
        OR (status = 'open'     AND resolved_at IS NULL))
);

CREATE INDEX IF NOT EXISTS agent_issues_status_idx
  ON public.agent_issues (status, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_issues_resolved_at_idx
  ON public.agent_issues (resolved_at)
  WHERE status = 'resolved';

ALTER TABLE public.agent_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_issues_service_only ON public.agent_issues;
CREATE POLICY agent_issues_service_only ON public.agent_issues
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.agent_issues FROM PUBLIC, anon, authenticated;
GRANT  ALL ON public.agent_issues TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.agent_issues_id_seq TO service_role;

-- View used by `list_issues`. Severity-ordered, hides resolved.
CREATE OR REPLACE VIEW public.open_issues AS
SELECT
  id,
  title,
  description,
  severity,
  component,
  created_at,
  created_by,
  metadata
FROM public.agent_issues
WHERE status = 'open'
ORDER BY
  CASE severity
    WHEN 'critical' THEN 0
    WHEN 'high'     THEN 1
    WHEN 'medium'   THEN 2
    WHEN 'low'      THEN 3
    ELSE 4
  END,
  created_at DESC;

REVOKE ALL ON public.open_issues FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON public.open_issues TO service_role;

-- Hard-delete anything resolved more than 30 days ago.
-- Call from a daily cron (pg_cron, scheduled GH Action, or manual).
CREATE OR REPLACE FUNCTION public.purge_resolved_agent_issues()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH d AS (
    DELETE FROM public.agent_issues
    WHERE status = 'resolved'
      AND resolved_at IS NOT NULL
      AND resolved_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO deleted_count FROM d;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_resolved_agent_issues() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.purge_resolved_agent_issues() TO service_role;
