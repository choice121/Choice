-- Preserve structured media arrays from browser imports and publish them into public.property_media.
CREATE OR REPLACE FUNCTION public.pipeline_publish(
  p_id          text,
  p_landlord_id uuid DEFAULT NULL,
  p_status      text DEFAULT 'active'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  p             pipeline.pipeline_properties%ROWTYPE;
  new_id        text;
  v_listed      date;
  v_imported_at timestamptz;
  v_photos      jsonb;
  v_elem        jsonb;
  v_url         text;
  v_file_id     text;
  v_width       int;
  v_height      int;
  v_order       int := 1;
  v_pub_status  property_status;
  v_photo_count int := 0;
  v_media       jsonb;
  v_media_entry jsonb;
  v_media_kind  text;
  v_media_url   text;
  v_media_title text;
  v_media_floor text;
  v_media_provider text;
  v_media_poster text;
  v_media_file_id text;
  v_media_display_order int;
  v_media_hero boolean;
  v_media_width int;
  v_media_height int;
  v_media_metadata jsonb;
  v_media_index int := 0;
BEGIN
  SELECT * INTO p FROM pipeline.pipeline_properties WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Listing not found in pipeline');
  END IF;

  IF p.title IS NULL OR p.address IS NULL OR p.city IS NULL
     OR p.state IS NULL OR p.zip IS NULL OR p.monthly_rent IS NULL
     OR p.bedrooms IS NULL OR p.bathrooms IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Required fields missing');
  END IF;

  v_photos := NULL;
  IF p.local_image_paths IS NOT NULL AND p.local_image_paths <> '' AND p.local_image_paths <> '[]' THEN
    BEGIN v_photos := p.local_image_paths::jsonb; EXCEPTION WHEN OTHERS THEN v_photos := NULL; END;
  END IF;
  IF v_photos IS NULL OR jsonb_array_length(v_photos) = 0 THEN
    IF p.original_image_urls IS NOT NULL AND p.original_image_urls <> '' AND p.original_image_urls <> '[]' THEN
      BEGIN v_photos := p.original_image_urls::jsonb; EXCEPTION WHEN OTHERS THEN v_photos := NULL; END;
    END IF;
  END IF;
  IF v_photos IS NULL OR jsonb_typeof(v_photos) <> 'array' OR jsonb_array_length(v_photos) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'No photos available; cannot publish');
  END IF;

  IF p_status = 'private_placement' THEN
    v_pub_status := 'private_placement'::property_status;
  ELSE
    v_pub_status := 'active'::property_status;
  END IF;

  BEGIN
    IF p.listed_at IS NOT NULL AND p.listed_at <> '' THEN
      v_listed := p.listed_at::date;
    ELSE
      v_listed := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_listed := NULL;
  END;

  v_imported_at := COALESCE(p.imported_at, p.scraped_at, now());
  new_id := 'prop_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);

  INSERT INTO public.properties (
    id, landlord_id, status,
    title, description, original_description, showing_instructions,
    address, city, state, zip, county, neighborhood,
    lat, lng,
    property_type, year_built, floors,
    unit_number, total_units,
    bedrooms, bathrooms, half_bathrooms, total_bathrooms, square_footage,
    lot_size_sqft, garage_spaces,
    monthly_rent, security_deposit, last_months_rent,
    application_fee, pet_deposit, admin_fee, move_in_special,
    available_date, lease_terms, minimum_lease_months,
    pets_allowed, pet_details, pet_weight_limit,
    smoking_allowed,
    parking, parking_fee,
    amenities, appliances, utilities_included, flooring,
    heating_type, cooling_type, laundry_type,
    location_context, virtual_tour_url,
    has_basement, has_central_air,
    listed_at, source_last_updated_at, imported_at, source_status, last_verified_at
  ) VALUES (
    new_id,
    COALESCE(p_landlord_id, p.poster_landlord_id::uuid),
    v_pub_status,
    p.title, p.description, COALESCE(p.original_description, p.description), p.showing_instructions,
    p.address, p.city, p.state, p.zip, p.county, p.neighborhood,
    p.lat, p.lng,
    p.property_type, p.year_built, p.floors,
    p.unit_number, p.total_units,
    p.bedrooms, p.bathrooms, p.half_bathrooms, COALESCE(p.total_bathrooms, p.bathrooms), p.square_footage,
    p.lot_size_sqft, p.garage_spaces,
    p.monthly_rent,
    p.security_deposit,
    p.last_months_rent,
    50,
    p.pet_deposit, p.admin_fee, p.move_in_special,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL, NULL,
    NULL,
    p.parking, p.parking_fee,
    NULL,
    NULL,
    NULL,
    NULL,
    p.heating_type, p.cooling_type, p.laundry_type,
    p.location_context, p.virtual_tour_url,
    p.has_basement,
    p.has_central_air,
    v_listed,
    p.source_last_updated_at,
    v_imported_at,
    COALESCE(p.source_status, 'available'),
    p.last_verified_at
  );

  v_media := '[]'::jsonb;
  BEGIN
    IF p.original_data IS NOT NULL AND p.original_data <> '' AND p.original_data <> 'null' THEN
      DECLARE v_original jsonb := p.original_data::jsonb;
      BEGIN
        IF jsonb_typeof(v_original) = 'object' AND v_original ? 'media' THEN
          v_media := COALESCE(v_original->'media', '[]'::jsonb);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_media := '[]'::jsonb;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_media := '[]'::jsonb;
  END;

  IF jsonb_typeof(v_media) <> 'array' THEN
    v_media := '[]'::jsonb;
  END IF;

  IF jsonb_array_length(v_media) = 0 AND p.virtual_tour_url IS NOT NULL AND btrim(p.virtual_tour_url) <> '' THEN
    v_media := jsonb_build_array(
      jsonb_build_object(
        'kind', 'virtual_tour',
        'title', '3D Virtual Tour',
        'url', p.virtual_tour_url,
        'display_order', 0
      )
    );
  END IF;

  IF jsonb_array_length(v_media) > 0 THEN
    FOR v_media_entry IN SELECT * FROM jsonb_array_elements(v_media)
    LOOP
      v_media_kind := lower(COALESCE(v_media_entry->>'kind', 'photo'));
      IF v_media_kind NOT IN ('photo', 'floor_plan', 'video', 'virtual_tour', 'tour_3d') THEN
        CONTINUE;
      END IF;

      v_media_url := NULLIF(btrim(COALESCE(v_media_entry->>'url', v_media_entry->>'href', v_media_entry->>'src', '')), '');
      IF v_media_url IS NULL OR length(v_media_url) < 5 THEN
        CONTINUE;
      END IF;

      v_media_title := NULLIF(btrim(COALESCE(v_media_entry->>'title', '')), '');
      IF v_media_title IS NULL THEN
        v_media_title := CASE
          WHEN v_media_kind = 'floor_plan' THEN 'Floor plan'
          WHEN v_media_kind = 'video' THEN 'Video walkthrough'
          WHEN v_media_kind = 'tour_3d' THEN '3D Virtual Tour'
          ELSE 'Media'
        END;
      END IF;

      v_media_floor := NULLIF(btrim(COALESCE(v_media_entry->>'floor_label', '')), '');
      v_media_provider := NULLIF(btrim(COALESCE(v_media_entry->>'provider', '')), '');
      v_media_poster := NULLIF(btrim(COALESCE(v_media_entry->>'poster_url', '')), '');
      v_media_file_id := NULLIF(btrim(COALESCE(v_media_entry->>'file_id', '')), '');
      v_media_display_order := COALESCE((v_media_entry->>'display_order')::int, v_media_index);
      v_media_hero := COALESCE((v_media_entry->>'is_hero')::boolean, false);
      v_media_width := NULL;
      v_media_height := NULL;
      IF v_media_entry ? 'width' AND jsonb_typeof(v_media_entry->'width') = 'number' THEN
        v_media_width := (v_media_entry->>'width')::int;
      END IF;
      IF v_media_entry ? 'height' AND jsonb_typeof(v_media_entry->'height') = 'number' THEN
        v_media_height := (v_media_entry->>'height')::int;
      END IF;
      v_media_metadata := COALESCE(v_media_entry->'metadata', '{}'::jsonb);

      INSERT INTO public.property_media (
        property_id, kind, title, floor_label, provider, url, file_id, poster_url,
        display_order, is_hero, width, height, metadata
      ) VALUES (
        new_id,
        v_media_kind,
        v_media_title,
        v_media_floor,
        v_media_provider,
        v_media_url,
        v_media_file_id,
        v_media_poster,
        v_media_display_order,
        v_media_hero,
        v_media_width,
        v_media_height,
        v_media_metadata
      );

      v_media_index := v_media_index + 1;
    END LOOP;
  END IF;

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
      v_photo_count := v_photo_count + 1;
    END IF;
  END LOOP;

  IF v_photo_count = 0 THEN
    DELETE FROM public.properties WHERE id = new_id;
    RETURN json_build_object('ok', false, 'error', 'No valid photos inserted');
  END IF;

  UPDATE pipeline.pipeline_properties
  SET status             = 'published',
      choice_property_id = new_id,
      imported_at        = COALESCE(imported_at, now()),
      published_at       = now()::text,
      updated_at         = now()
  WHERE id = p_id;

  RETURN json_build_object('ok', true, 'choice_property_id', new_id, 'status', v_pub_status, 'photos', v_photo_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pipeline_publish(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pipeline_publish(text,uuid,text) TO authenticated, service_role;