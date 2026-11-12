-- ============================================================================
-- Choice Properties — Publishing Activity History & 24-Hour Pipeline Recovery
-- ============================================================================
-- Implements:
--   1. public.publishing_batches (lightweight batch audit + recovery lifecycle)
--   2. public.publishing_batch_properties (lightweight property outcome snapshot)
--   3. pipeline.pipeline_recovery_archive (protected 24h recovery staging)
--   4. Transactional RPCs for Stage 1 archival, explicit batch restoration,
--      Stage 2 permanent purge (>24h), and admin history/recovery queries.
--   5. Row Level Security restricting private placement & recovery data to
--      service_role and verified admin_roles only.
-- ============================================================================

-- ── 1. Publishing Batches Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.publishing_batches (
  id                       TEXT PRIMARY KEY, -- Format: PB-YYYYMMDD-XXXX
  target_market            TEXT NOT NULL,
  workflow_type            TEXT NOT NULL CHECK (workflow_type IN ('pipeline_publish', 'scrape_and_publish')),
  visibility               TEXT NOT NULL CHECK (visibility IN ('private_placement', 'active')),
  status                   TEXT NOT NULL DEFAULT 'in_progress'
                             CHECK (status IN ('in_progress', 'completed', 'partial', 'failed')),
  total_processed          INTEGER NOT NULL DEFAULT 0,
  published_count          INTEGER NOT NULL DEFAULT 0,
  failed_count             INTEGER NOT NULL DEFAULT 0,
  skipped_count            INTEGER NOT NULL DEFAULT 0,

  -- Client Access / Magic Link Audit (no raw token stored separately if public;
  -- restricted by RLS to service_role + verified admins only)
  share_id                 UUID REFERENCES public.property_shares(id) ON DELETE SET NULL,
  magic_link_url           TEXT,
  share_token_hash         TEXT,
  share_created_at         TIMESTAMPTZ,
  share_expires_at         TIMESTAMPTZ,
  share_verified           BOOLEAN NOT NULL DEFAULT FALSE,
  share_property_count     INTEGER NOT NULL DEFAULT 0,

  -- Execution Flags & Summary
  enrichment_succeeded     BOOLEAN NOT NULL DEFAULT FALSE,
  images_synchronized      BOOLEAN NOT NULL DEFAULT FALSE,
  publishing_succeeded     BOOLEAN NOT NULL DEFAULT FALSE,
  magic_link_succeeded     BOOLEAN NOT NULL DEFAULT FALSE,
  cleanup_completed        BOOLEAN NOT NULL DEFAULT FALSE,
  cleanup_details          JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_summary        TEXT,
  errors                   JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- 24-Hour Pipeline Recovery & Controlled Permanent Deletion Tracking
  pipeline_deleted_at      TIMESTAMPTZ,
  recovery_expires_at      TIMESTAMPTZ,
  recovery_status          TEXT NOT NULL DEFAULT 'active'
                             CHECK (recovery_status IN (
                               'active',
                               'recoverable',
                               'restored',
                               'partially_restored',
                               'expired',
                               'permanently_deleted'
                             )),
  restored_at              TIMESTAMPTZ,
  restoration_reason       TEXT,
  republished_at           TIMESTAMPTZ,
  republished_batch_id     TEXT,
  permanently_deleted_at   TIMESTAMPTZ,
  permanent_deletion_error TEXT,

  started_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at             TIMESTAMPTZ
);

