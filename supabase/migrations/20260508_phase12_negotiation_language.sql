-- ============================================================
-- Phase 12 — negotiation_language on applications
-- CA Civil Code §1632: landlords must provide a Spanish
-- translation of a lease negotiated primarily in Spanish.
-- Practical demand extends this to OR and nationwide.
--
-- Column is TEXT with a default of 'en'.  All existing rows
-- effectively default to 'en'.  Supported values track
-- _shared/i18n.ts SUPPORTED_LOCALES: 'en' | 'es'.
-- ============================================================

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS negotiation_language TEXT NOT NULL DEFAULT 'en';

COMMENT ON COLUMN applications.negotiation_language IS
  'Language in which the tenancy was negotiated. '
  'CA Civ. Code §1632 requires a written lease in Spanish when '
  'the tenancy was negotiated in Spanish. Also supports ''es'' '
  'for practical demand across all states. Default ''en''.';

-- Soft-enforce the allowed set at the DB level; new locales
-- require a migration to add them here AND to i18n.ts.
ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS applications_negotiation_language_check;

ALTER TABLE applications
  ADD CONSTRAINT applications_negotiation_language_check
  CHECK (negotiation_language IN ('en', 'es'));
