-- ============================================================
-- Fix Pipeline Publish Full Fidelity Migration
-- 1. Adds original_description column to public.properties if missing
-- 2. Restores photo transfer from pipeline_properties into public.property_photos
-- 3. Transfers flooring, total_bathrooms, and original_description to public.properties
-- ============================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS original_description text;

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
  v_photos      jsonb;
  v_elem        jsonb;
  v_url         text;
  v_file_id     text;
  v_width       int;
  v_height      int;
  v_order       int := 1;
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
    title, description, original_description, showing_instructions,
    address, city, state, zip, county, neighborhood,
    lat, lng, property_type, year_built, floors,
    unit_number, total_units,
    bedrooms, bathrooms, half_bathrooms, total_bathrooms, square_footage,
    lot_size_sqft, garage_spaces,
    monthly_rent, security_deposit, last_months_rent,
    application_fee, pet_deposit, admin_fee, move_in_special,
    available_date, minimum_lease_months, lease_terms,
    pets_allowed, pet_details, pet_weight_limit, smoking_allowed,
    parking, parking_fee,
    amenities, appliances, utilities_included, flooring,
    heating_type, cooling_type, laundry_type,
    location_context, virtual_tour_url, has_basement, has_central_air,
    listed_at, source_last_updated_at, imported_at, source_status, last_verified_at
  ) VALUES (
    new_id,
    COALESCE(p_landlord_id, p.poster_landlord_id::uuid),
    'active',
    p.title, p.description, COALESCE(p.original_description, p.description), p.showing_instructions,
    p.address, p.city, p.state, p.zip, p.county, p.neighborhood,
    p.lat, p.lng,
    p.property_type, p.year_built, p.floors,
    p.unit_number, p.total_units,
    p.bedrooms, p.bathrooms, p.half_bathrooms, COALESCE(p.total_bathrooms, p.bathrooms), p.square_footage,
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
    CASE WHEN p.flooring IS NOT NULL AND p.flooring <> '' AND p.flooring <> '[]'
         THEN p.flooring::jsonb ELSE NULL END,
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

  -- Photo transfer to public.property_photos
  v_photos := NULL;
  IF p.local_image_paths IS NOT NULL AND p.local_image_paths <> '' AND p.local_image_paths <> '[]' THEN
    BEGIN v_photos := p.local_image_paths::jsonb; EXCEPTION WHEN OTHERS THEN v_photos := NULL; END;
  END IF;
  IF v_photos IS NULL OR jsonb_array_length(v_photos) = 0 THEN
    IF p.original_image_urls IS NOT NULL AND p.original_image_urls <> '' AND p.original_image_urls <> '[]' THEN
      BEGIN v_photos := p.original_image_urls::jsonb; EXCEPTION WHEN OTHERS THEN v_photos := NULL; END;
    END IF;
  END IF;

  IF v_photos IS NOT NULL AND jsonb_typeof(v_photos) = 'array' THEN
    v_order := 1;
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_photos)
    LOOP
      v_url := NULL;
      v_file_id := NULL;
      v_width := NULL;
      v_height := NULL;

      IF jsonb_typeof(v_elem) = 'string' THEN
        v_url := v_elem #>> '{}';
      ELSIF jsonb_typeof(v_elem) = 'object' THEN
        v_url := v_elem->>'url';
        v_file_id := v_elem->>'fileId';
        IF v_elem ? 'width' AND jsonb_typeof(v_elem->'width') = 'number' THEN
          v_width := (v_elem->>'width')::int;
        END IF;
        IF v_elem ? 'height' AND jsonb_typeof(v_elem->'height') = 'number' THEN
          v_height := (v_elem->>'height')::int;
        END IF;
      END IF;

      IF v_url IS NOT NULL AND length(v_url) > 5 THEN
        INSERT INTO public.property_photos (
          id, property_id, url, file_id, width, height, display_order, is_hero, watermark_status, created_at
        ) VALUES (
          gen_random_uuid(),
          new_id,
          v_url,
          v_file_id,
          v_width,
          v_height,
          v_order,
          (v_order = 1),
          'clean',
          CURRENT_TIMESTAMP
        );
        v_order := v_order + 1;
      END IF;
    END LOOP;
  END IF;

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