-- ── 2. Lightweight Batch Property Snapshots ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.publishing_batch_properties (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                 TEXT NOT NULL REFERENCES public.publishing_batches(id) ON DELETE CASCADE,
  property_id              TEXT REFERENCES public.properties(id) ON DELETE SET NULL,
  pipeline_id              TEXT,
  source_listing_id        TEXT,
  source                   TEXT,
  address                  TEXT NOT NULL,
  city                     TEXT NOT NULL,
  state                    TEXT NOT NULL,
  zip                      TEXT NOT NULL,
  property_type            TEXT,
  bedrooms                 NUMERIC,
  bathrooms                NUMERIC,
  square_footage           INTEGER,
  monthly_rent             NUMERIC,
  visibility               TEXT NOT NULL DEFAULT 'private_placement'
                             CHECK (visibility IN ('private_placement', 'active')),
  photo_count              INTEGER NOT NULL DEFAULT 0,
  published_status         TEXT NOT NULL DEFAULT 'published'
                             CHECK (published_status IN ('published', 'skipped', 'failed')),

  -- Per-property 24-hour recovery & restoration audit
  recovery_status          TEXT NOT NULL DEFAULT 'active'
                             CHECK (recovery_status IN (
                               'active',
                               'recoverable',
                               'restored',
                               'expired',
                               'permanently_deleted'
                             )),
  deleted_from_pipeline_at TIMESTAMPTZ,
  recovery_expires_at      TIMESTAMPTZ,
  restored_at              TIMESTAMPTZ,
  permanently_deleted_at   TIMESTAMPTZ,
  error_message            TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Protected 24-Hour Pipeline Recovery Archive ──────────────────────────
-- Physically isolated from pipeline.pipeline_properties so ordinary pipeline
-- queries, scrapers, and publishing runs NEVER see deleted/archived rows.
CREATE TABLE IF NOT EXISTS pipeline.pipeline_recovery_archive (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                 TEXT NOT NULL REFERENCES public.publishing_batches(id) ON DELETE CASCADE,
  pipeline_id              TEXT NOT NULL,
  source                   TEXT,
  source_listing_id        TEXT,
  target_market            TEXT NOT NULL,
  address                  TEXT NOT NULL,
  city                     TEXT,
  state                    TEXT,
  zip                      TEXT,
  published_property_id    TEXT,
  original_status          TEXT,
  -- Full pipeline.pipeline_properties JSONB snapshot (nulled out after 24h permanent purge)
  pipeline_row_snapshot    JSONB,
  -- Associated Supabase Storage object paths in pipeline-raw-payloads bucket
  raw_storage_paths        JSONB NOT NULL DEFAULT '[]'::jsonb,
  recovery_status          TEXT NOT NULL DEFAULT 'recoverable'
                             CHECK (recovery_status IN (
                               'recoverable',
                               'restoring',
                               'restored',
                               'expired',
                               'permanently_deleted'
                             )),
  deleted_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  recovery_expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  restored_at              TIMESTAMPTZ,
  restoration_reason       TEXT,
  permanently_deleted_at   TIMESTAMPTZ,
  permanent_deletion_error TEXT,
  UNIQUE (batch_id, pipeline_id)
);

-- ── 4. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pub_batches_market
  ON public.publishing_batches (target_market);
CREATE INDEX IF NOT EXISTS idx_pub_batches_started
  ON public.publishing_batches (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pub_batches_recovery
  ON public.publishing_batches (recovery_status, recovery_expires_at);

CREATE INDEX IF NOT EXISTS idx_pub_batch_props_batch
  ON public.publishing_batch_properties (batch_id);
CREATE INDEX IF NOT EXISTS idx_pub_batch_props_address
  ON public.publishing_batch_properties (address);
CREATE INDEX IF NOT EXISTS idx_pub_batch_props_city_state
  ON public.publishing_batch_properties (city, state);
CREATE INDEX IF NOT EXISTS idx_pub_batch_props_pipeline_id
  ON public.publishing_batch_properties (pipeline_id);

CREATE INDEX IF NOT EXISTS idx_recovery_archive_batch
  ON pipeline.pipeline_recovery_archive (batch_id);
CREATE INDEX IF NOT EXISTS idx_recovery_archive_status_exp
  ON pipeline.pipeline_recovery_archive (recovery_status, recovery_expires_at);
CREATE INDEX IF NOT EXISTS idx_recovery_archive_pipeline_id
  ON pipeline.pipeline_recovery_archive (pipeline_id);

-- ── 5. Row Level Security ───────────────────────────────────────────────────
ALTER TABLE public.publishing_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishing_batch_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline.pipeline_recovery_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on publishing_batches" ON public.publishing_batches;
CREATE POLICY "Service role full access on publishing_batches"
  ON public.publishing_batches FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view publishing batches" ON public.publishing_batches;
CREATE POLICY "Admins can view publishing batches"
  ON public.publishing_batches FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role full access on publishing_batch_properties" ON public.publishing_batch_properties;
CREATE POLICY "Service role full access on publishing_batch_properties"
  ON public.publishing_batch_properties FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view publishing batch properties" ON public.publishing_batch_properties;
CREATE POLICY "Admins can view publishing batch properties"
  ON public.publishing_batch_properties FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role full access on pipeline_recovery_archive" ON pipeline.pipeline_recovery_archive;
CREATE POLICY "Service role full access on pipeline_recovery_archive"
  ON pipeline.pipeline_recovery_archive FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── 6. Stage 1: Atomic Archive & Remove from Active Pipeline ────────────────
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

-- ── 7. Explicit Batch Restoration (Never Automatic) ─────────────────────────
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

-- ── 8. Stage 2: Atomic Claim & Finalize Permanent Purge (>24h) ──────────────
CREATE OR REPLACE FUNCTION public.pipeline_claim_expired_recovery(
  p_limit INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_now   TIMESTAMPTZ := now();
  v_items JSONB := '[]'::jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  -- Mark any newly expired items as 'expired' first (skipping rows actively being restored)
  UPDATE pipeline.pipeline_recovery_archive
  SET recovery_status = 'expired'
  WHERE id IN (
    SELECT id
    FROM pipeline.pipeline_recovery_archive
    WHERE recovery_status = 'recoverable'
      AND recovery_expires_at <= v_now
    FOR UPDATE SKIP LOCKED
  );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'batch_id', batch_id,
    'pipeline_id', pipeline_id,
    'raw_storage_paths', raw_storage_paths,
    'recovery_expires_at', recovery_expires_at
  )), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT id, batch_id, pipeline_id, raw_storage_paths, recovery_expires_at
    FROM pipeline.pipeline_recovery_archive
    WHERE recovery_status = 'expired'
      AND recovery_expires_at <= v_now
    ORDER BY recovery_expires_at ASC
    LIMIT p_limit
  ) sub;

  RETURN jsonb_build_object('ok', true, 'items', v_items, 'checked_at', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_finalize_permanent_purge(
  p_archive_ids UUID[],
  p_errors      JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_now         TIMESTAMPTZ := now();
  v_id          UUID;
  v_err         TEXT;
  v_purged_cnt  INTEGER := 0;
  v_err_cnt     INTEGER := 0;
  v_batch_ids   TEXT[];
  v_bid         TEXT;
  v_left        INTEGER;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF p_archive_ids IS NULL OR array_length(p_archive_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'purged', 0, 'errors', 0);
  END IF;

  SELECT array_agg(DISTINCT batch_id)
  INTO v_batch_ids
  FROM pipeline.pipeline_recovery_archive
  WHERE id = ANY(p_archive_ids);

  FOREACH v_id IN ARRAY p_archive_ids LOOP
    v_err := p_errors ->> v_id::text;
    IF v_err IS NOT NULL AND length(trim(v_err)) > 0 THEN
      UPDATE pipeline.pipeline_recovery_archive
      SET permanent_deletion_error = v_err,
          recovery_status          = 'expired'
      WHERE id = v_id AND recovery_status IN ('recoverable', 'expired');
      v_err_cnt := v_err_cnt + 1;
    ELSE
      -- Permanently wipe the heavy pipeline JSONB snapshot while keeping lightweight audit
      UPDATE pipeline.pipeline_recovery_archive
      SET pipeline_row_snapshot    = NULL,
          raw_storage_paths        = '[]'::jsonb,
          recovery_status          = 'permanently_deleted',
          permanently_deleted_at   = v_now,
          permanent_deletion_error = NULL
      WHERE id = v_id
        AND recovery_status IN ('recoverable', 'expired')
        AND recovery_expires_at <= v_now;

      UPDATE public.publishing_batch_properties bp
      SET recovery_status        = 'permanently_deleted',
          permanently_deleted_at = v_now
      FROM pipeline.pipeline_recovery_archive a
      WHERE a.id = v_id
        AND bp.batch_id = a.batch_id
        AND bp.pipeline_id = a.pipeline_id
        AND a.recovery_status = 'permanently_deleted';

      v_purged_cnt := v_purged_cnt + 1;
    END IF;
  END LOOP;

  IF v_batch_ids IS NOT NULL THEN
    FOREACH v_bid IN ARRAY v_batch_ids LOOP
      SELECT count(*)
      INTO v_left
      FROM pipeline.pipeline_recovery_archive
      WHERE batch_id = v_bid
        AND recovery_status IN ('recoverable', 'expired', 'restoring');

      IF v_left = 0 THEN
        UPDATE public.publishing_batches
        SET recovery_status        = 'permanently_deleted',
            permanently_deleted_at = v_now,
            permanent_deletion_error = NULL
        WHERE id = v_bid
          AND recovery_status IN ('recoverable', 'expired', 'partially_restored');
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'purged', v_purged_cnt,
    'errors', v_err_cnt,
    'purged_at', v_now
  );
END;
$$;

-- ── 9. Admin Read RPCs for Publishing History & 24h Recovery UI ─────────────
CREATE OR REPLACE FUNCTION public.pipeline_get_publishing_history(
  p_limit    INTEGER DEFAULT 25,
  p_market   TEXT DEFAULT NULL,
  p_batch_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_batches JSONB := '[]'::jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_batches
  FROM (
    SELECT
      b.*,
      ps.expires_at AS live_share_expires_at,
      ps.revoked_at AS live_share_revoked_at,
      ps.view_count AS live_share_view_count,
      COALESCE(
        (SELECT jsonb_agg(row_to_json(bp) ORDER BY bp.created_at ASC)
         FROM public.publishing_batch_properties bp
         WHERE bp.batch_id = b.id),
        '[]'::jsonb
      ) AS properties
    FROM public.publishing_batches b
    LEFT JOIN public.property_shares ps ON ps.id = b.share_id
    WHERE (p_market IS NULL OR b.target_market ILIKE '%' || p_market || '%')
      AND (p_batch_id IS NULL OR b.id = p_batch_id)
    ORDER BY b.started_at DESC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object('ok', true, 'batches', v_batches);
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
        'recovery_expires_at', a.recovery_expires_at
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

-- ── 10. Permissions ─────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.pipeline_archive_and_remove(TEXT, TEXT[], JSONB, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pipeline_archive_and_remove(TEXT, TEXT[], JSONB, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pipeline_restore_batch(TEXT, TEXT[], TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pipeline_restore_batch(TEXT, TEXT[], TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pipeline_claim_expired_recovery(INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pipeline_claim_expired_recovery(INTEGER) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pipeline_finalize_permanent_purge(UUID[], JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pipeline_finalize_permanent_purge(UUID[], JSONB) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pipeline_get_publishing_history(INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pipeline_get_publishing_history(INTEGER, TEXT, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pipeline_get_recoverable_batches() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pipeline_get_recoverable_batches() TO authenticated, service_role;

-- ── 11. Optional pg_cron Safety Net (Marks expired rows hourly) ─────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'mark-expired-pipeline-recovery',
      '15 * * * *',
      $cron$
        UPDATE pipeline.pipeline_recovery_archive
        SET recovery_status = 'expired'
        WHERE recovery_status = 'recoverable'
          AND recovery_expires_at <= now();

        UPDATE public.publishing_batches
        SET recovery_status = 'expired'
        WHERE recovery_status = 'recoverable'
          AND recovery_expires_at <= now();
      $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron may not be enabled in all Supabase tiers; Edge Function cron handles purge
  NULL;
END $$;
