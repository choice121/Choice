-- Migration: Multi-Applicant Support (N Co-Applicants/Guarantors), Full 9-Digit Encrypted SSN,
-- Application Credits (2x / 30-Day Policy), Admin Review & Contact Tracking, and Unified Signing/Consent.
-- All changes are additive and backward-compatible with legacy columns and RPC signatures.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Core multi-applicant normalized table -----------------------------------------
CREATE TABLE IF NOT EXISTS public.application_applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE,
  app_id text NOT NULL,
  applicant_index smallint NOT NULL DEFAULT 0,
  applicant_type text NOT NULL DEFAULT 'co_applicant'
    CHECK (applicant_type IN ('primary', 'co_applicant', 'guarantor', 'co_signer')),
  is_primary boolean NOT NULL DEFAULT false,
  role text,
  first_name text,
  last_name text,
  email text,
  phone text,
  dob text,
  ssn_encrypted text,
  ssn_last4 text,
  ssn_hash text,
  government_id_type text,
  government_id_number text,
  current_address text,
  residency_duration text,
  current_rent_amount text,
  reason_for_leaving text,
  current_landlord_name text,
  landlord_phone text,
  previous_address text,
  previous_residency_duration text,
  previous_landlord_name text,
  previous_landlord_phone text,
  employment_status text,
  employer text,
  employer_address text,
  job_title text,
  employment_start_date text,
  employment_duration text,
  supervisor_name text,
  supervisor_phone text,
  monthly_income text,
  other_income text,
  has_bankruptcy boolean DEFAULT false,
  bankruptcy_explanation text,
  has_criminal_history boolean DEFAULT false,
  criminal_history_explanation text,
  ever_evicted boolean DEFAULT false,
  smoker boolean DEFAULT false,
  reference_1_name text,
  reference_1_phone text,
  reference_1_relationship text,
  reference_2_name text,
  reference_2_phone text,
  reference_2_relationship text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  screening_consent boolean NOT NULL DEFAULT false,
  screening_consent_timestamp timestamptz,
  screening_consent_version text,
  screening_consent_ip text,
  lease_signature text,
  lease_signature_image text,
  lease_signed_at timestamptz,
  lease_ip_address text,
  lease_user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, applicant_index)
);

CREATE INDEX IF NOT EXISTS idx_app_applicants_app_id ON public.application_applicants(app_id);
CREATE INDEX IF NOT EXISTS idx_app_applicants_application_id ON public.application_applicants(application_id);
CREATE INDEX IF NOT EXISTS idx_app_applicants_email_lower ON public.application_applicants(lower(email));

-- 2. Application Credits table (2 reapplication credits valid 30 days on denial) ----
CREATE TABLE IF NOT EXISTS public.application_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  original_app_id text NOT NULL UNIQUE,
  original_application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  total_credits integer NOT NULL DEFAULT 2,
  remaining_credits integer NOT NULL DEFAULT 2,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'exhausted', 'expired', 'revoked')),
  used_app_ids text[] NOT NULL DEFAULT '{}',
  notes text
);

CREATE INDEX IF NOT EXISTS idx_app_credits_email_lower ON public.application_credits(lower(email));

-- 3. Additive columns on existing tables --------------------------------------------
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS co_applicant_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combined_monthly_income numeric,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contacted_by text,
  ADD COLUMN IF NOT EXISTS credit_applied_id uuid REFERENCES public.application_credits(id) ON DELETE SET NULL;

ALTER TABLE public.application_documents
  ADD COLUMN IF NOT EXISTS applicant_id uuid REFERENCES public.application_applicants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS file_size_bytes integer;

ALTER TABLE public.co_applicant_consent_tokens
  ADD COLUMN IF NOT EXISTS applicant_id uuid REFERENCES public.application_applicants(id) ON DELETE CASCADE;

ALTER TABLE public.application_screening_consent_events
  ADD COLUMN IF NOT EXISTS applicant_id uuid REFERENCES public.application_applicants(id) ON DELETE CASCADE;

ALTER TABLE public.lease_signing_tokens
  ADD COLUMN IF NOT EXISTS applicant_id uuid REFERENCES public.application_applicants(id) ON DELETE CASCADE;

ALTER TABLE public.sign_events
  ADD COLUMN IF NOT EXISTS applicant_id uuid REFERENCES public.application_applicants(id) ON DELETE SET NULL;

ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS signer_snapshots jsonb DEFAULT '[]'::jsonb;

-- 4. Backfill existing data cleanly & idempotently ----------------------------------
-- Backfill primary applicants (applicant_index = 0)
INSERT INTO public.application_applicants (
  application_id, app_id, applicant_index, applicant_type, is_primary, role,
  first_name, last_name, email, phone, dob, ssn_last4,
  government_id_type, government_id_number,
  current_address, residency_duration, current_rent_amount, reason_for_leaving,
  current_landlord_name, landlord_phone,
  previous_address, previous_residency_duration, previous_landlord_name, previous_landlord_phone,
  employment_status, employer, employer_address, job_title,
  employment_start_date, employment_duration, supervisor_name, supervisor_phone,
  monthly_income, other_income,
  has_bankruptcy, bankruptcy_explanation, has_criminal_history, criminal_history_explanation,
  ever_evicted, smoker,
  reference_1_name, reference_1_phone, reference_1_relationship,
  reference_2_name, reference_2_phone, reference_2_relationship,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
  screening_consent, screening_consent_timestamp, screening_consent_version,
  lease_signature, lease_signature_image, lease_signed_at, lease_ip_address,
  created_at, updated_at
)
SELECT
  a.id, a.app_id, 0, 'primary', true, 'Primary Applicant',
  a.first_name, a.last_name, a.email, a.phone, a.dob,
  CASE
    WHEN length(regexp_replace(COALESCE(a.ssn, ''), '[^0-9]', '', 'g')) >= 4
      THEN right(regexp_replace(COALESCE(a.ssn, ''), '[^0-9]', '', 'g'), 4)
    ELSE NULL
  END,
  a.government_id_type, a.government_id_number,
  a.current_address, a.residency_duration, a.current_rent_amount, a.reason_for_leaving,
  a.current_landlord_name, a.landlord_phone,
  a.previous_address, a.previous_residency_duration, a.previous_landlord_name, a.previous_landlord_phone,
  a.employment_status, a.employer, a.employer_address, a.job_title,
  a.employment_start_date, a.employment_duration, a.supervisor_name, a.supervisor_phone,
  a.monthly_income, a.other_income,
  COALESCE(a.has_bankruptcy, false), a.bankruptcy_explanation,
  COALESCE(a.has_criminal_history, false), a.criminal_history_explanation,
  COALESCE(a.ever_evicted, false), COALESCE(a.smoker, false),
  a.reference_1_name, a.reference_1_phone, a.reference_1_relationship,
  a.reference_2_name, a.reference_2_phone, a.reference_2_relationship,
  a.emergency_contact_name, a.emergency_contact_phone, a.emergency_contact_relationship,
  COALESCE(a.screening_consent, a.terms_consent, true),
  COALESCE(a.screening_consent_timestamp, a.consent_timestamp, a.created_at),
  COALESCE(a.screening_consent_version, a.consent_version),
  a.tenant_signature, a.tenant_signature_image, a.signature_timestamp, a.lease_ip_address,
  a.created_at, COALESCE(a.updated_at, a.created_at)
