-- Migration: Household Role Separation, Method A/B Submission Tracking,
-- Itemized Per-Screening Fee Breakdown, Separated Financial Support Totals,
-- and Role-Accurate Consent & Lease Signing RPCs.
-- Additive & idempotent. Preserves backward compatibility with existing columns and RPCs.

-- 1. Extend application_applicants for Method A vs B, Guarantor Housing Status & Fee Attribution
ALTER TABLE public.application_applicants
  ADD COLUMN IF NOT EXISTS submission_method text NOT NULL DEFAULT 'primary_completed'
    CHECK (submission_method IN ('primary_completed', 'invited')),
  ADD COLUMN IF NOT EXISTS info_completed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS info_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS housing_status text,
  ADD COLUMN IF NOT EXISTS is_occupant boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS screening_fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS screening_status text NOT NULL DEFAULT 'pending_consent',
  ADD COLUMN IF NOT EXISTS financial_support_notes text;

-- Backfill is_occupant & info_completed on existing rows
UPDATE public.application_applicants
SET
  is_occupant = CASE
    WHEN applicant_type IN ('guarantor', 'co_signer') THEN false
    ELSE true
  END,
  info_completed_at = COALESCE(info_completed_at, created_at),
  screening_status = CASE
    WHEN screening_consent IS TRUE THEN 'consented'
    ELSE 'pending_consent'
  END;

-- Re-grant SELECT on safe non-sensitive columns to authenticated (omits ssn_encrypted & ssn_hash)
GRANT SELECT (
  submission_method, info_completed, info_completed_at,
  housing_status, is_occupant, screening_fee_amount,
  screening_status, financial_support_notes
) ON public.application_applicants TO authenticated;

-- 2. Extend applications with separated financial totals & itemized fee breakdown
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS household_monthly_income numeric,
  ADD COLUMN IF NOT EXISTS guarantor_monthly_income numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS co_signer_monthly_income numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_financial_support numeric,
  ADD COLUMN IF NOT EXISTS occupying_adult_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS guarantor_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS co_signer_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_breakdown jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS jurisdiction_fee_note text;

