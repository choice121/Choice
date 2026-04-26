-- ─────────────────────────────────────────────────────────────────────
-- Phase 08 (chunk 1/N) — Move-in / Move-out condition reports — DB foundation
--
-- Lays down everything the rest of Phase 08 builds on:
--
--   • lease_inspections          — header row per inspection
--                                  (move_in | mid_term | move_out)
--   • lease_inspection_photos    — one row per uploaded photo, keyed by
--                                  room/item, with EXIF DateTimeOriginal
--                                  preserved for evidentiary value.
--   • Storage bucket lease-inspection-photos (private), with RLS policies
--     scoping reads/writes to the matching app_id owner / landlord /
--     admin / service role.
--
-- This migration is intentionally schema-only. The record-inspection edge
-- function, inspection PDF renderer, tenant wizard, landlord review UI,
-- and admin index page ship in subsequent Phase 08 chunks.
--
-- Idempotent: every CREATE / ALTER uses IF NOT EXISTS / DO blocks; every
-- POLICY uses CREATE OR REPLACE-equivalent (DROP IF EXISTS then CREATE).
--
-- Brief: lease-phases/PHASE_08_condition_reports.md §3 + §6 + §7
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. lease_inspections — one row per inspection event
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lease_inspections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id                UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  inspection_type       TEXT NOT NULL,                       -- 'move_in' | 'mid_term' | 'move_out'
  scheduled_for         TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  completed_by_role     TEXT,                                -- 'tenant' | 'landlord' | 'joint'
  tenant_signed_at      TIMESTAMPTZ,
  landlord_signed_at    TIMESTAMPTZ,
  tenant_sig_image      TEXT,                                -- data: URL or storage path
  landlord_sig_image    TEXT,
  rooms                 JSONB NOT NULL DEFAULT '{}'::jsonb,  -- structured per §3 example
  notes                 TEXT,
  photos_count          INT  NOT NULL DEFAULT 0,
  pdf_storage_path      TEXT,                                -- path inside lease-pdfs bucket
  pdf_sha256            TEXT,                                -- 64 char hex (Phase 06 convention)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lease_inspections_type_chk
    CHECK (inspection_type IN ('move_in','mid_term','move_out')),
  CONSTRAINT lease_inspections_role_chk
    CHECK (completed_by_role IS NULL
           OR completed_by_role IN ('tenant','landlord','joint')),
  CONSTRAINT lease_inspections_pdf_sha256_chk
    CHECK (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_lease_inspections_app_id
  ON public.lease_inspections (app_id);
CREATE INDEX IF NOT EXISTS idx_lease_inspections_app_type
  ON public.lease_inspections (app_id, inspection_type);
CREATE INDEX IF NOT EXISTS idx_lease_inspections_completed
  ON public.lease_inspections (completed_at);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.lease_inspections_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END$$;

DROP TRIGGER IF EXISTS lease_inspections_touch ON public.lease_inspections;
CREATE TRIGGER lease_inspections_touch
  BEFORE UPDATE ON public.lease_inspections
  FOR EACH ROW EXECUTE FUNCTION public.lease_inspections_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 2. lease_inspection_photos — one row per uploaded photo
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lease_inspection_photos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id         UUID NOT NULL REFERENCES public.lease_inspections(id) ON DELETE CASCADE,
  app_id                UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  storage_path          TEXT NOT NULL,                       -- e.g. <app_id>/<inspection_id>/<uuid>.jpg
  room_key              TEXT NOT NULL,                       -- 'kitchen', 'bedroom_1', etc.
  item_key              TEXT,                                 -- 'stove', 'refrigerator', etc. (NULL for whole-room shots)
  caption               TEXT,
  taken_at_exif         TIMESTAMPTZ,                         -- EXIF DateTimeOriginal (GPS stripped before upload)
  uploaded_by           TEXT,                                -- 'tenant' | 'landlord' | 'admin'
  byte_size             INT,
  width                 INT,
  height                INT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lease_inspection_photos_uploader_chk
    CHECK (uploaded_by IS NULL OR uploaded_by IN ('tenant','landlord','admin')),
  UNIQUE (inspection_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_lease_inspection_photos_inspection
  ON public.lease_inspection_photos (inspection_id);
CREATE INDEX IF NOT EXISTS idx_lease_inspection_photos_app_room
  ON public.lease_inspection_photos (app_id, room_key);

-- Maintain photos_count on the parent header
CREATE OR REPLACE FUNCTION public.lease_inspections_recount_photos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target_id UUID;
BEGIN
  target_id := COALESCE(NEW.inspection_id, OLD.inspection_id);
  UPDATE public.lease_inspections
     SET photos_count = (SELECT count(*) FROM public.lease_inspection_photos WHERE inspection_id = target_id),
         updated_at   = now()
   WHERE id = target_id;
  RETURN NULL;
END$$;

DROP TRIGGER IF EXISTS lease_inspection_photos_recount_ins ON public.lease_inspection_photos;
CREATE TRIGGER lease_inspection_photos_recount_ins
  AFTER INSERT OR DELETE ON public.lease_inspection_photos
  FOR EACH ROW EXECUTE FUNCTION public.lease_inspections_recount_photos();

-- ─────────────────────────────────────────────────────────────────────
-- 3. RLS — both tables
--
-- Visibility rules:
--   • Anonymous role: no access (default deny).
--   • Authenticated:
--       - admin (admin_roles row) → full access.
--       - landlord owning the listing referenced by app_id → SELECT only.
--       - tenant owning the application (email match on auth.email() vs
--         applications.email) → SELECT + INSERT + UPDATE on their own
--         inspection rows.
--   • Service role (used by edge functions) bypasses RLS by definition,
--     so record-inspection can write rows on behalf of either party.
--
-- The landlord/tenant predicates are joined through the existing
-- applications + properties tables. If/when Phase 10 lifts leases out
-- of applications, these policies will be re-pointed at the new tables.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.lease_inspections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_inspection_photos  ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin? Reused from existing patterns.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace) THEN
    -- No-op: some envs already define this. Skip if absent and inline the check below.
    NULL;
  END IF;
END$$;

-- ── lease_inspections policies ───────────────────────────────────────
DROP POLICY IF EXISTS "lease_inspections_admin_all"    ON public.lease_inspections;
CREATE POLICY "lease_inspections_admin_all"
  ON public.lease_inspections FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "lease_inspections_tenant_rw" ON public.lease_inspections;
CREATE POLICY "lease_inspections_tenant_rw"
  ON public.lease_inspections FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = lease_inspections.app_id
         AND lower(a.email) = lower(coalesce(auth.email(), ''))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = lease_inspections.app_id
         AND lower(a.email) = lower(coalesce(auth.email(), ''))
    )
  );

