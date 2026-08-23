-- ============================================================
-- Migration: Fix sign_lease_tenant — add lease_signed_date
-- Applied: 2026-04-20
-- Issue: The RPC never populated lease_signed_date, causing
--        the field to remain NULL even after tenant signing.
-- Fix:  Add `lease_signed_date = now()` to the UPDATE statement.
-- ============================================================

CREATE OR REPLACE FUNCTION sign_lease_tenant(
  p_token       TEXT,
  p_signature   TEXT,
  p_ip_address  TEXT,
  p_user_agent  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_rec RECORD;
  new_lease_status lease_status;
BEGIN
  -- Find application by token
  SELECT * INTO app_rec
  FROM applications
  WHERE tenant_sign_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Invalid or expired signing link."}'::JSONB;
  END IF;

  -- Check not already signed
  IF app_rec.tenant_signature IS NOT NULL THEN
    RETURN '{"success": false, "message": "This lease has already been signed."}'::JSONB;
  END IF;

  -- Check lease_status is 'sent'
  IF app_rec.lease_status != 'sent' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This lease is not in a signable state: ' || app_rec.lease_status
    );
  END IF;

  -- Determine new lease status
  IF app_rec.has_co_applicant AND app_rec.co_applicant_lease_token IS NOT NULL THEN
    new_lease_status := 'awaiting_co_sign';
  ELSE
    new_lease_status := 'co_signed';
  END IF;

  -- Update application (FIX: added lease_signed_date = now())
  UPDATE applications SET
    tenant_signature     = p_signature,
    signature_timestamp  = now(),
    lease_signed_date    = now(),
    lease_ip_address     = p_ip_address,
    lease_status         = new_lease_status,
    tenant_sign_token    = NULL,
    updated_at           = now()
  WHERE app_id = app_rec.app_id;

  -- Audit record
  INSERT INTO sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path
  ) VALUES (
    app_rec.app_id, 'tenant', p_signature, app_rec.email,
    p_ip_address, p_user_agent, p_token, app_rec.lease_pdf_url
  );

  RETURN jsonb_build_object(
    'success',    true,
    'app_id',     app_rec.app_id,
    'new_status', new_lease_status::text
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$;
