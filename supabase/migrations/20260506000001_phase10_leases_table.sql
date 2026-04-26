-- Lease Phase 10 (chunk 1/5) — Leases as a first-class entity
--
-- Creates public.leases with all lease-specific fields lifted out of
-- public.applications. One application can spawn many leases over time
-- (renewals, replacements after roommate changes, term changes).
--
-- Design notes:
--   * leases.id              — new UUID PK, primary handle for every lease op
--   * leases.application_id  — FK to applications.id (UUID, internal)
--   * leases.app_id          — TEXT (human-readable, matches applications.app_id),
--                              kept for log/email continuity & legacy code paths
--   * leases.parent_lease_id — self-FK; non-null on renewals/amendments-as-new-lease
--   * leases.lease_status    — TEXT with CHECK; covers the full lifecycle
--                              (draft|sent|partially_signed|fully_signed|active
--                               |expiring|expired|terminated|renewed|cancelled)
--
-- The DEPRECATED columns on applications (lease_*) stay in place per
-- LEASE_IMPLEMENTATION.md §3 — removal is explicitly scheduled for Phase 14.
-- Column comments mark them deprecated so future schema scans surface it.
--
-- Idempotent: every CREATE uses IF NOT EXISTS / DO blocks.

-- 1. The table itself ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leases (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id              UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  app_id                      TEXT,                         -- human-readable, denormalized from applications.app_id
  parent_lease_id             UUID REFERENCES public.leases(id) ON DELETE SET NULL,
  listing_id                  TEXT,
  landlord_id                 UUID,
  property_address            TEXT,

  -- Term + money
  lease_state_code            TEXT,
  lease_start_date            DATE,
  lease_end_date              DATE,
  monthly_rent                NUMERIC(10,2),
  security_deposit            NUMERIC(10,2),
  move_in_costs               NUMERIC(10,2),

  -- Phase 07 itemized financials
  first_month_rent            NUMERIC(10,2),
  last_month_rent             NUMERIC(10,2),
  pet_deposit                 NUMERIC(10,2),
  pet_rent                    NUMERIC(10,2),
  admin_fee                   NUMERIC(10,2),
  key_deposit                 NUMERIC(10,2),
  parking_fee                 NUMERIC(10,2),
  cleaning_fee                NUMERIC(10,2),
  cleaning_fee_refundable     BOOLEAN,
  rent_due_day_of_month       INTEGER CHECK (rent_due_day_of_month BETWEEN 1 AND 28),
  rent_proration_method       TEXT,
  prorated_first_month        NUMERIC(10,2),

  -- Phase 07 utility responsibilities
  utility_responsibilities    JSONB,

  -- Policies + landlord identity (snapshotted on the lease so renewals
  -- can carry forward even if the application was scrubbed/archived)
  lease_landlord_name         TEXT,
  lease_landlord_address      TEXT,
  lease_late_fee_flat         NUMERIC(10,2),
  lease_late_fee_daily        NUMERIC(10,2),
  lease_pets_policy           TEXT,
  lease_smoking_policy        TEXT,
  lease_compliance_snapshot   TEXT,
  lease_notes                 TEXT,

  -- Template snapshot (immutable per Phase 03)
  lease_template_version_id   UUID,

  -- Current PDF pointer (most-recent finalized PDF). Per-version history
  -- still lives in lease_pdf_versions.
  lease_pdf_url               TEXT,

  -- Signature state mirrors the historical applications-table fields
  tenant_signature            TEXT,
  tenant_signature_image      TEXT,
  signature_timestamp         TIMESTAMPTZ,
  lease_ip_address            TEXT,
  co_applicant_signature      TEXT,
  co_applicant_signature_image TEXT,
  co_applicant_signature_timestamp TIMESTAMPTZ,
  management_signed           BOOLEAN DEFAULT false,
  management_signer_name      TEXT,
  management_signed_at        TIMESTAMPTZ,
  management_notes            TEXT,
  management_cosigned         BOOLEAN DEFAULT false,
  management_cosigned_by      TEXT,
  management_cosigned_at      TIMESTAMPTZ,

  -- Lifecycle
  lease_status                TEXT NOT NULL DEFAULT 'draft',
  lease_sent_date             TIMESTAMPTZ,
  lease_signed_date           TIMESTAMPTZ,
  executed_at                 TIMESTAMPTZ,
  terminated_at               TIMESTAMPTZ,
  termination_reason          TEXT,
  renewed_at                  TIMESTAMPTZ,
  cancelled_at                TIMESTAMPTZ,
  cancellation_reason         TEXT,
  lease_expiry_date           TIMESTAMPTZ,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  TEXT,

  CONSTRAINT leases_status_check CHECK (lease_status IN (
    'draft','sent','partially_signed','fully_signed','active',
    'expiring','expired','terminated','renewed','cancelled'
  ))
);