-- 3. Deterministic Household Recalculation Function ----------------------------------
-- Recomputes occupant-only household income, guarantor/co-signer financial support,
-- approved per-screening household fees ($50 primary, $0 1st co-app, $50 2nd+ co-app,
-- $50 per guarantor, $50 per co-signer), and syncs applications summary columns.
CREATE OR REPLACE FUNCTION public.recalculate_application_household_metrics(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app               public.applications%ROWTYPE;
  v_rec               RECORD;
  v_base_fee          numeric := 50;
  v_co_seq            int := 0;
  v_occ_adults        int := 0;
  v_co_count          int := 0;
  v_guar_count        int := 0;
  v_cosig_count       int := 0;
  v_prim_inc          numeric := 0;
  v_co_inc            numeric := 0;
  v_guar_inc          numeric := 0;
  v_cosig_inc         numeric := 0;
  v_household_inc     numeric := 0;
  v_total_support     numeric := 0;
  v_std_fee           numeric := 0;
  v_final_fee         numeric := 0;
  v_member_fee        numeric := 0;
  v_breakdown         jsonb := '[]'::jsonb;
  v_credit_applied    boolean := false;
  v_all_consented     boolean := true;
  v_row_inc           numeric;
  v_norm_type         text;
  v_is_occ            boolean;
  v_note              text;
BEGIN
  SELECT * INTO v_app FROM public.applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;

  v_credit_applied := (v_app.credit_applied_id IS NOT NULL);
  IF COALESCE(v_app.payment_status::text, 'unpaid') = 'waived' AND COALESCE(v_app.application_fee, 0) = 0 THEN
    -- Preserve waived $0 when credit applied; otherwise default $50 per-screening schedule
    IF v_credit_applied THEN
      v_base_fee := 50;
    END IF;
  END IF;

  FOR v_rec IN
    SELECT *
    FROM public.application_applicants
    WHERE application_id = p_application_id
    ORDER BY applicant_index ASC
  LOOP
    v_norm_type := CASE
      WHEN v_rec.is_primary THEN 'primary'
      WHEN lower(COALESCE(v_rec.applicant_type, v_rec.role, '')) LIKE '%guarantor%' THEN 'guarantor'
      WHEN lower(COALESCE(v_rec.applicant_type, v_rec.role, '')) LIKE '%signer%' THEN 'co_signer'
      ELSE 'co_applicant'
    END;
    v_is_occ := (v_norm_type IN ('primary', 'co_applicant'));
    v_row_inc := COALESCE(NULLIF(regexp_replace(COALESCE(v_rec.monthly_income, ''), '[^0-9.]', '', 'g'), '')::numeric, 0)
               + COALESCE(NULLIF(regexp_replace(COALESCE(v_rec.other_income, ''), '[^0-9.]', '', 'g'), '')::numeric, 0);

    IF v_norm_type = 'primary' THEN
      v_occ_adults := v_occ_adults + 1;
      v_prim_inc := v_prim_inc + v_row_inc;
      v_member_fee := v_base_fee;
      v_note := 'Primary applicant screening fee';
    ELSIF v_norm_type = 'co_applicant' THEN
      v_occ_adults := v_occ_adults + 1;
      v_co_count := v_co_count + 1;
      v_co_seq := v_co_seq + 1;
      v_co_inc := v_co_inc + v_row_inc;
      IF v_co_seq = 1 THEN
        v_member_fee := 0;
        v_note := '1st additional co-applicant included ($0)';
      ELSE
        v_member_fee := v_base_fee;
        v_note := 'Additional occupying co-applicant';
      END IF;
    ELSIF v_norm_type = 'guarantor' THEN
      v_guar_count := v_guar_count + 1;
      v_guar_inc := v_guar_inc + v_row_inc;
      v_member_fee := v_base_fee;
      v_note := 'Guarantor financial screening';
    ELSE
      v_cosig_count := v_cosig_count + 1;
      v_cosig_inc := v_cosig_inc + v_row_inc;
      v_member_fee := v_base_fee;
      v_note := 'Co-signer financial screening';
    END IF;

    IF v_rec.is_primary IS FALSE AND v_rec.screening_consent IS DISTINCT FROM TRUE THEN
      v_all_consented := false;
    END IF;

    v_std_fee := v_std_fee + v_member_fee;

    UPDATE public.application_applicants
    SET applicant_type = v_norm_type,
        is_occupant = v_is_occ,
        screening_fee_amount = CASE WHEN v_credit_applied THEN 0 ELSE v_member_fee END,
        updated_at = now()
    WHERE id = v_rec.id;

    v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object(
      'applicant_index', v_rec.applicant_index,
      'name', NULLIF(btrim(COALESCE(v_rec.first_name, '') || ' ' || COALESCE(v_rec.last_name, '')), ''),
      'applicant_type', v_norm_type,
      'role_label', COALESCE(v_rec.role, initcap(replace(v_norm_type, '_', ' '))),
      'submission_method', COALESCE(v_rec.submission_method, 'primary_completed'),
      'is_occupant', v_is_occ,
      'standard_fee', v_member_fee,
      'fee', CASE WHEN v_credit_applied THEN 0 ELSE v_member_fee END,
      'included_free', (v_norm_type = 'co_applicant' AND v_co_seq = 1),
      'note', v_note
    ));
  END LOOP;

  v_household_inc := v_prim_inc + v_co_inc;
  v_total_support := v_household_inc + v_guar_inc + v_cosig_inc;
  v_final_fee := CASE WHEN v_credit_applied THEN 0 ELSE v_std_fee END;

  UPDATE public.applications
  SET
    household_monthly_income = v_household_inc,
    combined_monthly_income  = v_household_inc, -- Household income reflects occupants only (no guarantor/co-signer inflation)
    guarantor_monthly_income = v_guar_inc,
    co_signer_monthly_income = v_cosig_inc,
    total_financial_support  = v_total_support,
    occupying_adult_count    = GREATEST(1, v_occ_adults),
    co_applicant_count       = (v_co_count + v_guar_count + v_cosig_count),
    guarantor_count          = v_guar_count,
    co_signer_count          = v_cosig_count,
    has_co_applicant         = ((v_co_count + v_guar_count + v_cosig_count) > 0),
    application_fee          = CASE WHEN COALESCE(payment_status::text, 'unpaid') = 'paid' THEN application_fee ELSE v_final_fee END,
    fee_breakdown            = v_breakdown,
    co_applicant_consent     = CASE WHEN (v_co_count + v_guar_count + v_cosig_count) > 0 THEN v_all_consented ELSE COALESCE(co_applicant_consent, false) END,
    updated_at               = now()
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'household_monthly_income', v_household_inc,
    'guarantor_monthly_income', v_guar_inc,
    'co_signer_monthly_income', v_cosig_inc,
    'total_financial_support', v_total_support,
    'occupying_adult_count', GREATEST(1, v_occ_adults),
    'application_fee', v_final_fee,
    'fee_breakdown', v_breakdown
  );
