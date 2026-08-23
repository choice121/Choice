-- ============================================================
-- 20260425000002_lease_template_versioning.sql
-- Phase 2 — Immutable lease template versioning
--
-- Problem this fixes
-- ───────────────────
-- generate-lease, sign-lease, and countersign all read the row in
-- lease_templates that has is_active = true. If an admin edits the
-- template between "Generate & Send" and the tenant clicking
-- "Sign", the lease text the tenant agrees to differs from the
-- text we PDF'd a moment ago — and on countersign we PDF a third
-- variant. That is a real legal hazard for already-pending leases
-- and a serious one for already-executed leases that get
-- regenerated for any reason.
--
-- New model
-- ─────────
--   lease_templates           — editable "current draft" pointer
--                                (one row per named template).
--   lease_template_versions   — immutable snapshot. Every publish
--                                writes one row. Old versions are
--                                never overwritten or deleted.
--   applications
--     .lease_template_version_id  ← snapshot the lease was
--                                   generated from. Set at
--                                   generate-lease time and never
--                                   changed thereafter.
--
-- The unique-active-row index on lease_templates is dropped so
-- multiple named templates can coexist (e.g. residential vs
-- short-term). is_active is now advisory only — generate-lease
-- picks "the active template" as the default but admins can pin
-- a specific template by id.
--
-- Safe to re-run.
-- ============================================================


-- ── lease_template_versions ─────────────────────────────────
CREATE TABLE IF NOT EXISTS lease_template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES lease_templates(id) ON DELETE RESTRICT,
  version_number  INT  NOT NULL,
  name            TEXT NOT NULL,
  template_body   TEXT NOT NULL,
  variables       JSONB DEFAULT '{}'::jsonb,
  notes           TEXT,
  published_by    TEXT,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_number)
);

CREATE INDEX IF NOT EXISTS lease_template_versions_template_idx
  ON lease_template_versions (template_id, version_number DESC);

ALTER TABLE lease_template_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_template_versions_admin_all" ON lease_template_versions;
CREATE POLICY "lease_template_versions_admin_all" ON lease_template_versions
  FOR ALL USING (is_admin());

-- Tenants can read ONLY the version their own application is pinned
-- to (the tenant portal renders lease text from this row). The
-- get-lease/get-amendment edge functions use the service-role key so
-- they bypass this policy entirely; this is for direct authenticated
-- tenant queries from the portal.
DROP POLICY IF EXISTS "lease_template_versions_applicant_read" ON lease_template_versions;
CREATE POLICY "lease_template_versions_applicant_read" ON lease_template_versions
  FOR SELECT USING (
    id IN (
      SELECT lease_template_version_id
        FROM applications
       WHERE applicant_user_id = auth.uid()
         AND lease_template_version_id IS NOT NULL
    )
  );


-- ── applications.lease_template_version_id ─────────────────
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS lease_template_version_id UUID
  REFERENCES lease_template_versions(id);

CREATE INDEX IF NOT EXISTS applications_lease_template_version_idx
  ON applications (lease_template_version_id);


-- ── Drop legacy unique-active-row constraint ────────────────
-- Versioning replaces "single active row" enforcement.
DROP INDEX IF EXISTS lease_templates_one_active;


