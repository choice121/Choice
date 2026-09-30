-- ============================================================
-- Phase 06 follow-up: legacy PDF flag + integrity invariant
-- ------------------------------------------------------------
-- Why:
--   When Phase 06 (PDF integrity / SHA-256 + audit certificate) shipped
--   in commit cc6fafc, the wiring was applied to NEW PDF generations
--   only. Existing rows in `lease_pdf_versions` (8 rows from Phase 02-05
--   smoke tests) still have `sha256 IS NULL` and no `qr_verify_token`.
--
--   Those rows are not currently reachable from `verify-lease` (the
--   public endpoint looks them up by `qr_verify_token`, which they don't
--   have), so they can't be falsely reported as "tampered". But:
--
--     1. There is no audit-trail signal that distinguishes "legacy /
--        unverifiable / no integrity recorded" from "should have a hash
--        but somehow lost it" -- the second case would be a real bug we
--        must surface.
--     2. Future code paths that hash-on-fetch must not silently re-hash
--        a legacy row and overwrite NULL with a value that has no
--        signed cert page tying signers to the bytes.
--
-- This migration:
--   * Adds `legacy_pre_phase06 boolean` defaulted false.
--   * Backfills it to TRUE for every row where `sha256 IS NULL` today.
--   * Adds a CHECK constraint so any new row going forward MUST either
--     have a sha256 OR be explicitly marked legacy. This closes the
--     "silent NULL" gap §0.4 / §5.5 of LEASE_IMPLEMENTATION.md warns
--     against.
--   * Adds a partial index on legacy rows so the backfill job and the
--     admin "show legacy PDFs" view both stay fast at any future scale.
--
-- A companion edge function `backfill-pdf-integrity` (admin-only) takes
-- the legacy rows one at a time, downloads the bytes from the
-- `lease-pdfs` storage bucket, computes SHA-256, and writes it back to
-- the row WITHOUT clearing the legacy flag -- so the row remains
-- distinguishable from natively-Phase-06 PDFs (no cert page, no QR
-- token) while still being integrity-tracked from this point forward.
--
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE public.lease_pdf_versions
  ADD COLUMN IF NOT EXISTS legacy_pre_phase06 boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.lease_pdf_versions.legacy_pre_phase06 IS
  'TRUE for rows generated before Phase 06 PDF integrity wiring (cc6fafc). '
  'These rows have no audit certificate page and no qr_verify_token. '
  'sha256 may be backfilled by the backfill-pdf-integrity edge function, '
  'but the row remains flagged legacy so audits distinguish it from a '
  'natively-Phase-06 PDF that was signed with a real certificate page.';

-- Backfill: every existing row missing a sha256 is, by definition, legacy.
UPDATE public.lease_pdf_versions
   SET legacy_pre_phase06 = true
 WHERE sha256 IS NULL
   AND legacy_pre_phase06 = false;

-- Invariant: from now on, every row must EITHER have a sha256 OR be
-- explicitly marked legacy. New rows from sign-lease / countersign /
-- create-amendment etc. always set sha256, so they pass. Backfill-job
-- rows pass too (sha256 set, legacy still true). The only thing this
-- rejects is a future code path that silently inserts a row without a
-- hash -- which is exactly the bug class §5.5 forbids.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname  = 'lease_pdf_versions_integrity_present'
       AND conrelid = 'public.lease_pdf_versions'::regclass
  ) THEN
    ALTER TABLE public.lease_pdf_versions
      ADD CONSTRAINT lease_pdf_versions_integrity_present
      CHECK (sha256 IS NOT NULL OR legacy_pre_phase06 = true);
  END IF;
END $$;

-- Partial index: keep the backfill job and "list legacy PDFs" admin
-- view fast even after thousands of leases.
CREATE INDEX IF NOT EXISTS idx_lease_pdf_versions_legacy_pending
  ON public.lease_pdf_versions (created_at)
  WHERE legacy_pre_phase06 = true AND sha256 IS NULL;

-- Audit trail: record the migration's effect for traceability per §5.6.
INSERT INTO public.admin_actions (action, target_type, target_id, metadata)
SELECT
  'phase06_legacy_pdf_flag_backfill',
  'lease_pdf_versions',
  'migration:20260504000001',
  jsonb_build_object(
    'rows_marked_legacy', (SELECT count(*) FROM public.lease_pdf_versions WHERE legacy_pre_phase06 = true),
    'rows_still_unhashed', (SELECT count(*) FROM public.lease_pdf_versions WHERE legacy_pre_phase06 = true AND sha256 IS NULL),
    'note', 'Run backfill-pdf-integrity edge function to compute SHA-256 for legacy rows.'
  )
WHERE EXISTS (SELECT 1 FROM public.lease_pdf_versions WHERE legacy_pre_phase06 = true);
