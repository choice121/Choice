-- ============================================================
-- 20260426000001 — C-3: Close tenant-portal account-takeover hole
-- ============================================================
-- Background:
--   `auth.mailer_autoconfirm = true` means anyone can sign up with
--   any email and immediately log in (no inbox proof). The existing
--   tenant_portal RLS / RPC keys access off `lower(email) = lower(auth.email())`,
--   so an attacker could read a victim's applications by signing up
--   with the victim's email.
--
--   The auth-side fix (mailer_autoconfirm = false, raise password
--   min length, enable HIBP, drop jwt_exp) is applied via the
--   Supabase Management API in the same change set as this migration.
--
--   This migration adds defense-in-depth at the database layer so the
--   hole stays closed even if mailer_autoconfirm is ever flipped back.
-- ============================================================

-- ---------- 1. Hardened email-confirmation helper ----------
-- Returns the lowercase confirmed email of the currently authenticated
-- user, or NULL if the user has not yet confirmed their inbox. Marked
-- STABLE + SECURITY DEFINER + locked search_path so it's safe to call
-- from RLS policies and RPCs without bringing JIT into auth schema.
CREATE OR REPLACE FUNCTION public.current_confirmed_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT lower(u.email)
  FROM auth.users u
  WHERE u.id = auth.uid()
    AND u.email_confirmed_at IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.current_confirmed_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_confirmed_email() TO authenticated;

COMMENT ON FUNCTION public.current_confirmed_email() IS
  'Returns lower(email) of the caller IFF their inbox is confirmed. Used by tenant-portal policies/RPCs to block account-takeover via unverified signup.';

-- ---------- 2. Tighten tenant_portal_state ----------
-- The RPC was returning rows whenever `applicant_email = lower(auth.email())`.
-- Now we additionally require the caller to have a confirmed email AND
-- check against the SECURITY DEFINER helper so an unconfirmed signup
-- can never reach a victim's row.
--
-- A previous migration created tenant_portal_state(text) with a slightly
-- different return shape, so CREATE OR REPLACE would fail with
-- 42P13 ("cannot change return type"). Drop the old definition first;
-- the only callers (tenant portal page + cp-api.js helper) consume the
-- returned jsonb generically and don't care about the column layout.
DROP FUNCTION IF EXISTS public.tenant_portal_state(text);

CREATE FUNCTION public.tenant_portal_state(p_app_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_email text;
  v_app   record;
  v_amendments jsonb;
BEGIN
  v_email := public.current_confirmed_email();
  IF v_email IS NULL THEN
    -- Caller has not confirmed their email — refuse.
    RETURN NULL;
  END IF;

  SELECT a.*
    INTO v_app
  FROM public.applications a
  WHERE a.id::text = p_app_id
    AND lower(a.applicant_email) = v_email
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id',           la.id,
           'created_at',   la.created_at,
           'effective_at', la.effective_at,
           'reason',       la.reason,
           'status',       la.status,
           'tenant_signed_at', la.tenant_signed_at,
           'landlord_signed_at', la.landlord_signed_at
         ) ORDER BY la.created_at DESC), '[]'::jsonb)
    INTO v_amendments
  FROM public.lease_amendments la
  WHERE la.application_id = v_app.id;

  RETURN jsonb_build_object(
    'application_id',     v_app.id,
    'status',             v_app.status,
    'property_id',        v_app.property_id,
    'lease_executed_at',  v_app.lease_executed_at,
    'amendments',         v_amendments
  );
END
$$;

REVOKE ALL ON FUNCTION public.tenant_portal_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_portal_state(text) TO authenticated;

COMMENT ON FUNCTION public.tenant_portal_state(text) IS
  'C-3 hardened: requires authenticated AND email_confirmed_at IS NOT NULL before returning any application data.';

-- ---------- 3. Tighten direct-table tenant_portal_select policy ----------
-- Some callers still query `applications` via PostgREST instead of the RPC.
-- Drop any pre-existing tenant_portal_select policy and re-create it with
-- the same email-confirmed gate.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'applications'
      AND policyname = 'tenant_portal_select'
  ) THEN
    EXECUTE 'DROP POLICY tenant_portal_select ON public.applications';
  END IF;
END
$$;

CREATE POLICY tenant_portal_select
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (
    lower(applicant_email) = public.current_confirmed_email()
  );

COMMENT ON POLICY tenant_portal_select ON public.applications IS
  'C-3: tenants see their own applications only when they have a confirmed inbox.';
