-- Scraper metadata proves only that a source reported a poster/provider.
-- Identity and property authority are tracked separately on party_profiles and
-- property_party_roles; never persist scraper presence as "confirmed".

CREATE OR REPLACE FUNCTION public.normalize_source_identity_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_source_identity BOOLEAN;
BEGIN
  IF NEW.identity_strategy = 'NO_IDENTITY' THEN
    NEW.identity_status := 'unavailable';
    RETURN NEW;
  END IF;

  IF NEW.identity_strategy IN ('AGENT_POSTER', 'COMPANY_SOURCE') THEN
    v_has_source_identity :=
      nullif(btrim(NEW.source_profile_name), '') IS NOT NULL
      OR nullif(btrim(NEW.agent_name), '') IS NOT NULL
      OR nullif(btrim(NEW.source_profile_url), '') IS NOT NULL
      OR nullif(btrim(NEW.agent_profile_url), '') IS NOT NULL;
    NEW.identity_status := CASE WHEN v_has_source_identity THEN 'source_reported' ELSE 'unavailable' END;
  ELSIF NEW.identity_strategy = 'UNKNOWN_REVIEW' THEN
    NEW.identity_status := 'review';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_source_identity_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pipeline_source_identity_status_guard ON pipeline.pipeline_properties;
CREATE TRIGGER pipeline_source_identity_status_guard
BEFORE INSERT OR UPDATE OF source, identity_strategy, identity_status, source_profile_name,
  agent_name, source_profile_url, agent_profile_url
ON pipeline.pipeline_properties
FOR EACH ROW EXECUTE FUNCTION public.normalize_source_identity_status();

DROP TRIGGER IF EXISTS properties_source_identity_status_guard ON public.properties;
CREATE TRIGGER properties_source_identity_status_guard
BEFORE INSERT OR UPDATE OF source, identity_strategy, identity_status, source_profile_name,
  agent_name, source_profile_url, agent_profile_url
ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.normalize_source_identity_status();