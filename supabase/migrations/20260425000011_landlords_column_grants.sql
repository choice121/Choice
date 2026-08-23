-- ============================================================
-- 20260425000011_landlords_column_grants.sql
-- Follow-up to 20260425000010_landlords_public_view.sql.
--
-- The view-based fix in 000010 correctly closed the PII leak
-- (verified: anon GET /landlords?select=email returned 401),
-- but PostgREST view embedding still resolves FK joins through
-- the underlying table, so the property/listings page joins
-- broke.
--
-- This migration switches to the cleaner pattern:
--   * Anon gets SELECT GRANT only on the 7 safe columns the
--     public UI actually uses.
--   * Anon gets a SELECT row policy with qual=true (column GRANT
--     is the gate, not row visibility).
--   * Authenticated keeps the qual=true SELECT policy so logged-in
--     users (tenants, landlords, admins) still see landlord cards
--     on listings/property pages. Their full GRANT stays as it
--     was — column-level isolation for authenticated users is
--     tracked separately because it requires frontend RPC
--     refactors (Auth.requireLandlord, settings page, etc).
--
-- After this migration:
--   anon:
--     /landlords?select=business_name              200
--     /landlords?select=email                      401 (column denied)
--     /properties?select=*,landlords(business_name,...)   200
--     /properties?select=*,landlords(email)        401 (column denied)
--   authenticated:
--     unchanged from current behaviour (full table access via own_write
--     for own row; public landlord cards visible via the new policy).
-- ============================================================

-- 1) Safe-column allow-list for anon SELECT.
GRANT SELECT (id, user_id, contact_name, business_name, avatar_url, verified, tagline)
  ON public.landlords TO anon;

-- 2) Recreate row-level SELECT policies (the broad public_read was
--    dropped in 000010). Two separate policies keep the audit trail
--    crisp: anon has column-restricted access, authenticated has the
--    historical broad access (tracked in a follow-up issue).
DROP POLICY IF EXISTS landlords_public_read    ON public.landlords;
DROP POLICY IF EXISTS landlords_anon_safe_read ON public.landlords;
DROP POLICY IF EXISTS landlords_auth_read      ON public.landlords;

CREATE POLICY landlords_anon_safe_read ON public.landlords
  FOR SELECT TO anon USING (true);

CREATE POLICY landlords_auth_read ON public.landlords
  FOR SELECT TO authenticated USING (true);

-- 3) Force PostgREST schema cache reload so the new GRANTs and
--    policies are picked up immediately.
NOTIFY pgrst, 'reload schema';
