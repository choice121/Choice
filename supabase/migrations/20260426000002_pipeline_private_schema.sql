-- ============================================================
-- 20260426000002 — M-10: Move data-pipeline tables out of public
-- ============================================================
-- Background:
--   `public.pipeline_properties` (~35,388 rows / ~65 MB) and
--   `public.pipeline_enrichment_log` (~2,313 rows) and
--   `public.pipeline_scrape_runs` are internal data-ingest tables
--   that the front-end never queries. They sit in `public` with
--   RLS enabled but zero policies — meaning any future grant on the
--   schema would expose them. Move them to a private `pipeline`
--   schema and drop all anon/authenticated grants.
-- ============================================================

-- 1. Create the private schema (idempotent).
CREATE SCHEMA IF NOT EXISTS pipeline;

-- 2. Lock it down: only postgres + service_role can use it.
REVOKE ALL ON SCHEMA pipeline FROM PUBLIC;
REVOKE ALL ON SCHEMA pipeline FROM anon;
REVOKE ALL ON SCHEMA pipeline FROM authenticated;
GRANT  USAGE ON SCHEMA pipeline TO service_role;

-- 3. Move the tables. Use IF EXISTS so reruns are no-ops.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pipeline_properties','pipeline_enrichment_log','pipeline_scrape_runs']
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA pipeline', t);
    END IF;
  END LOOP;
END
$$;

-- 4. Belt-and-suspenders: revoke any lingering grants on the relocated tables.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pipeline_properties','pipeline_enrichment_log','pipeline_scrape_runs']
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'pipeline' AND c.relname = t
    ) THEN
      EXECUTE format('REVOKE ALL ON pipeline.%I FROM PUBLIC, anon, authenticated', t);
      EXECUTE format('GRANT  ALL ON pipeline.%I TO service_role', t);
      -- RLS is no longer load-bearing now that the schema itself is locked,
      -- but leave it enabled for defense in depth.
      EXECUTE format('ALTER TABLE pipeline.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END
$$;

COMMENT ON SCHEMA pipeline IS
  'Internal data-ingest tables. Service-role only — never granted to anon or authenticated.';
