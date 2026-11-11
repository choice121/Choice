ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS community_starting_rent integer,
  ADD COLUMN IF NOT EXISTS community_max_rent integer,
  ADD COLUMN IF NOT EXISTS community_rent_basis text;

ALTER TABLE public.property_units
  ADD COLUMN IF NOT EXISTS source_unit_id text,
  ADD COLUMN IF NOT EXISTS source_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_floor_label text,
  ADD COLUMN IF NOT EXISTS building_name text,
  ADD COLUMN IF NOT EXISTS floor_plan_name text,
  ADD COLUMN IF NOT EXISTS rent_basis text,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.property_buildings
  ADD COLUMN IF NOT EXISTS source_building_id text;
ALTER TABLE public.property_floors
  ADD COLUMN IF NOT EXISTS source_floor_id text;

ALTER TABLE public.property_units
  DROP CONSTRAINT IF EXISTS property_units_review_status_check;
ALTER TABLE public.property_units
  ADD CONSTRAINT property_units_review_status_check
  CHECK (review_status IN ('pending', 'approved', 'rejected'));
CREATE UNIQUE INDEX IF NOT EXISTS property_units_source_id_unique
  ON public.property_units (property_id, source_unit_id);
CREATE UNIQUE INDEX IF NOT EXISTS property_buildings_source_id_unique
  ON public.property_buildings (property_id, source_building_id);
CREATE UNIQUE INDEX IF NOT EXISTS property_floors_source_id_unique
  ON public.property_floors (property_id, source_floor_id);

CREATE INDEX IF NOT EXISTS property_units_public_inventory_idx
  ON public.property_units (property_id, status, review_status, source_order);

CREATE TABLE IF NOT EXISTS public.property_floor_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  source_plan_id text,
  name text NOT NULL,
  bedrooms numeric,
  bathrooms numeric,
  square_footage integer,
  starting_rent integer,
  rent_basis text,
  image_url text,
  source_order integer NOT NULL DEFAULT 0,
  building_name text,
  status text NOT NULL DEFAULT 'active',
  review_status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_floor_plans_starting_rent_positive
    CHECK (starting_rent IS NULL OR starting_rent > 0),
  CONSTRAINT property_floor_plans_review_status_check
    CHECK (review_status IN ('pending', 'approved', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS property_floor_plans_source_id_unique
  ON public.property_floor_plans (property_id, source_plan_id);

CREATE INDEX IF NOT EXISTS property_floor_plans_public_inventory_idx
  ON public.property_floor_plans (property_id, status, review_status, source_order);

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS property_unit text,
  ADD COLUMN IF NOT EXISTS property_floor integer,
  ADD COLUMN IF NOT EXISTS property_floor_label text,
  ADD COLUMN IF NOT EXISTS property_unit_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'applications_property_unit_id_fkey'
       AND conrelid = 'public.applications'::regclass
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_property_unit_id_fkey
      FOREIGN KEY (property_unit_id)
      REFERENCES public.property_units(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS applications_property_unit_id_idx
  ON public.applications (property_unit_id)
  WHERE property_unit_id IS NOT NULL;

ALTER TABLE public.property_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_floor_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_units_read_active_properties ON public.property_units;
CREATE POLICY property_units_read_active_properties
  ON public.property_units AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND review_status = 'approved'
    AND EXISTS (
      SELECT 1
        FROM public.properties AS property
       WHERE property.id = property_units.property_id
         AND property.status = 'active'::property_status
    )
  );

DROP POLICY IF EXISTS property_units_manage_property_owner ON public.property_units;
CREATE POLICY property_units_manage_property_owner
  ON public.property_units AS PERMISSIVE FOR ALL TO authenticated
  USING (public.can_manage_property_listing(property_id))
  WITH CHECK (public.can_manage_property_listing(property_id));

DROP POLICY IF EXISTS property_buildings_read_active_properties ON public.property_buildings;
CREATE POLICY property_buildings_read_active_properties
  ON public.property_buildings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.properties AS property
       WHERE property.id = property_buildings.property_id
         AND property.status = 'active'::property_status
    )
  );

