-- Choice Properties — Harden delete_properties_cascade RPC
-- Enforce admin privileges server-side inside the SECURITY DEFINER RPC,
-- handle property_reservations cleanup safely, and restrict EXECUTE from anon.

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
  -- Enforce admin or service_role authorization server-side
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;

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
     AND file_id IS NOT NULL AND trim(file_id) <> '';

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

  -- 5. Delete property_reservations if any (FK uses RESTRICT)
  BEGIN
    DELETE FROM public.property_reservations
     WHERE property_id = ANY(v_clean_ids);
  EXCEPTION WHEN OTHERS THEN
    -- ignore if table doesn't exist
  END;

  -- 6. Delete location notifications referencing these properties
  BEGIN
    DELETE FROM public.location_notifications
     WHERE property_id = ANY(v_clean_ids);
  EXCEPTION WHEN OTHERS THEN
    -- ignore if table doesn't exist
  END;

  -- 7. Unlink from client_collections (which uses UUID[])
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

  -- 8. Nullify choice_property_id on pipeline properties if present
  BEGIN
    UPDATE pipeline.pipeline_properties
       SET choice_property_id = NULL
     WHERE choice_property_id = ANY(v_clean_ids);
  EXCEPTION WHEN OTHERS THEN
    -- ignore if schema or table differences exist
  END;

  -- 9. Delete the properties themselves and capture exactly which IDs were deleted
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

REVOKE ALL ON FUNCTION public.delete_properties_cascade(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_properties_cascade(text[]) TO authenticated, service_role;
