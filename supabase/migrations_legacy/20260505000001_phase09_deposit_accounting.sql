-- ─────────────────────────────────────────────────────────────────────
-- Phase 09 (chunk 1/5) — Security Deposit Accounting — DB foundation
--
-- Lays down the schema the rest of Phase 09 builds on:
--
--   • applications.move_out_date_actual    — needed to compute the
--                                            per-state return-deadline
--                                            (= move_out + state_lease_law
--                                              .security_deposit_return_days)
--   • lease_deposit_accountings            — header row, one per
--                                            terminated lease; carries
--                                            the totals, deadline, PDF
--                                            integrity hash, and dispute
--                                            tracking.
--   • lease_deposit_deductions             — line-items linked back to
--                                            optional Phase 8 inspection
--                                            evidence rows.
--   • Extends lease_pdf_versions.event     — adds 'deposit_accounting'
--                                            so the deduction-letter PDF
--                                            joins the existing audit
--                                            trail (download-lease,
--                                            integrity verification).
--
-- This migration is intentionally schema-only. The generate-deposit-letter
-- edge function, per-state letter partials, admin /admin/deposit-accounting
-- page, and tenant /tenant/deposit page (with dispute writer) ship in
-- subsequent Phase 09 chunks 2–5.
--
-- Idempotent: every CREATE / ALTER uses IF NOT EXISTS / DO blocks; every
-- POLICY uses DROP IF EXISTS then CREATE.
--
-- Brief: lease-phases/PHASE_09_deposit_accounting.md §3 + §6 + §7
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 0. applications.move_out_date_actual
--
-- Phase 8 already records `move_in_date_actual`. To compute the per-state
-- security-deposit return deadline at lease end (§3 brief), we also need
-- the actual move-out date. Nullable because not every co_signed lease
-- has terminated yet.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS move_out_date_actual DATE;

CREATE INDEX IF NOT EXISTS idx_applications_move_out_date_actual
  ON public.applications (move_out_date_actual)
  WHERE move_out_date_actual IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 1. lease_deposit_accountings — one row per terminated lease
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lease_deposit_accountings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id                      UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,

  -- Forward FK to Phase 11 lease_terminations (table doesn't exist yet —
  -- column kept nullable + UNIQUE so we can backfill later without losing
  -- data integrity).
  lease_termination_id        UUID,

  -- Money
  total_deposit_held          NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_withheld             NUMERIC(10,2) NOT NULL DEFAULT 0,
  refund_owed_to_tenant       NUMERIC(10,2) NOT NULL DEFAULT 0,
  interest_accrued            NUMERIC(10,2) NOT NULL DEFAULT 0,    -- some states (NJ, MA, IL...)

  -- Deadlines / state context (snapshot so audit ≠ future law changes)
  state_code_snapshot         TEXT,                                 -- e.g. 'CA'
  state_return_days_snapshot  INT,                                  -- e.g. 21 for CA
  move_out_date_snapshot      DATE,
  state_return_deadline       DATE,                                 -- move_out + return_days
  late_generated              BOOLEAN NOT NULL DEFAULT FALSE,       -- §7 acceptance criterion

  -- PDF artifact (Phase 06 integrity convention reused)
  letter_pdf_path             TEXT,                                 -- path inside lease-pdfs bucket
  letter_pdf_sha256           TEXT,                                 -- 64-hex
  letter_pdf_bytes            INT,

  -- Lifecycle
  generated_at                TIMESTAMPTZ,
  generated_by                UUID,                                 -- admin auth.uid()
  sent_at                     TIMESTAMPTZ,
  sent_to_email               TEXT,
  tenant_disputed_at          TIMESTAMPTZ,
  tenant_dispute_text         TEXT,
  admin_notes                 TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT lease_deposit_accountings_money_nonneg
    CHECK (total_deposit_held    >= 0
       AND amount_withheld       >= 0
       AND refund_owed_to_tenant >= 0
       AND interest_accrued      >= 0),
  CONSTRAINT lease_deposit_accountings_sha256_chk
    CHECK (letter_pdf_sha256 IS NULL OR letter_pdf_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT lease_deposit_accountings_state_code_chk
    CHECK (state_code_snapshot IS NULL OR state_code_snapshot ~ '^[A-Z]{2}$'),
  CONSTRAINT lease_deposit_accountings_return_days_chk
    CHECK (state_return_days_snapshot IS NULL OR state_return_days_snapshot BETWEEN 1 AND 120)
);

-- One accounting per (app_id, lease_termination_id). For now most rows
-- will have NULL lease_termination_id, so we also enforce one-per-app
-- when termination is null.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lease_deposit_accountings_app_termination
  ON public.lease_deposit_accountings (app_id, lease_termination_id)
  WHERE lease_termination_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lease_deposit_accountings_app_no_termination
  ON public.lease_deposit_accountings (app_id)
  WHERE lease_termination_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_lease_deposit_accountings_app_id
  ON public.lease_deposit_accountings (app_id);
CREATE INDEX IF NOT EXISTS idx_lease_deposit_accountings_deadline
  ON public.lease_deposit_accountings (state_return_deadline)
  WHERE state_return_deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lease_deposit_accountings_generated_at
  ON public.lease_deposit_accountings (generated_at DESC NULLS LAST);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.lease_deposit_accountings_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END$$;

