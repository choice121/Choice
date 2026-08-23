-- 20260425000006 — extend tenant_portal_state to surface lease execution,
-- amendments, and PDF version history.
--
-- Background
-- ----------
-- The Apr 30 single-shot RPC returns the application + property + cover
-- photo + documents, but does not include any of the fields the tenant
-- portal needs to render a fully executed lease:
--
--   • lease_pdf_url, management_cosigned, management_cosigned_at
--   • lease_landlord_name, lease_landlord_address, lease_state_code
--   • lease_pets_policy, lease_smoking_policy, lease_late_fee_*
--   • tenant_signature, co_applicant_signature, signature_timestamp
--   • lease amendments (Phase 4)
--   • lease PDF version history (Phase 4)
--
-- Without these the portal cannot:
--   • Show "Your lease is fully executed — download PDF"
--   • Show or sign pending amendments
--   • Show signature timeline / PDF version history
--
-- Implementation note
-- -------------------
-- Postgres limits json_build_object to 100 arguments. The expanded `app`
-- payload now exceeds that, so we build it in two halves and merge with
-- the jsonb concatenation operator (||).
--
-- Tenant-side filtering rules (mirroring existing RLS):
--   • amendments are returned only when the caller is the primary
--     applicant. Co-applicants do not currently sign amendments.
--   • signing_token on amendments is only returned to the primary on
--     amendments that are still pending (status = sent or draft).

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
  v_app_json     JSONB;
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

  -- ── Build the `app` payload in two halves and merge ─────────────
  v_app_json := jsonb_build_object(
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
    'monthly_rent',                v_app.monthly_rent,
    'security_deposit',            v_app.security_deposit,
    'move_in_costs',               v_app.move_in_costs,
    'move_in_status',              v_app.move_in_status,
    'move_in_date_actual',         v_app.move_in_date_actual,
    'move_in_notes',               v_app.move_in_notes,
    'has_co_applicant',            v_app.has_co_applicant,
    'admin_notes',                 v_app.admin_notes,
    'desired_lease_term',          v_app.desired_lease_term,
    -- tenant_sign_token only goes to the primary applicant
    'tenant_sign_token',           CASE WHEN v_is_primary THEN v_app.tenant_sign_token ELSE NULL END,
    'access_role',                 CASE WHEN v_is_primary THEN 'primary' ELSE 'co_applicant' END
  ) || jsonb_build_object(
    -- Lease execution surface
    'lease_status',                v_app.lease_status,
    'lease_sent_date',             v_app.lease_sent_date,
    'lease_signed_date',           v_app.lease_signed_date,
    'lease_start_date',            v_app.lease_start_date,
    'lease_end_date',              v_app.lease_end_date,
    'lease_pdf_url',               v_app.lease_pdf_url,
    'management_cosigned',         v_app.management_cosigned,
    'management_cosigned_at',      v_app.management_cosigned_at,
    'lease_landlord_name',         v_app.lease_landlord_name,
    'lease_landlord_address',      v_app.lease_landlord_address,
    'lease_state_code',            v_app.lease_state_code,
    'lease_pets_policy',           v_app.lease_pets_policy,
    'lease_smoking_policy',        v_app.lease_smoking_policy,
    'lease_late_fee_flat',         v_app.lease_late_fee_flat,
    'lease_late_fee_daily',        v_app.lease_late_fee_daily,
    'lease_notes',                 v_app.lease_notes,
    'tenant_signature',            v_app.tenant_signature,
    'co_applicant_signature',      v_app.co_applicant_signature,
    'signature_timestamp',         v_app.signature_timestamp
  );

  RETURN json_build_object(
    'success', true,
    'app',     v_app_json,
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
    ),
    -- Lease amendments: only visible to the primary applicant
    'amendments', (
      SELECT COALESCE(
        json_agg(json_build_object(
          'id',                a.id,
          'kind',              a.kind,
          'title',             a.title,
          'body',              a.body,
          'status',            a.status,
          'tenant_signature',  a.tenant_signature,
          'signed_at',         a.signed_at,
          'pdf_path',          a.pdf_path,
          'sent_at',           a.sent_at,
          'created_at',        a.created_at,
          'signing_token',
            CASE
              WHEN v_is_primary AND a.status IN ('sent','draft') THEN a.signing_token
              ELSE NULL
            END
        ) ORDER BY a.created_at DESC),
        '[]'::json
      )
      FROM lease_amendments a
      WHERE a.app_id = p_app_id
        AND v_is_primary
    ),
    -- PDF version history: read-only audit trail
    'lease_pdf_versions', (
      SELECT COALESCE(
        json_agg(json_build_object(
          'version_number',  v.version_number,
          'event',           v.event,
          'storage_path',    v.storage_path,
          'size_bytes',      v.size_bytes,
          'created_at',      v.created_at,
          'created_by',      v.created_by
        ) ORDER BY v.version_number DESC),
        '[]'::json
      )
      FROM lease_pdf_versions v WHERE v.app_id = p_app_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_portal_state(TEXT) TO authenticated;
