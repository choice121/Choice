-- ============================================================================
-- Migration: 20261030000004_multi_floor_end_to_end.sql
-- End-to-end Multi-Floor, Multi-Building, Multi-Unit, 3D Tour/Video Media,
-- and Unit-Scoped Rental Application Support
-- ============================================================================

-- 1. Pipeline staging column for unit/home floor label
ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS unit_floor text;

-- 2. Extend public.property_units with optional notes & rent_basis metadata
ALTER TABLE public.property_units
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS rent_basis text;

-- 3. Extend public.applications with unit / floor-plan / building / floor context
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.property_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_number text,
  ADD COLUMN IF NOT EXISTS floor_plan_name text,
  ADD COLUMN IF NOT EXISTS building_name text,
  ADD COLUMN IF NOT EXISTS floor_label text;

CREATE INDEX IF NOT EXISTS idx_applications_property_unit
  ON public.applications(property_id, unit_id);

-- 4. Ensure column-level SELECT grants cover all public/admin-preview fields
GRANT SELECT (status, notes, rent_basis, created_at, updated_at)
  ON TABLE public.property_units TO anon, authenticated;

GRANT SELECT (building_name, is_multi_unit, price_range, floors, total_units, unit_floor)
  ON TABLE public.properties TO anon, authenticated;

-- 5. Admin & Landlord Preview SELECT RLS Policies on Hierarchy, Units, and Media
-- Allows authenticated admins and owning landlords to preview draft, paused,
-- and private_placement listings with full buildings, floors, units, and media.
DROP POLICY IF EXISTS property_buildings_admin_or_landlord_read ON public.property_buildings;
CREATE POLICY property_buildings_admin_or_landlord_read
  ON public.property_buildings
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.properties prop
      JOIN public.landlords l ON l.id = prop.landlord_id
      WHERE prop.id = property_buildings.property_id
        AND l.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS property_floors_admin_or_landlord_read ON public.property_floors;
CREATE POLICY property_floors_admin_or_landlord_read
  ON public.property_floors
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.properties prop
      JOIN public.landlords l ON l.id = prop.landlord_id
      WHERE prop.id = property_floors.property_id
        AND l.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS property_units_admin_or_landlord_read ON public.property_units;
CREATE POLICY property_units_admin_or_landlord_read
  ON public.property_units
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.properties prop
      JOIN public.landlords l ON l.id = prop.landlord_id
      WHERE prop.id = property_units.property_id
        AND l.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS property_media_admin_or_landlord_read ON public.property_media;
CREATE POLICY property_media_admin_or_landlord_read
  ON public.property_media
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.properties prop
      JOIN public.landlords l ON l.id = prop.landlord_id
      WHERE prop.id = property_media.property_id
        AND l.user_id = auth.uid()
    )
  );

