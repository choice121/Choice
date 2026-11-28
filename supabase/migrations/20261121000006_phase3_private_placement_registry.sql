-- ============================================================================
-- Phase 3: Permanent Private-Placement Registry & Batch Link Retrieval
-- ============================================================================
-- 1. Extends public.publishing_batches with permanent summary & link tracking:
--      pricing_summary, location_summary, category_summary,
--      link_verified_at, replaced_from_share_id, replacement_reason
--    and extends public.property_shares with replaced_by_share_id &
--    revocation_reason for auditable link replacement.
-- 2. Backfills pricing_summary, location_summary, and category_summary for all
--    18 existing legacy PB-* batches and installs an automatic refresh trigger
--    on public.publishing_batch_properties.
-- 3. Creates public.private_placement_registry view joining
--    publishing_batches + property_shares + (LEFT JOIN) pipeline_folders,
--    computing real-time effective_share_status ('active' | 'expired' |
--    'revoked' | 'not_generated'), expiration timers, view counts, and folder
--    cleanup state — completely independent of disposable folder deletion.
-- 4. Exposes single-signature RPCs public.registry_get_batch(p_batch_id text)
--    and public.registry_list_batches(...) restricted strictly to verified
--    admins & service_role, returning stored magic_link_url & metadata without
--    ever inspecting pipeline_folders or mutating/minting tokens on read.
-- ============================================================================

