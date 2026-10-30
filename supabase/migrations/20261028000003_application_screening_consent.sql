ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS screening_consent boolean,
  ADD COLUMN IF NOT EXISTS screening_consent_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS screening_consent_version text;

UPDATE public.applications
SET co_applicant_consent = false,
    co_applicant_consent_timestamp = NULL,
    co_applicant_consent_version = NULL
WHERE has_co_applicant IS TRUE;

ALTER TABLE IF EXISTS public.consent_log
  ADD COLUMN IF NOT EXISTS screening_consent boolean;

CREATE TABLE IF NOT EXISTS public.application_screening_consent_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE RESTRICT,
  applicant_type text NOT NULL CHECK (applicant_type IN ('primary', 'co_applicant')),
  consent_version text NOT NULL,
  consented_at timestamptz NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.application_screening_consent_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.application_screening_consent_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.application_screening_consent_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.application_screening_consent_events_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_screening_consent_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Screening consent events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS application_screening_consent_events_append_only
  ON public.application_screening_consent_events;
CREATE TRIGGER application_screening_consent_events_append_only
  BEFORE UPDATE OR DELETE ON public.application_screening_consent_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_screening_consent_event_mutation();

CREATE TABLE IF NOT EXISTS public.co_applicant_consent_tokens (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS co_applicant_consent_tokens_application_id_idx
  ON public.co_applicant_consent_tokens(application_id);
ALTER TABLE public.co_applicant_consent_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.co_applicant_consent_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.co_applicant_consent_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_co_applicant_screening(
  p_token_hash text,
  p_consent_version text,
  p_ip text,
  p_user_agent text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_application_id uuid;
  v_recipient_email text;
  v_consented_at timestamptz := now();
BEGIN
  UPDATE public.co_applicant_consent_tokens
  SET consumed_at = v_consented_at
  WHERE token_hash = p_token_hash
    AND consumed_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > v_consented_at
  RETURNING application_id, recipient_email
  INTO v_application_id, v_recipient_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consent link is invalid, expired, or already used';
  END IF;

  UPDATE public.applications
  SET co_applicant_consent = true,
      co_applicant_consent_timestamp = v_consented_at,
      co_applicant_consent_version = p_consent_version
  WHERE id = v_application_id
    AND has_co_applicant IS TRUE
    AND lower(co_applicant_email) = lower(v_recipient_email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consent link does not match an additional adult on the application';
  END IF;

  INSERT INTO public.application_screening_consent_events (
    application_id, applicant_type, consent_version, consented_at, ip, user_agent
  ) VALUES (
    v_application_id, 'co_applicant', p_consent_version, v_consented_at, p_ip, p_user_agent
  );

  RETURN v_application_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_co_applicant_screening(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_co_applicant_screening(text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_approval_without_co_applicant_consent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'approved'
    AND NEW.has_co_applicant IS TRUE
    AND NEW.co_applicant_consent IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Additional adult screening consent is required before approval';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_require_co_applicant_consent_for_approval
  ON public.applications;
CREATE TRIGGER applications_require_co_applicant_consent_for_approval
  BEFORE INSERT OR UPDATE OF status, has_co_applicant, co_applicant_consent
  ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.prevent_approval_without_co_applicant_consent();
