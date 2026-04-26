-- ============================================================
-- Choice Properties — Phase 01 — Lease template partials
-- ============================================================
-- Adds the lease_template_partials table that backs
-- {% include "slug" %} resolution in the new templating engine
-- (supabase/functions/_shared/template-engine.ts).
--
-- Rationale: every Phase 03+ template needs to share standardized
-- snippets (the non-attorney-review disclaimer, the federal lead-paint
-- preamble, etc.) without copy-pasting the text into every template
-- body. Centralising these in a partials table lets us update one row
-- and have every freshly-rendered lease pick up the new wording, while
-- already-snapshotted leases remain unaffected (their template_body
-- snapshot already inlined the partial text at signing time).
-- ============================================================

CREATE TABLE IF NOT EXISTS lease_template_partials (
  slug         TEXT PRIMARY KEY,
  body         TEXT NOT NULL,
  description  TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lease_template_partials ENABLE ROW LEVEL SECURITY;

-- Admin write/read
DROP POLICY IF EXISTS "lease_template_partials_admin_all" ON lease_template_partials;
CREATE POLICY "lease_template_partials_admin_all"
  ON lease_template_partials
  FOR ALL
  TO authenticated
  USING      (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));

-- Anonymous role intentionally has NO read access. Edge functions
-- read partials using the service-role key, which bypasses RLS anyway,
-- so there is zero reason to expose internal template fragments to
-- the public marketplace.
DROP POLICY IF EXISTS "lease_template_partials_anon_no_read" ON lease_template_partials;
CREATE POLICY "lease_template_partials_anon_no_read"
  ON lease_template_partials
  FOR SELECT
  TO anon
  USING (false);

-- ── updated_at trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION lease_template_partials_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lease_template_partials_touch ON lease_template_partials;
CREATE TRIGGER lease_template_partials_touch
  BEFORE UPDATE ON lease_template_partials
  FOR EACH ROW EXECUTE FUNCTION lease_template_partials_touch_updated_at();

-- ── Seed: standardized non-attorney-review disclaimer ─────────
-- Wording is duplicated in supabase/functions/_shared/legal-disclaimer.ts
-- (constant STANDARD_DISCLAIMER, version DISCLAIMER_VERSION = '2026-04-v1').
-- If you change one, bump the version constant in the .ts file too.
INSERT INTO lease_template_partials (slug, body, description, created_by) VALUES (
  'common/disclaimer',
  'This document is statute-derived and has not been individually attorney-reviewed for every jurisdiction. Choice Properties is not a law firm and does not provide legal advice. Tenants and landlords are encouraged to consult a licensed attorney in their state before signing.',
  'Standard non-attorney-review disclaimer required on every generated lease document. Wording mirrored in legal-disclaimer.ts.',
  'system'
)
ON CONFLICT (slug) DO UPDATE
  SET body         = EXCLUDED.body,
      description  = EXCLUDED.description,
      updated_at   = now();
