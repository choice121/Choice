-- ============================================================
-- 20260928000001 — provenance timestamps for source/import/publish semantics
-- ============================================================
-- Keeps original source listing date and verification timestamps separate from
-- workflow timestamps such as import and publication time.

ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS listed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_last_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_status TEXT DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS listed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_last_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_status TEXT DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

UPDATE pipeline.pipeline_properties
SET listed_at = COALESCE(listed_at, (original_data::jsonb->>'list_date')::timestamptz)
WHERE listed_at IS NULL
  AND original_data IS NOT NULL
  AND original_data != ''
  AND original_data::jsonb->>'list_date' IS NOT NULL
  AND original_data::jsonb->>'list_date' ~ '^\d{4}-\d{2}-\d{2}'
  AND imported_at IS NULL;

UPDATE public.properties
SET listed_at = COALESCE(listed_at, created_at)
WHERE listed_at IS NULL;

CREATE OR REPLACE FUNCTION public.pipeline_list(
  p_status text DEFAULT 'scraped',
  p_limit  int  DEFAULT 50,
  p_offset int  DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      id, status, title, address, city, state, zip,
      bedrooms, bathrooms, square_footage, monthly_rent,
      property_type, year_built, unit_number,
      description, showing_instructions,
      pets_allowed, smoking_allowed, parking,
      minimum_lease_months, security_deposit, application_fee,
      garage_spaces, available_date, virtual_tour_url,
      has_basement, has_central_air,
      data_quality_score, missing_fields, edited_fields,
      original_image_urls, source_url, source, agent_name,
      poster_landlord_id, choice_property_id,
      scraped_at, updated_at, published_at,
      neighborhood, county, location_context,
      listed_at, source_last_updated_at, imported_at, source_status, last_verified_at,
      lat, lng
    FROM pipeline.pipeline_properties
    WHERE (p_status = 'all' OR status = p_status)
    ORDER BY COALESCE(listed_at, imported_at, scraped_at::timestamptz) DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pipeline_list(text,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pipeline_list(text,int,int) TO authenticated;
