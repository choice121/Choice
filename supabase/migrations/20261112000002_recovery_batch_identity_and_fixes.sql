-- ============================================================================
-- Choice Properties — Batch Identity on Restored Pipeline Rows & RPC Refinements
-- ============================================================================
-- Ensures:
--   1. pipeline.pipeline_properties tracks original batch_id so restored rows
--      retain full batch identity and UI visibility.
--   2. pipeline_list exposes batch_id for Admin Pipeline UI rendering.
--   3. pipeline_archive_and_remove embeds batch_id in the recovery snapshot.
--   4. pipeline_restore_batch stamps original batch_id back onto restored rows.
--   5. pipeline_get_recoverable_batches reports accurate has_raw_payload boolean.
-- ============================================================================

ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS batch_id TEXT;

CREATE OR REPLACE FUNCTION public.pipeline_list(
  p_status text DEFAULT 'scraped'::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      id, status, title, address, city, state, zip,
      bedrooms, bathrooms, square_footage, monthly_rent,
      property_type, year_built, unit_number,
      description, showing_instructions,
      pets_allowed, smoking_allowed, parking,
      minimum_lease_months, security_deposit, application_fee,
      garage_spaces, available_date, virtual_tour_url,
      has_basement, has_central_air,
      data_quality_score, missing_fields, edited_fields,
      original_image_urls, source_url, source, agent_name,
      poster_landlord_id, choice_property_id, batch_id,
      scraped_at, updated_at, published_at,
      neighborhood, county, location_context,
      listed_at, source_last_updated_at, imported_at, source_status, last_verified_at,
      lat, lng
    FROM pipeline.pipeline_properties
    WHERE (p_status = 'all' OR status = p_status)
    ORDER BY COALESCE(listed_at, imported_at, scraped_at::timestamptz) DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pipeline_archive_and_remove(
  p_batch_id      TEXT,
  p_pipeline_ids  TEXT[],
  p_raw_paths     JSONB DEFAULT '{}'::jsonb,
  p_target_market TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_now          TIMESTAMPTZ := now();
  v_expires      TIMESTAMPTZ := v_now + interval '24 hours';
  v_rec          pipeline.pipeline_properties%ROWTYPE;
  v_archived_cnt INTEGER := 0;
  v_deleted_cnt  INTEGER := 0;
  v_paths        JSONB;
  v_market       TEXT;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF p_batch_id IS NULL OR length(trim(p_batch_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_required');
  END IF;

  IF p_pipeline_ids IS NULL OR array_length(p_pipeline_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'archived', 0, 'deleted', 0);
  END IF;

  SELECT COALESCE(p_target_market, target_market, 'Unknown')
  INTO v_market
  FROM public.publishing_batches
  WHERE id = p_batch_id;

  v_market := COALESCE(v_market, p_target_market, 'Unknown');

  -- Lock target pipeline rows FOR UPDATE so no concurrent edit/delete collides
  FOR v_rec IN
    SELECT *
    FROM pipeline.pipeline_properties
    WHERE id = ANY(p_pipeline_ids)
    FOR UPDATE
  LOOP
    v_rec.batch_id := p_batch_id;
    v_paths := COALESCE(p_raw_paths -> v_rec.id, '[]'::jsonb);

    INSERT INTO pipeline.pipeline_recovery_archive (
      batch_id,
      pipeline_id,
      source,
      source_listing_id,
      target_market,
      address,
      city,
      state,
      zip,
      published_property_id,
      original_status,
      pipeline_row_snapshot,
      raw_storage_paths,
      recovery_status,
      deleted_at,
      recovery_expires_at
    ) VALUES (
      p_batch_id,
      v_rec.id,
      v_rec.source,
      v_rec.source_listing_id,
      v_market,
      COALESCE(v_rec.address, v_rec.title, v_rec.id),
      v_rec.city,
      v_rec.state,
      v_rec.zip,
      v_rec.choice_property_id,
      v_rec.status,
      to_jsonb(v_rec),
      v_paths,
      'recoverable',
      v_now,
      v_expires
    )
    ON CONFLICT (batch_id, pipeline_id) DO UPDATE
    SET pipeline_row_snapshot = EXCLUDED.pipeline_row_snapshot,
        raw_storage_paths     = EXCLUDED.raw_storage_paths,
        recovery_status       = 'recoverable',
        deleted_at            = v_now,
        recovery_expires_at   = v_expires;

    v_archived_cnt := v_archived_cnt + 1;
  END LOOP;

  -- Only remove from active pipeline AFTER archival succeeded in same transaction
  IF v_archived_cnt > 0 THEN
    DELETE FROM pipeline.pipeline_properties
    WHERE id = ANY(p_pipeline_ids);
    GET DIAGNOSTICS v_deleted_cnt = ROW_COUNT;
  END IF;

  UPDATE public.publishing_batches
  SET pipeline_deleted_at = v_now,
      recovery_expires_at = v_expires,
      recovery_status     = 'recoverable',
      cleanup_completed   = true,
      cleanup_details     = COALESCE(cleanup_details, '{}'::jsonb) || jsonb_build_object(
        'archived_count', v_archived_cnt,
        'pipeline_deleted_count', v_deleted_cnt,
        'recovery_expires_at', v_expires
      )
  WHERE id = p_batch_id;

  UPDATE public.publishing_batch_properties
  SET recovery_status          = 'recoverable',
      deleted_from_pipeline_at = v_now,
      recovery_expires_at      = v_expires
  WHERE batch_id = p_batch_id
    AND pipeline_id = ANY(p_pipeline_ids);

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'archived', v_archived_cnt,
    'deleted', v_deleted_cnt,
    'deleted_at', v_now,
    'recovery_expires_at', v_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_restore_batch(
  p_batch_id     TEXT,
  p_pipeline_ids TEXT[] DEFAULT NULL,
  p_reason       TEXT DEFAULT 'Explicit administrator restoration request'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_now           TIMESTAMPTZ := now();
  v_arch          pipeline.pipeline_recovery_archive%ROWTYPE;
  v_row           pipeline.pipeline_properties%ROWTYPE;
  v_restored_cnt  INTEGER := 0;
  v_expired_cnt   INTEGER := 0;
  v_total_elig    INTEGER := 0;
  v_remaining_rec INTEGER := 0;
  v_restored_ids  TEXT[] := ARRAY[]::TEXT[];
  v_folder_exists BOOLEAN;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF p_batch_id IS NULL OR length(trim(p_batch_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_required');
  END IF;

  -- Lock matching archive rows FOR UPDATE so permanent purge cannot collide
  FOR v_arch IN
    SELECT *
    FROM pipeline.pipeline_recovery_archive
    WHERE batch_id = p_batch_id
      AND (p_pipeline_ids IS NULL OR pipeline_id = ANY(p_pipeline_ids))
    FOR UPDATE
  LOOP
    -- Enforce strict 24h expiration boundary using server timestamp
    IF v_arch.recovery_status = 'recoverable' AND v_arch.recovery_expires_at <= v_now THEN
      UPDATE pipeline.pipeline_recovery_archive
      SET recovery_status = 'expired'
      WHERE id = v_arch.id;

      UPDATE public.publishing_batch_properties
      SET recovery_status = 'expired'
      WHERE batch_id = p_batch_id AND pipeline_id = v_arch.pipeline_id;

      v_expired_cnt := v_expired_cnt + 1;
      CONTINUE;
    END IF;

    IF v_arch.recovery_status <> 'recoverable' OR v_arch.pipeline_row_snapshot IS NULL THEN
      CONTINUE;
    END IF;

    v_total_elig := v_total_elig + 1;

    -- Transition to restoring state while writing back to active pipeline
    UPDATE pipeline.pipeline_recovery_archive
    SET recovery_status = 'restoring'
    WHERE id = v_arch.id;

    v_row := jsonb_populate_record(NULL::pipeline.pipeline_properties, v_arch.pipeline_row_snapshot);

    -- Preserve original batch identity on the restored row
    v_row.batch_id := p_batch_id;

    -- Preserve original folder grouping if the folder still exists
    IF v_row.folder_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM pipeline.pipeline_folders WHERE id = v_row.folder_id)
      INTO v_folder_exists;
      IF NOT v_folder_exists THEN
        v_row.folder_id := NULL;
        v_row.folder_serial := NULL;
      END IF;
    END IF;

    -- Restore to pre-publish pipeline state; never auto-publish
    IF v_row.status = 'published' OR v_row.status IS NULL THEN
      v_row.status := CASE WHEN v_arch.original_status IN ('scraped', 'edited') THEN v_arch.original_status ELSE 'scraped' END;
    END IF;
    v_row.updated_at := v_now;

    INSERT INTO pipeline.pipeline_properties
    SELECT v_row.*
    ON CONFLICT (id) DO UPDATE
    SET status         = EXCLUDED.status,
        description    = EXCLUDED.description,
        monthly_rent   = EXCLUDED.monthly_rent,
        folder_id      = EXCLUDED.folder_id,
        folder_serial  = EXCLUDED.folder_serial,
        batch_id       = EXCLUDED.batch_id,
        updated_at     = v_now;

    UPDATE pipeline.pipeline_recovery_archive
    SET recovery_status    = 'restored',
        restored_at        = v_now,
        restoration_reason = p_reason
    WHERE id = v_arch.id;

    UPDATE public.publishing_batch_properties
    SET recovery_status = 'restored',
        restored_at     = v_now
    WHERE batch_id = p_batch_id
      AND pipeline_id = v_arch.pipeline_id;

    v_restored_cnt := v_restored_cnt + 1;
    v_restored_ids := array_append(v_restored_ids, v_arch.pipeline_id);
  END LOOP;

  IF v_restored_cnt = 0 THEN
    IF v_expired_cnt > 0 THEN
      UPDATE public.publishing_batches
      SET recovery_status = 'expired'
      WHERE id = p_batch_id AND recovery_status = 'recoverable';

      RETURN jsonb_build_object(
        'ok', false,
        'error', 'recovery_window_expired',
        'expired_count', v_expired_cnt
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', false,
      'error', 'no_recoverable_properties_found'
    );
  END IF;

  SELECT count(*)
  INTO v_remaining_rec
  FROM pipeline.pipeline_recovery_archive
  WHERE batch_id = p_batch_id
    AND recovery_status = 'recoverable'
    AND recovery_expires_at > v_now;

  UPDATE public.publishing_batches
  SET recovery_status    = CASE WHEN v_remaining_rec > 0 THEN 'partially_restored' ELSE 'restored' END,
      restored_at        = v_now,
      restoration_reason = p_reason
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'restored_count', v_restored_cnt,
    'restored_pipeline_ids', to_jsonb(v_restored_ids),
    'remaining_recoverable', v_remaining_rec,
    'restored_at', v_now,
    'note', 'Restored to active pipeline in original batch. Republishing requires explicit instruction.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_get_recoverable_batches()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_now     TIMESTAMPTZ := now();
  v_batches JSONB := '[]'::jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_batches
  FROM (
    SELECT
      a.batch_id,
      b.target_market,
      b.workflow_type,
      b.visibility,
      b.started_at AS published_at,
      MIN(a.deleted_at) AS deleted_at,
      MAX(a.recovery_expires_at) AS recovery_expires_at,
      GREATEST(0, EXTRACT(EPOCH FROM (MAX(a.recovery_expires_at) - v_now)))::bigint AS seconds_remaining,
      COUNT(*) AS recoverable_count,
      jsonb_agg(jsonb_build_object(
        'pipeline_id', a.pipeline_id,
        'source_listing_id', a.source_listing_id,
        'address', a.address,
        'city', a.city,
        'state', a.state,
        'zip', a.zip,
        'published_property_id', a.published_property_id,
        'recovery_status', a.recovery_status,
        'recovery_expires_at', a.recovery_expires_at,
        'has_raw_payload', (
          jsonb_array_length(COALESCE(a.raw_storage_paths, '[]'::jsonb)) > 0
          OR (a.pipeline_row_snapshot -> 'source_raw_payload') IS NOT NULL
        )
      ) ORDER BY a.deleted_at ASC) AS items
    FROM pipeline.pipeline_recovery_archive a
    JOIN public.publishing_batches b ON b.id = a.batch_id
    WHERE a.recovery_status = 'recoverable'
      AND a.recovery_expires_at > v_now
    GROUP BY a.batch_id, b.target_market, b.workflow_type, b.visibility, b.started_at
    ORDER BY MIN(a.deleted_at) DESC
  ) t;

  RETURN jsonb_build_object('ok', true, 'server_now', v_now, 'batches', v_batches);
END;
$$;
