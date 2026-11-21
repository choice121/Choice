-- ============================================================================
-- Phase 7: Centralized Description Enrichment & Task-Specific Pricing Engines
-- ============================================================================
-- 1. Creates public.pricing_calculations audit table for every pricing run.
-- 2. Extends public.description_enrichment_audit with batch_id, policy_version,
--    mode, and status while preserving all 14 existing columns.
-- 3. Extends pipeline.pipeline_properties with pricing tracking columns:
--      - pricing_status ('pending' | 'calculated' | 'held_out_of_range' | 'error')
--      - pricing_method TEXT
--      - pricing_meta JSONB
--      - priced_at TIMESTAMPTZ
--      - last_priced_hash TEXT
-- 4. Updates public.pipeline_list & public.pipeline_folder_properties to return
--    Phase 7 enrichment & pricing fields.
-- 5. Creates least-privilege batch & result RPCs for enrich-description and
--    calculate-pricing:
--      - public.pipeline_enrich_batch(p_batch_id, p_status_filter, p_limit)
--      - public.pipeline_record_enrichment_result(...)
--      - public.pipeline_price_batch(p_batch_id, p_status_filter, p_limit)
--      - public.pipeline_record_pricing_result(...)
-- ============================================================================

-- ── 1. Create public.pricing_calculations ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_calculations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id             TEXT,
  pipeline_id          TEXT NOT NULL,
  property_id          TEXT,
  method               TEXT NOT NULL CHECK (method IN ('none', 'fixed', 'individual_map', 'proportional_range')),
  source_min           NUMERIC,
  source_max           NUMERIC,
  target_min           NUMERIC,
  target_max           NUMERIC,
  original_rent        NUMERIC,
  calculated_rent      NUMERIC,
  was_clamped          BOOLEAN NOT NULL DEFAULT false,
  status               TEXT NOT NULL CHECK (status IN ('calculated', 'held_out_of_range', 'skipped_idempotent', 'error')),
  reason               TEXT,
  policy_version       TEXT,
  task_config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_calculations_batch_time
  ON public.pricing_calculations (batch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_calculations_pipeline_time
  ON public.pricing_calculations (pipeline_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_calculations_status_time
  ON public.pricing_calculations (status, created_at DESC);

ALTER TABLE public.pricing_calculations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pricing_calculations_admin_select ON public.pricing_calculations;
CREATE POLICY pricing_calculations_admin_select
  ON public.pricing_calculations
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.pricing_calculations FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.pricing_calculations TO authenticated;
GRANT ALL ON TABLE public.pricing_calculations TO service_role;

-- ── 2. Extend & Harden public.description_enrichment_audit ───────────────────
ALTER TABLE public.description_enrichment_audit
  ADD COLUMN IF NOT EXISTS batch_id       TEXT,
  ADD COLUMN IF NOT EXISTS policy_version TEXT,
  ADD COLUMN IF NOT EXISTS mode           TEXT,
  ADD COLUMN IF NOT EXISTS status         TEXT;

CREATE INDEX IF NOT EXISTS idx_desc_enrichment_audit_pipeline_time
  ON public.description_enrichment_audit (pipeline_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_desc_enrichment_audit_batch_time
  ON public.description_enrichment_audit (batch_id, created_at DESC);

ALTER TABLE public.description_enrichment_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS desc_enrichment_audit_admin_select ON public.description_enrichment_audit;
CREATE POLICY desc_enrichment_audit_admin_select
  ON public.description_enrichment_audit
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.description_enrichment_audit FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.description_enrichment_audit TO authenticated;
GRANT ALL ON TABLE public.description_enrichment_audit TO service_role;

-- ── 3. Extend pipeline.pipeline_properties with pricing state ────────────────
ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS pricing_status   TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pricing_method   TEXT,
  ADD COLUMN IF NOT EXISTS pricing_meta     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS priced_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_priced_hash TEXT;

ALTER TABLE pipeline.pipeline_properties
  DROP CONSTRAINT IF EXISTS chk_pipeline_properties_pricing_status;
ALTER TABLE pipeline.pipeline_properties
  ADD CONSTRAINT chk_pipeline_properties_pricing_status
  CHECK (pricing_status IN ('pending', 'calculated', 'held_out_of_range', 'error'));

CREATE INDEX IF NOT EXISTS idx_pipeline_props_batch_pricing
  ON pipeline.pipeline_properties (batch_id, pricing_status);

CREATE INDEX IF NOT EXISTS idx_pipeline_props_batch_enrichment
  ON pipeline.pipeline_properties (batch_id, enrichment_status);

-- ── 4. Update pipeline_list & pipeline_folder_properties ─────────────────────
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
      description, original_description, ai_description_draft, approved_description,
      enrichment_status, enrichment_version, description_enrichment_meta, enriched_at,
      pricing_status, pricing_method, pricing_meta, priced_at,
      showing_instructions,
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
      description, original_description, ai_description_draft, approved_description,
      enrichment_status, enrichment_version, description_enrichment_meta, enriched_at,
      pricing_status, pricing_method, pricing_meta, priced_at,
      showing_instructions,
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

-- ── 5. Enrichment Batch & Result RPCs ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pipeline_enrich_batch(
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
      bedrooms, bathrooms, half_bathrooms, square_footage, property_type, property_subtype,
      description, original_description, ai_description_draft, approved_description,
      enrichment_status, enrichment_version, description_enrichment_meta,
      last_enriched_hash, enriched_at, operator_approved,
      amenities, appliances, utilities_included, structural_details, utility_details,
      validation_status, needs_review, review_reason,
      batch_id, batch_uuid, folder_id, folder_serial, imported_at, scraped_at
    FROM pipeline.pipeline_properties
    WHERE (v_batch_id IS NULL OR batch_id = v_batch_id)
      AND (v_status IS NULL OR enrichment_status = v_status)
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

CREATE OR REPLACE FUNCTION public.pipeline_record_enrichment_result(
  p_id                    TEXT,
  p_enrichment_status     TEXT,
  p_ai_description_draft  TEXT DEFAULT NULL,
  p_approved_description  TEXT DEFAULT NULL,
  p_enrichment_meta       JSONB DEFAULT '{}'::jsonb,
  p_enrichment_version    TEXT DEFAULT 'v1',
  p_last_enriched_hash    TEXT DEFAULT NULL,
  p_needs_review          BOOLEAN DEFAULT false,
  p_review_reason         TEXT DEFAULT NULL,
  p_original_hash         TEXT DEFAULT NULL,
  p_cleaned_hash          TEXT DEFAULT NULL,
  p_changes               JSONB DEFAULT '{}'::jsonb,
  p_reasons               JSONB DEFAULT '[]'::jsonb,
  p_confidence            NUMERIC DEFAULT NULL,
  p_ruleset_version       TEXT DEFAULT NULL,
  p_model                 TEXT DEFAULT 'deterministic-baseline',
  p_triggered_by          TEXT DEFAULT 'enrich-description',
  p_latency_ms            INTEGER DEFAULT 0,
  p_mode                  TEXT DEFAULT 'baseline_rewrite'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_id     TEXT := NULLIF(trim(COALESCE(p_id, '')), '');
  v_status TEXT := lower(trim(COALESCE(p_enrichment_status, '')));
  v_row    pipeline.pipeline_properties%ROWTYPE;
  v_orig   TEXT;
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

  IF v_status NOT IN ('pending', 'enriched', 'needs_review', 'failed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_enrichment_status');
  END IF;

  SELECT * INTO v_row FROM pipeline.pipeline_properties WHERE id = v_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pipeline_property_not_found', 'id', v_id);
  END IF;

  -- Preserve original_description strictly untouched once set; only backfill if NULL/empty
  v_orig := COALESCE(NULLIF(v_row.original_description, ''), v_row.description);

  UPDATE pipeline.pipeline_properties
  SET
    original_description        = v_orig,
    ai_description_draft        = COALESCE(p_ai_description_draft, ai_description_draft),
    approved_description        = CASE
      WHEN v_status = 'enriched' AND p_approved_description IS NOT NULL THEN p_approved_description
      ELSE approved_description
    END,
    description                 = CASE
      WHEN v_status = 'enriched' AND p_approved_description IS NOT NULL THEN p_approved_description
      ELSE description
    END,
    enrichment_status           = v_status,
    enrichment_version          = COALESCE(NULLIF(trim(COALESCE(p_enrichment_version, '')), ''), 'v1'),
    description_enrichment_meta = COALESCE(p_enrichment_meta, '{}'::jsonb),
    last_enriched_hash          = COALESCE(NULLIF(trim(COALESCE(p_last_enriched_hash, '')), ''), last_enriched_hash),
    enriched_at                 = now(),
    needs_review                = CASE
      WHEN v_status = 'needs_review' THEN true
      ELSE needs_review
    END,
    review_reason               = CASE
      WHEN v_status = 'needs_review' THEN COALESCE(NULLIF(trim(COALESCE(p_review_reason, '')), ''), review_reason)
      ELSE review_reason
    END,
    updated_at                  = now()
  WHERE id = v_id
  RETURNING * INTO v_row;

  INSERT INTO public.description_enrichment_audit (
    pipeline_id,
    property_id,
    batch_id,
    original_hash,
    cleaned_hash,
    changes,
    reasons,
    confidence,
    ruleset_version,
    policy_version,
    model,
    triggered_by,
    latency_ms,
    cost_cents,
    mode,
    status
  ) VALUES (
    v_row.id,
    v_row.choice_property_id,
    v_row.batch_id,
    p_original_hash,
    p_cleaned_hash,
    COALESCE(p_changes, '{}'::jsonb),
    COALESCE(p_reasons, '[]'::jsonb),
    p_confidence,
    p_ruleset_version,
    p_ruleset_version,
    p_model,
    p_triggered_by,
    p_latency_ms,
    0,
    p_mode,
    v_status
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'batch_id', v_row.batch_id,
    'enrichment_status', v_row.enrichment_status,
    'needs_review', v_row.needs_review,
    'review_reason', v_row.review_reason,
    'enriched_at', v_row.enriched_at
  );
END;
$$;

-- ── 6. Pricing Batch & Result RPCs ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pipeline_price_batch(
  p_batch_id      TEXT DEFAULT NULL,
  p_status_filter TEXT DEFAULT NULL,
  p_limit         INTEGER DEFAULT 200
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
  v_limit    INTEGER := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
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
      id, status, title, address, city, state, zip,
      monthly_rent, original_monthly_rent, security_deposit, application_fee,
      pricing_status, pricing_method, pricing_meta, priced_at, last_priced_hash,
      validation_status, needs_review, review_reason,
      source_listing_id, choice_property_id,
      batch_id, batch_uuid, folder_id, folder_serial, imported_at, scraped_at
    FROM pipeline.pipeline_properties
    WHERE (v_batch_id IS NULL OR batch_id = v_batch_id)
      AND (v_status IS NULL OR pricing_status = v_status)
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

CREATE OR REPLACE FUNCTION public.pipeline_record_pricing_result(
  p_id                   TEXT,
  p_method               TEXT,
  p_pricing_status       TEXT,
  p_original_rent        NUMERIC DEFAULT NULL,
  p_calculated_rent      NUMERIC DEFAULT NULL,
  p_source_min           NUMERIC DEFAULT NULL,
  p_source_max           NUMERIC DEFAULT NULL,
  p_target_min           NUMERIC DEFAULT NULL,
  p_target_max           NUMERIC DEFAULT NULL,
  p_was_clamped          BOOLEAN DEFAULT false,
  p_reason               TEXT DEFAULT NULL,
  p_policy_version       TEXT DEFAULT NULL,
  p_task_config_snapshot JSONB DEFAULT '{}'::jsonb,
  p_last_priced_hash     TEXT DEFAULT NULL,
  p_pricing_meta         JSONB DEFAULT '{}'::jsonb,
  p_audit_status         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_id           TEXT := NULLIF(trim(COALESCE(p_id, '')), '');
  v_method       TEXT := lower(trim(COALESCE(p_method, '')));
  v_status       TEXT := lower(trim(COALESCE(p_pricing_status, '')));
  v_audit_status TEXT := lower(trim(COALESCE(NULLIF(p_audit_status, ''), v_status)));
  v_row          pipeline.pipeline_properties%ROWTYPE;
  v_orig_rent    NUMERIC;
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

  IF v_method NOT IN ('none', 'fixed', 'individual_map', 'proportional_range') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pricing_method');
  END IF;

  IF v_status NOT IN ('pending', 'calculated', 'held_out_of_range', 'error') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pricing_status');
  END IF;

  IF v_audit_status NOT IN ('calculated', 'held_out_of_range', 'skipped_idempotent', 'error') THEN
    v_audit_status := 'calculated';
  END IF;

  SELECT * INTO v_row FROM pipeline.pipeline_properties WHERE id = v_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pipeline_property_not_found', 'id', v_id);
  END IF;

  -- Never overwrite original_monthly_rent once recorded; only initialize if NULL
  v_orig_rent := COALESCE(v_row.original_monthly_rent, p_original_rent, v_row.monthly_rent);

  UPDATE pipeline.pipeline_properties
  SET
    original_monthly_rent = v_orig_rent,
    monthly_rent          = CASE
      WHEN v_status = 'calculated' AND p_calculated_rent IS NOT NULL AND p_calculated_rent > 0
        THEN ROUND(p_calculated_rent)::integer
      ELSE monthly_rent
    END,
    security_deposit      = CASE
      WHEN v_status = 'calculated' AND p_calculated_rent IS NOT NULL AND p_calculated_rent > 0
        THEN ROUND(p_calculated_rent)::integer
      ELSE security_deposit
    END,
    application_fee       = 50,
    pricing_status        = v_status,
    pricing_method        = v_method,
    pricing_meta          = COALESCE(p_pricing_meta, '{}'::jsonb),
    last_priced_hash      = COALESCE(NULLIF(trim(COALESCE(p_last_priced_hash, '')), ''), last_priced_hash),
    priced_at             = now(),
    needs_review          = CASE
      WHEN v_status IN ('held_out_of_range', 'error') THEN true
      ELSE needs_review
    END,
    review_reason         = CASE
      WHEN v_status IN ('held_out_of_range', 'error') THEN COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), review_reason)
      ELSE review_reason
    END,
    updated_at            = now()
  WHERE id = v_id
  RETURNING * INTO v_row;

  INSERT INTO public.pricing_calculations (
    batch_id,
    pipeline_id,
    property_id,
    method,
    source_min,
    source_max,
    target_min,
    target_max,
    original_rent,
    calculated_rent,
    was_clamped,
    status,
    reason,
    policy_version,
    task_config_snapshot
  ) VALUES (
    v_row.batch_id,
    v_row.id,
    v_row.choice_property_id,
    v_method,
    p_source_min,
    p_source_max,
    p_target_min,
    p_target_max,
    v_orig_rent,
    p_calculated_rent,
    COALESCE(p_was_clamped, false),
    v_audit_status,
    NULLIF(trim(COALESCE(p_reason, '')), ''),
    NULLIF(trim(COALESCE(p_policy_version, '')), ''),
    COALESCE(p_task_config_snapshot, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'batch_id', v_row.batch_id,
    'original_monthly_rent', v_row.original_monthly_rent,
    'monthly_rent', v_row.monthly_rent,
    'pricing_status', v_row.pricing_status,
    'pricing_method', v_row.pricing_method,
    'needs_review', v_row.needs_review,
    'review_reason', v_row.review_reason,
    'priced_at', v_row.priced_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_enrich_batch(TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pipeline_enrich_batch(TEXT, TEXT, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pipeline_record_enrichment_result(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, JSONB, JSONB, NUMERIC, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pipeline_record_enrichment_result(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, JSONB, JSONB, NUMERIC, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pipeline_price_batch(TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pipeline_price_batch(TEXT, TEXT, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pipeline_record_pricing_result(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, TEXT, TEXT, JSONB, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pipeline_record_pricing_result(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, TEXT, TEXT, JSONB, TEXT, JSONB, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
