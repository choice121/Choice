-- Anonymous visitors must use the explicit properties_public allow-list.
-- This keeps source URLs, scraper identity fields, private notes, and
-- lease-duration data out of direct PostgREST reads from public.properties.
REVOKE ALL PRIVILEGES ON TABLE public.properties FROM anon;

DO $$
DECLARE
  grant_row RECORD;
BEGIN
  FOR grant_row IN
    SELECT DISTINCT column_name, privilege_type
      FROM information_schema.column_privileges
     WHERE table_schema = 'public'
       AND table_name = 'properties'
       AND grantee = 'anon'
  LOOP
    EXECUTE format(
      'REVOKE %s (%I) ON TABLE public.properties FROM anon',
      grant_row.privilege_type,
      grant_row.column_name
    );
  END LOOP;
END;
$$;

-- Keep profile names/images available through the canonical public profile
-- layer, but never expose third-party source links as public contact paths.
REVOKE SELECT (profile_url, website_url)
  ON TABLE public.source_profiles FROM anon;