DROP POLICY IF EXISTS property_buildings_manage_property_owner ON public.property_buildings;
CREATE POLICY property_buildings_manage_property_owner
  ON public.property_buildings AS PERMISSIVE FOR ALL TO authenticated
  USING (public.can_manage_property_listing(property_id))
  WITH CHECK (public.can_manage_property_listing(property_id));

DROP POLICY IF EXISTS property_floors_read_active_properties ON public.property_floors;
CREATE POLICY property_floors_read_active_properties
  ON public.property_floors AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.properties AS property
       WHERE property.id = property_floors.property_id
         AND property.status = 'active'::property_status
    )
  );

DROP POLICY IF EXISTS property_floors_manage_property_owner ON public.property_floors;
CREATE POLICY property_floors_manage_property_owner
  ON public.property_floors AS PERMISSIVE FOR ALL TO authenticated
  USING (public.can_manage_property_listing(property_id))
  WITH CHECK (public.can_manage_property_listing(property_id));

DROP POLICY IF EXISTS property_floor_plans_read_active_properties ON public.property_floor_plans;
CREATE POLICY property_floor_plans_read_active_properties
  ON public.property_floor_plans AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND review_status = 'approved'
    AND EXISTS (
      SELECT 1
        FROM public.properties AS property
       WHERE property.id = property_floor_plans.property_id
         AND property.status = 'active'::property_status
    )
  );

DROP POLICY IF EXISTS property_floor_plans_manage_property_owner ON public.property_floor_plans;
CREATE POLICY property_floor_plans_manage_property_owner
  ON public.property_floor_plans AS PERMISSIVE FOR ALL TO authenticated
  USING (public.can_manage_property_listing(property_id))
  WITH CHECK (public.can_manage_property_listing(property_id));

GRANT SELECT ON public.property_units, public.property_buildings, public.property_floors,
  public.property_floor_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.property_units, public.property_buildings,
  public.property_floors, public.property_floor_plans TO authenticated;
GRANT ALL ON public.property_units, public.property_buildings, public.property_floors,
  public.property_floor_plans TO service_role;

COMMENT ON COLUMN public.properties.community_starting_rent IS
  'Verified community-level starting rent; display as From, never as the rent of every unit.';
COMMENT ON COLUMN public.properties.community_max_rent IS
  'Verified maximum rent for the community inventory; display only as a community range bound.';
COMMENT ON COLUMN public.property_units.unit_floor_label IS
  'Explicit source/reviewed floor label. Never infer it from the unit number.';
COMMENT ON COLUMN public.property_units.building_name IS
  'Explicit source/reviewed building label; never infer it from the unit number.';
COMMENT ON COLUMN public.property_units.review_status IS
  'Only approved unit records may be returned by public active-parent policies.';
COMMENT ON COLUMN public.property_buildings.source_building_id IS
  'Stable source identifier for idempotent publisher synchronization.';
COMMENT ON COLUMN public.property_floors.source_floor_id IS
  'Stable source identifier for idempotent publisher synchronization.';

ALTER FUNCTION public.pipeline_publish(text, uuid, text)
  RENAME TO pipeline_publish_with_apartment_metadata;
