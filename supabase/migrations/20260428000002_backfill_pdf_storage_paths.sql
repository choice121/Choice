-- Backfill empty storage_path rows in lease_pdf_versions.
--
-- Root cause: finalizeAndStorePdf step 7 (UPDATE storage_path) ran before
-- step 8 (UPDATE sha256). The check constraint
--   sha256 IS NOT NULL OR legacy_pre_phase06 = true OR storage_path = ''
-- was not satisfied by the intermediate state (sha256=null, path='real-path'),
-- so the step-7 update silently rolled back. Step 8 then set sha256, leaving
-- rows with sha256 set but storage_path=''.
--
-- Fix: lease-render.ts now sets storage_path + sha256 atomically (one UPDATE).
-- This migration patches the affected test rows so verify-lease can hash them.
--
-- The sha256 values are already correct (they were set by step 8).
-- We only need to fill in storage_path + size_bytes.

UPDATE public.lease_pdf_versions
SET
  storage_path = 'CP-20260428-VWLXXC049/lease_v1_pre_sign_1777355798540.pdf',
  size_bytes   = 1369965
WHERE app_id = 'CP-20260428-VWLXXC049'
  AND version_number = 1
  AND storage_path = '';

UPDATE public.lease_pdf_versions
SET
  storage_path = 'CP-20260428-VWLXXC049/lease_v2_tenant_signed_1777356103465.pdf',
  size_bytes   = 1375254
WHERE app_id = 'CP-20260428-VWLXXC049'
  AND version_number = 2
  AND storage_path = '';

UPDATE public.lease_pdf_versions
SET
  storage_path = 'CP-20260428-VWLXXC049/lease_v3_countersigned_1777356326186.pdf',
  size_bytes   = 1375529
WHERE app_id = 'CP-20260428-VWLXXC049'
  AND version_number = 3
  AND storage_path = '';

-- General safety net: any other app that has the same symptom
-- (sha256 set but storage_path empty) can be identified with:
--   SELECT app_id, version_number, sha256 FROM lease_pdf_versions
--   WHERE storage_path = '' AND sha256 IS NOT NULL;
-- Those rows require manual inspection to locate the storage object
-- (the filename is deterministic: lease_v{N}_{event}_{ts}.pdf but ts is lost).
