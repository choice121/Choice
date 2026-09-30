-- ============================================================
-- 20260425000010_landlords_public_view.sql
-- Fixes deep-scan H-1 (issue #5): landlords.landlords_public_read
-- policy uses qual=true and the table is granted to anon, so
-- anon traffic can SELECT every column (email, phone, address,
-- zip, license_number, plan, etc.) of every landlord row.
--
-- Verified live on 2026-04-25 — anon key returned real emails
-- and phone numbers.
--
-- Strategy:
--   * Create a SECURITY DEFINER view `landlords_public` that
--     exposes only the columns the public UI actually uses
--     (id, user_id, contact_name, business_name, avatar_url,
--     verified, tagline). Grepping the frontend confirmed no
--     other landlord columns are referenced by anon code paths.
--   * Drop the qual=true `landlords_public_read` policy on the
--     base table.
--   * Revoke direct anon SELECT on the base table.
--   * Authenticated keeps full SELECT/INSERT/UPDATE/DELETE on
--     the base table — RLS now restricts to own_write rows only,
--     so a logged-in landlord can still read/edit *their own*
--     full row (settings page) but cannot read another
--     landlord's PII.
--   * The frontend joins on listings/property pages are migrated
--     from `landlords(...)` to `landlords_public(...)` in the
--     same commit.
--
-- Idempotent and safe to re-run.
-- ============================================================

-- 1) Public projection view (safe column allow-list).
DROP VIEW IF EXISTS public.landlords_public CASCADE;
CREATE VIEW public.landlords_public AS
  SELECT
    id,
    user_id,
    contact_name,
    business_name,
    avatar_url,
    verified,
    tagline
  FROM public.landlords;

COMMENT ON VIEW public.landlords_public IS
  'Anon-safe projection of public.landlords. Use for any embed/join '
  'served to unauthenticated traffic. Owners and admins should query '
  'public.landlords directly, where RLS will restrict them to their '
  'own row (own_write) or all rows (admin_all).';

-- View runs as its owner (postgres = superuser), bypassing RLS on the
-- underlying table — that is the whole point: it lets anon read the
-- 7 safe columns without giving them direct table access.
ALTER VIEW public.landlords_public OWNER TO postgres;

-- 2) Open the view to anon + authenticated traffic.
GRANT SELECT ON public.landlords_public TO anon, authenticated;

-- 3) Close the leak on the base table.
DROP POLICY IF EXISTS landlords_public_read ON public.landlords;

-- Anon should not touch the base table at all anymore.
REVOKE SELECT ON public.landlords FROM anon;

-- Authenticated keeps full GRANT — RLS is the gate. landlords_own_write
-- (qual = user_id = auth.uid()) and landlords_admin_all (qual = is_admin())
-- limit row visibility; column access is unrestricted for those rows.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landlords TO authenticated;
