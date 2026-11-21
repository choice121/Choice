-- ============================================================================
-- Phase 4: Centralized Rules & Policies Engine + Versioned Policy Admin
-- ============================================================================
-- 1. Creates versioned policy governance tables in public schema:
--      - public.policy_sets
--      - public.policy_rules
--      - public.policy_change_log
--      - public.prohibited_source_profiles
--      - public.scraping_providers
-- 2. Seeds active v1 policy set with all permanent Choice immutable rules
--    and configurable defaults, plus the 6 prohibited source profiles and
--    5 scraping providers (Apify automated default + Chrome/Orion extensions).
-- 3. Extends public.publishing_batches with policy_set_id (backfills existing
--    batches to v1 and auto-pins active policy_set_id on new inserts).
-- 4. Installs DB-level immutability guards preventing modification/deletion of
--    immutable rules & prohibited profiles, plus single-signature RPCs for
--    versioned rule updates, pinning, and dry-run/active policy inspection.
-- ============================================================================

-- ── 1. Versioned Policy Sets ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.policy_sets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number INTEGER NOT NULL UNIQUE,
  version_label  TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  notes          TEXT,
  created_by     TEXT,
  activated_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_sets_single_active
  ON public.policy_sets ((status))
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_policy_sets_status_ver
  ON public.policy_sets (status, version_number DESC);

-- ── 2. Policy Rules ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.policy_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_set_id UUID NOT NULL REFERENCES public.policy_sets(id) ON DELETE CASCADE,
  rule_key      TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('scraping', 'eligibility', 'enrichment', 'pricing', 'publishing', 'cleanup')),
  value_json    JSONB NOT NULL,
  is_immutable  BOOLEAN NOT NULL DEFAULT false,
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (policy_set_id, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_policy_rules_set_cat
  ON public.policy_rules (policy_set_id, category);

-- ── 3. Policy Change Log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.policy_change_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_set_id UUID NOT NULL REFERENCES public.policy_sets(id) ON DELETE CASCADE,
  rule_key      TEXT NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  changed_by    TEXT,
  reason        TEXT,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_change_log_set_time
  ON public.policy_change_log (policy_set_id, changed_at DESC);

-- ── 4. Prohibited Source Profiles ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prohibited_source_profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL UNIQUE,
  aliases        TEXT[] NOT NULL DEFAULT '{}'::text[],
  match_mode     TEXT NOT NULL DEFAULT 'token_phrase' CHECK (match_mode IN ('normalized_exact', 'token_phrase')),
  is_immutable   BOOLEAN NOT NULL DEFAULT false,
  enabled        BOOLEAN NOT NULL DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. Scraping Providers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scraping_providers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('automated', 'manual')),
  is_default   BOOLEAN NOT NULL DEFAULT false,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  config_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scraping_providers_single_default_automated
  ON public.scraping_providers ((is_default))
  WHERE channel_type = 'automated' AND is_default = true;

-- ── 6. Seed Initial v1 Policy Set, Rules, Profiles & Providers ──────────────
INSERT INTO public.policy_sets (version_number, version_label, status, notes, created_by, activated_at)
VALUES (
  1,
  'v1',
  'active',
  'Baseline Choice Properties permanent operating rules and configurable batch defaults.',
  'system:seed',
  now()
)
ON CONFLICT (version_number) DO NOTHING;

DO $$
DECLARE
  v_v1_id UUID;
