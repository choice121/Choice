-- Phase 05 -- Token & signing security hardening
--
-- Introduces lease_signing_tokens registry that tracks expiry, single-use,
-- revocation and IP-locking metadata for every signing token issued
-- (tenant, co-applicant, amendment).  Backfills from existing token columns
-- on applications/lease_amendments so all currently-pending tokens get a
-- 30-day expiry from their lease_sent_date / amendment sent_at.
--
-- Adds RPCs: validate_signing_token, consume_signing_token,
-- register_signing_token, revoke_signing_token, reissue_signing_token.
--
-- Replaces the three sign_lease_* RPCs so they validate-then-consume the
-- registry row before the existing sign logic runs (atomic single-use).
-- Replaces generate_lease_tokens so freshly-issued tokens are auto-registered.
--
-- Idempotent: every CREATE uses IF NOT EXISTS / OR REPLACE; backfill uses
-- ON CONFLICT DO NOTHING.  Safe to re-run.

BEGIN;

-- 1. Registry table -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lease_signing_tokens (
  token         TEXT PRIMARY KEY,
  app_id        TEXT NOT NULL REFERENCES public.applications(app_id) ON DELETE CASCADE,
  signer_role   TEXT NOT NULL CHECK (signer_role IN ('tenant','co_applicant','amendment')),
  signer_email  TEXT NOT NULL,
  amendment_id  UUID REFERENCES public.lease_amendments(id) ON DELETE CASCADE,
  ip_locked_to  INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  used_at       TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  revoked_by    TEXT,
  revoke_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_signing_tokens_app
  ON public.lease_signing_tokens(app_id);
CREATE INDEX IF NOT EXISTS idx_signing_tokens_amendment
  ON public.lease_signing_tokens(amendment_id);
CREATE INDEX IF NOT EXISTS idx_signing_tokens_active
  ON public.lease_signing_tokens(app_id, signer_role)
  WHERE used_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_signing_tokens_email
  ON public.lease_signing_tokens(lower(signer_email));

-- 2. RLS ---------------------------------------------------------------------
ALTER TABLE public.lease_signing_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lease_signing_tokens'
      AND policyname = 'service_role_all_signing_tokens'
  ) THEN
    CREATE POLICY "service_role_all_signing_tokens"
      ON public.lease_signing_tokens
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lease_signing_tokens'
      AND policyname = 'admin_read_signing_tokens'
  ) THEN
    CREATE POLICY "admin_read_signing_tokens"
      ON public.lease_signing_tokens
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()));
  END IF;
END $$;

REVOKE ALL ON public.lease_signing_tokens FROM anon;

-- 3. Backfill from existing un-signed tokens ---------------------------------
INSERT INTO public.lease_signing_tokens (token, app_id, signer_role, signer_email, created_at, expires_at)
SELECT a.tenant_sign_token, a.app_id, 'tenant', COALESCE(a.email, ''),
       COALESCE(a.lease_sent_date, now()),
       COALESCE(a.lease_sent_date, now()) + INTERVAL '30 days'
  FROM public.applications a
 WHERE a.tenant_sign_token IS NOT NULL
   AND a.tenant_signature  IS NULL
ON CONFLICT (token) DO NOTHING;

INSERT INTO public.lease_signing_tokens (token, app_id, signer_role, signer_email, created_at, expires_at)
SELECT a.co_applicant_lease_token, a.app_id, 'co_applicant',
       COALESCE(ca.email, a.email, ''),
       COALESCE(a.lease_sent_date, now()),
       COALESCE(a.lease_sent_date, now()) + INTERVAL '30 days'
  FROM public.applications a
  LEFT JOIN public.co_applicants ca ON ca.app_id = a.app_id
 WHERE a.co_applicant_lease_token IS NOT NULL
   AND a.co_applicant_signature  IS NULL
ON CONFLICT (token) DO NOTHING;

INSERT INTO public.lease_signing_tokens (
  token, app_id, signer_role, signer_email, amendment_id, created_at, expires_at
)
SELECT m.signing_token, m.app_id, 'amendment', COALESCE(a.email, ''),
       m.id,
       COALESCE(m.sent_at, m.created_at, now()),
       COALESCE(m.sent_at, m.created_at, now()) + INTERVAL '30 days'
  FROM public.lease_amendments m
  LEFT JOIN public.applications a ON a.app_id = m.app_id
 WHERE m.signing_token     IS NOT NULL
   AND m.tenant_signature  IS NULL
   AND m.status           <> 'voided'