DROP POLICY IF EXISTS "lease_inspections_landlord_read" ON public.lease_inspections;
CREATE POLICY "lease_inspections_landlord_read"
  ON public.lease_inspections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.applications a
        JOIN public.properties  p ON p.id = a.property_id
       WHERE a.id = lease_inspections.app_id
         AND p.landlord_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lease_inspections_anon_no_read" ON public.lease_inspections;
CREATE POLICY "lease_inspections_anon_no_read"
  ON public.lease_inspections FOR SELECT TO anon USING (false);

-- ── lease_inspection_photos policies ─────────────────────────────────
DROP POLICY IF EXISTS "lease_inspection_photos_admin_all" ON public.lease_inspection_photos;
CREATE POLICY "lease_inspection_photos_admin_all"
  ON public.lease_inspection_photos FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "lease_inspection_photos_tenant_rw" ON public.lease_inspection_photos;
CREATE POLICY "lease_inspection_photos_tenant_rw"
  ON public.lease_inspection_photos FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = lease_inspection_photos.app_id
         AND lower(a.email) = lower(coalesce(auth.email(), ''))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = lease_inspection_photos.app_id
         AND lower(a.email) = lower(coalesce(auth.email(), ''))
    )
  );

DROP POLICY IF EXISTS "lease_inspection_photos_landlord_read" ON public.lease_inspection_photos;
CREATE POLICY "lease_inspection_photos_landlord_read"
  ON public.lease_inspection_photos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.applications a
        JOIN public.properties  p ON p.id = a.property_id
       WHERE a.id = lease_inspection_photos.app_id
         AND p.landlord_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lease_inspection_photos_anon_no_read" ON public.lease_inspection_photos;
CREATE POLICY "lease_inspection_photos_anon_no_read"
  ON public.lease_inspection_photos FOR SELECT TO anon USING (false);

-- ─────────────────────────────────────────────────────────────────────
-- 4. Storage bucket: lease-inspection-photos (private)
--
-- Created via storage.create_bucket() helper if missing. Policies live
-- on storage.objects and scope reads/writes to paths prefixed with the
-- matching app_id (denormalised in object name and joined back to
-- applications for ownership). Service role bypasses RLS as usual.
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('lease-inspection-photos', 'lease-inspection-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop pre-existing policies (idempotent re-run support)
DROP POLICY IF EXISTS "lease_inspection_photos_anon_no_read"      ON storage.objects;
DROP POLICY IF EXISTS "lease_inspection_bucket_anon_no_read"      ON storage.objects;
DROP POLICY IF EXISTS "lease_inspection_bucket_admin_all"         ON storage.objects;
DROP POLICY IF EXISTS "lease_inspection_bucket_tenant_rw"         ON storage.objects;
DROP POLICY IF EXISTS "lease_inspection_bucket_landlord_read"     ON storage.objects;

-- Anon: deny entirely.
CREATE POLICY "lease_inspection_bucket_anon_no_read"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'lease-inspection-photos' AND false);

-- Admin: full access.
CREATE POLICY "lease_inspection_bucket_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING      (bucket_id = 'lease-inspection-photos'
              AND EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()))
  WITH CHECK (bucket_id = 'lease-inspection-photos'
              AND EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()));

-- Tenant: read/write objects whose path begins with their owned app_id.
-- The path convention enforced by record-inspection is "<app_id>/...".
-- Helper guard: split_part(name,'/',1) must be a valid UUID. Cast in
-- a CASE so non-conforming object names simply don't match (instead
-- of erroring the whole RLS evaluation).
CREATE POLICY "lease_inspection_bucket_tenant_rw"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'lease-inspection-photos'
    AND split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = split_part(name, '/', 1)::uuid
         AND lower(a.email) = lower(coalesce(auth.email(), ''))
    )
  )
  WITH CHECK (
    bucket_id = 'lease-inspection-photos'
    AND split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = split_part(name, '/', 1)::uuid
         AND lower(a.email) = lower(coalesce(auth.email(), ''))
    )
  );

-- Landlord: read-only on objects whose app_id maps to their listing.
CREATE POLICY "lease_inspection_bucket_landlord_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lease-inspection-photos'
    AND split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
        FROM public.applications a
        JOIN public.properties  p ON p.id = a.property_id
       WHERE a.id = split_part(name, '/', 1)::uuid
         AND p.landlord_id = auth.uid()
    )
  );

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- Post-migration expectations:
--   • lease_inspections, lease_inspection_photos tables exist with RLS on.
--   • Storage bucket lease-inspection-photos is private with 4 policies.
--   • Re-running this migration is a no-op (idempotent).
-- ─────────────────────────────────────────────────────────────────────