BEGIN
  SELECT id INTO v_v1_id FROM public.policy_sets WHERE version_number = 1 LIMIT 1;
  IF v_v1_id IS NULL THEN
    RAISE EXCEPTION 'Failed to resolve v1 policy_sets row';
  END IF;

  INSERT INTO public.policy_rules (policy_set_id, rule_key, category, value_json, is_immutable, is_enabled, description)
  VALUES
    -- Immutable system rules
    (v_v1_id, 'application_fee',                 'publishing',  '50'::jsonb,                  true, true, 'Exact application fee in USD ($50). Never $0, free, or waived.'),
    (v_v1_id, 'security_deposit_multiplier',     'publishing',  '1'::jsonb,                   true, true, 'Security deposit equals 1x monthly rent in DB; stripped from descriptions.'),
    (v_v1_id, 'require_authentic_address',       'eligibility', 'true'::jsonb,                true, true, 'Authentic physical street address, city, state, ZIP, and rooftop coordinates only.'),
    (v_v1_id, 'min_usable_photos',               'eligibility', '4'::jsonb,                   true, true, 'Minimum number of usable, watermark-free, HTTP-reachable photos required.'),
    (v_v1_id, 'forbid_watermark_cropping',       'eligibility', 'true'::jsonb,                true, true, 'Never crop, blur, or obscure watermarked photos; hold/reject instead.'),
    (v_v1_id, 'forbid_stock_or_ai_photos',       'eligibility', 'true'::jsonb,                true, true, 'Never insert stock or AI-generated photos into property galleries.'),
    (v_v1_id, 'forbid_name_only_owner_proof',    'eligibility', 'true'::jsonb,                true, true, 'Never treat a person name alone as Property Owner / Landlord verification.'),
    (v_v1_id, 'preserve_original_description',   'enrichment',  'true'::jsonb,                true, true, 'Always preserve source original_description untouched alongside enriched copy.'),
    (v_v1_id, 'forbid_batch_id_reuse',           'scraping',    'true'::jsonb,                true, true, 'Four-digit Batch IDs are permanently unique and may never be reused.'),
    (v_v1_id, 'require_post_publish_verification','publishing', 'true'::jsonb,                true, true, 'Post-publish live link, media, and data parity verification is mandatory.'),
    -- Configurable rules
    (v_v1_id, 'description_mode',                'enrichment',  '"baseline_rewrite"'::jsonb,  false, true, 'Enrichment strategy: baseline_rewrite or sanitize_only.'),
    (v_v1_id, 'max_description_length_variance_pct','enrichment','25'::jsonb,                 false, true, 'Maximum allowed +/- length variance (%) vs original_description.'),
    (v_v1_id, 'show_pet_policy_on_client_page',  'publishing',  'false'::jsonb,               false, true, 'Whether pet policy details may render on client-facing detail pages.'),
    (v_v1_id, 'show_lease_summary_on_client_page','publishing', 'false'::jsonb,               false, true, 'Whether lease duration summary may render on client-facing detail pages.'),
    (v_v1_id, 'recovery_retention_hours',        'cleanup',     '24'::jsonb,                  false, true, 'Hours to retain deleted disposable batch payloads in 24h recovery archive.'),
    (v_v1_id, 'share_link_ttl_days',             'publishing',  '90'::jsonb,                  false, true, 'Default TTL in days for batch #share= private-placement links.'),
    (v_v1_id, 'default_scraping_provider',       'scraping',    '"apify"'::jsonb,             false, true, 'Default automated scraping provider key.')
  ON CONFLICT (policy_set_id, rule_key) DO NOTHING;

  INSERT INTO public.policy_change_log (policy_set_id, rule_key, old_value, new_value, changed_by, reason)
  SELECT v_v1_id, 'policy_set', 'null'::jsonb, jsonb_build_object('version_number', 1, 'version_label', 'v1', 'status', 'active'), 'system:seed', 'Initial Phase 4 v1 policy set seed'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.policy_change_log WHERE policy_set_id = v_v1_id AND rule_key = 'policy_set'
  );
END $$;

INSERT INTO public.prohibited_source_profiles (canonical_name, aliases, match_mode, is_immutable, enabled, notes)
VALUES
  ('Tricon Residential',     ARRAY['Tricon', 'Tricon American Homes', 'TAH'],                                     'token_phrase', true, true, 'Institutional SFR operator — permanently prohibited'),
  ('MYNE',                   ARRAY['MYNE Homes', 'Myne Living'],                                                  'token_phrase', true, true, 'Prohibited institutional source profile'),
  ('The Wayne',              ARRAY['Wayne Homes', 'The Wayne Residential'],                                       'token_phrase', true, true, 'Prohibited source profile'),
  ('Main Street Renewal',    ARRAY['MSR', 'Main St Renewal', 'Main Street Renewal LLC'],                          'token_phrase', true, true, 'Institutional SFR operator — permanently prohibited'),
  ('American Avenue',        ARRAY['American Avenue Homes', 'AAH'],                                               'token_phrase', true, true, 'Institutional SFR operator — permanently prohibited'),
  ('American Homes 4 Rent',  ARRAY['AMH', 'AMH Homes', 'American Homes for Rent'],                                'token_phrase', true, true, 'Institutional SFR operator — permanently prohibited')
