-- ============================================================================
-- Phase 2: Four-Digit Batch Identities, Disposable Folders & Legacy Compatibility
-- ============================================================================
-- 1. Preserves all 18 existing PB-* rows in public.publishing_batches with
--    batch_format = 'legacy_pb'.
-- 2. Adds internal batch_uuid UUID keys, batch_format ('legacy_pb' | 'four_digit'),
--    strict 4-digit format constraint (^[0-9]{4}$), and task_config metadata.
-- 3. Links pipeline.pipeline_folders 1:1 with disposable batch workspaces
--    (batch_id, batch_uuid, is_disposable_batch, cleanup_state, deleted_at).
-- 4. Replaces global pipeline_properties_source_listing_id_key with scoped
--    intra-batch uniqueness: (COALESCE(batch_id,'__manual_inbox__'),
--    COALESCE(source,'zillow'), source_listing_id) so the same ZPID can be
--    staged in independent concurrent batches while still blocking intra-batch
--    duplicates.
-- 5. Provides atomic batch_create, batch_lookup, batch_list, and
--    batch_namespace_stats RPCs plus updated folder/staging RPCs and triggers.
-- ============================================================================

-- ── 1. public.publishing_batches Extensions ─────────────────────────────────
ALTER TABLE public.publishing_batches
  ADD COLUMN IF NOT EXISTS batch_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS batch_format TEXT NOT NULL DEFAULT 'legacy_pb',
  ADD COLUMN IF NOT EXISTS task_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS disposable_folder_id UUID;

UPDATE public.publishing_batches
SET batch_uuid = COALESCE(batch_uuid, gen_random_uuid()),
    batch_format = CASE
      WHEN id ~ '^[0-9]{4}$' THEN 'four_digit'
      ELSE 'legacy_pb'
    END
WHERE batch_uuid IS NULL
   OR batch_format IS DISTINCT FROM (
     CASE WHEN id ~ '^[0-9]{4}$' THEN 'four_digit' ELSE 'legacy_pb' END
   );

CREATE UNIQUE INDEX IF NOT EXISTS idx_publishing_batches_batch_uuid
  ON public.publishing_batches(batch_uuid);

CREATE INDEX IF NOT EXISTS idx_publishing_batches_format
  ON public.publishing_batches(batch_format, started_at DESC);

ALTER TABLE public.publishing_batches
  DROP CONSTRAINT IF EXISTS publishing_batches_batch_format_check;

ALTER TABLE public.publishing_batches
  ADD CONSTRAINT publishing_batches_batch_format_check
  CHECK (batch_format IN ('legacy_pb', 'four_digit'));

ALTER TABLE public.publishing_batches
  DROP CONSTRAINT IF EXISTS publishing_batches_four_digit_id_check;

ALTER TABLE public.publishing_batches
  ADD CONSTRAINT publishing_batches_four_digit_id_check
  CHECK (batch_format = 'legacy_pb' OR id ~ '^[0-9]{4}$');

CREATE OR REPLACE FUNCTION public.sync_publishing_batch_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.batch_uuid := COALESCE(NEW.batch_uuid, gen_random_uuid());
  IF NEW.id ~ '^[0-9]{4}$' THEN
    NEW.batch_format := 'four_digit';
  ELSIF NEW.batch_format IS NULL OR NEW.batch_format = '' THEN
    NEW.batch_format := 'legacy_pb';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_publishing_batches_defaults ON public.publishing_batches;
CREATE TRIGGER trg_publishing_batches_defaults
  BEFORE INSERT ON public.publishing_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_publishing_batch_defaults();

-- ── 2. public.publishing_batch_properties Batch UUID Linkage ───────────────
ALTER TABLE public.publishing_batch_properties
  ADD COLUMN IF NOT EXISTS batch_uuid UUID;

UPDATE public.publishing_batch_properties pbp
SET batch_uuid = pb.batch_uuid
FROM public.publishing_batches pb
WHERE pb.id = pbp.batch_id
  AND (pbp.batch_uuid IS DISTINCT FROM pb.batch_uuid);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'publishing_batch_properties_batch_uuid_fkey'
  ) THEN
    ALTER TABLE public.publishing_batch_properties
      ADD CONSTRAINT publishing_batch_properties_batch_uuid_fkey
      FOREIGN KEY (batch_uuid)
      REFERENCES public.publishing_batches(batch_uuid)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pub_batch_props_batch_uuid
  ON public.publishing_batch_properties(batch_uuid);

