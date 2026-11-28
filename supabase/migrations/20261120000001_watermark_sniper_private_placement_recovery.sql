-- Choice Properties — Watermark Sniper Private Placement & 24h Recovery Architecture
-- Migration: 20261120000001_watermark_sniper_private_placement_recovery.sql

CREATE TABLE IF NOT EXISTS public.property_recovery_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL,
  batch_id text,
  share_token_hashes text[] DEFAULT '{}',
  title text,
  address text,
  city text,
  state text,
  zip text,
  monthly_rent numeric,
  property_snapshot jsonb NOT NULL,
  photos_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  delete_reason text DEFAULT 'Watermark sniper batch moderation',
  recovery_status text NOT NULL DEFAULT 'archived', -- 'archived', 'restored', 'purged'
  archived_at timestamptz NOT NULL DEFAULT now(),
  recovery_expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  restored_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_property_recovery_archive_prop_id ON public.property_recovery_archive (property_id);
CREATE INDEX IF NOT EXISTS idx_property_recovery_archive_batch_id ON public.property_recovery_archive (batch_id);
CREATE INDEX IF NOT EXISTS idx_property_recovery_archive_status ON public.property_recovery_archive (recovery_status, recovery_expires_at);

-- Enable RLS
ALTER TABLE public.property_recovery_archive ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'property_recovery_archive' AND policyname = 'Admins can manage recovery archive'
  ) THEN
    CREATE POLICY "Admins can manage recovery archive"
      ON public.property_recovery_archive
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 1. RPC: Get Batch Photos for Watermark Sniper
CREATE OR REPLACE FUNCTION public.get_batch_photos_for_sniper(
  p_batch_id text DEFAULT NULL,
  p_share_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_batch_id text := p_batch_id;
  v_share_hash text;
  v_property_ids text[];
  v_batch_info jsonb := '{}'::jsonb;
  v_properties jsonb := '[]'::jsonb;
  v_photos jsonb := '[]'::jsonb;
  v_recoverable jsonb := '[]'::jsonb;
  v_count_props int := 0;
  v_count_photos int := 0;
  v_count_rec int := 0;
BEGIN
  -- Resolve share token if supplied
  IF p_share_token IS NOT NULL AND trim(p_share_token) <> '' THEN
    v_share_hash := encode(digest(p_share_token::bytea, 'sha256'), 'hex');

    -- Find properties attached to this share token
    SELECT array_agg(DISTINCT spp.property_id), max(ps.batch_id)
    INTO v_property_ids, v_batch_id
    FROM property_shares ps
    JOIN property_share_properties spp ON spp.share_id = ps.id
    WHERE ps.token_hash = v_share_hash
       OR ps.token_hash = p_share_token;

    IF v_batch_id IS NULL THEN
      -- Try finding batch_id directly from the properties
      SELECT batch_id INTO v_batch_id
      FROM properties
      WHERE id = ANY(v_property_ids) AND batch_id IS NOT NULL
      LIMIT 1;
    END IF;
  ELSIF v_batch_id IS NOT NULL AND trim(v_batch_id) <> '' THEN
    SELECT array_agg(id)
    INTO v_property_ids
    FROM properties
    WHERE batch_id = v_batch_id;
  END IF;

  IF v_property_ids IS NULL OR array_length(v_property_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'batch_id', v_batch_id,
      'batch_info', v_batch_info,
      'properties', '[]'::jsonb,
      'photos', '[]'::jsonb,
      'recoverable', '[]'::jsonb,
      'total_properties', 0,
      'total_photos', 0,
      'total_recoverable', 0
    );
  END IF;

  -- Load Batch Info if exists
  IF v_batch_id IS NOT NULL THEN
    SELECT to_jsonb(b)
    INTO v_batch_info
    FROM (
      SELECT id, title, batch_code, notes, count_properties, target_city, target_state, published_at
      FROM publishing_batches
      WHERE id = v_batch_id OR batch_code = v_batch_id
      LIMIT 1
    ) b;
  END IF;

  -- Load Properties
  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.address ASC)
  INTO v_properties
  FROM (
    SELECT
      pr.id,
      pr.address,
      pr.city,
      pr.state,
      pr.zip,
      pr.monthly_rent,
      pr.bedrooms,
      pr.bathrooms,
      pr.square_footage,
      pr.property_type,
      pr.status,
      pr.created_at,
      count(ph.id) AS photo_count
    FROM properties pr
    LEFT JOIN property_photos ph ON ph.property_id = pr.id
    WHERE pr.id = ANY(v_property_ids)
    GROUP BY pr.id
  ) p;

  -- Load All Photos for this batch in original order
  SELECT jsonb_agg(to_jsonb(ph) ORDER BY ph.address ASC, ph.display_order ASC, ph.id ASC)
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
      pr.bathrooms
    FROM property_photos pho
    JOIN properties pr ON pr.id = pho.property_id
    WHERE pho.property_id = ANY(v_property_ids)
  ) ph;

  -- Load Recoverable Properties (deleted within 24 hours)
  SELECT jsonb_agg(to_jsonb(rec) ORDER BY rec.archived_at DESC)
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
      archived_at,
      recovery_expires_at,
      round(EXTRACT(epoch FROM (recovery_expires_at - now())))::int AS seconds_remaining,
      jsonb_array_length(photos_snapshot) AS photo_count
    FROM property_recovery_archive
    WHERE recovery_status = 'archived'
      AND recovery_expires_at > now()
      AND (
        (v_batch_id IS NOT NULL AND batch_id = v_batch_id)
        OR property_id = ANY(v_property_ids)
      )
  ) rec;

  v_count_props := coalesce(jsonb_array_length(v_properties), 0);
  v_count_photos := coalesce(jsonb_array_length(v_photos), 0);
  v_count_rec := coalesce(jsonb_array_length(v_recoverable), 0);

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'batch_info', coalesce(v_batch_info, '{}'::jsonb),
    'properties', coalesce(v_properties, '[]'::jsonb),
    'photos', coalesce(v_photos, '[]'::jsonb),
    'recoverable', coalesce(v_recoverable, '[]'::jsonb),
    'total_properties', v_count_props,
    'total_photos', v_count_photos,
    'total_recoverable', v_count_rec
  );
