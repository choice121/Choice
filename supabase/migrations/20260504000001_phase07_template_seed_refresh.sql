-- ─────────────────────────────────────────────────────────────────────
-- Phase 07 (chunk 3/3) — Lease template seed refresh
--
-- Refactors the Phase 03 state templates to consume the Phase 07
-- itemized financial breakdown + utility responsibility matrix via
-- two new shared partials (common/move_in_breakdown, common/utility_matrix)
-- instead of the inline HTML that an interim chunk 2/3 attempt left
-- mashed into Section 6.
--
-- Why this exists:
--   • lease-context.ts (chunk 1/3) exposed move_in_breakdown_html and
--     utility_table_html so templates could opt into the new sections.
--   • A previous chunk 2/3 attempt jammed both pieces of HTML into
--     Section 6 ("MOVE-IN COSTS"), leaving Section 7 ("UTILITIES AND
--     SERVICES") with contradictory legacy plain-text wording (e.g. one
--     section showed a per-utility responsibility matrix, the next
--     section claimed "Tenant is responsible for all utilities").
--   • This chunk 3/3 puts each rendered table back in its proper section
--     and routes both through partials so future updates need only edit
--     the partial body, not 10 template bodies.
--
-- Idempotent strategy:
--   1. Two new partials are upserted ON CONFLICT.
--   2. Each template body is rewritten with two anchored regexp_replace
--      passes that target the byte-identical wording present in every
--      one of the 10 active state templates today (verified before
--      authoring this migration). The replacement payload is the
--      partial include directive, which the regex no longer matches —
--      so a re-run is a no-op.
--   3. A snapshot row is inserted into lease_template_versions for each
--      template that ends up containing both new partial includes,
--      keyed by a sentinel in the notes column to make re-inserts safe.
--
-- Brief: lease-phases/PHASE_07_itemized_financials.md §6 acceptance #3
--        ("Generated lease PDF renders financial breakdown table and
--        utility responsibility table.")
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Seed the two new partials.
--
-- Both partials wrap the rendered HTML output prepared by
-- buildLeaseRenderContext() in supabase/functions/_shared/lease-context.ts:
--
--   move_in_breakdown_html  → itemized table; empty string when no
--                             itemized field is populated and no legacy
--                             move_in_costs lump sum is set.
--   utility_table_html      → 13-row utility responsibility matrix;
--                             empty string when utility_responsibilities
--                             is null/empty.
--   proration_explanation   → single sentence summarising how the
--                             prorated first month was computed; only
--                             populated when partial-month proration
--                             actually applies.
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO public.lease_template_partials (slug, body, description, created_by) VALUES
(
  'common/move_in_breakdown',
  $body${% if move_in_breakdown_html %}The following amounts are due prior to taking possession of the Premises:

{{ move_in_breakdown_html }}
{% if proration_explanation %}
First-month proration: {{ proration_explanation }}
{% endif %}
{% else %}Total move-in costs due prior to possession: {{ move_in_costs }}.{% endif %}$body$,
  'Phase 07 — Itemized move-in cost breakdown table with legacy single-line fallback. Consumes move_in_breakdown_html and proration_explanation from lease-context.ts.',
  'system:phase07'
),
(
  'common/utility_matrix',
  $body${% if utility_table_html %}The following utilities and services are designated as the responsibility of either Tenant ("T"), Landlord ("L"), shared ("S"), or not applicable ("N/A") as set forth below. Where a utility is shared, the parties shall agree in writing on the apportionment method.

{{ utility_table_html }}
{% else %}Tenant is responsible for all utilities including electricity, gas, water, sewer, internet, and trash collection, unless otherwise agreed in writing as part of this Agreement.{% endif %}$body$,
  'Phase 07 — Per-utility responsibility matrix table with legacy plain-text fallback. Consumes utility_table_html from lease-context.ts.',
  'system:phase07'
)
ON CONFLICT (slug) DO UPDATE
   SET body        = EXCLUDED.body,
       description = EXCLUDED.description,
       updated_at  = now();

-- ─────────────────────────────────────────────────────────────────────
-- 2. Refresh all 10 active state templates to use the new partials.
--
-- Two regexp_replace passes target byte-identical wording present in
-- every one of the 10 active state templates today:
--
--   Pass A — collapse the inline HTML block currently sitting inside
--            Section 6 (interim chunk 2/3 artifact) down to a single
--            partial include for the financial breakdown only.
--            The inline block contains the utility responsibility
--            wording too; that is intentionally dropped here because
--            Section 7 will own it after Pass B.
--
--   Pass B — replace the legacy single-line utility text inside
--            Section 7 with the utility matrix partial include.
--
-- The bare {{...}} braces in the regex pattern are escaped so they're
-- treated as literals (POSIX ERE treats unescaped {} as quantifier
-- delimiters). The replacement strings contain no \\ or & so no
-- backreference escaping is needed.
-- ─────────────────────────────────────────────────────────────────────

UPDATE public.lease_templates
   SET template_body =
         regexp_replace(
           regexp_replace(
             template_body,
             -- Pass A: inline HTML block from interim chunk 2/3
             E'<h3>Itemized Move-In Breakdown</h3>\\{\\{move_in_breakdown_html\\}\\}<p>\\{\\{proration_explanation\\}\\}</p><h3>Utility Responsibilities</h3><p>The following table allocates responsibility for each utility and recurring service\\. Where a utility is marked "Tenant", Tenant shall establish service in Tenant''s name on or before the lease commencement date and maintain it for the duration of the Term\\. Where marked "Landlord", Landlord shall pay for and maintain such service\\. Where marked "Shared", the parties shall apportion costs as set forth in the Notes column\\.</p>\\{\\{utility_table_html\\}\\}',
             '{% include "common/move_in_breakdown" %}',
             'g'
           ),
           -- Pass B: legacy plain-text utility line in Section 7
           E'Tenant is responsible for all utilities including electricity, gas, water, sewer, internet, and trash collection, unless otherwise agreed in writing as part of this Agreement\\.',
           '{% include "common/utility_matrix" %}',
           'g'
         ),
       updated_at = NOW()
 WHERE state_code IN ('CA','TX','FL','NY','IL','OH','GA','NC','PA','MI')
   AND is_active = true;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Snapshot the new bodies as a fresh row in lease_template_versions
--    so already-issued leases remain pinned to their pre-Phase-07
--    snapshot, while newly generated leases pick up the refreshed body.
--
-- version_number is computed as MAX(existing) + 1 per template. The
-- NOT EXISTS guard keyed on the Phase 07 sentinel in `notes` makes
-- this insert idempotent — a re-run after the snapshot has been taken
-- does nothing.
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO public.lease_template_versions (
  template_id,
  version_number,
  name,
  template_body,
  variables,
  notes,
  published_by,
  state_code,
  legal_review_status,
  attorney_reviewer,
  attorney_review_date
)
SELECT
  t.id,
  COALESCE(
    (SELECT MAX(v.version_number)
       FROM public.lease_template_versions v
      WHERE v.template_id = t.id),
    0
  ) + 1                                         AS version_number,
  t.name                                        AS name,
  t.template_body                               AS template_body,
  COALESCE(t.variables, '{}'::jsonb)            AS variables,
  'phase07-itemized-financials snapshot'        AS notes,
  'system:phase07'                              AS published_by,
  t.state_code                                  AS state_code,
  t.legal_review_status                         AS legal_review_status,
  t.attorney_reviewer                           AS attorney_reviewer,
  t.attorney_review_date                        AS attorney_review_date
  FROM public.lease_templates t
 WHERE t.state_code IN ('CA','TX','FL','NY','IL','OH','GA','NC','PA','MI')
   AND t.is_active = true
   AND position('common/move_in_breakdown' in t.template_body) > 0
   AND position('common/utility_matrix'    in t.template_body) > 0
   AND NOT EXISTS (
     SELECT 1
       FROM public.lease_template_versions v
      WHERE v.template_id = t.id
        AND v.notes = 'phase07-itemized-financials snapshot'
   );

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- Post-migration expectations (verified by the agent after apply):
--   • lease_template_partials: 3 rows
--       (common/disclaimer, common/move_in_breakdown, common/utility_matrix)
--   • lease_templates: all 10 active rows contain BOTH includes
--   • lease_template_versions rows tagged 'phase07-itemized-financials
--     snapshot': 10 (one per state)
-- ─────────────────────────────────────────────────────────────────────
