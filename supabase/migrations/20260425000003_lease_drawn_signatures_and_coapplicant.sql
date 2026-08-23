-- ============================================================
-- 20260425000003_lease_drawn_signatures_and_coapplicant.sql
-- Phase 3 — Drawn signatures + co-applicant signing
--
-- 1. Adds optional drawn-signature image columns. The typed name
--    remains the legally binding signature (E-SIGN/UETA all
--    accept typed-name + intent + audit trail). Drawn signatures
--    are an additional verification artifact, never a replacement.
--
-- 2. Updates sign_lease_tenant + sign_lease_co_applicant to
--    accept and persist the drawn signature image (data-URL).
--
-- 3. Adds signature_image to sign_events for the audit trail.
--
-- Safe to re-run.
-- ============================================================


-- ── Drawn-signature columns ─────────────────────────────────
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS tenant_signature_image       TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_signature_image TEXT;

ALTER TABLE sign_events
  ADD COLUMN IF NOT EXISTS signature_image TEXT;


-- ── sign_lease_tenant: 5-arg overload ───────────────────────
-- Drop the 4-arg signature first so we can add the optional 5th
-- arg cleanly. Edge Functions are updated in lockstep.
DROP FUNCTION IF EXISTS sign_lease_tenant(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION sign_lease_tenant(
  p_token            TEXT,
  p_signature        TEXT,
  p_ip_address       TEXT,
  p_user_agent       TEXT,
  p_signature_image  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  app_rec          RECORD;
  new_lease_status lease_status;
BEGIN
  SELECT * INTO app_rec
  FROM applications
  WHERE tenant_sign_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Invalid or expired signing link."}'::JSONB;
  END IF;

  IF app_rec.tenant_signature IS NOT NULL THEN
    RETURN '{"success": false, "message": "This lease has already been signed."}'::JSONB;
  END IF;

  IF app_rec.lease_status NOT IN ('sent') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This lease is not in a signable state: ' || app_rec.lease_status
    );
  END IF;

  IF app_rec.has_co_applicant AND app_rec.co_applicant_lease_token IS NOT NULL THEN
    new_lease_status := 'awaiting_co_sign';
  ELSE
    new_lease_status := 'signed';
  END IF;

  UPDATE applications SET
    tenant_signature        = p_signature,
    tenant_signature_image  = p_signature_image,
    signature_timestamp     = now(),
    lease_signed_date       = now(),
    lease_ip_address        = p_ip_address,
    lease_status            = new_lease_status,
    tenant_sign_token       = NULL,
    updated_at              = now()
  WHERE app_id = app_rec.app_id;

  INSERT INTO sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path, signature_image
  ) VALUES (
    app_rec.app_id, 'tenant', p_signature, app_rec.email,
    p_ip_address, p_user_agent, p_token, app_rec.lease_pdf_url, p_signature_image
  );

  RETURN jsonb_build_object(
    'success',    true,
    'message',    'Lease signed successfully.',
    'app_id',     app_rec.app_id,
    'new_status', new_lease_status::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sign_lease_tenant(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ── sign_lease_co_applicant: 5-arg overload ─────────────────
DROP FUNCTION IF EXISTS sign_lease_co_applicant(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS sign_lease_co_applicant(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION sign_lease_co_applicant(
  p_token            TEXT,
  p_signature        TEXT,
  p_ip_address       TEXT,
  p_user_agent       TEXT,
  p_signature_image  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  app_rec     RECORD;
  v_co_email  TEXT;
BEGIN
  SELECT * INTO app_rec
  FROM applications
  WHERE co_applicant_lease_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Invalid or expired signing link."}'::JSONB;
  END IF;

  IF NOT app_rec.has_co_applicant THEN
    RETURN '{"success": false, "message": "No co-applicant on this application."}'::JSONB;
  END IF;

  IF app_rec.co_applicant_signature IS NOT NULL THEN
    RETURN '{"success": false, "message": "Co-applicant has already signed."}'::JSONB;
  END IF;

  IF app_rec.tenant_signature IS NULL THEN
    RETURN '{"success": false, "message": "The primary applicant must sign first."}'::JSONB;
  END IF;

  UPDATE applications SET
    co_applicant_signature           = p_signature,
    co_applicant_signature_image     = p_signature_image,
    co_applicant_signature_timestamp = now(),
    co_applicant_lease_token         = NULL,
    lease_ip_address                 = COALESCE(NULLIF(p_ip_address, ''), lease_ip_address),
    lease_status                     = 'co_signed',
    updated_at                       = now()
  WHERE app_id = app_rec.app_id;

  SELECT email INTO v_co_email FROM co_applicants WHERE app_id = app_rec.app_id LIMIT 1;

  INSERT INTO sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path, signature_image
  ) VALUES (
    app_rec.app_id, 'co_applicant', p_signature, v_co_email,
    p_ip_address, p_user_agent, p_token, app_rec.lease_pdf_url, p_signature_image
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Co-applicant lease signed successfully.',
    'app_id',  app_rec.app_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sign_lease_co_applicant(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ── lookup_signer_for_token() ───────────────────────────────
-- Used by the get-lease Edge Function so a single endpoint can
-- handle either token type. Returns the signer_type ('tenant' or
-- 'co_applicant'), the matching expected email (used for the
-- email-identity verification step), and the application's
-- current lease_status so the page can render the right message
-- for "already signed" / "voided" / "expired".
CREATE OR REPLACE FUNCTION lookup_signer_for_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app          RECORD;
  v_signer_type  TEXT;
  v_signer_email TEXT;
  v_signer_name  TEXT;
  v_already      BOOLEAN := false;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing token');
  END IF;

  -- Try tenant token first
  SELECT app_id, email, first_name, last_name, lease_status, tenant_signature, has_co_applicant
    INTO v_app
    FROM applications
   WHERE tenant_sign_token = p_token
   LIMIT 1;

  IF FOUND THEN
    v_signer_type  := 'tenant';
    v_signer_email := v_app.email;
    v_signer_name  := COALESCE(v_app.first_name,'') || ' ' || COALESCE(v_app.last_name,'');
    v_already      := v_app.tenant_signature IS NOT NULL;
  ELSE
    -- Try co-applicant token
    SELECT a.app_id, ca.email, ca.first_name, ca.last_name, a.lease_status,
           a.co_applicant_signature, a.has_co_applicant
      INTO v_app
      FROM applications a
      LEFT JOIN co_applicants ca ON ca.app_id = a.app_id
     WHERE a.co_applicant_lease_token = p_token
     LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired signing link');
    END IF;

    v_signer_type  := 'co_applicant';
    v_signer_email := v_app.email;
    v_signer_name  := COALESCE(v_app.first_name,'') || ' ' || COALESCE(v_app.last_name,'');
    v_already      := v_app.co_applicant_signature IS NOT NULL;
  END IF;

  RETURN jsonb_build_object(
    'success',       true,
    'app_id',        v_app.app_id,
    'signer_type',   v_signer_type,
    'signer_email',  v_signer_email,
    'signer_name',   btrim(v_signer_name),
    'lease_status',  v_app.lease_status,
    'already_signed', v_already
  );
END;
$$;

REVOKE ALL ON FUNCTION lookup_signer_for_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_signer_for_token(TEXT) TO anon, authenticated;
