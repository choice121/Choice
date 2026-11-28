-- ============================================================================
-- Phase 6: Automated Property Eligibility, Source Profile & Image Validation
-- ============================================================================
-- 1. Adds structured validation columns & indexes to pipeline.pipeline_properties:
--      - validation_status ('pending' | 'passed' | 'needs_review' | 'rejected')
--      - review_reason TEXT
--      - validated_at TIMESTAMPTZ
-- 2. Extends public.prohibited_source_profiles with:
--      - zillow_profile_urls TEXT[] (supports unlimited pasted Zillow profile URLs)
--      - added_by TEXT
-- 3. Updates public.rules_get_effective_policy(TEXT) to return zillow_profile_urls
--    and updated_at metadata for prohibited profiles.
-- 4. Updates public.pipeline_list & public.pipeline_folder_properties so the
--    Admin Pipeline UI sees validation_status, review_reason, validated_at,
--    needs_review, validation_report, broker_name, is_multi_unit, etc.
-- 5. Creates least-privilege validation RPCs:
--      - public.pipeline_validate_batch(p_batch_id, p_status_filter, p_limit)
--      - public.pipeline_record_validation_result(...)
--      - public.pipeline_resolve_validation_review(...)
-- ============================================================================

-- ── 1. Extend pipeline.pipeline_properties ──────────────────────────────────
ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_reason     TEXT,
  ADD COLUMN IF NOT EXISTS validated_at      TIMESTAMPTZ;

ALTER TABLE pipeline.pipeline_properties
  DROP CONSTRAINT IF EXISTS chk_pipeline_properties_validation_status;