ON CONFLICT (canonical_name) DO NOTHING;

INSERT INTO public.scraping_providers (provider_key, display_name, channel_type, is_default, enabled, config_json)
VALUES
  ('apify',                     'Apify Automated Zillow Scraper',                  'automated', true,  true,  '{"actor_id":"maxcopell/zillow-scraper","timeout_secs":120}'::jsonb),
  ('browser_extension_chrome',  'Choice Properties Chrome Extension (Desktop)',    'manual',    false, true,  '{"max_photos":50}'::jsonb),
  ('browser_extension_orion',   'Choice Properties Orion Extension (Mobile)',      'manual',    false, true,  '{"max_photos":25}'::jsonb),
  ('admin_url_import',          'Admin Single-URL Importer',                       'manual',    false, true,  '{"endpoint":"import-from-url"}'::jsonb),
  ('homeharvest',               'HomeHarvest (Disabled Fallback)',                 'automated', false, false, '{}'::jsonb)
ON CONFLICT (provider_key) DO NOTHING;

-- ── 7. Extend public.publishing_batches with policy_set_id ──────────────────
ALTER TABLE public.publishing_batches
  ADD COLUMN IF NOT EXISTS policy_set_id UUID REFERENCES public.policy_sets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_publishing_batches_policy_set
  ON public.publishing_batches (policy_set_id);

UPDATE public.publishing_batches
SET policy_set_id = (SELECT id FROM public.policy_sets WHERE version_number = 1 LIMIT 1)
WHERE policy_set_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_publishing_batch_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.batch_uuid := COALESCE(NEW.batch_uuid, gen_random_uuid());
  IF NEW.id ~ '^[0-9]{4}$' THEN
    NEW.batch_format := 'four_digit';
  ELSIF NEW.batch_format IS NULL OR NEW.batch_format = '' THEN
    NEW.batch_format := 'legacy_pb';
  END IF;
  IF NEW.policy_set_id IS NULL THEN
    SELECT id INTO NEW.policy_set_id
    FROM public.policy_sets
    WHERE status = 'active'
    ORDER BY version_number DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Update private_placement_registry view? Wait: append policy_set_id without changing existing columns order?
-- Note: Adding columns at the END of a view with CREATE OR REPLACE VIEW is allowed in PostgreSQL.
-- Keep existing view untouched to avoid altering column positions unexpectedly; policy_set_id is queried directly or via rules-engine.

-- ── 8. Immutability & Updated-At Triggers ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_immutable_policy_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_immutable THEN
      RAISE EXCEPTION 'immutable_rule_protected: rule % cannot be deleted', OLD.rule_key
        USING ERRCODE = '42501';
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

DROP TRIGGER IF EXISTS trg_guard_immutable_policy_rule ON public.policy_rules;
CREATE TRIGGER trg_guard_immutable_policy_rule
  BEFORE UPDATE OR DELETE ON public.policy_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_immutable_policy_rule();

CREATE OR REPLACE FUNCTION public.guard_immutable_prohibited_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_immutable THEN
      RAISE EXCEPTION 'immutable_profile_protected: profile % cannot be deleted', OLD.canonical_name
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_immutable AND (
      NEW.enabled IS DISTINCT FROM OLD.enabled AND NEW.enabled = false
      OR NEW.canonical_name IS DISTINCT FROM OLD.canonical_name
      OR NEW.is_immutable IS DISTINCT FROM OLD.is_immutable
    ) THEN
      RAISE EXCEPTION 'immutable_profile_protected: profile % cannot be disabled or renamed', OLD.canonical_name
        USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_immutable_prohibited_profile ON public.prohibited_source_profiles;