CREATE OR REPLACE FUNCTION public.sync_pub_batch_prop_uuid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL AND NEW.batch_uuid IS NULL THEN
    SELECT batch_uuid INTO NEW.batch_uuid
    FROM public.publishing_batches
    WHERE id = NEW.batch_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pub_batch_props_sync_uuid ON public.publishing_batch_properties;
CREATE TRIGGER trg_pub_batch_props_sync_uuid
  BEFORE INSERT OR UPDATE OF batch_id ON public.publishing_batch_properties
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pub_batch_prop_uuid();

-- ── 3. pipeline.pipeline_folders Disposable Batch Columns ───────────────────
ALTER TABLE pipeline.pipeline_folders
  ADD COLUMN IF NOT EXISTS batch_id TEXT,
  ADD COLUMN IF NOT EXISTS batch_uuid UUID,
  ADD COLUMN IF NOT EXISTS is_disposable_batch BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cleanup_state TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE pipeline.pipeline_folders
  DROP CONSTRAINT IF EXISTS pipeline_folders_cleanup_state_check;

ALTER TABLE pipeline.pipeline_folders
  ADD CONSTRAINT pipeline_folders_cleanup_state_check
  CHECK (cleanup_state IN ('open', 'cleaning', 'eligible_for_delete', 'deleted'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_folders_batch_id_fkey'
  ) THEN
    ALTER TABLE pipeline.pipeline_folders
      ADD CONSTRAINT pipeline_folders_batch_id_fkey
      FOREIGN KEY (batch_id) REFERENCES public.publishing_batches(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_folders_batch_uuid_fkey'
  ) THEN
    ALTER TABLE pipeline.pipeline_folders
      ADD CONSTRAINT pipeline_folders_batch_uuid_fkey
      FOREIGN KEY (batch_uuid) REFERENCES public.publishing_batches(batch_uuid) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'publishing_batches_disposable_folder_id_fkey'
  ) THEN
    ALTER TABLE public.publishing_batches
      ADD CONSTRAINT publishing_batches_disposable_folder_id_fkey
      FOREIGN KEY (disposable_folder_id) REFERENCES pipeline.pipeline_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_folders_disposable_batch_id
  ON pipeline.pipeline_folders(batch_id)
  WHERE batch_id IS NOT NULL AND is_disposable_batch = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_folders_disposable_batch_uuid
  ON pipeline.pipeline_folders(batch_uuid)
  WHERE batch_uuid IS NOT NULL AND is_disposable_batch = true;

-- ── 4. pipeline.pipeline_properties Batch UUID & Intra-Batch Dedup Index ───
ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS batch_uuid UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_properties_batch_uuid_fkey'
  ) THEN
    ALTER TABLE pipeline.pipeline_properties
      ADD CONSTRAINT pipeline_properties_batch_uuid_fkey
      FOREIGN KEY (batch_uuid) REFERENCES public.publishing_batches(batch_uuid) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE pipeline.pipeline_properties pp
SET batch_uuid = pb.batch_uuid
FROM public.publishing_batches pb
WHERE pp.batch_id = pb.id
  AND pp.batch_uuid IS DISTINCT FROM pb.batch_uuid;

ALTER TABLE pipeline.pipeline_properties
  DROP CONSTRAINT IF EXISTS pipeline_properties_source_listing_id_key;

DROP INDEX IF EXISTS pipeline.pipeline_properties_source_listing_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_batch_source_listing
  ON pipeline.pipeline_properties (
    COALESCE(batch_id, '__manual_inbox__'),
    COALESCE(source, 'zillow'),
    source_listing_id
  )
  WHERE source_listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_properties_batch_id
  ON pipeline.pipeline_properties(batch_id)
  WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_properties_batch_uuid
  ON pipeline.pipeline_properties(batch_uuid)
  WHERE batch_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_properties_source_lookup
  ON pipeline.pipeline_properties(source, source_listing_id);

