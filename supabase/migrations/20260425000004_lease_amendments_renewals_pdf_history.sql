-- ============================================================
-- 20260425000004_lease_amendments_renewals_pdf_history.sql
-- Phase 4 — Audit trail surfaces, amendments, renewals, and
--           per-event PDF history.
--
-- 1. lease_pdf_versions          — every PDF write is preserved.
--                                  Old paths are no longer
--                                  silently overwritten.
--
-- 2. lease_amendments            — addenda (parking, pet,
--                                  rent-change, etc.) tracked as
--                                  separate signable documents
--                                  linked to the parent lease.
--
-- 3. lease_renewals_due view     — leases ending in 60-days for
--                                  the renewal-nudge cron.
--
-- 4. record_lease_pdf_version()  — helper function for edge
--                                  functions to register a new
--                                  PDF version.
--
-- Safe to re-run.
-- ============================================================


-- ── lease_pdf_versions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS lease_pdf_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          TEXT NOT NULL REFERENCES applications(app_id) ON DELETE CASCADE,
  version_number  INT  NOT NULL,
  event           TEXT NOT NULL CHECK (event IN (
                    'pre_sign', 'tenant_signed', 'co_signed',
                    'countersigned', 'amended', 'renewed', 'manual'
                  )),
  storage_path    TEXT NOT NULL,
  size_bytes      INT,
  template_version_id UUID REFERENCES lease_template_versions(id),
  amendment_id    UUID,                -- FK added below after lease_amendments exists
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app_id, version_number)
);

CREATE INDEX IF NOT EXISTS lease_pdf_versions_app_idx
  ON lease_pdf_versions (app_id, version_number DESC);

ALTER TABLE lease_pdf_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_pdf_versions_admin_all" ON lease_pdf_versions;
CREATE POLICY "lease_pdf_versions_admin_all" ON lease_pdf_versions
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "lease_pdf_versions_applicant_read" ON lease_pdf_versions;
CREATE POLICY "lease_pdf_versions_applicant_read" ON lease_pdf_versions
  FOR SELECT USING (
    app_id IN (SELECT app_id FROM applications WHERE applicant_user_id = auth.uid())
  );


-- ── lease_amendments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lease_amendments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          TEXT NOT NULL REFERENCES applications(app_id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,        -- e.g. 'parking', 'pet', 'rent_change', 'roommate', 'other'
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,        -- Same {{variable}} substitution as base template
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                    'draft', 'sent', 'signed', 'voided'
                  )),
  signing_token   TEXT UNIQUE,
  tenant_signature       TEXT,
  tenant_signature_image TEXT,
  signed_at       TIMESTAMPTZ,
  signer_ip       TEXT,
  signer_user_agent TEXT,
  pdf_path        TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lease_amendments_app_idx
  ON lease_amendments (app_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lease_amendments_token_idx
  ON lease_amendments (signing_token) WHERE signing_token IS NOT NULL;

ALTER TABLE lease_amendments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_amendments_admin_all" ON lease_amendments;
CREATE POLICY "lease_amendments_admin_all" ON lease_amendments
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "lease_amendments_applicant_read" ON lease_amendments;
CREATE POLICY "lease_amendments_applicant_read" ON lease_amendments
  FOR SELECT USING (
    app_id IN (SELECT app_id FROM applications WHERE applicant_user_id = auth.uid())
  );

-- Now the lease_pdf_versions FK can be wired up
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_name = 'lease_pdf_versions_amendment_id_fkey'
  ) THEN
    ALTER TABLE lease_pdf_versions
      ADD CONSTRAINT lease_pdf_versions_amendment_id_fkey
      FOREIGN KEY (amendment_id) REFERENCES lease_amendments(id) ON DELETE SET NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS lease_amendments_updated_at ON lease_amendments;
CREATE TRIGGER lease_amendments_updated_at
  BEFORE UPDATE ON lease_amendments
  FOR EACH ROW EXECUTE FUNCTION update_lease_template_updated_at();