CREATE TRIGGER trg_guard_immutable_prohibited_profile
  BEFORE UPDATE OR DELETE ON public.prohibited_source_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_immutable_prohibited_profile();

-- ── 9. Policy Engine RPCs ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rules_get_effective_policy(p_batch_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id      TEXT := NULLIF(regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', ''), '');
  v_policy_set    public.policy_sets%ROWTYPE;
  v_pinned        BOOLEAN := false;
  v_rules_map     JSONB := '{}'::jsonb;
  v_rules_list    JSONB := '[]'::jsonb;
  v_profiles      JSONB := '[]'::jsonb;
  v_providers     JSONB := '[]'::jsonb;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_batch_id IS NOT NULL THEN
    SELECT ps.*
    INTO v_policy_set
    FROM public.publishing_batches pb
    JOIN public.policy_sets ps ON ps.id = pb.policy_set_id
    WHERE pb.id = v_batch_id
    LIMIT 1;

    IF FOUND THEN
      v_pinned := true;
    END IF;
  END IF;

  IF NOT FOUND OR v_policy_set.id IS NULL THEN
    SELECT ps.*
    INTO v_policy_set
    FROM public.policy_sets ps
    WHERE ps.status = 'active'
    ORDER BY ps.version_number DESC
    LIMIT 1;
  END IF;

  IF v_policy_set.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_active_policy_set');
  END IF;

  SELECT
    COALESCE(jsonb_object_agg(pr.rule_key, pr.value_json), '{}'::jsonb),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', pr.id,
        'rule_key', pr.rule_key,
        'category', pr.category,
        'value_json', pr.value_json,
        'is_immutable', pr.is_immutable,
        'is_enabled', pr.is_enabled,
        'description', pr.description
      )
      ORDER BY pr.category, pr.rule_key
    ), '[]'::jsonb)
  INTO v_rules_map, v_rules_list
  FROM public.policy_rules pr
  WHERE pr.policy_set_id = v_policy_set.id
    AND pr.is_enabled = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'canonical_name', p.canonical_name,
      'aliases', p.aliases,
      'match_mode', p.match_mode,
      'is_immutable', p.is_immutable,
      'enabled', p.enabled,
      'notes', p.notes
    )
    ORDER BY p.canonical_name
  ), '[]'::jsonb)
  INTO v_profiles
  FROM public.prohibited_source_profiles p
  WHERE p.enabled = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sp.id,
      'provider_key', sp.provider_key,
      'display_name', sp.display_name,
      'channel_type', sp.channel_type,
      'is_default', sp.is_default,
      'enabled', sp.enabled,
      'config_json', sp.config_json
    )
    ORDER BY sp.is_default DESC, sp.channel_type, sp.provider_key
  ), '[]'::jsonb)
  INTO v_providers
  FROM public.scraping_providers sp;

  RETURN jsonb_build_object(
    'ok', true,
    'pinned_to_batch', v_pinned,
    'batch_id', v_batch_id,
    'policy_set', jsonb_build_object(
      'id', v_policy_set.id,
      'version_number', v_policy_set.version_number,
      'version_label', v_policy_set.version_label,
      'status', v_policy_set.status,
      'notes', v_policy_set.notes,
      'activated_at', v_policy_set.activated_at,
      'created_at', v_policy_set.created_at
    ),
    'rules_map', v_rules_map,
    'rules', v_rules_list,
    'prohibited_source_profiles', v_profiles,
    'scraping_providers', v_providers
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rules_publish_configurable_update(
  p_updates    JSONB,
  p_changed_by TEXT DEFAULT 'admin',
  p_reason     TEXT DEFAULT 'Policy configuration update'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_set     public.policy_sets%ROWTYPE;
  v_new_set_id     UUID;
  v_next_ver       INTEGER;
  v_new_label      TEXT;
  v_key            TEXT;
  v_val            JSONB;
  v_rule           public.policy_rules%ROWTYPE;
  v_reason         TEXT := COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), 'Policy configuration update');
  v_actor          TEXT := COALESCE(NULLIF(trim(COALESCE(p_changed_by, '')), ''), 'admin');
  v_applied_keys   TEXT[] := '{}'::text[];
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' OR p_updates = '{}'::jsonb THEN
    RETURN jsonb_build_object('ok', false, 'error', 'updates_object_required');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('choice_policy_version_bump'));

  SELECT * INTO v_active_set
  FROM public.policy_sets
  WHERE status = 'active'
  ORDER BY version_number DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_active_policy_set');
  END IF;

  -- Pre-validate all keys BEFORE creating any new version
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_updates) LOOP
    SELECT * INTO v_rule
    FROM public.policy_rules
    WHERE policy_set_id = v_active_set.id
      AND rule_key = v_key
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'unknown_rule_key',
        'rule_key', v_key
      );
    END IF;

    IF v_rule.is_immutable THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'immutable_rule_protected',
        'rule_key', v_key,
        'message', 'Immutable Choice system rule "' || v_key || '" cannot be modified.'
      );
    END IF;
  END LOOP;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_ver FROM public.policy_sets;
  v_new_label := 'v' || v_next_ver::text;

  -- Archive current active set first (respects unique active index)
  UPDATE public.policy_sets
  SET status = 'archived'
  WHERE id = v_active_set.id;

  INSERT INTO public.policy_sets (version_number, version_label, status, notes, created_by, activated_at)
  VALUES (v_next_ver, v_new_label, 'active', v_reason, v_actor, now())
  RETURNING id INTO v_new_set_id;

  -- Clone all rules from prior active set into the new active version
  INSERT INTO public.policy_rules (policy_set_id, rule_key, category, value_json, is_immutable, is_enabled, description)
  SELECT v_new_set_id, rule_key, category, value_json, is_immutable, is_enabled, description
  FROM public.policy_rules
  WHERE policy_set_id = v_active_set.id;

  -- Apply configurable updates & write change log rows
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_updates) LOOP
    SELECT * INTO v_rule
    FROM public.policy_rules
    WHERE policy_set_id = v_new_set_id
      AND rule_key = v_key
    LIMIT 1;

    UPDATE public.policy_rules
    SET value_json = v_val,
        updated_at = now()
    WHERE id = v_rule.id;

    INSERT INTO public.policy_change_log (policy_set_id, rule_key, old_value, new_value, changed_by, reason)
    VALUES (v_new_set_id, v_key, v_rule.value_json, v_val, v_actor, v_reason);

    v_applied_keys := array_append(v_applied_keys, v_key);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'previous_policy_set_id', v_active_set.id,
    'previous_version', v_active_set.version_number,
    'policy_set_id', v_new_set_id,
    'version_number', v_next_ver,
    'version_label', v_new_label,
    'updated_rules', to_jsonb(v_applied_keys),
    'effective_policy', public.rules_get_effective_policy(NULL)
  );
