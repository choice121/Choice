-- Keep the public listing poster profiles in sync with the exact pipeline row
-- that was published. The browser extension stores this evidence in
-- pipeline_properties.original_data._choice_poster_profiles.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS poster_profiles jsonb NOT NULL DEFAULT '[]'::jsonb;

GRANT SELECT (poster_profiles) ON public.properties TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pipeline_poster_profiles_from_original_data(
  p_original_data text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_data jsonb;
  v_profiles jsonb;
BEGIN
  IF p_original_data IS NULL OR btrim(p_original_data) = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  v_data := p_original_data::jsonb;
  v_profiles := coalesce(v_data->'_choice_poster_profiles', '[]'::jsonb);

  IF jsonb_typeof(v_profiles) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN v_profiles;
EXCEPTION WHEN others THEN
  RETURN '[]'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_poster_profiles_from_original_data(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_pipeline_poster_profiles_to_property()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline, pg_temp
AS $$
DECLARE
  v_profiles jsonb;
BEGIN
  IF NEW.status IS DISTINCT FROM 'published' OR NEW.choice_property_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.identity_strategy = 'NO_IDENTITY' THEN
    v_profiles := '[]'::jsonb;
  ELSE
    v_profiles := public.pipeline_poster_profiles_from_original_data(NEW.original_data);
  END IF;

  UPDATE public.properties
     SET poster_profiles = v_profiles
   WHERE id = NEW.choice_property_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_pipeline_poster_profiles_to_property()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pipeline_properties_sync_public_poster_profiles
  ON pipeline.pipeline_properties;

CREATE TRIGGER pipeline_properties_sync_public_poster_profiles
AFTER UPDATE OF status, choice_property_id, original_data, identity_strategy
ON pipeline.pipeline_properties
FOR EACH ROW
EXECUTE FUNCTION public.sync_pipeline_poster_profiles_to_property();

-- Repair properties published before this migration was installed.
UPDATE public.properties AS published
   SET poster_profiles = CASE
     WHEN pipeline_row.identity_strategy = 'NO_IDENTITY' THEN '[]'::jsonb
     ELSE public.pipeline_poster_profiles_from_original_data(pipeline_row.original_data)
   END
  FROM pipeline.pipeline_properties AS pipeline_row
 WHERE pipeline_row.choice_property_id = published.id
   AND pipeline_row.status = 'published'
   AND (
     pipeline_row.identity_strategy = 'NO_IDENTITY'
     OR jsonb_array_length(
       public.pipeline_poster_profiles_from_original_data(pipeline_row.original_data)
     ) > 0
   );

-- Reapplying the backfill is safe; the trigger keeps future publishes in sync.