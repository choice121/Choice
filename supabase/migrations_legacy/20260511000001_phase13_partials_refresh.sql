-- ─────────────────────────────────────────────────────────────────────
-- Phase 13 follow-up — Roll the Phase 07 itemized-financial and
-- utility-matrix partials into the 41 remaining-state templates.
--
-- Why this exists
-- ───────────────
-- Phase 07 (20260504000001_phase07_template_seed_refresh.sql) refactored
-- Section 6 ("MOVE-IN COSTS") and Section 7 ("UTILITIES AND SERVICES")
-- of the top-10 state templates to consume two new shared partials:
--
--     {% include "common/move_in_breakdown" %}
--     {% include "common/utility_matrix"    %}
--
-- That migration's WHERE clause is hard-coded to:
--     state_code IN ('CA','TX','FL','NY','IL','OH','GA','NC','PA','MI')
--
-- So the 41 Phase 13 templates seeded by 20260509_phase13_remaining_
-- states_templates.sql still ship the legacy plain-text wording in
-- both sections. Tenants in CA get a clean itemised breakdown table
-- and per-utility responsibility matrix; tenants in AK/AL/AZ/CO/etc.
-- get a single-line lump sum and a generic utilities sentence.
--
-- This migration brings the remaining 41 templates up to parity with
-- the top-10. Same partial includes, same fallback semantics (the
-- partials emit the legacy wording when no itemised fields are
-- populated, so existing applications without itemised data still
-- render correctly).
--
-- Idempotency
-- ───────────
--   1. The two regexp_replace patterns target byte-identical legacy
--      wording present in every Phase 13 row today (verified by
--      sort -u over Section 6/7 bodies before authoring).
--   2. The replacement payloads contain '{% include %}' directives
--      that the regex no longer matches, so a second run is a no-op
--      on the lease_templates UPDATE.
--   3. The lease_template_versions snapshot insert is guarded by a
--      sentinel string in the `notes` column ('phase13-partials-refresh
--      snapshot') so re-runs do not produce duplicate version rows.
--
-- Locale filter
-- ─────────────
-- Restricted to locale = 'en' so the Spanish rows seeded by
-- 20260510_phase12_13_locale_spanish_all_states.sql are untouched.
-- (They already include the partials in their own bodies, but more
-- importantly they contain Spanish prose that the English regex
-- patterns wouldn't match anyway. Belt and braces.)
--
-- Brief: same as PHASE_07_itemized_financials.md §6 acceptance #3,
--        applied to the remaining 41 jurisdictions.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Refresh the 41 Phase 13 active state templates to use the two
--    shared partials in Sections 6 and 7.
--
--   Pass A — Section 6 inline plain-text → move_in_breakdown partial
--   Pass B — Section 7 utility prose (two variants) → utility_matrix
--            partial
--
-- POSIX ERE notes:
--   • {{ }} pairs are escaped (\{\{ ... \}\}) so they aren't read as
--     quantifier delimiters.
--   • The literal '.' at end of Section 6 wording is escaped.
--   • Section 7 has two known variants in Phase 13 (verified):
--       (a) "Tenant is responsible for all utilities including
--            electricity, heating fuel, water, sewer, internet, and
--            trash collection, unless otherwise agreed in writing."
--           — Alaska only
--       (b) "Tenant is responsible for all utilities unless otherwise
--            agreed in writing."
--           — every other Phase 13 state
--     Both are matched in a single alternation group.
-- ─────────────────────────────────────────────────────────────────────

UPDATE public.lease_templates
   SET template_body =
         regexp_replace(
           regexp_replace(
             template_body,
             -- Pass A: Section 6 legacy plain-text line
             E'Total move-in costs due prior to possession: \\{\\{move_in_costs\\}\\}\\.',
             '{% include "common/move_in_breakdown" %}',
             'g'
           ),
           -- Pass B: Section 7 — both known Phase 13 variants
           E'Tenant is responsible for all utilities (including electricity, heating fuel, water, sewer, internet, and trash collection, )?unless otherwise agreed in writing\\.',
           '{% include "common/utility_matrix" %}',
           'g'
         ),
       updated_at = NOW()
 WHERE state_code IN (
   'AK','AL','AR','AZ','CO','CT','DC','DE','HI','IA','ID','IN',
   'KS','KY','LA','MA','MD','ME','MN','MO','MS','MT','ND','NE',
   'NH','NJ','NM','NV','OK','OR','RI','SC','SD','TN','UT','VA',
   'VT','WA','WI','WV','WY'
 )
   AND is_active = true
   AND locale = 'en';

-- ─────────────────────────────────────────────────────────────────────
-- 2. Snapshot the refreshed bodies as a fresh row in
--    lease_template_versions so any application already pinned to a
--    pre-refresh snapshot keeps rendering its original text, while
--    newly generated leases pick up the partials-driven body.
--
--   • version_number = MAX(existing) + 1 per template
--   • Sentinel in notes makes re-runs idempotent
--   • Filter on the rewrite landing in BOTH partial includes prevents
--     accidentally snapshotting a half-rewritten body if the regex
--     ever fails to match (defence in depth — should never happen
--     given the verified Phase 13 wording).
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
  attorney_review_date,
  locale
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
  'phase13-partials-refresh snapshot'           AS notes,
  'system:phase13-refresh'                      AS published_by,
  t.state_code                                  AS state_code,
  t.legal_review_status                         AS legal_review_status,
  t.attorney_reviewer                           AS attorney_reviewer,
  t.attorney_review_date                        AS attorney_review_date,
  t.locale                                      AS locale
  FROM public.lease_templates t
 WHERE t.state_code IN (
   'AK','AL','AR','AZ','CO','CT','DC','DE','HI','IA','ID','IN',
   'KS','KY','LA','MA','MD','ME','MN','MO','MS','MT','ND','NE',
   'NH','NJ','NM','NV','OK','OR','RI','SC','SD','TN','UT','VA',
   'VT','WA','WI','WV','WY'
 )
   AND t.is_active = true
   AND t.locale    = 'en'
   AND position('common/move_in_breakdown' in t.template_body) > 0
   AND position('common/utility_matrix'    in t.template_body) > 0
   AND NOT EXISTS (
     SELECT 1
       FROM public.lease_template_versions v
      WHERE v.template_id = t.id
        AND v.notes = 'phase13-partials-refresh snapshot'
   );

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- Post-migration expectations (verify after apply):
--
--   -- All 41 active English templates now contain BOTH partials:
--   SELECT COUNT(*) FROM public.lease_templates
--    WHERE state_code IN ('AK','AL','AR','AZ','CO','CT','DC','DE','HI',
--                         'IA','ID','IN','KS','KY','LA','MA','MD','ME',
--                         'MN','MO','MS','MT','ND','NE','NH','NJ','NM',
--                         'NV','OK','OR','RI','SC','SD','TN','UT','VA',
--                         'VT','WA','WI','WV','WY')
--      AND is_active = true
--      AND locale    = 'en'
--      AND template_body LIKE '%common/move_in_breakdown%'
--      AND template_body LIKE '%common/utility_matrix%';
--   -- Expected: 41
--
--   -- Snapshot rows created (one per state):
--   SELECT COUNT(*) FROM public.lease_template_versions
--    WHERE notes = 'phase13-partials-refresh snapshot';
--   -- Expected: 41
--
--   -- No legacy plain-text Section 6 line remains in any active English
--   -- Phase 13 template:
--   SELECT state_code FROM public.lease_templates
--    WHERE is_active = true AND locale = 'en'
--      AND state_code <> ALL (ARRAY['CA','TX','FL','NY','IL','OH','GA','NC','PA','MI'])
--      AND template_body LIKE '%Total move-in costs due prior to possession:%';
--   -- Expected: 0 rows
-- ─────────────────────────────────────────────────────────────────────