END;
$$;

-- ── 10. Row-Level Security & Least-Privilege Grants ─────────────────────────
ALTER TABLE public.policy_sets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_rules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_change_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prohibited_source_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_providers          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_sets_admin_all ON public.policy_sets;
CREATE POLICY policy_sets_admin_all ON public.policy_sets
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS policy_rules_admin_all ON public.policy_rules;
CREATE POLICY policy_rules_admin_all ON public.policy_rules
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS policy_change_log_admin_read ON public.policy_change_log;
CREATE POLICY policy_change_log_admin_read ON public.policy_change_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS prohibited_profiles_admin_all ON public.prohibited_source_profiles;
CREATE POLICY prohibited_profiles_admin_all ON public.prohibited_source_profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS scraping_providers_admin_all ON public.scraping_providers;
CREATE POLICY scraping_providers_admin_all ON public.scraping_providers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.policy_sets                FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.policy_rules               FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.policy_change_log          FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.prohibited_source_profiles FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.scraping_providers         FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.policy_sets                TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.policy_rules               TO authenticated, service_role;
GRANT SELECT, INSERT                 ON TABLE public.policy_change_log          TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prohibited_source_profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.scraping_providers         TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rules_get_effective_policy(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rules_get_effective_policy(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rules_publish_configurable_update(JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rules_publish_configurable_update(JSONB, TEXT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