END;
$$;

-- 2. RPC: Archive and Delete Property (24h Recovery Window)
CREATE OR REPLACE FUNCTION public.archive_and_delete_property(
  p_property_id text,
  p_reason text DEFAULT 'Watermark sniper deletion'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_prop record;
  v_photos jsonb;
  v_share_hashes text[];
  v_recovery_id uuid;
BEGIN
  -- Check property exists
  SELECT * INTO v_prop FROM properties WHERE id = p_property_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Property not found: ' || p_property_id);
  END IF;

  -- Snapshot photos
  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.display_order ASC), '[]'::jsonb)
  INTO v_photos
  FROM property_photos p
  WHERE p.property_id = p_property_id;

  -- Snapshot share token hashes
  SELECT coalesce(array_agg(DISTINCT ps.token_hash), '{}')
  INTO v_share_hashes
  FROM property_share_properties psp
  JOIN property_shares ps ON ps.id = psp.share_id
  WHERE psp.property_id = p_property_id;

  -- Insert into archive
  INSERT INTO property_recovery_archive (
    property_id,
    batch_id,
    share_token_hashes,
    title,
    address,
    city,
    state,
    zip,
    monthly_rent,
    property_snapshot,
    photos_snapshot,
    deleted_by,
    delete_reason,
    recovery_status,
    archived_at,
    recovery_expires_at
  ) VALUES (
    v_prop.id,
    v_prop.batch_id,
    v_share_hashes,
    v_prop.title,
    v_prop.address,
    v_prop.city,
    v_prop.state,
    v_prop.zip,
    v_prop.monthly_rent,
    to_jsonb(v_prop),
    v_photos,
    auth.uid(),
    coalesce(p_reason, 'Watermark sniper batch moderation'),
    'archived',
    now(),
    now() + interval '24 hours'
  )
  RETURNING id INTO v_recovery_id;

  -- Delete from active tables
  DELETE FROM property_share_properties WHERE property_id = p_property_id;
  DELETE FROM saved_properties WHERE property_id = p_property_id;
  DELETE FROM inquiries WHERE property_id = p_property_id;
  UPDATE applications SET property_id = NULL WHERE property_id = p_property_id;
  DELETE FROM property_photos WHERE property_id = p_property_id;
  DELETE FROM properties WHERE id = p_property_id;

  RETURN jsonb_build_object(
    'ok', true,
    'recovery_id', v_recovery_id,
    'property_id', p_property_id,
    'message', 'Property archived and deleted. Restorable within 24 hours.'
  );
