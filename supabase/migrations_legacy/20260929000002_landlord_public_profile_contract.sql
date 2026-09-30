-- Extend the existing anon-safe landlord projection for the public profile
-- page. Keep contact details, license numbers, address, and billing fields out.
CREATE OR REPLACE VIEW public.landlords_public AS
SELECT
  id,
  user_id,
  contact_name,
  business_name,
  avatar_url,
  verified,
  tagline,
  account_type,
  website,
  bio,
  specialties,
  years_experience,
  created_at,
  social_facebook,
  social_instagram,
  social_linkedin
FROM public.landlords;

ALTER VIEW public.landlords_public OWNER TO postgres;
GRANT SELECT ON public.landlords_public TO anon, authenticated;

COMMENT ON VIEW public.landlords_public IS
  'Public profile allow-list. Excludes email, phone, address, license number, '
  'and billing data; do not replace with a direct landlords table query.';

-- The profile page displays aggregate activity only. Applications remain
-- private; this returns counts for active listings without exposing rows.
CREATE OR REPLACE FUNCTION public.get_public_landlord_profile_stats(p_landlord_id uuid)
RETURNS TABLE(total_views bigint, total_applications bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE((
      SELECT SUM(COALESCE(p.views_count, 0))::bigint
      FROM public.properties AS p
      WHERE p.landlord_id = p_landlord_id
        AND p.status = 'active'
    ), 0)::bigint AS total_views,
    COALESCE((
      SELECT COUNT(*)::bigint
      FROM public.applications AS a
      JOIN public.properties AS p ON p.id = a.property_id
      WHERE p.landlord_id = p_landlord_id
        AND p.status = 'active'
    ), 0)::bigint AS total_applications;
$$;

ALTER FUNCTION public.get_public_landlord_profile_stats(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_public_landlord_profile_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_landlord_profile_stats(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_landlord_profile_stats(uuid) IS
  'Returns aggregate views and application counts for active listings only; never exposes application records.';