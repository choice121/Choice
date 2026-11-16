-- ============================================================================
-- Migration: Household Payment Arrangements ($50/Adult), Per-Member Payments,
-- 11-State Lifecycle Support, Receipt Breakdown, and Portal/Dashboard RPCs
-- Additive & idempotent. Preserves all existing dashboard/portal structures.
-- ============================================================================

-- 1. Extend applications for Household Payment Mode & Info Required notes ----
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS household_payment_mode text NOT NULL DEFAULT 'centralized',
  ADD COLUMN IF NOT EXISTS additional_info_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_household_payment_mode_check'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_household_payment_mode_check
      CHECK (household_payment_mode IN ('centralized', 'individual'));
  END IF;
END$$;

-- Ensure application_payment_state allows all 7 payment-stage lifecycle states
ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_payment_state_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_payment_state_check
  CHECK (
    application_payment_state IS NULL OR application_payment_state IN (
      'Application Started',
      'Application Submitted',
      'Awaiting Payment',
      'Payment Processing',
      'Payment Successful',
      'Payment Failed',
      'Payment Assistance Required'
    )
  );

-- 2. Extend application_applicants for Option B per-member payment tracking --
ALTER TABLE public.application_applicants
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS application_payment_state text NOT NULL DEFAULT 'Awaiting Payment',
  ADD COLUMN IF NOT EXISTS payment_amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS payment_transaction_ref text,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_card_brand text,
  ADD COLUMN IF NOT EXISTS payment_card_last4 text,
  ADD COLUMN IF NOT EXISTS payment_failure_code text,
  ADD COLUMN IF NOT EXISTS payment_failure_reason text,
  ADD COLUMN IF NOT EXISTS payment_attempts_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_assistance_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_applicants_payment_status_check'
  ) THEN
    ALTER TABLE public.application_applicants
      ADD CONSTRAINT app_applicants_payment_status_check
      CHECK (payment_status IN ('unpaid', 'paid', 'waived', 'refunded'));
  END IF;
END$$;

-- Backfill existing paid/waived applications onto their household members
UPDATE public.application_applicants aa
SET
  payment_status = CASE
    WHEN COALESCE(a.payment_status::text, 'unpaid') = 'paid' THEN 'paid'
    WHEN COALESCE(a.payment_status::text, 'unpaid') = 'waived' THEN 'waived'
    WHEN COALESCE(a.payment_status::text, 'unpaid') = 'refunded' THEN 'refunded'
    ELSE 'unpaid'
  END,
  application_payment_state = CASE
    WHEN COALESCE(a.payment_status::text, 'unpaid') IN ('paid', 'waived') THEN 'Payment Successful'
    WHEN COALESCE(a.application_payment_state, '') <> '' THEN a.application_payment_state
    ELSE 'Awaiting Payment'
  END,
  payment_amount = COALESCE(aa.payment_amount, aa.screening_fee_amount),
  payment_transaction_ref = COALESCE(aa.payment_transaction_ref, a.payment_transaction_ref),
  payment_provider = COALESCE(aa.payment_provider, a.payment_provider),
  payment_card_brand = COALESCE(aa.payment_card_brand, a.payment_card_brand),
  payment_card_last4 = COALESCE(aa.payment_card_last4, a.payment_card_last4),
  payment_confirmed_at = COALESCE(aa.payment_confirmed_at, a.payment_confirmed_at)
FROM public.applications a
WHERE aa.application_id = a.id
  AND COALESCE(a.payment_status::text, 'unpaid') IN ('paid', 'waived', 'refunded')
  AND aa.payment_status = 'unpaid';

GRANT SELECT (
  payment_status,
  application_payment_state,
  payment_amount,
  payment_transaction_ref,
  payment_provider,
  payment_card_brand,
  payment_card_last4,
  payment_failure_code,
  payment_failure_reason,
  payment_attempts_count,
  payment_assistance_required,
  payment_confirmed_at
) ON public.application_applicants TO authenticated;

-- 3. Extend application_payment_transactions for member attribution & RLS -----
ALTER TABLE public.application_payment_transactions
  ADD COLUMN IF NOT EXISTS applicant_id uuid REFERENCES public.application_applicants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payer_name text;

