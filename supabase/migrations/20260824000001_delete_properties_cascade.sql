-- ============================================================
-- Choice Properties — Cascading Property Delete Functions
-- Safely removes property photos, saved references, pipeline links,
-- and properties without foreign key constraint violations.
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_properties_cascade(p_ids text[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline, pg_temp
AS $$
DECLARE
  v_uuid_ids uuid[];
  v_deleted int := 0;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', 0);
  END IF;

  -- Convert text array to uuid array safely
  SELECT array_agg(u) INTO v_uuid_ids
  FROM (
    SELECT DISTINCT x::uuid AS u
    FROM unnest(p_ids) x
    WHERE x ~ '^[0-9a-fA-F-]{36}$'
  ) sub;

  IF v_uuid_ids IS NULL OR array_length(v_uuid_ids, 1) = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', 0);
  END IF;

  -- 1. Delete associated photos
  DELETE FROM public.property_photos
  WHERE property_id = ANY(p_ids);

  -- 2. Delete saved properties links
  DELETE FROM public.saved_properties
  WHERE property_id = ANY(v_uuid_ids);

  -- 3. Nullify choice_property_id on pipeline properties if present
  BEGIN
    UPDATE pipeline.pipeline_properties
    SET choice_property_id = NULL
    WHERE choice_property_id = ANY(v_uuid_ids);
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if schema or table differences exist
  END;

  -- 4. Delete the properties themselves
  DELETE FROM public.properties
  WHERE id = ANY(v_uuid_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN json_build_object('ok', true, 'deleted', v_deleted);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_properties_cascade(text[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_properties_cascade(text[]) TO authenticated, service_role, anon;

CREATE OR REPLACE FUNCTION public.delete_property_cascade(p_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline, pg_temp
AS $$
BEGIN
  RETURN public.delete_properties_cascade(ARRAY[p_id]);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_property_cascade(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_property_cascade(text) TO authenticated, service_role, anon;
