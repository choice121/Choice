-- ============================================================================
-- Migration: QA Verification Fixes — Non-Recursive RLS Helpers, Portal RPC,
-- Consent Role Constraint, Location Notification RPC, and Pet Field Cleanup
-- Additive & idempotent.
-- ============================================================================

-- 1. Non-recursive SECURITY DEFINER RLS helper functions --------------------
-- Breaks cross-table RLS recursion (SQLSTATE 42P17) between applications,
-- application_applicants, application_documents, application_payment_transactions,
-- and leases while preventing empty-string email matches.

CREATE OR REPLACE FUNCTION public.user_belongs_to_application(p_application_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text := NULLIF(lower(btrim(COALESCE(public.current_confirmed_email(), auth.email(), ''))), '');
BEGIN
  IF p_application_id IS NULL OR (v_uid IS NULL AND v_email IS NULL) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.applications a
    WHERE a.id = p_application_id
      AND (
        (v_uid IS NOT NULL AND a.applicant_user_id = v_uid)
        OR (
          v_email IS NOT NULL
          AND (
            lower(COALESCE(a.email, '')) = v_email
            OR lower(COALESCE(a.co_applicant_email, '')) = v_email
            OR EXISTS (
              SELECT 1
              FROM public.application_applicants aa
              WHERE aa.application_id = a.id
                AND lower(COALESCE(aa.email, '')) = v_email
            )
            OR EXISTS (
              SELECT 1
              FROM public.co_applicants ca
              WHERE ca.app_id = a.app_id
                AND lower(COALESCE(ca.email, '')) = v_email
            )
          )
        )
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_confirmed_belongs_to_application(p_application_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_email text := NULLIF(lower(btrim(COALESCE(public.current_confirmed_email(), ''))), '');
BEGIN
  IF p_application_id IS NULL OR v_email IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.applications a
    WHERE a.id = p_application_id
      AND (
        lower(COALESCE(a.email, '')) = v_email
        OR lower(COALESCE(a.co_applicant_email, '')) = v_email
        OR EXISTS (
          SELECT 1
          FROM public.application_applicants aa
          WHERE aa.application_id = a.id
            AND lower(COALESCE(aa.email, '')) = v_email
        )
        OR EXISTS (
          SELECT 1
          FROM public.co_applicants ca
          WHERE ca.app_id = a.app_id
            AND lower(COALESCE(ca.email, '')) = v_email
        )
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_app_ref(p_app_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text := NULLIF(lower(btrim(COALESCE(public.current_confirmed_email(), auth.email(), ''))), '');
  v_ref   text := NULLIF(btrim(COALESCE(p_app_id, '')), '');
BEGIN
  IF v_ref IS NULL OR (v_uid IS NULL AND v_email IS NULL) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.applications a
    WHERE a.app_id = v_ref
      AND (
        (v_uid IS NOT NULL AND a.applicant_user_id = v_uid)
        OR (
          v_email IS NOT NULL
          AND (
            lower(COALESCE(a.email, '')) = v_email
            OR lower(COALESCE(a.co_applicant_email, '')) = v_email
            OR EXISTS (
              SELECT 1
              FROM public.application_applicants aa
              WHERE aa.application_id = a.id
                AND lower(COALESCE(aa.email, '')) = v_email
            )
            OR EXISTS (
              SELECT 1
              FROM public.co_applicants ca
              WHERE ca.app_id = a.app_id
                AND lower(COALESCE(ca.email, '')) = v_email
            )
          )
        )
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.landlord_owns_application(p_application_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF p_application_id IS NULL OR v_uid IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.landlords l ON l.id = a.landlord_id
    WHERE a.id = p_application_id
      AND l.user_id = v_uid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.user_belongs_to_application(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_confirmed_belongs_to_application(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_belongs_to_app_ref(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.landlord_owns_application(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.user_belongs_to_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_confirmed_belongs_to_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_app_ref(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.landlord_owns_application(uuid) TO authenticated;

-- Update cross-referencing RLS policies to use SECURITY DEFINER helpers
DROP POLICY IF EXISTS applications_tenant_select ON public.applications;
CREATE POLICY applications_tenant_select
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_application(id));

DROP POLICY IF EXISTS tenant_portal_select ON public.applications;
CREATE POLICY tenant_portal_select
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (public.user_confirmed_belongs_to_application(id));

DROP POLICY IF EXISTS app_applicants_tenant_select ON public.application_applicants;
CREATE POLICY app_applicants_tenant_select
  ON public.application_applicants
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_application(application_id));

DROP POLICY IF EXISTS app_applicants_landlord_select ON public.application_applicants;
CREATE POLICY app_applicants_landlord_select
  ON public.application_applicants
  FOR SELECT
  TO authenticated
  USING (public.landlord_owns_application(application_id));

DROP POLICY IF EXISTS application_documents_applicant_read ON public.application_documents;
CREATE POLICY application_documents_applicant_read
  ON public.application_documents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.user_belongs_to_app_ref(app_id));

DROP POLICY IF EXISTS "Household members can view own payment transactions" ON public.application_payment_transactions;
CREATE POLICY "Household members can view own payment transactions"
  ON public.application_payment_transactions
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_app_ref(app_id));

DROP POLICY IF EXISTS leases_tenant_select ON public.leases;
CREATE POLICY leases_tenant_select
  ON public.leases
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_application(application_id));

-- 2. Fix tenant_portal_state RPC (removes nonexistent lease_executed_at, ----
-- returns full payload expected by js/tenant/portal.js, and includes issued receipts)
CREATE OR REPLACE FUNCTION public.tenant_portal_state(p_app_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_uid          uuid := auth.uid();
  v_email        text := NULLIF(lower(btrim(COALESCE(public.current_confirmed_email(), auth.email(), ''))), '');
  v_app          public.applications%ROWTYPE;
  v_property     jsonb;
  v_cover_photo  jsonb;
  v_documents    jsonb;
  v_amendments   jsonb;
  v_receipts     jsonb;
  v_transactions jsonb;
BEGIN
  IF v_uid IS NULL AND v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT a.* INTO v_app
  FROM public.applications a
  WHERE (a.id::text = p_app_id OR a.app_id = p_app_id)
    AND (
      (v_uid IS NOT NULL AND a.applicant_user_id = v_uid)
      OR (
        v_email IS NOT NULL
        AND (
          lower(COALESCE(a.email, '')) = v_email
          OR lower(COALESCE(a.co_applicant_email, '')) = v_email
          OR EXISTS (
            SELECT 1 FROM public.application_applicants aa
            WHERE aa.application_id = a.id
              AND lower(COALESCE(aa.email, '')) = v_email
          )
          OR EXISTS (
            SELECT 1 FROM public.co_applicants ca
            WHERE ca.app_id = a.app_id
              AND lower(COALESCE(ca.email, '')) = v_email
          )
        )
      )
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF v_app.property_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', p.id,
      'address', p.address,
      'city', p.city,
      'state', p.state,
      'zip', p.zip,
      'bedrooms', p.bedrooms,
      'bathrooms', p.bathrooms,
      'property_type', p.property_type
    )
    INTO v_property
    FROM public.properties p
    WHERE p.id = v_app.property_id
    LIMIT 1;

    SELECT jsonb_build_object('url', pp.url)
    INTO v_cover_photo
    FROM public.property_photos pp
    WHERE pp.property_id = v_app.property_id
    ORDER BY pp.display_order ASC NULLS LAST
    LIMIT 1;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', d.id,
           'app_id', d.app_id,
           'applicant_id', d.applicant_id,
           'bucket', d.bucket,
           'storage_path', d.storage_path,
           'original_file_name', d.original_file_name,
           'doc_type', d.doc_type,
           'review_status', d.review_status,
           'review_notes', d.review_notes,
           'uploaded_by_email', d.uploaded_by_email,
           'created_at', d.created_at
         ) ORDER BY d.created_at DESC), '[]'::jsonb)
    INTO v_documents
  FROM public.application_documents d
  WHERE d.app_id = v_app.app_id;

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
           'issued_at', pr.issued_at,
           'status', pr.status,
           'fee_breakdown', pr.fee_breakdown
         ) ORDER BY COALESCE(pr.issued_at, pr.paid_at) DESC), '[]'::jsonb)
    INTO v_receipts
  FROM public.payment_receipts pr
  WHERE pr.app_id = v_app.app_id
    AND pr.status IN ('issued', 'active');

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
    'success', true,
    'app', (to_jsonb(v_app) - 'ssn' - 'co_applicant_ssn' - 'lease_ip_address'),
    'property', v_property,
    'cover_photo', v_cover_photo,
    'documents', v_documents,
    'application_id', v_app.id,
    'status', v_app.status,
    'property_id', v_app.property_id,
    'lease_executed_at', COALESCE(v_app.management_cosigned_at, v_app.lease_signed_date),
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

GRANT EXECUTE ON FUNCTION public.tenant_portal_state(text) TO authenticated;

-- 3. Allow guarantor & co_signer roles in screening consent events ------------
ALTER TABLE public.application_screening_consent_events
  DROP CONSTRAINT IF EXISTS application_screening_consent_events_applicant_type_check;

ALTER TABLE public.application_screening_consent_events
  ADD CONSTRAINT application_screening_consent_events_applicant_type_check
  CHECK (applicant_type = ANY (ARRAY['primary'::text, 'co_applicant'::text, 'guarantor'::text, 'co_signer'::text]));

-- 4. Eliminate 404 on admin dashboard get_location_notifications() ----------
CREATE OR REPLACE FUNCTION public.get_location_notifications()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT '[]'::jsonb;
$$;

REVOKE ALL ON FUNCTION public.get_location_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_location_notifications() TO authenticated;

-- 5. Enforce AGENTS.md pet policy removal on active property listings -------
UPDATE public.properties
SET pets_allowed = NULL,
    pet_types_allowed = NULL,
    pet_deposit = NULL
WHERE status = 'active'
  AND (
    pets_allowed IS NOT NULL
    OR pet_types_allowed IS NOT NULL
    OR pet_deposit IS NOT NULL
  );
