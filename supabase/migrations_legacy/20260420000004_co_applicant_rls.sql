-- Migration: Extend tenant SELECT/UPDATE policies to cover co-applicants
-- Applied: 2026-04-20
-- Purpose: Let a co-applicant access the portal using their own email
--          AND let a claimed primary applicant withdraw (via email fallback).

-- ── SELECT: allow primary OR co-applicant email match ───────────────────────
DROP POLICY IF EXISTS "applications_tenant_select" ON applications;
CREATE POLICY "applications_tenant_select" ON applications
  FOR SELECT
  TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR lower(email) = lower(auth.email())
    OR lower(co_applicant_email) = lower(auth.email())
  );

-- ── UPDATE: allow claimed user OR primary-email match for withdraw/sign ──────
-- Co-applicants intentionally cannot withdraw — only the primary can.
DROP POLICY IF EXISTS "applications_tenant_update" ON applications;
CREATE POLICY "applications_tenant_update" ON applications
  FOR UPDATE
  TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR lower(email) = lower(auth.email())
  )
  WITH CHECK (
    applicant_user_id = auth.uid()
    OR lower(email) = lower(auth.email())
  );