CREATE INDEX IF NOT EXISTS idx_app_payment_tx_applicant_id
  ON public.application_payment_transactions (applicant_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'application_payment_transactions'
      AND policyname = 'Household members can view own payment transactions'
  ) THEN
    CREATE POLICY "Household members can view own payment transactions"
      ON public.application_payment_transactions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.applications a
          WHERE a.app_id = application_payment_transactions.app_id
            AND (
              a.applicant_user_id = auth.uid()
              OR lower(COALESCE(a.email, '')) = lower(COALESCE(public.current_confirmed_email(), ''))
              OR lower(COALESCE(a.co_applicant_email, '')) = lower(COALESCE(public.current_confirmed_email(), ''))
              OR EXISTS (
                SELECT 1 FROM public.application_applicants aa
                WHERE aa.application_id = a.id
                  AND lower(COALESCE(aa.email, '')) = lower(COALESCE(public.current_confirmed_email(), ''))
              )
            )
        )
      );
  END IF;
END$$;

-- 4. Extend payment_receipts for per-member Option B receipts & breakdown ----
ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS applicant_id uuid REFERENCES public.application_applicants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_breakdown jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_payment_receipts_applicant_id
  ON public.payment_receipts (applicant_id);

-- 5. Update Household Recalculation: strict $50/adult screening (NO $0 rule) --
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
      v_note := 'Primary applicant screening ($50)';
    ELSIF v_norm_type = 'co_applicant' THEN
      v_occ_adults := v_occ_adults + 1;
      v_co_count := v_co_count + 1;
      v_co_inc := v_co_inc + v_row_inc;
      v_member_fee := v_base_fee;
      v_note := 'Occupying adult co-applicant screening ($50)';
    ELSIF v_norm_type = 'guarantor' THEN
      v_guar_count := v_guar_count + 1;
      v_guar_inc := v_guar_inc + v_row_inc;
      v_member_fee := v_base_fee;
      v_note := 'Non-occupying guarantor screening ($50)';
    ELSE
      v_cosig_count := v_cosig_count + 1;
      v_cosig_inc := v_cosig_inc + v_row_inc;
      v_member_fee := v_base_fee;
      v_note := 'Co-signer financial screening ($50)';
    END IF;

    IF v_rec.is_primary IS FALSE AND v_rec.screening_consent IS DISTINCT FROM TRUE THEN
      v_all_consented := false;
    END IF;

    v_std_fee := v_std_fee + v_member_fee;

    UPDATE public.application_applicants
    SET applicant_type = v_norm_type,
        is_occupant = v_is_occ,
        screening_fee_amount = CASE
          WHEN v_credit_applied THEN 0
          WHEN COALESCE(v_app.payment_status::text, 'unpaid') = 'paid' THEN COALESCE(NULLIF(screening_fee_amount, 0), v_member_fee)
          ELSE v_member_fee
        END,
        payment_status = CASE
          WHEN v_credit_applied AND payment_status = 'unpaid' THEN 'waived'
          ELSE payment_status
        END,
        application_payment_state = CASE
          WHEN v_credit_applied AND payment_status IN ('unpaid', 'waived') THEN 'Payment Successful'
          ELSE application_payment_state
        END,
        updated_at = now()
    WHERE id = v_rec.id;

    v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object(
      'applicant_id', v_rec.id,
      'applicant_index', v_rec.applicant_index,
      'name', NULLIF(btrim(COALESCE(v_rec.first_name, '') || ' ' || COALESCE(v_rec.last_name, '')), ''),
      'applicant_type', v_norm_type,
      'role_label', COALESCE(v_rec.role, initcap(replace(v_norm_type, '_', ' '))),
      'submission_method', COALESCE(v_rec.submission_method, 'primary_completed'),
      'is_occupant', v_is_occ,
      'standard_fee', v_member_fee,
      'fee', CASE WHEN v_credit_applied THEN 0 ELSE v_member_fee END,
      'included_free', false,
      'payment_status', CASE WHEN v_credit_applied THEN 'waived' ELSE COALESCE(v_rec.payment_status, 'unpaid') END,
      'note', CASE WHEN v_credit_applied THEN 'Application credit applied ($0)' ELSE v_note END
    ));
  END LOOP;

  v_household_inc := v_prim_inc + v_co_inc;
  v_total_support := v_household_inc + v_guar_inc + v_cosig_inc;
  v_final_fee := CASE WHEN v_credit_applied THEN 0 ELSE v_std_fee END;

  UPDATE public.applications
  SET
    household_monthly_income = v_household_inc,
    combined_monthly_income  = v_household_inc,
    guarantor_monthly_income = v_guar_inc,
    co_signer_monthly_income = v_cosig_inc,
    total_financial_support  = v_total_support,
    occupying_adult_count    = GREATEST(1, v_occ_adults),
    co_applicant_count       = (v_co_count + v_guar_count + v_cosig_count),
    guarantor_count          = v_guar_count,
    co_signer_count          = v_cosig_count,
    screened_adult_count     = GREATEST(1, v_occ_adults + v_guar_count + v_cosig_count),
    has_co_applicant         = ((v_co_count + v_guar_count + v_cosig_count) > 0),
    application_fee          = CASE WHEN COALESCE(payment_status::text, 'unpaid') = 'paid' THEN application_fee ELSE v_final_fee END,
    fee_breakdown            = CASE WHEN COALESCE(payment_status::text, 'unpaid') = 'paid' AND jsonb_array_length(COALESCE(fee_breakdown, '[]'::jsonb)) > 0 THEN fee_breakdown ELSE v_breakdown END,
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

