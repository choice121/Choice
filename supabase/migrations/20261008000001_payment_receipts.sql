BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id           TEXT NOT NULL REFERENCES public.applications(app_id) ON DELETE CASCADE,
  receipt_type     TEXT NOT NULL CHECK (receipt_type IN ('application_fee', 'holding_deposit')),
  receipt_number   TEXT NOT NULL UNIQUE,
  amount           NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency         TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  payment_method   TEXT,
  transaction_ref  TEXT,
  paid_at          TIMESTAMPTZ NOT NULL,
  storage_path     TEXT,
  size_bytes       INTEGER,
  sha256           TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'void')),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_at        TIMESTAMPTZ,
  UNIQUE (app_id, receipt_type, paid_at)
);

CREATE INDEX IF NOT EXISTS payment_receipts_app_created_idx
  ON public.payment_receipts (app_id, created_at DESC);

ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_receipts_admin_all ON public.payment_receipts;
CREATE POLICY payment_receipts_admin_all ON public.payment_receipts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS payment_receipts_client_no_access ON public.payment_receipts;
CREATE POLICY payment_receipts_client_no_access ON public.payment_receipts
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;