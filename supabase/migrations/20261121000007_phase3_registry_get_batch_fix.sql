-- ============================================================================
-- Phase 3 Patch: Fix property source/status projection in registry_get_batch
-- ============================================================================
-- public.properties stores source inside field_provenance->>'source' rather than
-- a top-level source column, and status uses a custom enum type that must be
-- cast to TEXT when unioned with publishing_batch_properties.visibility.
-- ============================================================================

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
      COALESCE(NULLIF(trim(bp.source), ''), NULLIF(trim(COALESCE(p.field_provenance->>'source', '')), '')) AS source,
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
      p.status::text AS visibility,
      (SELECT COUNT(*)::int FROM public.property_photos ph WHERE ph.property_id = p.id) AS photo_count,
      'published'::text AS published_status,
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

REVOKE ALL ON FUNCTION public.registry_get_batch(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registry_get_batch(TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