END;
$$;

-- 3. RPC: Delete Single Property Photo
CREATE OR REPLACE FUNCTION public.delete_single_property_photo(
  p_photo_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_photo record;
  v_prop_id text;
  v_was_hero boolean;
  v_next_hero_id uuid;
  v_new_count int;
BEGIN
  SELECT * INTO v_photo FROM property_photos WHERE id = p_photo_id::uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Photo not found');
  END IF;

  v_prop_id := v_photo.property_id;
  v_was_hero := coalesce(v_photo.is_hero, false);

  -- Delete photo
  DELETE FROM property_photos WHERE id = p_photo_id::uuid;

  -- If was hero, promote next available photo
  IF v_was_hero THEN
    SELECT id INTO v_next_hero_id
    FROM property_photos
    WHERE property_id = v_prop_id
    ORDER BY display_order ASC, created_at ASC
    LIMIT 1;

    IF v_next_hero_id IS NOT NULL THEN
      UPDATE property_photos SET is_hero = true WHERE id = v_next_hero_id;
    END IF;
  END IF;

  -- Count remaining photos
  SELECT count(*) INTO v_new_count FROM property_photos WHERE property_id = v_prop_id;

  RETURN jsonb_build_object(
    'ok', true,
    'photo_id', p_photo_id,
    'property_id', v_prop_id,
    'remaining_photos', v_new_count,
    'promoted_hero_id', v_next_hero_id
  );
END;
$$;

-- 4. RPC: Get Recoverable Properties
CREATE OR REPLACE FUNCTION public.get_recoverable_properties(
  p_batch_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_items jsonb;
BEGIN
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
      delete_reason,
      archived_at,
      recovery_expires_at,
      round(EXTRACT(epoch FROM (recovery_expires_at - now())))::int AS seconds_remaining,
      jsonb_array_length(photos_snapshot) AS photo_count
    FROM property_recovery_archive
    WHERE recovery_status = 'archived'
      AND recovery_expires_at > now()
      AND (p_batch_id IS NULL OR batch_id = p_batch_id)
  ) rec;

  RETURN jsonb_build_object(
    'ok', true,
    'items', v_items,
    'server_now', now()
  );
END;
$$;

-- 5. RPC: Restore Archived Property
CREATE OR REPLACE FUNCTION public.restore_archived_property(
  p_recovery_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rec record;
  v_clean_snap jsonb;
  v_photo jsonb;
  v_hash text;
  v_share_id uuid;
BEGIN
  SELECT * INTO v_rec FROM property_recovery_archive WHERE id = p_recovery_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Recovery record not found');
  END IF;

  IF v_rec.recovery_status = 'restored' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Property has already been restored');
  END IF;

  IF v_rec.recovery_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Recovery window expired (24-hour limit)');
  END IF;

  -- Clean snapshot by removing generated column search_tsv
  v_clean_snap := v_rec.property_snapshot - 'search_tsv';

  -- Restore to properties table
  INSERT INTO public.properties (
    id, title, address, city, state, zip, county, monthly_rent, security_deposit,
    application_fee, bedrooms, bathrooms, half_bathrooms, square_footage, property_type,
    status, is_featured, description, features, amenities, pets_allowed,
    pet_types_allowed, pet_deposit, lease_terms, minimum_lease_months,
    available_date, virtual_tour_url, videos, original_image_urls,
    landlord_id, batch_id, latitude, longitude, created_at, updated_at
  ) VALUES (
    v_clean_snap->>'id',
    v_clean_snap->>'title',
    v_clean_snap->>'address',
    v_clean_snap->>'city',
    v_clean_snap->>'state',
    v_clean_snap->>'zip',
    v_clean_snap->>'county',
    (v_clean_snap->>'monthly_rent')::numeric,
    (v_clean_snap->>'security_deposit')::numeric,
    (v_clean_snap->>'application_fee')::numeric,
    (v_clean_snap->>'bedrooms')::numeric,
    (v_clean_snap->>'bathrooms')::numeric,
    (v_clean_snap->>'half_bathrooms')::int,
    (v_clean_snap->>'square_footage')::int,
    v_clean_snap->>'property_type',
    (COALESCE(v_clean_snap->>'status', 'private_placement'))::public.property_status,
    COALESCE((v_clean_snap->>'is_featured')::boolean, false),
    v_clean_snap->>'description',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_clean_snap->'features', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_clean_snap->'amenities', '[]'::jsonb))),
    (v_clean_snap->>'pets_allowed')::boolean,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_clean_snap->'pet_types_allowed', '[]'::jsonb))),
    (v_clean_snap->>'pet_deposit')::numeric,
    v_clean_snap->>'lease_terms',
    (v_clean_snap->>'minimum_lease_months')::int,
    (v_clean_snap->>'available_date')::date,
    v_clean_snap->>'virtual_tour_url',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_clean_snap->'videos', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_clean_snap->'original_image_urls', '[]'::jsonb))),
    (v_clean_snap->>'landlord_id')::uuid,
    v_clean_snap->>'batch_id',
    (v_clean_snap->>'latitude')::double precision,
    (v_clean_snap->>'longitude')::double precision,
    COALESCE((v_clean_snap->>'created_at')::timestamptz, now()),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = now();

  -- Restore photos
  IF jsonb_typeof(v_rec.photos_snapshot) = 'array' THEN
    FOR v_photo IN SELECT * FROM jsonb_array_elements(v_rec.photos_snapshot)
    LOOP
      INSERT INTO public.property_photos (
        id, property_id, url, file_id, is_hero, display_order, watermark_status, created_at
      ) VALUES (
        (v_photo->>'id')::uuid,
        v_photo->>'property_id',
        v_photo->>'url',
        v_photo->>'file_id',
        COALESCE((v_photo->>'is_hero')::boolean, false),
        COALESCE((v_photo->>'display_order')::int, 1),
        COALESCE(v_photo->>'watermark_status', 'clean'),
        COALESCE((v_photo->>'created_at')::timestamptz, now())
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END IF;

  -- Restore share links
  IF v_rec.share_token_hashes IS NOT NULL THEN
    FOREACH v_hash IN ARRAY v_rec.share_token_hashes
    LOOP
      SELECT id INTO v_share_id FROM property_shares WHERE token_hash = v_hash LIMIT 1;
      IF v_share_id IS NOT NULL THEN
        INSERT INTO property_share_properties (share_id, property_id)
        VALUES (v_share_id, v_rec.property_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Mark restored
  UPDATE property_recovery_archive
  SET recovery_status = 'restored', restored_at = now()
  WHERE id = p_recovery_id;

  RETURN jsonb_build_object(
    'ok', true,
    'recovery_id', p_recovery_id,
    'property_id', v_rec.property_id,
    'message', 'Property successfully restored from archive.'
  );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.get_batch_photos_for_sniper(text, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.archive_and_delete_property(text, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.delete_single_property_photo(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_recoverable_properties(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.restore_archived_property(uuid) TO authenticated, anon, service_role;