ON CONFLICT (token) DO NOTHING;

-- 4. validate_signing_token -- raises with reason code on failure -------------
-- Returns the row.  Reason is encoded in the SQLSTATE/MESSAGE so edge
-- functions can map it to a friendly HTTP error.
CREATE OR REPLACE FUNCTION public.validate_signing_token(
  p_token       TEXT,
  p_role        TEXT DEFAULT NULL,
  p_request_ip  INET DEFAULT NULL
) RETURNS public.lease_signing_tokens
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_row public.lease_signing_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.lease_signing_tokens WHERE token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TOKEN_NOT_FOUND',
      DETAIL  = 'This signing link is not recognized.',
      ERRCODE = 'P0001';
  END IF;

  IF p_role IS NOT NULL AND v_row.signer_role <> p_role THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TOKEN_WRONG_ROLE',
      DETAIL  = 'This signing link belongs to a different signer.',
      ERRCODE = 'P0001';
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TOKEN_REVOKED',
      DETAIL  = COALESCE('This signing link was revoked: ' || v_row.revoke_reason,
                         'This signing link has been revoked.'),
      ERRCODE = 'P0001';
  END IF;

  IF v_row.used_at IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TOKEN_ALREADY_USED',
      DETAIL  = 'This signing link has already been used.',
      ERRCODE = 'P0001';
  END IF;

  IF v_row.expires_at < now() THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TOKEN_EXPIRED',
      DETAIL  = 'This signing link expired on ' || to_char(v_row.expires_at, 'Mon DD, YYYY')
                || '. Please contact us for a fresh link.',
      ERRCODE = 'P0001';
  END IF;

  IF v_row.ip_locked_to IS NOT NULL
     AND p_request_ip IS NOT NULL
     AND v_row.ip_locked_to <> p_request_ip THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TOKEN_IP_MISMATCH',
      DETAIL  = 'This signing link can only be used from the original network.',
      ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.validate_signing_token(TEXT, TEXT, INET) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.validate_signing_token(TEXT, TEXT, INET) TO service_role;