FROM public.applications a
ON CONFLICT (application_id, applicant_index) DO NOTHING;

-- Backfill legacy co_applicants rows (or flat co_applicant_* fields when co_applicants is empty)
INSERT INTO public.application_applicants (
  application_id, app_id, applicant_index, applicant_type, is_primary, role,
  first_name, last_name, email, phone, dob, ssn_last4,
  employment_status, employer, job_title, monthly_income, employment_duration,
  screening_consent, screening_consent_timestamp, screening_consent_version,
  lease_signature, lease_signature_image, lease_signed_at,
  created_at, updated_at
)
SELECT
  a.id, a.app_id, 1,
  CASE
    WHEN lower(COALESCE(ca.role, a.additional_person_role, a.co_applicant_role, '')) LIKE '%guarantor%' THEN 'guarantor'
    WHEN lower(COALESCE(ca.role, a.additional_person_role, a.co_applicant_role, '')) LIKE '%co-signer%'
      OR lower(COALESCE(ca.role, a.additional_person_role, a.co_applicant_role, '')) LIKE '%cosigner%' THEN 'co_signer'
    ELSE 'co_applicant'
  END,
  false,
  COALESCE(ca.role, a.additional_person_role, a.co_applicant_role, 'Co-Applicant'),
  COALESCE(ca.first_name, a.co_applicant_first_name),
  COALESCE(ca.last_name, a.co_applicant_last_name),
  COALESCE(ca.email, a.co_applicant_email),
  COALESCE(ca.phone, a.co_applicant_phone),
  COALESCE(ca.dob, a.co_applicant_dob),
  CASE
    WHEN length(regexp_replace(COALESCE(ca.ssn, a.co_applicant_ssn, ''), '[^0-9]', '', 'g')) >= 4
      THEN right(regexp_replace(COALESCE(ca.ssn, a.co_applicant_ssn, ''), '[^0-9]', '', 'g'), 4)
    ELSE NULL
  END,
  COALESCE(ca.employment_status, a.co_applicant_employment_status),
  COALESCE(ca.employer, a.co_applicant_employer),
  COALESCE(ca.job_title, a.co_applicant_job_title),
  COALESCE(ca.monthly_income, a.co_applicant_monthly_income),
  COALESCE(ca.employment_duration, a.co_applicant_employment_duration),
  COALESCE(ca.consent, a.co_applicant_consent, false),
  a.co_applicant_consent_timestamp,
  a.co_applicant_consent_version,
  a.co_applicant_signature,
  a.co_applicant_signature_image,
  a.co_applicant_signature_timestamp,
  COALESCE(ca.created_at, a.created_at),
  now()
FROM public.applications a
LEFT JOIN public.co_applicants ca ON ca.app_id = a.app_id
WHERE a.has_co_applicant IS TRUE
  OR ca.id IS NOT NULL
  OR NULLIF(btrim(COALESCE(a.co_applicant_email, '')), '') IS NOT NULL
ON CONFLICT (application_id, applicant_index) DO NOTHING;

-- Sync co_applicant_count on applications
UPDATE public.applications a
SET co_applicant_count = COALESCE((
  SELECT count(*)::int FROM public.application_applicants aa
  WHERE aa.application_id = a.id AND aa.is_primary IS FALSE
), 0)
WHERE a.co_applicant_count IS NULL OR a.co_applicant_count = 0;

-- Link unlinked application_documents to primary applicant where appropriate
UPDATE public.application_documents ad
SET applicant_id = aa.id
FROM public.application_applicants aa
WHERE ad.applicant_id IS NULL
  AND ad.app_id = aa.app_id
  AND aa.is_primary IS TRUE;

-- Link existing lease_signing_tokens to applicant_id where missing
UPDATE public.lease_signing_tokens lst
SET applicant_id = aa.id
FROM public.application_applicants aa
WHERE lst.applicant_id IS NULL
  AND lst.app_id = aa.app_id
  AND (
    (lst.signer_role = 'tenant' AND aa.is_primary IS TRUE)
    OR (lst.signer_role = 'co_applicant' AND aa.is_primary IS FALSE AND (
      lower(COALESCE(aa.email, '')) = lower(COALESCE(lst.signer_email, ''))
      OR aa.applicant_index = 1
    ))
  );

-- 5. Column-level security & RLS for application_applicants ------------------------
ALTER TABLE public.application_applicants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.application_applicants FROM anon, authenticated;

-- Explicitly omit ssn_encrypted and ssn_hash from all client roles!
GRANT SELECT (
  id, application_id, app_id, applicant_index, applicant_type, is_primary, role,
  first_name, last_name, email, phone, dob, ssn_last4,
  government_id_type, government_id_number,
  current_address, residency_duration, current_rent_amount, reason_for_leaving,
  current_landlord_name, landlord_phone,
  previous_address, previous_residency_duration, previous_landlord_name, previous_landlord_phone,
  employment_status, employer, employer_address, job_title,
  employment_start_date, employment_duration, supervisor_name, supervisor_phone,
  monthly_income, other_income,
  has_bankruptcy, bankruptcy_explanation, has_criminal_history, criminal_history_explanation,
  ever_evicted, smoker,
  reference_1_name, reference_1_phone, reference_1_relationship,
  reference_2_name, reference_2_phone, reference_2_relationship,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
  screening_consent, screening_consent_timestamp, screening_consent_version, screening_consent_ip,
  lease_signature, lease_signature_image, lease_signed_at, lease_ip_address, lease_user_agent,
  created_at, updated_at
) ON public.application_applicants TO authenticated;

