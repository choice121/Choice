-- ============================================================================
-- Migration 000025: Phase 5 — 3-Layer Verification Status & Conflict Ledger
-- ============================================================================
-- 1. Adds strictly internal verification metadata columns to pipeline.pipeline_properties:
--      - field_verification_status JSONB NOT NULL DEFAULT '{}'::jsonb
--      - verification_conflicts    JSONB NOT NULL DEFAULT '[]'::jsonb
--    (Isolated on pipeline.pipeline_properties & admin RPCs; never added to
--     public.properties or exposed to unauthenticated anon callers.)
-- 2. Updates public.pipeline_validate_batch() to select spatial, utility,
--    ledger, and prior verification metadata needed by Phase 5 validation.
-- 3. Updates public.pipeline_record_validation_result() (replacing the prior
--    6-arg signature cleanly without creating PostgREST overload ambiguity) to
--    persist field_verification_status and verification_conflicts.
-- 4. Updates public.pipeline_list() so admin inspection consoles display
--    per-field verification badges and conflict entries.
-- ============================================================================

ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS field_verification_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_conflicts    JSONB NOT NULL DEFAULT '[]'::jsonb;

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
      county, neighborhood,
      normalized_address_key, rental_eligibility_status, is_dual_listed,
      lat, lng, monthly_rent, original_monthly_rent, application_fee, security_deposit,
      bedrooms, bathrooms, half_bathrooms, total_bathrooms, square_footage,
      property_type, property_subtype, is_multi_unit, price_range, total_units, floor_plans,
      heating_type, cooling_type, laundry_type, garage_spaces, parking,
      has_central_air, has_basement,
      source_status, source, source_url, source_listing_id,
      agent_name, broker_name, agent_image_url, poster_landlord_id,
      description, original_description, amenities, appliances, utilities_included, flooring,
      original_image_urls, original_data, source_raw_payload, field_provenance,
      structural_details, utility_details, financial_details, location_details,
      source_facts_ledger, unmapped_attributes,
      field_verification_status, verification_conflicts,
      batch_id, batch_uuid, folder_id, folder_serial,
      imported_at, scraped_at,
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

DROP FUNCTION IF EXISTS public.pipeline_record_validation_result(TEXT, TEXT, BOOLEAN, TEXT, JSONB, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.pipeline_record_validation_result(
  p_id                        TEXT,
  p_validation_status         TEXT,
  p_needs_review              BOOLEAN,
  p_review_reason             TEXT DEFAULT NULL,
  p_validation_report         JSONB DEFAULT '{}'::jsonb,
  p_validated_at              TIMESTAMPTZ DEFAULT now(),
  p_field_verification_status JSONB DEFAULT NULL,
  p_verification_conflicts    JSONB DEFAULT NULL
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
  v_field_status JSONB;
  v_conflicts JSONB;
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

  v_field_status := COALESCE(
    p_field_verification_status,
    CASE
      WHEN jsonb_typeof(p_validation_report->'field_verification_status') = 'object'
      THEN p_validation_report->'field_verification_status'
      ELSE NULL
    END
  );

  v_conflicts := COALESCE(
    p_verification_conflicts,
    CASE
      WHEN jsonb_typeof(p_validation_report->'verification_conflicts') = 'array'
      THEN p_validation_report->'verification_conflicts'
      ELSE NULL
    END
  );

  UPDATE pipeline.pipeline_properties
  SET
    validation_status         = v_status,
    needs_review              = COALESCE(p_needs_review, v_status = 'needs_review'),
    review_reason             = NULLIF(trim(COALESCE(p_review_reason, '')), ''),
    validation_report         = COALESCE(p_validation_report, '{}'::jsonb),
    field_verification_status = COALESCE(v_field_status, field_verification_status, '{}'::jsonb),
    verification_conflicts    = COALESCE(v_conflicts, verification_conflicts, '[]'::jsonb),
    validated_at              = COALESCE(p_validated_at, now()),
    updated_at                = now()
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
    'validated_at', v_updated.validated_at,
    'field_verification_status', v_updated.field_verification_status,
    'verification_conflicts', v_updated.verification_conflicts
  );
END;
$$;

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
      normalized_address_key, rental_eligibility_status, is_dual_listed,
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
      field_verification_status, verification_conflicts,
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
      source_facts_ledger, unmapped_attributes,
      floor_plans, videos
    FROM pipeline.pipeline_properties
    WHERE (p_status = 'all' OR status = p_status)
    ORDER BY COALESCE(imported_at, scraped_at::timestamptz) DESC NULLS LAST, id DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_validate_batch(TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pipeline_validate_batch(TEXT, TEXT, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pipeline_record_validation_result(TEXT, TEXT, BOOLEAN, TEXT, JSONB, TIMESTAMPTZ, JSONB, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pipeline_record_validation_result(TEXT, TEXT, BOOLEAN, TEXT, JSONB, TIMESTAMPTZ, JSONB, JSONB) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
