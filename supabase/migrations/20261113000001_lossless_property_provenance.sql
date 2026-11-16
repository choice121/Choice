-- ============================================================================
-- Choice Properties — Lossless Property Data Extraction, Provenance & Media
-- ============================================================================
-- 1. Adds missing structured & provenance JSONB/scalar columns to:
--    - pipeline.pipeline_properties
--    - public.properties
--    - public.property_photos
-- 2. Updates public.pipeline_list so Admin Pipeline receives full staged records.
-- 3. Updates public.pipeline_save so Admin Pipeline edits persist new fields.
-- 4. Updates public.pipeline_publish_with_status (called by all pipeline_publish
--    and apartment-metadata wrappers) so structured domains, provenance,
--    financials, and photo metadata publish into public.properties and
--    public.property_photos while preserving text[] arrays, apartment
--    community workflows, and Choice platform public-display invariants.
-- ============================================================================

-- ── 1. Pipeline Staging Table Columns ───────────────────────────────────────
ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS property_subtype       TEXT,
  ADD COLUMN IF NOT EXISTS ev_charging            TEXT,
  ADD COLUMN IF NOT EXISTS hoa_fee                INTEGER,
  ADD COLUMN IF NOT EXISTS hoa_fee_frequency      TEXT,
  ADD COLUMN IF NOT EXISTS tax_annual_amount      INTEGER,
  ADD COLUMN IF NOT EXISTS tax_value              INTEGER,
  ADD COLUMN IF NOT EXISTS original_description   TEXT,
  ADD COLUMN IF NOT EXISTS source_raw_payload     JSONB,
  ADD COLUMN IF NOT EXISTS field_provenance       JSONB,
  ADD COLUMN IF NOT EXISTS structural_details     JSONB,
  ADD COLUMN IF NOT EXISTS utility_details        JSONB,
  ADD COLUMN IF NOT EXISTS financial_details      JSONB,
  ADD COLUMN IF NOT EXISTS location_details       JSONB,
  ADD COLUMN IF NOT EXISTS floor_plans            JSONB,
  ADD COLUMN IF NOT EXISTS videos                 JSONB;

-- ── 2. Public Properties Table Columns ──────────────────────────────────────
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS property_subtype       TEXT,
  ADD COLUMN IF NOT EXISTS unit_number            TEXT,
  ADD COLUMN IF NOT EXISTS half_bathrooms         INTEGER,
  ADD COLUMN IF NOT EXISTS total_bathrooms        NUMERIC,
  ADD COLUMN IF NOT EXISTS ev_charging            TEXT,
  ADD COLUMN IF NOT EXISTS hoa_fee                INTEGER,
  ADD COLUMN IF NOT EXISTS hoa_fee_frequency      TEXT,
  ADD COLUMN IF NOT EXISTS tax_annual_amount      INTEGER,
  ADD COLUMN IF NOT EXISTS tax_value              INTEGER,
  ADD COLUMN IF NOT EXISTS original_description   TEXT,
  ADD COLUMN IF NOT EXISTS original_data          JSONB,
  ADD COLUMN IF NOT EXISTS source_raw_payload     JSONB,
  ADD COLUMN IF NOT EXISTS field_provenance       JSONB,
  ADD COLUMN IF NOT EXISTS structural_details     JSONB,
  ADD COLUMN IF NOT EXISTS utility_details        JSONB,
  ADD COLUMN IF NOT EXISTS financial_details      JSONB,
  ADD COLUMN IF NOT EXISTS location_details       JSONB,
  ADD COLUMN IF NOT EXISTS floor_plans            JSONB,
  ADD COLUMN IF NOT EXISTS videos                 JSONB;

-- ── 3. Public Property Photos Metadata Columns ──────────────────────────────
ALTER TABLE public.property_photos
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'photo',
  ADD COLUMN IF NOT EXISTS caption    TEXT,
  ADD COLUMN IF NOT EXISTS room_label TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- ── 4. Safe JSONB helper for pipeline text -> jsonb conversions ─────────────