-- ── 1. Schema Extensions on public.publishing_batches & public.property_shares ─
ALTER TABLE public.publishing_batches
  ADD COLUMN IF NOT EXISTS pricing_summary        JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS location_summary       JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS category_summary       JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS link_verified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replaced_from_share_id UUID REFERENCES public.property_shares(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replacement_reason     TEXT;

CREATE INDEX IF NOT EXISTS idx_publishing_batches_share_id
  ON public.publishing_batches (share_id)
  WHERE share_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_publishing_batches_replaced_from
  ON public.publishing_batches (replaced_from_share_id)
  WHERE replaced_from_share_id IS NOT NULL;

ALTER TABLE public.property_shares
  ADD COLUMN IF NOT EXISTS replaced_by_share_id UUID REFERENCES public.property_shares(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revocation_reason    TEXT;

-- ── 2. Batch Registry Summary Computation & Trigger ─────────────────────────
CREATE OR REPLACE FUNCTION public.compute_batch_registry_summaries(p_batch_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
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

  -- Gather counts & pricing metrics from batch property snapshots (with canonical property fallback)
  WITH scoped AS (
    SELECT
      bp.id,
      bp.property_id,
      bp.published_status,
      COALESCE(bp.monthly_rent, pr.monthly_rent) AS eff_rent,
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
$$;

CREATE OR REPLACE FUNCTION public.refresh_batch_registry_summaries_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.batch_id IS NOT NULL THEN
      PERFORM public.compute_batch_registry_summaries(OLD.batch_id);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.batch_id IS NOT NULL THEN
      PERFORM public.compute_batch_registry_summaries(NEW.batch_id);
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.batch_id IS NOT NULL AND OLD.batch_id IS DISTINCT FROM NEW.batch_id THEN
      PERFORM public.compute_batch_registry_summaries(OLD.batch_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_pub_batch_props_refresh_summaries ON public.publishing_batch_properties;
CREATE TRIGGER trg_pub_batch_props_refresh_summaries
  AFTER INSERT OR UPDATE OR DELETE ON public.publishing_batch_properties
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_batch_registry_summaries_trigger();

-- Backfill existing legacy PB-* batches cleanly without altering legacy IDs or timestamps
UPDATE public.publishing_batches
SET link_verified_at = COALESCE(link_verified_at, completed_at, share_created_at)
WHERE share_verified = true
  AND link_verified_at IS NULL;

DO $$
DECLARE
  v_bid TEXT;
BEGIN
  FOR v_bid IN SELECT id FROM public.publishing_batches LOOP
    PERFORM public.compute_batch_registry_summaries(v_bid);
  END LOOP;
END $$;

-- ── 3. Permanent Private-Placement Registry View ────────────────────────────
-- Retains complete batch, share link, real-time expiry/revocation, pricing,
-- location, category, and cleanup metadata independently of pipeline_folders.
CREATE OR REPLACE VIEW public.private_placement_registry AS
SELECT
  pb.id AS batch_id,
  pb.batch_uuid,
  pb.batch_format,
  pb.target_market,
  pb.workflow_type,
  pb.visibility,
  pb.status AS batch_status,
  pb.total_processed,
  pb.published_count,
  pb.failed_count,
  pb.skipped_count,
  pb.share_id,
  pb.magic_link_url,
  pb.share_token_hash,
  pb.share_created_at,
  pb.share_expires_at,
  pb.share_verified,
  pb.share_property_count,
  pb.link_verified_at,
  pb.replaced_from_share_id,
  pb.replacement_reason,
  ps.expires_at AS live_share_expires_at,
  ps.revoked_at AS live_share_revoked_at,
  COALESCE(ps.view_count, 0) AS live_share_view_count,
  ps.last_viewed_at AS live_share_last_viewed_at,
  ps.share_alias,
  ps.replaced_by_share_id,
  ps.revocation_reason,
  COALESCE(ps.expires_at, pb.share_expires_at) AS effective_expires_at,
  CASE
    WHEN pb.magic_link_url IS NULL AND pb.share_id IS NULL THEN 'not_generated'
    WHEN ps.revoked_at IS NOT NULL THEN 'revoked'
    WHEN pb.share_id IS NOT NULL AND ps.id IS NULL THEN 'revoked'
    WHEN pb.magic_link_url IS NOT NULL AND pb.share_id IS NULL THEN 'revoked'
    WHEN COALESCE(ps.expires_at, pb.share_expires_at) IS NOT NULL
         AND COALESCE(ps.expires_at, pb.share_expires_at) <= now() THEN 'expired'
    ELSE 'active'
  END AS effective_share_status,
  CASE
    WHEN COALESCE(ps.expires_at, pb.share_expires_at) IS NULL THEN NULL
    ELSE GREATEST(
      0,
      EXTRACT(EPOCH FROM (COALESCE(ps.expires_at, pb.share_expires_at) - now()))
    )::bigint
  END AS seconds_remaining,
  CASE
    WHEN COALESCE(ps.expires_at, pb.share_expires_at) IS NULL THEN NULL
    WHEN COALESCE(ps.expires_at, pb.share_expires_at) > now()
      THEN CEIL(EXTRACT(EPOCH FROM (COALESCE(ps.expires_at, pb.share_expires_at) - now())) / 86400.0)::integer
    ELSE 0
  END AS days_remaining,
  CASE
    WHEN COALESCE(ps.expires_at, pb.share_expires_at) IS NULL
      OR COALESCE(ps.expires_at, pb.share_expires_at) > now() THEN 0
    ELSE FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(ps.expires_at, pb.share_expires_at))) / 86400.0)::integer
  END AS days_expired,
  pb.pricing_summary,
  pb.location_summary,
  pb.category_summary,
  pb.task_config,
  pb.enrichment_succeeded,
  pb.images_synchronized,
  pb.publishing_succeeded,
  pb.magic_link_succeeded,
  pb.cleanup_completed,
  pb.cleanup_details,
  pb.recovery_status,
  pb.pipeline_deleted_at,
  pb.recovery_expires_at,
  pb.restored_at,
  pb.restoration_reason,
  pb.permanently_deleted_at,
  pb.disposable_folder_id,
  (pf.id IS NOT NULL AND pf.cleanup_state <> 'deleted') AS folder_exists,
  CASE
    WHEN pf.id IS NOT NULL THEN pf.cleanup_state
    WHEN pb.disposable_folder_id IS NOT NULL OR pb.cleanup_completed THEN 'deleted'
    ELSE 'none'
  END AS folder_cleanup_state,
  pf.deleted_at AS folder_deleted_at,
  pb.started_at,
  pb.completed_at
FROM public.publishing_batches pb
LEFT JOIN public.property_shares ps
  ON ps.id = pb.share_id
LEFT JOIN pipeline.pipeline_folders pf
  ON pf.id = pb.disposable_folder_id;

REVOKE ALL ON TABLE public.private_placement_registry FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.private_placement_registry TO service_role;

-- ── 4. Single-Signature Admin Retrieval RPCs ────────────────────────────────
CREATE OR REPLACE FUNCTION public.registry_get_batch(p_batch_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_raw_input  TEXT := regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', '');
  v_reg        public.private_placement_registry%ROWTYPE;
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

  -- Build unified property list from permanent batch snapshots + any linked share properties
  WITH batch_snaps AS (
    SELECT
      bp.id::text AS snapshot_id,
      bp.property_id,
      bp.pipeline_id,
      bp.source_listing_id,
      bp.source,
      COALESCE(bp.address, p.address) AS address,
      COALESCE(NULLIF(trim(bp.city), ''), p.city) AS city,
      COALESCE(NULLIF(trim(bp.state), ''), p.state) AS state,
      COALESCE(NULLIF(trim(bp.zip), ''), p.zip) AS zip,
      COALESCE(bp.property_type, p.property_type) AS property_type,
      COALESCE(bp.bedrooms, p.bedrooms) AS bedrooms,
      COALESCE(bp.bathrooms, p.bathrooms) AS bathrooms,
      COALESCE(bp.square_footage, p.square_footage) AS square_footage,
      COALESCE(bp.monthly_rent, p.monthly_rent) AS monthly_rent,
      bp.visibility,
      bp.photo_count,
      bp.published_status,
      bp.recovery_status,
      p.status AS live_property_status,
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
      p.source,
      p.address,
      p.city,
      p.state,
      p.zip,
      p.property_type,
      p.bedrooms,
      p.bathrooms,
      p.square_footage,
      p.monthly_rent,
      p.status AS visibility,
      (SELECT COUNT(*)::int FROM public.property_photos ph WHERE ph.property_id = p.id) AS photo_count,
      'published'::text AS published_status,
      'active'::text AS recovery_status,
      p.status AS live_property_status,
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

  RETURN jsonb_build_object(
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
    'skipped_count', v_reg.skipped_count,
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
    'replaced_from_share_id', v_reg.replaced_from_share_id,
    'replacement_reason', v_reg.replacement_reason,
    'replaced_by_share_id', v_reg.replaced_by_share_id,
    'revocation_reason', v_reg.revocation_reason,
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
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.registry_list_batches(
  p_limit        INTEGER DEFAULT 50,
  p_share_status TEXT DEFAULT NULL,
  p_batch_format TEXT DEFAULT NULL,
  p_search       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_limit   INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_status  TEXT := NULLIF(trim(COALESCE(p_share_status, '')), '');
  v_format  TEXT := NULLIF(trim(COALESCE(p_batch_format, '')), '');
  v_search  TEXT := NULLIF(regexp_replace(trim(COALESCE(p_search, '')), '^#', ''), '');
  v_batches JSONB := '[]'::jsonb;
  v_total   INTEGER := 0;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  SELECT COUNT(*)
  INTO v_total
  FROM public.private_placement_registry r
  WHERE (v_status IS NULL OR r.effective_share_status = v_status)
    AND (v_format IS NULL OR r.batch_format = v_format)
    AND (
      v_search IS NULL
      OR r.batch_id ILIKE '%' || v_search || '%'
      OR r.target_market ILIKE '%' || v_search || '%'
    );

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_batches
  FROM (
    SELECT
      r.batch_id,
      r.batch_uuid,
      r.batch_format,
      r.target_market,
      r.workflow_type,
      r.visibility,
      r.batch_status,
      r.published_count,
      r.failed_count,
      r.skipped_count,
      r.magic_link_url,
      r.share_id,
      r.share_created_at,
      r.effective_expires_at AS expires_at,
      r.live_share_revoked_at AS revoked_at,
      r.effective_share_status,
      r.days_remaining,
      r.days_expired,
      r.live_share_view_count AS view_count,
      r.share_verified,
      r.link_verified_at,
      r.replaced_from_share_id,
      r.replacement_reason,
      r.pricing_summary,
      r.location_summary,
      r.category_summary,
      r.folder_exists,
      r.folder_cleanup_state,
      r.recovery_status,
      r.started_at,
      r.completed_at
    FROM public.private_placement_registry r
    WHERE (v_status IS NULL OR r.effective_share_status = v_status)
      AND (v_format IS NULL OR r.batch_format = v_format)
      AND (
        v_search IS NULL
        OR r.batch_id ILIKE '%' || v_search || '%'
        OR r.target_market ILIKE '%' || v_search || '%'
      )
    ORDER BY r.started_at DESC
    LIMIT v_limit
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'total', v_total,
    'count', jsonb_array_length(v_batches),
    'batches', v_batches,
    'namespace_stats', public.batch_namespace_stats()
  );
END;
$$;

-- ── 5. Strict Least-Privilege Grants ────────────────────────────────────────
REVOKE ALL ON FUNCTION public.compute_batch_registry_summaries(TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.compute_batch_registry_summaries(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.registry_get_batch(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registry_get_batch(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.registry_list_batches(INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registry_list_batches(INTEGER, TEXT, TEXT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
