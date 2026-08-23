-- Phase 06 integrity constraint fix
--
-- The original constraint:
--   CHECK (sha256 IS NOT NULL OR legacy_pre_phase06 = true)
--
-- breaks the two-phase reservation pattern used by finalizeAndStorePdf:
--   Step 5: INSERT with storage_path='' and sha256=NULL  ← constraint fires here
--   Step 8: UPDATE sha256 via record_lease_pdf_integrity
--
-- Fix: also allow rows where storage_path = '' (reservation rows that
-- have not yet had the PDF uploaded and hashed). All production rows
-- will have sha256 set or be marked legacy before storage_path is set.
--

ALTER TABLE public.lease_pdf_versions
  DROP CONSTRAINT IF EXISTS lease_pdf_versions_integrity_present;

ALTER TABLE public.lease_pdf_versions
  ADD CONSTRAINT lease_pdf_versions_integrity_present
  CHECK (
    sha256 IS NOT NULL
    OR legacy_pre_phase06 = true
    OR storage_path = ''
  );
