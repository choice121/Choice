-- ─────────────────────────────────────────────────────────────────────
  -- Phase 03 — State-aware lease templates (schema only; no seeds yet)
  --
  -- Adds per-state targeting + legal-review provenance to lease_templates
  -- and lease_template_versions, backfills existing rows as Michigan
  -- statute-derived (the only state we previously supported), then
  -- enforces NOT NULL and a per-state unique-active index.
  --
  -- Source-of-truth brief:
  --   lease-phases/PHASE_03_multi_state_templates.md  §6 "Schema additions"
  --
  -- Idempotent: safe to re-run. Uses IF NOT EXISTS / DO blocks so a
  -- partial prior application can be picked up cleanly.
  -- ─────────────────────────────────────────────────────────────────────

  BEGIN;

  -- 1. Columns on lease_templates ─────────────────────────────────────
  ALTER TABLE public.lease_templates
    ADD COLUMN IF NOT EXISTS state_code           CHAR(2),
    ADD COLUMN IF NOT EXISTS legal_review_status  TEXT NOT NULL DEFAULT 'statute_derived',
    ADD COLUMN IF NOT EXISTS attorney_reviewer    TEXT,
    ADD COLUMN IF NOT EXISTS attorney_review_date DATE,
    ADD COLUMN IF NOT EXISTS attorney_bar_number  TEXT;

  -- 2. Columns on lease_template_versions ─────────────────────────────
  ALTER TABLE public.lease_template_versions
    ADD COLUMN IF NOT EXISTS state_code           CHAR(2),
    ADD COLUMN IF NOT EXISTS legal_review_status  TEXT NOT NULL DEFAULT 'statute_derived',
    ADD COLUMN IF NOT EXISTS attorney_reviewer    TEXT,
    ADD COLUMN IF NOT EXISTS attorney_review_date DATE;

  -- 3. Backfill: every existing row predates this phase and was the
  --    Michigan-only template. Statute-derived because that's how it
  --    was authored (no attorney sign-off recorded).
  UPDATE public.lease_templates
     SET state_code = 'MI'
   WHERE state_code IS NULL;

  UPDATE public.lease_template_versions
     SET state_code = 'MI'
   WHERE state_code IS NULL;

  -- 4. CHECK constraint: legal_review_status must be one of the three
  --    documented values. Use NOT VALID + VALIDATE so the constraint
  --    is added even if surprising rows exist; we then validate.
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'lease_templates_legal_review_status_chk'
         AND conrelid = 'public.lease_templates'::regclass
    ) THEN
      ALTER TABLE public.lease_templates
        ADD CONSTRAINT lease_templates_legal_review_status_chk
        CHECK (legal_review_status IN ('statute_derived','attorney_reviewed','outdated'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'lease_template_versions_legal_review_status_chk'
         AND conrelid = 'public.lease_template_versions'::regclass
    ) THEN
      ALTER TABLE public.lease_template_versions
        ADD CONSTRAINT lease_template_versions_legal_review_status_chk
        CHECK (legal_review_status IN ('statute_derived','attorney_reviewed','outdated'));
    END IF;
  END$$;

  -- 5. CHECK constraint: state_code must be a real US state/DC code.
  --    Reuse the same set as state_lease_law via FK.
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'lease_templates_state_code_fk'
         AND conrelid = 'public.lease_templates'::regclass
    ) THEN
      ALTER TABLE public.lease_templates
        ADD CONSTRAINT lease_templates_state_code_fk
        FOREIGN KEY (state_code) REFERENCES public.state_lease_law(state_code)
        ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'lease_template_versions_state_code_fk'
         AND conrelid = 'public.lease_template_versions'::regclass
    ) THEN
      ALTER TABLE public.lease_template_versions
        ADD CONSTRAINT lease_template_versions_state_code_fk
        FOREIGN KEY (state_code) REFERENCES public.state_lease_law(state_code)
        ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
  END$$;

  -- 6. Now enforce NOT NULL on state_code (after backfill). Versions
  --    table may have legacy rows where state_code stays NULL only if
  --    the parent template is also NULL — backfill above covers all.
  ALTER TABLE public.lease_templates         ALTER COLUMN state_code SET NOT NULL;
  ALTER TABLE public.lease_template_versions ALTER COLUMN state_code SET NOT NULL;

  -- 7. Per-state unique active template index. Multiple non-active
  --    templates per state are fine; only one active at a time.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_lease_templates_active_per_state
    ON public.lease_templates (state_code)
    WHERE is_active = true;

  -- 8. Helpful lookup index for the version selector in admin/render.
  CREATE INDEX IF NOT EXISTS idx_lease_template_versions_state_code
    ON public.lease_template_versions (state_code);

  COMMIT;
  