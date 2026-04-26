-- ============================================================
-- 20260425000013_landlords_auth_column_grants.sql
--
-- Closes the H-1b follow-up to issue #5: authenticated tenants
-- could read every landlord's PII (email, phone, address, etc)
-- via direct PostgREST GET /rest/v1/landlords. After this migration
-- they can only SELECT the seven public-card columns directly;
-- their own full row is fetched via get_my_landlord_profile() RPC
-- (added in 000012), and admins page through admin_list_landlords()
-- (also 000012).
--
-- Pre-conditions (all already in place):
--   * 000011 column-GRANTed anon to the same 7 safe columns.
--   * 000012 added the three SECURITY DEFINER RPCs.
--   * Frontend in commit <pinned in commit message> already calls
--     the RPCs instead of select('*') and dropped the landlords(*)
--     embed from Properties.getOne.
--
-- Post-conditions verified live:
--   anon         GET /landlords?select=email   → 401 (column denied)
--   anon         GET /landlords?select=business_name → 200
--   tenant       GET /landlords?select=email   → 401 (column denied)
--   tenant       GET /landlords?select=business_name → 200
--   landlord     RPC get_my_landlord_profile() → full own row
--   admin        RPC admin_list_landlords()    → all rows + count
-- ============================================================

-- 1) Strip the broad SELECT GRANT on the table from authenticated.
REVOKE SELECT ON public.landlords FROM authenticated;

-- 2) GRANT only the seven public-card columns back to authenticated.
--    Identical column set as anon (000011) — public landlord cards
--    on listings/property pages must keep working for logged-in users.
GRANT SELECT (id, user_id, contact_name, business_name, avatar_url, verified, tagline)
  ON public.landlords TO authenticated;

-- 3) Recreate the SELECT row policy so authenticated users still
--    see all rows (column GRANT is the column-level gate now,
--    not row visibility). The policy is intentionally USING(true)
--    — same shape as landlords_anon_safe_read.
DROP POLICY IF EXISTS landlords_auth_read ON public.landlords;
CREATE POLICY landlords_auth_read ON public.landlords
  FOR SELECT TO authenticated USING (true);

-- 4) Force PostgREST to pick up the new column GRANTs immediately.
NOTIFY pgrst, 'reload schema';
