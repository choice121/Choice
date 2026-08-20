-- ============================================================================
-- Migration: Unify ImageKit Single Source of Truth for Properties & Pipeline
-- ============================================================================

-- 1. Upgrade public.pipeline_publish
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
  p            pipeline.pipeline_properties%ROWTYPE;
  new_id       text;
  v_avail      date;
  v_listed     text;
  v_photos     jsonb;
  v_elem       jsonb;
  v_url        text;
  v_file_id    text;
  v_width      int;
  v_height     int;
  v_order      int := 1;
  v_photo_cnt  int := 0;
BEGIN
  SELECT * INTO p FROM pipeline.pipeline_properties WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Listing not found in pipeline');
  END IF;
  IF p.title IS NULL OR p.address IS NULL OR p.city IS NULL
     OR p.state IS NULL OR p.zip IS NULL OR p.monthly_rent IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Missing required fields: title, address, city, state, zip, monthly_rent');
  END IF;

  -- 1. Count valid photos in original_image_urls
  IF p.original_image_urls IS NOT NULL AND p.original_image_urls <> '' AND p.original_image_urls <> '[]' THEN
    BEGIN
      v_photos := p.original_image_urls::jsonb;
      IF jsonb_typeof(v_photos) = 'array' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_photos)
        LOOP
          IF jsonb_typeof(v_elem) = 'string' AND length(v_elem #>> '{}') > 5 THEN
            v_photo_cnt := v_photo_cnt + 1;
          ELSIF jsonb_typeof(v_elem) = 'object' AND v_elem ? 'url' AND length(v_elem->>'url') > 5 THEN
            v_photo_cnt := v_photo_cnt + 1;
          END IF;
        END LOOP;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_photo_cnt := 0;
    END;
  END IF;

  -- Enforce minimum 6 photos rule for publication
  IF v_photo_cnt < 6 THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'Cannot publish: listing requires at least 6 genuine property photos (found ' || v_photo_cnt || ').'
    );
  END IF;

  new_id := gen_random_uuid()::text;

  -- 2. Parse available_date
  IF p.available_date IS NOT NULL AND p.available_date ~ '^\d{4}-\d{2}-\d{2}' THEN
    v_avail := substring(p.available_date from '^\d{4}-\d{2}-\d{2}')::date;
  ELSIF p.available_date IS NOT NULL AND p.available_date ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
    v_avail := to_date(substring(p.available_date from '^\d{1,2}/\d{1,2}/\d{4}'), 'MM/DD/YYYY');
  ELSE
    v_avail := CURRENT_DATE;
  END IF;

  -- 3. Parse listed_at
  IF p.listed_at IS NOT NULL AND p.listed_at <> '' THEN
    v_listed := p.listed_at;
  ELSIF p.scraped_at IS NOT NULL THEN
    v_listed := to_char(p.scraped_at, 'YYYY-MM-DD');
  ELSE
    v_listed := to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD');
  END IF;

  -- 4. Insert into public.properties
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
    available_date, minimum_lease_months,
    pets_allowed, pet_details, pet_weight_limit, smoking_allowed,
    parking, parking_fee,
    amenities, appliances, utilities_included,
    heating_type, cooling_type, laundry_type,
    location_context, virtual_tour_url, has_basement, has_central_air,
    listed_at, source_status
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
    50, -- application_fee is always $50
    p.pet_deposit, p.admin_fee, p.move_in_special,
    v_avail,
    COALESCE(p.minimum_lease_months, 12),
    true, -- always pet-friendly
    p.pet_details, p.pet_weight_limit,
    false, -- smoking policy always false
    p.parking, p.parking_fee,
    CASE WHEN p.amenities IS NOT NULL AND p.amenities <> '' AND p.amenities <> '[]'
         THEN ARRAY(SELECT jsonb_array_elements_text(p.amenities::jsonb))
         ELSE NULL END,
    CASE WHEN p.appliances IS NOT NULL AND p.appliances <> '' AND p.appliances <> '[]'
         THEN ARRAY(SELECT jsonb_array_elements_text(p.appliances::jsonb))
         ELSE NULL END,
    CASE WHEN p.utilities_included IS NOT NULL AND p.utilities_included <> '' AND p.utilities_included <> '[]'
         THEN ARRAY(SELECT jsonb_array_elements_text(p.utilities_included::jsonb))
         ELSE NULL END,
    p.heating_type, p.cooling_type, p.laundry_type,
    p.location_context, p.virtual_tour_url,
    COALESCE(p.has_basement, false),
    COALESCE(p.has_central_air, false),
    v_listed,
    COALESCE(p.source_status, 'available')
  );

  -- 5. Insert photos into public.property_photos (supporting string and object elements)
  IF v_photos IS NOT NULL AND jsonb_typeof(v_photos) = 'array' THEN
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
          id, property_id, url, file_id, width, height, display_order, is_hero, created_at
        ) VALUES (
          gen_random_uuid(),
          new_id,
          v_url,
          v_file_id,
          v_width,
          v_height,
          v_order,
          (v_order = 1),
          CURRENT_TIMESTAMP
        );
        v_order := v_order + 1;
      END IF;
    END LOOP;
  END IF;

  -- 6. Mark pipeline row as published
  UPDATE pipeline.pipeline_properties
  SET status             = 'published',
      choice_property_id = new_id,
      photo_import_status = 'ok',
      published_at       = now()::text,
      updated_at         = now()
  WHERE id = p_id;

  RETURN json_build_object(
    'ok', true,
    'choice_property_id', new_id,
    'photos_count', v_order - 1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pipeline_publish(text,uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pipeline_publish(text,uuid) TO authenticated, service_role;

-- 2. Upgrade public.pipeline_publish_and_delete
CREATE OR REPLACE FUNCTION public.pipeline_publish_and_delete(
  p_id          text,
  p_landlord_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_res json;
BEGIN
  v_res := public.pipeline_publish(p_id, p_landlord_id);
  IF (v_res->>'ok')::boolean = true THEN
    DELETE FROM pipeline.pipeline_properties WHERE id = p_id;
  END IF;
  RETURN v_res;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pipeline_publish_and_delete(text,uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pipeline_publish_and_delete(text,uuid) TO authenticated, service_role;