REVOKE ALL ON FUNCTION public.pipeline_publish_with_apartment_metadata(text, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.pipeline_publish(
  p_id text,
  p_landlord_id uuid DEFAULT NULL,
  p_status text DEFAULT 'private_placement',
  p_inventory_reviewed boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline, pg_temp
AS $$
DECLARE
  v_source_row jsonb;
  v_original jsonb;
  v_unit_options jsonb;
  v_approved_options jsonb := '[]'::jsonb;
  v_property_id text;
  v_is_community boolean := false;
  v_starting_rent numeric;
  v_max_unit_rent numeric;
  v_result json;
  v_option jsonb;
  v_source_order integer;
  v_source_id text;
  v_unit_number text;
  v_floor_label text;
  v_plan_name text;
  v_building_name text;
  v_building_code text;
  v_building_source_id text;
  v_floor_source_id text;
  v_building_uuid uuid;
  v_floor_uuid uuid;
  v_rent numeric;
  v_plan_rent numeric;
  v_bedrooms numeric;
  v_bathrooms numeric;
  v_square_footage integer;
  v_rent_basis text;
  v_image_url text;
  v_unit_photos jsonb;
  v_original_rent pipeline.pipeline_properties.monthly_rent%TYPE;
  v_original_bedrooms pipeline.pipeline_properties.bedrooms%TYPE;
  v_original_bathrooms pipeline.pipeline_properties.bathrooms%TYPE;
BEGIN
  SELECT to_jsonb(pp)
    INTO v_source_row
    FROM pipeline.pipeline_properties AS pp
   WHERE pp.id = p_id;
  IF v_source_row IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Listing not found in pipeline');
  END IF;

  v_original := v_source_row -> 'original_data';
  IF jsonb_typeof(v_original) = 'string' THEN
    BEGIN
      v_original := (v_original #>> '{}')::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RETURN json_build_object('ok', false, 'error', 'Original listing data is not valid JSON');
    END;
  END IF;
  IF v_original IS NULL OR jsonb_typeof(v_original) <> 'object' THEN
    v_original := '{}'::jsonb;
  END IF;
  v_unit_options := COALESCE(v_original -> 'unit_options', '[]'::jsonb);
  IF jsonb_typeof(v_unit_options) <> 'array' OR jsonb_array_length(v_unit_options) > 100 THEN
    RETURN json_build_object('ok', false, 'error', 'Unit inventory must be an array of at most 100 records');
  END IF;

  v_is_community :=
    NULLIF(trim(COALESCE(v_source_row ->> 'unit_number', '')), '') IS NULL
    AND (
      lower(trim(COALESCE(v_original ->> 'is_multi_unit', ''))) IN ('true', '1', 'yes')
      OR (
        lower(COALESCE(
          NULLIF(trim(v_source_row ->> 'property_type'), ''),
          NULLIF(trim(v_original ->> 'property_type'), ''),
          NULLIF(trim(v_original ->> 'homeType'), ''),
          ''
        )) LIKE 'apartment%'
        AND jsonb_array_length(v_unit_options) > 0
      )
      OR (
        COALESCE(
          NULLIF(trim(v_original ->> 'total_units'), ''),
          NULLIF(trim(v_source_row ->> 'total_units'), ''),
          '0'
        ) ~ '^[0-9]+$'
           AND length(COALESCE(
             NULLIF(trim(v_original ->> 'total_units'), ''),
             NULLIF(trim(v_source_row ->> 'total_units'), ''),
             '0'
           )) <= 6
           AND COALESCE(
             NULLIF(trim(v_original ->> 'total_units'), ''),
             NULLIF(trim(v_source_row ->> 'total_units'), ''),
             '0'
           )::numeric > 1
      )
    );

  IF v_is_community THEN
    SELECT min(price)
      INTO v_starting_rent
      FROM (
        SELECT CASE
          WHEN option ->> 'source_kind' = 'unit'
           AND option ->> 'monthly_rent' ~ '^[1-9][0-9]{0,5}$'
            THEN (option ->> 'monthly_rent')::numeric
          WHEN option ->> 'source_kind' = 'floor_plan'
           AND option ->> 'starting_rent' ~ '^[1-9][0-9]{0,5}$'
            THEN (option ->> 'starting_rent')::numeric
          ELSE NULL
        END AS price
          FROM jsonb_array_elements(v_unit_options) AS option
      ) AS prices
     WHERE price > 0 AND price <= 100000;

    IF v_starting_rent IS NULL THEN
      RETURN json_build_object('ok', false, 'error', 'Community publication requires a verified unit rent or floor-plan starting rent');
    END IF;
    IF p_inventory_reviewed IS NOT TRUE THEN
      RETURN json_build_object('ok', false, 'error', 'Review and confirm the community inventory before publishing');
    END IF;

    SELECT monthly_rent
      INTO v_original_rent
      FROM pipeline.pipeline_properties
     WHERE id = p_id;
    SELECT bedrooms, bathrooms
      INTO v_original_bedrooms, v_original_bathrooms
      FROM pipeline.pipeline_properties
     WHERE id = p_id;

    UPDATE pipeline.pipeline_properties
       SET monthly_rent = v_starting_rent,
           bedrooms = COALESCE(bedrooms, 0),
           bathrooms = COALESCE(bathrooms, 0)
     WHERE id = p_id;
  END IF;

  v_result := public.pipeline_publish_with_apartment_metadata(p_id, p_landlord_id, p_status);

  IF v_is_community THEN
    UPDATE pipeline.pipeline_properties
       SET monthly_rent = v_original_rent,
           bedrooms = v_original_bedrooms,
           bathrooms = v_original_bathrooms
     WHERE id = p_id;
  END IF;

  IF COALESCE((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_result;
  END IF;

  v_property_id := NULLIF(v_result ->> 'choice_property_id', '');
  IF v_property_id IS NULL THEN
    RAISE EXCEPTION 'Apartment inventory sync failed: publish result has no property id';
  END IF;

  SELECT to_jsonb(pp)
    INTO v_source_row
    FROM pipeline.pipeline_properties AS pp
   WHERE pp.id = p_id;
  v_original := v_source_row -> 'original_data';
  IF jsonb_typeof(v_original) = 'string' THEN
    v_original := (v_original #>> '{}')::jsonb;
  END IF;
  v_unit_options := COALESCE(v_original -> 'unit_options', '[]'::jsonb);

  UPDATE public.property_units
     SET status = 'inactive',
         review_status = 'pending',
         building_id = NULL,
         floor_id = NULL
   WHERE property_id = v_property_id
     AND source_unit_id LIKE 'pipeline:%';
  DELETE FROM public.property_floors
   WHERE property_id = v_property_id
     AND source_floor_id LIKE 'pipeline:%';
  DELETE FROM public.property_buildings
   WHERE property_id = v_property_id
     AND source_building_id LIKE 'pipeline:%';
  UPDATE public.property_floor_plans
     SET status = 'inactive',
         review_status = 'pending',
         updated_at = now()
   WHERE property_id = v_property_id
     AND source_plan_id LIKE 'pipeline:%';

  SELECT min(price)
    INTO v_starting_rent
    FROM (
      SELECT CASE
        WHEN option ->> 'source_kind' = 'unit'
         AND option ->> 'monthly_rent' ~ '^[1-9][0-9]{0,5}$'
          THEN (option ->> 'monthly_rent')::numeric
        WHEN option ->> 'source_kind' = 'floor_plan'
         AND option ->> 'starting_rent' ~ '^[1-9][0-9]{0,5}$'
          THEN (option ->> 'starting_rent')::numeric
        ELSE NULL
      END AS price
        FROM jsonb_array_elements(v_unit_options) AS option
    ) AS prices
   WHERE price > 0 AND price <= 100000;

  SELECT max((option ->> 'monthly_rent')::numeric)
    INTO v_max_unit_rent
    FROM jsonb_array_elements(v_unit_options) AS option
   WHERE option ->> 'source_kind' = 'unit'
     AND option ->> 'monthly_rent' ~ '^[1-9][0-9]{0,5}$'
     AND (option ->> 'monthly_rent')::numeric > 0
     AND (option ->> 'monthly_rent')::numeric <= 100000;

  UPDATE public.properties
     SET is_multi_unit = CASE
           WHEN NULLIF(trim(COALESCE(v_source_row ->> 'unit_number', '')), '') IS NOT NULL THEN false
           WHEN v_is_community THEN true
           ELSE is_multi_unit
         END,
         monthly_rent = CASE WHEN v_is_community THEN v_starting_rent::integer ELSE monthly_rent END,
         security_deposit = CASE WHEN v_is_community THEN v_starting_rent::integer ELSE security_deposit END,
         bedrooms = CASE WHEN v_is_community THEN NULL ELSE bedrooms END,
         bathrooms = CASE WHEN v_is_community THEN NULL ELSE bathrooms END,
         half_bathrooms = CASE WHEN v_is_community THEN NULL ELSE half_bathrooms END,
         total_bathrooms = CASE WHEN v_is_community THEN NULL ELSE total_bathrooms END,
         square_footage = CASE WHEN v_is_community THEN NULL ELSE square_footage END,
         community_starting_rent = CASE WHEN v_is_community THEN v_starting_rent::integer ELSE community_starting_rent END,
         community_max_rent = CASE WHEN v_is_community AND v_max_unit_rent IS NOT NULL THEN v_max_unit_rent::integer ELSE community_max_rent END,
         community_rent_basis = CASE
           WHEN lower(COALESCE(v_original ->> 'rent_basis', '')) LIKE '%total%monthly%' THEN 'total_monthly_price'
           WHEN lower(COALESCE(v_original ->> 'rent_basis', '')) LIKE '%base%rent%' THEN 'base_rent'
           ELSE community_rent_basis
         END
   WHERE id = v_property_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apartment inventory sync failed: published property % was not found', v_property_id;
  END IF;

  FOR v_option, v_source_order IN
    SELECT option, ordinal::integer - 1
      FROM jsonb_array_elements(v_unit_options) WITH ORDINALITY AS options(option, ordinal)
  LOOP
    v_unit_number := NULLIF(left(trim(COALESCE(v_option ->> 'unit_number', '')), 80), '');
    v_plan_name := NULLIF(left(trim(COALESCE(v_option ->> 'floor_plan_name', '')), 120), '');
    v_floor_label := NULLIF(left(trim(COALESCE(v_option ->> 'unit_floor', '')), 60), '');
    v_building_name := NULLIF(left(trim(COALESCE(v_option ->> 'building_name', '')), 120), '');
    v_building_code := NULLIF(left(trim(COALESCE(v_option ->> 'building_code', '')), 80), '');
    v_building_source_id := NULL;
    v_floor_source_id := NULL;
    v_building_uuid := NULL;
    v_floor_uuid := NULL;
    v_rent_basis := NULLIF(left(trim(COALESCE(v_option ->> 'rent_basis', '')), 80), '');
    v_source_id := 'pipeline:' || COALESCE(
      NULLIF(left(trim(COALESCE(v_option ->> 'source_id', '')), 120), ''),
      md5(COALESCE(v_option ->> 'building_name', '') || ':' || COALESCE(v_unit_number, v_plan_name, '') || ':' || v_source_order::text)
    );
    v_rent := CASE WHEN v_option ->> 'monthly_rent' ~ '^[1-9][0-9]{0,5}$'
      THEN (v_option ->> 'monthly_rent')::numeric ELSE NULL END;
    v_plan_rent := CASE WHEN v_option ->> 'starting_rent' ~ '^[1-9][0-9]{0,5}$'
      THEN (v_option ->> 'starting_rent')::numeric ELSE NULL END;
    v_bedrooms := CASE WHEN v_option ->> 'bedrooms' ~ '^[0-9]+(\.[0-9]+)?$'
      THEN (v_option ->> 'bedrooms')::numeric ELSE NULL END;
    v_bathrooms := CASE WHEN v_option ->> 'bathrooms' ~ '^[0-9]+(\.[0-9]+)?$'
      THEN (v_option ->> 'bathrooms')::numeric ELSE NULL END;
    v_square_footage := CASE WHEN v_option ->> 'square_footage' ~ '^[1-9][0-9]{0,6}$'
      THEN (v_option ->> 'square_footage')::integer ELSE NULL END;
    v_image_url := CASE
      WHEN COALESCE(v_option ->> 'image_url', '') ~ '^https://[^[:space:]]+$'
       AND position('@' IN COALESCE(v_option ->> 'image_url', '')) = 0
        THEN left(v_option ->> 'image_url', 2048)
      ELSE NULL
    END;
    v_unit_photos := '[]'::jsonb;
    IF v_option ->> 'source_kind' = 'unit'
       AND jsonb_typeof(v_option -> 'photo_urls') = 'array' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('url', photo_url) ORDER BY ordinal), '[]'::jsonb)
        INTO v_unit_photos
        FROM (
          SELECT item #>> '{}' AS photo_url, ordinal
            FROM jsonb_array_elements(v_option -> 'photo_urls') WITH ORDINALITY AS photos(item, ordinal)
           WHERE item #>> '{}' ~ '^https://[^[:space:]]+$'
             AND length(item #>> '{}') <= 2048
             AND position('@' IN split_part(item #>> '{}', '/', 3)) = 0
           ORDER BY ordinal
           LIMIT 40
        ) AS safe_photos;
    END IF;

    IF v_option ->> 'source_kind' = 'unit'
       AND v_unit_number IS NOT NULL
       AND v_unit_number ~ '^(?:[0-9]{1,6}[a-z]?|[a-z]{1,3}[0-9]{1,5}|[a-z]|[a-z]{1,4}-[0-9]{1,5}|[0-9]{1,4}[a-z]?-[0-9]{1,4})$'
       AND v_rent > 0
       AND v_rent <= 100000 THEN
      IF v_building_name IS NOT NULL THEN
        v_building_source_id := 'pipeline:' || COALESCE(
          NULLIF(left(trim(COALESCE(v_option ->> 'building_source_id', v_option ->> 'building_id', '')), 120), ''),
          NULLIF(v_building_code, ''),
          md5(lower(v_building_name))
        );
        INSERT INTO public.property_buildings (
          property_id, name, building_code, sort_order, amenities, metadata, source_building_id
        ) VALUES (
          v_property_id, v_building_name, v_building_code, v_source_order, ARRAY[]::text[],
          jsonb_build_object('source', 'pipeline_publish'), v_building_source_id
        )
        ON CONFLICT (property_id, source_building_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          building_code = COALESCE(EXCLUDED.building_code, property_buildings.building_code),
          sort_order = LEAST(property_buildings.sort_order, EXCLUDED.sort_order),
          updated_at = now()
        RETURNING id INTO v_building_uuid;

        IF v_floor_label IS NOT NULL THEN
          v_floor_source_id := 'pipeline:' || md5(
            v_building_source_id || ':' || COALESCE(
              NULLIF(left(trim(COALESCE(v_option ->> 'floor_source_id', v_option ->> 'floor_id', '')), 120), ''),
              lower(v_floor_label)
            )
          );
          INSERT INTO public.property_floors (
            property_id, building_id, floor_label, floor_code, sort_order, metadata, source_floor_id
          ) VALUES (
            v_property_id, v_building_uuid, v_floor_label, v_floor_label, v_source_order,
            jsonb_build_object('source', 'pipeline_publish'), v_floor_source_id
          )
          ON CONFLICT (property_id, source_floor_id)
          DO UPDATE SET
            building_id = EXCLUDED.building_id,
            floor_label = EXCLUDED.floor_label,
            floor_code = EXCLUDED.floor_code,
            sort_order = LEAST(property_floors.sort_order, EXCLUDED.sort_order),
            updated_at = now()
          RETURNING id INTO v_floor_uuid;
        END IF;
      END IF;

      INSERT INTO public.property_units (
        property_id, unit_number, bedrooms, bathrooms, square_footage, monthly_rent,
        status, source_unit_id, source_order, unit_floor_label, building_name, floor_plan_name,
        unit_photos, rent_basis, review_status, building_id, floor_id
      ) VALUES (
        v_property_id, v_unit_number, v_bedrooms, v_bathrooms, v_square_footage, v_rent::integer,
        'active', v_source_id, v_source_order, v_floor_label, v_building_name, v_plan_name,
        v_unit_photos, v_rent_basis,
        CASE WHEN p_inventory_reviewed THEN 'approved' ELSE 'pending' END,
        v_building_uuid, v_floor_uuid
      )
      ON CONFLICT (property_id, source_unit_id)
      DO UPDATE SET
        unit_number = EXCLUDED.unit_number,
        bedrooms = EXCLUDED.bedrooms,
        bathrooms = EXCLUDED.bathrooms,
        square_footage = EXCLUDED.square_footage,
        monthly_rent = EXCLUDED.monthly_rent,
        status = EXCLUDED.status,
        source_order = EXCLUDED.source_order,
        unit_floor_label = EXCLUDED.unit_floor_label,
        building_name = EXCLUDED.building_name,
        floor_plan_name = EXCLUDED.floor_plan_name,
        unit_photos = EXCLUDED.unit_photos,
        rent_basis = EXCLUDED.rent_basis,
        review_status = EXCLUDED.review_status,
        building_id = EXCLUDED.building_id,
        floor_id = EXCLUDED.floor_id;
      IF p_inventory_reviewed THEN
        v_approved_options := v_approved_options || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'source_kind', 'unit',
          'source_order', v_source_order,
          'source_id', COALESCE(v_option ->> 'source_id', v_source_id),
          'unit_number', v_unit_number,
          'unit_floor', v_floor_label,
          'building_name', v_building_name,
          'floor_plan_name', v_plan_name,
          'bedrooms', v_bedrooms,
          'bathrooms', v_bathrooms,
          'square_footage', v_square_footage,
          'monthly_rent', v_rent::integer,
          'photo_urls', v_option -> 'photo_urls',
          'rent_basis', v_rent_basis
        )));
      END IF;
    ELSIF v_option ->> 'source_kind' = 'floor_plan'
       AND v_plan_name IS NOT NULL
       AND v_plan_rent > 0
       AND v_plan_rent <= 100000 THEN
      INSERT INTO public.property_floor_plans (
        property_id, source_plan_id, name, bedrooms, bathrooms, square_footage, starting_rent,
        rent_basis, image_url, source_order, building_name, status, review_status
      ) VALUES (
        v_property_id, v_source_id, v_plan_name, v_bedrooms, v_bathrooms, v_square_footage,
        v_plan_rent::integer, v_rent_basis, v_image_url, v_source_order, v_building_name, 'active',
        CASE WHEN p_inventory_reviewed THEN 'approved' ELSE 'pending' END
      )
      ON CONFLICT (property_id, source_plan_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        bedrooms = EXCLUDED.bedrooms,
        bathrooms = EXCLUDED.bathrooms,
        square_footage = EXCLUDED.square_footage,
        starting_rent = EXCLUDED.starting_rent,
        rent_basis = EXCLUDED.rent_basis,
        image_url = EXCLUDED.image_url,
        source_order = EXCLUDED.source_order,
        building_name = EXCLUDED.building_name,
        status = EXCLUDED.status,
        review_status = EXCLUDED.review_status,
        updated_at = now();
      IF p_inventory_reviewed THEN
        v_approved_options := v_approved_options || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'source_kind', 'floor_plan',
          'source_order', v_source_order,
          'source_id', COALESCE(v_option ->> 'source_id', v_source_id),
          'floor_plan_name', v_plan_name,
          'building_name', v_building_name,
          'bedrooms', v_bedrooms,
          'bathrooms', v_bathrooms,
          'square_footage', v_square_footage,
          'starting_rent', v_plan_rent::integer,
          'rent_basis', v_rent_basis,
          'image_url', v_image_url
        )));
      END IF;
    END IF;
  END LOOP;

  UPDATE public.properties
     SET unit_options = v_approved_options
   WHERE id = v_property_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_publish(text, uuid, text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_publish(text, uuid, text, boolean)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.pipeline_publish(text, uuid, text, boolean) IS
  'Publishes pipeline records privately by default, keeps community specs unasserted, and syncs verified apartment units/floor plans. Inventory approval is explicit; public release still requires p_status=active.';
