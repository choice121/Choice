-- ============================================================================
-- Phase 8: Batch-Scoped Private-Placement Publishing, Visibility Shielding & Verification
-- ============================================================================
-- 1. Extends public.publishing_batch_properties with batch-scoped snapshot columns:
--      - published_rent, published_description, pricing_method, pricing_meta,
--        validation_status, verification_status, verification_report, verified_at
--      - Unique partial index (batch_id, pipeline_id) WHERE pipeline_id IS NOT NULL
--      - Index (property_id, batch_id) WHERE property_id IS NOT NULL
-- 2. Extends public.publishing_batches with verification_report JSONB.
-- 3. Updates public.compute_batch_registry_summaries and public.registry_get_batch
--    to prefer COALESCE(bp.published_rent, bp.monthly_rent, p.monthly_rent) and project
--    Phase 8 snapshot & verification metadata without breaking unions/views.
-- 4. Adds batch-scoped publishing & verification RPCs:
--      - public.pipeline_publish_batch_candidates(p_batch_id, p_limit)
--      - public.pipeline_publish_for_batch(p_batch_id, p_pipeline_id, p_visibility, p_landlord_id)
--      - public.pipeline_record_publish_failure(p_batch_id, p_pipeline_id, p_error)
--      - public.pipeline_finalize_batch_publish(...)
--      - public.pipeline_record_batch_verification(...)
-- ============================================================================

-- ── 1. Extend public.publishing_batch_properties ─────────────────────────────
ALTER TABLE public.publishing_batch_properties
  ADD COLUMN IF NOT EXISTS published_rent        NUMERIC,
  ADD COLUMN IF NOT EXISTS published_description TEXT,
  ADD COLUMN IF NOT EXISTS pricing_method        TEXT,
  ADD COLUMN IF NOT EXISTS pricing_meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS validation_status     TEXT,
  ADD COLUMN IF NOT EXISTS verification_status   TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_report   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_at           TIMESTAMPTZ;

ALTER TABLE public.publishing_batch_properties
  DROP CONSTRAINT IF EXISTS chk_pub_batch_props_verification_status;
