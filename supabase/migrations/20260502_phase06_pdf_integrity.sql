-- ============================================================
-- Phase 06 -- PDF integrity (SHA-256 + audit certificate page +
--             public verify endpoint)
-- ============================================================
--
-- What this migration does:
--   1. Adds 3 columns to lease_pdf_versions:
--        - sha256                : 64-char hex digest of the FINAL stored
--                                  PDF bytes (cert page included).
--        - certificate_appended  : true once the audit certificate
--                                  "Certificate of Completion" page
--                                  has been bound onto the PDF.
--        - qr_verify_token       : 22-char URL-safe token printed on
--                                  the cert page as a QR code; used by
--                                  the public verify-lease endpoint.
--   2. Adds a CHECK on sha256 format and a UNIQUE index on the
--      qr_verify_token (sparse, only when set).
--   3. record_lease_pdf_integrity() RPC -- single-statement update so
--      edge functions can pin the hash + cert flag + token after the
--      storage upload succeeds. Rejects malformed hashes.
--   4. lookup_lease_by_qr_token() RPC -- safe public summary used by
--      verify-lease.html. Reveals only first-name + last-initial,
--      lease state, dates, executed status, hash, storage_path. NEVER
--      email/phone/full address.
--
-- Design notes:
--   * The stored sha256 is the hash of the FINAL bytes (including the
--     cert page). The cert page itself prints a SECOND hash labelled
--     "Document body SHA-256" which is the hash of the bytes BEFORE
--     the cert was appended (verifiable independently if you strip the
--     last page). This sidesteps the chicken-and-egg "a hash cannot
--     contain itself" problem.
--   * verify-lease only proves that the stored bytes match the
--     recorded hash. Out-of-band tampering of the storage object (rare
--     -- requires service-role compromise) is detected immediately.
--   * No PII in lookup_lease_by_qr_token. The verification page is
--     intentionally public (anyone with the token may verify the
--     signature exists) but learns nothing they could not already see
--     on the printed cert page.
-- ============================================================

BEGIN;

-- ── 1. Columns on lease_pdf_versions ────────────────────────
ALTER TABLE public.lease_pdf_versions
  ADD COLUMN IF NOT EXISTS sha256                TEXT,
  ADD COLUMN IF NOT EXISTS certificate_appended  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qr_verify_token       TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lease_pdf_versions_sha256_format_chk'
  ) THEN
    ALTER TABLE public.lease_pdf_versions
      ADD CONSTRAINT lease_pdf_versions_sha256_format_chk
      CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS lease_pdf_versions_qr_verify_token_uq
  ON public.lease_pdf_versions(qr_verify_token)
  WHERE qr_verify_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS lease_pdf_versions_sha256_idx
  ON public.lease_pdf_versions(sha256)
  WHERE sha256 IS NOT NULL;


