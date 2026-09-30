-- ─────────────────────────────────────────────────────────────────────
-- Phase 08 (chunk 2/N) — extend lease_pdf_versions.event CHECK to
-- accept the three inspection event variants emitted by the
-- record-inspection edge function:
--
--   • inspection_movein   — initial move-in walkthrough
--   • inspection_midterm  — optional periodic check
--   • inspection_moveout  — final move-out walkthrough
--
-- Inspection PDFs are mirrored into lease_pdf_versions so the existing
-- audit trail (download-lease, integrity verification, signed-URL
-- pipeline) treats them uniformly with the lease packet itself.
-- The authoritative pointer remains lease_inspections.pdf_storage_path
-- + pdf_sha256.
--
-- Idempotent: drops the old constraint by name and re-adds the
-- extended one.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.lease_pdf_versions
  DROP CONSTRAINT IF EXISTS lease_pdf_versions_event_check;

ALTER TABLE public.lease_pdf_versions
  ADD CONSTRAINT lease_pdf_versions_event_check
  CHECK (event = ANY (ARRAY[
    'pre_sign',
    'tenant_signed',
    'co_signed',
    'countersigned',
    'amended',
    'renewed',
    'manual',
    'inspection_movein',
    'inspection_midterm',
    'inspection_moveout'
  ]));

COMMIT;