END;
$$;

-- 5. Update approval gate to block approval transitions when ANY additional person lacks consent OR info_completed=false
CREATE OR REPLACE FUNCTION public.prevent_approval_without_co_applicant_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unconsented integer := 0;
  v_incomplete integer := 0;
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT
      count(*) FILTER (WHERE screening_consent IS DISTINCT FROM TRUE)::int,
      count(*) FILTER (WHERE info_completed IS FALSE)::int
    INTO v_unconsented, v_incomplete
    FROM public.application_applicants
    WHERE application_id = NEW.id
      AND is_primary IS FALSE;

    IF v_incomplete > 0 THEN
      RAISE EXCEPTION 'All invited household members must complete their required information before approval (% pending)', v_incomplete;
    END IF;

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

-- Backfill metrics for existing rows without altering already-paid legacy fees
SELECT public.recalculate_application_household_metrics(id)
FROM public.applications
WHERE household_monthly_income IS NULL;

-- 4. Update confirm_co_applicant_screening to record exact applicant_type & mark info_completed
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
  v_applicant_type text := 'co_applicant';
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

  IF v_token_applicant_id IS NOT NULL THEN
    UPDATE public.application_applicants
    SET screening_consent = true,
        screening_consent_timestamp = v_consented_at,
        screening_consent_version = p_consent_version,
        screening_consent_ip = p_ip,
        screening_status = 'consented',
        info_completed = true,
        info_completed_at = COALESCE(info_completed_at, v_consented_at),
        updated_at = v_consented_at
    WHERE id = v_token_applicant_id
      AND application_id = v_application_id
      AND is_primary IS FALSE
    RETURNING id, applicant_type INTO v_matched_applicant_id, v_applicant_type;
  END IF;

  IF v_matched_applicant_id IS NULL THEN
    UPDATE public.application_applicants
    SET screening_consent = true,
        screening_consent_timestamp = v_consented_at,
        screening_consent_version = p_consent_version,
        screening_consent_ip = p_ip,
        screening_status = 'consented',
        info_completed = true,
        info_completed_at = COALESCE(info_completed_at, v_consented_at),
        updated_at = v_consented_at
    WHERE id = (
      SELECT id FROM public.application_applicants
      WHERE application_id = v_application_id
        AND is_primary IS FALSE
        AND lower(COALESCE(email, '')) = lower(COALESCE(v_recipient_email, ''))
      ORDER BY applicant_index ASC
      LIMIT 1
    )
    RETURNING id, applicant_type INTO v_matched_applicant_id, v_applicant_type;
  END IF;

  IF v_matched_applicant_id IS NOT NULL THEN
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

    PERFORM public.recalculate_application_household_metrics(v_application_id);
  ELSE
    UPDATE public.applications
    SET co_applicant_consent = true,
        co_applicant_consent_timestamp = v_consented_at,
        co_applicant_consent_version = p_consent_version,
        updated_at = v_consented_at
    WHERE id = v_application_id
      AND has_co_applicant IS TRUE
      AND lower(co_applicant_email) = lower(v_recipient_email);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Consent link does not match an additional person on the application';
    END IF;
  END IF;

  INSERT INTO public.application_screening_consent_events (
    application_id, applicant_id, applicant_type, consent_version, consented_at, ip, user_agent
  ) VALUES (
    v_application_id, v_matched_applicant_id, COALESCE(v_applicant_type, 'co_applicant'), p_consent_version, v_consented_at, p_ip, p_user_agent
  );

  RETURN v_application_id;
