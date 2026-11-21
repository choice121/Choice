-- ============================================================
-- Phase 2 Patch Migration:
-- 1. Grant service_role privileges on pipeline.pipeline_folders
--    (matching pipeline_properties, pipeline_scrape_runs, etc.)
--    so Edge Functions reading/writing batch_id & is_disposable_batch
--    on pipeline_folders succeed cleanly.
-- 2. Check 4-digit batch collision BEFORE Folder already exists
--    in pipeline_folder_create so generic folder creation cannot
--    shadow or collide with reserved/used 4-digit Batch IDs.
-- 3. Reload PostgREST schema cache.
-- ============================================================

GRANT USAGE ON SCHEMA pipeline TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pipeline.pipeline_folders TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pipeline TO service_role;

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

  -- Reject reusing an existing or archived 4-digit Batch ID before folder lookup
  IF v_trimmed ~ '^[0-9]{4}$' AND (
    EXISTS (SELECT 1 FROM public.publishing_batches WHERE id = v_trimmed)
    OR EXISTS (SELECT 1 FROM pipeline.pipeline_recovery_archive WHERE batch_id = v_trimmed)
    OR EXISTS (SELECT 1 FROM pipeline.pipeline_folders WHERE batch_id = v_trimmed OR name = v_trimmed)
  ) THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'batch_id_already_used',
      'batch_id', v_trimmed,
      'message', 'Batch #' || v_trimmed || ' has already been used. Use + New Batch with a fresh 4-digit ID.'
    );
  END IF;

  SELECT id INTO v_id
  FROM pipeline.pipeline_folders
  WHERE name = p_name AND cleanup_state <> 'deleted';
  IF FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Folder already exists', 'id', v_id);
  END IF;

  INSERT INTO pipeline.pipeline_folders (name, description, color, icon)
  VALUES (p_name, p_description, COALESCE(p_color, '#6366f1'), COALESCE(p_icon, '📁'))
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'id', v_id, 'name', p_name, 'color', p_color, 'icon', p_icon);
END;
$$;

NOTIFY pgrst, 'reload schema';