ALTER TABLE public.publishing_batch_properties
  ADD CONSTRAINT chk_pub_batch_props_verification_status
  CHECK (verification_status IN ('pending', 'verified', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_pub_batch_props_batch_pipeline_uidx
  ON public.publishing_batch_properties (batch_id, pipeline_id)
  WHERE pipeline_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pub_batch_props_property_batch
  ON public.publishing_batch_properties (property_id, batch_id)
  WHERE property_id IS NOT NULL;

-- ── 2. Extend public.publishing_batches ──────────────────────────────────────
ALTER TABLE public.publishing_batches
  ADD COLUMN IF NOT EXISTS verification_report JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 3. Update compute_batch_registry_summaries ───────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_batch_registry_summaries(p_batch_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $function$
DECLARE
  v_batch            public.publishing_batches%ROWTYPE;
  v_pricing_summary  JSONB;
  v_location_summary JSONB;
  v_category_summary JSONB;
  v_total_rows       INTEGER := 0;
  v_published_rows   INTEGER := 0;
  v_failed_rows      INTEGER := 0;
  v_skipped_rows     INTEGER := 0;
  v_rented_rows      INTEGER := 0;
  v_min_rent         NUMERIC;
  v_max_rent         NUMERIC;
  v_avg_rent         NUMERIC;
  v_cities           JSONB;
  v_states           JSONB;
  v_zips             JSONB;
  v_city_counts      JSONB;
  v_state_counts     JSONB;
  v_type_counts      JSONB;
  v_bedroom_counts   JSONB;
BEGIN
  IF p_batch_id IS NULL OR trim(p_batch_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_required');
  END IF;

  SELECT * INTO v_batch
  FROM public.publishing_batches
  WHERE id = p_batch_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_not_found');
  END IF;

  WITH scoped AS (
    SELECT
      bp.id,
      bp.property_id,
      bp.published_status,
      COALESCE(bp.published_rent, bp.monthly_rent, pr.monthly_rent) AS eff_rent,
      NULLIF(trim(COALESCE(bp.city, pr.city, '')), '') AS eff_city,
      NULLIF(upper(trim(COALESCE(bp.state, pr.state, ''))), '') AS eff_state,
      NULLIF(trim(COALESCE(bp.zip, pr.zip, '')), '') AS eff_zip,
      NULLIF(upper(trim(COALESCE(bp.property_type, pr.property_type, ''))), '') AS eff_type,
      COALESCE(bp.bedrooms, pr.bedrooms) AS eff_bedrooms
    FROM public.publishing_batch_properties bp
    LEFT JOIN public.properties pr ON pr.id = bp.property_id
    WHERE bp.batch_id = p_batch_id
  ),
  active_scope AS (
    SELECT *
    FROM scoped
    WHERE published_status = 'published'
       OR NOT EXISTS (SELECT 1 FROM scoped WHERE published_status = 'published')
  )
  SELECT
    (SELECT COUNT(*) FROM scoped),
    (SELECT COUNT(*) FROM scoped WHERE published_status = 'published'),
    (SELECT COUNT(*) FROM scoped WHERE published_status = 'failed'),
    (SELECT COUNT(*) FROM scoped WHERE published_status = 'skipped'),
    COUNT(*) FILTER (WHERE eff_rent IS NOT NULL AND eff_rent > 0),
    MIN(eff_rent) FILTER (WHERE eff_rent IS NOT NULL AND eff_rent > 0),
    MAX(eff_rent) FILTER (WHERE eff_rent IS NOT NULL AND eff_rent > 0),
    ROUND(AVG(eff_rent) FILTER (WHERE eff_rent IS NOT NULL AND eff_rent > 0))
  INTO
    v_total_rows,
    v_published_rows,
    v_failed_rows,
    v_skipped_rows,
    v_rented_rows,
    v_min_rent,
    v_max_rent,
    v_avg_rent
  FROM active_scope;

  WITH active_scope AS (
    SELECT
      NULLIF(trim(COALESCE(bp.city, pr.city, '')), '') AS eff_city,
      NULLIF(upper(trim(COALESCE(bp.state, pr.state, ''))), '') AS eff_state,
      NULLIF(trim(COALESCE(bp.zip, pr.zip, '')), '') AS eff_zip,
      NULLIF(upper(trim(COALESCE(bp.property_type, pr.property_type, ''))), '') AS eff_type,
      COALESCE(bp.bedrooms, pr.bedrooms) AS eff_bedrooms,
      bp.published_status
    FROM public.publishing_batch_properties bp
    LEFT JOIN public.properties pr ON pr.id = bp.property_id
    WHERE bp.batch_id = p_batch_id
  ),
  effective_rows AS (
    SELECT *
    FROM active_scope
    WHERE published_status = 'published'
       OR NOT EXISTS (SELECT 1 FROM active_scope WHERE published_status = 'published')
  )
  SELECT
    COALESCE((SELECT jsonb_agg(c ORDER BY c) FROM (SELECT DISTINCT eff_city AS c FROM effective_rows WHERE eff_city IS NOT NULL) x), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(s ORDER BY s) FROM (SELECT DISTINCT eff_state AS s FROM effective_rows WHERE eff_state IS NOT NULL) x), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(z ORDER BY z) FROM (SELECT DISTINCT eff_zip AS z FROM effective_rows WHERE eff_zip IS NOT NULL) x), '[]'::jsonb),
    COALESCE((SELECT jsonb_object_agg(eff_city, cnt) FROM (SELECT eff_city, COUNT(*) AS cnt FROM effective_rows WHERE eff_city IS NOT NULL GROUP BY eff_city) x), '{}'::jsonb),
    COALESCE((SELECT jsonb_object_agg(eff_state, cnt) FROM (SELECT eff_state, COUNT(*) AS cnt FROM effective_rows WHERE eff_state IS NOT NULL GROUP BY eff_state) x), '{}'::jsonb),
    COALESCE((SELECT jsonb_object_agg(eff_type, cnt) FROM (SELECT eff_type, COUNT(*) AS cnt FROM effective_rows WHERE eff_type IS NOT NULL GROUP BY eff_type) x), '{}'::jsonb),
    COALESCE((SELECT jsonb_object_agg(eff_bedrooms::text, cnt) FROM (SELECT eff_bedrooms, COUNT(*) AS cnt FROM effective_rows WHERE eff_bedrooms IS NOT NULL GROUP BY eff_bedrooms) x), '{}'::jsonb)
  INTO
    v_cities,
    v_states,
    v_zips,
    v_city_counts,
    v_state_counts,
    v_type_counts,
    v_bedroom_counts;

  v_pricing_summary := jsonb_build_object(
    'property_count', GREATEST(v_published_rows, v_batch.published_count),
    'rented_count', v_rented_rows,
    'min_rent', v_min_rent,
    'max_rent', v_max_rent,
    'avg_rent', v_avg_rent,
    'currency', 'USD'
  );

  v_location_summary := jsonb_build_object(
    'target_market', v_batch.target_market,
    'cities', v_cities,
    'states', v_states,
    'zips', v_zips,
    'city_counts', v_city_counts,
    'state_counts', v_state_counts
  );

  v_category_summary := jsonb_build_object(
    'visibility', v_batch.visibility,
    'workflow_type', v_batch.workflow_type,
    'property_types', v_type_counts,
    'bedroom_breakdown', v_bedroom_counts,
    'total_count', GREATEST(v_total_rows, v_batch.total_processed),
    'published_count', GREATEST(v_published_rows, v_batch.published_count),
    'failed_count', GREATEST(v_failed_rows, v_batch.failed_count),
    'skipped_count', GREATEST(v_skipped_rows, v_batch.skipped_count)
  );

  UPDATE public.publishing_batches
  SET pricing_summary  = v_pricing_summary,
      location_summary = v_location_summary,
      category_summary = v_category_summary
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'pricing_summary', v_pricing_summary,
    'location_summary', v_location_summary,
    'category_summary', v_category_summary
  );
END;
$function$;

-- ── 4. Update registry_get_batch with batch-scoped rent/description/verification ─
CREATE OR REPLACE FUNCTION public.registry_get_batch(p_batch_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $function$
DECLARE
  v_raw_input  TEXT := regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', '');
  v_reg        public.private_placement_registry%ROWTYPE;
  v_ver_rep    JSONB := '{}'::jsonb;
  v_props      JSONB := '[]'::jsonb;
  v_prop_ids   JSONB := '[]'::jsonb;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_raw_input = '' THEN
    RETURN jsonb_build_object('ok', false, 'found', false, 'error', 'batch_id_required');
  END IF;

  SELECT r.*
  INTO v_reg
  FROM public.private_placement_registry r
  WHERE r.batch_id = v_raw_input
     OR UPPER(r.batch_id) = UPPER(v_raw_input)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'found', false,
      'batch_id', v_raw_input
    );
  END IF;

  SELECT COALESCE(pb.verification_report, '{}'::jsonb)
  INTO v_ver_rep
  FROM public.publishing_batches pb
  WHERE pb.id = v_reg.batch_id;

  WITH batch_snaps AS (
    SELECT
      bp.id::text AS snapshot_id,
      bp.property_id,
      bp.pipeline_id,
      bp.source_listing_id,
      COALESCE(NULLIF(trim(bp.source), ''), NULLIF(trim(COALESCE(p.field_provenance->>'source', '')), '')) AS source,
      COALESCE(bp.address, p.address) AS address,
      COALESCE(NULLIF(trim(bp.city), ''), p.city) AS city,
      COALESCE(NULLIF(trim(bp.state), ''), p.state) AS state,
      COALESCE(NULLIF(trim(bp.zip), ''), p.zip) AS zip,
      COALESCE(bp.property_type, p.property_type) AS property_type,
      COALESCE(bp.bedrooms, p.bedrooms) AS bedrooms,
      COALESCE(bp.bathrooms, p.bathrooms) AS bathrooms,
      COALESCE(bp.square_footage, p.square_footage) AS square_footage,
      COALESCE(bp.published_rent, bp.monthly_rent, p.monthly_rent::numeric) AS monthly_rent,
      bp.published_rent,
      COALESCE(bp.published_description, p.description) AS published_description,
      bp.pricing_method,
      bp.validation_status,
      bp.verification_status,
      bp.verified_at,
      bp.visibility,
      bp.photo_count,
      bp.published_status,
      bp.error_message,
      bp.recovery_status,
      p.status::text AS live_property_status,
      CASE
        WHEN bp.property_id IS NOT NULL THEN 'https://choice-properties-site.pages.dev/property.html?id=' || bp.property_id
        ELSE NULL
      END AS property_url,
      bp.created_at
    FROM public.publishing_batch_properties bp
    LEFT JOIN public.properties p ON p.id = bp.property_id
    WHERE bp.batch_id = v_reg.batch_id
  ),
  share_only_props AS (
    SELECT
      NULL::text AS snapshot_id,
      p.id AS property_id,
      NULL::text AS pipeline_id,
      NULL::text AS source_listing_id,
      NULLIF(trim(COALESCE(p.field_provenance->>'source', '')), '') AS source,
      p.address,
      p.city,
      p.state,
      p.zip,
      p.property_type,
      p.bedrooms::numeric AS bedrooms,
      p.bathrooms::numeric AS bathrooms,
      p.square_footage,
      p.monthly_rent::numeric AS monthly_rent,
      p.monthly_rent::numeric AS published_rent,
      p.description AS published_description,
      NULL::text AS pricing_method,
      NULL::text AS validation_status,
      CASE WHEN v_reg.share_verified THEN 'verified'::text ELSE 'pending'::text END AS verification_status,
      v_reg.link_verified_at AS verified_at,
      p.status::text AS visibility,
      (SELECT COUNT(*)::int FROM public.property_photos ph WHERE ph.property_id = p.id) AS photo_count,
      'published'::text AS published_status,
      NULL::text AS error_message,
      'active'::text AS recovery_status,
      p.status::text AS live_property_status,
      'https://choice-properties-site.pages.dev/property.html?id=' || p.id AS property_url,
      p.created_at
    FROM public.property_share_properties psp
    JOIN public.properties p ON p.id = psp.property_id
    WHERE v_reg.share_id IS NOT NULL
      AND psp.share_id = v_reg.share_id
      AND NOT EXISTS (
        SELECT 1 FROM batch_snaps bs WHERE bs.property_id = p.id
      )
  ),
  combined AS (
    SELECT * FROM batch_snaps
    UNION ALL
    SELECT * FROM share_only_props
  )
  SELECT
    COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.created_at ASC NULLS LAST, c.property_id ASC), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(pid ORDER BY pid)
      FROM (
        SELECT DISTINCT property_id AS pid
        FROM combined
        WHERE property_id IS NOT NULL
      ) ids
    ), '[]'::jsonb)
  INTO v_props, v_prop_ids
  FROM combined c;

  RETURN (
    jsonb_build_object(
      'ok', true,
      'found', true,
      'batch_id', v_reg.batch_id,
      'batch_uuid', v_reg.batch_uuid,
      'batch_format', v_reg.batch_format,
      'target_market', v_reg.target_market,
      'workflow_type', v_reg.workflow_type,
      'visibility', v_reg.visibility,
      'batch_status', v_reg.batch_status,
      'status', v_reg.batch_status,
      'total_processed', v_reg.total_processed,
      'published_count', v_reg.published_count,
      'failed_count', v_reg.failed_count,
      'skipped_count', v_reg.skipped_count
    )
    || jsonb_build_object(
      'magic_link_url', v_reg.magic_link_url,
      'share_id', v_reg.share_id,
      'share_token_hash', v_reg.share_token_hash,
      'share_created_at', v_reg.share_created_at,
      'expires_at', v_reg.effective_expires_at,
      'revoked_at', v_reg.live_share_revoked_at,
      'effective_share_status', v_reg.effective_share_status,
      'share_status', v_reg.effective_share_status,
      'days_remaining', v_reg.days_remaining,
      'days_expired', v_reg.days_expired,
      'seconds_remaining', v_reg.seconds_remaining,
      'view_count', v_reg.live_share_view_count,
      'last_viewed_at', v_reg.live_share_last_viewed_at,
      'share_alias', v_reg.share_alias,
      'share_verified', v_reg.share_verified,
      'share_property_count', v_reg.share_property_count,
      'link_verified_at', v_reg.link_verified_at,
      'verification_report', v_ver_rep,
      'replaced_from_share_id', v_reg.replaced_from_share_id,
      'replacement_reason', v_reg.replacement_reason,
      'replaced_by_share_id', v_reg.replaced_by_share_id,
      'revocation_reason', v_reg.revocation_reason
    )
    || jsonb_build_object(
      'pricing_summary', v_reg.pricing_summary,
      'location_summary', v_reg.location_summary,
      'category_summary', v_reg.category_summary,
      'disposable_folder_id', v_reg.disposable_folder_id,
      'folder_exists', v_reg.folder_exists,
      'folder_cleanup_state', v_reg.folder_cleanup_state,
      'folder_deleted_at', v_reg.folder_deleted_at,
      'cleanup_completed', v_reg.cleanup_completed,
      'recovery_status', v_reg.recovery_status,
      'pipeline_deleted_at', v_reg.pipeline_deleted_at,
      'recovery_expires_at', v_reg.recovery_expires_at,
      'permanently_deleted_at', v_reg.permanently_deleted_at,
      'started_at', v_reg.started_at,
      'completed_at', v_reg.completed_at,
      'property_ids', v_prop_ids,
      'properties', v_props
    )
  );
