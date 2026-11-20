-- ============================================================================
-- Choice Properties — Watermark Sniper Private Placement Scope, Mode Separation,
--                     Single-Photo Delete Dedup & Mobile-First Recovery
-- ============================================================================

-- 1. Remove overloaded / unguarded uuid variant of delete_single_property_photo
DROP FUNCTION IF EXISTS public.delete_single_property_photo(uuid);

CREATE OR REPLACE FUNCTION public.delete_single_property_photo(p_photo_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_photo        record;
  v_prop_id      text;
  v_was_hero     boolean;
  v_next_hero_id uuid;
  v_new_count    int;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  SELECT * INTO v_photo FROM public.property_photos WHERE id = p_photo_id::uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Photo not found');
  END IF;

  v_prop_id := v_photo.property_id;
  v_was_hero := coalesce(v_photo.is_hero, false);

  DELETE FROM public.property_photos WHERE id = p_photo_id::uuid;

  -- Promote next available photo to hero if cover was deleted (preserve original order)
  IF v_was_hero THEN
    SELECT id INTO v_next_hero_id
    FROM public.property_photos
    WHERE property_id = v_prop_id
    ORDER BY display_order ASC, created_at ASC
    LIMIT 1;

    IF v_next_hero_id IS NOT NULL THEN
      UPDATE public.property_photos SET is_hero = true WHERE id = v_next_hero_id;
    END IF;
  END IF;

  SELECT count(*)::int INTO v_new_count
  FROM public.property_photos
  WHERE property_id = v_prop_id;

  UPDATE public.properties SET updated_at = now() WHERE id = v_prop_id;

  UPDATE public.publishing_batch_properties
  SET photo_count = v_new_count
  WHERE property_id = v_prop_id;

  RETURN jsonb_build_object(
    'ok', true,
    'photo_id', p_photo_id,
    'deleted_photo_id', p_photo_id,
    'property_id', v_prop_id,
    'file_id', v_photo.file_id,
    'url', v_photo.url,
    'remaining_photos', v_new_count,
    'promoted_hero_id', v_next_hero_id
  );
END;
$$;

-- 2. Upgrade get_recoverable_properties to support optional share_id scoping
DROP FUNCTION IF EXISTS public.get_recoverable_properties(text);

CREATE OR REPLACE FUNCTION public.get_recoverable_properties(
  p_batch_id text DEFAULT NULL,
  p_share_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_items jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  PERFORM public.purge_expired_recovery_archive();

  SELECT coalesce(jsonb_agg(to_jsonb(rec) ORDER BY rec.archived_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      id AS recovery_id,
      property_id,
      batch_id,
      title,
      address,
      city,
      state,
      zip,
      monthly_rent,
      deleted_reason AS delete_reason,
      deleted_at AS archived_at,
      recovery_expires_at,
      round(EXTRACT(epoch FROM (recovery_expires_at - now())))::int AS seconds_remaining,
      coalesce(jsonb_array_length(photos_snapshot), 0) AS photo_count
    FROM public.property_recovery_archive
    WHERE recovery_status = 'recoverable'
      AND recovery_expires_at > now()
      AND (
        (p_batch_id IS NULL AND p_share_id IS NULL)
        OR (p_batch_id IS NOT NULL AND batch_id = p_batch_id)
        OR (p_share_id IS NOT NULL AND p_share_id = ANY(share_ids))
      )
  ) rec;

  RETURN jsonb_build_object(
    'ok', true,
    'items', v_items,
    'server_now', now()
  );
END;
$$;

-- 3. Upgrade get_private_placement_batches_for_sniper to return BOTH batches AND all curated client share links
CREATE OR REPLACE FUNCTION public.get_private_placement_batches_for_sniper()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_batches jsonb := '[]'::jsonb;
  v_shares jsonb := '[]'::jsonb;
  v_unbatched_count int := 0;
  v_total_private int := 0;
  v_total_private_photos int := 0;
  v_total_recoverable int := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  PERFORM public.purge_expired_recovery_archive();

  -- Publishing batches with private_placement listings
  SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.latest_created_at DESC), '[]'::jsonb)
  INTO v_batches
  FROM (
    SELECT
      p.batch_id,
      count(DISTINCT p.id)::int AS property_count,
      coalesce(sum(pc.cnt), 0)::int AS photo_count,
      max(p.created_at) AS latest_created_at,
      pb.target_market,
      pb.magic_link_url,
      pb.share_id,
      pb.started_at,
      (
        SELECT count(*)::int
        FROM public.property_recovery_archive rec
        WHERE rec.batch_id = p.batch_id
          AND rec.recovery_status = 'recoverable'
          AND rec.recovery_expires_at > now()
      ) AS recoverable_count
    FROM public.properties p
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS cnt
      FROM public.property_photos ph
      WHERE ph.property_id = p.id
    ) pc ON true
    LEFT JOIN public.publishing_batches pb ON pb.id = p.batch_id
    WHERE p.status = 'private_placement'
      AND p.batch_id IS NOT NULL
    GROUP BY p.batch_id, pb.target_market, pb.magic_link_url, pb.share_id, pb.started_at
  ) b;

  -- All active curated share links containing at least 1 private_placement property (including ad-hoc client links)
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC), '[]'::jsonb)
  INTO v_shares
  FROM (
    SELECT
      ps.id AS share_id,
      ps.share_alias,
      ps.created_at,
      ps.expires_at,
      count(DISTINCT p.id)::int AS property_count,
      coalesce(sum(pc.cnt), 0)::int AS photo_count,
      array_agg(DISTINCT p.batch_id) FILTER (WHERE p.batch_id IS NOT NULL) AS batch_ids,
      min(NULLIF(trim(coalesce(p.city, '') || CASE WHEN p.state IS NOT NULL AND trim(p.state) <> '' THEN ', ' || p.state ELSE '' END), '')) AS sample_market,
      pb.id AS pub_batch_id,
      pb.target_market,
      pb.magic_link_url,
      (
        SELECT count(*)::int
        FROM public.property_recovery_archive rec
        WHERE (ps.id = ANY(rec.share_ids) OR ps.token_hash = ANY(rec.share_token_hashes))
          AND rec.recovery_status = 'recoverable'
          AND rec.recovery_expires_at > now()
      ) AS recoverable_count
    FROM public.property_shares ps
    JOIN public.property_share_properties psp ON psp.share_id = ps.id
    JOIN public.properties p ON p.id = psp.property_id
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS cnt
      FROM public.property_photos ph
      WHERE ph.property_id = p.id
    ) pc ON true
    LEFT JOIN public.publishing_batches pb ON pb.share_id = ps.id
    WHERE ps.revoked_at IS NULL
      AND ps.expires_at > now()
      AND p.status = 'private_placement'
    GROUP BY ps.id, ps.share_alias, ps.created_at, ps.expires_at, pb.id, pb.target_market, pb.magic_link_url
  ) s;

  SELECT count(*)::int
  INTO v_unbatched_count
  FROM public.properties
  WHERE status = 'private_placement'
    AND (batch_id IS NULL OR trim(batch_id) = '');

  SELECT count(*)::int
  INTO v_total_private
  FROM public.properties
  WHERE status = 'private_placement';

  SELECT count(*)::int
  INTO v_total_private_photos
  FROM public.property_photos ph
  JOIN public.properties p ON p.id = ph.property_id
  WHERE p.status = 'private_placement';

  SELECT count(*)::int
  INTO v_total_recoverable
  FROM public.property_recovery_archive
  WHERE recovery_status = 'recoverable'
    AND recovery_expires_at > now();

  RETURN jsonb_build_object(
    'ok', true,
    'batches', v_batches,
    'shares', v_shares,
    'unbatched_count', v_unbatched_count,
    'total_private_properties', v_total_private,
    'total_private_photos', v_total_private_photos,
    'total_recoverable', v_total_recoverable
  );
