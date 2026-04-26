-- ============================================================
-- 20260425000012_landlord_pii_rpcs.sql
--
-- Adds the SECURITY DEFINER RPCs the frontend needs once the
-- next migration (000013) restricts authenticated SELECT on
-- landlords to safe columns only. This migration is intentionally
-- backwards-compatible: it only ADDs functions, it does not
-- change any GRANT or policy. Safe to deploy in isolation.
--
--   get_my_landlord_profile()
--     Returns the calling user's own landlord row, full columns.
--     Replaces direct  select('*').eq('user_id', auth.uid())  reads
--     in Auth.requireLandlord and Landlords.getProfile.
--
--   update_my_landlord_profile(payload jsonb)
--     Updates the calling user's own landlord row with a whitelist
--     of mutable fields, returns the full updated row. Replaces the
--     .update().select().single() pattern in Landlords.update which
--     would otherwise lose its return after the column GRANTs land.
--     verified, account_type promotion to admin tiers, user_id, id,
--     created_at, and email are NOT mutable through this RPC.
--
--   admin_list_landlords(p_page, p_per_page)
--     Returns paginated landlord rows + total count as jsonb.
--     Admin-only (checks public.admin_roles for auth.uid()).
--     Replaces the .select('*, properties(count)') call in
--     Landlords.getAll which is consumed only by the admin
--     /admin/landlords page (verified by ripgrep audit).
-- ============================================================

-- ── get_my_landlord_profile ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_landlord_profile()
RETURNS public.landlords
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result public.landlords;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO result
  FROM public.landlords
  WHERE user_id = auth.uid()
  LIMIT 1;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_landlord_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_landlord_profile() TO authenticated;

-- ── update_my_landlord_profile ──────────────────────────────
CREATE OR REPLACE FUNCTION public.update_my_landlord_profile(payload jsonb)
RETURNS public.landlords
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
DECLARE
  result public.landlords;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.landlords SET
    contact_name     = CASE WHEN payload ? 'contact_name'     THEN payload->>'contact_name'     ELSE contact_name     END,
    business_name    = CASE WHEN payload ? 'business_name'    THEN payload->>'business_name'    ELSE business_name    END,
    tagline          = CASE WHEN payload ? 'tagline'          THEN payload->>'tagline'          ELSE tagline          END,
    bio              = CASE WHEN payload ? 'bio'              THEN payload->>'bio'              ELSE bio              END,
    license_number   = CASE WHEN payload ? 'license_number'   THEN payload->>'license_number'   ELSE license_number   END,
    years_experience = CASE WHEN payload ? 'years_experience' THEN NULLIF(payload->>'years_experience','')::int ELSE years_experience END,
    specialties      = CASE WHEN payload ? 'specialties'      THEN ARRAY(SELECT jsonb_array_elements_text(payload->'specialties')) ELSE specialties END,
    phone            = CASE WHEN payload ? 'phone'            THEN payload->>'phone'            ELSE phone            END,
    address          = CASE WHEN payload ? 'address'          THEN payload->>'address'          ELSE address          END,
    website          = CASE WHEN payload ? 'website'          THEN payload->>'website'          ELSE website          END,
    social_facebook  = CASE WHEN payload ? 'social_facebook'  THEN payload->>'social_facebook'  ELSE social_facebook  END,
    social_instagram = CASE WHEN payload ? 'social_instagram' THEN payload->>'social_instagram' ELSE social_instagram END,
    social_linkedin  = CASE WHEN payload ? 'social_linkedin'  THEN payload->>'social_linkedin'  ELSE social_linkedin  END,
    avatar_url       = CASE WHEN payload ? 'avatar_url'       THEN payload->>'avatar_url'       ELSE avatar_url       END,
    account_type     = CASE
      WHEN payload ? 'account_type'
       AND (payload->>'account_type') IN ('landlord','realtor','property_manager','agent')
      THEN payload->>'account_type'
      ELSE account_type
    END
  WHERE user_id = uid
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'No landlord row for current user' USING ERRCODE = '02000';
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_landlord_profile(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_landlord_profile(jsonb) TO authenticated;

-- ── admin_list_landlords ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_landlords(
  p_page     int DEFAULT 0,
  p_per_page int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  rows  jsonb;
  total bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden — admin only' USING ERRCODE = '42501';
  END IF;
  SELECT count(*)::bigint INTO total FROM public.landlords;
  SELECT COALESCE(jsonb_agg(l), '[]'::jsonb) INTO rows
  FROM (
    SELECT *
    FROM public.landlords
    ORDER BY created_at DESC
    LIMIT GREATEST(p_per_page, 0)
    OFFSET GREATEST(p_page, 0) * GREATEST(p_per_page, 0)
  ) l;
  RETURN jsonb_build_object('rows', rows, 'total', total);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_landlords(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_landlords(int, int) TO authenticated;

NOTIFY pgrst, 'reload schema';