END;
$function$;

-- ── 5. pipeline_publish_batch_candidates ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pipeline_publish_batch_candidates(
  p_batch_id TEXT,
  p_limit    INTEGER DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_batch_id TEXT := regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', '');
  v_batch    public.publishing_batches%ROWTYPE;
  v_limit    INTEGER := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
  v_rows     JSONB := '[]'::jsonb;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_batch_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_required');
  END IF;

  SELECT * INTO v_batch
  FROM public.publishing_batches
  WHERE id = v_batch_id OR UPPER(id) = UPPER(v_batch_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_not_found', 'batch_id', v_batch_id);
  END IF;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(t) ORDER BY t.folder_serial ASC NULLS LAST, t.imported_at ASC NULLS LAST, t.id ASC),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT
      id, status, title, address, unit_number, city, state, zip,
      monthly_rent, original_monthly_rent, bedrooms, bathrooms, half_bathrooms,
      square_footage, property_type, property_subtype,
      description, approved_description, original_description,
      enrichment_status, pricing_status, pricing_method, pricing_meta,
      validation_status, needs_review, review_reason,
      original_image_urls, local_image_paths,
      source, source_listing_id, source_url,
      choice_property_id, batch_id, folder_id, folder_serial, imported_at
    FROM pipeline.pipeline_properties
    WHERE (
      batch_id = v_batch.id
      OR (v_batch.disposable_folder_id IS NOT NULL AND folder_id = v_batch.disposable_folder_id)
    )
      AND COALESCE(status, 'scraped') <> 'archived'
    ORDER BY folder_serial ASC NULLS LAST, imported_at ASC NULLS LAST, id ASC
    LIMIT v_limit
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'batch', jsonb_build_object(
      'id', v_batch.id,
      'batch_uuid', v_batch.batch_uuid,
      'target_market', v_batch.target_market,
      'visibility', v_batch.visibility,
      'workflow_type', v_batch.workflow_type,
      'disposable_folder_id', v_batch.disposable_folder_id,
      'policy_set_id', v_batch.policy_set_id,
      'share_id', v_batch.share_id,
      'magic_link_url', v_batch.magic_link_url,
      'share_token_hash', v_batch.share_token_hash
    ),
    'candidates', v_rows,
    'count', jsonb_array_length(v_rows)
  );
