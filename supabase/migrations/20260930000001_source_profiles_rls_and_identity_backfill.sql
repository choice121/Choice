ALTER TABLE public.source_profiles ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON TABLE public.source_profiles FROM anon, authenticated;
GRANT SELECT (
  id, source, profile_type, display_name, image_url, profile_url,
  website_url, description, first_seen_at, last_seen_at
) ON public.source_profiles TO anon, authenticated;

DROP POLICY IF EXISTS source_profiles_public_read ON public.source_profiles;
CREATE POLICY source_profiles_public_read
  ON public.source_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER VIEW public.lease_renewals_due SET (security_invoker = true);
REVOKE SELECT ON public.lease_renewals_due FROM anon, authenticated;
GRANT SELECT ON public.lease_renewals_due TO service_role;

UPDATE pipeline.pipeline_properties
SET source = source
WHERE source_type IS NULL
   OR identity_strategy IS NULL
   OR identity_status IS NULL;