-- ── record_lease_pdf_version() ───────────────────────────────
-- Called by the edge functions after a successful storage upload.
-- Returns the new version row so callers can decide whether to
-- update applications.lease_pdf_url to this new path (the latest).
CREATE OR REPLACE FUNCTION record_lease_pdf_version(
  p_app_id              TEXT,
  p_event               TEXT,
  p_storage_path        TEXT,
  p_size_bytes          INT  DEFAULT NULL,
  p_template_version_id UUID DEFAULT NULL,
  p_amendment_id        UUID DEFAULT NULL,
  p_created_by          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next INT;
  v_id   UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM applications WHERE app_id = p_app_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
    FROM lease_pdf_versions WHERE app_id = p_app_id;

  INSERT INTO lease_pdf_versions (
    app_id, version_number, event, storage_path, size_bytes,
    template_version_id, amendment_id, created_by
  ) VALUES (
    p_app_id, v_next, p_event, p_storage_path, p_size_bytes,
    p_template_version_id, p_amendment_id, p_created_by
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success',        true,
    'id',             v_id,
    'version_number', v_next
  );
END;
$$;

REVOKE ALL ON FUNCTION record_lease_pdf_version(TEXT, TEXT, TEXT, INT, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_lease_pdf_version(TEXT, TEXT, TEXT, INT, UUID, UUID, TEXT) TO authenticated;


-- ── sign_lease_amendment() ───────────────────────────────────
-- Tenant-side amendment signing. Token-gated, audit-trailed.
CREATE OR REPLACE FUNCTION sign_lease_amendment(
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
  v_amend  RECORD;
  v_app    RECORD;
BEGIN
  SELECT * INTO v_amend FROM lease_amendments WHERE signing_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Invalid or expired amendment link."}'::JSONB;
  END IF;
  IF v_amend.status = 'voided' THEN
    RETURN '{"success": false, "message": "This amendment has been voided."}'::JSONB;
  END IF;
  IF v_amend.tenant_signature IS NOT NULL THEN
    RETURN '{"success": false, "message": "This amendment has already been signed."}'::JSONB;
  END IF;

  UPDATE lease_amendments SET
    tenant_signature       = p_signature,
    tenant_signature_image = p_signature_image,
    signed_at              = now(),
    signer_ip              = p_ip_address,
    signer_user_agent      = p_user_agent,
    status                 = 'signed',
    signing_token          = NULL,
    updated_at             = now()
  WHERE id = v_amend.id;

  SELECT app_id, email INTO v_app FROM applications WHERE app_id = v_amend.app_id LIMIT 1;

  INSERT INTO sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path, signature_image
  ) VALUES (
    v_amend.app_id, 'tenant', p_signature, v_app.email,
    p_ip_address, p_user_agent, p_token, v_amend.pdf_path, p_signature_image
  );

  RETURN jsonb_build_object('success', true, 'amendment_id', v_amend.id, 'app_id', v_amend.app_id);
END;
$$;

GRANT EXECUTE ON FUNCTION sign_lease_amendment(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;


-- ── lease_renewals_due view ──────────────────────────────────
-- Driven by the check-renewals scheduled Edge Function. Emits
-- one row per executed lease whose end date falls in the
-- 50-70 day window from today (so a once-per-week cron has
-- some slack and still catches every renewal exactly once via
-- the dedupe logic in the check-renewals function).
CREATE OR REPLACE VIEW lease_renewals_due AS
SELECT
  a.app_id,
  a.first_name,
  a.last_name,
  a.email,
  a.property_address,
  a.lease_start_date,
  a.lease_end_date,
  a.monthly_rent,
  (a.lease_end_date::date - CURRENT_DATE) AS days_until_end,
  -- Has a renewal nudge already been sent in the last 14 days?
  EXISTS (
    SELECT 1 FROM admin_actions aa
     WHERE aa.target_type = 'application'
       AND aa.target_id   = a.app_id
       AND aa.action      = 'lease_renewal_nudge_sent'
       AND aa.created_at  > now() - interval '14 days'
  ) AS recently_nudged
FROM applications a
WHERE a.lease_status IN ('co_signed','signed')
  AND a.management_cosigned = true
  AND a.lease_end_date IS NOT NULL
  AND (a.lease_end_date::date - CURRENT_DATE) BETWEEN 0 AND 70;

GRANT SELECT ON lease_renewals_due TO authenticated;


-- ── Backfill: seed PDF version v1 for already-generated leases ──
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT a.app_id, a.lease_pdf_url, a.lease_template_version_id,
           CASE
             WHEN a.management_cosigned       THEN 'countersigned'
             WHEN a.co_applicant_signature IS NOT NULL THEN 'co_signed'
             WHEN a.tenant_signature IS NOT NULL       THEN 'tenant_signed'
             ELSE 'pre_sign'
           END AS event
      FROM applications a
     WHERE a.lease_pdf_url IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM lease_pdf_versions p WHERE p.app_id = a.app_id)
  LOOP
    INSERT INTO lease_pdf_versions (
      app_id, version_number, event, storage_path, template_version_id, created_by
    ) VALUES (
      r.app_id, 1, r.event, r.lease_pdf_url, r.lease_template_version_id, 'backfill'
    );
  END LOOP;
END $$;