-- 5. consume_signing_token -- atomic single-use mark --------------------------
CREATE OR REPLACE FUNCTION public.consume_signing_token(
  p_token       TEXT,
  p_request_ip  INET DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.lease_signing_tokens
     SET used_at      = now(),
         ip_locked_to = COALESCE(ip_locked_to, p_request_ip)
   WHERE token       = p_token
     AND used_at     IS NULL
     AND revoked_at  IS NULL
     AND expires_at >= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.consume_signing_token(TEXT, INET) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.consume_signing_token(TEXT, INET) TO service_role;

-- 6. register_signing_token -- explicit insert for new tokens -----------------
CREATE OR REPLACE FUNCTION public.register_signing_token(
  p_token        TEXT,
  p_app_id       TEXT,
  p_role         TEXT,
  p_email        TEXT,
  p_amendment_id UUID    DEFAULT NULL,
  p_ttl_days     INTEGER DEFAULT 30
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.lease_signing_tokens (
    token, app_id, signer_role, signer_email, amendment_id, created_at, expires_at
  ) VALUES (
    p_token, p_app_id, p_role, COALESCE(p_email, ''), p_amendment_id,
    now(), now() + make_interval(days => p_ttl_days)
  )
  ON CONFLICT (token) DO NOTHING;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.register_signing_token(TEXT, TEXT, TEXT, TEXT, UUID, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.register_signing_token(TEXT, TEXT, TEXT, TEXT, UUID, INTEGER) TO service_role;

-- 7. revoke_signing_token -- admin action -------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_signing_token(
  p_token   TEXT,
  p_by      TEXT,
  p_reason  TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.lease_signing_tokens
     SET revoked_at    = now(),
         revoked_by    = p_by,
         revoke_reason = p_reason
   WHERE token      = p_token
     AND used_at    IS NULL
     AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 1 THEN
    UPDATE public.applications     SET tenant_sign_token        = NULL WHERE tenant_sign_token        = p_token;
    UPDATE public.applications     SET co_applicant_lease_token = NULL WHERE co_applicant_lease_token = p_token;
    UPDATE public.lease_amendments SET signing_token            = NULL WHERE signing_token            = p_token;
  END IF;

  RETURN v_count = 1;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.revoke_signing_token(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.revoke_signing_token(TEXT, TEXT, TEXT) TO service_role;

-- 8. reissue_signing_token -- revoke active + mint a fresh one ---------------
CREATE OR REPLACE FUNCTION public.reissue_signing_token(
  p_app_id       TEXT,
  p_role         TEXT,
  p_by           TEXT,
  p_amendment_id UUID DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_email TEXT;
  v_new   TEXT;
BEGIN
  IF p_role NOT IN ('tenant','co_applicant','amendment') THEN
    RAISE EXCEPTION 'Invalid signer role: %', p_role;
  END IF;

  IF p_role = 'tenant' THEN
    SELECT email INTO v_email FROM public.applications WHERE app_id = p_app_id;
  ELSIF p_role = 'co_applicant' THEN
    SELECT ca.email INTO v_email FROM public.co_applicants ca WHERE ca.app_id = p_app_id LIMIT 1;
  ELSE
    SELECT a.email INTO v_email FROM public.applications a WHERE a.app_id = p_app_id;
  END IF;

  -- Revoke any active tokens for the same (app_id, role[, amendment_id])
  UPDATE public.lease_signing_tokens
     SET revoked_at    = now(),
         revoked_by    = p_by,
         revoke_reason = 'reissued'
   WHERE app_id      = p_app_id
     AND signer_role = p_role
     AND COALESCE(amendment_id::text, '') = COALESCE(p_amendment_id::text, '')
     AND used_at    IS NULL
     AND revoked_at IS NULL;

  -- Mint new
  v_new := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.lease_signing_tokens (token, app_id, signer_role, signer_email, amendment_id)
  VALUES (v_new, p_app_id, p_role, COALESCE(v_email, ''), p_amendment_id);

  -- Replace the live token column
  IF p_role = 'tenant' THEN
    UPDATE public.applications
       SET tenant_sign_token = v_new,
           lease_sent_date   = COALESCE(lease_sent_date, now()),
           updated_at        = now()
     WHERE app_id = p_app_id;
  ELSIF p_role = 'co_applicant' THEN
    UPDATE public.applications
       SET co_applicant_lease_token = v_new,
           updated_at               = now()
     WHERE app_id = p_app_id;
  ELSE
    UPDATE public.lease_amendments
       SET signing_token = v_new,
           sent_at       = COALESCE(sent_at, now()),
           updated_at    = now()
     WHERE id = p_amendment_id;
  END IF;

  RETURN v_new;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.reissue_signing_token(TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reissue_signing_token(TEXT, TEXT, TEXT, UUID) TO service_role;

-- 9. generate_lease_tokens -- registers the freshly-issued tokens -------------
CREATE OR REPLACE FUNCTION public.generate_lease_tokens(p_app_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  app_rec      RECORD;
  tenant_token TEXT;
  co_token     TEXT;
  v_co_email   TEXT;
BEGIN
  SELECT * INTO app_rec FROM public.applications WHERE app_id = p_app_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Application not found."}'::JSONB;
  END IF;

  -- Re-generation supersedes any active tokens for this lease
  UPDATE public.lease_signing_tokens
     SET revoked_at    = now(),
         revoke_reason = 'lease_regenerated'
   WHERE app_id      = p_app_id
     AND signer_role IN ('tenant','co_applicant')
     AND used_at    IS NULL
     AND revoked_at IS NULL;

  tenant_token := encode(extensions.gen_random_bytes(32), 'hex');

  IF app_rec.has_co_applicant THEN
    co_token := encode(extensions.gen_random_bytes(32), 'hex');
    SELECT email INTO v_co_email FROM public.co_applicants WHERE app_id = p_app_id LIMIT 1;
  ELSE
    co_token := NULL;
  END IF;

  UPDATE public.applications SET
    tenant_sign_token        = tenant_token,
    co_applicant_lease_token = co_token,
    lease_status             = 'sent',
    lease_sent_date          = now(),
    updated_at               = now()
  WHERE app_id = p_app_id;

  INSERT INTO public.lease_signing_tokens (token, app_id, signer_role, signer_email)
  VALUES (tenant_token, p_app_id, 'tenant', COALESCE(app_rec.email, ''));

  IF co_token IS NOT NULL THEN
    INSERT INTO public.lease_signing_tokens (token, app_id, signer_role, signer_email)
    VALUES (co_token, p_app_id, 'co_applicant', COALESCE(v_co_email, app_rec.email, ''));
  END IF;

  RETURN jsonb_build_object(
    'success',           true,
    'tenant_token',      tenant_token,
    'co_applicant_token', co_token
  );
END;
$fn$;

-- 10. sign_lease_tenant -- now validates + consumes registry first -----------
CREATE OR REPLACE FUNCTION public.sign_lease_tenant(
  p_token            TEXT,
  p_signature        TEXT,
  p_ip_address       TEXT,
  p_user_agent       TEXT,
  p_signature_image  TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  app_rec          RECORD;
  v_unused         public.lease_signing_tokens%ROWTYPE;
  v_consumed       BOOLEAN;
  new_lease_status lease_status;
  v_ip             INET;
BEGIN
  BEGIN v_ip := NULLIF(p_ip_address,'')::INET; EXCEPTION WHEN others THEN v_ip := NULL; END;

  -- Token gating (raises on invalid/expired/revoked/used/wrong-role/IP-mismatch)
  v_unused := public.validate_signing_token(p_token, 'tenant', v_ip);

  SELECT * INTO app_rec FROM public.applications WHERE tenant_sign_token = p_token LIMIT 1;
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

  IF app_rec.has_co_applicant AND app_rec.co_applicant_lease_token IS NOT NULL THEN
    new_lease_status := 'awaiting_co_sign';
  ELSE
    new_lease_status := 'signed';
  END IF;

  UPDATE public.applications SET
    tenant_signature        = p_signature,
    tenant_signature_image  = p_signature_image,
    signature_timestamp     = now(),
    lease_signed_date       = now(),
    lease_ip_address        = p_ip_address,
    lease_status            = new_lease_status,
    tenant_sign_token       = NULL,
    updated_at              = now()
  WHERE app_id = app_rec.app_id;

  INSERT INTO public.sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path, signature_image
  ) VALUES (
    app_rec.app_id, 'tenant', p_signature, app_rec.email,
    p_ip_address, p_user_agent, p_token, app_rec.lease_pdf_url, p_signature_image
  );

  RETURN jsonb_build_object('success', true, 'app_id', app_rec.app_id);
END;
$fn$;

-- 11. sign_lease_co_applicant -- gated by registry ---------------------------
CREATE OR REPLACE FUNCTION public.sign_lease_co_applicant(
  p_token            TEXT,
  p_signature        TEXT,
  p_ip_address       TEXT,
  p_user_agent       TEXT,
  p_signature_image  TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  app_rec     RECORD;
  v_co_email  TEXT;
  v_unused    public.lease_signing_tokens%ROWTYPE;
  v_consumed  BOOLEAN;
  v_ip        INET;
BEGIN
  BEGIN v_ip := NULLIF(p_ip_address,'')::INET; EXCEPTION WHEN others THEN v_ip := NULL; END;

  v_unused := public.validate_signing_token(p_token, 'co_applicant', v_ip);

  SELECT * INTO app_rec FROM public.applications WHERE co_applicant_lease_token = p_token LIMIT 1;
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

  v_consumed := public.consume_signing_token(p_token, v_ip);
  IF NOT v_consumed THEN
    RETURN '{"success": false, "message": "Signing link is no longer usable. Please request a fresh link."}'::JSONB;
  END IF;

  UPDATE public.applications SET
    co_applicant_signature           = p_signature,
    co_applicant_signature_image     = p_signature_image,
    co_applicant_signature_timestamp = now(),
    co_applicant_lease_token         = NULL,
    lease_ip_address                 = COALESCE(NULLIF(p_ip_address, ''), lease_ip_address),
    lease_status                     = 'co_signed',
    updated_at                       = now()
  WHERE app_id = app_rec.app_id;

  SELECT email INTO v_co_email FROM public.co_applicants WHERE app_id = app_rec.app_id LIMIT 1;

  INSERT INTO public.sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path, signature_image
  ) VALUES (
    app_rec.app_id, 'co_applicant', p_signature, v_co_email,
    p_ip_address, p_user_agent, p_token, app_rec.lease_pdf_url, p_signature_image
  );

  RETURN jsonb_build_object('success', true, 'app_id', app_rec.app_id);
END;
$fn$;

-- 12. sign_lease_amendment -- gated by registry ------------------------------
CREATE OR REPLACE FUNCTION public.sign_lease_amendment(
  p_token            TEXT,
  p_signature        TEXT,
  p_ip_address       TEXT,
  p_user_agent       TEXT,
  p_signature_image  TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_amend     RECORD;
  v_app       RECORD;
  v_unused    public.lease_signing_tokens%ROWTYPE;
  v_consumed  BOOLEAN;
  v_ip        INET;
BEGIN
  BEGIN v_ip := NULLIF(p_ip_address,'')::INET; EXCEPTION WHEN others THEN v_ip := NULL; END;

  v_unused := public.validate_signing_token(p_token, 'amendment', v_ip);

  SELECT * INTO v_amend FROM public.lease_amendments WHERE signing_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Invalid or expired amendment link."}'::JSONB;
  END IF;
  IF v_amend.status = 'voided' THEN
    RETURN '{"success": false, "message": "This amendment has been voided."}'::JSONB;
  END IF;
  IF v_amend.tenant_signature IS NOT NULL THEN
    RETURN '{"success": false, "message": "This amendment has already been signed."}'::JSONB;
  END IF;

  v_consumed := public.consume_signing_token(p_token, v_ip);
  IF NOT v_consumed THEN
    RETURN '{"success": false, "message": "Amendment link is no longer usable."}'::JSONB;
  END IF;

  UPDATE public.lease_amendments SET
    tenant_signature       = p_signature,
    tenant_signature_image = p_signature_image,
    signed_at              = now(),
    signer_ip              = p_ip_address,
    signer_user_agent      = p_user_agent,
    status                 = 'signed',
    signing_token          = NULL,
    updated_at             = now()
  WHERE id = v_amend.id;

  SELECT app_id, email INTO v_app FROM public.applications WHERE app_id = v_amend.app_id LIMIT 1;

  INSERT INTO public.sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path, signature_image
  ) VALUES (
    v_amend.app_id, 'tenant', p_signature, v_app.email,
    p_ip_address, p_user_agent, p_token, v_amend.pdf_path, p_signature_image
  );

  RETURN jsonb_build_object('success', true, 'amendment_id', v_amend.id, 'app_id', v_amend.app_id);
END;
$fn$;

-- 13. lookup_signer_for_token -- now also surfaces expiry/revocation status --
CREATE OR REPLACE FUNCTION public.lookup_signer_for_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_app          RECORD;
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

  -- Try tenant token
  SELECT app_id, email, first_name, last_name, lease_status, tenant_signature, has_co_applicant
    INTO v_app
    FROM public.applications
   WHERE tenant_sign_token = p_token
   LIMIT 1;

  IF FOUND THEN
    v_signer_type  := 'tenant';
    v_signer_email := v_app.email;
    v_signer_name  := COALESCE(v_app.first_name,'') || ' ' || COALESCE(v_app.last_name,'');
    v_already      := v_app.tenant_signature IS NOT NULL;
  ELSE
    SELECT a.app_id, ca.email, ca.first_name, ca.last_name, a.lease_status,
           a.co_applicant_signature, a.has_co_applicant
      INTO v_app
      FROM public.applications a
      LEFT JOIN public.co_applicants ca ON ca.app_id = a.app_id
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

  -- Phase 05 -- surface registry status
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
  END IF;

  RETURN jsonb_build_object(
    'success',        true,
    'app_id',         v_app.app_id,
    'signer_type',    v_signer_type,
    'signer_email',   v_signer_email,
    'signer_name',    btrim(v_signer_name),
    'lease_status',   v_app.lease_status,
    'already_signed', v_already,
    'expires_at',     v_token_meta.expires_at
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.lookup_signer_for_token(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.lookup_signer_for_token(TEXT) TO service_role;

-- 14. Admin view ------------------------------------------------------------
CREATE OR REPLACE VIEW public.lease_signing_tokens_admin AS
SELECT t.token,
       t.app_id,
       t.signer_role,
       t.signer_email,
       t.amendment_id,
       t.created_at,
       t.expires_at,
       t.used_at,
       t.revoked_at,
       t.revoked_by,
       t.revoke_reason,
       t.ip_locked_to,
       CASE
         WHEN t.used_at    IS NOT NULL THEN 'used'
         WHEN t.revoked_at IS NOT NULL THEN 'revoked'
         WHEN t.expires_at <  now()    THEN 'expired'
         ELSE 'active'
       END AS status
  FROM public.lease_signing_tokens t;

GRANT SELECT ON public.lease_signing_tokens_admin TO authenticated;

COMMIT;
