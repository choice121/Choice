-- ============================================================================
-- Migration 000019: Strict Validation Gate on Publish, Worker Lease Lock RPC
-- & Final Removal of Any Automated Fallback Provider Metadata
-- ============================================================================
-- 1. Hardens public.pipeline_publish_for_batch so pending / NULL
--    validation_status rows can NEVER publish (strictly requires 'passed'
--    and needs_review = false).
-- 2. Adds public.job_verify_lease(...) so scraping, validating, enriching,
--    pricing, publishing, and verification endpoints reject mismatched or
--    missing lease_token / worker_id whenever a batch has an active lease,
--    preventing concurrent AI workers from colliding on the same batch.
-- 3. Removes the disabled legacy 'homeharvest' scraping provider row and
--    re-verifies zero scheduled scraping cron jobs exist.
-- ============================================================================

-- ── 1. Strict Pre-Publish Validation Gate ───────────────────────────────────
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
  v_pub_status := v_visibility::property_status;

  -- Pre-publish eligibility checks (strictly block pending/NULL/needs_review/rejected)
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

  -- Extract usable photos (strict original order, minimum 4 usable photos)
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

  -- Clean standardized address title + approved sanitized description
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

  -- Canonical reuse lookup across sibling batches without mutating sibling snapshots
  IF NULLIF(trim(COALESCE(p.choice_property_id, '')), '') IS NOT NULL THEN
    SELECT pr.id INTO v_prop_id
    FROM public.properties pr
    WHERE pr.id = p.choice_property_id
    LIMIT 1;
  END IF;

  IF v_prop_id IS NULL
     AND NULLIF(trim(COALESCE(p.source, '')), '') IS NOT NULL
     AND NULLIF(trim(COALESCE(p.source_listing_id, '')), '') IS NOT NULL THEN
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

    UPDATE public.properties
    SET virtual_tour_url = NULL,
        videos           = NULL,
        application_fee  = 50,
        showing_instructions = CASE WHEN v_visibility = 'private_placement' THEN NULL ELSE showing_instructions END
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

-- ── 2. Worker Lease Verification RPC (Multi-Worker Batch Locking) ───────────
CREATE OR REPLACE FUNCTION public.job_verify_lease(
  p_batch_id       TEXT,
  p_worker_id      TEXT DEFAULT NULL,
  p_lease_token    UUID DEFAULT NULL,
  p_admin_override BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_now       TIMESTAMPTZ := now();
  v_batch_id  TEXT := NULLIF(regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', ''), '');
  v_worker_id TEXT := NULLIF(trim(COALESCE(p_worker_id, '')), '');
  v_job       pipeline.batch_jobs%ROWTYPE;
  v_has_lease BOOLEAN := false;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_batch_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_required');
  END IF;

  SELECT * INTO v_job
  FROM pipeline.batch_jobs
  WHERE batch_id = v_batch_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'has_job', false,
      'has_active_lease', false,
      'lease_verified', true,
      'batch_id', v_batch_id
    );
  END IF;

  IF p_admin_override THEN
    RETURN jsonb_build_object(
      'ok', true,
      'has_job', true,
      'admin_override', true,
      'lease_verified', true,
      'batch_id', v_job.batch_id,
      'stage', v_job.stage,
      'holder_worker_id', v_job.worker_id,
      'lease_expires_at', v_job.lease_expires_at
    );
  END IF;

  IF v_job.stage = 'paused' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'job_is_paused',
      'batch_id', v_job.batch_id,
      'resume_stage', v_job.resume_stage,
      'message', 'Batch job is paused. Resume job before modifying this batch.'
    );
  END IF;

  v_has_lease := (
    v_job.worker_id IS NOT NULL
    AND v_job.lease_token IS NOT NULL
    AND v_job.lease_expires_at IS NOT NULL
    AND v_job.lease_expires_at > v_now
  );

  IF v_has_lease THEN
    IF v_worker_id IS NULL OR v_worker_id <> v_job.worker_id THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'lease_held_by_other_worker',
        'batch_id', v_job.batch_id,
        'holder_worker_id', v_job.worker_id,
        'lease_expires_at', v_job.lease_expires_at,
        'message', 'Batch #' || v_job.batch_id || ' is currently locked by worker ' || v_job.worker_id || '.'
      );
    END IF;

    IF p_lease_token IS NULL OR p_lease_token <> v_job.lease_token THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'lease_ownership_mismatch',
        'batch_id', v_job.batch_id,
        'holder_worker_id', v_job.worker_id,
        'lease_expires_at', v_job.lease_expires_at,
        'message', 'Valid reservation ticket (lease_token) required for active Batch #' || v_job.batch_id || '.'
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'has_job', true,
      'has_active_lease', true,
      'lease_verified', true,
      'batch_id', v_job.batch_id,
      'worker_id', v_job.worker_id,
      'lease_expires_at', v_job.lease_expires_at,
      'stage', v_job.stage
    );
  END IF;

  -- Reject stale worker requests explicitly carrying expired lease credentials
  IF v_job.lease_expires_at IS NOT NULL
     AND v_job.lease_expires_at <= v_now
     AND (v_worker_id IS NOT NULL OR p_lease_token IS NOT NULL) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'lease_expired',
      'batch_id', v_job.batch_id,
      'lease_expires_at', v_job.lease_expires_at,
      'message', 'Worker reservation ticket expired. Call claim_job or renew lease before continuing.'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'has_job', true,
    'has_active_lease', false,
    'lease_verified', true,
    'batch_id', v_job.batch_id,
    'stage', v_job.stage
  );
END;
$$;

REVOKE ALL ON FUNCTION public.job_verify_lease(TEXT, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_verify_lease(TEXT, TEXT, UUID, BOOLEAN) TO authenticated, service_role;

-- ── 3. Clean Residual Automated Fallback Metadata ───────────────────────────
DELETE FROM public.scraping_providers
WHERE provider_key = 'homeharvest';

UPDATE public.scraping_providers
SET
  display_name = 'Apify On-Demand Zillow Scraper',
  config_json = COALESCE(config_json, '{}'::jsonb)
    || '{"execution_mode":"on_demand_only","scheduled_scraping":false}'::jsonb,
  updated_at = NOW()
WHERE provider_key = 'apify';

UPDATE public.policy_rules
SET
  description = 'Default on-demand scraping provider key (operator-triggered only; zero scheduled scraping).'
WHERE rule_key = 'default_scraping_provider';

DO $$
DECLARE
  v_job RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR v_job IN
      SELECT jobid
      FROM cron.job
      WHERE jobname ILIKE '%scrap%'
         OR command ILIKE '%apify%'
         OR command ILIKE '%homeharvest%'
    LOOP
      PERFORM cron.unschedule(v_job.jobid);
    END LOOP;
  END IF;
END $$;