-- 6. Helper: safely parse JSON string array or comma list into text[]
CREATE OR REPLACE FUNCTION public.parse_json_text_array(p_raw text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_json jsonb;
  v_arr  text[];
BEGIN
  IF p_raw IS NULL OR btrim(p_raw) = '' OR btrim(p_raw) = '[]' OR btrim(p_raw) = 'null' THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_json := p_raw::jsonb;
    IF jsonb_typeof(v_json) = 'array' THEN
      SELECT array_agg(btrim(val))
        INTO v_arr
        FROM jsonb_array_elements_text(v_json) AS val
       WHERE val IS NOT NULL AND btrim(val) <> '';
      IF v_arr IS NOT NULL AND array_length(v_arr, 1) > 0 THEN
        RETURN v_arr;
      END IF;
      RETURN NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT array_agg(btrim(part))
    INTO v_arr
    FROM unnest(string_to_array(p_raw, ',')) AS part
   WHERE part IS NOT NULL AND btrim(part) <> '';

  IF v_arr IS NOT NULL AND array_length(v_arr, 1) > 0 THEN
    RETURN v_arr;
  END IF;
  RETURN NULL;
END;
$function$;

-- 7. Helper: natural sort order for floor labels (Basement -> 0, Floor 1 -> 1, Floor 2 -> 2, etc.)
CREATE OR REPLACE FUNCTION public.infer_floor_sort_order(p_label text, p_fallback int DEFAULT 10)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_low text := lower(COALESCE(btrim(p_label), ''));
  v_m   text[];
BEGIN
  IF v_low = '' THEN
    RETURN p_fallback;
  END IF;
  IF v_low ~ '(sub-?basement|lower level|cellar|basement|garden)' THEN
    RETURN 0;
  END IF;
  IF v_low ~ '(ground|lobby|main|first|1st)' THEN
    RETURN 1;
  END IF;
  IF v_low ~ '(second|2nd|upper)' THEN
    RETURN 2;
  END IF;
  IF v_low ~ '(third|3rd)' THEN
    RETURN 3;
  END IF;
  IF v_low ~ '(fourth|4th)' THEN
    RETURN 4;
  END IF;
  IF v_low ~ '(fifth|5th)' THEN
    RETURN 5;
  END IF;
  IF v_low ~ '(penthouse|rooftop|roof)' THEN
    RETURN 99;
  END IF;
  v_m := regexp_match(v_low, '(\d{1,3})');
  IF v_m IS NOT NULL AND v_m[1] IS NOT NULL THEN
    RETURN LEAST(GREATEST(v_m[1]::int, 0), 999);
  END IF;
  RETURN p_fallback;
END;
$function$;

-- 8. Upgrade delete_properties_cascade so leaf-to-root deletion never hits
-- composite NO ACTION FKs between property_media, property_units, property_floors, and property_buildings.
CREATE OR REPLACE FUNCTION public.delete_properties_cascade(p_ids text[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline', 'pg_temp'
AS $function$
DECLARE
  v_deleted int := 0;
  v_clean_ids text[];
  v_uuid_ids uuid[];
  v_file_ids text[];
  v_actually_deleted text[];
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', 0, 'deleted_ids', ARRAY[]::text[], 'file_ids', ARRAY[]::text[]);
  END IF;

  SELECT array_agg(DISTINCT trim(elem))
    INTO v_clean_ids
    FROM unnest(p_ids) elem
   WHERE elem IS NOT NULL AND trim(elem) <> '';

  IF v_clean_ids IS NULL OR array_length(v_clean_ids, 1) = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', 0, 'deleted_ids', ARRAY[]::text[], 'file_ids', ARRAY[]::text[]);
  END IF;

  SELECT array_agg(DISTINCT elem::uuid)
    INTO v_uuid_ids
    FROM unnest(v_clean_ids) elem
   WHERE elem ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  -- Collect ImageKit file_ids from both property_photos and property_media
  SELECT array_agg(DISTINCT fid)
    INTO v_file_ids
    FROM (
      SELECT file_id AS fid
        FROM public.property_photos
       WHERE property_id = ANY(v_clean_ids)
         AND file_id IS NOT NULL AND trim(file_id) <> ''
      UNION
      SELECT file_id AS fid
        FROM public.property_media
       WHERE property_id = ANY(v_clean_ids)
         AND file_id IS NOT NULL AND trim(file_id) <> ''
    ) sub;

  -- Unlink applications referencing these properties or their units
  UPDATE public.applications
     SET property_id = NULL,
         unit_id = NULL
   WHERE property_id = ANY(v_clean_ids);

  -- Delete multi-floor media, units, floors, buildings in strict leaf-to-root order
  DELETE FROM public.property_media     WHERE property_id = ANY(v_clean_ids);
  DELETE FROM public.property_units     WHERE property_id = ANY(v_clean_ids);
  DELETE FROM public.property_floors    WHERE property_id = ANY(v_clean_ids);
  DELETE FROM public.property_buildings WHERE property_id = ANY(v_clean_ids);
  DELETE FROM public.property_photos    WHERE property_id = ANY(v_clean_ids);

  DELETE FROM public.saved_properties   WHERE property_id = ANY(v_clean_ids);
  DELETE FROM public.inquiries          WHERE property_id = ANY(v_clean_ids);

  BEGIN
    DELETE FROM public.location_notifications
     WHERE property_id = ANY(v_clean_ids);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF v_uuid_ids IS NOT NULL AND array_length(v_uuid_ids, 1) > 0 THEN
    BEGIN
      UPDATE public.client_collections
         SET property_ids = ARRAY(
           SELECT unnest(property_ids)
           EXCEPT
           SELECT unnest(v_uuid_ids)
         )
       WHERE property_ids && v_uuid_ids;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  BEGIN
    UPDATE pipeline.pipeline_properties
       SET choice_property_id = NULL
     WHERE choice_property_id = ANY(v_clean_ids);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  WITH del AS (
    DELETE FROM public.properties
     WHERE id = ANY(v_clean_ids)
    RETURNING id
  )
  SELECT array_agg(id) INTO v_actually_deleted FROM del;

  v_deleted := COALESCE(array_length(v_actually_deleted, 1), 0);

  RETURN json_build_object(
    'ok', true,
    'deleted', v_deleted,
    'deleted_ids', COALESCE(v_actually_deleted, ARRAY[]::text[]),
    'file_ids', COALESCE(v_file_ids, ARRAY[]::text[])
  );
END;
$function$;

-- 9. Upgrade public.pipeline_save(p_id text, p_patch jsonb)
CREATE OR REPLACE FUNCTION public.pipeline_save(p_id text, p_patch jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $function$
DECLARE
  v_existing   pipeline.pipeline_properties%ROWTYPE;
  v_edited     text;
  v_orig_json  jsonb := '{}'::jsonb;
  v_patch_orig jsonb;
BEGIN
  SELECT * INTO v_existing FROM pipeline.pipeline_properties WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Not found');
  END IF;

  SELECT array_to_json(array_agg(DISTINCT e))::text
  INTO v_edited
  FROM (
    SELECT jsonb_array_elements_text(
      CASE
        WHEN v_existing.edited_fields IS NOT NULL
         AND btrim(v_existing.edited_fields) <> ''
         AND left(btrim(v_existing.edited_fields), 1) = '['
        THEN v_existing.edited_fields::jsonb
        ELSE '[]'::jsonb
      END
    ) AS e
    UNION
    SELECT key FROM jsonb_each(p_patch)
  ) t(e);

  -- Preserve and optionally merge original_data when p_patch contains original_data or multi-unit metadata
  BEGIN
    IF v_existing.original_data IS NOT NULL AND btrim(v_existing.original_data) <> '' THEN
      v_orig_json := v_existing.original_data::jsonb;
      IF jsonb_typeof(v_orig_json) <> 'object' THEN
        v_orig_json := '{}'::jsonb;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_orig_json := '{}'::jsonb;
  END;

  IF p_patch ? 'original_data' THEN
    BEGIN
      IF jsonb_typeof(p_patch->'original_data') = 'object' THEN
        v_orig_json := v_orig_json || (p_patch->'original_data');
      ELSIF jsonb_typeof(p_patch->'original_data') = 'string' THEN
        v_patch_orig := (p_patch->>'original_data')::jsonb;
        IF jsonb_typeof(v_patch_orig) = 'object' THEN
          v_orig_json := v_orig_json || v_patch_orig;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF p_patch ? 'building_name' THEN
    v_orig_json := jsonb_set(v_orig_json, '{building_name}', to_jsonb(NULLIF(btrim(COALESCE(p_patch->>'building_name', '')), '')), true);
  END IF;
  IF p_patch ? 'is_multi_unit' THEN
    v_orig_json := jsonb_set(v_orig_json, '{is_multi_unit}', COALESCE(p_patch->'is_multi_unit', 'null'::jsonb), true);
  END IF;
  IF p_patch ? 'price_range' THEN
    v_orig_json := jsonb_set(v_orig_json, '{price_range}', to_jsonb(NULLIF(btrim(COALESCE(p_patch->>'price_range', '')), '')), true);
  END IF;
  IF p_patch ? 'unit_floor' THEN
    v_orig_json := jsonb_set(v_orig_json, '{unit_floor}', to_jsonb(NULLIF(btrim(COALESCE(p_patch->>'unit_floor', '')), '')), true);
  END IF;

  UPDATE pipeline.pipeline_properties SET
    title                = CASE WHEN p_patch ? 'title'                THEN NULLIF(btrim(COALESCE(p_patch->>'title', '')), '')                ELSE title END,
    address              = CASE WHEN p_patch ? 'address'              THEN NULLIF(btrim(COALESCE(p_patch->>'address', '')), '')              ELSE address END,
    unit_number          = CASE WHEN p_patch ? 'unit_number'          THEN NULLIF(btrim(COALESCE(p_patch->>'unit_number', '')), '')          ELSE unit_number END,
    unit_floor           = CASE WHEN p_patch ? 'unit_floor'           THEN NULLIF(btrim(COALESCE(p_patch->>'unit_floor', '')), '')           ELSE unit_floor END,
    building_name        = CASE WHEN p_patch ? 'building_name'        THEN NULLIF(btrim(COALESCE(p_patch->>'building_name', '')), '')        ELSE building_name END,
    city                 = CASE WHEN p_patch ? 'city'                 THEN NULLIF(btrim(COALESCE(p_patch->>'city', '')), '')                 ELSE city END,
    state                = CASE WHEN p_patch ? 'state'                THEN NULLIF(btrim(COALESCE(p_patch->>'state', '')), '')                ELSE state END,
    zip                  = CASE WHEN p_patch ? 'zip'                  THEN NULLIF(btrim(COALESCE(p_patch->>'zip', '')), '')                  ELSE zip END,
    county               = CASE WHEN p_patch ? 'county'               THEN NULLIF(btrim(COALESCE(p_patch->>'county', '')), '')               ELSE county END,
    neighborhood         = CASE WHEN p_patch ? 'neighborhood'         THEN NULLIF(btrim(COALESCE(p_patch->>'neighborhood', '')), '')         ELSE neighborhood END,
    lat                  = CASE WHEN p_patch ? 'lat'                  THEN NULLIF(btrim(COALESCE(p_patch->>'lat', '')), '')::float           ELSE lat END,
    lng                  = CASE WHEN p_patch ? 'lng'                  THEN NULLIF(btrim(COALESCE(p_patch->>'lng', '')), '')::float           ELSE lng END,
    bedrooms             = CASE WHEN p_patch ? 'bedrooms'             THEN NULLIF(btrim(COALESCE(p_patch->>'bedrooms', '')), '')::int        ELSE bedrooms END,
    bathrooms            = CASE WHEN p_patch ? 'bathrooms'            THEN NULLIF(btrim(COALESCE(p_patch->>'bathrooms', '')), '')::float     ELSE bathrooms END,
    half_bathrooms       = CASE WHEN p_patch ? 'half_bathrooms'       THEN NULLIF(btrim(COALESCE(p_patch->>'half_bathrooms', '')), '')::int  ELSE half_bathrooms END,
    total_bathrooms      = CASE WHEN p_patch ? 'total_bathrooms'      THEN NULLIF(btrim(COALESCE(p_patch->>'total_bathrooms', '')), '')::float
                                WHEN p_patch ? 'bathrooms'            THEN NULLIF(btrim(COALESCE(p_patch->>'bathrooms', '')), '')::float
                                ELSE total_bathrooms END,
    square_footage       = CASE WHEN p_patch ? 'square_footage'       THEN NULLIF(btrim(COALESCE(p_patch->>'square_footage', '')), '')::int  ELSE square_footage END,
    lot_size_sqft        = CASE WHEN p_patch ? 'lot_size_sqft'        THEN NULLIF(btrim(COALESCE(p_patch->>'lot_size_sqft', '')), '')::int   ELSE lot_size_sqft END,
    year_built           = CASE WHEN p_patch ? 'year_built'           THEN NULLIF(btrim(COALESCE(p_patch->>'year_built', '')), '')::int      ELSE year_built END,
    floors               = CASE WHEN p_patch ? 'floors'               THEN NULLIF(btrim(COALESCE(p_patch->>'floors', '')), '')::int          ELSE floors END,
    total_units          = CASE WHEN p_patch ? 'total_units'          THEN NULLIF(btrim(COALESCE(p_patch->>'total_units', '')), '')::int     ELSE total_units END,
    is_multi_unit        = CASE WHEN p_patch ? 'is_multi_unit'        THEN NULLIF(btrim(COALESCE(p_patch->>'is_multi_unit', '')), '')::boolean ELSE is_multi_unit END,
    price_range          = CASE WHEN p_patch ? 'price_range'          THEN NULLIF(btrim(COALESCE(p_patch->>'price_range', '')), '')          ELSE price_range END,
    monthly_rent         = CASE WHEN p_patch ? 'monthly_rent'         THEN NULLIF(btrim(COALESCE(p_patch->>'monthly_rent', '')), '')::int    ELSE monthly_rent END,
    security_deposit     = CASE WHEN p_patch ? 'security_deposit'     THEN NULLIF(btrim(COALESCE(p_patch->>'security_deposit', '')), '')::int ELSE security_deposit END,
    application_fee      = CASE WHEN p_patch ? 'application_fee'      THEN NULLIF(btrim(COALESCE(p_patch->>'application_fee', '')), '')::int ELSE application_fee END,
    pet_deposit          = CASE WHEN p_patch ? 'pet_deposit'          THEN NULLIF(btrim(COALESCE(p_patch->>'pet_deposit', '')), '')::int     ELSE pet_deposit END,
    admin_fee            = CASE WHEN p_patch ? 'admin_fee'            THEN NULLIF(btrim(COALESCE(p_patch->>'admin_fee', '')), '')::int       ELSE admin_fee END,
    parking_fee          = CASE WHEN p_patch ? 'parking_fee'          THEN NULLIF(btrim(COALESCE(p_patch->>'parking_fee', '')), '')::int     ELSE parking_fee END,
    hoa_fee              = CASE WHEN p_patch ? 'hoa_fee'              THEN NULLIF(btrim(COALESCE(p_patch->>'hoa_fee', '')), '')::int         ELSE hoa_fee END,
    property_type        = CASE WHEN p_patch ? 'property_type'        THEN NULLIF(btrim(COALESCE(p_patch->>'property_type', '')), '')        ELSE property_type END,
    description          = CASE WHEN p_patch ? 'description'          THEN NULLIF(btrim(COALESCE(p_patch->>'description', '')), '')          ELSE description END,
    original_description = CASE WHEN p_patch ? 'original_description' THEN NULLIF(btrim(COALESCE(p_patch->>'original_description', '')), '') ELSE original_description END,
    showing_instructions = CASE WHEN p_patch ? 'showing_instructions' THEN NULLIF(btrim(COALESCE(p_patch->>'showing_instructions', '')), '') ELSE showing_instructions END,
    move_in_special      = CASE WHEN p_patch ? 'move_in_special'      THEN NULLIF(btrim(COALESCE(p_patch->>'move_in_special', '')), '')      ELSE move_in_special END,
    parking              = CASE WHEN p_patch ? 'parking'              THEN NULLIF(btrim(COALESCE(p_patch->>'parking', '')), '')              ELSE parking END,
    heating_type         = CASE WHEN p_patch ? 'heating_type'         THEN NULLIF(btrim(COALESCE(p_patch->>'heating_type', '')), '')         ELSE heating_type END,
    cooling_type         = CASE WHEN p_patch ? 'cooling_type'         THEN NULLIF(btrim(COALESCE(p_patch->>'cooling_type', '')), '')         ELSE cooling_type END,
    laundry_type         = CASE WHEN p_patch ? 'laundry_type'         THEN NULLIF(btrim(COALESCE(p_patch->>'laundry_type', '')), '')         ELSE laundry_type END,
    amenities            = CASE WHEN p_patch ? 'amenities'            THEN COALESCE(p_patch->>'amenities', '[]')                             ELSE amenities END,
    appliances           = CASE WHEN p_patch ? 'appliances'           THEN COALESCE(p_patch->>'appliances', '[]')                            ELSE appliances END,
    utilities_included   = CASE WHEN p_patch ? 'utilities_included'   THEN COALESCE(p_patch->>'utilities_included', '[]')                    ELSE utilities_included END,
    flooring             = CASE WHEN p_patch ? 'flooring'             THEN COALESCE(p_patch->>'flooring', '[]')                              ELSE flooring END,
    available_date       = NULL,
    pets_allowed         = NULL,
    smoking_allowed      = NULL,
    minimum_lease_months = NULL,
    garage_spaces        = CASE WHEN p_patch ? 'garage_spaces'        THEN NULLIF(btrim(COALESCE(p_patch->>'garage_spaces', '')), '')::int   ELSE garage_spaces END,
    virtual_tour_url     = CASE WHEN p_patch ? 'virtual_tour_url'     THEN NULLIF(btrim(COALESCE(p_patch->>'virtual_tour_url', '')), '')     ELSE virtual_tour_url END,
    has_basement         = CASE WHEN p_patch ? 'has_basement'         THEN NULLIF(btrim(COALESCE(p_patch->>'has_basement', '')), '')::boolean ELSE has_basement END,
    has_central_air      = CASE WHEN p_patch ? 'has_central_air'      THEN NULLIF(btrim(COALESCE(p_patch->>'has_central_air', '')), '')::boolean ELSE has_central_air END,
    poster_landlord_id   = CASE WHEN p_patch ? 'poster_landlord_id'   THEN NULLIF(btrim(COALESCE(p_patch->>'poster_landlord_id', '')), '')   ELSE poster_landlord_id END,
    location_context     = CASE WHEN p_patch ? 'location_context'     THEN NULLIF(btrim(COALESCE(p_patch->>'location_context', '')), '')     ELSE location_context END,
    original_data        = v_orig_json::text,
    edited_fields        = COALESCE(v_edited, '[]'),
    status               = CASE WHEN status = 'scraped' THEN 'edited' ELSE status END,
    updated_at           = now()
  WHERE id = p_id;

  RETURN json_build_object('ok', true);
END;
$function$;

-- 10. Upgrade public.pipeline_publish(p_id text, p_landlord_id uuid DEFAULT NULL, p_status text DEFAULT 'active')
CREATE OR REPLACE FUNCTION public.pipeline_publish(
  p_id text,
  p_landlord_id uuid DEFAULT NULL::uuid,
  p_status text DEFAULT 'active'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $function$
DECLARE
  p                   pipeline.pipeline_properties%ROWTYPE;
  new_id              text;
  v_listed            date;
  v_imported_at       timestamptz;
  v_orig              jsonb := '{}'::jsonb;
  v_unit_options      jsonb := '[]'::jsonb;
  v_buildings_json    jsonb := '[]'::jsonb;
  v_floors_json       jsonb := '[]'::jsonb;
  v_is_multi_unit     boolean := false;
  v_min_unit_rent     int := NULL;
  v_comm_rent         int := NULL;
  v_effective_rent    int := NULL;
  v_address           text := NULL;
  v_title             text := NULL;
  v_building_name     text := NULL;
  v_price_range       text := NULL;
  v_unit_floor        text := NULL;
  v_total_units       int := NULL;
  v_landlord_uuid     uuid := NULL;

  v_photos            jsonb := NULL;
  v_elem              jsonb;
  v_url               text;
  v_file_id           text;
  v_width             int;
  v_height            int;
  v_order             int := 1;
  v_photo_count       int := 0;
  v_valid_photo_found boolean := false;
  v_pub_status        property_status;

  v_default_bldg_id   uuid := NULL;
  v_default_bldg_name text := NULL;
  v_has_any_hierarchy boolean := false;
  v_bldg_entry        jsonb;
  v_bldg_name         text;
  v_bldg_code         text;
  v_bldg_sort         int := 0;
  v_bldg_id           uuid;

  v_floor_entry       jsonb;
  v_floor_label       text;
  v_floor_code        text;
  v_floor_bldg_name   text;
  v_floor_bldg_id     uuid;
  v_floor_id          uuid;
  v_floor_sort        int := 10;

  v_unit_entry        jsonb;
  v_unit_num          text;
  v_unit_num_final    text;
  v_unit_fp_name      text;
  v_unit_fp_img       text;
  v_unit_beds         numeric;
  v_unit_baths        numeric;
  v_unit_sqft         int;
  v_unit_rent         int;
  v_unit_basis        text;
  v_unit_notes        text;
  v_unit_bldg_name    text;
  v_unit_floor_lbl    text;
  v_unit_bldg_id      uuid;
  v_unit_floor_id     uuid;
  v_unit_photos       jsonb;
  v_unit_amenities    text[];
  v_inserted_unit_id  uuid;
  v_unit_count        int := 0;

  v_media             jsonb := '[]'::jsonb;
  v_media_entry       jsonb;
  v_media_kind        text;
  v_media_url         text;
  v_media_title       text;
  v_media_floor       text;
  v_media_bldg        text;
  v_media_unit_num    text;
  v_media_provider    text;
  v_media_poster      text;
  v_media_file_id     text;
  v_media_display_ord int;
  v_media_hero        boolean;
  v_media_width       int;
  v_media_height      int;
  v_media_metadata    jsonb;
  v_media_index       int := 0;
  v_media_bldg_id     uuid;
  v_media_floor_id    uuid;
  v_media_unit_id     uuid;
BEGIN
  SELECT * INTO p FROM pipeline.pipeline_properties WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Listing not found in pipeline');
  END IF;

  -- Parse original_data JSONB safely
  BEGIN
    IF p.original_data IS NOT NULL AND btrim(p.original_data) <> '' AND btrim(p.original_data) <> 'null' THEN
      v_orig := p.original_data::jsonb;
      IF jsonb_typeof(v_orig) <> 'object' THEN
        v_orig := '{}'::jsonb;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_orig := '{}'::jsonb;
  END;

  IF jsonb_typeof(v_orig->'unit_options') = 'array' THEN
    v_unit_options := v_orig->'unit_options';
  END IF;
  IF jsonb_typeof(v_orig->'buildings') = 'array' THEN
    v_buildings_json := v_orig->'buildings';
  END IF;
  IF jsonb_typeof(v_orig->'floors') = 'array' THEN
    v_floors_json := v_orig->'floors';
  END IF;
  IF jsonb_typeof(v_orig->'media') = 'array' THEN
    v_media := v_orig->'media';
  END IF;

  v_building_name := COALESCE(
    NULLIF(btrim(COALESCE(p.building_name, '')), ''),
    NULLIF(btrim(COALESCE(v_orig->>'building_name', '')), '')
  );
  v_price_range := COALESCE(
    NULLIF(btrim(COALESCE(p.price_range, '')), ''),
    NULLIF(btrim(COALESCE(v_orig->>'price_range', '')), '')
  );
  v_unit_floor := COALESCE(
    NULLIF(btrim(COALESCE(p.unit_floor, '')), ''),
    NULLIF(btrim(COALESCE(v_orig->>'unit_floor', '')), '')
  );

  v_is_multi_unit := COALESCE(
    p.is_multi_unit,
    CASE WHEN jsonb_typeof(v_orig->'is_multi_unit') = 'boolean' THEN (v_orig->>'is_multi_unit')::boolean ELSE NULL END,
    (jsonb_array_length(v_unit_options) > 0),
    (COALESCE(p.total_units, 0) > 1),
    false
  );

  -- Compute minimum unit/layout rent from unit_options if available
  IF jsonb_array_length(v_unit_options) > 0 THEN
    SELECT MIN(r_val)
      INTO v_min_unit_rent
      FROM (
        SELECT CASE
          WHEN COALESCE(u->>'monthly_rent', '') ~ '^\d+(\.\d+)?$' AND (u->>'monthly_rent')::numeric > 0
            THEN ROUND((u->>'monthly_rent')::numeric)::int
          WHEN COALESCE(u->>'starting_rent', '') ~ '^\d+(\.\d+)?$' AND (u->>'starting_rent')::numeric > 0
            THEN ROUND((u->>'starting_rent')::numeric)::int
          ELSE NULL
        END AS r_val
        FROM jsonb_array_elements(v_unit_options) AS u
      ) rents
     WHERE r_val IS NOT NULL AND r_val > 0;
  END IF;

  BEGIN
    IF COALESCE(v_orig->>'community_starting_rent', '') ~ '^\d+(\.\d+)?$' THEN
      v_comm_rent := ROUND((v_orig->>'community_starting_rent')::numeric)::int;
      IF v_comm_rent <= 0 THEN v_comm_rent := NULL; END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_comm_rent := NULL;
  END;

  v_effective_rent := COALESCE(NULLIF(p.monthly_rent, 0), v_comm_rent, v_min_unit_rent);
  v_title := NULLIF(btrim(COALESCE(p.title, '')), '');
  v_address := COALESCE(
    NULLIF(btrim(COALESCE(p.address, '')), ''),
    v_building_name,
    v_title
  );

  IF v_title IS NULL OR v_address IS NULL
     OR NULLIF(btrim(COALESCE(p.city, '')), '') IS NULL
     OR NULLIF(btrim(COALESCE(p.state, '')), '') IS NULL
     OR NULLIF(btrim(COALESCE(p.zip, '')), '') IS NULL
     OR v_effective_rent IS NULL OR v_effective_rent <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'Required fields missing (address, city, state, zip, or asking rent)');
  END IF;

  IF NOT v_is_multi_unit AND (p.bedrooms IS NULL OR p.bathrooms IS NULL) THEN
    RETURN json_build_object('ok', false, 'error', 'Required fields missing (bedrooms and bathrooms are required for single-unit listings)');
  END IF;

  -- Resolve photos in strict original source order (Directive 2)
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

  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_photos)
  LOOP
    IF (jsonb_typeof(v_elem) = 'string' AND length(btrim(v_elem #>> '{}')) > 5)
       OR (jsonb_typeof(v_elem) = 'object' AND length(btrim(COALESCE(v_elem->>'url', ''))) > 5) THEN
      v_valid_photo_found := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_valid_photo_found THEN
    RETURN json_build_object('ok', false, 'error', 'No valid photos available; cannot publish');
  END IF;

  -- Map requested status cleanly
  IF p_status = 'private_placement' THEN
    v_pub_status := 'private_placement'::property_status;
  ELSIF p_status = 'draft' THEN
    v_pub_status := 'draft'::property_status;
  ELSIF p_status = 'paused' THEN
    v_pub_status := 'paused'::property_status;
  ELSE
    v_pub_status := 'active'::property_status;
  END IF;

  BEGIN
    IF p.listed_at IS NOT NULL AND p.listed_at::text <> '' THEN
      v_listed := p.listed_at::date;
    ELSE
      v_listed := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_listed := NULL;
  END;

  BEGIN
    IF p_landlord_id IS NOT NULL THEN
      v_landlord_uuid := p_landlord_id;
    ELSIF p.poster_landlord_id IS NOT NULL AND p.poster_landlord_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_landlord_uuid := p.poster_landlord_id::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_landlord_uuid := NULL;
  END;

  v_total_units := COALESCE(
    p.total_units,
    CASE WHEN jsonb_array_length(v_unit_options) > 0 THEN jsonb_array_length(v_unit_options) ELSE NULL END
  );

  v_imported_at := COALESCE(p.imported_at, p.scraped_at, now());
  new_id := 'prop_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);

  -- Insert published property enforcing all Choice Properties platform invariants
  INSERT INTO public.properties (
    id, landlord_id, status,
    title, description, original_description, showing_instructions,
    address, city, state, zip, county, neighborhood,
    lat, lng,
    property_type, year_built, floors,
    unit_number, unit_floor, total_units,
    building_name, is_multi_unit, price_range,
    bedrooms, bathrooms, half_bathrooms, total_bathrooms, square_footage,
    lot_size_sqft, garage_spaces,
    monthly_rent, security_deposit, last_months_rent,
    application_fee, pet_deposit, admin_fee, move_in_special,
    available_date, lease_terms, minimum_lease_months,
    pets_allowed, pet_types_allowed, pet_details, pet_weight_limit,
    smoking_allowed,
    parking, parking_fee,
    amenities, appliances, utilities_included, flooring,
    heating_type, cooling_type, laundry_type,
    location_context, virtual_tour_url,
    has_basement, has_central_air,
    listed_at, source_last_updated_at, imported_at, source_status, last_verified_at
  ) VALUES (
    new_id,
    v_landlord_uuid,
    v_pub_status,
    v_title,
    p.description,
    COALESCE(p.original_description, p.description),
    p.showing_instructions,
    v_address,
    btrim(p.city),
    btrim(p.state),
    btrim(p.zip),
    p.county,
    p.neighborhood,
    p.lat,
    p.lng,
    p.property_type,
    p.year_built,
    p.floors,
    p.unit_number,
    v_unit_floor,
    v_total_units,
    v_building_name,
    v_is_multi_unit,
    v_price_range,
    p.bedrooms,
    p.bathrooms,
    p.half_bathrooms,
    COALESCE(p.total_bathrooms, p.bathrooms),
    p.square_footage,
    p.lot_size_sqft,
    p.garage_spaces,
    v_effective_rent,
    COALESCE(NULLIF(p.security_deposit, 0), v_effective_rent),
    p.last_months_rent,
    50,
    NULL,
    p.admin_fee,
    p.move_in_special,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    p.parking,
    p.parking_fee,
    public.parse_json_text_array(p.amenities),
    public.parse_json_text_array(p.appliances),
    public.parse_json_text_array(p.utilities_included),
    public.parse_json_text_array(p.flooring),
    p.heating_type,
    p.cooling_type,
    p.laundry_type,
    p.location_context,
    p.virtual_tour_url,
    p.has_basement,
    p.has_central_air,
    v_listed,
    p.source_last_updated_at,
    v_imported_at,
    COALESCE(p.source_status, 'available'),
    p.last_verified_at
  );

  -- ── Populate Hierarchy: Buildings & Floors ─────────────────────────────────
  -- Check whether any buildings or floors are referenced across payload, units, or media
  v_has_any_hierarchy := (
    jsonb_array_length(v_buildings_json) > 0
    OR jsonb_array_length(v_floors_json) > 0
    OR v_unit_floor IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_unit_options) u
       WHERE NULLIF(btrim(COALESCE(u->>'building_name', '')), '') IS NOT NULL
          OR NULLIF(btrim(COALESCE(u->>'floor_label', '')), '') IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_media) m
       WHERE NULLIF(btrim(COALESCE(m->>'building_name', '')), '') IS NOT NULL
          OR NULLIF(btrim(COALESCE(m->>'floor_label', '')), '') IS NOT NULL
    )
  );

  -- 1. Insert explicit buildings from original_data.buildings
  IF jsonb_array_length(v_buildings_json) > 0 THEN
    FOR v_bldg_entry IN SELECT * FROM jsonb_array_elements(v_buildings_json)
    LOOP
      IF jsonb_typeof(v_bldg_entry) = 'string' THEN
        v_bldg_name := NULLIF(btrim(v_bldg_entry #>> '{}'), '');
        v_bldg_code := NULL;
      ELSIF jsonb_typeof(v_bldg_entry) = 'object' THEN
        v_bldg_name := NULLIF(btrim(COALESCE(v_bldg_entry->>'name', v_bldg_entry->>'building_name', '')), '');
        v_bldg_code := NULLIF(btrim(COALESCE(v_bldg_entry->>'building_code', v_bldg_entry->>'code', '')), '');
      ELSE
        v_bldg_name := NULL;
      END IF;

      IF v_bldg_name IS NOT NULL THEN
        SELECT id INTO v_bldg_id
          FROM public.property_buildings
         WHERE property_id = new_id AND lower(name) = lower(v_bldg_name)
         LIMIT 1;

        IF v_bldg_id IS NULL THEN
          IF v_bldg_code IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.property_buildings WHERE property_id = new_id AND building_code = v_bldg_code
          ) THEN
            v_bldg_code := NULL;
          END IF;

          INSERT INTO public.property_buildings (property_id, name, building_code, sort_order)
          VALUES (new_id, left(v_bldg_name, 100), left(v_bldg_code, 40), v_bldg_sort)
          RETURNING id INTO v_bldg_id;
          v_bldg_sort := v_bldg_sort + 1;
        END IF;

        IF v_default_bldg_id IS NULL THEN
          v_default_bldg_id := v_bldg_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 2. Insert any building names referenced in unit_options or media
  FOR v_bldg_name IN
    SELECT DISTINCT bname FROM (
      SELECT NULLIF(btrim(COALESCE(u->>'building_name', '')), '') AS bname
        FROM jsonb_array_elements(v_unit_options) u
      UNION
      SELECT NULLIF(btrim(COALESCE(m->>'building_name', '')), '') AS bname
        FROM jsonb_array_elements(v_media) m
      UNION
      SELECT CASE WHEN jsonb_typeof(f) = 'object' THEN NULLIF(btrim(COALESCE(f->>'building_name', '')), '') ELSE NULL END AS bname
        FROM jsonb_array_elements(v_floors_json) f
    ) sub
    WHERE bname IS NOT NULL
  LOOP
    SELECT id INTO v_bldg_id
      FROM public.property_buildings
     WHERE property_id = new_id AND lower(name) = lower(v_bldg_name)
     LIMIT 1;

    IF v_bldg_id IS NULL THEN
      INSERT INTO public.property_buildings (property_id, name, sort_order)
      VALUES (new_id, left(v_bldg_name, 100), v_bldg_sort)
      RETURNING id INTO v_bldg_id;
      v_bldg_sort := v_bldg_sort + 1;
    END IF;

    IF v_default_bldg_id IS NULL THEN
      v_default_bldg_id := v_bldg_id;
    END IF;
  END LOOP;

  -- 3. Ensure a default building exists whenever floors are present (property_floors.building_id is NOT NULL)
  IF v_default_bldg_id IS NULL AND (v_has_any_hierarchy OR v_building_name IS NOT NULL) THEN
    v_default_bldg_name := COALESCE(v_building_name, 'Main Building');
    INSERT INTO public.property_buildings (property_id, name, sort_order)
    VALUES (new_id, left(v_default_bldg_name, 100), 0)
    RETURNING id INTO v_default_bldg_id;
  END IF;

  -- 4. Insert distinct floors across original_data.floors, unit_floor, unit_options, and media
  IF v_default_bldg_id IS NOT NULL THEN
    -- Explicit floors array
    IF jsonb_array_length(v_floors_json) > 0 THEN
      FOR v_floor_entry IN SELECT * FROM jsonb_array_elements(v_floors_json)
      LOOP
        v_floor_bldg_id := v_default_bldg_id;
        v_floor_code := NULL;
        IF jsonb_typeof(v_floor_entry) = 'string' THEN
          v_floor_label := NULLIF(btrim(v_floor_entry #>> '{}'), '');
        ELSIF jsonb_typeof(v_floor_entry) = 'object' THEN
          v_floor_label := NULLIF(btrim(COALESCE(v_floor_entry->>'floor_label', v_floor_entry->>'name', '')), '');
          v_floor_code := NULLIF(btrim(COALESCE(v_floor_entry->>'floor_code', v_floor_entry->>'code', '')), '');
          v_floor_bldg_name := NULLIF(btrim(COALESCE(v_floor_entry->>'building_name', '')), '');
          IF v_floor_bldg_name IS NOT NULL THEN
            SELECT id INTO v_bldg_id
              FROM public.property_buildings
             WHERE property_id = new_id AND lower(name) = lower(v_floor_bldg_name)
             LIMIT 1;
            IF v_bldg_id IS NOT NULL THEN v_floor_bldg_id := v_bldg_id; END IF;
          END IF;
        ELSE
          v_floor_label := NULL;
        END IF;

        IF v_floor_label IS NOT NULL THEN
          SELECT id INTO v_floor_id
            FROM public.property_floors
           WHERE property_id = new_id
             AND building_id = v_floor_bldg_id
             AND lower(floor_label) = lower(v_floor_label)
           LIMIT 1;

          IF v_floor_id IS NULL THEN
            IF v_floor_code IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.property_floors WHERE building_id = v_floor_bldg_id AND floor_code = v_floor_code
            ) THEN
              v_floor_code := NULL;
            END IF;
            v_floor_sort := public.infer_floor_sort_order(v_floor_label, 10);
            INSERT INTO public.property_floors (property_id, building_id, floor_label, floor_code, sort_order)
            VALUES (new_id, v_floor_bldg_id, left(v_floor_label, 100), left(v_floor_code, 40), v_floor_sort);
          END IF;
        END IF;
      END LOOP;
    END IF;

    -- Implicit floors from unit_floor, unit_options, and media
    FOR v_floor_bldg_name, v_floor_label IN
      SELECT DISTINCT bname, flabel FROM (
        SELECT v_building_name AS bname, v_unit_floor AS flabel
        UNION
        SELECT NULLIF(btrim(COALESCE(u->>'building_name', '')), ''),
               NULLIF(btrim(COALESCE(u->>'floor_label', '')), '')
          FROM jsonb_array_elements(v_unit_options) u
        UNION
        SELECT NULLIF(btrim(COALESCE(m->>'building_name', '')), ''),
               NULLIF(btrim(COALESCE(m->>'floor_label', '')), '')
          FROM jsonb_array_elements(v_media) m
      ) sub
      WHERE flabel IS NOT NULL
    LOOP
      v_floor_bldg_id := v_default_bldg_id;
      IF v_floor_bldg_name IS NOT NULL THEN
        SELECT id INTO v_bldg_id
          FROM public.property_buildings
         WHERE property_id = new_id AND lower(name) = lower(v_floor_bldg_name)
         LIMIT 1;
        IF v_bldg_id IS NOT NULL THEN
          v_floor_bldg_id := v_bldg_id;
        END IF;
      END IF;

      SELECT id INTO v_floor_id
        FROM public.property_floors
       WHERE property_id = new_id
         AND building_id = v_floor_bldg_id
         AND lower(floor_label) = lower(v_floor_label)
       LIMIT 1;

      IF v_floor_id IS NULL THEN
        v_floor_sort := public.infer_floor_sort_order(v_floor_label, 10);
        INSERT INTO public.property_floors (property_id, building_id, floor_label, sort_order)
        VALUES (new_id, v_floor_bldg_id, left(v_floor_label, 100), v_floor_sort);
      END IF;
    END LOOP;
  END IF;

  -- ── Populate Units & Floor-Plan Layouts (public.property_units) ────────────
  IF jsonb_array_length(v_unit_options) > 0 THEN
    FOR v_unit_entry IN SELECT * FROM jsonb_array_elements(v_unit_options)
    LOOP
      IF jsonb_typeof(v_unit_entry) <> 'object' THEN
        CONTINUE;
      END IF;

      v_unit_num := NULLIF(btrim(COALESCE(v_unit_entry->>'unit_number', '')), '');
      v_unit_fp_name := NULLIF(btrim(COALESCE(v_unit_entry->>'floor_plan_name', '')), '');
      v_unit_fp_img := NULLIF(btrim(COALESCE(v_unit_entry->>'floor_plan_image_url', '')), '');
      IF v_unit_fp_img IS NOT NULL AND v_unit_fp_img !~* '^https://' THEN
        v_unit_fp_img := NULL;
      END IF;

      v_unit_beds := NULL;
      IF COALESCE(v_unit_entry->>'bedrooms', '') ~ '^\d+(\.\d+)?$' THEN
        v_unit_beds := (v_unit_entry->>'bedrooms')::numeric;
      END IF;

      v_unit_baths := NULL;
      IF COALESCE(v_unit_entry->>'bathrooms', '') ~ '^\d+(\.\d+)?$' THEN
        v_unit_baths := (v_unit_entry->>'bathrooms')::numeric;
      END IF;

      v_unit_sqft := NULL;
      IF COALESCE(v_unit_entry->>'square_footage', '') ~ '^\d+(\.\d+)?$' THEN
        v_unit_sqft := ROUND((v_unit_entry->>'square_footage')::numeric)::int;
        IF v_unit_sqft <= 0 THEN v_unit_sqft := NULL; END IF;
      END IF;

      v_unit_rent := NULL;
      IF COALESCE(v_unit_entry->>'monthly_rent', '') ~ '^\d+(\.\d+)?$' THEN
        v_unit_rent := ROUND((v_unit_entry->>'monthly_rent')::numeric)::int;
      ELSIF COALESCE(v_unit_entry->>'starting_rent', '') ~ '^\d+(\.\d+)?$' THEN
        v_unit_rent := ROUND((v_unit_entry->>'starting_rent')::numeric)::int;
      END IF;
      IF v_unit_rent IS NULL OR v_unit_rent <= 0 THEN
        v_unit_rent := v_effective_rent;
      END IF;

      IF v_unit_num IS NULL AND v_unit_fp_name IS NULL THEN
        v_unit_fp_name := CASE
          WHEN v_unit_beds = 0 THEN 'Studio layout'
          WHEN v_unit_beds IS NOT NULL THEN trim(trailing '.' from trim(trailing '0' from v_unit_beds::text)) || ' bedroom layout'
          WHEN v_unit_sqft IS NOT NULL THEN v_unit_sqft::text || ' sqft layout'
          ELSE 'Available layout'
        END;
      END IF;

      v_unit_bldg_name := NULLIF(btrim(COALESCE(v_unit_entry->>'building_name', '')), '');
      v_unit_floor_lbl := NULLIF(btrim(COALESCE(v_unit_entry->>'floor_label', '')), '');
      v_unit_bldg_id := NULL;
      v_unit_floor_id := NULL;

      IF v_unit_bldg_name IS NOT NULL THEN
        SELECT id INTO v_unit_bldg_id
          FROM public.property_buildings
         WHERE property_id = new_id AND lower(name) = lower(v_unit_bldg_name)
         LIMIT 1;
      END IF;

      IF v_unit_floor_lbl IS NOT NULL THEN
        IF v_unit_bldg_id IS NOT NULL THEN
          SELECT id INTO v_unit_floor_id
            FROM public.property_floors
           WHERE property_id = new_id AND building_id = v_unit_bldg_id AND lower(floor_label) = lower(v_unit_floor_lbl)
           LIMIT 1;
        ELSE
          SELECT id, building_id INTO v_unit_floor_id, v_unit_bldg_id
            FROM public.property_floors
           WHERE property_id = new_id AND lower(floor_label) = lower(v_unit_floor_lbl)
           ORDER BY sort_order ASC
           LIMIT 1;
        END IF;
      ELSIF v_unit_bldg_id IS NULL AND v_default_bldg_id IS NOT NULL AND jsonb_array_length(v_buildings_json) = 1 THEN
        v_unit_bldg_id := v_default_bldg_id;
      END IF;

      -- Disambiguate or deduplicate unit_number per property
      v_unit_num_final := left(v_unit_num, 40);
      IF v_unit_num_final IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.property_units WHERE property_id = new_id AND unit_number = v_unit_num_final) THEN
          IF v_unit_bldg_name IS NOT NULL THEN
            v_unit_num_final := left(v_unit_bldg_name || ' - ' || v_unit_num, 40);
          END IF;
          IF EXISTS (SELECT 1 FROM public.property_units WHERE property_id = new_id AND unit_number = v_unit_num_final) THEN
            CONTINUE;
          END IF;
        END IF;
      END IF;

      v_unit_photos := '[]'::jsonb;
      IF jsonb_typeof(v_unit_entry->'unit_photos') = 'array' THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(u_url)), '[]'::jsonb)
          INTO v_unit_photos
          FROM jsonb_array_elements_text(v_unit_entry->'unit_photos') AS u_url
         WHERE u_url ~* '^https://';
      END IF;

      v_unit_amenities := ARRAY[]::text[];
      IF jsonb_typeof(v_unit_entry->'amenities') = 'array' THEN
        SELECT COALESCE(array_agg(btrim(am)), ARRAY[]::text[])
          INTO v_unit_amenities
          FROM jsonb_array_elements_text(v_unit_entry->'amenities') AS am
         WHERE btrim(am) <> ''
           AND am !~* '(smoke|smoking|tobacco|\d+[\s-]*month|lease\s*term)';
      END IF;

      v_unit_basis := NULLIF(btrim(COALESCE(v_unit_entry->>'rent_basis', '')), '');
      v_unit_notes := NULLIF(btrim(COALESCE(v_unit_entry->>'notes', '')), '');

      INSERT INTO public.property_units (
        property_id, unit_number, bedrooms, bathrooms, square_footage,
        monthly_rent, status, floor_plan_name, floor_plan_image_url,
        unit_photos, amenities, building_id, floor_id, rent_basis, notes
      ) VALUES (
        new_id,
        v_unit_num_final,
        v_unit_beds,
        v_unit_baths,
        v_unit_sqft,
        v_unit_rent,
        'available',
        left(v_unit_fp_name, 120),
        v_unit_fp_img,
        v_unit_photos,
        v_unit_amenities,
        v_unit_bldg_id,
        v_unit_floor_id,
        left(v_unit_basis, 40),
        left(v_unit_notes, 500)
      )
      RETURNING id INTO v_inserted_unit_id;

      v_unit_count := v_unit_count + 1;

      -- Ensure unit floor plan image is also represented in property_media if not already in v_media
      IF v_unit_fp_img IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_media) m
         WHERE lower(COALESCE(m->>'url', '')) = lower(v_unit_fp_img)
      ) THEN
        INSERT INTO public.property_media (
          property_id, kind, title, floor_label, url, display_order, is_hero, metadata, unit_id
        ) VALUES (
          new_id,
          'floor_plan',
          left(COALESCE(v_unit_fp_name, CASE WHEN v_unit_num_final IS NOT NULL THEN 'Unit ' || v_unit_num_final || ' Floor Plan' ELSE 'Floor plan' END), 120),
          left(v_unit_floor_lbl, 60),
          v_unit_fp_img,
          1000 + v_unit_count,
          false,
          '{}'::jsonb,
          v_inserted_unit_id
        );
      END IF;
    END LOOP;
  END IF;

  -- ── Populate Media (3D Tours, Virtual Tours, Videos, Floor Plans) ──────────
  IF p.virtual_tour_url IS NOT NULL AND btrim(p.virtual_tour_url) <> '' THEN
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_media) m
       WHERE lower(COALESCE(m->>'url', '')) = lower(btrim(p.virtual_tour_url))
    ) THEN
      v_media := jsonb_build_array(
        jsonb_build_object(
          'kind', 'virtual_tour',
          'title', '3D Virtual Tour',
          'url', btrim(p.virtual_tour_url),
          'display_order', 0
        )
      ) || v_media;
    END IF;
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
          WHEN v_media_kind IN ('tour_3d', 'virtual_tour') THEN '3D Virtual Tour'
          ELSE 'Media'
        END;
      END IF;

      v_media_floor := NULLIF(btrim(COALESCE(v_media_entry->>'floor_label', '')), '');
      v_media_bldg := NULLIF(btrim(COALESCE(v_media_entry->>'building_name', '')), '');
      v_media_unit_num := NULLIF(btrim(COALESCE(v_media_entry->>'unit_number', '')), '');
      v_media_provider := NULLIF(btrim(COALESCE(v_media_entry->>'provider', '')), '');
      v_media_poster := NULLIF(btrim(COALESCE(v_media_entry->>'poster_url', '')), '');
      v_media_file_id := NULLIF(btrim(COALESCE(v_media_entry->>'file_id', '')), '');
      v_media_display_ord := CASE
        WHEN COALESCE(v_media_entry->>'display_order', '') ~ '^-?\d+$' THEN (v_media_entry->>'display_order')::int
        ELSE v_media_index
      END;
      v_media_hero := COALESCE((v_media_entry->>'is_hero')::boolean, false);
      v_media_width := CASE
        WHEN v_media_entry ? 'width' AND jsonb_typeof(v_media_entry->'width') = 'number' THEN (v_media_entry->>'width')::int
        ELSE NULL
      END;
      v_media_height := CASE
        WHEN v_media_entry ? 'height' AND jsonb_typeof(v_media_entry->'height') = 'number' THEN (v_media_entry->>'height')::int
        ELSE NULL
      END;
      v_media_metadata := CASE
        WHEN jsonb_typeof(v_media_entry->'metadata') = 'object' THEN v_media_entry->'metadata'
        ELSE '{}'::jsonb
      END;

      -- Resolve single scope cleanly per property_media_single_scope_check:
      -- (unit_id IS NULL OR (building_id IS NULL AND floor_id IS NULL)) AND (floor_id IS NULL OR building_id IS NOT NULL)
      v_media_bldg_id := NULL;
      v_media_floor_id := NULL;
      v_media_unit_id := NULL;

      IF v_media_unit_num IS NOT NULL THEN
        SELECT id INTO v_media_unit_id
          FROM public.property_units
         WHERE property_id = new_id
           AND (lower(unit_number) = lower(v_media_unit_num)
                OR (v_media_bldg IS NOT NULL AND lower(unit_number) = lower(v_media_bldg || ' - ' || v_media_unit_num)))
         LIMIT 1;
      END IF;

      IF v_media_unit_id IS NULL THEN
        IF v_media_bldg IS NOT NULL THEN
          SELECT id INTO v_media_bldg_id
            FROM public.property_buildings
           WHERE property_id = new_id AND lower(name) = lower(v_media_bldg)
           LIMIT 1;
        END IF;

        IF v_media_floor IS NOT NULL THEN
          IF v_media_bldg_id IS NOT NULL THEN
            SELECT id INTO v_media_floor_id
              FROM public.property_floors
             WHERE property_id = new_id AND building_id = v_media_bldg_id AND lower(floor_label) = lower(v_media_floor)
             LIMIT 1;
          ELSE
            SELECT id, building_id INTO v_media_floor_id, v_media_bldg_id
              FROM public.property_floors
             WHERE property_id = new_id AND lower(floor_label) = lower(v_media_floor)
             ORDER BY sort_order ASC
             LIMIT 1;
          END IF;
        END IF;
      END IF;

      INSERT INTO public.property_media (
        property_id, kind, title, floor_label, provider, url, file_id, poster_url,
        display_order, is_hero, width, height, metadata,
        building_id, floor_id, unit_id
      ) VALUES (
        new_id,
        v_media_kind,
        left(v_media_title, 120),
        left(v_media_floor, 60),
        left(v_media_provider, 60),
        v_media_url,
        v_media_file_id,
        v_media_poster,
        v_media_display_ord,
        v_media_hero,
        v_media_width,
        v_media_height,
        v_media_metadata,
        v_media_bldg_id,
        v_media_floor_id,
        v_media_unit_id
      );

      v_media_index := v_media_index + 1;
    END LOOP;
  END IF;

  -- ── Populate Photos in Strict Original Order (Directive 2) ─────────────────
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

    IF v_url IS NOT NULL AND length(btrim(v_url)) > 5 THEN
      INSERT INTO public.property_photos (
        id, property_id, url, file_id, width, height, display_order, is_hero, watermark_status, created_at
      ) VALUES (
        gen_random_uuid(),
        new_id,
        btrim(v_url),
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
    PERFORM public.delete_properties_cascade(ARRAY[new_id]);
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
    'units', v_unit_count
  );
END;
$function$;