CREATE OR REPLACE FUNCTION pipeline.sync_pipeline_property_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_folder_batch_id text;
  v_folder_batch_uuid uuid;
  v_folder_disposable boolean;
BEGIN
  IF NEW.folder_id IS NOT NULL THEN
    SELECT batch_id, batch_uuid, is_disposable_batch
    INTO v_folder_batch_id, v_folder_batch_uuid, v_folder_disposable
    FROM pipeline.pipeline_folders
    WHERE id = NEW.folder_id;

    IF FOUND AND (v_folder_disposable OR v_folder_batch_id IS NOT NULL) THEN
      NEW.batch_id := v_folder_batch_id;
      NEW.batch_uuid := v_folder_batch_uuid;
    END IF;
  END IF;

  IF NEW.batch_id IS NOT NULL AND NEW.batch_uuid IS NULL THEN
    SELECT batch_uuid INTO NEW.batch_uuid
    FROM public.publishing_batches
    WHERE id = NEW.batch_id;
  ELSIF NEW.batch_id IS NULL THEN
    NEW.batch_uuid := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_properties_sync_batch ON pipeline.pipeline_properties;
CREATE TRIGGER trg_pipeline_properties_sync_batch
  BEFORE INSERT OR UPDATE OF folder_id, batch_id ON pipeline.pipeline_properties
  FOR EACH ROW
  EXECUTE FUNCTION pipeline.sync_pipeline_property_batch();

-- ── 5. Batch Creation, Namespace & Lookup RPCs ─────────────────────────────
CREATE OR REPLACE FUNCTION public.batch_namespace_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_used_four_digit int;
  v_legacy_pb int;