-- Recompute unpaid/new apps with updated $50/adult policy (preserves paid legacy fees)
SELECT public.recalculate_application_household_metrics(id)
FROM public.applications
WHERE COALESCE(payment_status::text, 'unpaid') <> 'paid';

-- 6. Update dashboard_pulse to expose under_review & additional_info_required --
CREATE OR REPLACE FUNCTION public.dashboard_pulse(
  range_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  recent_limit integer DEFAULT 8
)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with
    apps_in_range as (
      select status, lease_status, move_in_status, payment_status, created_at
      from applications
      where status <> 'archived'
        and (range_start is null or created_at >= range_start)
    ),
    apps_all as (
      select status, lease_status, move_in_status, payment_status, created_at
      from applications
      where status <> 'archived'
    ),
    app_counts as (
      select
        count(*)                                                              as total,
        count(*) filter (where status = 'pending')                            as pending,
        count(*) filter (where status = 'under_review')                       as under_review,
        count(*) filter (where status = 'additional_info_required')           as additional_info_required,
        count(*) filter (where status = 'approved')                           as approved,
        count(*) filter (where status = 'denied')                             as denied,
        count(*) filter (where status = 'waitlisted')                         as waitlisted,
        count(*) filter (where status = 'approved'
                          and (payment_status is null
                               or payment_status = 'unpaid'))                 as unpaid_approved
      from apps_in_range
    ),
    month_count as (
      select count(*) as this_month
      from apps_all
      where created_at >= date_trunc('month', now())
    ),
    lease_counts as (
      select
        count(*) filter (where lease_status is null
                          or lease_status = 'none')                            as lease_pending,
        count(*) filter (where lease_status = 'sent')                          as lease_sent,
        count(*) filter (where lease_status = 'signed'
                          or lease_status = 'awaiting_co_sign')                as lease_signed,
        count(*) filter (where lease_status = 'co_signed')                     as lease_executed
      from apps_all
    ),
    movein_counts as (
      select
        count(*) filter (where move_in_status = 'pending')                     as movein_pending,
        count(*) filter (where move_in_status = 'confirmed')                   as movein_confirmed
      from apps_all
    ),
    listing_counts as (
      select count(*) filter (where status = 'active') as active_listings
      from properties
    ),
    failed_emails as (
      select count(*) as failed_emails_48h
      from email_logs
      where status = 'failed'
        and created_at >= now() - interval '48 hours'
    ),
    recent as (
      select
        id, app_id, first_name, last_name, email,
        status, payment_status, application_payment_state, household_payment_mode,
        lease_status, move_in_status, property_address, created_at
      from applications
      where status <> 'archived'
      order by created_at desc
      limit greatest(1, least(coalesce(recent_limit, 8), 50))
    )
  select json_build_object(
    'counts', (
      (select row_to_json(app_counts)        from app_counts)::jsonb
      || (select row_to_json(month_count)    from month_count)::jsonb
      || (select row_to_json(lease_counts)   from lease_counts)::jsonb
      || (select row_to_json(movein_counts)  from movein_counts)::jsonb
      || (select row_to_json(listing_counts) from listing_counts)::jsonb
      || (select row_to_json(failed_emails)  from failed_emails)::jsonb
    ),
    'recent', (select coalesce(json_agg(r order by r.created_at desc), '[]'::json) from recent r),
    'range_start', range_start,
    'generated_at', now()
  );
