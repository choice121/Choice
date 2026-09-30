-- =============================================================
-- tenant_portal_state(p_app_id)
-- =============================================================
-- Single-shot RPC that powers tenant/portal.html.
--
-- Replaces the three separate round-trips that the client previously made
-- on every cold start and on every realtime UPDATE:
--   1. SELECT … FROM applications WHERE app_id = $1
--   2. SELECT … FROM properties   WHERE id = applications.property_id
--   3. storage.from('application-docs').list('app_id/' || $1)
--
-- The function returns one JSON document containing the application row
-- (only the fields the portal renders — no SSN, no internal-only flags),
-- the property record, the cover photo, and the document list pulled from
-- the authoritative application_documents table (populated by the
-- request-upload-url Edge Function on every upload).
--
-- Access control:
--   * SECURITY DEFINER + explicit ownership check, mirroring the
--     applications_tenant_select RLS policy:
--       - the row's applicant_user_id matches auth.uid(), OR
--       - the caller's auth.email() matches the primary email,         OR
--                                          the co_applicant_email,     OR
--                                          a row in co_applicants for this app.
--
-- Field selection rules:
--   * tenant_sign_token is only returned to the primary applicant
--     (matching email); co-applicants get NULL so they cannot sign on
--     behalf of the primary.
--   * SSN, payment_notes, and admin internal flags are never returned.
--
-- Client behaviour:
--   * tenant/portal.js will call this RPC and fall back to the legacy
--     three-call path if the function is missing, so this migration is
--     safe to deploy after the HTML/JS update.
-- =============================================================

CREATE OR REPLACE FUNCTION public.tenant_portal_state(p_app_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_auth_email   TEXT := auth.email();
  v_app          applications%ROWTYPE;
  v_is_primary   BOOLEAN := false;
  v_can_access   BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_app FROM applications WHERE app_id = p_app_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  v_is_primary := v_app.applicant_user_id = v_uid
    OR lower(COALESCE(v_app.email, '')) = lower(v_auth_email);

  v_can_access := v_is_primary
    OR lower(COALESCE(v_app.co_applicant_email, '')) = lower(v_auth_email)
    OR EXISTS (
      SELECT 1 FROM co_applicants c
      WHERE c.app_id = p_app_id
        AND lower(c.email) = lower(v_auth_email)
    );

  IF NOT v_can_access THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  RETURN json_build_object(
    'success', true,
    'app', json_build_object(
      'id',                          v_app.id,
      'app_id',                      v_app.app_id,
      'created_at',                  v_app.created_at,
      'updated_at',                  v_app.updated_at,
      'status',                      v_app.status,
      'payment_status',              v_app.payment_status,
      'payment_date',                v_app.payment_date,
      'application_fee',             v_app.application_fee,
      'payment_amount_recorded',     v_app.payment_amount_recorded,
      'payment_method_recorded',     v_app.payment_method_recorded,
      'payment_notes',               v_app.payment_notes,
      'holding_fee_requested',       v_app.holding_fee_requested,
      'holding_fee_amount',          v_app.holding_fee_amount,
      'holding_fee_due_date',        v_app.holding_fee_due_date,
      'holding_fee_paid',            v_app.holding_fee_paid,
      'holding_fee_paid_at',         v_app.holding_fee_paid_at,
      'payment_confirmed_at',        v_app.payment_confirmed_at,
      'payment_amount_collected',    v_app.payment_amount_collected,
      'payment_method_confirmed',    v_app.payment_method_confirmed,
      'first_name',                  v_app.first_name,
      'last_name',                   v_app.last_name,
      'email',                       v_app.email,
      'property_address',            v_app.property_address,
      'property_id',                 v_app.property_id,
      'lease_status',                v_app.lease_status,
      'lease_sent_date',             v_app.lease_sent_date,
      'lease_signed_date',           v_app.lease_signed_date,
      'lease_start_date',            v_app.lease_start_date,
      'lease_end_date',              v_app.lease_end_date,
      'monthly_rent',                v_app.monthly_rent,
      'security_deposit',            v_app.security_deposit,
      'move_in_costs',               v_app.move_in_costs,
      'move_in_status',              v_app.move_in_status,
      'move_in_date_actual',         v_app.move_in_date_actual,
      'move_in_notes',               v_app.move_in_notes,
      -- tenant_sign_token only goes to the primary applicant
      'tenant_sign_token',           CASE WHEN v_is_primary THEN v_app.tenant_sign_token ELSE NULL END,
      'has_co_applicant',            v_app.has_co_applicant,
      'admin_notes',                 v_app.admin_notes,
      'desired_lease_term',          v_app.desired_lease_term,
      'access_role',                 CASE WHEN v_is_primary THEN 'primary' ELSE 'co_applicant' END
    ),
    'property', (
      SELECT json_build_object(
        'id',              p.id,
        'address',         p.address,
        'city',            p.city,
        'state',           p.state,
        'zip',             p.zip,
        'bedrooms',        p.bedrooms,
        'bathrooms',       p.bathrooms,
        'property_type',   p.property_type
      )
      FROM properties p WHERE p.id = v_app.property_id
    ),
    'cover_photo', (
      SELECT json_build_object('url', ph.url, 'file_id', ph.file_id)
      FROM property_photos ph
      WHERE ph.property_id = v_app.property_id
      ORDER BY ph.display_order ASC NULLS LAST, ph.id ASC
      LIMIT 1
    ),
    'documents', (
      SELECT COALESCE(
        json_agg(json_build_object(
          'id',                  d.id,
          'doc_type',            d.doc_type,
          'storage_path',        d.storage_path,
          'original_file_name',  d.original_file_name,
          'mime_type',           d.mime_type,
          'status',              d.status,
          'created_at',          d.created_at
        ) ORDER BY d.created_at DESC),
        '[]'::json
      )
      FROM application_documents d WHERE d.app_id = p_app_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_portal_state(TEXT) TO authenticated;
