-- ============================================================
-- Choice Properties — Fix Cascading Property Delete Functions
-- 2026-09-04
-- Root Cause: Previous version attempted to compare text columns
-- (properties.id, saved_properties.property_id, pipeline.choice_property_id)
-- with uuid[] array (v_uuid_ids), causing:
-- "operator does not exist: text = uuid" (code: 42883)
--
-- This fix operates on text[] array directly and properly cleans
-- all related tables (photos, saves, inquiries, applications,
-- client collections, location notifications, pipeline properties).
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_properties_cascade(p_ids text[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline, pg_temp
AS $$
DECLARE
  v_deleted int := 0;
  v_clean_ids text[];
  v_uuid_ids uuid[];
  v_file_ids text[];
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', 0, 'deleted_ids', ARRAY[]::text[], 'file_ids', ARRAY[]::text[]);
  END IF;

  -- Deduplicate and trim input IDs
  SELECT array_agg(DISTINCT trim(elem))
    INTO v_clean_ids
    FROM unnest(p_ids) elem
   WHERE elem IS NOT NULL AND trim(elem) <> '';

  IF v_clean_ids IS NULL OR array_length(v_clean_ids, 1) = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', 0, 'deleted_ids', ARRAY[]::text[], 'file_ids', ARRAY[]::text[]);
  END IF;

  -- Extract valid UUIDs for tables that use UUID[] (e.g. client_collections)
  SELECT array_agg(DISTINCT elem::uuid)
    INTO v_uuid_ids
    FROM unnest(v_clean_ids) elem
   WHERE elem ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  -- Collect ImageKit file_ids for remote cleanup before deleting photos
  SELECT array_agg(DISTINCT file_id)
    INTO v_file_ids
    FROM public.property_photos
   WHERE property_id = ANY(v_clean_ids)
     AND file_id IS NOT NULL AND file_id <> '';

  -- 1. Delete associated property photos
  DELETE FROM public.property_photos
   WHERE property_id = ANY(v_clean_ids);

  -- 2. Delete saved properties links
  DELETE FROM public.saved_properties
   WHERE property_id = ANY(v_clean_ids);

  -- 3. Delete inquiries
  DELETE FROM public.inquiries
   WHERE property_id = ANY(v_clean_ids);

  -- 4. Unlink applications referencing these properties
  UPDATE public.applications
     SET property_id = NULL
   WHERE property_id = ANY(v_clean_ids);

  -- 5. Delete location notifications referencing these properties
  BEGIN
    DELETE FROM public.location_notifications
     WHERE property_id = ANY(v_clean_ids);
  EXCEPTION WHEN OTHERS THEN
    -- ignore if table doesn't exist
  END;

  -- 6. Unlink from client_collections (which uses UUID[])
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
      -- ignore if table doesn't exist
    END;
  END IF;

  -- 7. Nullify choice_property_id on pipeline properties if present
  BEGIN
    UPDATE pipeline.pipeline_properties
       SET choice_property_id = NULL
     WHERE choice_property_id = ANY(v_clean_ids);
  EXCEPTION WHEN OTHERS THEN
    -- ignore if schema or table differences exist
  END;

  -- 8. Delete the properties themselves
  DELETE FROM public.properties
   WHERE id = ANY(v_clean_ids);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN json_build_object(
    'ok', true,
    'deleted', v_deleted,
    'deleted_ids', v_clean_ids,
    'file_ids', COALESCE(v_file_ids, ARRAY[]::text[])
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_properties_cascade(text[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_properties_cascade(text[]) TO authenticated, service_role, anon;

-- Single property convenience wrapper
CREATE OR REPLACE FUNCTION public.delete_property_cascade(p_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline, pg_temp
AS $$
BEGIN
  IF p_id IS NULL OR trim(p_id) = '' THEN
    RETURN json_build_object('ok', true, 'deleted', 0, 'deleted_ids', ARRAY[]::text[], 'file_ids', ARRAY[]::text[]);
  END IF;
  RETURN public.delete_properties_cascade(ARRAY[trim(p_id)]);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_property_cascade(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_property_cascade(text) TO authenticated, service_role, anon;
