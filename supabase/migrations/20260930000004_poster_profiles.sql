-- Preserve multiple public-safe listing identities without changing the
-- pipeline schema, which is owned by the Property Pipeline project.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS poster_profiles jsonb NOT NULL DEFAULT '[]'::jsonb;

GRANT SELECT (poster_profiles) ON public.properties TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.copy_pipeline_poster_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline, pg_temp
AS $$
DECLARE
  v_original_data jsonb := '{}'::jsonb;
  v_profiles jsonb := '[]'::jsonb;
  v_pipeline_original_data text;
BEGIN
  IF NEW.identity_strategy = 'NO_IDENTITY'
     OR NEW.source IS NULL
     OR NEW.source_listing_id IS NULL THEN
    NEW.poster_profiles := '[]'::jsonb;
    RETURN NEW;
  END IF;

  SELECT original_data
    INTO v_pipeline_original_data
    FROM pipeline.pipeline_properties
   WHERE source = NEW.source
     AND source_listing_id = NEW.source_listing_id
   ORDER BY updated_at DESC NULLS LAST
   LIMIT 1;

  IF v_pipeline_original_data IS NOT NULL THEN
    BEGIN
      v_original_data := v_pipeline_original_data::jsonb;
    EXCEPTION WHEN others THEN
      v_original_data := '{}'::jsonb;
    END;
  END IF;

  v_profiles := COALESCE(v_original_data->'_choice_poster_profiles', '[]'::jsonb);
  IF jsonb_typeof(v_profiles) <> 'array' THEN
    v_profiles := '[]'::jsonb;
  END IF;

  NEW.poster_profiles := v_profiles;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_pipeline_poster_profiles() FROM PUBLIC;

DROP TRIGGER IF EXISTS properties_copy_pipeline_poster_profiles ON public.properties;
CREATE TRIGGER properties_copy_pipeline_poster_profiles
BEFORE INSERT OR UPDATE OF source, source_listing_id, identity_strategy
ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.copy_pipeline_poster_profiles();