DROP POLICY IF EXISTS app_applicants_admin_all ON public.application_applicants;
CREATE POLICY app_applicants_admin_all
  ON public.application_applicants
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS app_applicants_landlord_select ON public.application_applicants;
CREATE POLICY app_applicants_landlord_select
  ON public.application_applicants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.landlords l ON l.id = a.landlord_id
      WHERE a.id = application_applicants.application_id
        AND l.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS app_applicants_tenant_select ON public.application_applicants;
CREATE POLICY app_applicants_tenant_select
  ON public.application_applicants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      WHERE a.id = application_applicants.application_id
        AND (
          a.applicant_user_id = auth.uid()
          OR lower(a.email) = lower(COALESCE(public.current_confirmed_email(), auth.email(), ''))
          OR lower(COALESCE(a.co_applicant_email, '')) = lower(COALESCE(public.current_confirmed_email(), auth.email(), ''))
          OR EXISTS (
            SELECT 1 FROM public.application_applicants aa2
            WHERE aa2.application_id = a.id
              AND lower(COALESCE(aa2.email, '')) = lower(COALESCE(public.current_confirmed_email(), auth.email(), ''))
          )
        )
    )
  );

-- Update applications / application_documents / leases tenant RLS for N co-applicants
DROP POLICY IF EXISTS applications_tenant_select ON public.applications;
CREATE POLICY applications_tenant_select
  ON public.applications
  FOR SELECT TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR lower(email) = lower(COALESCE(auth.email(), ''))
    OR lower(COALESCE(co_applicant_email, '')) = lower(COALESCE(auth.email(), ''))
    OR EXISTS (
      SELECT 1 FROM public.application_applicants aa
      WHERE aa.application_id = applications.id
        AND lower(COALESCE(aa.email, '')) = lower(COALESCE(auth.email(), ''))
    )
  );

DROP POLICY IF EXISTS tenant_portal_select ON public.applications;
CREATE POLICY tenant_portal_select
  ON public.applications
  FOR SELECT TO authenticated
  USING (
    lower(email) = public.current_confirmed_email()
    OR lower(COALESCE(co_applicant_email, '')) = public.current_confirmed_email()
    OR EXISTS (
      SELECT 1 FROM public.application_applicants aa
      WHERE aa.application_id = applications.id
        AND lower(COALESCE(aa.email, '')) = public.current_confirmed_email()
    )
  );

DROP POLICY IF EXISTS application_documents_applicant_read ON public.application_documents;
CREATE POLICY application_documents_applicant_read
  ON public.application_documents
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.app_id = application_documents.app_id
        AND (
          a.applicant_user_id = auth.uid()
          OR lower(a.email) = lower(COALESCE(auth.email(), ''))
          OR lower(COALESCE(a.co_applicant_email, '')) = lower(COALESCE(auth.email(), ''))
          OR EXISTS (
            SELECT 1 FROM public.application_applicants aa
            WHERE aa.app_id = a.app_id
              AND lower(COALESCE(aa.email, '')) = lower(COALESCE(auth.email(), ''))
          )
        )
    )
  );

DROP POLICY IF EXISTS leases_tenant_select ON public.leases;
CREATE POLICY leases_tenant_select
  ON public.leases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = leases.application_id
        AND (
          lower(a.email) = lower(COALESCE(public.current_confirmed_email(), auth.email(), ''))
          OR EXISTS (
            SELECT 1 FROM public.application_applicants aa
            WHERE aa.application_id = a.id
              AND lower(COALESCE(aa.email, '')) = lower(COALESCE(public.current_confirmed_email(), auth.email(), ''))
          )
        )
    )
  );

-- Application Credits RLS & trigger -----------------------------------------------
ALTER TABLE public.application_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_credits_admin_all ON public.application_credits;
CREATE POLICY app_credits_admin_all
  ON public.application_credits
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS app_credits_tenant_select ON public.application_credits;
CREATE POLICY app_credits_tenant_select
  ON public.application_credits
  FOR SELECT TO authenticated
  USING (
    lower(email) = lower(COALESCE(public.current_confirmed_email(), auth.email(), ''))
  );

