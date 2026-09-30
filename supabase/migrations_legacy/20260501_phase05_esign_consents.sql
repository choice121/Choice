-- Phase 05 -- E-SIGN Act consumer consent
--
-- The federal E-SIGN Act (15 USC Sec 7001(c)) requires that, before a
-- consumer can be legally bound by an electronic signature in lieu of a
-- paper original, the consumer must be given a clear-and-conspicuous
-- disclosure and must affirmatively consent to electronic delivery.
-- The disclosure must cover at minimum:
--   1. The right to receive a paper copy
--   2. The right to withdraw consent (and the procedure to do so)
--   3. The hardware/software requirements to access electronic records
--
-- This migration creates esign_consents to record those acknowledgments
-- per (signer_email, app_id, disclosure_version) and a helper RPC to
-- check whether a recent consent exists for a given signer.

BEGIN;

CREATE TABLE IF NOT EXISTS public.esign_consents (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id                          TEXT        NOT NULL REFERENCES public.applications(app_id) ON DELETE CASCADE,
  signer_email                    TEXT        NOT NULL,
  signer_role                     TEXT        NOT NULL CHECK (signer_role IN ('tenant','co_applicant','amendment')),
  disclosure_version              TEXT        NOT NULL,
  ip_address                      INET,
  user_agent                      TEXT,
  hardware_software_acknowledged  BOOLEAN     NOT NULL DEFAULT false,
  paper_copy_right_acknowledged   BOOLEAN     NOT NULL DEFAULT false,
  withdrawal_right_acknowledged   BOOLEAN     NOT NULL DEFAULT false,
  consent_given                   BOOLEAN     NOT NULL DEFAULT false,
  consented_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at                    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_esign_consents_app
  ON public.esign_consents(app_id);
CREATE INDEX IF NOT EXISTS idx_esign_consents_email_version
  ON public.esign_consents(lower(signer_email), disclosure_version);
CREATE INDEX IF NOT EXISTS idx_esign_consents_active
  ON public.esign_consents(app_id, lower(signer_email), disclosure_version)
  WHERE withdrawn_at IS NULL AND consent_given = true;

ALTER TABLE public.esign_consents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='esign_consents'
      AND policyname='service_role_all_esign_consents'
  ) THEN
    CREATE POLICY "service_role_all_esign_consents"
      ON public.esign_consents
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='esign_consents'
      AND policyname='admin_read_esign_consents'
  ) THEN
    CREATE POLICY "admin_read_esign_consents"
      ON public.esign_consents
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()));
  END IF;
END $$;

REVOKE ALL ON public.esign_consents FROM anon;

-- has_recent_esign_consent -- decides if get-lease must re-prompt the user
CREATE OR REPLACE FUNCTION public.has_recent_esign_consent(
  p_app_id  TEXT,
  p_email   TEXT,
  p_version TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.esign_consents
    WHERE app_id              = p_app_id
      AND lower(signer_email) = lower(p_email)
      AND disclosure_version  = p_version
      AND withdrawn_at        IS NULL
      AND consent_given       = true
      AND consented_at       >  now() - INTERVAL '30 days'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_recent_esign_consent(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_recent_esign_consent(TEXT, TEXT, TEXT) TO service_role;

COMMIT;
