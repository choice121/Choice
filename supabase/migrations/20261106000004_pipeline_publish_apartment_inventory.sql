CREATE OR REPLACE FUNCTION public.pipeline_publish(
  p_id          text,
  p_landlord_id uuid DEFAULT NULL,
  p_status      text DEFAULT 'private_placement'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline, pg_temp
AS $$
DECLARE
  v_result       json;
  v_source_row   jsonb;
  v_original     jsonb;
  v_unit_options jsonb;
  v_property_id  text;
  v_is_multi     boolean;
  v_building     text;
  v_price_range  text;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('private_placement', 'active') THEN
    RETURN json_build_object('ok', false, 'error', 'Invalid publish visibility');
  END IF;

  v_result := public.pipeline_publish_with_status(p_id, p_landlord_id, p_status);
  IF COALESCE((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_result;
  END IF;

  v_property_id := NULLIF(v_result ->> 'choice_property_id', '');
  IF v_property_id IS NULL THEN
    RAISE EXCEPTION 'Apartment metadata sync failed: publish result has no property id';
  END IF;

  SELECT to_jsonb(pp)
    INTO v_source_row
    FROM pipeline.pipeline_properties AS pp
   WHERE pp.id = p_id;
  IF v_source_row IS NULL THEN
    RAISE EXCEPTION 'Apartment metadata sync failed: pipeline record % was not found', p_id;
  END IF;

  v_original := v_source_row -> 'original_data';
  IF jsonb_typeof(v_original) = 'string' THEN
    BEGIN
      v_original := (v_original #>> '{}')::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Apartment metadata sync failed: original_data is not valid JSON';
    END;
  END IF;
  IF v_original IS NULL OR jsonb_typeof(v_original) <> 'object' THEN
    RAISE EXCEPTION 'Apartment metadata sync failed: original_data must be a JSON object';
  END IF;

  v_unit_options := COALESCE(v_original -> 'unit_options', '[]'::jsonb);
  IF jsonb_typeof(v_unit_options) <> 'array' OR jsonb_array_length(v_unit_options) > 100 THEN
    RAISE EXCEPTION 'Apartment metadata sync failed: unit_options must be an array of at most 100 records';
  END IF;

  v_building := NULLIF(left(trim(COALESCE(v_original ->> 'building_name', '')), 160), '');
  v_price_range := NULLIF(left(trim(COALESCE(v_original ->> 'price_range', '')), 120), '');
  IF jsonb_typeof(v_original -> 'is_multi_unit') = 'boolean' THEN
    v_is_multi := (v_original ->> 'is_multi_unit')::boolean;
  ELSIF lower(COALESCE(v_original ->> 'is_multi_unit', '')) IN ('true', 'false') THEN
    v_is_multi := (v_original ->> 'is_multi_unit')::boolean;
  ELSE
    v_is_multi := NULL;
  END IF;

  UPDATE public.properties
     SET unit_options = v_unit_options,
         building_name = COALESCE(v_building, building_name),
         price_range = COALESCE(v_price_range, price_range),
         is_multi_unit = CASE
           WHEN v_is_multi IS TRUE
             OR COALESCE(total_units, 0) > 1
             OR (jsonb_array_length(v_unit_options) > 0 AND NULLIF(trim(COALESCE(v_source_row ->> 'unit_number', '')), '') IS NULL)
             THEN TRUE
           WHEN v_is_multi IS FALSE THEN FALSE
           ELSE is_multi_unit
         END
   WHERE id = v_property_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apartment metadata sync failed: published property % was not found', v_property_id;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_publish(text, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_publish(text, uuid, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.pipeline_publish(text, uuid, text) IS
  'Publishes pipeline records as private placements by default and persists normalized apartment unit/plan metadata. Pass p_status=active only when public release is explicitly approved.';