CREATE OR REPLACE FUNCTION pipeline.safe_parse_jsonb(p_raw text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_trimmed text;
BEGIN
  IF p_raw IS NULL THEN
    RETURN NULL;
  END IF;
  v_trimmed := btrim(p_raw);
  IF v_trimmed = '' OR v_trimmed = '[]' OR v_trimmed = '{}' OR lower(v_trimmed) = 'null' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v_trimmed::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- ── 5. Updated pipeline_list RPC (exposes full staged attributes) ───────────
CREATE OR REPLACE FUNCTION public.pipeline_list(
  p_status text DEFAULT 'scraped'::text,
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      id, status, title, address, unit_number, city, state, zip,
      bedrooms, bathrooms, half_bathrooms, total_bathrooms,
      square_footage, lot_size_sqft, floors, garage_spaces, total_units,
      monthly_rent, security_deposit, last_months_rent,
      application_fee, pet_deposit, admin_fee, parking_fee,
      hoa_fee, hoa_fee_frequency, tax_annual_amount, tax_value, move_in_special,
      property_type, property_subtype, year_built,
      description, original_description, showing_instructions,
      pets_allowed, pet_types_allowed, pet_weight_limit, pet_details,
      smoking_allowed, available_date, minimum_lease_months, lease_terms,
      parking, amenities, appliances, utilities_included, flooring,
      heating_type, cooling_type, laundry_type, ev_charging,
      virtual_tour_url, has_basement, has_central_air,
      data_quality_score, missing_fields, edited_fields,
      original_image_urls, local_image_paths,
      source_url, source, source_listing_id, agent_name, broker_name,
      poster_landlord_id, choice_property_id, batch_id,
      scraped_at, updated_at, published_at,
      neighborhood, county, location_context,
      listed_at, source_last_updated_at, imported_at, source_status, last_verified_at,
      lat, lng,
      original_data, source_raw_payload, field_provenance,
      structural_details, utility_details, financial_details, location_details,
      floor_plans, videos
    FROM pipeline.pipeline_properties
    WHERE (p_status = 'all' OR status = p_status)
    ORDER BY COALESCE(listed_at, imported_at, scraped_at::timestamptz) DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- ── 6. Updated pipeline_save RPC (persists expanded & JSONB fields) ─────────
CREATE OR REPLACE FUNCTION public.pipeline_save(
  p_id    text,
  p_patch jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $function$
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
    SELECT jsonb_array_elements_text(COALESCE(pipeline.safe_parse_jsonb(v_existing.edited_fields), '[]'::jsonb)) AS e
    UNION
    SELECT key FROM jsonb_each_text(p_patch)
  ) t(e);

  UPDATE pipeline.pipeline_properties SET
    title                = COALESCE(p_patch->>'title',                title),
    address              = COALESCE(p_patch->>'address',              address),
    unit_number          = CASE WHEN p_patch ? 'unit_number'          THEN NULLIF(p_patch->>'unit_number', '') ELSE unit_number END,
    city                 = COALESCE(p_patch->>'city',                 city),
    state                = COALESCE(p_patch->>'state',                state),
    zip                  = COALESCE(p_patch->>'zip',                  zip),
    county               = COALESCE(p_patch->>'county',               county),
    neighborhood         = COALESCE(p_patch->>'neighborhood',         neighborhood),
    bedrooms             = COALESCE((p_patch->>'bedrooms')::int,      bedrooms),
    bathrooms            = COALESCE((p_patch->>'bathrooms')::float,   bathrooms),
    half_bathrooms       = COALESCE((p_patch->>'half_bathrooms')::int, half_bathrooms),
    total_bathrooms      = COALESCE((p_patch->>'total_bathrooms')::float, total_bathrooms),
    square_footage       = COALESCE((p_patch->>'square_footage')::int,square_footage),
    lot_size_sqft        = COALESCE((p_patch->>'lot_size_sqft')::int, lot_size_sqft),
    floors               = COALESCE((p_patch->>'floors')::int,        floors),
    year_built           = COALESCE((p_patch->>'year_built')::int,    year_built),
    monthly_rent         = COALESCE((p_patch->>'monthly_rent')::int,  monthly_rent),
    security_deposit     = COALESCE((p_patch->>'security_deposit')::int, security_deposit),
    application_fee      = COALESCE((p_patch->>'application_fee')::int,  application_fee),
    hoa_fee              = COALESCE((p_patch->>'hoa_fee')::int,       hoa_fee),
    hoa_fee_frequency    = CASE WHEN p_patch ? 'hoa_fee_frequency'    THEN NULLIF(p_patch->>'hoa_fee_frequency', '') ELSE hoa_fee_frequency END,
    tax_annual_amount    = COALESCE((p_patch->>'tax_annual_amount')::int, tax_annual_amount),
    property_type        = COALESCE(p_patch->>'property_type',        property_type),
    property_subtype     = CASE WHEN p_patch ? 'property_subtype'     THEN NULLIF(p_patch->>'property_subtype', '') ELSE property_subtype END,
    description          = COALESCE(p_patch->>'description',          description),
    original_description = COALESCE(p_patch->>'original_description', original_description),
    showing_instructions = COALESCE(p_patch->>'showing_instructions', showing_instructions),
    move_in_special      = COALESCE(p_patch->>'move_in_special',      move_in_special),
    available_date       = COALESCE(p_patch->>'available_date',       available_date),
    pets_allowed         = COALESCE((p_patch->>'pets_allowed')::boolean,   pets_allowed),
    smoking_allowed      = COALESCE((p_patch->>'smoking_allowed')::boolean,smoking_allowed),
    minimum_lease_months = COALESCE((p_patch->>'minimum_lease_months')::int, minimum_lease_months),
    garage_spaces        = COALESCE((p_patch->>'garage_spaces')::int, garage_spaces),
    parking              = COALESCE(p_patch->>'parking',              parking),
    heating_type         = COALESCE(p_patch->>'heating_type',         heating_type),
    cooling_type         = COALESCE(p_patch->>'cooling_type',         cooling_type),
    laundry_type         = COALESCE(p_patch->>'laundry_type',         laundry_type),
    ev_charging          = CASE WHEN p_patch ? 'ev_charging'          THEN NULLIF(p_patch->>'ev_charging', '') ELSE ev_charging END,
    amenities            = COALESCE(p_patch->>'amenities',            amenities),
    appliances           = COALESCE(p_patch->>'appliances',           appliances),
    utilities_included   = COALESCE(p_patch->>'utilities_included',   utilities_included),
    flooring             = COALESCE(p_patch->>'flooring',             flooring),
    original_image_urls  = COALESCE(p_patch->>'original_image_urls',  original_image_urls),
    virtual_tour_url     = COALESCE(p_patch->>'virtual_tour_url',     virtual_tour_url),
    has_basement         = COALESCE((p_patch->>'has_basement')::boolean,   has_basement),
    has_central_air      = COALESCE((p_patch->>'has_central_air')::boolean,has_central_air),
    poster_landlord_id   = COALESCE(p_patch->>'poster_landlord_id',   poster_landlord_id),
    location_context     = COALESCE(p_patch->>'location_context',     location_context),
    field_provenance     = CASE WHEN p_patch ? 'field_provenance'     THEN p_patch->'field_provenance' ELSE field_provenance END,
    structural_details   = CASE WHEN p_patch ? 'structural_details'   THEN p_patch->'structural_details' ELSE structural_details END,
    utility_details      = CASE WHEN p_patch ? 'utility_details'      THEN p_patch->'utility_details' ELSE utility_details END,
    financial_details    = CASE WHEN p_patch ? 'financial_details'    THEN p_patch->'financial_details' ELSE financial_details END,
    location_details     = CASE WHEN p_patch ? 'location_details'     THEN p_patch->'location_details' ELSE location_details END,
    floor_plans          = CASE WHEN p_patch ? 'floor_plans'          THEN p_patch->'floor_plans' ELSE floor_plans END,
    videos               = CASE WHEN p_patch ? 'videos'               THEN p_patch->'videos' ELSE videos END,
    edited_fields        = COALESCE(v_edited, '[]'),
    status               = CASE WHEN status = 'scraped' THEN 'edited' ELSE status END,
    updated_at           = now()
  WHERE id = p_id;

  RETURN json_build_object('ok', true);
END;
$function$;

-- ── 7. Updated pipeline_publish_with_status RPC (lossless structured + media publish)
-- Preserves all public.pipeline_publish(...) overloads and apartment community wrappers.
CREATE OR REPLACE FUNCTION public.pipeline_publish_with_status(
  p_id          text,
  p_landlord_id uuid DEFAULT NULL::uuid,
  p_status      text DEFAULT 'active'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $function$
DECLARE
  p             pipeline.pipeline_properties%ROWTYPE;
  new_id        text;
  v_listed      date;
  v_imported_at timestamptz;
  v_photos      jsonb;
  v_elem        jsonb;
  v_url         text;
  v_file_id     text;
  v_caption     text;
  v_room_label  text;
  v_source_url  text;
  v_media_type  text;
  v_width       int;
  v_height      int;
  v_order       int := 1;
  v_pub_status  property_status;
  v_photo_count int := 0;
  v_amenities   text[] := NULL;
  v_appliances  text[] := NULL;
  v_utilities   text[] := NULL;
  v_flooring    text[] := NULL;
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

  -- Photo gate: at least one valid source photo URL required.
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
    v_listed := p.listed_at;
  EXCEPTION WHEN OTHERS THEN
    v_listed := NULL;
  END;

  -- Convert JSON array amenities, appliances, utilities, flooring to PostgreSQL text[]
  IF p.amenities IS NOT NULL AND p.amenities <> '' AND p.amenities <> '[]' THEN
    BEGIN
      SELECT array_agg(elem::text)
      INTO v_amenities
      FROM jsonb_array_elements_text(p.amenities::jsonb) AS elem
      WHERE elem IS NOT NULL AND elem <> '';
    EXCEPTION WHEN OTHERS THEN
      v_amenities := NULL;
    END;
  END IF;

  IF p.appliances IS NOT NULL AND p.appliances <> '' AND p.appliances <> '[]' THEN
    BEGIN
      SELECT array_agg(elem::text)
      INTO v_appliances
      FROM jsonb_array_elements_text(p.appliances::jsonb) AS elem
      WHERE elem IS NOT NULL AND elem <> '';
    EXCEPTION WHEN OTHERS THEN
      v_appliances := NULL;
    END;
  END IF;

  IF p.utilities_included IS NOT NULL AND p.utilities_included <> '' AND p.utilities_included <> '[]' THEN
    BEGIN
      SELECT array_agg(elem::text)
      INTO v_utilities
      FROM jsonb_array_elements_text(p.utilities_included::jsonb) AS elem
      WHERE elem IS NOT NULL AND elem <> '';
    EXCEPTION WHEN OTHERS THEN
      v_utilities := NULL;
    END;
  END IF;

  IF p.flooring IS NOT NULL AND p.flooring <> '' AND p.flooring <> '[]' THEN
    BEGIN
      SELECT array_agg(elem::text)
      INTO v_flooring
      FROM jsonb_array_elements_text(p.flooring::jsonb) AS elem
      WHERE elem IS NOT NULL AND elem <> '';
    EXCEPTION WHEN OTHERS THEN
      v_flooring := NULL;
    END;
  END IF;

  v_imported_at := COALESCE(p.imported_at, p.scraped_at, now());
  new_id := 'prop_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);

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
    COALESCE(p_landlord_id, p.poster_landlord_id::uuid),
    v_pub_status,
    p.title, p.description, COALESCE(p.original_description, p.description), p.showing_instructions,
    p.address, p.city, p.state, p.zip, p.county, p.neighborhood,
    p.lat, p.lng,
    p.property_type, p.property_subtype, p.year_built, p.floors,
    p.unit_number, p.total_units,
    p.bedrooms, p.bathrooms, p.half_bathrooms, COALESCE(p.total_bathrooms, p.bathrooms), p.square_footage,
    p.lot_size_sqft, p.garage_spaces,
    p.monthly_rent,
    COALESCE(p.security_deposit, p.monthly_rent),
    p.last_months_rent,
    50,
    p.pet_deposit, p.admin_fee, p.move_in_special,
    p.hoa_fee, p.hoa_fee_frequency, p.tax_annual_amount, p.tax_value,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL, NULL,
    NULL,
    p.parking, p.parking_fee, p.ev_charging,
    v_amenities,
    v_appliances,
    v_utilities,
    v_flooring,
    p.heating_type, p.cooling_type, p.laundry_type,
    p.location_context, p.virtual_tour_url,
    p.has_basement,
    p.has_central_air,
    v_listed,
    p.source_last_updated_at,
    v_imported_at,
    COALESCE(p.source_status, 'available'),
    p.last_verified_at,
    pipeline.safe_parse_jsonb(p.original_data::text),
    p.source_raw_payload,
    p.field_provenance,
    p.structural_details,
    p.utility_details,
    p.financial_details,
    p.location_details,
    p.floor_plans,
    p.videos
  );

  v_order := 1;
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_photos)
  LOOP
    v_url := NULL;
    v_file_id := NULL;
    v_caption := NULL;
    v_room_label := NULL;
    v_source_url := NULL;
    v_media_type := 'photo';
    v_width := NULL;
    v_height := NULL;

    IF jsonb_typeof(v_elem) = 'string' THEN
      v_url := v_elem #>> '{}';
      v_source_url := v_url;
    ELSIF jsonb_typeof(v_elem) = 'object' THEN
      v_url := v_elem->>'url';
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

  RETURN json_build_object(
    'ok', true,
    'choice_property_id', new_id,
    'status', v_pub_status,
    'photos', v_photo_count,
    'amenities_count', cardinality(v_amenities)
  );
END;
$function$;
