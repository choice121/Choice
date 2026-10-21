-- Keep pipeline publishing admin-only and make the admin dashboard's
-- "Publish as draft" action create a non-public draft.
CREATE OR REPLACE FUNCTION public.pipeline_publish(
  p_id          text,
  p_landlord_id uuid DEFAULT NULL,
  p_status      text DEFAULT 'active'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
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
  v_pub_status  public.property_status;
  v_fee_amount  numeric;
BEGIN
  -- Browser calls must come from a signed-in administrator. Server-side
  -- service-role jobs remain supported.
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (
       auth.uid() IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()
       )
     ) THEN
    RETURN json_build_object('ok', false, 'error', 'Administrator access is required');
  END IF;

  SELECT * INTO p
  FROM pipeline.pipeline_properties
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Listing not found in pipeline');
  END IF;

  IF p.status = 'published' OR p.choice_property_id IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Listing has already been published');
  END IF;

  IF NULLIF(btrim(p.title), '') IS NULL
     OR NULLIF(btrim(p.address), '') IS NULL
     OR NULLIF(btrim(p.city), '') IS NULL
     OR NULLIF(btrim(p.state), '') IS NULL
     OR NULLIF(btrim(p.zip), '') IS NULL
     OR p.monthly_rent IS NULL OR p.monthly_rent <= 0 OR p.monthly_rent > 100000 THEN
    RETURN json_build_object('ok', false, 'error', 'Required fields missing or invalid');
  END IF;

  IF btrim(p.title) IS DISTINCT FROM
     btrim(p.address) || ', ' || btrim(p.city) || ', ' || btrim(p.state) || ' ' || btrim(p.zip) THEN
    RETURN json_build_object('ok', false, 'error', 'Title must match the full property address');
  END IF;

  IF p.application_fee IS DISTINCT FROM 50 THEN
    RETURN json_build_object('ok', false, 'error', 'Application fee must be set to exactly $50');
  END IF;

  IF p.description IS NULL
     OR btrim(p.description) = ''
     OR p.description !~* '(\$50[[:space:]]+application[[:space:]]+fee|application[[:space:]]+fee[[:space:]]*:[[:space:]]*\$?50([.]0{1,2})?([^0-9]|$))' THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'Description must be reviewed and state "$50 application fee" or "Application Fee: $50"'
    );
  END IF;

  IF p.description ~* '(\msecurity[[:space:]-]+deposit\M|\mdeposit\M|\mavailable\M|\mavailability\M|\mmove[[:space:]-]*in\M|\mlease\M|\mpets?\M|\mcats?\M|\mdogs?\M|\msmok(e|ing|er)\M|free[[:space:]]+(to[[:space:]]+)?apply|free[[:space:]]+application|apply[[:space:]]+for[[:space:]]+free|no[[:space:]]+(application[[:space:]]+|app[[:space:]]+)?fee|zero[[:space:]]+(application[[:space:]]+)?fee|complimentary[[:space:]]+application|application[[:space:]]+(is[[:space:]]+)?free|fee[- ]?free[[:space:]]+application|(^|[^0-9])\$?[[:space:]]*0([.]0*)?[[:space:]]+(application[[:space:]]+|app[[:space:]]+)?fee|(application[[:space:]]+|app[[:space:]]+)?fee([[:space:]]+will[[:space:]]+be|[[:space:]]+is)?[[:space:]]+waived|\m(turbotenant|zillow|apartments\.com|rentspree|rentcafe|appfolio)\M|listing[[:space:]]*id|apply[[:space:]]+on[[:space:]]+[[:alnum:]_-]+|https?://|www\.|schedule[[:space:]]+(a[[:space:]]+)?(tour|showing|viewing)|book[[:space:]]+(a[[:space:]]+)?(tour|showing|viewing)|open[[:space:]]+house|(call|text|contact)[[:space:]]+(the[[:space:]]+)?(agent|broker|owner|landlord|manager)|contact[[:space:]]+(us|the[[:space:]]+landlord)|[0-9]{3}([-.]|[[:space:]]|[)])?[0-9]{3}([-.]|[[:space:]])[0-9]{4}|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,})' THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'Description contains source terms that must be reviewed before publishing'
    );
  END IF;

  FOR v_fee_amount IN
    SELECT (matches)[1]::numeric
    FROM regexp_matches(
      p.description,
      '(?:application|app)[[:space:]]+fee(?:[[:space:]]+is|[[:space:]]+of|:|[[:space:]]+)[[:space:]]*\$?[[:space:]]*([0-9]+(?:[.][0-9]+)?)',
      'gi'
    ) AS matches
    UNION ALL
    SELECT (matches)[1]::numeric
    FROM regexp_matches(
      p.description,
      '\$?[[:space:]]*([0-9]+(?:[.][0-9]+)?)[[:space:]]+(?:application|app)[[:space:]]+fee',
      'gi'
    ) AS matches
  LOOP
    IF abs(v_fee_amount - 50) > 0.01 THEN
      RETURN json_build_object('ok', false, 'error', 'Description references a non-$50 application fee');
    END IF;
  END LOOP;

  IF COALESCE(p_status, '') NOT IN ('active', 'draft', 'private_placement') THEN
    RETURN json_build_object('ok', false, 'error', 'Unsupported listing status');
  END IF;
  v_pub_status := p_status::public.property_status;

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
  new_id := 'prop_' || left(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 12);

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
    p.monthly_rent,
    p.last_months_rent,
    50,
    NULL, p.admin_fee, p.move_in_special,
    NULL, -- available_date
    NULL, -- lease_terms
    NULL, -- minimum_lease_months
    NULL, -- pets_allowed
    NULL, -- pet_details
    NULL, -- pet_weight_limit
    NULL, -- smoking_allowed
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
    p.has_basement,
    p.has_central_air,
    v_listed,
    p.source_last_updated_at,
    v_imported_at,
    COALESCE(p.source_status, 'available'),
    p.last_verified_at
  );

  v_photos := NULL;
  IF p.original_image_urls IS NOT NULL AND p.original_image_urls <> '' AND p.original_image_urls <> '[]' THEN
    BEGIN v_photos := p.original_image_urls::jsonb; EXCEPTION WHEN OTHERS THEN v_photos := NULL; END;
  END IF;
  IF v_photos IS NOT NULL AND jsonb_typeof(v_photos) <> 'array' THEN v_photos := NULL; END IF;
  IF v_photos IS NULL OR jsonb_array_length(v_photos) = 0 THEN
    IF p.local_image_paths IS NOT NULL AND p.local_image_paths <> '' AND p.local_image_paths <> '[]' THEN
      BEGIN v_photos := p.local_image_paths::jsonb; EXCEPTION WHEN OTHERS THEN v_photos := NULL; END;
    END IF;
  END IF;
  IF v_photos IS NOT NULL AND jsonb_typeof(v_photos) <> 'array' THEN v_photos := NULL; END IF;

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

      v_url := NULLIF(btrim(v_url), '');
      IF v_url IS NOT NULL
         AND v_url ~* '^https://([a-z0-9-]+\.)*[a-z0-9-]+(:443)?([/?#]|$)'
         AND length(v_url) > 8 THEN
        INSERT INTO public.property_photos (
          id, property_id, url, file_id, width, height, display_order, is_hero, watermark_status, created_at
        ) VALUES (
          pg_catalog.gen_random_uuid(),
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

  RETURN json_build_object('ok', true, 'choice_property_id', new_id, 'status', v_pub_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pipeline_publish(text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_publish(text,uuid,text) TO authenticated, service_role;

-- The admin UI's delete-after-publish operation must use the same guarded
-- publisher. Require all three arguments so callers choose the target status.
CREATE OR REPLACE FUNCTION public.pipeline_publish_and_delete(
  p_id          text,
  p_landlord_id uuid,
  p_status      text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_result json;
BEGIN
  v_result := public.pipeline_publish(p_id, p_landlord_id, p_status);
  IF COALESCE((v_result->>'ok')::boolean, false) THEN
    DELETE FROM pipeline.pipeline_properties WHERE id = p_id;
  END IF;
  RETURN v_result;
END;
$$;

-- These legacy helper RPCs have no definitions in the checked-in migrations.
-- Remove browser-role access to the folder publisher (the admin UI now calls
-- the guarded single-listing RPC for each validated row) and to old delete
-- overloads. Keep service-role maintenance access.
DO $$
DECLARE
  v_signature regprocedure;
BEGIN
  FOR v_signature IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('pipeline_publish_and_delete', 'pipeline_folder_publish')
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_signature
    );
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_signature);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pipeline_publish_and_delete(text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_publish_and_delete(text,uuid,text) TO authenticated, service_role;
