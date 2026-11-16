-- ============================================================================
-- Migration: Card-First Application Payment Workflow & State Management
-- Supports:
--   - Application Submitted, Awaiting Payment, Payment Processing,
--     Payment Successful, Payment Failed, Payment Assistance Required
--   - Masked tokenized metadata only (NEVER stores raw PAN / CVV / CVC)
--   - Audit log table for payment attempts & failure recovery
-- ============================================================================

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS application_payment_state text DEFAULT 'Awaiting Payment',
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_transaction_ref text,
  ADD COLUMN IF NOT EXISTS payment_card_brand text,
  ADD COLUMN IF NOT EXISTS payment_card_last4 text,
  ADD COLUMN IF NOT EXISTS payment_failure_code text,
  ADD COLUMN IF NOT EXISTS payment_failure_reason text,
  ADD COLUMN IF NOT EXISTS payment_attempts_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_assistance_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_assistance_requested_at timestamptz;

-- Safely normalize legacy rows so existing paid/waived apps map cleanly
UPDATE public.applications
SET application_payment_state = CASE
  WHEN COALESCE(payment_status::text, 'unpaid') IN ('paid', 'waived') THEN 'Payment Successful'
  WHEN COALESCE(payment_assistance_required, false) = true THEN 'Payment Assistance Required'
  ELSE COALESCE(NULLIF(application_payment_state, ''), 'Awaiting Payment')
END
WHERE application_payment_state IS NULL
   OR application_payment_state = ''
   OR (COALESCE(payment_status::text, 'unpaid') IN ('paid', 'waived') AND application_payment_state <> 'Payment Successful');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_payment_state_check'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_payment_state_check
      CHECK (
        application_payment_state IS NULL OR application_payment_state IN (
          'Application Submitted',
          'Awaiting Payment',
          'Payment Processing',
          'Payment Successful',
          'Payment Failed',
          'Payment Assistance Required'
        )
      );
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_applications_payment_state
  ON public.applications (application_payment_state);

CREATE INDEX IF NOT EXISTS idx_applications_payment_assistance
  ON public.applications (payment_assistance_required)
  WHERE payment_assistance_required = true;

-- ── Payment Transaction Attempt Ledger (Tokenized References Only) ──────────
CREATE TABLE IF NOT EXISTS public.application_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE,
  app_id text NOT NULL,
  transaction_ref text NOT NULL,
  provider text NOT NULL DEFAULT 'card_gateway',
  state text NOT NULL,
  amount numeric(10, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  card_brand text,
  card_last4 text,
  failure_code text,
  failure_reason text,
  attempt_number integer NOT NULL DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_payment_tx_app_id
  ON public.application_payment_transactions (app_id, created_at DESC);

ALTER TABLE public.application_payment_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'application_payment_transactions'
      AND policyname = 'Admin full access to payment transactions'
  ) THEN
    CREATE POLICY "Admin full access to payment transactions"
      ON public.application_payment_transactions
      FOR ALL
      TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
      );
  END IF;
END$$;
