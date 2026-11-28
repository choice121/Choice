-- ============================================================================
-- Phase 6 Fix: Include imported_at & scraped_at in pipeline_validate_batch()
-- ============================================================================
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

REVOKE ALL ON FUNCTION public.pipeline_validate_batch(TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pipeline_validate_batch(TEXT, TEXT, INTEGER) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