-- ── 2. record_lease_pdf_integrity() ─────────────────────────
-- Called by edge functions AFTER the storage upload of the new
-- PDF version succeeds. Validates the hash format and sets the
-- three integrity columns in one statement.
CREATE OR REPLACE FUNCTION public.record_lease_pdf_integrity(
  p_app_id              TEXT,
  p_version_number      INT,
  p_sha256              TEXT,
  p_certificate_appended BOOLEAN DEFAULT false,
  p_qr_verify_token     TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'PDF_INTEGRITY_BAD_HASH'
      USING DETAIL = 'sha256 must be a 64-character lowercase hex string';
  END IF;

  -- Optional: reject already-seen tokens (UNIQUE index will also catch this).
  IF p_qr_verify_token IS NOT NULL THEN
    IF length(p_qr_verify_token) < 16 OR length(p_qr_verify_token) > 64 THEN
      RAISE EXCEPTION 'PDF_INTEGRITY_BAD_TOKEN'
        USING DETAIL = 'qr_verify_token must be 16-64 chars';
    END IF;
  END IF;

  UPDATE public.lease_pdf_versions
     SET sha256                = p_sha256,
         certificate_appended  = COALESCE(p_certificate_appended, false),
         qr_verify_token       = COALESCE(p_qr_verify_token, qr_verify_token)
   WHERE app_id          = p_app_id
     AND version_number  = p_version_number
   RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'PDF_INTEGRITY_NOT_FOUND'
      USING DETAIL = format('No lease_pdf_versions row for app_id=%s version=%s',
                            p_app_id, p_version_number);
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_lease_pdf_integrity(TEXT, INT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_lease_pdf_integrity(TEXT, INT, TEXT, BOOLEAN, TEXT) TO service_role;


-- ── 3. lookup_lease_by_qr_token() ───────────────────────────
-- Public-safe summary returned by verify-lease.html. SECURITY
-- DEFINER so anon can call it without RLS leaking the underlying
-- applications row, but the function itself only emits a hand-
-- picked, PII-free shape.
CREATE OR REPLACE FUNCTION public.lookup_lease_by_qr_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pv       RECORD;
  v_app      RECORD;
  v_signers  JSONB := '[]'::jsonb;
  v_consents JSONB;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('found', false, 'error', 'Invalid token');
  END IF;

  SELECT * INTO v_pv
    FROM public.lease_pdf_versions
   WHERE qr_verify_token = p_token
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'error', 'Token not recognized');
  END IF;

  SELECT app_id, lease_state_code, lease_status,
         lease_start_date, lease_end_date,
         tenant_signature, co_applicant_signature, management_signed,
         signature_timestamp, co_applicant_signature_timestamp, management_signed_at,
         first_name, last_name,
         co_applicant_first_name, co_applicant_last_name,
         management_signer_name
    INTO v_app
    FROM public.applications
   WHERE app_id = v_pv.app_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'error', 'Application not found');
  END IF;

  -- Tenant signer
  IF v_app.tenant_signature IS NOT NULL THEN
    v_signers := v_signers || jsonb_build_array(jsonb_build_object(
      'role',         'tenant',
      'display_name', trim(coalesce(v_app.first_name, '') || ' ' ||
                           CASE WHEN v_app.last_name IS NOT NULL AND length(v_app.last_name) > 0
                                THEN upper(left(v_app.last_name, 1)) || '.'
                                ELSE '' END),
      'signed_at',    v_app.signature_timestamp
    ));
  END IF;

  -- Co-applicant signer
  IF v_app.co_applicant_signature IS NOT NULL THEN
    v_signers := v_signers || jsonb_build_array(jsonb_build_object(
      'role',         'co_applicant',
      'display_name', trim(coalesce(v_app.co_applicant_first_name, '') || ' ' ||
                           CASE WHEN v_app.co_applicant_last_name IS NOT NULL AND length(v_app.co_applicant_last_name) > 0
                                THEN upper(left(v_app.co_applicant_last_name, 1)) || '.'
                                ELSE '' END),
      'signed_at',    v_app.co_applicant_signature_timestamp
    ));
  END IF;

  -- Management signer
  IF v_app.management_signed IS TRUE THEN
    v_signers := v_signers || jsonb_build_array(jsonb_build_object(
      'role',         'management',
      'display_name', coalesce(v_app.management_signer_name, 'Choice Properties'),
      'signed_at',    v_app.management_signed_at
    ));
  END IF;

  -- E-SIGN consent counts by role (no PII -- counts only)
  SELECT COALESCE(jsonb_object_agg(signer_role, cnt), '{}'::jsonb)
    INTO v_consents
    FROM (
      SELECT signer_role, count(*)::int AS cnt
        FROM public.esign_consents
       WHERE app_id        = v_pv.app_id
         AND consent_given = true
         AND withdrawn_at  IS NULL
       GROUP BY signer_role
    ) s;

  RETURN jsonb_build_object(
    'found',                  true,
    'state_code',             v_app.lease_state_code,
    'lease_status',           v_app.lease_status,
    'lease_start_date',       v_app.lease_start_date,
    'lease_end_date',         v_app.lease_end_date,
    'pdf_version',            v_pv.version_number,
    'event',                  v_pv.event,
    'sha256',                 v_pv.sha256,
    'certificate_appended',   v_pv.certificate_appended,
    'storage_path',           v_pv.storage_path,
    'created_at',             v_pv.created_at,
    'signers',                v_signers,
    'esign_consents_by_role', v_consents
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_lease_by_qr_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_lease_by_qr_token(TEXT) TO anon, authenticated;

COMMIT;