DROP TRIGGER IF EXISTS lease_deposit_accountings_touch ON public.lease_deposit_accountings;
CREATE TRIGGER lease_deposit_accountings_touch
  BEFORE UPDATE ON public.lease_deposit_accountings
  FOR EACH ROW EXECUTE FUNCTION public.lease_deposit_accountings_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 2. lease_deposit_deductions — one row per line-item charge
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lease_deposit_deductions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_id               UUID NOT NULL REFERENCES public.lease_deposit_accountings(id) ON DELETE CASCADE,
  app_id                      UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,

  category                    TEXT NOT NULL,              -- see CHECK below
  description                 TEXT NOT NULL,
  amount                      NUMERIC(10,2) NOT NULL,

  -- Optional links back to evidence
  inspection_id               UUID REFERENCES public.lease_inspections(id) ON DELETE SET NULL,
  supporting_photo_paths      TEXT[] NOT NULL DEFAULT '{}'::TEXT[],     -- storage paths in lease-inspection-photos
  receipt_paths               TEXT[] NOT NULL DEFAULT '{}'::TEXT[],     -- CA Civ. §1950.5(g): >$125 needs receipts

  sort_order                  INT NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT lease_deposit_deductions_category_chk
    CHECK (category IN ('rent_arrears','cleaning','damages','unpaid_utilities','early_termination','other')),
  CONSTRAINT lease_deposit_deductions_amount_nonneg
    CHECK (amount >= 0),
  CONSTRAINT lease_deposit_deductions_description_nonempty
    CHECK (length(btrim(description)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_lease_deposit_deductions_accounting
  ON public.lease_deposit_deductions (accounting_id);
CREATE INDEX IF NOT EXISTS idx_lease_deposit_deductions_app
  ON public.lease_deposit_deductions (app_id);
CREATE INDEX IF NOT EXISTS idx_lease_deposit_deductions_inspection
  ON public.lease_deposit_deductions (inspection_id)
  WHERE inspection_id IS NOT NULL;

-- Same updated_at trigger pattern
CREATE OR REPLACE FUNCTION public.lease_deposit_deductions_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END$$;

DROP TRIGGER IF EXISTS lease_deposit_deductions_touch ON public.lease_deposit_deductions;
CREATE TRIGGER lease_deposit_deductions_touch
  BEFORE UPDATE ON public.lease_deposit_deductions
  FOR EACH ROW EXECUTE FUNCTION public.lease_deposit_deductions_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 3. RLS — both tables
--
-- Visibility rules (mirror Phase 08 conventions, but tighter on tenant
-- writes — admin generates and amends; tenant only reads + disputes via
-- a service-role-backed edge fn shipping in chunk 5):
--
--   • Anonymous role: no access.
--   • Authenticated:
--       - admin (admin_roles row)               → full access (ALL)
--       - landlord owning the listing           → SELECT only
--       - tenant owning the application         → SELECT only
--   • Service role bypasses RLS — generate-deposit-letter and the
--     forthcoming submit-deposit-dispute fn will write on behalf of
--     either party.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.lease_deposit_accountings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_deposit_deductions  ENABLE ROW LEVEL SECURITY;

-- ── lease_deposit_accountings policies ───────────────────────────────
DROP POLICY IF EXISTS "lease_deposit_accountings_admin_all"      ON public.lease_deposit_accountings;
CREATE POLICY "lease_deposit_accountings_admin_all"
  ON public.lease_deposit_accountings FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "lease_deposit_accountings_tenant_read"    ON public.lease_deposit_accountings;
CREATE POLICY "lease_deposit_accountings_tenant_read"
  ON public.lease_deposit_accountings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = lease_deposit_accountings.app_id
         AND lower(a.email) = lower(coalesce(auth.email(), ''))
    )
  );

DROP POLICY IF EXISTS "lease_deposit_accountings_landlord_read"  ON public.lease_deposit_accountings;
CREATE POLICY "lease_deposit_accountings_landlord_read"
  ON public.lease_deposit_accountings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.applications a
        JOIN public.properties  p ON p.id = a.property_id
       WHERE a.id = lease_deposit_accountings.app_id
         AND p.landlord_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lease_deposit_accountings_anon_no_read"   ON public.lease_deposit_accountings;
CREATE POLICY "lease_deposit_accountings_anon_no_read"
  ON public.lease_deposit_accountings FOR SELECT TO anon USING (false);

-- ── lease_deposit_deductions policies ────────────────────────────────
DROP POLICY IF EXISTS "lease_deposit_deductions_admin_all"       ON public.lease_deposit_deductions;
CREATE POLICY "lease_deposit_deductions_admin_all"
  ON public.lease_deposit_deductions FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "lease_deposit_deductions_tenant_read"     ON public.lease_deposit_deductions;
CREATE POLICY "lease_deposit_deductions_tenant_read"
  ON public.lease_deposit_deductions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = lease_deposit_deductions.app_id
         AND lower(a.email) = lower(coalesce(auth.email(), ''))
    )
  );

DROP POLICY IF EXISTS "lease_deposit_deductions_landlord_read"   ON public.lease_deposit_deductions;
CREATE POLICY "lease_deposit_deductions_landlord_read"
  ON public.lease_deposit_deductions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.applications a
        JOIN public.properties  p ON p.id = a.property_id
       WHERE a.id = lease_deposit_deductions.app_id
         AND p.landlord_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lease_deposit_deductions_anon_no_read"    ON public.lease_deposit_deductions;
CREATE POLICY "lease_deposit_deductions_anon_no_read"
  ON public.lease_deposit_deductions FOR SELECT TO anon USING (false);

-- ─────────────────────────────────────────────────────────────────────
-- 4. Extend lease_pdf_versions.event constraint
--
-- Adds 'deposit_accounting' so the deduction-letter PDF (chunk 2) can be
-- mirrored into lease_pdf_versions and inherit Phase 06 integrity +
-- download-lease + verify-lease pipelines uniformly with everything else.
-- ─────────────────────────────────────────────────────────────────────

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
    'inspection_moveout',
    'deposit_accounting'
  ]));

COMMIT;
