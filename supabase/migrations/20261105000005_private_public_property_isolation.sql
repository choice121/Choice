-- Keep pipeline listings private unless publication explicitly requests public visibility.
ALTER FUNCTION public.pipeline_publish(text, uuid, text)
  RENAME TO pipeline_publish_with_status;

REVOKE ALL ON FUNCTION public.pipeline_publish_with_status(text, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.pipeline_publish(
  p_id          text,
  p_landlord_id uuid DEFAULT NULL,
  p_status      text DEFAULT 'private_placement'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline, pg_temp
AS $$
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('private_placement', 'active') THEN
    RETURN json_build_object('ok', false, 'error', 'Invalid publish visibility');
  END IF;

  RETURN public.pipeline_publish_with_status(p_id, p_landlord_id, p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_publish(text, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_publish(text, uuid, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.pipeline_publish(text, uuid, text) IS
  'Publishes pipeline records as private placements by default. Pass p_status=active only when public release is explicitly approved.';

CREATE OR REPLACE FUNCTION public.pipeline_publish_and_delete(
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
  v_result json;
BEGIN
  v_result := public.pipeline_publish(p_id, p_landlord_id, p_status);
  IF (v_result->>'ok')::boolean = true THEN
    DELETE FROM pipeline.pipeline_properties WHERE id = p_id;
  END IF;
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.pipeline_publish_and_delete(text, uuid, text) IS
  'Publishes pipeline records as private placements by default, then removes the source pipeline row after success.';

CREATE OR REPLACE FUNCTION public.can_manage_property_owner(p_landlord_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM public.admin_roles ar
      WHERE ar.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.landlords l
      WHERE l.id = p_landlord_id
        AND l.user_id = auth.uid()
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_property_listing(p_property_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = p_property_id
      AND public.can_manage_property_owner(p.landlord_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_property_listing(p_property_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = p_property_id
      AND (
        p.status::text = 'active'
        OR public.can_manage_property_owner(p.landlord_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_property_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_property_listing(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_property_listing(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_property_owner(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_property_listing(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_property_listing(text) TO anon, authenticated;

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS properties_public_select_base ON public.properties;
CREATE POLICY properties_public_select_base
  ON public.properties AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS properties_visibility_guard ON public.properties;
CREATE POLICY properties_visibility_guard
  ON public.properties AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (public.can_view_property_listing(id));

DROP POLICY IF EXISTS properties_authenticated_insert_owner ON public.properties;
CREATE POLICY properties_authenticated_insert_owner
  ON public.properties AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_property_owner(landlord_id));

DROP POLICY IF EXISTS properties_authenticated_update_owner ON public.properties;
CREATE POLICY properties_authenticated_update_owner
  ON public.properties AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.can_manage_property_listing(id))
  WITH CHECK (public.can_manage_property_owner(landlord_id));

DROP POLICY IF EXISTS properties_authenticated_delete_owner ON public.properties;
CREATE POLICY properties_authenticated_delete_owner
  ON public.properties AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.can_manage_property_listing(id));

DROP POLICY IF EXISTS property_photos_public_select_base ON public.property_photos;
CREATE POLICY property_photos_public_select_base
  ON public.property_photos AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS property_photos_visibility_guard ON public.property_photos;
CREATE POLICY property_photos_visibility_guard
  ON public.property_photos AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (public.can_view_property_listing(property_id));

DROP POLICY IF EXISTS property_photos_authenticated_insert_owner ON public.property_photos;
CREATE POLICY property_photos_authenticated_insert_owner
  ON public.property_photos AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_property_listing(property_id));

DROP POLICY IF EXISTS property_photos_authenticated_update_owner ON public.property_photos;
CREATE POLICY property_photos_authenticated_update_owner
  ON public.property_photos AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.can_manage_property_listing(property_id))
  WITH CHECK (public.can_manage_property_listing(property_id));

DROP POLICY IF EXISTS property_photos_authenticated_delete_owner ON public.property_photos;
CREATE POLICY property_photos_authenticated_delete_owner
  ON public.property_photos AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.can_manage_property_listing(property_id));

DROP POLICY IF EXISTS property_media_public_select_base ON public.property_media;
CREATE POLICY property_media_public_select_base
  ON public.property_media AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS property_media_visibility_guard ON public.property_media;
CREATE POLICY property_media_visibility_guard
  ON public.property_media AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (public.can_view_property_listing(property_id));

DROP POLICY IF EXISTS property_media_authenticated_insert_owner ON public.property_media;
CREATE POLICY property_media_authenticated_insert_owner
  ON public.property_media AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_property_listing(property_id));

DROP POLICY IF EXISTS property_media_authenticated_update_owner ON public.property_media;
CREATE POLICY property_media_authenticated_update_owner
  ON public.property_media AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.can_manage_property_listing(property_id))
  WITH CHECK (public.can_manage_property_listing(property_id));

DROP POLICY IF EXISTS property_media_authenticated_delete_owner ON public.property_media;
CREATE POLICY property_media_authenticated_delete_owner
  ON public.property_media AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.can_manage_property_listing(property_id));

-- This RPC is no longer needed by public clients and may bypass table RLS if
-- its deployed implementation is SECURITY DEFINER.
DO $$
DECLARE
  target_function record;
BEGIN
  FOR target_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_properties_by_ids'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      target_function.signature
    );
  END LOOP;
END;
$$;
