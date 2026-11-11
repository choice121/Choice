CREATE OR REPLACE FUNCTION public.normalize_pipeline_unit_options(p_options jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN jsonb_typeof(p_options) IS DISTINCT FROM 'array' THEN p_options
    WHEN jsonb_array_length(p_options) > 100 THEN p_options
    ELSE COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(item) = 'object'
              AND lower(trim(COALESCE(item ->> 'source_kind', ''))) IN ('available_unit', 'available-unit')
              THEN jsonb_set(item, '{source_kind}', '"unit"'::jsonb)
            ELSE item
          END
          ORDER BY ordinal
        )
        FROM jsonb_array_elements(p_options) WITH ORDINALITY AS options(item, ordinal)
      ),
      '[]'::jsonb
    )
  END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_pipeline_unit_options(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  v_definition text;
  v_assignment constant text := $needle$v_unit_options := COALESCE(v_original -> 'unit_options', '[]'::jsonb);$needle$;
  v_replacement text;
  v_occurrences integer;
  v_normalized jsonb;
BEGIN
  v_normalized := public.normalize_pipeline_unit_options(
    '[{"source_kind":"available_unit","unit_number":"A101","monthly_rent":1800,"photo_urls":["https://cdn.example.com/a101.jpg"]},{"source_kind":"floor_plan","floor_plan_name":"A1","starting_rent":1700}]'::jsonb
  );
  IF v_normalized -> 0 ->> 'source_kind' <> 'unit'
    OR v_normalized -> 0 ->> 'unit_number' <> 'A101'
    OR v_normalized -> 0 ->> 'monthly_rent' <> '1800'
    OR v_normalized -> 0 -> 'photo_urls' <> '["https://cdn.example.com/a101.jpg"]'::jsonb
    OR v_normalized -> 1 ->> 'source_kind' <> 'floor_plan'
    OR v_normalized -> 1 ->> 'starting_rent' <> '1700' THEN
    RAISE EXCEPTION 'Apartment unit-kind normalization self-check failed';
  END IF;

  SELECT pg_get_functiondef(
    'public.pipeline_publish(text,uuid,text,boolean)'::regprocedure
  ) INTO v_definition;

  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_assignment, ''))
  ) / length(v_assignment);
  IF v_occurrences <> 2 THEN
    RAISE EXCEPTION 'Expected two pipeline_publish unit_options assignments; found %', v_occurrences;
  END IF;

  v_replacement := v_assignment || E'\n  v_unit_options := public.normalize_pipeline_unit_options(v_unit_options);';
  EXECUTE replace(v_definition, v_assignment, v_replacement);
END;
$migration$;

COMMENT ON FUNCTION public.normalize_pipeline_unit_options(jsonb) IS
  'Canonicalizes legacy available_unit option kinds for apartment publication while preserving source facts and option order.';
