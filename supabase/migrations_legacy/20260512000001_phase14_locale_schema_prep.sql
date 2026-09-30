-- ─────────────────────────────────────────────────────────────────────
-- Phase 14 — Locale schema prep (no behavior change)
--
-- Why this exists
-- ───────────────
-- Phase 12 (20260510_phase12_13_locale_spanish_all_states.sql) shipped
-- Spanish lease template bodies for all 51 jurisdictions but left them
-- inactive (`is_active = false`). It also added a `locale` column to
-- `lease_templates` and `lease_template_versions`. However:
--
--   1. `lease_template_partials.slug` is the bare primary key — there
--      is no locale column at all. Every Spanish template body
--      references the same partial slugs (`common/move_in_breakdown`,
--      `common/utility_matrix`, `common/disclaimer`) as the English
--      bodies, so the resolver returns the English partial text. If
--      those Spanish rows were activated today, every Spanish lease
--      would render with English chunks inside.
--
--   2. The unique-active-per-state index
--        idx_lease_templates_active_per_state
--        ON public.lease_templates (state_code) WHERE is_active = true
--      blocks any attempt to mark a Spanish row active alongside its
--      English sibling for the same state.
--
-- This migration prepares the schema for a future activation cycle by
-- (a) widening the partials primary key to (slug, locale) and (b)
-- widening the templates unique-active index to (state_code, locale).
-- It is intentionally a SCHEMA-ONLY change — no application code in
-- this commit reads or writes the new locale column on partials, no
-- new partial rows are seeded, and no Spanish row is activated.
-- The current English-only resolver continues to work because every
-- existing partial row backfills to locale = 'en' via the column
-- default and `slug` is still unique within locale = 'en'.
--
-- This unblocks (without shipping) the future Phase 14 work:
--   • seeding `('common/disclaimer', 'es', ...)` etc.
--   • teaching `createSupabasePartialResolver` and `resolveLeaseTemplate`
--     to accept a locale parameter
--   • activating Spanish rows for selected pilot states
--
-- Idempotency
-- ───────────
-- Every statement is guarded with IF EXISTS / IF NOT EXISTS / a
-- catalog check, so the migration may be run more than once safely.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Add the `locale` column to lease_template_partials.
--
-- All existing rows (5 partials seeded by Phases 01, 07 and 09) are
-- backfilled to 'en' via the column default. This is a pure additive
-- column add and cannot break any existing reader: the current
-- resolver does .select('body').eq('slug', slug) without selecting or
-- filtering on locale, so the extra column is invisible to it.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.lease_template_partials
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';

-- Sanity-check constraint mirroring lease_templates' implicit usage:
-- locale must be a non-empty short code. Today we only ship 'en' and
-- 'es', but we accept anything 2-8 chars to leave room for 'es-MX',
-- 'pt-BR', etc. once the activation work happens.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'lease_template_partials_locale_chk'
  ) THEN
    ALTER TABLE public.lease_template_partials
      ADD CONSTRAINT lease_template_partials_locale_chk
      CHECK (char_length(locale) BETWEEN 2 AND 8);
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Widen the primary key from (slug) to (slug, locale).
--
-- This is the change that allows a Spanish row to coexist with the
-- English row at the same slug. No FK references this table (verified
-- via pg_constraint scan), so dropping and re-adding the PK is safe.
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  pk_name TEXT;
BEGIN
  SELECT conname INTO pk_name
    FROM pg_constraint
   WHERE conrelid = 'public.lease_template_partials'::regclass
     AND contype  = 'p'
   LIMIT 1;

  IF pk_name IS NOT NULL THEN
    -- If the existing PK is already on (slug, locale), leave it alone.
    IF EXISTS (
      SELECT 1
        FROM pg_constraint c
        JOIN pg_attribute  a ON a.attrelid = c.conrelid
                            AND a.attnum   = ANY (c.conkey)
       WHERE c.conname = pk_name
         AND a.attname IN ('locale')
    ) THEN
      -- Already widened by a prior run; no-op.
      NULL;
    ELSE
      EXECUTE format('ALTER TABLE public.lease_template_partials DROP CONSTRAINT %I', pk_name);
      ALTER TABLE public.lease_template_partials
        ADD CONSTRAINT lease_template_partials_pkey PRIMARY KEY (slug, locale);
    END IF;
  ELSE
    -- No PK present at all (unusual but defensive)
    ALTER TABLE public.lease_template_partials
      ADD CONSTRAINT lease_template_partials_pkey PRIMARY KEY (slug, locale);
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Widen the templates unique-active index from (state_code) to
--    (state_code, locale).
--
-- Today every active row has locale = 'en', so this is a behavior-
-- preserving swap: the old constraint allowed at most one active row
-- per state; the new one allows at most one active row per (state,
-- locale) pair, which is identical until a Spanish row is activated.
--
-- Idempotent: drops the old name only if present, creates the new one
-- only if absent. Both names live in the same namespace but the new
-- name is distinct so a partial run is recoverable.
-- ─────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_lease_templates_active_per_state;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lease_templates_active_per_state_locale
  ON public.lease_templates (state_code, locale)
  WHERE is_active = true;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- Post-migration expectations:
--
--   -- Partials table now has a locale column, all existing rows = 'en':
--   SELECT locale, COUNT(*) FROM public.lease_template_partials
--    GROUP BY locale;
--   -- Expected: en | <count of pre-existing partial rows>
--
--   -- New composite primary key in place:
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.lease_template_partials'::regclass
--      AND contype  = 'p';
--   -- Expected: lease_template_partials_pkey  PRIMARY KEY (slug, locale)
--
--   -- Old templates index is gone, new one is in:
--   SELECT indexname FROM pg_indexes
--    WHERE schemaname = 'public'
--      AND tablename  = 'lease_templates'
--      AND indexname LIKE 'idx_lease_templates_active_per_state%';
--   -- Expected: idx_lease_templates_active_per_state_locale  (only)
--
--   -- Active English row count per state is unchanged:
--   SELECT COUNT(*) FROM public.lease_templates WHERE is_active = true;
--   -- Expected: 51  (50 states + DC, still all locale = 'en')
--
-- Behavior verification:
--   • createSupabasePartialResolver still resolves all partials (only
--     'en' rows exist; the .eq('slug', …) lookup returns the same
--     single row).
--   • resolveLeaseTemplate still returns the English active row
--     (no change to its query).
--   • No edge function was modified by this migration.
-- ─────────────────────────────────────────────────────────────────────