BEGIN
  SELECT COUNT(*) INTO v_used_four_digit
  FROM (
    SELECT id AS batch_code FROM public.publishing_batches WHERE id ~ '^[0-9]{4}$'
    UNION
    SELECT batch_id AS batch_code FROM pipeline.pipeline_recovery_archive WHERE batch_id ~ '^[0-9]{4}$'
    UNION
    SELECT batch_id AS batch_code FROM pipeline.pipeline_folders WHERE batch_id ~ '^[0-9]{4}$'
  ) used_codes;

  SELECT COUNT(*) INTO v_legacy_pb
  FROM public.publishing_batches
  WHERE batch_format = 'legacy_pb' OR id !~ '^[0-9]{4}$';

  RETURN jsonb_build_object(
    'total_four_digit_capacity', 10000,
    'used_four_digit_count', v_used_four_digit,
    'remaining_four_digit_count', GREATEST(0, 10000 - v_used_four_digit),
    'utilization_pct', ROUND((v_used_four_digit::numeric / 10000.0) * 100.0, 2),
    'warning_threshold', 8500,
    'warning_triggered', v_used_four_digit >= 8500,
    'legacy_pb_count', v_legacy_pb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.batch_create(
  p_batch_id text,
  p_target_market text DEFAULT 'Unspecified',
  p_workflow_type text DEFAULT 'scrape_and_publish',
  p_visibility text DEFAULT 'private_placement',
  p_task_config jsonb DEFAULT '{}'::jsonb,
  p_description text DEFAULT NULL,
  p_color text DEFAULT '#6366f1',
  p_icon text DEFAULT '📦'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_batch_id text := trim(COALESCE(p_batch_id, ''));
  v_market text := COALESCE(NULLIF(trim(COALESCE(p_target_market, '')), ''), 'Unspecified');
  v_workflow text := COALESCE(NULLIF(trim(COALESCE(p_workflow_type, '')), ''), 'scrape_and_publish');
  v_visibility text := COALESCE(NULLIF(trim(COALESCE(p_visibility, '')), ''), 'private_placement');
  v_batch_uuid uuid;
  v_folder_id uuid;
  v_desc text;
  v_conflict_batches boolean := false;
  v_conflict_folders boolean := false;
  v_conflict_archive boolean := false;
BEGIN
  IF v_batch_id !~ '^[0-9]{4}$' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_batch_id_format',
      'message', 'Batch ID must be an exact 4-digit numeric code (0000-9999).'
    );
  END IF;

  IF v_workflow NOT IN ('pipeline_publish', 'scrape_and_publish') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_workflow_type',
      'message', 'workflow_type must be scrape_and_publish or pipeline_publish.'
    );
  END IF;

  IF v_visibility NOT IN ('private_placement', 'active') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_visibility',
      'message', 'visibility must be private_placement or active.'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('choice_batch_create_' || v_batch_id));

  SELECT EXISTS(SELECT 1 FROM public.publishing_batches WHERE id = v_batch_id) INTO v_conflict_batches;
  SELECT EXISTS(SELECT 1 FROM pipeline.pipeline_folders WHERE batch_id = v_batch_id OR name = v_batch_id) INTO v_conflict_folders;
  SELECT EXISTS(SELECT 1 FROM pipeline.pipeline_recovery_archive WHERE batch_id = v_batch_id) INTO v_conflict_archive;

  IF v_conflict_batches OR v_conflict_folders OR v_conflict_archive THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'batch_id_already_used',
      'batch_id', v_batch_id,
      'message', 'Batch #' || v_batch_id || ' has already been used. Choose a fresh unused 4-digit Batch ID.',
      'conflict_sources', jsonb_build_object(
        'publishing_batches', v_conflict_batches,
        'pipeline_folders', v_conflict_folders,
        'recovery_archive', v_conflict_archive
      )
    );
  END IF;

  v_batch_uuid := gen_random_uuid();
  v_desc := COALESCE(NULLIF(trim(COALESCE(p_description, '')), ''), 'Batch #' || v_batch_id || ' — ' || v_market);

  INSERT INTO public.publishing_batches (
    id, batch_uuid, batch_format, target_market, workflow_type, visibility, status, task_config
  ) VALUES (
    v_batch_id,
    v_batch_uuid,
    'four_digit',
    v_market,
    v_workflow,
    v_visibility,
    'in_progress',
    COALESCE(p_task_config, '{}'::jsonb)
  );

  INSERT INTO pipeline.pipeline_folders (
    name, description, color, icon, batch_id, batch_uuid, is_disposable_batch, cleanup_state
  ) VALUES (
    v_batch_id,
    v_desc,
    COALESCE(NULLIF(trim(COALESCE(p_color, '')), ''), '#6366f1'),
    COALESCE(NULLIF(trim(COALESCE(p_icon, '')), ''), '📦'),
    v_batch_id,
    v_batch_uuid,
    true,
    'open'
  )
  RETURNING id INTO v_folder_id;

  UPDATE public.publishing_batches
  SET disposable_folder_id = v_folder_id
  WHERE id = v_batch_id;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'batch_uuid', v_batch_uuid,
    'batch_format', 'four_digit',
    'folder_id', v_folder_id,
    'folder_name', v_batch_id,
    'target_market', v_market,
    'workflow_type', v_workflow,
    'visibility', v_visibility,
    'is_disposable_batch', true,
    'namespace_stats', public.batch_namespace_stats()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.batch_lookup(p_batch_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_batch_id text := trim(COALESCE(p_batch_id, ''));
  v_batch public.publishing_batches%ROWTYPE;
  v_folder record;
  v_staging_count int := 0;
BEGIN
  IF v_batch_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'found', false, 'error', 'batch_id is required');
  END IF;

  SELECT * INTO v_batch
  FROM public.publishing_batches
  WHERE id = v_batch_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'found', false, 'batch_id', v_batch_id);
  END IF;

  SELECT id, name, description, color, icon, is_disposable_batch, cleanup_state
  INTO v_folder
  FROM pipeline.pipeline_folders
  WHERE batch_id = v_batch_id
  LIMIT 1;

  SELECT COUNT(*) INTO v_staging_count
  FROM pipeline.pipeline_properties
  WHERE batch_id = v_batch_id;

  RETURN jsonb_build_object(
    'ok', true,
    'found', true,
    'batch_id', v_batch.id,
    'batch_uuid', v_batch.batch_uuid,
    'batch_format', v_batch.batch_format,
    'target_market', v_batch.target_market,
    'workflow_type', v_batch.workflow_type,
    'visibility', v_batch.visibility,
    'status', v_batch.status,
    'task_config', v_batch.task_config,
    'disposable_folder_id', COALESCE(v_folder.id, v_batch.disposable_folder_id),
    'folder', CASE
      WHEN v_folder.id IS NOT NULL THEN jsonb_build_object(
        'id', v_folder.id,
        'name', v_folder.name,
        'description', v_folder.description,
        'color', v_folder.color,
        'icon', v_folder.icon,
        'is_disposable_batch', v_folder.is_disposable_batch,
        'cleanup_state', v_folder.cleanup_state
      )
      ELSE NULL
    END,
    'staging_property_count', v_staging_count,
    'published_count', v_batch.published_count,
    'magic_link_url', v_batch.magic_link_url,
    'share_expires_at', v_batch.share_expires_at,
    'recovery_status', v_batch.recovery_status,
    'started_at', v_batch.started_at,
    'completed_at', v_batch.completed_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.batch_list(
  p_limit int DEFAULT 50,
  p_batch_format text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      pb.id AS batch_id,
      pb.batch_uuid,
      pb.batch_format,
      pb.target_market,
      pb.workflow_type,
      pb.visibility,
      pb.status,
      pb.total_processed,
      pb.published_count,
      pb.failed_count,
      pb.skipped_count,
      pb.disposable_folder_id,
      pf.name AS folder_name,
      pf.cleanup_state AS folder_cleanup_state,
      pb.magic_link_url,
      pb.share_expires_at,
      pb.recovery_status,
      pb.started_at,
      pb.completed_at,
      (SELECT COUNT(*) FROM pipeline.pipeline_properties pp WHERE pp.batch_id = pb.id) AS staging_count
    FROM public.publishing_batches pb
    LEFT JOIN pipeline.pipeline_folders pf ON pf.id = pb.disposable_folder_id
    WHERE (p_batch_format IS NULL OR p_batch_format = '' OR pb.batch_format = p_batch_format)
    ORDER BY pb.started_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  ) t;

  RETURN v_rows;
END;
$$;

-- ── 6. Updated Folder & Staging RPCs ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pipeline_folder_create(
  p_name text,
  p_description text DEFAULT NULL::text,
  p_color text DEFAULT '#6366f1'::text,
  p_icon text DEFAULT '📁'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_id uuid;
  v_trimmed text;
BEGIN
  p_name := initcap(trim(regexp_replace(COALESCE(p_name, ''), '\s+', ' ', 'g')));
  v_trimmed := trim(p_name);
  IF v_trimmed = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Folder name is required');
  END IF;

  SELECT id INTO v_id
  FROM pipeline.pipeline_folders
  WHERE name = p_name AND cleanup_state <> 'deleted';
  IF FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Folder already exists', 'id', v_id);
  END IF;

  -- Prevent silently reusing a 4-digit Batch ID via generic folder creation
  IF v_trimmed ~ '^[0-9]{4}$' AND (
    EXISTS (SELECT 1 FROM public.publishing_batches WHERE id = v_trimmed)
    OR EXISTS (SELECT 1 FROM pipeline.pipeline_recovery_archive WHERE batch_id = v_trimmed)
  ) THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'batch_id_already_used',
      'message', 'Batch #' || v_trimmed || ' has already been used. Use + New Batch with a fresh 4-digit ID.'
    );
  END IF;

  INSERT INTO pipeline.pipeline_folders (name, description, color, icon)
  VALUES (p_name, p_description, COALESCE(p_color, '#6366f1'), COALESCE(p_icon, '📁'))
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'id', v_id, 'name', p_name, 'color', p_color, 'icon', p_icon);
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_folder_create(
  p_name text,
  p_description text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
BEGIN
  RETURN public.pipeline_folder_create(p_name, p_description, '#6366f1', '📁');
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_folder_list()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      f.id, f.name, f.description, f.created_at, f.updated_at,
      f.color, f.icon, f.batch_id, f.batch_uuid, f.is_disposable_batch, f.cleanup_state,
      COUNT(p.id) AS property_count,
      COUNT(p.id) FILTER (WHERE p.status = 'published') AS published_count,
      COUNT(p.id) FILTER (WHERE p.status = 'archived') AS archived_count
    FROM pipeline.pipeline_folders f
    LEFT JOIN pipeline.pipeline_properties p ON p.folder_id = f.id
    WHERE f.cleanup_state <> 'deleted'
    GROUP BY f.id, f.name, f.description, f.created_at, f.updated_at,
             f.color, f.icon, f.batch_id, f.batch_uuid, f.is_disposable_batch, f.cleanup_state
    ORDER BY f.is_disposable_batch DESC, f.created_at DESC
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_folder_properties(p_folder_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      id, status, title, address, city, state, zip,
      bedrooms, bathrooms, square_footage, monthly_rent,
      property_type, year_built, unit_number,
      description, original_description, showing_instructions,
      pets_allowed, smoking_allowed, parking,
      minimum_lease_months, security_deposit, application_fee,
      garage_spaces, available_date, virtual_tour_url,
      has_basement, has_central_air,
      data_quality_score, missing_fields, edited_fields,
      original_image_urls, source_url, source, source_listing_id, agent_name,
      poster_landlord_id, choice_property_id, batch_id, batch_uuid,
      scraped_at, updated_at, published_at, imported_at,
      neighborhood, county, location_context,
      folder_id, folder_serial,
      photo_import_status, photo_upload_status
    FROM pipeline.pipeline_properties
    WHERE folder_id = p_folder_id
    ORDER BY folder_serial ASC
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_folder_add_property(
  p_property_id text,
  p_folder_name text DEFAULT NULL::text,
  p_folder_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_folder_id uuid;
  v_target_batch_id text;
  v_target_batch_uuid uuid;
  v_target_disposable boolean := false;
  v_prev_disposable boolean := false;
  v_serial int;
  v_exists boolean;
BEGIN
  IF p_folder_id IS NULL AND p_folder_name IS NOT NULL THEN
    SELECT id, batch_id, batch_uuid, is_disposable_batch
    INTO v_folder_id, v_target_batch_id, v_target_batch_uuid, v_target_disposable
    FROM pipeline.pipeline_folders
    WHERE name = initcap(trim(regexp_replace(p_folder_name, '\s+', ' ', 'g')))
      AND cleanup_state <> 'deleted';
    IF NOT FOUND THEN
      RETURN json_build_object('ok', false, 'error', 'Folder not found: ' || p_folder_name);
    END IF;
  ELSIF p_folder_id IS NOT NULL THEN
    SELECT id, batch_id, batch_uuid, is_disposable_batch
    INTO v_folder_id, v_target_batch_id, v_target_batch_uuid, v_target_disposable
    FROM pipeline.pipeline_folders
    WHERE id = p_folder_id AND cleanup_state <> 'deleted';
    IF NOT FOUND THEN
      RETURN json_build_object('ok', false, 'error', 'Folder not found');
    END IF;
  ELSE
    RETURN json_build_object('ok', false, 'error', 'Either folder_name or folder_id is required');
  END IF;

  SELECT EXISTS(SELECT 1 FROM pipeline.pipeline_properties WHERE id = p_property_id)
  INTO v_exists;
  IF NOT v_exists THEN
    RETURN json_build_object('ok', false, 'error', 'Property not found');
  END IF;

  SELECT COALESCE(pf.is_disposable_batch, false)
  INTO v_prev_disposable
  FROM pipeline.pipeline_properties pp
  LEFT JOIN pipeline.pipeline_folders pf ON pf.id = pp.folder_id
  WHERE pp.id = p_property_id;

  SELECT COALESCE(MAX(folder_serial), 0) + 1
  INTO v_serial
  FROM pipeline.pipeline_properties
  WHERE folder_id = v_folder_id;

  BEGIN
    UPDATE pipeline.pipeline_properties
    SET folder_id = v_folder_id,
        folder_serial = v_serial,
        batch_id = CASE
          WHEN v_target_disposable OR v_target_batch_id IS NOT NULL THEN v_target_batch_id
          WHEN v_prev_disposable THEN NULL
          ELSE batch_id
        END,
        batch_uuid = CASE
          WHEN v_target_disposable OR v_target_batch_id IS NOT NULL THEN v_target_batch_uuid
          WHEN v_prev_disposable THEN NULL
          ELSE batch_uuid
        END,
        updated_at = now()
    WHERE id = p_property_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'duplicate_in_batch',
      'message', 'This listing is already staged in the target batch/inbox.'
    );
  END;

  RETURN json_build_object(
    'ok', true,
    'folder_id', v_folder_id,
    'batch_id', v_target_batch_id,
    'serial', v_serial
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_list(
  p_status text DEFAULT 'scraped'::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      id, status, title, address, unit_number, city, state, zip,
      bedrooms, bathrooms, half_bathrooms, total_bathrooms,
      square_footage, lot_size_sqft, floors, garage_spaces, total_units,
      monthly_rent, security_deposit, last_months_rent,
      application_fee, pet_deposit, admin_fee, parking_fee,
      hoa_fee, hoa_fee_frequency, tax_annual_amount, tax_value, move_in_special,
      property_type, property_subtype, year_built,
      description, original_description, showing_instructions,
      pets_allowed, pet_types_allowed, pet_weight_limit, pet_details,
      smoking_allowed, available_date, minimum_lease_months, lease_terms,
      parking, amenities, appliances, utilities_included, flooring,
      heating_type, cooling_type, laundry_type, ev_charging,
      virtual_tour_url, has_basement, has_central_air,
      data_quality_score, missing_fields, edited_fields,
      original_image_urls, local_image_paths,
      source_url, source, source_listing_id, agent_name, broker_name,
      poster_landlord_id, choice_property_id, batch_id, batch_uuid,
      folder_id, folder_serial,
      scraped_at, updated_at, published_at,
      neighborhood, county, location_context,
      listed_at, source_last_updated_at, imported_at, source_status, last_verified_at,
      lat, lng,
      original_data, source_raw_payload, field_provenance,
      structural_details, utility_details, financial_details, location_details,
      floor_plans, videos
    FROM pipeline.pipeline_properties
    WHERE (p_status = 'all' OR status = p_status)
    ORDER BY COALESCE(imported_at, scraped_at::timestamptz) DESC NULLS LAST, id DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_stage_batch(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  rec          jsonb;
  result_rows  jsonb := '[]'::jsonb;
  new_id       text;
  existing_id  text;
  v_batch_id   text;
  v_batch_uuid uuid;
  v_folder_id  uuid;
  v_serial     int;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    v_batch_id := NULLIF(trim(COALESCE(rec->>'batch_id', '')), '');
    v_folder_id := NULLIF(trim(COALESCE(rec->>'folder_id', '')), '')::uuid;
    v_batch_uuid := NULLIF(trim(COALESCE(rec->>'batch_uuid', '')), '')::uuid;

    IF v_batch_id IS NOT NULL AND v_folder_id IS NULL THEN
      SELECT id INTO v_folder_id
      FROM pipeline.pipeline_folders
      WHERE batch_id = v_batch_id AND is_disposable_batch = true
      LIMIT 1;
    ELSIF v_folder_id IS NOT NULL AND v_batch_id IS NULL THEN
      SELECT batch_id, batch_uuid INTO v_batch_id, v_batch_uuid
      FROM pipeline.pipeline_folders
      WHERE id = v_folder_id;
    END IF;

    IF v_batch_id IS NOT NULL AND v_batch_uuid IS NULL THEN
      SELECT batch_uuid INTO v_batch_uuid
      FROM public.publishing_batches
      WHERE id = v_batch_id;
    END IF;

    -- Intra-batch duplicate check scoped by (batch_id, source, source_listing_id)
    SELECT id INTO existing_id
    FROM pipeline.pipeline_properties
    WHERE COALESCE(batch_id, '__manual_inbox__') = COALESCE(v_batch_id, '__manual_inbox__')
      AND COALESCE(source, 'homeharvest') = COALESCE(rec->>'source', 'homeharvest')
      AND source_listing_id = (rec->>'source_listing_id')
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      result_rows := result_rows || jsonb_build_object(
        'source_listing_id', rec->>'source_listing_id',
        'batch_id', v_batch_id,
        'duplicate', true,
        'id', existing_id
      );
    ELSE
      new_id := gen_random_uuid()::text;
      v_serial := NULLIF(rec->>'folder_serial', '')::int;
      IF v_folder_id IS NOT NULL AND v_serial IS NULL THEN
        SELECT COALESCE(MAX(folder_serial), 0) + 1
        INTO v_serial
        FROM pipeline.pipeline_properties
        WHERE folder_id = v_folder_id;
      END IF;

      INSERT INTO pipeline.pipeline_properties (
        id, source, source_listing_id, source_url, source_status, status,
        title, address, unit_number, city, state, zip, county, neighborhood, location_context,
        lat, lng, bedrooms, bathrooms, half_bathrooms, square_footage, year_built,
        property_type, monthly_rent, security_deposit, application_fee,
        description, showing_instructions, available_date, parking, garage_spaces,
        pets_allowed, smoking_allowed, minimum_lease_months, move_in_special,
        amenities, appliances, heating_type, cooling_type, laundry_type,
        has_basement, has_central_air, virtual_tour_url, original_image_urls,
        data_quality_score, missing_fields, agent_name, poster_landlord_id,
        batch_id, batch_uuid, folder_id, folder_serial,
        scraped_at, updated_at
      )
      VALUES (
        new_id,
        COALESCE(rec->>'source', 'homeharvest'),
        rec->>'source_listing_id',
        rec->>'source_url',
        COALESCE(rec->>'source_status', 'available'),
        COALESCE(rec->>'status', 'scraped'),
        rec->>'title',
        rec->>'address',
        rec->>'unit_number',
        rec->>'city',
        rec->>'state',
        rec->>'zip',
        rec->>'county',
        rec->>'neighborhood',
        rec->>'location_context',
        NULLIF(rec->>'lat', '')::double precision,
        NULLIF(rec->>'lng', '')::double precision,
        NULLIF(rec->>'bedrooms', '')::int,
        NULLIF(rec->>'bathrooms', '')::double precision,
        NULLIF(rec->>'half_bathrooms', '')::int,
        NULLIF(rec->>'square_footage', '')::int,
        NULLIF(rec->>'year_built', '')::int,
        rec->>'property_type',
        NULLIF(rec->>'monthly_rent', '')::int,
        NULLIF(rec->>'security_deposit', '')::int,
        COALESCE(NULLIF(rec->>'application_fee', '')::int, 50),
        rec->>'description',
        rec->>'showing_instructions',
        rec->>'available_date',
        rec->>'parking',
        NULLIF(rec->>'garage_spaces', '')::int,
        NULLIF(rec->>'pets_allowed', '')::boolean,
        NULLIF(rec->>'smoking_allowed', '')::boolean,
        NULLIF(rec->>'minimum_lease_months', '')::int,
        rec->>'move_in_special',
        rec->>'amenities',
        rec->>'appliances',
        rec->>'heating_type',
        rec->>'cooling_type',
        COALESCE(rec->>'laundry_type', rec->>'laundry'),
        NULLIF(rec->>'has_basement', '')::boolean,
        NULLIF(rec->>'has_central_air', '')::boolean,
        rec->>'virtual_tour_url',
        rec->>'original_image_urls',
        NULLIF(rec->>'data_quality_score', '')::int,
        rec->>'missing_fields',
        rec->>'agent_name',
        rec->>'poster_landlord_id',
        v_batch_id,
        v_batch_uuid,
        v_folder_id,
        v_serial,
        COALESCE(NULLIF(rec->>'scraped_at', '')::timestamptz, now()),
        now()
      );

      result_rows := result_rows || jsonb_build_object(
        'source_listing_id', rec->>'source_listing_id',
        'batch_id', v_batch_id,
        'folder_id', v_folder_id,
        'duplicate', false,
        'id', new_id
      );
    END IF;
  END LOOP;
  RETURN result_rows;
END;
$$;

-- ── 7. Grants (Consistent with Existing Pipeline RPCs) ─────────────────────
GRANT EXECUTE ON FUNCTION public.batch_namespace_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.batch_create(text, text, text, text, jsonb, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.batch_lookup(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.batch_list(int, text) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.pipeline_folder_create(text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pipeline_folder_create(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pipeline_folder_list() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pipeline_folder_properties(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pipeline_folder_add_property(text, text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pipeline_list(text, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pipeline_stage_batch(jsonb) TO anon, authenticated, service_role;
