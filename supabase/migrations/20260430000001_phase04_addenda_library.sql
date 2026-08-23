-- Lease Phase 04 — State-required disclosures library + auto-attach
  -- Schema only (seeds in companion migration). Adds two tables:
  --   1. lease_addenda_library    — per-jurisdiction addenda templates
  --   2. lease_addenda_attached   — per-application attachment + signature record
  -- Both are state-aware via the jurisdiction column ('federal' | 'common' | <state_code>).

  BEGIN;

  -- =========================================================================
  -- 1. lease_addenda_library  (template source)
  -- =========================================================================
  CREATE TABLE IF NOT EXISTS public.lease_addenda_library (
    slug                TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    jurisdiction        TEXT NOT NULL,
    applies_when        JSONB NOT NULL DEFAULT '{}'::jsonb,
    body                TEXT NOT NULL,
    attached_pdf_path   TEXT,
    signature_required  BOOLEAN NOT NULL DEFAULT true,
    initials_required   BOOLEAN NOT NULL DEFAULT false,
    citation            TEXT NOT NULL,
    source_url          TEXT NOT NULL,
    legal_review_status TEXT NOT NULL DEFAULT 'statute_derived'
      CHECK (legal_review_status IN ('statute_derived','attorney_reviewed','admin_draft','deprecated')),
    attorney_reviewed   BOOLEAN NOT NULL DEFAULT false,
    attorney_reviewer   TEXT,
    attorney_reviewed_at TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lease_addenda_library_slug_format
      CHECK (slug ~ '^[a-z]{2,8}/[a-z0-9-]{2,64}$'),
    CONSTRAINT lease_addenda_library_jurisdiction_format
      CHECK (jurisdiction = 'federal'
          OR jurisdiction = 'common'
          OR jurisdiction ~ '^[A-Z]{2}$')
  );

  COMMENT ON TABLE  public.lease_addenda_library IS
    'Phase 04: library of disclosure addenda. One row per addendum template (e.g. federal/lead-paint, ca/bedbug). The body uses the Phase 01 templating engine.';
  COMMENT ON COLUMN public.lease_addenda_library.jurisdiction IS
    'federal | common | <2-letter state code>. Drives auto-attach by lease state.';
  COMMENT ON COLUMN public.lease_addenda_library.applies_when IS
    'JSON predicate evaluated by generate-lease. Recognized keys: property_built_before (int year), property_type (array of strings), requires_pets (bool), state_security_deposit_separate_account (bool).';
  COMMENT ON COLUMN public.lease_addenda_library.attached_pdf_path IS
    'Optional path to a PDF asset to embed after the addendum text (e.g. assets/legal/epa-lead-pamphlet-2020.pdf).';

  CREATE INDEX IF NOT EXISTS lease_addenda_library_jurisdiction_active_idx
    ON public.lease_addenda_library (jurisdiction, is_active);
  CREATE INDEX IF NOT EXISTS lease_addenda_library_active_idx
    ON public.lease_addenda_library (is_active) WHERE is_active;

  -- updated_at trigger
  CREATE OR REPLACE FUNCTION public.lease_addenda_library_touch_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

  DROP TRIGGER IF EXISTS lease_addenda_library_touch ON public.lease_addenda_library;
  CREATE TRIGGER lease_addenda_library_touch
    BEFORE UPDATE ON public.lease_addenda_library
    FOR EACH ROW EXECUTE FUNCTION public.lease_addenda_library_touch_updated_at();

  -- RLS: admins full access; anon read for active rows (so the tenant
  -- signing UI can list addenda without a service-role key).
  ALTER TABLE public.lease_addenda_library ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "addenda_library_admin_all"  ON public.lease_addenda_library;
  DROP POLICY IF EXISTS "addenda_library_anon_read"  ON public.lease_addenda_library;
  DROP POLICY IF EXISTS "addenda_library_auth_read"  ON public.lease_addenda_library;

  CREATE POLICY "addenda_library_admin_all"
    ON public.lease_addenda_library FOR ALL TO authenticated
    USING      (EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()));

  CREATE POLICY "addenda_library_anon_read"
    ON public.lease_addenda_library FOR SELECT TO anon
    USING (is_active);

  CREATE POLICY "addenda_library_auth_read"
    ON public.lease_addenda_library FOR SELECT TO authenticated
    USING (is_active);

  -- =========================================================================
  -- 2. lease_addenda_attached  (per-application attachment + signature record)
  -- =========================================================================
  CREATE TABLE IF NOT EXISTS public.lease_addenda_attached (
    id                  BIGSERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL,
    application_pk      BIGINT,                   -- nullable mirror of applications.id (best-effort link)
    addendum_slug       TEXT NOT NULL REFERENCES public.lease_addenda_library(slug)
                            ON UPDATE CASCADE ON DELETE RESTRICT,
    addendum_title      TEXT NOT NULL,            -- denormalized snapshot at attach time
    addendum_jurisdiction TEXT NOT NULL,          -- denormalized snapshot
    addendum_citation   TEXT NOT NULL,            -- denormalized snapshot
    rendered_body       TEXT NOT NULL,            -- final rendered text snapshot (audit trail)
    attached_pdf_path   TEXT,                     -- snapshot of library row's attached_pdf_path
    signature_required  BOOLEAN NOT NULL DEFAULT true,
    initials_required   BOOLEAN NOT NULL DEFAULT false,
    attached_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Signature acknowledgment (filled in by sign-lease)
    acknowledged_by     TEXT,                     -- typed name OR 'tenant'/'co_applicant' role marker
    acknowledged_role   TEXT
      CHECK (acknowledged_role IN ('tenant','co_applicant','management')),
    acknowledged_at     TIMESTAMPTZ,
    acknowledged_ip     TEXT,
    acknowledged_user_agent TEXT,
    signature_text      TEXT,                     -- typed name at moment of acknowledgment
    initials_text       TEXT,                     -- typed initials if initials_required
    CONSTRAINT lease_addenda_attached_app_slug_unique
      UNIQUE (app_id, addendum_slug)
  );

  COMMENT ON TABLE  public.lease_addenda_attached IS
    'Phase 04: per-application record of which addenda were attached to a generated lease, with denormalized snapshots and per-addendum acknowledgment.';
  COMMENT ON COLUMN public.lease_addenda_attached.rendered_body IS
    'Snapshot of the addendum body AFTER template rendering at attach time. Frozen for audit.';

  CREATE INDEX IF NOT EXISTS lease_addenda_attached_app_id_idx
    ON public.lease_addenda_attached (app_id);
  CREATE INDEX IF NOT EXISTS lease_addenda_attached_application_pk_idx
    ON public.lease_addenda_attached (application_pk) WHERE application_pk IS NOT NULL;
  CREATE INDEX IF NOT EXISTS lease_addenda_attached_slug_idx
    ON public.lease_addenda_attached (addendum_slug);

  -- RLS: admins full; tenants can read their own (matched by app_id +
  -- the same email as the application). The simpler approach used
  -- elsewhere in this codebase: service-role-only writes (sign-lease &
  -- generate-lease), authenticated admin reads, anon select gated by
  -- the per-token flow in edge functions (no anon policy needed here).
  ALTER TABLE public.lease_addenda_attached ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "addenda_attached_admin_all"  ON public.lease_addenda_attached;
  DROP POLICY IF EXISTS "addenda_attached_admin_read" ON public.lease_addenda_attached;

  CREATE POLICY "addenda_attached_admin_all"
    ON public.lease_addenda_attached FOR ALL TO authenticated
    USING      (EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()));

  -- (Service role bypasses RLS; the edge functions use SUPABASE_SERVICE_ROLE_KEY.)

  -- =========================================================================
  -- 3. properties.year_built — additive, nullable
  --    Phase 04 brief §4 says: assume year_built exists or add it as a
  --    nullable column with a comment that this phase doesn't populate it.
  -- =========================================================================
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='properties')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='properties'
               AND column_name='year_built') THEN
      EXECUTE 'ALTER TABLE public.properties ADD COLUMN year_built INTEGER';
      EXECUTE $c$COMMENT ON COLUMN public.properties.year_built IS
        'Phase 04: year property was built. Drives federal lead-paint disclosure (required if <1978). Phase 04 does NOT backfill — admins populate as known.'$c$;
    END IF;
  END $$;

  -- =========================================================================
  -- Migration history
  -- =========================================================================
  INSERT INTO public._migration_history (filename, applied_at)
  VALUES ('20260430000001_phase04_addenda_library.sql', now())
  ON CONFLICT (filename) DO NOTHING;

  COMMIT;
  