-- ============================================================
-- Choice Properties — Watermark Sniper Full Pagination & Dynamic Filters
-- Date: 2026-09-04
-- ============================================================

-- 1. Performance indexes for scaling to 50,000+ properties
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON public.properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_city ON public.properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_state ON public.properties(state);
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON public.properties(property_type);

-- 2. Dynamic filter options (states, cities by state, property types, total & zero-photo counts)
CREATE OR REPLACE FUNCTION public.get_watermark_sniper_filter_options()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res json;
BEGIN
  SELECT json_build_object(
    'states', (
      SELECT coalesce(json_agg(s ORDER BY s), '[]'::json)
      FROM (SELECT DISTINCT state as s FROM public.properties WHERE state IS NOT NULL AND trim(state) <> '') q
    ),
    'cities_by_state', (
      SELECT coalesce(json_object_agg(state, cities), '{}'::json)
      FROM (
        SELECT state, json_agg(DISTINCT city ORDER BY city) as cities
        FROM public.properties
        WHERE state IS NOT NULL AND trim(state) <> '' AND city IS NOT NULL AND trim(city) <> ''
        GROUP BY state
      ) cs
    ),
    'all_cities', (
      SELECT coalesce(json_agg(c ORDER BY c), '[]'::json)
      FROM (SELECT DISTINCT city as c FROM public.properties WHERE city IS NOT NULL AND trim(city) <> '') q
    ),
    'property_types', (
      SELECT coalesce(json_agg(pt ORDER BY pt), '[]'::json)
      FROM (SELECT DISTINCT property_type as pt FROM public.properties WHERE property_type IS NOT NULL AND trim(property_type) <> '') q
    ),
    'total_properties', (SELECT count(*) FROM public.properties),
    'zero_photos_count', (
      SELECT count(*) 
      FROM public.properties p 
      WHERE NOT EXISTS (SELECT 1 FROM public.property_photos ph WHERE ph.property_id = p.id)
    ),
    'under_6_photos_count', (
      SELECT count(*) 
      FROM (
        SELECT p.id, count(ph.id) as cnt
        FROM public.properties p
        JOIN public.property_photos ph ON ph.property_id = p.id
        GROUP BY p.id
        HAVING count(ph.id) < 6
      ) sub
    ),
    'flagged_photos_count', (
      SELECT count(DISTINCT p.id)
      FROM public.properties p
      JOIN public.property_photos ph ON ph.property_id = p.id
      WHERE ph.watermark_status IN ('branding', 'watermark', 'flagged')
    )
  ) INTO v_res;
  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_watermark_sniper_filter_options TO anon, authenticated, service_role;

-- 3. High-performance database-driven pagination catalog query
DROP FUNCTION IF EXISTS public.get_watermark_sniper_catalog(integer, integer, text, text);
DROP FUNCTION IF EXISTS public.get_watermark_sniper_catalog(integer, integer, text, text, text, text, timestamp with time zone, timestamp with time zone, text, text);

