-- ============================================================
-- Phase 2 Verification Patch:
-- 1. Drop redundant 2-arg overloads of pipeline_folder_create and
--    pipeline_folder_rename that caused PostgREST PGRST203 (HTTP 300)
--    ambiguity when called with 2 named parameters from Admin UI
--    and Edge Functions. The existing 4-arg functions already provide
--    DEFAULT values for the trailing parameters and handle 2-arg,
--    3-arg, and 4-arg calls uniquely.
-- 2. Enforce 4-digit batch protection inside pipeline_folder_rename
--    so disposable batch folders stay pinned to their Batch ID and
--    regular folders cannot be renamed to a used 4-digit Batch ID.
-- ============================================================

DROP FUNCTION IF EXISTS public.pipeline_folder_create(text, text);
DROP FUNCTION IF EXISTS public.pipeline_folder_rename(uuid, text);

CREATE OR REPLACE FUNCTION public.pipeline_folder_rename(
  p_folder_id uuid,
  p_new_name text,
  p_color text DEFAULT NULL::text,
  p_icon text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_is_disposable boolean := false;
  v_cur_batch_id text := NULL;
  v_trimmed text;
BEGIN
  p_new_name := initcap(trim(regexp_replace(COALESCE(p_new_name, ''), '\s+', ' ', 'g')));
  v_trimmed := trim(p_new_name);
  IF v_trimmed = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Folder name is required');
  END IF;

  SELECT COALESCE(is_disposable_batch, false), batch_id
  INTO v_is_disposable, v_cur_batch_id
  FROM pipeline.pipeline_folders
  WHERE id = p_folder_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Folder not found');
  END IF;

  IF v_is_disposable AND v_cur_batch_id IS NOT NULL AND v_trimmed <> v_cur_batch_id THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'disposable_batch_folder_locked',
      'message', 'Batch #' || v_cur_batch_id || ' disposable folder cannot be renamed.'
    );
  END IF;

  IF v_trimmed ~ '^[0-9]{4}$' AND (
    (v_cur_batch_id IS DISTINCT FROM v_trimmed) AND (
      EXISTS (SELECT 1 FROM public.publishing_batches WHERE id = v_trimmed)
      OR EXISTS (SELECT 1 FROM pipeline.pipeline_recovery_archive WHERE batch_id = v_trimmed)
      OR EXISTS (SELECT 1 FROM pipeline.pipeline_folders WHERE (batch_id = v_trimmed OR name = v_trimmed) AND id <> p_folder_id)
    )
  ) THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'batch_id_already_used',
      'batch_id', v_trimmed,
      'message', 'Batch #' || v_trimmed || ' has already been used.'
    );
  END IF;

  UPDATE pipeline.pipeline_folders
  SET name = p_new_name,
      color = COALESCE(p_color, color),
      icon = COALESCE(p_icon, icon),
      updated_at = now()
  WHERE id = p_folder_id;

  RETURN json_build_object('ok', true, 'name', p_new_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pipeline_folder_create(text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pipeline_folder_rename(uuid, text, text, text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