END;
$$;

-- ── 6. pipeline_publish_for_batch (Isolated Per-Property Transaction + Reuse) ─
CREATE OR REPLACE FUNCTION public.pipeline_publish_for_batch(
  p_batch_id    TEXT,
  p_pipeline_id TEXT,
  p_visibility  TEXT DEFAULT NULL,
  p_landlord_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_batch_id       TEXT := regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', '');
  v_batch          public.publishing_batches%ROWTYPE;
  p                pipeline.pipeline_properties%ROWTYPE;
  v_visibility     TEXT;
  v_pub_status     property_status;
  v_prop_id        TEXT;
  v_reused         BOOLEAN := false;
  v_effective_title TEXT;
  v_effective_desc  TEXT;
  v_orig_desc       TEXT;
  v_photos         JSONB;
  v_elem           JSONB;
  v_url            TEXT;
  v_file_id        TEXT;
  v_caption        TEXT;
  v_room_label     TEXT;
  v_source_url     TEXT;
  v_media_type     TEXT;
  v_width          INT;
  v_height         INT;
  v_order          INT := 1;
  v_photo_count    INT := 0;
  v_usable_count   INT := 0;
  v_existing_photos INT := 0;
  v_listed         DATE;
  v_imported_at    TIMESTAMPTZ;
  v_amenities      TEXT[] := NULL;
  v_appliances     TEXT[] := NULL;
  v_utilities      TEXT[] := NULL;
  v_flooring       TEXT[] := NULL;
  v_provenance     JSONB;
  v_snap_id        UUID;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_batch_id = '' OR NULLIF(trim(COALESCE(p_pipeline_id, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_and_pipeline_id_required');
  END IF;

  SELECT * INTO v_batch
  FROM public.publishing_batches
  WHERE id = v_batch_id OR UPPER(id) = UPPER(v_batch_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_not_found');
  END IF;

  SELECT * INTO p
  FROM pipeline.pipeline_properties
  WHERE id = p_pipeline_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pipeline_listing_not_found');
  END IF;

  v_visibility := COALESCE(NULLIF(trim(COALESCE(p_visibility, '')), ''), v_batch.visibility, 'private_placement');
  IF v_visibility NOT IN ('private_placement', 'active') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_visibility');
  END IF;
  v_pub_status := v_visibility::property_status;

  -- Pre-publish eligibility checks
  IF p.status = 'archived' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_archived');
  END IF;

  IF COALESCE(p.needs_review, false) = true OR COALESCE(p.validation_status, '') IN ('needs_review', 'rejected') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'validation_not_passed: ' || COALESCE(NULLIF(p.review_reason, ''), p.validation_status, 'needs_review')
    );
  END IF;

  IF COALESCE(p.pricing_status, '') IN ('held_out_of_range', 'error') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'pricing_not_ready: ' || p.pricing_status
    );
  END IF;

  IF NULLIF(trim(COALESCE(p.address, '')), '') IS NULL
     OR NULLIF(trim(COALESCE(p.city, '')), '') IS NULL
     OR NULLIF(trim(COALESCE(p.state, '')), '') IS NULL
     OR NULLIF(trim(COALESCE(p.zip, '')), '') IS NULL
     OR p.monthly_rent IS NULL OR p.monthly_rent <= 0
     OR p.bedrooms IS NULL
     OR p.bathrooms IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'required_fields_missing');
  END IF;

  -- Extract usable photos (strict original order, minimum 4 usable photos)
  v_photos := NULL;
  IF p.local_image_paths IS NOT NULL AND p.local_image_paths <> '' AND p.local_image_paths <> '[]' THEN
    BEGIN v_photos := p.local_image_paths::jsonb; EXCEPTION WHEN OTHERS THEN v_photos := NULL; END;
  END IF;
  IF v_photos IS NULL OR jsonb_typeof(v_photos) <> 'array' OR jsonb_array_length(v_photos) = 0 THEN
    IF p.original_image_urls IS NOT NULL AND p.original_image_urls <> '' AND p.original_image_urls <> '[]' THEN
      BEGIN v_photos := p.original_image_urls::jsonb; EXCEPTION WHEN OTHERS THEN v_photos := NULL; END;
    END IF;
  END IF;

  IF v_photos IS NULL OR jsonb_typeof(v_photos) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'fewer_than_4_photos');
  END IF;

  SELECT COUNT(*)
  INTO v_usable_count
  FROM jsonb_array_elements(v_photos) AS elem
  WHERE (
    (jsonb_typeof(elem) = 'string' AND length(trim(elem #>> '{}')) > 5)
    OR (jsonb_typeof(elem) = 'object' AND length(trim(COALESCE(elem->>'url', ''))) > 5)
  );

  IF v_usable_count < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'fewer_than_4_photos (found ' || v_usable_count || ')');
  END IF;

  -- Clean standardized address title + approved sanitized description
  v_effective_title := COALESCE(
    NULLIF(btrim(p.title), ''),
    p.address || ', ' || p.city || ', ' || p.state || ' ' || p.zip
  );
  v_effective_desc := public.sanitize_listing_description(
    COALESCE(
      NULLIF(btrim(p.approved_description), ''),
      NULLIF(btrim(p.description), ''),
      v_effective_title
    )
  );
  v_orig_desc := COALESCE(NULLIF(btrim(p.original_description), ''), NULLIF(btrim(p.description), ''), v_effective_desc);

  -- Canonical reuse lookup across sibling batches without mutating sibling snapshots
  IF NULLIF(trim(COALESCE(p.choice_property_id, '')), '') IS NOT NULL THEN
    SELECT pr.id INTO v_prop_id
    FROM public.properties pr
    WHERE pr.id = p.choice_property_id
    LIMIT 1;
  END IF;

  IF v_prop_id IS NULL
     AND NULLIF(trim(COALESCE(p.source, '')), '') IS NOT NULL
     AND NULLIF(trim(COALESCE(p.source_listing_id, '')), '') IS NOT NULL THEN
    SELECT pr.id INTO v_prop_id
    FROM public.properties pr
    WHERE pr.field_provenance->>'source' = p.source
      AND pr.field_provenance->>'source_listing_id' = p.source_listing_id
      AND pr.status::text = v_visibility
    ORDER BY pr.created_at DESC
    LIMIT 1;

    IF v_prop_id IS NULL THEN
      SELECT bp.property_id INTO v_prop_id
      FROM public.publishing_batch_properties bp
      JOIN public.properties pr ON pr.id = bp.property_id
      WHERE bp.source = p.source
        AND bp.source_listing_id = p.source_listing_id
        AND bp.property_id IS NOT NULL
        AND pr.status::text = v_visibility
      ORDER BY bp.created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  IF v_prop_id IS NOT NULL THEN
    v_reused := true;

    SELECT COUNT(*)::int INTO v_existing_photos
    FROM public.property_photos
    WHERE property_id = v_prop_id;

    -- Ensure canonical property satisfies Directive 4 & invariant $50 fee without
    -- overwriting canonical monthly_rent/description used by sibling batches
    UPDATE public.properties
    SET virtual_tour_url = NULL,
        videos           = NULL,
        application_fee  = 50,
        showing_instructions = CASE WHEN v_visibility = 'private_placement' THEN NULL ELSE showing_instructions END
    WHERE id = v_prop_id;

    IF v_existing_photos = 0 THEN
      v_order := 1;
      FOR v_elem IN SELECT * FROM jsonb_array_elements(v_photos)
      LOOP
        v_url := NULL; v_file_id := NULL; v_caption := NULL; v_room_label := NULL;
        v_source_url := NULL; v_media_type := 'photo'; v_width := NULL; v_height := NULL;
        IF jsonb_typeof(v_elem) = 'string' THEN
          v_url := trim(v_elem #>> '{}');
          v_source_url := v_url;
        ELSIF jsonb_typeof(v_elem) = 'object' THEN
          v_url := trim(v_elem->>'url');
          v_file_id := v_elem->>'fileId';
          v_caption := NULLIF(btrim(v_elem->>'caption'), '');
          v_room_label := NULLIF(btrim(v_elem->>'room_label'), '');
          v_source_url := COALESCE(NULLIF(btrim(v_elem->>'source_url'), ''), v_url);
          v_media_type := COALESCE(NULLIF(btrim(v_elem->>'media_type'), ''), 'photo');
          IF v_elem ? 'width' AND jsonb_typeof(v_elem->'width') = 'number' THEN v_width := (v_elem->>'width')::int; END IF;
          IF v_elem ? 'height' AND jsonb_typeof(v_elem->'height') = 'number' THEN v_height := (v_elem->>'height')::int; END IF;
        END IF;
        IF v_url IS NOT NULL AND length(v_url) > 5 THEN
          INSERT INTO public.property_photos (
            id, property_id, url, file_id, width, height,
            display_order, is_hero, watermark_status,
            media_type, caption, room_label, source_url, created_at
          ) VALUES (
            gen_random_uuid(), v_prop_id, v_url, v_file_id, v_width, v_height,
            v_order, (v_order = 1), 'clean',
            v_media_type, v_caption, v_room_label, v_source_url, CURRENT_TIMESTAMP
          );
          v_order := v_order + 1;
          v_photo_count := v_photo_count + 1;
        END IF;
      END LOOP;
    ELSE
      v_photo_count := v_existing_photos;
    END IF;
  ELSE
    -- Insert fresh canonical public.properties row
    BEGIN
      v_listed := p.listed_at;
    EXCEPTION WHEN OTHERS THEN
      v_listed := NULL;
    END;

    IF p.amenities IS NOT NULL AND p.amenities <> '' AND p.amenities <> '[]' THEN
      BEGIN
        SELECT array_agg(elem::text) INTO v_amenities
        FROM jsonb_array_elements_text(p.amenities::jsonb) AS elem
        WHERE elem IS NOT NULL AND elem <> '';
      EXCEPTION WHEN OTHERS THEN v_amenities := NULL; END;
    END IF;

    IF p.appliances IS NOT NULL AND p.appliances <> '' AND p.appliances <> '[]' THEN
      BEGIN
        SELECT array_agg(elem::text) INTO v_appliances
        FROM jsonb_array_elements_text(p.appliances::jsonb) AS elem
        WHERE elem IS NOT NULL AND elem <> '';
      EXCEPTION WHEN OTHERS THEN v_appliances := NULL; END;
    END IF;

    IF p.utilities_included IS NOT NULL AND p.utilities_included <> '' AND p.utilities_included <> '[]' THEN
      BEGIN
        SELECT array_agg(elem::text) INTO v_utilities
        FROM jsonb_array_elements_text(p.utilities_included::jsonb) AS elem
        WHERE elem IS NOT NULL AND elem <> '';
      EXCEPTION WHEN OTHERS THEN v_utilities := NULL; END;
    END IF;

    IF p.flooring IS NOT NULL AND p.flooring <> '' AND p.flooring <> '[]' THEN
      BEGIN
        SELECT array_agg(elem::text) INTO v_flooring
        FROM jsonb_array_elements_text(p.flooring::jsonb) AS elem
        WHERE elem IS NOT NULL AND elem <> '';
      EXCEPTION WHEN OTHERS THEN v_flooring := NULL; END;
    END IF;

    v_imported_at := COALESCE(p.imported_at, p.scraped_at, now());
    v_prop_id := 'prop_' || substr(md5(random()::text || clock_timestamp()::text || p.id), 1, 12);

    v_provenance := COALESCE(p.field_provenance, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'source', p.source,
      'source_listing_id', p.source_listing_id,
      'source_url', p.source_url,
      'batch_id', v_batch.id
    ));

    INSERT INTO public.properties (
      id, landlord_id, status, batch_id,
      title, description, original_description, showing_instructions,
      address, city, state, zip, county, neighborhood,
      lat, lng,
      property_type, property_subtype, year_built, floors,
      unit_number, total_units,
      bedrooms, bathrooms, half_bathrooms, total_bathrooms, square_footage,
      lot_size_sqft, garage_spaces,
      monthly_rent, security_deposit, last_months_rent,
      application_fee, pet_deposit, admin_fee, move_in_special,
      hoa_fee, hoa_fee_frequency, tax_annual_amount, tax_value,
      available_date, lease_terms, minimum_lease_months,
      pets_allowed, pet_details, pet_weight_limit,
      smoking_allowed,
      parking, parking_fee, ev_charging,
      amenities, appliances, utilities_included, flooring,
      heating_type, cooling_type, laundry_type,
      location_context, virtual_tour_url,
      has_basement, has_central_air,
      listed_at, source_last_updated_at, imported_at, source_status, last_verified_at,
      original_data, source_raw_payload, field_provenance,
      structural_details, utility_details, financial_details, location_details,
      floor_plans, videos
    ) VALUES (
      v_prop_id,
      COALESCE(p_landlord_id, CASE WHEN NULLIF(trim(COALESCE(p.poster_landlord_id, '')), '') ~* '^[0-9a-f-]{36}$' THEN p.poster_landlord_id::uuid ELSE NULL END),
      v_pub_status,
      v_batch.id,
      v_effective_title,
      v_effective_desc,
      v_orig_desc,
      CASE WHEN v_visibility = 'private_placement' THEN NULL ELSE p.showing_instructions END,
      p.address, p.city, p.state, p.zip, p.county, p.neighborhood,
      p.lat, p.lng,
      p.property_type, p.property_subtype, p.year_built, p.floors,
      p.unit_number, p.total_units,
      p.bedrooms, p.bathrooms, p.half_bathrooms, COALESCE(p.total_bathrooms, p.bathrooms), p.square_footage,
      p.lot_size_sqft, p.garage_spaces,
      p.monthly_rent,
      p.monthly_rent,
      p.last_months_rent,
      50,
      NULL, p.admin_fee, p.move_in_special,
      p.hoa_fee, p.hoa_fee_frequency, p.tax_annual_amount, p.tax_value,
      NULL, NULL, NULL,
      NULL, NULL, NULL,
      NULL,
      p.parking, p.parking_fee, p.ev_charging,
      v_amenities, v_appliances, v_utilities, v_flooring,
      p.heating_type, p.cooling_type, p.laundry_type,
      p.location_context,
      NULL, -- Directive 4: DISABLE_TOUR_AND_VIDEO_LINKS_ON_PUBLISH = true
      p.has_basement, p.has_central_air,
      v_listed, p.source_last_updated_at, v_imported_at, COALESCE(p.source_status, 'available'), p.last_verified_at,
      pipeline.safe_parse_jsonb(p.original_data::text),
      p.source_raw_payload,
      v_provenance,
      p.structural_details, p.utility_details, p.financial_details, p.location_details,
      p.floor_plans,
      NULL  -- Directive 4: DISABLE_TOUR_AND_VIDEO_LINKS_ON_PUBLISH = true
    );

    v_order := 1;
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_photos)
    LOOP
      v_url := NULL; v_file_id := NULL; v_caption := NULL; v_room_label := NULL;
      v_source_url := NULL; v_media_type := 'photo'; v_width := NULL; v_height := NULL;
      IF jsonb_typeof(v_elem) = 'string' THEN
        v_url := trim(v_elem #>> '{}');
        v_source_url := v_url;
      ELSIF jsonb_typeof(v_elem) = 'object' THEN
        v_url := trim(v_elem->>'url');
        v_file_id := v_elem->>'fileId';
        v_caption := NULLIF(btrim(v_elem->>'caption'), '');
        v_room_label := NULLIF(btrim(v_elem->>'room_label'), '');
        v_source_url := COALESCE(NULLIF(btrim(v_elem->>'source_url'), ''), v_url);
        v_media_type := COALESCE(NULLIF(btrim(v_elem->>'media_type'), ''), 'photo');
        IF v_elem ? 'width' AND jsonb_typeof(v_elem->'width') = 'number' THEN v_width := (v_elem->>'width')::int; END IF;
        IF v_elem ? 'height' AND jsonb_typeof(v_elem->'height') = 'number' THEN v_height := (v_elem->>'height')::int; END IF;
      END IF;
      IF v_url IS NOT NULL AND length(v_url) > 5 THEN
        INSERT INTO public.property_photos (
          id, property_id, url, file_id, width, height,
          display_order, is_hero, watermark_status,
          media_type, caption, room_label, source_url, created_at
        ) VALUES (
          gen_random_uuid(), v_prop_id, v_url, v_file_id, v_width, v_height,
          v_order, (v_order = 1), 'clean',
          v_media_type, v_caption, v_room_label, v_source_url, CURRENT_TIMESTAMP
        );
        v_order := v_order + 1;
        v_photo_count := v_photo_count + 1;
      END IF;
    END LOOP;

    IF v_photo_count < 4 THEN
      DELETE FROM public.properties WHERE id = v_prop_id;
      RETURN jsonb_build_object('ok', false, 'error', 'fewer_than_4_photos_inserted');
    END IF;
  END IF;

  -- Upsert batch-scoped snapshot (isolated pricing & copy per batch)
  SELECT bp.id INTO v_snap_id
  FROM public.publishing_batch_properties bp
  WHERE bp.batch_id = v_batch.id
    AND bp.pipeline_id = p.id
  LIMIT 1;

  IF v_snap_id IS NOT NULL THEN
    UPDATE public.publishing_batch_properties
    SET batch_uuid            = v_batch.batch_uuid,
        property_id           = v_prop_id,
        source_listing_id     = p.source_listing_id,
        source                = p.source,
        address               = p.address,
        city                  = p.city,
        state                 = p.state,
        zip                   = p.zip,
        property_type         = p.property_type,
        bedrooms              = p.bedrooms,
        bathrooms             = p.bathrooms,
        square_footage        = p.square_footage,
        monthly_rent          = p.monthly_rent,
        published_rent        = p.monthly_rent,
        published_description = v_effective_desc,
        pricing_method        = p.pricing_method,
        pricing_meta          = COALESCE(p.pricing_meta, '{}'::jsonb),
        validation_status     = COALESCE(p.validation_status, 'passed'),
        visibility            = v_visibility,
        photo_count           = v_photo_count,
        published_status      = 'published',
        verification_status   = 'pending',
        error_message         = NULL
    WHERE id = v_snap_id;
  ELSE
    INSERT INTO public.publishing_batch_properties (
      batch_id, batch_uuid, property_id, pipeline_id,
      source_listing_id, source, address, city, state, zip,
      property_type, bedrooms, bathrooms, square_footage,
      monthly_rent, published_rent, published_description,
      pricing_method, pricing_meta, validation_status,
      visibility, photo_count, published_status, verification_status
    ) VALUES (
      v_batch.id, v_batch.batch_uuid, v_prop_id, p.id,
      p.source_listing_id, p.source, p.address, p.city, p.state, p.zip,
      p.property_type, p.bedrooms, p.bathrooms, p.square_footage,
      p.monthly_rent, p.monthly_rent, v_effective_desc,
      p.pricing_method, COALESCE(p.pricing_meta, '{}'::jsonb), COALESCE(p.validation_status, 'passed'),
      v_visibility, v_photo_count, 'published', 'pending'
    );
  END IF;

  -- Mark pipeline record published
  UPDATE pipeline.pipeline_properties
  SET status             = 'published',
      choice_property_id = v_prop_id,
      batch_id           = COALESCE(batch_id, v_batch.id),
      batch_uuid         = COALESCE(batch_uuid, v_batch.batch_uuid),
      imported_at        = COALESCE(imported_at, now()),
      published_at       = now()::text,
      updated_at         = now()
  WHERE id = p.id;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch.id,
    'pipeline_id', p.id,
    'property_id', v_prop_id,
    'reused_canonical', v_reused,
    'visibility', v_visibility,
    'published_rent', p.monthly_rent,
    'photo_count', v_photo_count
  );
END;
$$;

-- ── 7. pipeline_record_publish_failure ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pipeline_record_publish_failure(
  p_batch_id    TEXT,
  p_pipeline_id TEXT,
  p_error       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_batch_id TEXT := regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', '');
  v_batch    public.publishing_batches%ROWTYPE;
  p          pipeline.pipeline_properties%ROWTYPE;
  v_snap_id  UUID;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  SELECT * INTO v_batch
  FROM public.publishing_batches
  WHERE id = v_batch_id OR UPPER(id) = UPPER(v_batch_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_not_found');
  END IF;

  SELECT * INTO p
  FROM pipeline.pipeline_properties
  WHERE id = p_pipeline_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pipeline_listing_not_found');
  END IF;

  SELECT bp.id INTO v_snap_id
  FROM public.publishing_batch_properties bp
  WHERE bp.batch_id = v_batch.id
    AND bp.pipeline_id = p.id
  LIMIT 1;

  IF v_snap_id IS NOT NULL THEN
    UPDATE public.publishing_batch_properties
    SET published_status    = 'failed',
        verification_status = 'failed',
        error_message       = left(COALESCE(p_error, 'publish_failed'), 1000)
    WHERE id = v_snap_id;
  ELSE
    INSERT INTO public.publishing_batch_properties (
      batch_id, batch_uuid, property_id, pipeline_id,
      source_listing_id, source, address, city, state, zip,
      property_type, bedrooms, bathrooms, square_footage,
      monthly_rent, published_rent, published_description,
      pricing_method, pricing_meta, validation_status,
      visibility, photo_count, published_status, verification_status, error_message
    ) VALUES (
      v_batch.id, v_batch.batch_uuid, p.choice_property_id, p.id,
      p.source_listing_id, p.source,
      COALESCE(p.address, '(unknown)'),
      COALESCE(p.city, 'Unknown'),
      COALESCE(p.state, 'NA'),
      COALESCE(p.zip, '00000'),
      p.property_type, p.bedrooms, p.bathrooms, p.square_footage,
      p.monthly_rent, p.monthly_rent, p.description,
      p.pricing_method, COALESCE(p.pricing_meta, '{}'::jsonb), p.validation_status,
      COALESCE(v_batch.visibility, 'private_placement'), 0,
      'failed', 'failed', left(COALESCE(p_error, 'publish_failed'), 1000)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch.id,
    'pipeline_id', p.id,
    'published_status', 'failed'
  );
END;
$$;

-- ── 8. pipeline_finalize_batch_publish ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pipeline_finalize_batch_publish(
  p_batch_id             TEXT,
  p_share_id             UUID DEFAULT NULL,
  p_magic_link_url       TEXT DEFAULT NULL,
  p_share_token_hash     TEXT DEFAULT NULL,
  p_share_expires_at     TIMESTAMPTZ DEFAULT NULL,
  p_share_property_count INTEGER DEFAULT 0,
  p_published_count      INTEGER DEFAULT 0,
  p_failed_count         INTEGER DEFAULT 0,
  p_skipped_count        INTEGER DEFAULT 0,
  p_errors               JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_batch_id TEXT := regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', '');
  v_batch    public.publishing_batches%ROWTYPE;
  v_status   TEXT;
  v_total    INTEGER;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  SELECT * INTO v_batch
  FROM public.publishing_batches
  WHERE id = v_batch_id OR UPPER(id) = UPPER(v_batch_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_not_found');
  END IF;

  v_total := GREATEST(0, COALESCE(p_published_count, 0))
           + GREATEST(0, COALESCE(p_failed_count, 0))
           + GREATEST(0, COALESCE(p_skipped_count, 0));

  IF COALESCE(p_published_count, 0) > 0 AND COALESCE(p_failed_count, 0) = 0 THEN
    v_status := 'completed';
  ELSIF COALESCE(p_published_count, 0) > 0 AND COALESCE(p_failed_count, 0) > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'failed';
  END IF;

  UPDATE public.publishing_batches
  SET status               = v_status,
      total_processed      = v_total,
      published_count      = GREATEST(0, COALESCE(p_published_count, 0)),
      failed_count         = GREATEST(0, COALESCE(p_failed_count, 0)),
      skipped_count        = GREATEST(0, COALESCE(p_skipped_count, 0)),
      share_id             = COALESCE(p_share_id, share_id),
      magic_link_url       = COALESCE(p_magic_link_url, magic_link_url),
      share_token_hash     = COALESCE(p_share_token_hash, share_token_hash),
      share_created_at     = CASE WHEN p_share_id IS NOT NULL THEN COALESCE(share_created_at, now()) ELSE share_created_at END,
      share_expires_at     = COALESCE(p_share_expires_at, share_expires_at),
      share_property_count = COALESCE(p_share_property_count, share_property_count),
      share_verified       = false,
      link_verified_at     = NULL,
      publishing_succeeded = (COALESCE(p_published_count, 0) > 0),
      magic_link_succeeded = (COALESCE(p_share_id, share_id) IS NOT NULL),
      images_synchronized  = (COALESCE(p_published_count, 0) > 0),
      errors               = COALESCE(p_errors, '[]'::jsonb),
      execution_summary    = format('Published %s, Failed %s, Skipped %s', COALESCE(p_published_count, 0), COALESCE(p_failed_count, 0), COALESCE(p_skipped_count, 0)),
      completed_at         = now()
  WHERE id = v_batch.id;

  PERFORM public.compute_batch_registry_summaries(v_batch.id);

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch.id,
    'status', v_status,
    'published_count', p_published_count,
    'failed_count', p_failed_count,
    'skipped_count', p_skipped_count,
    'share_id', COALESCE(p_share_id, v_batch.share_id),
    'magic_link_url', COALESCE(p_magic_link_url, v_batch.magic_link_url)
  );
END;
$$;

-- ── 9. pipeline_record_batch_verification ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pipeline_record_batch_verification(
  p_batch_id            TEXT,
  p_passed              BOOLEAN,
  p_verification_report JSONB DEFAULT '{}'::jsonb,
  p_property_results    JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_batch_id TEXT := regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', '');
  v_batch    public.publishing_batches%ROWTYPE;
  v_item     JSONB;
  v_pid      TEXT;
  v_passed   BOOLEAN;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  SELECT * INTO v_batch
  FROM public.publishing_batches
  WHERE id = v_batch_id OR UPPER(id) = UPPER(v_batch_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_not_found');
  END IF;

  IF p_property_results IS NOT NULL AND jsonb_typeof(p_property_results) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_property_results)
    LOOP
      v_pid := NULLIF(trim(COALESCE(v_item->>'property_id', '')), '');
      v_passed := COALESCE((v_item->>'ok')::boolean, false);
      IF v_pid IS NOT NULL THEN
        UPDATE public.publishing_batch_properties
        SET verification_status = CASE WHEN v_passed THEN 'verified' ELSE 'failed' END,
            verification_report = COALESCE(v_item, '{}'::jsonb),
            verified_at         = CASE WHEN v_passed THEN now() ELSE NULL END
        WHERE batch_id = v_batch.id
          AND property_id = v_pid;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.publishing_batches
  SET share_verified      = COALESCE(p_passed, false),
      link_verified_at    = CASE WHEN COALESCE(p_passed, false) THEN now() ELSE NULL END,
      verification_report = COALESCE(p_verification_report, '{}'::jsonb)
  WHERE id = v_batch.id;

  RETURN public.registry_get_batch(v_batch.id);
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_publish_batch_candidates(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_publish_batch_candidates(TEXT, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pipeline_publish_for_batch(TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_publish_for_batch(TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pipeline_record_publish_failure(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_record_publish_failure(TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pipeline_finalize_batch_publish(TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_finalize_batch_publish(TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, INTEGER, JSONB) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pipeline_record_batch_verification(TEXT, BOOLEAN, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_record_batch_verification(TEXT, BOOLEAN, JSONB, JSONB) TO authenticated, service_role;
