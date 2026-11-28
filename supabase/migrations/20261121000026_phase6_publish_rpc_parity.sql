-- ============================================================================
-- Migration: Phase 6 — Publishing RPC Parity & Strict Anon Column Isolation
-- Reconciles legacy public.pipeline_publish, hardens pipeline_publish_for_batch
-- canonical reuse enrichment backfill, restricts get_properties_by_ids to
-- client-safe columns, and enforces column-level anon SELECT isolation on
-- public.properties and public.property_photos.
-- ============================================================================

-- 1. Reconcile legacy public.pipeline_publish(text, uuid, text) ---------------
CREATE OR REPLACE FUNCTION public.pipeline_publish(
  p_id          text,
  p_landlord_id uuid DEFAULT NULL,
  p_status      text DEFAULT 'active'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  p               pipeline.pipeline_properties%ROWTYPE;
  new_id          text;
  v_listed        date;
  v_imported_at   timestamptz;
  v_photos        jsonb;
  v_elem          jsonb;
  v_url           text;
  v_file_id       text;
  v_caption       text;
  v_room_label    text;
  v_source_url    text;
  v_media_type    text;
  v_width         int;
  v_height        int;
  v_order         int := 1;
  v_pub_status    property_status;
  v_photo_count   int := 0;
  v_amenities     text[] := NULL;
  v_appliances    text[] := NULL;
  v_utilities     text[] := NULL;
  v_flooring      text[] := NULL;
  v_effective_title text;
  v_effective_desc  text;
  v_orig_desc       text;
  v_provenance      jsonb;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  SELECT * INTO p FROM pipeline.pipeline_properties WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Listing not found in pipeline');
  END IF;

  IF NULLIF(trim(COALESCE(p.address, '')), '') IS NULL
     OR NULLIF(trim(COALESCE(p.city, '')), '') IS NULL
     OR NULLIF(trim(COALESCE(p.state, '')), '') IS NULL
     OR NULLIF(trim(COALESCE(p.zip, '')), '') IS NULL
     OR p.monthly_rent IS NULL OR p.monthly_rent <= 0
     OR p.bedrooms IS NULL OR p.bathrooms IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Required fields missing');
  END IF;

  -- Photo gate: at least one valid source photo URL required.
  v_photos := NULL;
  IF p.local_image_paths IS NOT NULL AND p.local_image_paths <> '' AND p.local_image_paths <> '[]' THEN
    BEGIN v_photos := p.local_image_paths::jsonb; EXCEPTION WHEN OTHERS THEN v_photos := NULL; END;
  END IF;
  IF v_photos IS NULL OR jsonb_typeof(v_photos) <> 'array' OR jsonb_array_length(v_photos) = 0 THEN
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

  IF p.amenities IS NOT NULL AND p.amenities <> '' AND p.amenities <> '[]' THEN
    BEGIN
      SELECT array_agg(elem::text) INTO v_amenities
      FROM jsonb_array_elements_text(p.amenities::jsonb) AS elem
      WHERE elem IS NOT NULL AND elem <> '';
    EXCEPTION WHEN OTHERS THEN v_amenities := NULL; END;
  END IF;

  IF p.appliances IS NOT NULL AND p.appliances <> '' AND p.appliances <> '[]' THEN
    BEGIN
      SELECT array_agg(elem::text) INTO v_appliances
      FROM jsonb_array_elements_text(p.appliances::jsonb) AS elem
      WHERE elem IS NOT NULL AND elem <> '';
    EXCEPTION WHEN OTHERS THEN v_appliances := NULL; END;
  END IF;

  IF p.utilities_included IS NOT NULL AND p.utilities_included <> '' AND p.utilities_included <> '[]' THEN
    BEGIN
      SELECT array_agg(elem::text) INTO v_utilities
      FROM jsonb_array_elements_text(p.utilities_included::jsonb) AS elem
      WHERE elem IS NOT NULL AND elem <> '';
    EXCEPTION WHEN OTHERS THEN v_utilities := NULL; END;
  END IF;

  IF p.flooring IS NOT NULL AND p.flooring <> '' AND p.flooring <> '[]' THEN
    BEGIN
      SELECT array_agg(elem::text) INTO v_flooring
      FROM jsonb_array_elements_text(p.flooring::jsonb) AS elem
      WHERE elem IS NOT NULL AND elem <> '';
    EXCEPTION WHEN OTHERS THEN v_flooring := NULL; END;
  END IF;

  v_effective_title := COALESCE(
    NULLIF(btrim(p.title), ''),
    p.address || ', ' || p.city || ', ' || p.state || ' ' || p.zip
  );
  v_effective_desc := public.sanitize_listing_description(
    COALESCE(
      NULLIF(btrim(p.approved_description), ''),
      NULLIF(btrim(p.description), ''),
      v_effective_title
    )
  );
  v_orig_desc := COALESCE(NULLIF(btrim(p.original_description), ''), NULLIF(btrim(p.description), ''), v_effective_desc);

  v_imported_at := COALESCE(p.imported_at, p.scraped_at, now());
  new_id := 'prop_' || substr(md5(random()::text || clock_timestamp()::text || p.id), 1, 12);

  v_provenance := COALESCE(p.field_provenance, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'source', p.source,
    'source_listing_id', p.source_listing_id,
    'source_url', p.source_url
  ));

  INSERT INTO public.properties (
    id, landlord_id, status,
    title, description, original_description, showing_instructions,
    address, city, state, zip, county, neighborhood,
    lat, lng,
    property_type, property_subtype, year_built, floors,
    unit_number, total_units,
    bedrooms, bathrooms, half_bathrooms, total_bathrooms, square_footage,
    lot_size_sqft, garage_spaces,
    monthly_rent, security_deposit, last_months_rent,
    application_fee, pet_deposit, admin_fee, move_in_special,
    hoa_fee, hoa_fee_frequency, tax_annual_amount, tax_value,
    available_date, lease_terms, minimum_lease_months,
    pets_allowed, pet_details, pet_weight_limit,
    smoking_allowed,
    parking, parking_fee, ev_charging,
    amenities, appliances, utilities_included, flooring,
    heating_type, cooling_type, laundry_type,
    location_context, virtual_tour_url,
    has_basement, has_central_air,
    listed_at, source_last_updated_at, imported_at, source_status, last_verified_at,
    original_data, source_raw_payload, field_provenance,
    structural_details, utility_details, financial_details, location_details,
    floor_plans, videos
  ) VALUES (
    new_id,
    COALESCE(p_landlord_id, CASE WHEN NULLIF(trim(COALESCE(p.poster_landlord_id, '')), '') ~* '^[0-9a-f-]{36}$' THEN p.poster_landlord_id::uuid ELSE NULL END),
    v_pub_status,
    v_effective_title, v_effective_desc, v_orig_desc,
    CASE WHEN p_status = 'private_placement' THEN NULL ELSE p.showing_instructions END,
    p.address, p.city, p.state, p.zip, p.county, p.neighborhood,
    p.lat, p.lng,
    p.property_type, p.property_subtype, p.year_built, p.floors,
    p.unit_number, p.total_units,
    p.bedrooms, p.bathrooms, p.half_bathrooms, COALESCE(p.total_bathrooms, p.bathrooms), p.square_footage,
    p.lot_size_sqft, p.garage_spaces,
    p.monthly_rent,
    p.monthly_rent,
    p.last_months_rent,
    50,
    NULL, p.admin_fee, p.move_in_special,
    p.hoa_fee, p.hoa_fee_frequency, p.tax_annual_amount, p.tax_value,
    NULL, NULL, NULL,
    NULL, NULL, NULL,
    NULL,
    p.parking, p.parking_fee, p.ev_charging,
    v_amenities, v_appliances, v_utilities, v_flooring,
    p.heating_type, p.cooling_type, p.laundry_type,
    p.location_context, NULL,
    p.has_basement,
    p.has_central_air,
    v_listed,
    p.source_last_updated_at,
    v_imported_at,
    COALESCE(p.source_status, 'available'),
    p.last_verified_at,
    pipeline.safe_parse_jsonb(p.original_data::text),
    p.source_raw_payload,
    v_provenance,
    p.structural_details, p.utility_details, p.financial_details, p.location_details,
    p.floor_plans,
    NULL
  );

  v_order := 1;
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_photos)
  LOOP
    v_url := NULL; v_file_id := NULL; v_caption := NULL; v_room_label := NULL;
    v_source_url := NULL; v_media_type := 'photo'; v_width := NULL; v_height := NULL;

    IF jsonb_typeof(v_elem) = 'string' THEN
      v_url := trim(v_elem #>> '{}');
      v_source_url := v_url;
    ELSIF jsonb_typeof(v_elem) = 'object' THEN
      v_url := trim(v_elem->>'url');
      v_file_id := v_elem->>'fileId';
      v_caption := NULLIF(btrim(v_elem->>'caption'), '');
      v_room_label := NULLIF(btrim(v_elem->>'room_label'), '');
      v_source_url := COALESCE(NULLIF(btrim(v_elem->>'source_url'), ''), v_url);
      v_media_type := COALESCE(NULLIF(btrim(v_elem->>'media_type'), ''), 'photo');
      IF v_elem ? 'width' AND jsonb_typeof(v_elem->'width') = 'number' THEN
        v_width := (v_elem->>'width')::int;
      END IF;
      IF v_elem ? 'height' AND jsonb_typeof(v_elem->'height') = 'number' THEN
        v_height := (v_elem->>'height')::int;
      END IF;
    END IF;

    IF v_url IS NOT NULL AND length(v_url) > 5 THEN
      INSERT INTO public.property_photos (
        id, property_id, url, file_id, width, height,
        display_order, is_hero, watermark_status,
        media_type, caption, room_label, source_url, created_at
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
        v_media_type,
        v_caption,
        v_room_label,
        v_source_url,
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

REVOKE ALL ON FUNCTION public.pipeline_publish(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_publish(text, uuid, text) TO authenticated, service_role;

-- 2. Upgrade canonical reuse backfill in public.pipeline_publish_for_batch ----
CREATE OR REPLACE FUNCTION public.pipeline_publish_for_batch(
  p_batch_id    TEXT,
  p_pipeline_id TEXT,
  p_visibility  TEXT DEFAULT NULL,
  p_landlord_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_batch_id       TEXT := regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', '');
  v_batch          public.publishing_batches%ROWTYPE;
  p                pipeline.pipeline_properties%ROWTYPE;
  v_visibility     TEXT;
  v_pub_status     property_status;
  v_prop_id        TEXT;
  v_reused         BOOLEAN := false;
  v_effective_title TEXT;
  v_effective_desc  TEXT;
  v_orig_desc       TEXT;
  v_photos         JSONB;
  v_elem           JSONB;
  v_url            TEXT;
  v_file_id        TEXT;
  v_caption        TEXT;
  v_room_label     TEXT;
  v_source_url     TEXT;
  v_media_type     TEXT;
  v_width          INT;
  v_height         INT;
  v_order          INT := 1;
  v_photo_count    INT := 0;
  v_usable_count   INT := 0;
  v_existing_photos INT := 0;
  v_listed         DATE;
  v_imported_at    TIMESTAMPTZ;
  v_amenities      TEXT[] := NULL;
  v_appliances     TEXT[] := NULL;
  v_utilities      TEXT[] := NULL;
  v_flooring       TEXT[] := NULL;
  v_provenance     JSONB;
  v_snap_id        UUID;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_batch_id = '' OR NULLIF(trim(COALESCE(p_pipeline_id, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_and_pipeline_id_required');
  END IF;

  SELECT * INTO v_batch
  FROM public.publishing_batches
  WHERE id = v_batch_id OR UPPER(id) = UPPER(v_batch_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_not_found');
  END IF;

  SELECT * INTO p
  FROM pipeline.pipeline_properties
  WHERE id = p_pipeline_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pipeline_listing_not_found');
  END IF;

  v_visibility := COALESCE(NULLIF(trim(COALESCE(p_visibility, '')), ''), v_batch.visibility, 'private_placement');
  IF v_visibility NOT IN ('private_placement', 'active') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_visibility');
  END IF;
  IF v_visibility = 'active' AND COALESCE((v_batch.task_config->>'explicit_public_override')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'public_visibility_override_required',
      'message', 'Strict rule: Batch #' || v_batch.id || ' must publish as private_placement unless explicit_public_override is explicitly authorized.'
    );
  END IF;
  v_pub_status := v_visibility::property_status;

  IF p.status = 'archived' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_archived');
  END IF;

  IF COALESCE(p.needs_review, false) = true OR COALESCE(p.validation_status, 'pending') <> 'passed' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'validation_not_passed: ' || COALESCE(NULLIF(p.review_reason, ''), p.validation_status, 'pending')
    );
  END IF;

  IF COALESCE(p.pricing_status, '') IN ('held_out_of_range', 'error') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'pricing_not_ready: ' || p.pricing_status
    );
  END IF;

  IF NULLIF(trim(COALESCE(p.address, '')), '') IS NULL
     OR NULLIF(trim(COALESCE(p.city, '')), '') IS NULL
     OR NULLIF(trim(COALESCE(p.state, '')), '') IS NULL
     OR NULLIF(trim(COALESCE(p.zip, '')), '') IS NULL
     OR p.monthly_rent IS NULL OR p.monthly_rent <= 0
     OR p.bedrooms IS NULL
     OR p.bathrooms IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'required_fields_missing');
  END IF;

  v_photos := NULL;
  IF p.local_image_paths IS NOT NULL AND p.local_image_paths <> '' AND p.local_image_paths <> '[]' THEN
    BEGIN v_photos := p.local_image_paths::jsonb; EXCEPTION WHEN OTHERS THEN v_photos := NULL; END;
  END IF;
  IF v_photos IS NULL OR jsonb_typeof(v_photos) <> 'array' OR jsonb_array_length(v_photos) = 0 THEN
    IF p.original_image_urls IS NOT NULL AND p.original_image_urls <> '' AND p.original_image_urls <> '[]' THEN
      BEGIN v_photos := p.original_image_urls::jsonb; EXCEPTION WHEN OTHERS THEN v_photos := NULL; END;
    END IF;
  END IF;

  IF v_photos IS NULL OR jsonb_typeof(v_photos) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'fewer_than_4_photos');
  END IF;

  SELECT COUNT(*)
  INTO v_usable_count
  FROM jsonb_array_elements(v_photos) AS elem
  WHERE (
    (jsonb_typeof(elem) = 'string' AND length(trim(elem #>> '{}')) > 5)
    OR (jsonb_typeof(elem) = 'object' AND length(trim(COALESCE(elem->>'url', ''))) > 5)
  );

  IF v_usable_count < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'fewer_than_4_photos (found ' || v_usable_count || ')');
  END IF;

  IF p.amenities IS NOT NULL AND p.amenities <> '' AND p.amenities <> '[]' THEN
    BEGIN
      SELECT array_agg(elem::text) INTO v_amenities
      FROM jsonb_array_elements_text(p.amenities::jsonb) AS elem
      WHERE elem IS NOT NULL AND elem <> '';
    EXCEPTION WHEN OTHERS THEN v_amenities := NULL; END;
  END IF;

  IF p.appliances IS NOT NULL AND p.appliances <> '' AND p.appliances <> '[]' THEN
    BEGIN
      SELECT array_agg(elem::text) INTO v_appliances
      FROM jsonb_array_elements_text(p.appliances::jsonb) AS elem
      WHERE elem IS NOT NULL AND elem <> '';
    EXCEPTION WHEN OTHERS THEN v_appliances := NULL; END;
  END IF;

  IF p.utilities_included IS NOT NULL AND p.utilities_included <> '' AND p.utilities_included <> '[]' THEN
    BEGIN
      SELECT array_agg(elem::text) INTO v_utilities
      FROM jsonb_array_elements_text(p.utilities_included::jsonb) AS elem
      WHERE elem IS NOT NULL AND elem <> '';
    EXCEPTION WHEN OTHERS THEN v_utilities := NULL; END;
  END IF;

  IF p.flooring IS NOT NULL AND p.flooring <> '' AND p.flooring <> '[]' THEN
    BEGIN
      SELECT array_agg(elem::text) INTO v_flooring
      FROM jsonb_array_elements_text(p.flooring::jsonb) AS elem
      WHERE elem IS NOT NULL AND elem <> '';
    EXCEPTION WHEN OTHERS THEN v_flooring := NULL; END;
  END IF;

  v_effective_title := COALESCE(
    NULLIF(btrim(p.title), ''),
    p.address || ', ' || p.city || ', ' || p.state || ' ' || p.zip
  );
  v_effective_desc := public.sanitize_listing_description(
    COALESCE(
      NULLIF(btrim(p.approved_description), ''),
      NULLIF(btrim(p.description), ''),
      v_effective_title
    )
  );
  v_orig_desc := COALESCE(NULLIF(btrim(p.original_description), ''), NULLIF(btrim(p.description), ''), v_effective_desc);

  IF NULLIF(trim(COALESCE(p.choice_property_id, '')), '') IS NOT NULL THEN
    SELECT pr.id INTO v_prop_id
    FROM public.properties pr
    WHERE pr.id = p.choice_property_id
    LIMIT 1;
  END IF;

  IF v_prop_id IS NULL
     AND NULLIF(trim(COALESCE(p.source, '')), '') IS NOT NULL
     AND NULLIF(trim(COALESCE(p.source_listing_id, '')), '') IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext('canonical_pub:' || trim(p.source) || ':' || trim(p.source_listing_id) || ':' || v_visibility)
    );

    SELECT pr.id INTO v_prop_id
    FROM public.properties pr
    WHERE pr.field_provenance->>'source' = p.source
      AND pr.field_provenance->>'source_listing_id' = p.source_listing_id
      AND pr.status::text = v_visibility
    ORDER BY pr.created_at DESC
    LIMIT 1;

    IF v_prop_id IS NULL THEN
      SELECT bp.property_id INTO v_prop_id
      FROM public.publishing_batch_properties bp
      JOIN public.properties pr ON pr.id = bp.property_id
      WHERE bp.source = p.source
        AND bp.source_listing_id = p.source_listing_id
        AND bp.property_id IS NOT NULL
        AND pr.status::text = v_visibility
      ORDER BY bp.created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  IF v_prop_id IS NOT NULL THEN
    v_reused := true;

    SELECT COUNT(*)::int INTO v_existing_photos
    FROM public.property_photos
    WHERE property_id = v_prop_id;

    -- Backfill any empty structured fields without touching sibling batch rent/description overlays
    UPDATE public.properties
    SET virtual_tour_url    = NULL,
        videos              = NULL,
        pets_allowed        = NULL,
        pet_details         = NULL,
        pet_weight_limit    = NULL,
        pet_deposit         = NULL,
        lease_terms         = NULL,
        minimum_lease_months = NULL,
        available_date      = NULL,
        smoking_allowed     = NULL,
        application_fee     = 50,
        showing_instructions = CASE WHEN v_visibility = 'private_placement' THEN NULL ELSE showing_instructions END,
        county              = COALESCE(NULLIF(btrim(county), ''), p.county),
        neighborhood        = COALESCE(NULLIF(btrim(neighborhood), ''), p.neighborhood),
        location_context    = COALESCE(NULLIF(btrim(location_context), ''), p.location_context),
        property_subtype    = COALESCE(NULLIF(btrim(property_subtype), ''), p.property_subtype),
        half_bathrooms      = COALESCE(half_bathrooms, p.half_bathrooms),
        total_bathrooms     = COALESCE(total_bathrooms, p.total_bathrooms, p.bathrooms),
        hoa_fee             = COALESCE(hoa_fee, p.hoa_fee),
        hoa_fee_frequency   = COALESCE(NULLIF(btrim(hoa_fee_frequency), ''), p.hoa_fee_frequency),
        ev_charging         = COALESCE(NULLIF(btrim(ev_charging), ''), p.ev_charging),
        amenities           = CASE WHEN amenities IS NULL OR array_length(amenities, 1) IS NULL THEN v_amenities ELSE amenities END,
        appliances          = CASE WHEN appliances IS NULL OR array_length(appliances, 1) IS NULL THEN v_appliances ELSE appliances END,
        utilities_included  = CASE WHEN utilities_included IS NULL OR array_length(utilities_included, 1) IS NULL THEN v_utilities ELSE utilities_included END,
        flooring            = CASE WHEN flooring IS NULL OR array_length(flooring, 1) IS NULL THEN v_flooring ELSE flooring END,
        structural_details  = CASE WHEN structural_details IS NULL OR structural_details = '{}'::jsonb THEN p.structural_details ELSE structural_details END,
        utility_details     = CASE WHEN utility_details IS NULL OR utility_details = '{}'::jsonb THEN p.utility_details ELSE utility_details END,
        financial_details   = CASE WHEN financial_details IS NULL OR financial_details = '{}'::jsonb THEN p.financial_details ELSE financial_details END,
        location_details    = CASE WHEN location_details IS NULL OR location_details = '{}'::jsonb THEN p.location_details ELSE location_details END,
        floor_plans         = CASE WHEN floor_plans IS NULL OR floor_plans = '[]'::jsonb THEN p.floor_plans ELSE floor_plans END
    WHERE id = v_prop_id;

    IF v_existing_photos = 0 THEN
      v_order := 1;
      FOR v_elem IN SELECT * FROM jsonb_array_elements(v_photos)
      LOOP
        v_url := NULL; v_file_id := NULL; v_caption := NULL; v_room_label := NULL;
        v_source_url := NULL; v_media_type := 'photo'; v_width := NULL; v_height := NULL;
        IF jsonb_typeof(v_elem) = 'string' THEN
          v_url := trim(v_elem #>> '{}');
          v_source_url := v_url;
        ELSIF jsonb_typeof(v_elem) = 'object' THEN
          v_url := trim(v_elem->>'url');
          v_file_id := v_elem->>'fileId';
          v_caption := NULLIF(btrim(v_elem->>'caption'), '');
          v_room_label := NULLIF(btrim(v_elem->>'room_label'), '');
          v_source_url := COALESCE(NULLIF(btrim(v_elem->>'source_url'), ''), v_url);
          v_media_type := COALESCE(NULLIF(btrim(v_elem->>'media_type'), ''), 'photo');
          IF v_elem ? 'width' AND jsonb_typeof(v_elem->'width') = 'number' THEN v_width := (v_elem->>'width')::int; END IF;
          IF v_elem ? 'height' AND jsonb_typeof(v_elem->'height') = 'number' THEN v_height := (v_elem->>'height')::int; END IF;
        END IF;
        IF v_url IS NOT NULL AND length(v_url) > 5 THEN
          INSERT INTO public.property_photos (
            id, property_id, url, file_id, width, height,
            display_order, is_hero, watermark_status,
            media_type, caption, room_label, source_url, created_at
          ) VALUES (
            gen_random_uuid(), v_prop_id, v_url, v_file_id, v_width, v_height,
            v_order, (v_order = 1), 'clean',
            v_media_type, v_caption, v_room_label, v_source_url, CURRENT_TIMESTAMP
          );
          v_order := v_order + 1;
          v_photo_count := v_photo_count + 1;
        END IF;
      END LOOP;
    ELSE
      v_photo_count := v_existing_photos;
    END IF;
  ELSE
    BEGIN
      v_listed := p.listed_at;
    EXCEPTION WHEN OTHERS THEN
      v_listed := NULL;
    END;

    v_imported_at := COALESCE(p.imported_at, p.scraped_at, now());
    v_prop_id := 'prop_' || substr(md5(random()::text || clock_timestamp()::text || p.id), 1, 12);

    v_provenance := COALESCE(p.field_provenance, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'source', p.source,
      'source_listing_id', p.source_listing_id,
      'source_url', p.source_url,
      'batch_id', v_batch.id
    ));

    INSERT INTO public.properties (
      id, landlord_id, status, batch_id,
      title, description, original_description, showing_instructions,
      address, city, state, zip, county, neighborhood,
      lat, lng,
      property_type, property_subtype, year_built, floors,
      unit_number, total_units,
      bedrooms, bathrooms, half_bathrooms, total_bathrooms, square_footage,
      lot_size_sqft, garage_spaces,
      monthly_rent, security_deposit, last_months_rent,
      application_fee, pet_deposit, admin_fee, move_in_special,
      hoa_fee, hoa_fee_frequency, tax_annual_amount, tax_value,
      available_date, lease_terms, minimum_lease_months,
      pets_allowed, pet_details, pet_weight_limit,
      smoking_allowed,
      parking, parking_fee, ev_charging,
      amenities, appliances, utilities_included, flooring,
      heating_type, cooling_type, laundry_type,
      location_context, virtual_tour_url,
      has_basement, has_central_air,
      listed_at, source_last_updated_at, imported_at, source_status, last_verified_at,
      original_data, source_raw_payload, field_provenance,
      structural_details, utility_details, financial_details, location_details,
      floor_plans, videos
    ) VALUES (
      v_prop_id,
      COALESCE(p_landlord_id, CASE WHEN NULLIF(trim(COALESCE(p.poster_landlord_id, '')), '') ~* '^[0-9a-f-]{36}$' THEN p.poster_landlord_id::uuid ELSE NULL END),
      v_pub_status,
      v_batch.id,
      v_effective_title,
      v_effective_desc,
      v_orig_desc,
      CASE WHEN v_visibility = 'private_placement' THEN NULL ELSE p.showing_instructions END,
      p.address, p.city, p.state, p.zip, p.county, p.neighborhood,
      p.lat, p.lng,
      p.property_type, p.property_subtype, p.year_built, p.floors,
      p.unit_number, p.total_units,
      p.bedrooms, p.bathrooms, p.half_bathrooms, COALESCE(p.total_bathrooms, p.bathrooms), p.square_footage,
      p.lot_size_sqft, p.garage_spaces,
      p.monthly_rent,
      p.monthly_rent,
      p.last_months_rent,
      50,
      NULL, p.admin_fee, p.move_in_special,
      p.hoa_fee, p.hoa_fee_frequency, p.tax_annual_amount, p.tax_value,
      NULL, NULL, NULL,
      NULL, NULL, NULL,
      NULL,
      p.parking, p.parking_fee, p.ev_charging,
      v_amenities, v_appliances, v_utilities, v_flooring,
      p.heating_type, p.cooling_type, p.laundry_type,
      p.location_context,
      NULL,
      p.has_basement, p.has_central_air,
      v_listed, p.source_last_updated_at, v_imported_at, COALESCE(p.source_status, 'available'), p.last_verified_at,
      pipeline.safe_parse_jsonb(p.original_data::text),
      p.source_raw_payload,
      v_provenance,
      p.structural_details, p.utility_details, p.financial_details, p.location_details,
      p.floor_plans,
      NULL
    );

    v_order := 1;
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_photos)
    LOOP
      v_url := NULL; v_file_id := NULL; v_caption := NULL; v_room_label := NULL;
      v_source_url := NULL; v_media_type := 'photo'; v_width := NULL; v_height := NULL;
      IF jsonb_typeof(v_elem) = 'string' THEN
        v_url := trim(v_elem #>> '{}');
        v_source_url := v_url;
      ELSIF jsonb_typeof(v_elem) = 'object' THEN
        v_url := trim(v_elem->>'url');
        v_file_id := v_elem->>'fileId';
        v_caption := NULLIF(btrim(v_elem->>'caption'), '');
        v_room_label := NULLIF(btrim(v_elem->>'room_label'), '');
        v_source_url := COALESCE(NULLIF(btrim(v_elem->>'source_url'), ''), v_url);
        v_media_type := COALESCE(NULLIF(btrim(v_elem->>'media_type'), ''), 'photo');
        IF v_elem ? 'width' AND jsonb_typeof(v_elem->'width') = 'number' THEN v_width := (v_elem->>'width')::int; END IF;
        IF v_elem ? 'height' AND jsonb_typeof(v_elem->'height') = 'number' THEN v_height := (v_elem->>'height')::int; END IF;
      END IF;
      IF v_url IS NOT NULL AND length(v_url) > 5 THEN
        INSERT INTO public.property_photos (
          id, property_id, url, file_id, width, height,
          display_order, is_hero, watermark_status,
          media_type, caption, room_label, source_url, created_at
        ) VALUES (
          gen_random_uuid(), v_prop_id, v_url, v_file_id, v_width, v_height,
          v_order, (v_order = 1), 'clean',
          v_media_type, v_caption, v_room_label, v_source_url, CURRENT_TIMESTAMP
        );
        v_order := v_order + 1;
        v_photo_count := v_photo_count + 1;
      END IF;
    END LOOP;

    IF v_photo_count < 4 THEN
      DELETE FROM public.properties WHERE id = v_prop_id;
      RETURN jsonb_build_object('ok', false, 'error', 'fewer_than_4_photos_inserted');
    END IF;
  END IF;

  SELECT bp.id INTO v_snap_id
  FROM public.publishing_batch_properties bp
  WHERE bp.batch_id = v_batch.id
    AND bp.pipeline_id = p.id
  LIMIT 1;

  IF v_snap_id IS NOT NULL THEN
    UPDATE public.publishing_batch_properties
    SET batch_uuid            = v_batch.batch_uuid,
        property_id           = v_prop_id,
        source_listing_id     = p.source_listing_id,
        source                = p.source,
        address               = p.address,
        city                  = p.city,
        state                 = p.state,
        zip                   = p.zip,
        property_type         = p.property_type,
        bedrooms              = p.bedrooms,
        bathrooms             = p.bathrooms,
        square_footage        = p.square_footage,
        monthly_rent          = p.monthly_rent,
        published_rent        = p.monthly_rent,
        published_description = v_effective_desc,
        pricing_method        = p.pricing_method,
        pricing_meta          = COALESCE(p.pricing_meta, '{}'::jsonb),
        validation_status     = COALESCE(p.validation_status, 'pending'),
        visibility            = v_visibility,
        photo_count           = v_photo_count,
        published_status      = 'published',
        verification_status   = 'pending',
        error_message         = NULL
    WHERE id = v_snap_id;
  ELSE
    INSERT INTO public.publishing_batch_properties (
      batch_id, batch_uuid, property_id, pipeline_id,
      source_listing_id, source, address, city, state, zip,
      property_type, bedrooms, bathrooms, square_footage,
      monthly_rent, published_rent, published_description,
      pricing_method, pricing_meta, validation_status,
      visibility, photo_count, published_status, verification_status
    ) VALUES (
      v_batch.id, v_batch.batch_uuid, v_prop_id, p.id,
      p.source_listing_id, p.source, p.address, p.city, p.state, p.zip,
      p.property_type, p.bedrooms, p.bathrooms, p.square_footage,
      p.monthly_rent, p.monthly_rent, v_effective_desc,
      p.pricing_method, COALESCE(p.pricing_meta, '{}'::jsonb), COALESCE(p.validation_status, 'pending'),
      v_visibility, v_photo_count, 'published', 'pending'
    );
  END IF;

  UPDATE pipeline.pipeline_properties
  SET status             = 'published',
      choice_property_id = v_prop_id,
      batch_id           = COALESCE(batch_id, v_batch.id),
      batch_uuid         = COALESCE(batch_uuid, v_batch.batch_uuid),
      imported_at        = COALESCE(imported_at, now()),
      published_at       = now()::text,
      updated_at         = now()
  WHERE id = p.id;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch.id,
    'pipeline_id', p.id,
    'property_id', v_prop_id,
    'reused_canonical', v_reused,
    'visibility', v_visibility,
    'published_rent', p.monthly_rent,
    'photo_count', v_photo_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_publish_for_batch(TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_publish_for_batch(TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;

-- 3. Restrict public.get_properties_by_ids to client-safe public columns ----
DROP FUNCTION IF EXISTS public.get_properties_by_ids(text[]);
CREATE OR REPLACE FUNCTION public.get_properties_by_ids(p_ids text[])
RETURNS TABLE (
  id TEXT,
  status property_status,
  title TEXT,
  description TEXT,
  address TEXT,
  unit_number TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  county TEXT,
  neighborhood TEXT,
  location_context TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  property_type TEXT,
  property_subtype TEXT,
  year_built INTEGER,
  floors INTEGER,
  total_units INTEGER,
  bedrooms INTEGER,
  bathrooms NUMERIC,
  half_bathrooms INTEGER,
  total_bathrooms NUMERIC,
  square_footage INTEGER,
  lot_size_sqft INTEGER,
  garage_spaces INTEGER,
  monthly_rent INTEGER,
  security_deposit INTEGER,
  last_months_rent INTEGER,
  application_fee INTEGER,
  admin_fee INTEGER,
  move_in_special TEXT,
  hoa_fee INTEGER,
  hoa_fee_frequency TEXT,
  parking TEXT,
  parking_fee INTEGER,
  ev_charging TEXT,
  amenities TEXT[],
  appliances TEXT[],
  utilities_included TEXT[],
  utility_details JSONB,
  structural_details JSONB,
  location_details JSONB,
  flooring TEXT[],
  heating_type TEXT,
  cooling_type TEXT,
  laundry_type TEXT,
  has_basement BOOLEAN,
  has_central_air BOOLEAN,
  floor_plans JSONB,
  minimum_income_multiplier NUMERIC,
  minimum_credit_score INTEGER,
  featured BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    pr.id,
    pr.status,
    pr.title,
    pr.description,
    pr.address,
    pr.unit_number,
    pr.city,
    pr.state,
    pr.zip,
    pr.county,
    pr.neighborhood,
    pr.location_context,
    pr.lat,
    pr.lng,
    pr.property_type,
    pr.property_subtype,
    pr.year_built,
    pr.floors,
    pr.total_units,
    pr.bedrooms,
    pr.bathrooms,
    pr.half_bathrooms,
    pr.total_bathrooms,
    pr.square_footage,
    pr.lot_size_sqft,
    pr.garage_spaces,
    pr.monthly_rent,
    pr.security_deposit,
    pr.last_months_rent,
    COALESCE(pr.application_fee, 50) AS application_fee,
    pr.admin_fee,
    pr.move_in_special,
    pr.hoa_fee,
    pr.hoa_fee_frequency,
    pr.parking,
    pr.parking_fee,
    pr.ev_charging,
    pr.amenities,
    pr.appliances,
    pr.utilities_included,
    pr.utility_details,
    pr.structural_details,
    pr.location_details,
    pr.flooring,
    pr.heating_type,
    pr.cooling_type,
    pr.laundry_type,
    pr.has_basement,
    pr.has_central_air,
    pr.floor_plans,
    pr.minimum_income_multiplier,
    pr.minimum_credit_score,
    pr.featured,
    pr.created_at,
    pr.updated_at
  FROM public.properties pr
  WHERE pr.id::text = ANY(p_ids)
    AND pr.status = 'active'::property_status;
$$;

REVOKE ALL ON FUNCTION public.get_properties_by_ids(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_properties_by_ids(text[]) TO anon, authenticated, service_role;

-- 4. Column-level anon SELECT isolation on public.properties & property_photos
-- Protects internal pipeline/provenance/agent/broker/source_url/tax/financial
-- columns from direct unauthenticated PostgREST queries while keeping all
-- explicit public queries and authenticated landlord/admin sessions working.
REVOKE SELECT ON public.properties FROM anon;
GRANT SELECT (
  id,
  status,
  title,
  description,
  address,
  unit_number,
  city,
  state,
  zip,
  county,
  neighborhood,
  location_context,
  lat,
  lng,
  property_type,
  property_subtype,
  year_built,
  floors,
  total_units,
  bedrooms,
  bathrooms,
  half_bathrooms,
  total_bathrooms,
  square_footage,
  lot_size_sqft,
  garage_spaces,
  monthly_rent,
  security_deposit,
  last_months_rent,
  application_fee,
  admin_fee,
  move_in_special,
  hoa_fee,
  hoa_fee_frequency,
  parking,
  parking_fee,
  ev_charging,
  amenities,
  appliances,
  utilities_included,
  utility_details,
  structural_details,
  location_details,
  flooring,
  heating_type,
  cooling_type,
  laundry_type,
  has_basement,
  has_central_air,
  floor_plans,
  minimum_income_multiplier,
  minimum_credit_score,
  featured,
  search_tsv,
  created_at,
  updated_at
) ON public.properties TO anon;

REVOKE SELECT ON public.property_photos FROM anon;
GRANT SELECT (
  id,
  property_id,
  url,
  file_id,
  width,
  height,
  display_order,
  is_hero,
  watermark_status,
  media_type,
  caption,
  room_label,
  created_at
) ON public.property_photos TO anon;

NOTIFY pgrst, 'reload schema';