-- Comments — make schema introspection self-documenting
COMMENT ON TABLE public.leases IS
  'Phase 10: leases lifted out of applications. One application can spawn many leases (renewals, replacements). All lease ops should be keyed by leases.id; applications.lease_* columns are deprecated and slated for removal in Phase 14.';
COMMENT ON COLUMN public.leases.app_id IS
  'Human-readable application id (matches applications.app_id). Denormalized for log/email/legacy continuity. Authoritative join is leases.application_id → applications.id.';
COMMENT ON COLUMN public.leases.parent_lease_id IS
  'When non-null, this lease is a renewal/replacement of the parent lease. Used to walk lease history per tenant/property.';
COMMENT ON COLUMN public.leases.lease_status IS
  'Lifecycle state: draft → sent → partially_signed → fully_signed → active → (expiring | expired | terminated | renewed | cancelled).';

-- Indexes for the common access patterns -------------------------------------
CREATE INDEX IF NOT EXISTS leases_application_id_idx       ON public.leases (application_id);
CREATE INDEX IF NOT EXISTS leases_app_id_idx               ON public.leases (app_id);
CREATE INDEX IF NOT EXISTS leases_parent_lease_id_idx      ON public.leases (parent_lease_id);
CREATE INDEX IF NOT EXISTS leases_landlord_id_idx          ON public.leases (landlord_id);
CREATE INDEX IF NOT EXISTS leases_lease_status_idx         ON public.leases (lease_status);
CREATE INDEX IF NOT EXISTS leases_lease_end_date_idx       ON public.leases (lease_end_date);
CREATE UNIQUE INDEX IF NOT EXISTS leases_active_per_app_idx
  ON public.leases (application_id)
  WHERE lease_status IN ('draft','sent','partially_signed','fully_signed','active','expiring');
-- ^ at most one "live" lease per application — renewals must transition the
--   prior lease to 'renewed'/'expired' before issuing a new active one.

-- updated_at trigger ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public._leases_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS leases_set_updated_at ON public.leases;
CREATE TRIGGER leases_set_updated_at
  BEFORE UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public._leases_set_updated_at();

-- 2. RLS ---------------------------------------------------------------------
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically; explicit policies for authenticated:
DROP POLICY IF EXISTS leases_admin_all       ON public.leases;
DROP POLICY IF EXISTS leases_landlord_select ON public.leases;
DROP POLICY IF EXISTS leases_tenant_select   ON public.leases;

-- Admin: full access
CREATE POLICY leases_admin_all ON public.leases
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_roles r WHERE r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_roles r WHERE r.user_id = auth.uid()));

-- Landlord: read leases on their own listings
CREATE POLICY leases_landlord_select ON public.leases
  FOR SELECT TO authenticated
  USING (
    landlord_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = public.leases.application_id
        AND a.landlord_id = auth.uid()
    )
  );

-- Tenant: read leases tied to their confirmed-email application.
-- Reuses the Phase 05 helper public.current_confirmed_email() to prevent
-- the unconfirmed-account-takeover hole that closed C-3.
CREATE POLICY leases_tenant_select ON public.leases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = public.leases.application_id
        AND lower(a.email) = lower(public.current_confirmed_email())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leases TO service_role;

-- 3. Mark applications.lease_* columns deprecated ----------------------------
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='applications'
      AND column_name IN (
        'lease_status','lease_sent_date','lease_signed_date','lease_start_date',
        'lease_end_date','monthly_rent','security_deposit','move_in_costs',
        'lease_notes','lease_late_fee_flat','lease_late_fee_daily','lease_expiry_date',
        'lease_state_code','lease_landlord_name','lease_landlord_address',
        'lease_pets_policy','lease_smoking_policy','lease_compliance_snapshot',
        'lease_pdf_url','tenant_signature','tenant_sign_token','signature_timestamp',
        'lease_ip_address','co_applicant_signature','co_applicant_signature_timestamp',
        'co_applicant_lease_token','tenant_signature_image','co_applicant_signature_image',
        'lease_template_version_id','management_signed','management_signer_name',
        'management_signed_at','management_notes','management_cosigned',
        'management_cosigned_by','management_cosigned_at','first_month_rent',
        'last_month_rent','pet_deposit','pet_rent','admin_fee','key_deposit',
        'parking_fee','cleaning_fee','cleaning_fee_refundable','rent_due_day_of_month',
        'rent_proration_method','prorated_first_month','utility_responsibilities'
      )
  LOOP
    EXECUTE format(
      'COMMENT ON COLUMN public.applications.%I IS %L',
      c,
      'DEPRECATED (Phase 10) — see leases.' || c || '. Will be removed in Phase 14.'
    );
  END LOOP;
END$$;
