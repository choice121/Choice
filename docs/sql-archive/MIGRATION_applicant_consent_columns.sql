-- ============================================================================
-- MIGRATION: applicant consent columns
-- ============================================================================
-- Adds explicit consent capture columns to the applications table to support
-- Policy Framework v2.0 (Effective April 22, 2026).
--
-- These columns store the timestamped, versioned record of the applicant's
-- agreement to Terms / Privacy / Policy Framework, plus their separate SMS
-- opt-in (which under FCC 1:1 consent rules must be unbundled from other
-- consents).
--
-- Safe to run multiple times — uses IF NOT EXISTS.
-- ============================================================================

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS terms_consent          boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent            boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_timestamp      timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version        text;

COMMENT ON COLUMN applications.terms_consent     IS 'Applicant explicitly agreed to Terms of Service, Privacy Policy, and Complete Policy Framework at submission time.';
COMMENT ON COLUMN applications.sms_consent       IS 'Applicant explicitly opted in to transactional SMS at submission time. Required separately from terms_consent under FCC 1:1 consent rule.';
COMMENT ON COLUMN applications.consent_timestamp IS 'ISO timestamp at the moment the applicant clicked Submit and consents were captured client-side.';
COMMENT ON COLUMN applications.consent_version   IS 'Version string of the policy framework in effect at the time of consent (e.g. "2.0").';

-- Optional: index for compliance audits filtering by SMS-opted-in applicants
CREATE INDEX IF NOT EXISTS idx_applications_sms_consent
  ON applications(sms_consent)
  WHERE sms_consent = true;