END;
$$;

-- 4. Upgrade get_batch_photos_for_sniper to support batch_id, share_token, share_id, property_id, or private_placement scope
DROP FUNCTION IF EXISTS public.get_batch_photos_for_sniper(text, text);

CREATE OR REPLACE FUNCTION public.get_batch_photos_for_sniper(
  p_batch_id text DEFAULT NULL,
  p_share_token text DEFAULT NULL,
  p_share_id uuid DEFAULT NULL,
  p_property_id text DEFAULT NULL,
  p_scope text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_batch_id text := NULLIF(trim(p_batch_id), '');
  v_share_id uuid := p_share_id;
  v_share_hash text;
  v_property_ids text[];
  v_mode text := 'batch';
  v_batch_info jsonb := '{}'::jsonb;
  v_properties jsonb := '[]'::jsonb;
  v_photos jsonb := '[]'::jsonb;
  v_recoverable jsonb := '[]'::jsonb;
  v_count_props int := 0;
  v_count_photos int := 0;
  v_count_rec int := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  PERFORM public.purge_expired_recovery_archive();

  -- Resolve target scope in priority order:
  -- A) Share token (magic link)
  IF p_share_token IS NOT NULL AND trim(p_share_token) <> '' THEN
    v_mode := 'share_token';
    v_share_hash := encode(digest(p_share_token::bytea, 'sha256'), 'hex');
    SELECT ps.id
    INTO v_share_id
    FROM public.property_shares ps
    WHERE ps.token_hash = v_share_hash
       OR ps.token_hash = p_share_token
    LIMIT 1;

    IF v_share_id IS NOT NULL THEN
      SELECT array_agg(DISTINCT spp.property_id)
      INTO v_property_ids
      FROM public.property_share_properties spp
      WHERE spp.share_id = v_share_id;

      IF v_batch_id IS NULL THEN
        SELECT pb.id
        INTO v_batch_id
        FROM public.publishing_batches pb
        WHERE pb.share_id = v_share_id
           OR pb.share_token_hash = v_share_hash
        LIMIT 1;
      END IF;

      IF v_batch_id IS NULL AND v_property_ids IS NOT NULL THEN
        SELECT pr.batch_id INTO v_batch_id
        FROM public.properties pr
        WHERE pr.id = ANY(v_property_ids) AND pr.batch_id IS NOT NULL
        LIMIT 1;
      END IF;
    END IF;

  -- B) Share ID (selected from Sniper Private Placement switcher)
  ELSIF v_share_id IS NOT NULL THEN
    v_mode := 'share_id';
    SELECT ps.token_hash INTO v_share_hash FROM public.property_shares ps WHERE ps.id = v_share_id LIMIT 1;

    SELECT array_agg(DISTINCT spp.property_id)
    INTO v_property_ids
    FROM public.property_share_properties spp
    WHERE spp.share_id = v_share_id;

    IF v_batch_id IS NULL THEN
      SELECT pb.id INTO v_batch_id
      FROM public.publishing_batches pb
      WHERE pb.share_id = v_share_id
      LIMIT 1;
    END IF;

  -- C) Explicit Batch ID
  ELSIF v_batch_id IS NOT NULL THEN
    v_mode := 'batch';
    SELECT array_agg(pr.id)
    INTO v_property_ids
    FROM public.properties pr
    WHERE pr.batch_id = v_batch_id;

  -- D) Single Property ID deep-link
  ELSIF p_property_id IS NOT NULL AND trim(p_property_id) <> '' THEN
    v_mode := 'property';
    v_property_ids := ARRAY[trim(p_property_id)];
    SELECT pr.batch_id INTO v_batch_id
    FROM public.properties pr
    WHERE pr.id = trim(p_property_id)
    LIMIT 1;

  -- E) All Private Placements scope (latest 200 private placement listings)
  ELSIF p_scope = 'private_placement' THEN
    v_mode := 'private_placement';
    SELECT array_agg(sub.id)
    INTO v_property_ids
    FROM (
      SELECT pr.id
      FROM public.properties pr
      WHERE pr.status = 'private_placement'
      ORDER BY pr.created_at DESC
      LIMIT 200
    ) sub;
  END IF;

  -- Load Batch Info if exists
  IF v_batch_id IS NOT NULL THEN
    SELECT to_jsonb(b)
    INTO v_batch_info
    FROM (
      SELECT
        pb.id,
        pb.target_market,
        pb.workflow_type,
        pb.visibility,
        pb.status,
        pb.published_count,
        pb.magic_link_url,
        pb.share_id,
        pb.share_expires_at,
        pb.started_at,
        pb.completed_at
      FROM public.publishing_batches pb
      WHERE pb.id = v_batch_id
      LIMIT 1
    ) b;
  ELSIF v_share_id IS NOT NULL THEN
    SELECT to_jsonb(s)
    INTO v_batch_info
    FROM (
      SELECT
        ps.id AS share_id,
        ps.share_alias,
        ps.created_at AS started_at,
        ps.expires_at AS share_expires_at
      FROM public.property_shares ps
      WHERE ps.id = v_share_id
      LIMIT 1
    ) s;
  END IF;

  -- Load Recoverable Properties
  SELECT coalesce(jsonb_agg(to_jsonb(rec) ORDER BY rec.archived_at DESC), '[]'::jsonb)
  INTO v_recoverable
  FROM (
    SELECT
      id AS recovery_id,
      property_id,
      batch_id,
      title,
      address,
      city,
      state,
      zip,
      monthly_rent,
      deleted_at AS archived_at,
      recovery_expires_at,
      round(EXTRACT(epoch FROM (recovery_expires_at - now())))::int AS seconds_remaining,
      coalesce(jsonb_array_length(photos_snapshot), 0) AS photo_count
    FROM public.property_recovery_archive
    WHERE recovery_status = 'recoverable'
      AND recovery_expires_at > now()
      AND (
        (v_batch_id IS NOT NULL AND batch_id = v_batch_id)
        OR (v_share_hash IS NOT NULL AND v_share_hash = ANY(share_token_hashes))
        OR (v_share_id IS NOT NULL AND v_share_id = ANY(share_ids))
        OR (v_property_ids IS NOT NULL AND property_id = ANY(v_property_ids))
        OR (v_mode = 'private_placement' AND coalesce(property_snapshot->>'status', '') = 'private_placement')
      )
  ) rec;

  IF v_property_ids IS NULL OR array_length(v_property_ids, 1) = 0 THEN
    v_count_rec := coalesce(jsonb_array_length(v_recoverable), 0);
    RETURN jsonb_build_object(
      'ok', true,
      'mode', v_mode,
      'batch_id', v_batch_id,
      'share_id', v_share_id,
      'batch_info', coalesce(v_batch_info, '{}'::jsonb),
      'properties', '[]'::jsonb,
      'photos', '[]'::jsonb,
      'recoverable', v_recoverable,
      'total_properties', 0,
      'total_photos', 0,
      'total_recoverable', v_count_rec
    );
  END IF;

  -- Load Properties
  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.address ASC), '[]'::jsonb)
  INTO v_properties
  FROM (
    SELECT
      pr.id,
      pr.title,
      pr.address,
      pr.city,
      pr.state,
      pr.zip,
      pr.monthly_rent,
      pr.bedrooms,
      pr.bathrooms,
      pr.square_footage,
      pr.property_type,
      pr.status::text AS status,
      pr.batch_id,
      pr.created_at,
      count(ph.id)::int AS photo_count
    FROM public.properties pr
    LEFT JOIN public.property_photos ph ON ph.property_id = pr.id
    WHERE pr.id = ANY(v_property_ids)
    GROUP BY pr.id
  ) p;

  -- Load All Photos across target properties preserving original display_order per listing
  SELECT coalesce(jsonb_agg(to_jsonb(ph) ORDER BY ph.address ASC, ph.display_order ASC, ph.id ASC), '[]'::jsonb)
  INTO v_photos
  FROM (
    SELECT
      pho.id,
      pho.property_id,
      pho.url,
      pho.file_id,
      pho.display_order,
      pho.is_hero,
      pho.watermark_status,
      pr.address,
      pr.city,
      pr.state,
      pr.zip,
      pr.monthly_rent,
      pr.bedrooms,
      pr.bathrooms,
      pr.square_footage,
      pr.property_type,
      pr.status::text AS status,
      pr.batch_id
    FROM public.property_photos pho
    JOIN public.properties pr ON pr.id = pho.property_id
    WHERE pho.property_id = ANY(v_property_ids)
  ) ph;

  v_count_props := coalesce(jsonb_array_length(v_properties), 0);
  v_count_photos := coalesce(jsonb_array_length(v_photos), 0);
  v_count_rec := coalesce(jsonb_array_length(v_recoverable), 0);

  RETURN jsonb_build_object(
    'ok', true,
    'mode', v_mode,
    'batch_id', v_batch_id,
    'share_id', v_share_id,
    'batch_info', coalesce(v_batch_info, '{}'::jsonb),
    'properties', v_properties,
    'photos', v_photos,
    'recoverable', v_recoverable,
    'total_properties', v_count_props,
    'total_photos', v_count_photos,
    'total_recoverable', v_count_rec
  );
