-- ============================================================
-- 20260928000002 — enforce provenance contract in SQL views and publish flow
-- ============================================================
-- This keeps the database contract aligned with the shared TypeScript builder
-- and the public/admin UI: source listing date, import timestamp, and
-- verification state are stored and surfaced independently.

ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS source_last_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS source_last_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

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

CREATE OR REPLACE FUNCTION public.pipeline_publish(
  p_id          text,
  p_landlord_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  p             pipeline.pipeline_properties%ROWTYPE;
  new_id        text;
  v_avail       date;
  v_listed      date;
  v_imported_at timestamptz;
BEGIN
  SELECT * INTO p FROM pipeline.pipeline_properties WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Listing not found in pipeline');
  END IF;

  IF p.title IS NULL OR p.address IS NULL OR p.city IS NULL
     OR p.state IS NULL OR p.zip IS NULL OR p.monthly_rent IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Missing required fields: title, address, city, state, zip, monthly_rent');
  END IF;

  new_id := gen_random_uuid()::text;

  IF p.available_date IS NOT NULL AND p.available_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_avail := p.available_date::date;
  ELSE
    v_avail := CURRENT_DATE;
  END IF;

  IF p.listed_at IS NOT NULL THEN
    v_listed := p.listed_at;
  ELSIF p.scraped_at IS NOT NULL THEN
    v_listed := p.scraped_at::date;
  ELSE
    v_listed := CURRENT_DATE;
  END IF;

  v_imported_at := COALESCE(p.imported_at, p.scraped_at::timestamptz, now());

  INSERT INTO public.properties (
    id, landlord_id, status,
    title, description, showing_instructions,
    address, city, state, zip, county, neighborhood,
    lat, lng, property_type, year_built, floors,
    unit_number, total_units,
    bedrooms, bathrooms, half_bathrooms, square_footage,
    lot_size_sqft, garage_spaces,
    monthly_rent, security_deposit, last_months_rent,
    application_fee, pet_deposit, admin_fee, move_in_special,
    available_date, minimum_lease_months, lease_terms,
    pets_allowed, pet_details, pet_weight_limit, smoking_allowed,
    parking, parking_fee,
    amenities, appliances, utilities_included,
    heating_type, cooling_type, laundry_type,
    location_context, virtual_tour_url, has_basement, has_central_air,
    listed_at, source_last_updated_at, imported_at, source_status, last_verified_at
  ) VALUES (
    new_id,
    COALESCE(p_landlord_id, p.poster_landlord_id::uuid),
    'active',
    p.title, p.description, p.showing_instructions,
    p.address, p.city, p.state, p.zip, p.county, p.neighborhood,
    p.lat, p.lng,
    p.property_type, p.year_built, p.floors,
    p.unit_number, p.total_units,
    p.bedrooms, p.bathrooms, p.half_bathrooms, p.square_footage,
    p.lot_size_sqft, p.garage_spaces,
    p.monthly_rent,
    COALESCE(p.security_deposit, p.monthly_rent),
    p.last_months_rent,
    50,
    p.pet_deposit, p.admin_fee, p.move_in_special,
    v_avail,
    NULL,
    NULL,
    true,
    p.pet_details, p.pet_weight_limit,
    false,
    p.parking, p.parking_fee,
    CASE WHEN p.amenities IS NOT NULL AND p.amenities <> '' AND p.amenities <> '[]'
         THEN p.amenities::jsonb ELSE NULL END,
    CASE WHEN p.appliances IS NOT NULL AND p.appliances <> '' AND p.appliances <> '[]'
         THEN p.appliances::jsonb ELSE NULL END,
    CASE WHEN p.utilities_included IS NOT NULL AND p.utilities_included <> '' AND p.utilities_included <> '[]'
         THEN p.utilities_included::jsonb ELSE NULL END,
    p.heating_type, p.cooling_type, p.laundry_type,
    p.location_context, p.virtual_tour_url,
    COALESCE(p.has_basement, false),
    COALESCE(p.has_central_air, false),
    v_listed,
    p.source_last_updated_at,
    v_imported_at,
    COALESCE(p.source_status, 'available'),
    p.last_verified_at
  );

  UPDATE pipeline.pipeline_properties
  SET status             = 'published',
      choice_property_id = new_id,
      imported_at        = COALESCE(imported_at, now()),
      published_at       = now()::text,
      updated_at         = now()
  WHERE id = p_id;

  RETURN json_build_object('ok', true, 'choice_property_id', new_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pipeline_publish(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pipeline_publish(text,uuid) TO authenticated, service_role, anon;