CREATE OR REPLACE FUNCTION public.tg_issue_credit_on_denial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'denied'
     AND OLD.status IS DISTINCT FROM 'denied'
     AND COALESCE(NEW.payment_status::text, 'unpaid') IN ('paid', 'waived')
     AND NULLIF(btrim(COALESCE(NEW.email, '')), '') IS NOT NULL
  THEN
    INSERT INTO public.application_credits (
      email,
      original_app_id,
      original_application_id,
      total_credits,
      remaining_credits,
      issued_at,
      expires_at,
      status,
      notes
    ) VALUES (
      lower(btrim(NEW.email)),
      NEW.app_id,
      NEW.id,
      2,
      2,
      now(),
      now() + interval '30 days',
      'active',
      'Auto-issued 2 reapplication credits upon denial of ' || NEW.app_id
    )
    ON CONFLICT (original_app_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_applications_issue_credit_on_denial ON public.applications;
CREATE TRIGGER trg_applications_issue_credit_on_denial
  AFTER UPDATE OF status ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_issue_credit_on_denial();

CREATE OR REPLACE FUNCTION public.check_available_application_credit(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rec public.application_credits%ROWTYPE;
  v_clean text := lower(btrim(COALESCE(p_email, '')));
BEGIN
  IF v_clean = '' THEN
    RETURN jsonb_build_object('has_credit', false);
  END IF;

  SELECT * INTO v_rec
  FROM public.application_credits
  WHERE lower(email) = v_clean
    AND status = 'active'
    AND remaining_credits > 0
    AND expires_at > now()
  ORDER BY expires_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_credit', false);
  END IF;

  RETURN jsonb_build_object(
    'has_credit', true,
    'credit_id', v_rec.id,
    'remaining_credits', v_rec.remaining_credits,
    'total_credits', v_rec.total_credits,
    'expires_at', v_rec.expires_at,
    'original_app_id', v_rec.original_app_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_available_application_credit(text) TO anon, authenticated;

-- 6. Multi-applicant approval gate, consent, tokens, signing & portal RPCs ----------
CREATE OR REPLACE FUNCTION public.prevent_approval_without_co_applicant_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unconsented integer := 0;
BEGIN
  IF NEW.status = 'approved' THEN
    SELECT count(*)::int INTO v_unconsented
    FROM public.application_applicants aa
    WHERE aa.application_id = NEW.id
      AND aa.is_primary IS FALSE
      AND aa.screening_consent IS DISTINCT FROM TRUE;

    IF v_unconsented > 0 THEN
      RAISE EXCEPTION 'Additional adult screening consent is required before approval (% unconsented)', v_unconsented;
    END IF;

    IF NEW.has_co_applicant IS TRUE
       AND NEW.co_applicant_consent IS DISTINCT FROM TRUE
       AND NOT EXISTS (
         SELECT 1 FROM public.application_applicants aa WHERE aa.application_id = NEW.id AND aa.is_primary IS FALSE
       )
    THEN
      RAISE EXCEPTION 'Additional adult screening consent is required before approval';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_co_applicant_screening(
  p_token_hash text,
  p_consent_version text,
  p_ip text,
  p_user_agent text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_application_id uuid;
  v_recipient_email text;
  v_token_applicant_id uuid;
  v_matched_applicant_id uuid;
  v_consented_at timestamptz := now();
  v_all_consented boolean := false;
BEGIN
  UPDATE public.co_applicant_consent_tokens
  SET consumed_at = v_consented_at
  WHERE token_hash = p_token_hash
    AND consumed_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > v_consented_at
  RETURNING application_id, recipient_email, applicant_id
  INTO v_application_id, v_recipient_email, v_token_applicant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consent link is invalid, expired, or already used';
  END IF;

  -- Match exact applicant_id first, otherwise email match on application_applicants
  IF v_token_applicant_id IS NOT NULL THEN
    UPDATE public.application_applicants
    SET screening_consent = true,
        screening_consent_timestamp = v_consented_at,
        screening_consent_version = p_consent_version,
        screening_consent_ip = p_ip,
        updated_at = v_consented_at
    WHERE id = v_token_applicant_id
      AND application_id = v_application_id
      AND is_primary IS FALSE
    RETURNING id INTO v_matched_applicant_id;
  END IF;

  IF v_matched_applicant_id IS NULL THEN
    UPDATE public.application_applicants
    SET screening_consent = true,
        screening_consent_timestamp = v_consented_at,
        screening_consent_version = p_consent_version,
        screening_consent_ip = p_ip,
        updated_at = v_consented_at
    WHERE id = (
      SELECT id FROM public.application_applicants
      WHERE application_id = v_application_id
        AND is_primary IS FALSE
        AND lower(COALESCE(email, '')) = lower(COALESCE(v_recipient_email, ''))
      ORDER BY applicant_index ASC
      LIMIT 1
    )
    RETURNING id INTO v_matched_applicant_id;
  END IF;

  IF v_matched_applicant_id IS NOT NULL THEN
    -- Also sync legacy co_applicants row if present
    UPDATE public.co_applicants
    SET consent = true
    WHERE app_id = (SELECT app_id FROM public.applications WHERE id = v_application_id)
      AND lower(COALESCE(email, '')) = lower(COALESCE(v_recipient_email, ''));

    SELECT NOT EXISTS (
      SELECT 1 FROM public.application_applicants
      WHERE application_id = v_application_id
        AND is_primary IS FALSE
        AND screening_consent IS DISTINCT FROM TRUE
    ) INTO v_all_consented;

    UPDATE public.applications
    SET co_applicant_consent = v_all_consented,
        co_applicant_consent_timestamp = CASE WHEN v_all_consented THEN v_consented_at ELSE co_applicant_consent_timestamp END,
        co_applicant_consent_version = CASE WHEN v_all_consented THEN p_consent_version ELSE co_applicant_consent_version END,
        updated_at = v_consented_at
    WHERE id = v_application_id;
  ELSE
    -- Legacy fallback if no application_applicants row exists
    UPDATE public.applications
    SET co_applicant_consent = true,
        co_applicant_consent_timestamp = v_consented_at,
        co_applicant_consent_version = p_consent_version,
        updated_at = v_consented_at
    WHERE id = v_application_id
      AND has_co_applicant IS TRUE
      AND lower(co_applicant_email) = lower(v_recipient_email);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Consent link does not match an additional adult on the application';
    END IF;
  END IF;

  INSERT INTO public.application_screening_consent_events (
    application_id, applicant_id, applicant_type, consent_version, consented_at, ip, user_agent
  ) VALUES (
    v_application_id, v_matched_applicant_id, 'co_applicant', p_consent_version, v_consented_at, p_ip, p_user_agent
  );

  RETURN v_application_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_lease_tokens(p_app_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  app_rec       RECORD;
  co_rec        RECORD;
  tenant_token  TEXT;
  first_co_tok  TEXT := NULL;
  co_tok        TEXT;
  v_primary_id  UUID;
  v_co_tokens   JSONB := '[]'::jsonb;
  v_attempts    INT;
BEGIN
  SELECT * INTO app_rec FROM public.applications WHERE app_id = p_app_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Application not found."}'::JSONB;
  END IF;

  UPDATE public.lease_signing_tokens
     SET revoked_at    = now(),
         revoke_reason = COALESCE(revoke_reason, 'lease_regenerated')
   WHERE app_id      = p_app_id
     AND signer_role IN ('tenant', 'co_applicant')
     AND used_at     IS NULL
     AND revoked_at  IS NULL;

  SELECT id INTO v_primary_id
  FROM public.application_applicants
  WHERE app_id = p_app_id AND is_primary IS TRUE
  ORDER BY applicant_index ASC
  LIMIT 1;

  v_attempts := 0;
  LOOP
    v_attempts := v_attempts + 1;
    tenant_token := encode(extensions.gen_random_bytes(32), 'hex');
    BEGIN
      INSERT INTO public.lease_signing_tokens (token, app_id, signer_role, signer_email, applicant_id)
      VALUES (tenant_token, p_app_id, 'tenant', COALESCE(app_rec.email, ''), v_primary_id);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 5 THEN
        RAISE EXCEPTION 'generate_lease_tokens: tenant token collided 5x' USING ERRCODE = 'P0001';
      END IF;
    END;
  END LOOP;

  -- Generate one individual signing token per non-primary applicant in application_applicants
  FOR co_rec IN
    SELECT id, applicant_index, applicant_type, first_name, last_name, email
    FROM public.application_applicants
    WHERE app_id = p_app_id AND is_primary IS FALSE
    ORDER BY applicant_index ASC
  LOOP
    v_attempts := 0;
    LOOP
      v_attempts := v_attempts + 1;
      co_tok := encode(extensions.gen_random_bytes(32), 'hex');
      BEGIN
        INSERT INTO public.lease_signing_tokens (token, app_id, signer_role, signer_email, applicant_id)
        VALUES (co_tok, p_app_id, 'co_applicant', COALESCE(co_rec.email, app_rec.email, ''), co_rec.id);
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF v_attempts >= 5 THEN
          RAISE EXCEPTION 'generate_lease_tokens: co-applicant token collided 5x' USING ERRCODE = 'P0001';
        END IF;
      END;
    END LOOP;

    IF first_co_tok IS NULL THEN
      first_co_tok := co_tok;
    END IF;

    v_co_tokens := v_co_tokens || jsonb_build_array(jsonb_build_object(
      'applicant_id', co_rec.id,
      'applicant_index', co_rec.applicant_index,
      'applicant_type', co_rec.applicant_type,
      'first_name', co_rec.first_name,
      'last_name', co_rec.last_name,
      'email', co_rec.email,
      'token', co_tok
    ));
  END LOOP;

  -- Legacy fallback if has_co_applicant=true but no rows in application_applicants
  IF first_co_tok IS NULL AND app_rec.has_co_applicant IS TRUE THEN
    v_attempts := 0;
    LOOP
      v_attempts := v_attempts + 1;
      co_tok := encode(extensions.gen_random_bytes(32), 'hex');
      BEGIN
        INSERT INTO public.lease_signing_tokens (token, app_id, signer_role, signer_email)
        VALUES (co_tok, p_app_id, 'co_applicant', COALESCE(app_rec.co_applicant_email, app_rec.email, ''));
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF v_attempts >= 5 THEN
          RAISE EXCEPTION 'generate_lease_tokens: co-applicant fallback token collided 5x' USING ERRCODE = 'P0001';
        END IF;
      END;
    END LOOP;
    first_co_tok := co_tok;
    v_co_tokens := jsonb_build_array(jsonb_build_object(
      'applicant_id', NULL,
      'applicant_index', 1,
      'applicant_type', 'co_applicant',
      'first_name', app_rec.co_applicant_first_name,
      'last_name', app_rec.co_applicant_last_name,
      'email', app_rec.co_applicant_email,
      'token', co_tok
    ));
  END IF;

  -- Reset previous signatures when regenerating fresh tokens
  UPDATE public.application_applicants
  SET lease_signature = NULL,
      lease_signature_image = NULL,
      lease_signed_at = NULL,
      updated_at = now()
  WHERE app_id = p_app_id;

  UPDATE public.applications SET
    tenant_sign_token        = tenant_token,
    co_applicant_lease_token = first_co_tok,
    lease_status             = 'sent',
    lease_sent_date          = now(),
    updated_at               = now()
  WHERE app_id = p_app_id;

  RETURN jsonb_build_object(
    'success',             true,
    'tenant_token',        tenant_token,
    'co_applicant_token',  first_co_tok,
    'co_applicant_tokens', v_co_tokens
  );
END;
$$;

DROP FUNCTION IF EXISTS public.reissue_signing_token(text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.reissue_signing_token(
  p_app_id text,
  p_role text,
  p_by text,
  p_amendment_id uuid DEFAULT NULL::uuid,
  p_applicant_id uuid DEFAULT NULL::uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_email text;
  v_new   text;
  v_target_applicant_id uuid := p_applicant_id;
BEGIN
  IF p_role NOT IN ('tenant', 'co_applicant', 'amendment') THEN
    RAISE EXCEPTION 'Invalid signer role: %', p_role;
  END IF;

  IF p_role = 'tenant' THEN
    SELECT id, email INTO v_target_applicant_id, v_email
    FROM public.application_applicants
    WHERE app_id = p_app_id AND is_primary IS TRUE
    ORDER BY applicant_index ASC LIMIT 1;
    IF v_email IS NULL THEN
      SELECT email INTO v_email FROM public.applications WHERE app_id = p_app_id;
    END IF;
  ELSIF p_role = 'co_applicant' THEN
    IF v_target_applicant_id IS NOT NULL THEN
      SELECT email INTO v_email FROM public.application_applicants
      WHERE id = v_target_applicant_id AND app_id = p_app_id LIMIT 1;
    ELSE
      SELECT id, email INTO v_target_applicant_id, v_email
      FROM public.application_applicants
      WHERE app_id = p_app_id AND is_primary IS FALSE
      ORDER BY applicant_index ASC LIMIT 1;
      IF v_email IS NULL THEN
        SELECT email INTO v_email FROM public.co_applicants WHERE app_id = p_app_id LIMIT 1;
      END IF;
    END IF;
  ELSE
    SELECT a.email INTO v_email FROM public.applications a WHERE a.app_id = p_app_id;
  END IF;

  -- Revoke only matching active tokens (scoped to applicant_id when specified for co-applicants)
  UPDATE public.lease_signing_tokens
     SET revoked_at    = now(),
         revoked_by    = p_by,
         revoke_reason = 'reissued'
   WHERE app_id      = p_app_id
     AND signer_role = p_role
     AND COALESCE(amendment_id::text, '') = COALESCE(p_amendment_id::text, '')
     AND (
       p_role <> 'co_applicant'
       OR v_target_applicant_id IS NULL
       OR applicant_id = v_target_applicant_id
       OR applicant_id IS NULL
     )
     AND used_at    IS NULL
     AND revoked_at IS NULL;

  v_new := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.lease_signing_tokens (token, app_id, signer_role, signer_email, amendment_id, applicant_id)
  VALUES (v_new, p_app_id, p_role, COALESCE(v_email, ''), p_amendment_id, v_target_applicant_id);

  IF p_role = 'tenant' THEN
    UPDATE public.applications
       SET tenant_sign_token = v_new,
           lease_sent_date   = COALESCE(lease_sent_date, now()),
           updated_at        = now()
     WHERE app_id = p_app_id;
  ELSIF p_role = 'co_applicant' THEN
    -- Keep legacy column populated for 1st co-applicant / backward compatibility
    IF v_target_applicant_id IS NULL OR EXISTS (
      SELECT 1 FROM public.application_applicants aa
      WHERE aa.id = v_target_applicant_id AND aa.applicant_index = 1
    ) THEN
      UPDATE public.applications
         SET co_applicant_lease_token = v_new,
             updated_at               = now()
       WHERE app_id = p_app_id;
    END IF;
  ELSE
    UPDATE public.lease_amendments
       SET signing_token = v_new,
           sent_at       = COALESCE(sent_at, now()),
           updated_at    = now()
     WHERE id = p_amendment_id;
  END IF;

  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_signer_for_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app          RECORD;
  v_applicant    RECORD;
  v_token_meta   public.lease_signing_tokens%ROWTYPE;
  v_signer_type  TEXT;
  v_signer_email TEXT;
  v_signer_name  TEXT;
  v_already      BOOLEAN := false;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing token');
  END IF;

  SELECT * INTO v_token_meta FROM public.lease_signing_tokens WHERE token = p_token;

  IF v_token_meta.token IS NOT NULL THEN
    IF v_token_meta.revoked_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false,
        'error', COALESCE('Signing link revoked: ' || v_token_meta.revoke_reason,
                          'Signing link has been revoked.'));
    END IF;
    IF v_token_meta.expires_at < now() THEN
      RETURN jsonb_build_object('success', false,
        'error', 'Signing link expired on ' || to_char(v_token_meta.expires_at, 'Mon DD, YYYY')
                 || '. Please contact us for a fresh link.');
    END IF;

    SELECT * INTO v_app FROM public.applications WHERE app_id = v_token_meta.app_id LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Application not found');
    END IF;

    IF v_token_meta.applicant_id IS NOT NULL THEN
      SELECT * INTO v_applicant FROM public.application_applicants WHERE id = v_token_meta.applicant_id LIMIT 1;
    END IF;

    v_signer_type := v_token_meta.signer_role;
    IF v_applicant.id IS NOT NULL THEN
      v_signer_email := COALESCE(v_applicant.email, v_token_meta.signer_email);
      v_signer_name  := btrim(COALESCE(v_applicant.first_name, '') || ' ' || COALESCE(v_applicant.last_name, ''));
      v_already      := (v_applicant.lease_signature IS NOT NULL) OR (v_token_meta.used_at IS NOT NULL);
    ELSIF v_signer_type = 'tenant' THEN
      v_signer_email := v_app.email;
      v_signer_name  := btrim(COALESCE(v_app.first_name, '') || ' ' || COALESCE(v_app.last_name, ''));
      v_already      := (v_app.tenant_signature IS NOT NULL) OR (v_token_meta.used_at IS NOT NULL);
    ELSE
      v_signer_email := COALESCE(v_token_meta.signer_email, v_app.co_applicant_email);
      v_signer_name  := btrim(COALESCE(v_app.co_applicant_first_name, '') || ' ' || COALESCE(v_app.co_applicant_last_name, ''));
      v_already      := (v_app.co_applicant_signature IS NOT NULL) OR (v_token_meta.used_at IS NOT NULL);
    END IF;

    RETURN jsonb_build_object(
      'success',        true,
      'app_id',         v_app.app_id,
      'applicant_id',   v_applicant.id,
      'signer_index',   COALESCE(v_applicant.applicant_index, CASE WHEN v_signer_type = 'tenant' THEN 0 ELSE 1 END),
      'signer_role_label', COALESCE(v_applicant.role, CASE WHEN v_signer_type = 'tenant' THEN 'Primary Applicant' ELSE 'Co-Applicant' END),
      'signer_type',    v_signer_type,
      'signer_email',   v_signer_email,
      'signer_name',    v_signer_name,
      'lease_status',   v_app.lease_status,
      'already_signed', v_already,
      'expires_at',     v_token_meta.expires_at
    );
  END IF;

  -- Legacy column fallback
  SELECT app_id, email, first_name, last_name, lease_status, tenant_signature, has_co_applicant
    INTO v_app
    FROM public.applications
   WHERE tenant_sign_token = p_token
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success',        true,
      'app_id',         v_app.app_id,
      'signer_type',    'tenant',
      'signer_email',   v_app.email,
      'signer_name',    btrim(COALESCE(v_app.first_name,'') || ' ' || COALESCE(v_app.last_name,'')),
      'lease_status',   v_app.lease_status,
      'already_signed', v_app.tenant_signature IS NOT NULL
    );
  END IF;

  SELECT a.app_id, ca.email, ca.first_name, ca.last_name, a.lease_status,
         a.co_applicant_signature, a.has_co_applicant
    INTO v_app
    FROM public.applications a
    LEFT JOIN public.co_applicants ca ON ca.app_id = a.app_id
   WHERE a.co_applicant_lease_token = p_token
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success',        true,
      'app_id',         v_app.app_id,
      'signer_type',    'co_applicant',
      'signer_email',   v_app.email,
      'signer_name',    btrim(COALESCE(v_app.first_name,'') || ' ' || COALESCE(v_app.last_name,'')),
      'lease_status',   v_app.lease_status,
      'already_signed', v_app.co_applicant_signature IS NOT NULL
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired signing link');
END;
$$;

CREATE OR REPLACE FUNCTION public.sign_lease_tenant(
  p_token text,
  p_signature text,
  p_ip_address text,
  p_user_agent text,
  p_signature_image text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  app_rec          RECORD;
  v_tok            public.lease_signing_tokens%ROWTYPE;
  v_consumed       BOOLEAN;
  v_has_co         BOOLEAN := false;
  new_lease_status lease_status;
  v_ip             INET;
  v_now            timestamptz := now();
BEGIN
  BEGIN v_ip := NULLIF(p_ip_address,'')::INET; EXCEPTION WHEN others THEN v_ip := NULL; END;

  v_tok := public.validate_signing_token(p_token, 'tenant', v_ip);

  SELECT * INTO app_rec FROM public.applications WHERE app_id = v_tok.app_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Invalid or expired signing link."}'::JSONB;
  END IF;
  IF app_rec.tenant_signature IS NOT NULL THEN
    RETURN '{"success": false, "message": "This lease has already been signed."}'::JSONB;
  END IF;
  IF app_rec.lease_status NOT IN ('sent') THEN
    RETURN jsonb_build_object('success', false,
      'message', 'This lease is not in a signable state: ' || app_rec.lease_status);
  END IF;

  v_consumed := public.consume_signing_token(p_token, v_ip);
  IF NOT v_consumed THEN
    RETURN '{"success": false, "message": "Signing link is no longer usable. Please request a fresh link."}'::JSONB;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.application_applicants
    WHERE app_id = app_rec.app_id AND is_primary IS FALSE
  ) OR (app_rec.has_co_applicant IS TRUE AND app_rec.co_applicant_lease_token IS NOT NULL)
  INTO v_has_co;

  IF v_has_co THEN
    new_lease_status := 'awaiting_co_sign';
  ELSE
    new_lease_status := 'signed';
  END IF;

  UPDATE public.application_applicants
  SET lease_signature = p_signature,
      lease_signature_image = p_signature_image,
      lease_signed_at = v_now,
      lease_ip_address = p_ip_address,
      lease_user_agent = p_user_agent,
      updated_at = v_now
  WHERE app_id = app_rec.app_id
    AND (id = v_tok.applicant_id OR (v_tok.applicant_id IS NULL AND is_primary IS TRUE));

  UPDATE public.applications SET
    tenant_signature        = p_signature,
    tenant_signature_image  = p_signature_image,
    signature_timestamp     = v_now,
    lease_signed_date       = v_now,
    lease_ip_address        = p_ip_address,
    lease_status            = new_lease_status,
    tenant_sign_token       = NULL,
    updated_at              = v_now
  WHERE app_id = app_rec.app_id;

  INSERT INTO public.sign_events (
    app_id, applicant_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path, signature_image
  ) VALUES (
    app_rec.app_id, v_tok.applicant_id, 'tenant', p_signature, app_rec.email,
    p_ip_address, p_user_agent, p_token, app_rec.lease_pdf_url, p_signature_image
  );

  RETURN jsonb_build_object(
    'success', true,
    'app_id', app_rec.app_id,
    'lease_status', new_lease_status::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sign_lease_co_applicant(
  p_token text,
  p_signature text,
  p_ip_address text,
  p_user_agent text,
  p_signature_image text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  app_rec          RECORD;
  co_rec           RECORD;
  v_tok            public.lease_signing_tokens%ROWTYPE;
  v_consumed       BOOLEAN;
  v_ip             INET;
  v_now            timestamptz := now();
  v_co_email       TEXT;
  v_unsigned_left  INT := 0;
  v_next_status    lease_status;
BEGIN
  BEGIN v_ip := NULLIF(p_ip_address,'')::INET; EXCEPTION WHEN others THEN v_ip := NULL; END;

  v_tok := public.validate_signing_token(p_token, 'co_applicant', v_ip);

  SELECT * INTO app_rec FROM public.applications WHERE app_id = v_tok.app_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Invalid or expired signing link."}'::JSONB;
  END IF;

  IF app_rec.tenant_signature IS NULL THEN
    RETURN '{"success": false, "message": "The primary applicant must sign first."}'::JSONB;
  END IF;

  IF v_tok.applicant_id IS NOT NULL THEN
    SELECT * INTO co_rec FROM public.application_applicants
    WHERE id = v_tok.applicant_id AND app_id = app_rec.app_id LIMIT 1;
    IF FOUND AND co_rec.lease_signature IS NOT NULL THEN
      RETURN '{"success": false, "message": "You have already signed this lease."}'::JSONB;
    END IF;
    v_co_email := COALESCE(co_rec.email, v_tok.signer_email);
  ELSE
    IF app_rec.co_applicant_signature IS NOT NULL THEN
      RETURN '{"success": false, "message": "Co-applicant has already signed."}'::JSONB;
    END IF;
    SELECT email INTO v_co_email FROM public.co_applicants WHERE app_id = app_rec.app_id LIMIT 1;
    v_co_email := COALESCE(v_co_email, v_tok.signer_email, app_rec.co_applicant_email);
  END IF;

  v_consumed := public.consume_signing_token(p_token, v_ip);
  IF NOT v_consumed THEN
    RETURN '{"success": false, "message": "Signing link is no longer usable. Please request a fresh link."}'::JSONB;
  END IF;

  IF v_tok.applicant_id IS NOT NULL THEN
    UPDATE public.application_applicants
    SET lease_signature = p_signature,
        lease_signature_image = p_signature_image,
        lease_signed_at = v_now,
        lease_ip_address = p_ip_address,
        lease_user_agent = p_user_agent,
        updated_at = v_now
    WHERE id = v_tok.applicant_id;

    SELECT count(*)::int INTO v_unsigned_left
    FROM public.application_applicants
    WHERE app_id = app_rec.app_id
      AND is_primary IS FALSE
      AND lease_signature IS NULL;
  ELSE
    v_unsigned_left := 0;
  END IF;

  v_next_status := CASE WHEN v_unsigned_left = 0 THEN 'co_signed'::lease_status ELSE 'awaiting_co_sign'::lease_status END;

  UPDATE public.applications SET
    co_applicant_signature           = COALESCE(co_applicant_signature, p_signature),
    co_applicant_signature_image     = COALESCE(co_applicant_signature_image, p_signature_image),
    co_applicant_signature_timestamp = CASE WHEN v_unsigned_left = 0 THEN v_now ELSE co_applicant_signature_timestamp END,
    co_applicant_lease_token         = CASE WHEN co_applicant_lease_token = p_token THEN NULL ELSE co_applicant_lease_token END,
    lease_ip_address                 = COALESCE(NULLIF(p_ip_address, ''), lease_ip_address),
    lease_status                     = v_next_status,
    updated_at                       = v_now
  WHERE app_id = app_rec.app_id;

  INSERT INTO public.sign_events (
    app_id, applicant_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path, signature_image
  ) VALUES (
    app_rec.app_id, v_tok.applicant_id, 'co_applicant', p_signature, v_co_email,
    p_ip_address, p_user_agent, p_token, app_rec.lease_pdf_url, p_signature_image
  );

  RETURN jsonb_build_object(
    'success', true,
    'app_id', app_rec.app_id,
    'all_signed', (v_unsigned_left = 0),
    'remaining_co_applicants', v_unsigned_left,
    'lease_status', v_next_status::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_applications()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_auth_email TEXT := auth.email();
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  RETURN json_build_object(
    'success', true,
    'applications', (
      SELECT COALESCE(
        json_agg(json_build_object(
          'app_id',           a.app_id,
          'status',           a.status,
          'payment_status',   a.payment_status,
          'lease_status',     a.lease_status,
          'property_address', a.property_address,
          'created_at',       a.created_at,
          'first_name',       a.first_name,
          'last_name',        a.last_name,
          'monthly_rent',     a.monthly_rent,
          'lease_start_date', a.lease_start_date,
          'move_in_status',   a.move_in_status,
          'application_fee',  a.application_fee,
          'co_applicant_count', a.co_applicant_count,
          'email',            a.email,
          'access_role',      CASE
            WHEN a.applicant_user_id = v_uid OR lower(a.email) = lower(v_auth_email) THEN 'primary'
            ELSE 'co_applicant'
          END
        ) ORDER BY a.created_at DESC),
        '[]'::json
      )
      FROM applications a
      WHERE a.applicant_user_id = v_uid
         OR lower(a.email) = lower(v_auth_email)
         OR lower(a.co_applicant_email) = lower(v_auth_email)
         OR EXISTS (
           SELECT 1 FROM co_applicants c
           WHERE c.app_id = a.app_id AND lower(c.email) = lower(v_auth_email)
         )
         OR EXISTS (
           SELECT 1 FROM application_applicants aa
           WHERE aa.app_id = a.app_id AND lower(aa.email) = lower(v_auth_email)
         )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_apps_by_email(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_auth_email TEXT := auth.email();
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_auth_email IS NULL OR lower(v_auth_email) <> lower(COALESCE(p_email, '')) THEN
    RETURN json_build_object('success', false, 'error', 'Email does not match signed-in account');
  END IF;
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::json)
    FROM (
      SELECT DISTINCT a.app_id,
             a.property_address,
             a.created_at::date AS created_at
      FROM applications a
      WHERE lower(a.email) = lower(v_auth_email)
         OR lower(a.co_applicant_email) = lower(v_auth_email)
         OR EXISTS (
           SELECT 1 FROM co_applicants c
           WHERE c.app_id = a.app_id AND lower(c.email) = lower(v_auth_email)
         )
         OR EXISTS (
           SELECT 1 FROM application_applicants aa
           WHERE aa.app_id = a.app_id AND lower(aa.email) = lower(v_auth_email)
         )
    ) r
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_portal_state(p_app_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_email text;
  v_app   record;
  v_amendments jsonb;
BEGIN
  v_email := public.current_confirmed_email();
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT a.* INTO v_app
  FROM public.applications a
  WHERE (a.id::text = p_app_id OR a.app_id = p_app_id)
    AND (
      lower(a.email) = v_email
      OR lower(COALESCE(a.co_applicant_email, '')) = v_email
      OR EXISTS (
        SELECT 1 FROM public.application_applicants aa
        WHERE aa.application_id = a.id AND lower(COALESCE(aa.email, '')) = v_email
      )
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', la.id,
           'created_at', la.created_at,
           'effective_at', la.effective_at,
           'reason', la.reason,
           'status', la.status,
           'tenant_signed_at', la.tenant_signed_at,
           'landlord_signed_at', la.landlord_signed_at
         ) ORDER BY la.created_at DESC), '[]'::jsonb)
    INTO v_amendments
  FROM public.lease_amendments la
  WHERE la.application_id = v_app.id;

  RETURN jsonb_build_object(
    'application_id', v_app.id,
    'status', v_app.status,
    'property_id', v_app.property_id,
    'lease_executed_at', v_app.lease_executed_at,
    'amendments', v_amendments
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_my_application(p_app_id text, p_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(COALESCE(public.current_confirmed_email(), auth.email(), ''));
  v_app RECORD;
  v_note TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_app FROM public.applications WHERE app_id = p_app_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF v_app.applicant_user_id IS DISTINCT FROM v_uid
     AND lower(COALESCE(v_app.email, '')) <> v_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the primary applicant can withdraw this application');
  END IF;

  IF v_app.status IN ('withdrawn', 'denied', 'archived') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application is already ' || v_app.status::text);
  END IF;

  IF v_app.lease_status IN ('signed', 'co_signed') OR v_app.management_cosigned IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Signed leases cannot be self-withdrawn; please contact Choice Properties.');
  END IF;

  v_note := trim(both E'\n' FROM COALESCE(v_app.admin_notes, '') || E'\n[Applicant withdrew on ' || to_char(now(), 'YYYY-MM-DD HH24:MI TZ') || COALESCE(': ' || NULLIF(btrim(p_reason), ''), '') || ']');

  UPDATE public.applications
  SET status = 'withdrawn'::application_status,
      admin_notes = v_note,
      updated_at = now()
  WHERE id = v_app.id;

  -- Revoke any open consent / lease tokens on withdrawal
  UPDATE public.co_applicant_consent_tokens
  SET revoked_at = now()
  WHERE application_id = v_app.id AND consumed_at IS NULL AND revoked_at IS NULL;

  UPDATE public.lease_signing_tokens
  SET revoked_at = now(), revoke_reason = 'application_withdrawn', revoked_by = COALESCE(v_email, 'applicant')
  WHERE app_id = v_app.app_id AND used_at IS NULL AND revoked_at IS NULL;

  RETURN jsonb_build_object('success', true, 'app_id', v_app.app_id, 'status', 'withdrawn');
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_my_application(text, text) TO authenticated;