END;
$$;

-- 5. Add p_status + admin guard to get_watermark_sniper_catalog
DROP FUNCTION IF EXISTS public.get_watermark_sniper_catalog(integer, integer, text, text, text, text, timestamptz, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.get_watermark_sniper_catalog(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_state text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_date_filter text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_photo_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL
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
  created_at timestamptz,
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
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_eff_status text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN;
  END IF;

  v_eff_status := CASE
    WHEN p_status IS NULL OR trim(p_status) = '' OR p_status = 'all' THEN NULL
    WHEN p_status = 'public' THEN 'active'
    ELSE trim(p_status)
  END;

  RETURN QUERY
  WITH photo_summary AS (
    SELECT
      ph.property_id,
      count(*)::bigint AS p_count,
      bool_or(ph.watermark_status IN ('branding', 'watermark', 'flagged')) AS p_has_flagged
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
      p.status::text AS status_txt,
      p.landlord_id,
      p.created_at,
      COALESCE(ps.p_count, 0::bigint) AS p_photo_count,
      COALESCE(ps.p_has_flagged, false) AS p_has_flagged,
      count(*) OVER() AS full_count
    FROM public.properties p
    LEFT JOIN photo_summary ps ON ps.property_id = p.id
    WHERE
      (v_eff_status IS NULL OR p.status::text = v_eff_status)
      AND (p_state IS NULL OR p_state = '' OR p_state = 'all' OR p.state ILIKE p_state)
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

-- 6. Upgrade get_watermark_sniper_filter_options with optional p_status scoping
DROP FUNCTION IF EXISTS public.get_watermark_sniper_filter_options();

CREATE OR REPLACE FUNCTION public.get_watermark_sniper_filter_options(p_status text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_res json;
  v_eff_status text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN '{}'::json;
  END IF;

  v_eff_status := CASE
    WHEN p_status IS NULL OR trim(p_status) = '' OR p_status = 'all' THEN NULL
    WHEN p_status = 'public' THEN 'active'
    ELSE trim(p_status)
  END;

  SELECT json_build_object(
    'states', (
      SELECT coalesce(json_agg(s ORDER BY s), '[]'::json)
      FROM (
        SELECT DISTINCT state AS s
        FROM public.properties
        WHERE (v_eff_status IS NULL OR status::text = v_eff_status)
          AND state IS NOT NULL AND trim(state) <> ''
      ) q
    ),
    'cities_by_state', (
      SELECT coalesce(json_object_agg(state, cities), '{}'::json)
      FROM (
        SELECT state, json_agg(DISTINCT city ORDER BY city) AS cities
        FROM public.properties
        WHERE (v_eff_status IS NULL OR status::text = v_eff_status)
          AND state IS NOT NULL AND trim(state) <> ''
          AND city IS NOT NULL AND trim(city) <> ''
        GROUP BY state
      ) cs
    ),
    'all_cities', (
      SELECT coalesce(json_agg(c ORDER BY c), '[]'::json)
      FROM (
        SELECT DISTINCT city AS c
        FROM public.properties
        WHERE (v_eff_status IS NULL OR status::text = v_eff_status)
          AND city IS NOT NULL AND trim(city) <> ''
      ) q
    ),
    'property_types', (
      SELECT coalesce(json_agg(pt ORDER BY pt), '[]'::json)
      FROM (
        SELECT DISTINCT property_type AS pt
        FROM public.properties
        WHERE (v_eff_status IS NULL OR status::text = v_eff_status)
          AND property_type IS NOT NULL AND trim(property_type) <> ''
      ) q
    ),
    'total_properties', (
      SELECT count(*) FROM public.properties
      WHERE (v_eff_status IS NULL OR status::text = v_eff_status)
    ),
    'zero_photos_count', (
      SELECT count(*)
      FROM public.properties p
      WHERE (v_eff_status IS NULL OR p.status::text = v_eff_status)
        AND NOT EXISTS (SELECT 1 FROM public.property_photos ph WHERE ph.property_id = p.id)
    ),
    'under_6_photos_count', (
      SELECT count(*)
      FROM (
        SELECT p.id, count(ph.id) AS cnt
        FROM public.properties p
        JOIN public.property_photos ph ON ph.property_id = p.id
        WHERE (v_eff_status IS NULL OR p.status::text = v_eff_status)
        GROUP BY p.id
        HAVING count(ph.id) < 6
      ) sub
    ),
    'flagged_photos_count', (
      SELECT count(DISTINCT p.id)
      FROM public.properties p
      JOIN public.property_photos ph ON ph.property_id = p.id
      WHERE (v_eff_status IS NULL OR p.status::text = v_eff_status)
        AND ph.watermark_status IN ('branding', 'watermark', 'flagged')
    )
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- 7. Upgrade scan_watermark_sniper_system with optional p_status scoping
DROP FUNCTION IF EXISTS public.scan_watermark_sniper_system();

CREATE OR REPLACE FUNCTION public.scan_watermark_sniper_system(p_status text DEFAULT NULL)
RETURNS TABLE(
  property_id text,
  address text,
  city text,
  state text,
  zip text,
  status text,
  flag_reason text,
  photo_count bigint,
  flagged_photo_count bigint,
  flagged_photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_eff_status text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN;
  END IF;

  v_eff_status := CASE
    WHEN p_status IS NULL OR trim(p_status) = '' OR p_status = 'all' THEN NULL
    WHEN p_status = 'public' THEN 'active'
    ELSE trim(p_status)
  END;

  RETURN QUERY
  WITH flagged_photos AS (
    SELECT
      ph.property_id,
      count(*) AS f_count,
      min(ph.url) AS sample_url
    FROM public.property_photos ph
    WHERE ph.watermark_status IN ('branding', 'watermark', 'flagged')
    GROUP BY ph.property_id
  ),
  prop_stats AS (
    SELECT
      ph.property_id,
      count(*) AS total_photos
    FROM public.property_photos ph
    GROUP BY ph.property_id
  )
  SELECT
    p.id AS property_id,
    p.address,
    p.city,
    p.state,
    p.zip,
    p.status::text,
    'Competitor watermark or branding detected'::text AS flag_reason,
    COALESCE(ps.total_photos, 0) AS photo_count,
    COALESCE(fp.f_count, 0) AS flagged_photo_count,
    fp.sample_url AS flagged_photo_url
  FROM flagged_photos fp
  JOIN public.properties p ON p.id = fp.property_id
  LEFT JOIN prop_stats ps ON ps.property_id = p.id
  WHERE (v_eff_status IS NULL OR p.status::text = v_eff_status)
  UNION ALL
  SELECT
    p.id AS property_id,
    p.address,
    p.city,
    p.state,
    p.zip,
    p.status::text,
    'Insufficient photos (< 6 photos policy violation)'::text AS flag_reason,
    COALESCE(ps.total_photos, 0) AS photo_count,
    0::bigint AS flagged_photo_count,
    NULL::text AS flagged_photo_url
  FROM public.properties p
  JOIN prop_stats ps ON ps.property_id = p.id
  WHERE (v_eff_status IS NULL OR p.status::text = v_eff_status)
    AND ps.total_photos < 6
    AND p.id NOT IN (SELECT fp2.property_id FROM flagged_photos fp2)
  ORDER BY flagged_photo_count DESC, address ASC;
END;
$$;

-- 8. Explicit Grants for authenticated admin callers (functions enforce is_admin() internally)
GRANT EXECUTE ON FUNCTION public.delete_single_property_photo(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_recoverable_properties(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_private_placement_batches_for_sniper() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_batch_photos_for_sniper(text, text, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_watermark_sniper_catalog(integer, integer, text, text, text, text, timestamptz, timestamptz, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_watermark_sniper_filter_options(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.scan_watermark_sniper_system(text) TO authenticated, service_role;