ALTER TABLE pipeline.pipeline_properties
  ADD CONSTRAINT chk_pipeline_properties_validation_status
  CHECK (validation_status IN ('pending', 'passed', 'needs_review', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_pipeline_props_batch_validation
  ON pipeline.pipeline_properties (batch_id, validation_status);

CREATE INDEX IF NOT EXISTS idx_pipeline_props_validation_status
  ON pipeline.pipeline_properties (validation_status, imported_at DESC);

-- ── 2. Extend public.prohibited_source_profiles ─────────────────────────────
ALTER TABLE public.prohibited_source_profiles
  ADD COLUMN IF NOT EXISTS zillow_profile_urls TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS added_by            TEXT;

-- ── 3. Update rules_get_effective_policy to include zillow_profile_urls ──────
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
      'zillow_profile_urls', COALESCE(p.zillow_profile_urls, '{}'::text[]),
      'match_mode', p.match_mode,
      'is_immutable', p.is_immutable,
      'enabled', p.enabled,
      'notes', p.notes,
      'added_by', p.added_by
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

-- ── 4. Update pipeline_list & pipeline_folder_properties to include validation fields ─
CREATE OR REPLACE FUNCTION public.pipeline_list(
  p_status text DEFAULT 'scraped'::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      id, status, title, address, unit_number, city, state, zip,
      bedrooms, bathrooms, half_bathrooms, total_bathrooms,
      square_footage, lot_size_sqft, floors, garage_spaces, total_units,
      monthly_rent, original_monthly_rent, security_deposit, last_months_rent,
      application_fee, pet_deposit, admin_fee, parking_fee,
      hoa_fee, hoa_fee_frequency, tax_annual_amount, tax_value, move_in_special,
      property_type, property_subtype, year_built,
      is_multi_unit, price_range,
      description, original_description, showing_instructions,
      pets_allowed, pet_types_allowed, pet_weight_limit, pet_details,
      smoking_allowed, available_date, minimum_lease_months, lease_terms,
      parking, amenities, appliances, utilities_included, flooring,
      heating_type, cooling_type, laundry_type, ev_charging,
      virtual_tour_url, has_basement, has_central_air,
      data_quality_score, missing_fields, edited_fields,
      validation_status, needs_review, review_reason, validated_at, validation_report,
      original_image_urls, local_image_paths,
      source_url, source, source_listing_id, agent_name, broker_name,
      poster_landlord_id, choice_property_id, batch_id, batch_uuid,
      folder_id, folder_serial,
      scraped_at, updated_at, published_at,
      neighborhood, county, location_context,
      listed_at, source_last_updated_at, imported_at, source_status, last_verified_at,
      lat, lng,
      original_data, source_raw_payload, field_provenance,
      structural_details, utility_details, financial_details, location_details,
      floor_plans, videos
    FROM pipeline.pipeline_properties
    WHERE (p_status = 'all' OR status = p_status)
    ORDER BY COALESCE(imported_at, scraped_at::timestamptz) DESC NULLS LAST, id DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_folder_properties(p_folder_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      id, status, title, address, city, state, zip,
      bedrooms, bathrooms, half_bathrooms, square_footage, monthly_rent, original_monthly_rent,
      property_type, property_subtype, year_built, unit_number,
      is_multi_unit, price_range, total_units, floor_plans, source_status,
      description, original_description, showing_instructions,
      pets_allowed, smoking_allowed, parking,
      minimum_lease_months, security_deposit, application_fee,
      garage_spaces, available_date, virtual_tour_url,
      has_basement, has_central_air,
      data_quality_score, missing_fields, edited_fields,
      validation_status, needs_review, review_reason, validated_at, validation_report,
      original_image_urls, source_url, source, source_listing_id, agent_name, broker_name,
      poster_landlord_id, choice_property_id, batch_id, batch_uuid,
      scraped_at, updated_at, published_at, imported_at,
      neighborhood, county, location_context,
      folder_id, folder_serial,
      photo_import_status, photo_upload_status,
      field_provenance
    FROM pipeline.pipeline_properties
    WHERE folder_id = p_folder_id
    ORDER BY folder_serial ASC
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ── 5. Least-Privilege Validation Batch & Result RPCs ───────────────────────
CREATE OR REPLACE FUNCTION public.pipeline_validate_batch(
  p_batch_id      TEXT DEFAULT NULL,
  p_status_filter TEXT DEFAULT NULL,
  p_limit         INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_batch_id TEXT := NULLIF(regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', ''), '');
  v_status   TEXT := NULLIF(trim(COALESCE(p_status_filter, '')), '');
  v_limit    INTEGER := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 300);
  v_rows     JSONB;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.folder_serial ASC NULLS LAST, p.imported_at ASC NULLS LAST, p.id ASC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      id, status, title, address, unit_number, city, state, zip,
      lat, lng, monthly_rent, original_monthly_rent, application_fee, security_deposit,
      bedrooms, bathrooms, half_bathrooms, square_footage,
      property_type, property_subtype, is_multi_unit, price_range, total_units, floor_plans,
      source_status, source, source_url, source_listing_id,
      agent_name, broker_name, agent_image_url, poster_landlord_id,
      description, original_description, amenities, appliances, utilities_included,
      original_image_urls, original_data, source_raw_payload, field_provenance,
      structural_details, financial_details,
      batch_id, batch_uuid, folder_id, folder_serial,
      validation_status, needs_review, review_reason, validated_at, validation_report
    FROM pipeline.pipeline_properties
    WHERE (v_batch_id IS NULL OR batch_id = v_batch_id)
      AND (v_status IS NULL OR validation_status = v_status)
      AND status <> 'archived'
    ORDER BY folder_serial ASC NULLS LAST, imported_at ASC NULLS LAST, id ASC
    LIMIT v_limit
  ) p;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'count', jsonb_array_length(v_rows),
    'properties', v_rows
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_record_validation_result(
  p_id                TEXT,
  p_validation_status TEXT,
  p_needs_review      BOOLEAN,
  p_review_reason     TEXT DEFAULT NULL,
  p_validation_report JSONB DEFAULT '{}'::jsonb,
  p_validated_at      TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_id TEXT := NULLIF(trim(COALESCE(p_id, '')), '');
  v_status TEXT := lower(trim(COALESCE(p_validation_status, '')));
  v_updated pipeline.pipeline_properties%ROWTYPE;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'property_id_required');
  END IF;

  IF v_status NOT IN ('pending', 'passed', 'needs_review', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_validation_status');
  END IF;

  UPDATE pipeline.pipeline_properties
  SET
    validation_status = v_status,
    needs_review      = COALESCE(p_needs_review, v_status = 'needs_review'),
    review_reason     = NULLIF(trim(COALESCE(p_review_reason, '')), ''),
    validation_report = COALESCE(p_validation_report, '{}'::jsonb),
    validated_at      = COALESCE(p_validated_at, now()),
    updated_at        = now()
  WHERE id = v_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pipeline_property_not_found', 'id', v_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_updated.id,
    'batch_id', v_updated.batch_id,
    'validation_status', v_updated.validation_status,
    'needs_review', v_updated.needs_review,
    'review_reason', v_updated.review_reason,
    'validated_at', v_updated.validated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_resolve_validation_review(
  p_id       TEXT,
  p_decision TEXT,
  p_note     TEXT DEFAULT NULL,
  p_actor    TEXT DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_id       TEXT := NULLIF(trim(COALESCE(p_id, '')), '');
  v_decision TEXT := lower(trim(COALESCE(p_decision, '')));
  v_target   TEXT;
  v_row      pipeline.pipeline_properties%ROWTYPE;
  v_report   JSONB;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'property_id_required');
  END IF;

  IF v_decision IN ('approve', 'pass', 'passed') THEN
    v_target := 'passed';
  ELSIF v_decision IN ('reject', 'rejected', 'decline') THEN
    v_target := 'rejected';
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_decision');
  END IF;

  SELECT * INTO v_row FROM pipeline.pipeline_properties WHERE id = v_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pipeline_property_not_found', 'id', v_id);
  END IF;

  v_report := COALESCE(v_row.validation_report, '{}'::jsonb) || jsonb_build_object(
    'status', v_target,
    'admin_override', jsonb_build_object(
      'decision', v_target,
      'previous_status', v_row.validation_status,
      'previous_reason', v_row.review_reason,
      'note', NULLIF(trim(COALESCE(p_note, '')), ''),
      'resolved_by', COALESCE(NULLIF(trim(p_actor), ''), 'admin'),
      'resolved_at', now()
    )
  );

  UPDATE pipeline.pipeline_properties
  SET
    validation_status = v_target,
    needs_review      = false,
    review_reason     = CASE
      WHEN v_target = 'rejected' THEN COALESCE(NULLIF(trim(p_note), ''), v_row.review_reason, 'admin_rejected')
      ELSE NULL
    END,
    validation_report = v_report,
    validated_at      = now(),
    updated_at        = now()
  WHERE id = v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_id,
    'validation_status', v_target,
    'needs_review', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_validate_batch(TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pipeline_validate_batch(TEXT, TEXT, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pipeline_record_validation_result(TEXT, TEXT, BOOLEAN, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pipeline_record_validation_result(TEXT, TEXT, BOOLEAN, TEXT, JSONB, TIMESTAMPTZ) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pipeline_resolve_validation_review(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pipeline_resolve_validation_review(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
