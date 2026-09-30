-- Lease Phase 10 (chunk 1/5) — back-pointers from child tables to leases
--
-- Phases 04–09 added several child tables (signing tokens, amendments,
-- inspections, e-sign consents, deposit accountings) that key off
-- applications.app_id (TEXT) or applications.id (UUID). Now that leases
-- are first-class, every child row gets a nullable leases.id FK. The
-- backfill in migration 20260506000003 fills it for historical rows;
-- new rows written by Phase-10 edge functions populate it directly.
--
-- Idempotent: column adds use IF NOT EXISTS, FK adds are guarded by a
-- DO block that checks pg_constraint first. The migration also handles
-- the lease_signing_tokens_admin VIEW (drop + recreate) and re-attaches
-- the FKs that were CASCADE-dropped when the partial old leases shell
-- was torn down in migration 1.

-- ---- 1. lease_signing_tokens (TEXT app_id) ---------------------------------
ALTER TABLE public.lease_signing_tokens
  ADD COLUMN IF NOT EXISTS lease_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lease_signing_tokens_lease_id_fkey'
  ) THEN
    ALTER TABLE public.lease_signing_tokens
      ADD CONSTRAINT lease_signing_tokens_lease_id_fkey
      FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS lease_signing_tokens_lease_id_idx
  ON public.lease_signing_tokens (lease_id);

-- ---- 2. lease_signing_tokens_admin (VIEW — drop + recreate to expose lease_id)
DROP VIEW IF EXISTS public.lease_signing_tokens_admin;
CREATE OR REPLACE VIEW public.lease_signing_tokens_admin AS
  SELECT
    token,
    app_id,
    lease_id,
    signer_role,
    signer_email,
    amendment_id,
    created_at,
    expires_at,
    used_at,
    revoked_at,
    revoked_by,
    revoke_reason,
    ip_locked_to,
    CASE
      WHEN used_at    IS NOT NULL THEN 'used'::text
      WHEN revoked_at IS NOT NULL THEN 'revoked'::text
      WHEN expires_at < now()     THEN 'expired'::text
      ELSE 'active'::text
    END AS status
  FROM public.lease_signing_tokens t;

GRANT SELECT ON public.lease_signing_tokens_admin TO authenticated;
GRANT SELECT ON public.lease_signing_tokens_admin TO service_role;

-- ---- 3. lease_amendments (TEXT app_id today) -------------------------------
ALTER TABLE public.lease_amendments
  ADD COLUMN IF NOT EXISTS lease_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lease_amendments_lease_id_fkey'
  ) THEN
    ALTER TABLE public.lease_amendments
      ADD CONSTRAINT lease_amendments_lease_id_fkey
      FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS lease_amendments_lease_id_idx
  ON public.lease_amendments (lease_id);

-- ---- 4. lease_inspections (UUID app_id today; refers to applications.id) ---
ALTER TABLE public.lease_inspections
  ADD COLUMN IF NOT EXISTS lease_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lease_inspections_lease_id_fkey'
  ) THEN
    ALTER TABLE public.lease_inspections
      ADD CONSTRAINT lease_inspections_lease_id_fkey
      FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS lease_inspections_lease_id_idx
  ON public.lease_inspections (lease_id);

-- ---- 5. lease_inspection_photos (piggyback on inspections) -----------------
ALTER TABLE public.lease_inspection_photos
  ADD COLUMN IF NOT EXISTS lease_id UUID;
CREATE INDEX IF NOT EXISTS lease_inspection_photos_lease_id_idx
  ON public.lease_inspection_photos (lease_id);

-- ---- 6. esign_consents (TEXT app_id) ---------------------------------------
ALTER TABLE public.esign_consents
  ADD COLUMN IF NOT EXISTS lease_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'esign_consents_lease_id_fkey'
  ) THEN
    ALTER TABLE public.esign_consents
      ADD CONSTRAINT esign_consents_lease_id_fkey
      FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS esign_consents_lease_id_idx
  ON public.esign_consents (lease_id);

-- ---- 7. Re-attach FKs that the CASCADE drop in migration 1 removed ---------
-- These columns existed before Phase 10; their FKs pointed at the abandoned
-- old leases shell and were CASCADE-dropped when we tore it down.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lease_pdf_versions_lease_id_fkey'
  ) THEN
    ALTER TABLE public.lease_pdf_versions
      ADD CONSTRAINT lease_pdf_versions_lease_id_fkey
      FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS lease_pdf_versions_lease_id_idx
  ON public.lease_pdf_versions (lease_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lease_addenda_attached_lease_id_fkey'
  ) THEN
    ALTER TABLE public.lease_addenda_attached
      ADD CONSTRAINT lease_addenda_attached_lease_id_fkey
      FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS lease_addenda_attached_lease_id_idx
  ON public.lease_addenda_attached (lease_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lease_deposit_accountings_lease_id_fkey'
  ) THEN
    ALTER TABLE public.lease_deposit_accountings
      ADD CONSTRAINT lease_deposit_accountings_lease_id_fkey
      FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS lease_deposit_accountings_lease_id_idx
  ON public.lease_deposit_accountings (lease_id);

-- ---- 8. applications.current_lease_id --------------------------------------
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS current_lease_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_current_lease_id_fkey'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_current_lease_id_fkey
      FOREIGN KEY (current_lease_id) REFERENCES public.leases(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS applications_current_lease_id_idx
  ON public.applications (current_lease_id);
COMMENT ON COLUMN public.applications.current_lease_id IS
  'Phase 10: pointer to the application''s currently-active lease (most-recent non-terminated row in leases). Updated by generate-lease and renewal flows. Nullable when no lease has been generated yet.';
