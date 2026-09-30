-- ============================================================
-- Enable RLS on public.applications + complete the policy set
-- ============================================================
-- Background: applications had RLS disabled despite tenant_select and
-- tenant_update policies being defined. With the anon key published in
-- /config.js, anyone could read every row of applicant PII via PostgREST.
--
-- This migration:
--   1. Re-creates the full set of policies idempotently:
--        - tenant_select   (self + co-applicant by email)
--        - tenant_update   (self only — withdraw / re-submit)
--        - landlord_select (applications tied to your own properties)
--        - admin_all       (admins do everything; uses is_admin() SECURITY DEFINER
--                           so it does not recurse through other policies)
--   2. Enables row level security.
--   3. Forces RLS even for the table owner so Studio queries also obey it.
--
-- Service-role keys (used by edge functions like receive-application,
-- generate-lease, sign-lease) bypass RLS entirely — no behavior change there.

-- Drop everything first so we land in a known-good state.
DROP POLICY IF EXISTS "applications_tenant_select"   ON public.applications;
DROP POLICY IF EXISTS "applications_tenant_update"   ON public.applications;
DROP POLICY IF EXISTS "applications_landlord_select" ON public.applications;
DROP POLICY IF EXISTS "applications_admin_all"       ON public.applications;
DROP POLICY IF EXISTS "Admins full access"           ON public.applications;

-- Tenant: read your own application (by user_id, your email, or as co-applicant)
CREATE POLICY "applications_tenant_select" ON public.applications
  FOR SELECT
  TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR lower(email) = lower(auth.email())
    OR lower(co_applicant_email) = lower(auth.email())
  );

-- Tenant: update only your own claimed application (e.g. withdraw)
CREATE POLICY "applications_tenant_update" ON public.applications
  FOR UPDATE
  TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR lower(email) = lower(auth.email())
  )
  WITH CHECK (
    applicant_user_id = auth.uid()
    OR lower(email) = lower(auth.email())
  );

-- Landlord: read applications tied to one of your own properties
CREATE POLICY "applications_landlord_select" ON public.applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.landlords l
      WHERE l.user_id = auth.uid()
        AND l.id = public.applications.landlord_id
    )
  );

-- Admin: full access. is_admin() is SECURITY DEFINER → no policy recursion.
CREATE POLICY "applications_admin_all" ON public.applications
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Turn it on. FORCE applies it to the table owner too, closing a subtle
-- bypass when admin connections happen to authenticate as the owner role.
ALTER TABLE public.applications ENABLE  ROW LEVEL SECURITY;
ALTER TABLE public.applications FORCE   ROW LEVEL SECURITY;

-- Belt-and-braces: make sure anon has no privileges that would matter even
-- if a policy were ever set to USING(true) by mistake.
REVOKE ALL ON public.applications FROM anon;
GRANT  SELECT, UPDATE ON public.applications TO authenticated;
GRANT  ALL ON public.applications TO service_role;
