-- ============================================================================
-- Migration: Enhanced Card & Alternative Payment Workflow States
-- Additive & idempotent. Expands payment workflow states to distinguish:
--   - Payment Required
--   - Payment Method Selected
--   - Awaiting Payment
--   - Payment Submitted for Verification
--   - Payment Confirmed
--   - Payment Unsuccessful
--   - Payment Cancelled
-- While keeping full backwards compatibility with legacy state labels.
-- ============================================================================

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS selected_payment_method text,
  ADD COLUMN IF NOT EXISTS external_payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz;

ALTER TABLE public.application_applicants
  ADD COLUMN IF NOT EXISTS selected_payment_method text,
  ADD COLUMN IF NOT EXISTS external_payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz;

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_payment_state_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_payment_state_check
  CHECK (
    application_payment_state IS NULL OR application_payment_state IN (
      'Application Started',
      'Application Submitted',
      'Payment Required',
      'Payment Method Selected',
      'Awaiting Payment',
      'Payment Processing',
      'Payment Submitted for Verification',
      'Payment Confirmed',
      'Payment Successful',
      'Payment Unsuccessful',
      'Payment Failed',
      'Payment Cancelled',
      'Payment Assistance Required'
    )
  );

CREATE INDEX IF NOT EXISTS idx_applications_selected_payment_method
  ON public.applications (selected_payment_method)
  WHERE selected_payment_method IS NOT NULL;