$function$;

-- 7. Update get_my_applications & tenant_portal_state for authenticated portal --
CREATE OR REPLACE FUNCTION public.get_my_applications()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
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
          'app_id',                    a.app_id,
          'status',                    a.status,
          'payment_status',            a.payment_status,
          'application_payment_state', a.application_payment_state,
          'household_payment_mode',    COALESCE(a.household_payment_mode, 'centralized'),
          'additional_info_note',      a.additional_info_note,
          'payment_amount_collected',  a.payment_amount_collected,
          'lease_status',              a.lease_status,
          'property_address',          a.property_address,
          'created_at',                a.created_at,
          'first_name',                a.first_name,
          'last_name',                 a.last_name,
          'monthly_rent',              a.monthly_rent,
          'lease_start_date',          a.lease_start_date,
          'move_in_status',            a.move_in_status,
          'application_fee',           a.application_fee,
          'co_applicant_count',        a.co_applicant_count,
          'occupying_adult_count',     a.occupying_adult_count,
          'guarantor_count',           a.guarantor_count,
          'co_signer_count',           a.co_signer_count,
          'email',                     a.email,
          'access_role',               CASE
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
$function$;

CREATE OR REPLACE FUNCTION public.tenant_portal_state(p_app_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_email        text;
  v_app          record;
  v_amendments   jsonb;
  v_receipts     jsonb;
  v_transactions jsonb;
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', pr.id,
           'app_id', pr.app_id,
           'applicant_id', pr.applicant_id,
           'receipt_type', pr.receipt_type,
           'receipt_number', pr.receipt_number,
           'amount', pr.amount,
           'currency', pr.currency,
           'payment_method', pr.payment_method,
           'transaction_ref', pr.transaction_ref,
           'paid_at', pr.paid_at,
           'fee_breakdown', pr.fee_breakdown
         ) ORDER BY pr.paid_at DESC), '[]'::jsonb)
    INTO v_receipts
  FROM public.payment_receipts pr
  WHERE pr.app_id = v_app.app_id
    AND pr.status = 'active';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', tx.id,
           'applicant_id', tx.applicant_id,
           'payer_name', tx.payer_name,
           'transaction_ref', tx.transaction_ref,
           'provider', tx.provider,
           'state', tx.state,
           'amount', tx.amount,
           'currency', tx.currency,
           'card_brand', tx.card_brand,
           'card_last4', tx.card_last4,
           'failure_code', tx.failure_code,
           'failure_reason', tx.failure_reason,
           'attempt_number', tx.attempt_number,
           'created_at', tx.created_at
         ) ORDER BY tx.created_at DESC), '[]'::jsonb)
    INTO v_transactions
  FROM public.application_payment_transactions tx
  WHERE tx.app_id = v_app.app_id;

  RETURN jsonb_build_object(
    'application_id', v_app.id,
    'status', v_app.status,
    'property_id', v_app.property_id,
    'lease_executed_at', v_app.lease_executed_at,
    'household_payment_mode', COALESCE(v_app.household_payment_mode, 'centralized'),
    'application_payment_state', v_app.application_payment_state,
    'additional_info_note', v_app.additional_info_note,
    'payment_amount_collected', v_app.payment_amount_collected,
    'amendments', v_amendments,
    'receipts', v_receipts,
    'transactions', v_transactions
  );
END;
$function$;