CREATE OR REPLACE FUNCTION public.get_watermark_sniper_catalog(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_state text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_date_filter text DEFAULT NULL,
  p_date_from timestamp with time zone DEFAULT NULL,
  p_date_to timestamp with time zone DEFAULT NULL,
  p_photo_status text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE(
  id text,
  title text,
  address text,
  city text,
  state text,
  zip text,
  property_type text,
  monthly_rent integer,
  status text,
  landlord_id uuid,
  created_at timestamp with time zone,
  photo_count bigint,
  photo_id uuid,
  photo_url text,
  photo_file_id text,
  cover_url text,
  has_flagged_photo boolean,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH photo_summary AS (
    SELECT 
      ph.property_id,
      count(*)::bigint as p_count,
      bool_or(ph.watermark_status IN ('branding', 'watermark', 'flagged')) as p_has_flagged
    FROM public.property_photos ph
    GROUP BY ph.property_id
  ),
  filtered AS (
    SELECT 
      p.id,
      p.title,
      p.address,
      p.city,
      p.state,
      p.zip,
      p.property_type,
      p.monthly_rent,
      p.status::text as status_txt,
      p.landlord_id,
      p.created_at,
      COALESCE(ps.p_count, 0::bigint) as p_photo_count,
      COALESCE(ps.p_has_flagged, false) as p_has_flagged,
      count(*) OVER() as full_count
    FROM public.properties p
    LEFT JOIN photo_summary ps ON ps.property_id = p.id
    WHERE 
      (p_state IS NULL OR p_state = '' OR p_state = 'all' OR p.state ILIKE p_state)
      AND (p_city IS NULL OR p_city = '' OR p_city = 'all' OR p.city ILIKE p_city)
      AND (
        p_property_type IS NULL OR p_property_type = '' OR p_property_type = 'all' 
        OR p.property_type ILIKE '%' || p_property_type || '%'
      )
      AND (
        CASE 
          WHEN p_date_filter = '24h' OR p_date_filter = 'today' THEN p.created_at >= (NOW() - INTERVAL '24 hours')
          WHEN p_date_filter = '7d' THEN p.created_at >= (NOW() - INTERVAL '7 days')
          WHEN p_date_filter = '30d' THEN p.created_at >= (NOW() - INTERVAL '30 days')
          WHEN p_date_from IS NOT NULL AND p_date_to IS NOT NULL THEN p.created_at >= p_date_from AND p.created_at <= p_date_to
          WHEN p_date_from IS NOT NULL THEN p.created_at >= p_date_from
          WHEN p_date_to IS NOT NULL THEN p.created_at <= p_date_to
          ELSE TRUE
        END
      )
      AND (
        CASE
          WHEN p_photo_status = 'zero_photos' THEN COALESCE(ps.p_count, 0) = 0
          WHEN p_photo_status = 'under_6_photos' THEN COALESCE(ps.p_count, 0) > 0 AND COALESCE(ps.p_count, 0) < 6
          WHEN p_photo_status = 'with_photos' THEN COALESCE(ps.p_count, 0) > 0
          WHEN p_photo_status = 'flagged_only' THEN COALESCE(ps.p_has_flagged, false) = true
          ELSE TRUE
        END
      )
      AND (
        p_search IS NULL OR trim(p_search) = '' OR 
        p.address ILIKE '%' || trim(p_search) || '%' OR
        p.title ILIKE '%' || trim(p_search) || '%' OR
        p.city ILIKE '%' || trim(p_search) || '%' OR
        p.zip ILIKE '%' || trim(p_search) || '%' OR
        p.id ILIKE '%' || trim(p_search) || '%'
      )
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT 
    f.id,
    f.title,
    f.address,
    f.city,
    f.state,
    f.zip,
    f.property_type,
    f.monthly_rent,
    f.status_txt AS status,
    f.landlord_id,
    f.created_at,
    f.p_photo_count AS photo_count,
    ph.id AS photo_id,
    ph.url AS photo_url,
    ph.file_id AS photo_file_id,
    cov.url AS cover_url,
    f.p_has_flagged AS has_flagged_photo,
    f.full_count AS total_count
  FROM filtered f
  LEFT JOIN LATERAL (
    SELECT pph.id, pph.url, pph.file_id
    FROM public.property_photos pph
    WHERE pph.property_id = f.id
    ORDER BY 
      CASE WHEN pph.display_order = 0 THEN 99 ELSE pph.display_order END ASC,
      pph.display_order ASC
    LIMIT 1
  ) ph ON true
  LEFT JOIN LATERAL (
    SELECT pph.url
    FROM public.property_photos pph
    WHERE pph.property_id = f.id
    ORDER BY pph.display_order ASC
    LIMIT 1
  ) cov ON true
  ORDER BY f.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_watermark_sniper_catalog TO anon, authenticated, service_role;

-- 4. Authoritative cascading delete returning exact deleted IDs and photo file IDs
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
  v_actually_deleted text[];
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

  -- 8. Delete the properties themselves and capture exactly which IDs were deleted
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
$$;

REVOKE EXECUTE ON FUNCTION public.delete_properties_cascade(text[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_properties_cascade(text[]) TO authenticated, service_role, anon;
