-- ============================================================
-- 20260425000001_lease_pipeline_hotfixes.sql
-- Phase 1.5 — Lease pipeline hotfixes
--
-- Fixes shipped in this migration:
--
--   H-01  sign_lease_tenant() set lease_status = 'co_signed' for
--         solo applicants instead of 'signed'. That made the lease
--         look fully executed before management ever countersigned,
--         and hid the admin "Countersign" button (which only shows
--         when status = 'signed' AND not yet management_cosigned).
--
--   H-02  The legacy sign_lease(p_app_id, p_signature, p_ip)
--         function in SETUP.sql is now a deprecated wrapper around
--         the canonical sign_lease_tenant() flow. Anyone still
--         calling sign_lease() against app_id directly will hit a
--         clear deprecation NOTICE rather than silently bypassing
--         the token + audit-trail layer.
--
-- Safe to re-run.
-- ============================================================


-- ── H-01 ──────────────────────────────────────────────────────
-- Replace sign_lease_tenant so solo applicants land on 'signed',
-- which is the only state from which management can countersign.
CREATE OR REPLACE FUNCTION sign_lease_tenant(
  p_token       TEXT,
  p_signature   TEXT,
  p_ip_address  TEXT,
  p_user_agent  TEXT
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

  -- Status decision matrix:
  --   has_co_applicant + co_token present → 'awaiting_co_sign' (waits for co-app)
  --   solo applicant                      → 'signed'           (waits for management)
  -- The previous version mistakenly set 'co_signed' for the solo
  -- branch, marking the lease as fully executed before management
  -- ever countersigned.
  IF app_rec.has_co_applicant AND app_rec.co_applicant_lease_token IS NOT NULL THEN
    new_lease_status := 'awaiting_co_sign';
  ELSE
    new_lease_status := 'signed';
  END IF;

  UPDATE applications SET
    tenant_signature     = p_signature,
    signature_timestamp  = now(),
    lease_signed_date    = now(),
    lease_ip_address     = p_ip_address,
    lease_status         = new_lease_status,
    tenant_sign_token    = NULL,
    updated_at           = now()
  WHERE app_id = app_rec.app_id;

  INSERT INTO sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path
  ) VALUES (
    app_rec.app_id, 'tenant', p_signature, app_rec.email,
    p_ip_address, p_user_agent, p_token, app_rec.lease_pdf_url
  );

  RETURN jsonb_build_object(
    'success',    true,
    'message',    'Lease signed successfully.',
    'app_id',     app_rec.app_id,
    'new_status', new_lease_status::text
  );
END;
$$;

-- Same hardened search_path on the co-applicant variant for parity
ALTER FUNCTION public.sign_lease_co_applicant(text, text, text, text)
  SET search_path = public, pg_temp;


-- ── H-02 ──────────────────────────────────────────────────────
-- Deprecate the SETUP.sql sign_lease(text,text,text) function.
-- It accepts an app_id directly and bypasses the token + audit
-- trail. We keep the signature so any stale caller doesn't 500,
-- but it now refuses to run and surfaces a clear hint.
CREATE OR REPLACE FUNCTION sign_lease(
  p_app_id    TEXT,
  p_signature TEXT,
  p_ip        TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE NOTICE
    'sign_lease(app_id, signature, ip) is deprecated. '
    'Call the sign-lease Edge Function with a tenant_sign_token instead, '
    'which routes through sign_lease_tenant().';

  RETURN json_build_object(
    'success', false,
    'error',   'sign_lease() has been deprecated. Use the sign-lease Edge Function with a signing token.'
  );
END;
$$;

COMMENT ON FUNCTION sign_lease(TEXT, TEXT, TEXT) IS
  'DEPRECATED. Use sign_lease_tenant(token, signature, ip, ua) via the sign-lease Edge Function.';

COMMENT ON FUNCTION sign_lease_tenant(TEXT, TEXT, TEXT, TEXT) IS
  'Canonical primary-applicant lease signing. Called by the sign-lease Edge Function after token + email-identity checks. Sets lease_status = ''awaiting_co_sign'' when has_co_applicant + co_token present, otherwise ''signed''.';

COMMENT ON FUNCTION sign_lease_co_applicant(TEXT, TEXT, TEXT, TEXT) IS
  'Co-applicant lease signing. Called by the sign-lease-co-applicant Edge Function after token + email-identity checks. Sets lease_status = ''co_signed''.';
