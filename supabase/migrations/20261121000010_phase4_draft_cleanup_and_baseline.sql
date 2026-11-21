-- ============================================================================
-- Phase 4 Patch: Allow draft policy_sets cleanup & restore clean v1 baseline
-- ============================================================================
-- Allows DELETE on public.policy_rules ONLY when its parent policy_sets row
-- has status = 'draft', while preserving strict immutability on active and
-- archived policy sets. Also cleans up the Phase 4 live-test v2 row and
-- restores v1 as active.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_immutable_policy_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_immutable THEN
      SELECT status INTO v_parent_status
      FROM public.policy_sets
      WHERE id = OLD.policy_set_id;

      IF v_parent_status IS DISTINCT FROM 'draft' THEN
        RAISE EXCEPTION 'immutable_rule_protected: rule % cannot be deleted from % policy set', OLD.rule_key, COALESCE(v_parent_status, 'unknown')
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_immutable AND (
      NEW.value_json IS DISTINCT FROM OLD.value_json
      OR NEW.is_enabled IS DISTINCT FROM OLD.is_enabled
      OR NEW.is_immutable IS DISTINCT FROM OLD.is_immutable
      OR NEW.rule_key IS DISTINCT FROM OLD.rule_key
    ) THEN
      RAISE EXCEPTION 'immutable_rule_protected: rule % cannot be modified', OLD.rule_key
        USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Restore clean v1 baseline after Phase 4 live verification test
DO $$
DECLARE
  v_test_v2_id UUID;
BEGIN
  SELECT id INTO v_test_v2_id
  FROM public.policy_sets
  WHERE version_number = 2
    AND notes = 'Phase 4 live verification test'
  LIMIT 1;

  IF v_test_v2_id IS NOT NULL THEN
    UPDATE public.policy_sets SET status = 'draft' WHERE id = v_test_v2_id;
    UPDATE public.policy_sets SET status = 'active' WHERE version_number = 1;
    DELETE FROM public.policy_change_log WHERE policy_set_id = v_test_v2_id;
    DELETE FROM public.policy_sets WHERE id = v_test_v2_id;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
