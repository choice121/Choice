-- ============================================================================
-- Migration: Add original_description to pipeline_properties and update RPCs
--
-- Objective:
-- 1. Add `original_description` column to `pipeline.pipeline_properties`
--    to guarantee the original scraped text is preserved immutably and never lost.
-- 2. Update `pipeline_list`, `pipeline_folder_properties`, and `pipeline_save`
--    to return and support `original_description`.
-- ============================================================================

-- 1. Add column to pipeline.pipeline_properties if not exists
ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS original_description TEXT;

-- Backfill existing rows where original_description is null: set to description
UPDATE pipeline.pipeline_properties
SET original_description = description
WHERE original_description IS NULL AND description IS NOT NULL;

-- 2. Update pipeline_list RPC
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
      description, original_description, showing_instructions,
      pets_allowed, smoking_allowed, parking,
      minimum_lease_months, security_deposit, application_fee,
      garage_spaces, available_date, virtual_tour_url,
      has_basement, has_central_air,
      data_quality_score, missing_fields, edited_fields,
      original_image_urls, source_url, source, agent_name,
      poster_landlord_id, choice_property_id,
      scraped_at, updated_at, published_at,
      neighborhood, county, location_context,
      folder_id, folder_serial,
      photo_import_status, photo_upload_status
    FROM pipeline.pipeline_properties
    WHERE (p_status = 'all' OR status = p_status)
    ORDER BY updated_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pipeline_list(text,int,int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pipeline_list(text,int,int) TO authenticated;

-- 3. Update pipeline_folder_properties RPC
CREATE OR REPLACE FUNCTION public.pipeline_folder_properties(
  p_folder_id uuid
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
      description, original_description, showing_instructions,
      pets_allowed, smoking_allowed, parking,
      minimum_lease_months, security_deposit, application_fee,
      garage_spaces, available_date, virtual_tour_url,
      has_basement, has_central_air,
      data_quality_score, missing_fields, edited_fields,
      original_image_urls, source_url, source, agent_name,
      poster_landlord_id, choice_property_id,
      scraped_at, updated_at, published_at,
      neighborhood, county, location_context,
      folder_id, folder_serial,
      photo_import_status, photo_upload_status
    FROM pipeline.pipeline_properties
    WHERE folder_id = p_folder_id
    ORDER BY folder_serial ASC
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pipeline_folder_properties(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pipeline_folder_properties(uuid) TO authenticated;

-- 4. Update pipeline_save RPC to allow editing/updating original_description if provided
CREATE OR REPLACE FUNCTION public.pipeline_save(
  p_id    text,
  p_patch jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_existing pipeline.pipeline_properties%ROWTYPE;
  v_edited   text;
BEGIN
  SELECT * INTO v_existing FROM pipeline.pipeline_properties WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Not found');
  END IF;

  SELECT array_to_json(array_agg(DISTINCT e))::text
  INTO v_edited
  FROM (
    SELECT jsonb_array_elements_text(COALESCE(v_existing.edited_fields::jsonb, '[]'::jsonb)) AS e
    UNION
    SELECT key FROM jsonb_each_text(p_patch)
  ) t(e);

  UPDATE pipeline.pipeline_properties SET
    title                = COALESCE(p_patch->>'title',                title),
    address              = COALESCE(p_patch->>'address',              address),
    city                 = COALESCE(p_patch->>'city',                 city),
    state                = COALESCE(p_patch->>'state',                state),
    zip                  = COALESCE(p_patch->>'zip',                  zip),
    county               = COALESCE(p_patch->>'county',               county),
    neighborhood         = COALESCE(p_patch->>'neighborhood',         neighborhood),
    bedrooms             = COALESCE((p_patch->>'bedrooms')::int,      bedrooms),
    bathrooms            = COALESCE((p_patch->>'bathrooms')::float,   bathrooms),
    square_footage       = COALESCE((p_patch->>'square_footage')::int,square_footage),
    monthly_rent         = COALESCE((p_patch->>'monthly_rent')::int,  monthly_rent),
    security_deposit     = COALESCE((p_patch->>'security_deposit')::int, security_deposit),
    application_fee      = COALESCE((p_patch->>'application_fee')::int,  application_fee),
    property_type        = COALESCE(p_patch->>'property_type',        property_type),
    description          = COALESCE(p_patch->>'description',          description),
    original_description = COALESCE(p_patch->>'original_description', original_description),
    showing_instructions = COALESCE(p_patch->>'showing_instructions', showing_instructions),
    move_in_special      = COALESCE(p_patch->>'move_in_special',      move_in_special),
    available_date       = COALESCE(p_patch->>'available_date',       available_date),
    pets_allowed         = COALESCE((p_patch->>'pets_allowed')::boolean,   pets_allowed),
    smoking_allowed      = COALESCE((p_patch->>'smoking_allowed')::boolean,smoking_allowed),
    minimum_lease_months = COALESCE((p_patch->>'minimum_lease_months')::int, minimum_lease_months),
    garage_spaces        = COALESCE((p_patch->>'garage_spaces')::int, garage_spaces),
    virtual_tour_url     = COALESCE(p_patch->>'virtual_tour_url',     virtual_tour_url),
    has_basement         = COALESCE((p_patch->>'has_basement')::boolean,   has_basement),
    has_central_air      = COALESCE((p_patch->>'has_central_air')::boolean,has_central_air),
    poster_landlord_id   = COALESCE(p_patch->>'poster_landlord_id',   poster_landlord_id),
    location_context     = COALESCE(p_patch->>'location_context',     location_context),
    edited_fields        = COALESCE(v_edited, '[]'),
    status               = CASE WHEN status = 'scraped' THEN 'edited' ELSE status END,
    updated_at           = now()
  WHERE id = p_id;

  RETURN json_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pipeline_save(text,jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pipeline_save(text,jsonb) TO authenticated;
