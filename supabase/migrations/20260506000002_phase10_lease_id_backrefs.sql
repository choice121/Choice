-- Lease Phase 10 (chunk 1/5) — back-pointers from child tables to leases
--
-- Phases 04–09 added several child tables (signing tokens, amendments,
-- inspections, e-sign consents) that key off applications.app_id (TEXT)
-- or applications.id (UUID). Now that leases are first-class, every
-- child row also gets a nullable leases.id FK. We populate it from the
-- denormalized app_id mapping in chunk 1/5's third migration; new rows
-- written by Phase-10 edge functions populate it directly.
--
-- We KEEP the existing app_id columns so old rows continue to resolve
-- and so legacy edge-function call paths still work during the rollout.
-- Phase 14 will drop them after the deprecation window.

-- 1. lease_signing_tokens (TEXT app_id)
ALTER TABLE public.lease_signing_tokens
  ADD COLUMN IF NOT EXISTS lease_id UUID REFERENCES public.leases(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS lease_signing_tokens_lease_id_idx
  ON public.lease_signing_tokens (lease_id);

-- 2. lease_signing_tokens_admin (audit copy)
ALTER TABLE public.lease_signing_tokens_admin
  ADD COLUMN IF NOT EXISTS lease_id UUID;
CREATE INDEX IF NOT EXISTS lease_signing_tokens_admin_lease_id_idx
  ON public.lease_signing_tokens_admin (lease_id);

-- 3. lease_amendments (TEXT app_id today)
ALTER TABLE public.lease_amendments
  ADD COLUMN IF NOT EXISTS lease_id UUID REFERENCES public.leases(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS lease_amendments_lease_id_idx
  ON public.lease_amendments (lease_id);

-- 4. lease_inspections (UUID app_id today; refers to applications.id)
ALTER TABLE public.lease_inspections
  ADD COLUMN IF NOT EXISTS lease_id UUID REFERENCES public.leases(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS lease_inspections_lease_id_idx
  ON public.lease_inspections (lease_id);

-- 5. lease_inspection_photos (UUID app_id; piggyback on inspections)
ALTER TABLE public.lease_inspection_photos
  ADD COLUMN IF NOT EXISTS lease_id UUID;
CREATE INDEX IF NOT EXISTS lease_inspection_photos_lease_id_idx
  ON public.lease_inspection_photos (lease_id);

-- 6. esign_consents (TEXT app_id)
ALTER TABLE public.esign_consents
  ADD COLUMN IF NOT EXISTS lease_id UUID REFERENCES public.leases(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS esign_consents_lease_id_idx
  ON public.esign_consents (lease_id);

-- 7. lease_deposit_deductions inherits via accountings.lease_id, which
--    already exists. Add convenience index.
CREATE INDEX IF NOT EXISTS lease_deposit_accountings_lease_id_idx
  ON public.lease_deposit_accountings (lease_id);

-- 8. applications: pointer back to the currently-active lease, so the
--    admin/tenant UI can do "show me the live lease for this app" in O(1)
--    without scanning leases. Nullable; updated by app-side logic.
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS current_lease_id UUID REFERENCES public.leases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS applications_current_lease_id_idx
  ON public.applications (current_lease_id);
COMMENT ON COLUMN public.applications.current_lease_id IS
  'Phase 10: pointer to the application''s currently-active lease (most-recent non-terminated row in leases). Updated by generate-lease and renewal flows. Nullable when no lease has been generated yet.';