-- ── publish_lease_template() ─────────────────────────────────
-- Atomic: update the editable lease_templates row AND emit a new
-- immutable lease_template_versions snapshot in one call.
CREATE OR REPLACE FUNCTION publish_lease_template(
  p_template_id  UUID,
  p_name         TEXT,
  p_template_body TEXT,
  p_variables    JSONB DEFAULT '{}'::jsonb,
  p_notes        TEXT DEFAULT NULL,
  p_make_active  BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor   TEXT := COALESCE(auth.jwt()->>'email', 'system');
  v_is_admin BOOLEAN;
  v_next    INT;
  v_version_id UUID;
  v_template_id UUID := p_template_id;
BEGIN
  SELECT is_admin() INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF p_template_body IS NULL OR btrim(p_template_body) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Template body is required');
  END IF;

  -- Upsert the editable template row
  IF v_template_id IS NULL THEN
    INSERT INTO lease_templates (name, is_active, template_body, variables, notes, created_by)
    VALUES (COALESCE(p_name,'Untitled Template'), p_make_active, p_template_body,
            COALESCE(p_variables, '{}'::jsonb), p_notes, v_actor)
    RETURNING id INTO v_template_id;
  ELSE
    UPDATE lease_templates SET
      name          = COALESCE(p_name, name),
      template_body = p_template_body,
      variables     = COALESCE(p_variables, variables),
      notes         = COALESCE(p_notes, notes),
      is_active     = COALESCE(p_make_active, is_active),
      updated_at    = now()
    WHERE id = v_template_id;
  END IF;

  -- Compute next version number for this template
  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_next
    FROM lease_template_versions
   WHERE template_id = v_template_id;

  INSERT INTO lease_template_versions (
    template_id, version_number, name, template_body, variables, notes, published_by
  )
  SELECT v_template_id, v_next, t.name, t.template_body, t.variables, t.notes, v_actor
    FROM lease_templates t WHERE t.id = v_template_id
  RETURNING id INTO v_version_id;

  RETURN jsonb_build_object(
    'success',         true,
    'template_id',     v_template_id,
    'version_id',      v_version_id,
    'version_number',  v_next
  );
END;
$$;

REVOKE ALL ON FUNCTION publish_lease_template(UUID, TEXT, TEXT, JSONB, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_lease_template(UUID, TEXT, TEXT, JSONB, TEXT, BOOLEAN) TO authenticated;


-- ── snapshot_lease_template_for_app() ──────────────────────
-- Called by generate-lease to (a) ensure the active template has
-- at least one published version, (b) attach that version id to
-- the application. After this runs, the application is locked to
-- a specific immutable template snapshot for its entire lifecycle.
CREATE OR REPLACE FUNCTION snapshot_lease_template_for_app(
  p_app_id      TEXT,
  p_template_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_template_id UUID := p_template_id;
  v_version     RECORD;
  v_actor       TEXT := COALESCE(auth.jwt()->>'email', 'system');
  v_next        INT;
BEGIN
  -- Resolve template id: explicit param wins, otherwise pick the
  -- most recently updated active template.
  IF v_template_id IS NULL THEN
    SELECT id INTO v_template_id
      FROM lease_templates
     WHERE is_active = true
     ORDER BY updated_at DESC
     LIMIT 1;
  END IF;

  IF v_template_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active lease template configured');
  END IF;

  -- Pick latest published version, or auto-publish v1 if none exists yet
  SELECT * INTO v_version
    FROM lease_template_versions
   WHERE template_id = v_template_id
   ORDER BY version_number DESC
   LIMIT 1;

  IF NOT FOUND THEN
    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO v_next
      FROM lease_template_versions
     WHERE template_id = v_template_id;

    INSERT INTO lease_template_versions (
      template_id, version_number, name, template_body, variables, notes, published_by
    )
    SELECT v_template_id, v_next, t.name, t.template_body, t.variables, t.notes, v_actor
      FROM lease_templates t WHERE t.id = v_template_id
    RETURNING * INTO v_version;
  END IF;

  UPDATE applications
     SET lease_template_version_id = v_version.id,
         updated_at = now()
   WHERE app_id = p_app_id;

  RETURN jsonb_build_object(
    'success',        true,
    'template_id',    v_template_id,
    'version_id',     v_version.id,
    'version_number', v_version.version_number,
    'name',           v_version.name
  );
END;
$$;

REVOKE ALL ON FUNCTION snapshot_lease_template_for_app(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION snapshot_lease_template_for_app(TEXT, UUID) TO authenticated;


-- ── Backfill: attach a snapshot to any already-generated lease ──
-- Apps that have a lease_pdf_url but no version id get pointed at
-- the current active template's latest version (or v1, freshly
-- minted). Without this they can't be re-rendered correctly.
DO $$
DECLARE
  v_template_id UUID;
  v_version_id  UUID;
  v_next        INT;
BEGIN
  SELECT id INTO v_template_id FROM lease_templates WHERE is_active = true LIMIT 1;
  IF v_template_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_version_id
    FROM lease_template_versions
   WHERE template_id = v_template_id
   ORDER BY version_number DESC
   LIMIT 1;

  IF v_version_id IS NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO v_next FROM lease_template_versions WHERE template_id = v_template_id;
    INSERT INTO lease_template_versions (template_id, version_number, name, template_body, variables, notes, published_by)
    SELECT v_template_id, v_next, name, template_body, variables, notes, 'backfill'
      FROM lease_templates WHERE id = v_template_id
    RETURNING id INTO v_version_id;
  END IF;

  UPDATE applications
     SET lease_template_version_id = v_version_id
   WHERE lease_pdf_url IS NOT NULL
     AND lease_template_version_id IS NULL;
END $$;
