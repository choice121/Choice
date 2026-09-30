-- =========================================================
-- 20260421000002_security_hardening.sql
-- Phase 0: Lock down public exposure + pin function search_path.
--
-- Background:
--   * Several internal tables (pipeline_*, draft_applications,
--     _migration_history) were exposed via PostgREST with the
--     anon key because RLS was disabled. They are only meant to
--     be touched by edge functions (which use service_role and
--     bypass RLS).
--   * rate_limit_log had RLS enabled but no policies — flagged by
--     the linter as misconfigured. We add an explicit deny-all.
--   * Eight SECURITY DEFINER / trigger functions had a mutable
--     search_path. We pin them to (public, pg_temp) to prevent
--     search_path hijack attacks.
--
-- Applied to prod 2026-04-21 via Management API.
-- =========================================================

-- 1) RLS-deny anon/authenticated on internal tables
ALTER TABLE public.pipeline_properties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_enrichment_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_scrape_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._migration_history         ENABLE ROW LEVEL SECURITY;

-- 2) Explicit deny on rate_limit_log
DROP POLICY IF EXISTS deny_all_anon ON public.rate_limit_log;
CREATE POLICY deny_all_anon ON public.rate_limit_log
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- 3) Pin search_path on flagged functions
ALTER FUNCTION public.generate_lease_tokens(text)               SET search_path = public, pg_temp;
ALTER FUNCTION public.sign_lease_tenant(text, text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_property_id()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_counter(text, text, text)       SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin()                                SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at()                          SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_saves_count()                         SET search_path = public, pg_temp;
ALTER FUNCTION public.immutable_array_to_text(text[], text)     SET search_path = public, pg_temp;