END;
$$;

-- (Approval gate updated in Section 5 above before backfill)

-- 6. Admin Role Update RPC (allows admin to change a member's role cleanly & recalculate fees/household income)
CREATE OR REPLACE FUNCTION public.admin_update_applicant_role(
  p_application_id uuid,
  p_applicant_id uuid,
  p_new_applicant_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_norm_type text;
  v_role_label text;
  v_is_occ boolean;
  v_rec public.application_applicants%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_new_applicant_type NOT IN ('co_applicant', 'guarantor', 'co_signer') THEN
    RAISE EXCEPTION 'Invalid applicant role: %', p_new_applicant_type;
  END IF;

  v_norm_type := p_new_applicant_type;
  v_is_occ := (v_norm_type = 'co_applicant');
  v_role_label := CASE v_norm_type
    WHEN 'guarantor' THEN 'Guarantor'
    WHEN 'co_signer' THEN 'Co-Signer'
    ELSE 'Co-Applicant'
  END;

  SELECT * INTO v_rec
  FROM public.application_applicants
  WHERE id = p_applicant_id AND application_id = p_application_id AND is_primary IS FALSE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Household member not found or cannot change primary role');
  END IF;

  UPDATE public.application_applicants
  SET applicant_type = v_norm_type,
      role = v_role_label,
      is_occupant = v_is_occ,
      updated_at = now()
  WHERE id = p_applicant_id;

  IF v_rec.applicant_index = 1 THEN
    UPDATE public.applications
    SET additional_person_role = v_role_label,
        co_applicant_role = v_role_label,
        updated_at = now()
    WHERE id = p_application_id;
  END IF;

  RETURN public.recalculate_application_household_metrics(p_application_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_applicant_role(uuid, uuid, text) TO authenticated;

-- 7. Update lookup_signer_for_token to return applicant_type accurately for lease signing UI
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
      'success',           true,
      'app_id',            v_app.app_id,
      'applicant_id',      v_applicant.id,
      'applicant_type',    COALESCE(v_applicant.applicant_type, CASE WHEN v_signer_type = 'tenant' THEN 'primary' ELSE 'co_applicant' END),
      'is_occupant',       COALESCE(v_applicant.is_occupant, true),
      'signer_index',      COALESCE(v_applicant.applicant_index, CASE WHEN v_signer_type = 'tenant' THEN 0 ELSE 1 END),
      'signer_role_label', COALESCE(v_applicant.role, CASE WHEN v_signer_type = 'tenant' THEN 'Primary Applicant' ELSE 'Co-Applicant' END),
      'signer_type',       v_signer_type,
      'signer_email',      v_signer_email,
      'signer_name',       v_signer_name,
      'lease_status',      v_app.lease_status,
      'already_signed',    v_already,
      'expires_at',        v_token_meta.expires_at
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
      'applicant_type', 'primary',
      'is_occupant',    true,
      'signer_role_label', 'Primary Applicant',
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
      'applicant_type', 'co_applicant',
      'is_occupant',    true,
      'signer_role_label', 'Co-Applicant',
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
