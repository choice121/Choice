-- ============================================================================
-- Migration 000024: Phase 3 — Lossless source_facts_ledger & unmapped_attributes
-- ============================================================================
-- 1. Adds strictly internal staging JSONB columns to pipeline.pipeline_properties:
--      - source_facts_ledger JSONB NOT NULL DEFAULT '{}'::jsonb
--      - unmapped_attributes JSONB NOT NULL DEFAULT '{}'::jsonb
--    (Confined strictly to pipeline.pipeline_properties & admin RPCs; never added
--     to public.properties or exposed to unauthenticated anon callers.)
-- 2. Updates public.pipeline_list and public.pipeline_save so admin tools inspect
--    and persist the expanded Phase 3 ledger/unmapped columns.
-- ============================================================================

ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS source_facts_ledger JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS unmapped_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

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

CREATE OR REPLACE FUNCTION public.pipeline_save(
  p_id    text,
  p_patch jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $function$
DECLARE
  v_existing pipeline.pipeline_properties%ROWTYPE;
  v_edited   text;
BEGIN
  SELECT * INTO v_existing FROM pipeline.pipeline_properties WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Not found');
  END IF;

  SELECT array_to_json(array_agg(DISTINCT e))::text
  INTO v_edited
  FROM (
    SELECT jsonb_array_elements_text(COALESCE(pipeline.safe_parse_jsonb(v_existing.edited_fields), '[]'::jsonb)) AS e
    UNION
    SELECT key FROM jsonb_each_text(p_patch)
  ) t(e);

  UPDATE pipeline.pipeline_properties SET
    title                = COALESCE(p_patch->>'title',                title),
    address              = COALESCE(p_patch->>'address',              address),
    unit_number          = CASE WHEN p_patch ? 'unit_number'          THEN NULLIF(p_patch->>'unit_number', '') ELSE unit_number END,
    city                 = COALESCE(p_patch->>'city',                 city),
    state                = COALESCE(p_patch->>'state',                state),
    zip                  = COALESCE(p_patch->>'zip',                  zip),
    county               = COALESCE(p_patch->>'county',               county),
    neighborhood         = COALESCE(p_patch->>'neighborhood',         neighborhood),
    bedrooms             = COALESCE((p_patch->>'bedrooms')::int,      bedrooms),
    bathrooms            = COALESCE((p_patch->>'bathrooms')::float,   bathrooms),
    half_bathrooms       = COALESCE((p_patch->>'half_bathrooms')::int, half_bathrooms),
    total_bathrooms      = COALESCE((p_patch->>'total_bathrooms')::float, total_bathrooms),
    square_footage       = COALESCE((p_patch->>'square_footage')::int,square_footage),
    lot_size_sqft        = COALESCE((p_patch->>'lot_size_sqft')::int, lot_size_sqft),
    floors               = COALESCE((p_patch->>'floors')::int,        floors),
    year_built           = COALESCE((p_patch->>'year_built')::int,    year_built),
    monthly_rent         = COALESCE((p_patch->>'monthly_rent')::int,  monthly_rent),
    security_deposit     = COALESCE((p_patch->>'security_deposit')::int, security_deposit),
    application_fee      = COALESCE((p_patch->>'application_fee')::int,  application_fee),
    hoa_fee              = COALESCE((p_patch->>'hoa_fee')::int,       hoa_fee),
    hoa_fee_frequency    = CASE WHEN p_patch ? 'hoa_fee_frequency'    THEN NULLIF(p_patch->>'hoa_fee_frequency', '') ELSE hoa_fee_frequency END,
    tax_annual_amount    = COALESCE((p_patch->>'tax_annual_amount')::int, tax_annual_amount),
    property_type        = COALESCE(p_patch->>'property_type',        property_type),
    property_subtype     = CASE WHEN p_patch ? 'property_subtype'     THEN NULLIF(p_patch->>'property_subtype', '') ELSE property_subtype END,
    description          = COALESCE(p_patch->>'description',          description),
    original_description = COALESCE(p_patch->>'original_description', original_description),
    showing_instructions = COALESCE(p_patch->>'showing_instructions', showing_instructions),
    move_in_special      = COALESCE(p_patch->>'move_in_special',      move_in_special),
    available_date       = COALESCE(p_patch->>'available_date',       available_date),
    pets_allowed         = COALESCE((p_patch->>'pets_allowed')::boolean,   pets_allowed),
    smoking_allowed      = COALESCE((p_patch->>'smoking_allowed')::boolean,smoking_allowed),
    minimum_lease_months = COALESCE((p_patch->>'minimum_lease_months')::int, minimum_lease_months),
    garage_spaces        = COALESCE((p_patch->>'garage_spaces')::int, garage_spaces),
    parking              = COALESCE(p_patch->>'parking',              parking),
    heating_type         = COALESCE(p_patch->>'heating_type',         heating_type),
    cooling_type         = COALESCE(p_patch->>'cooling_type',         cooling_type),
    laundry_type         = COALESCE(p_patch->>'laundry_type',         laundry_type),
    ev_charging          = CASE WHEN p_patch ? 'ev_charging'          THEN NULLIF(p_patch->>'ev_charging', '') ELSE ev_charging END,
    amenities            = COALESCE(p_patch->>'amenities',            amenities),
    appliances           = COALESCE(p_patch->>'appliances',           appliances),
    utilities_included   = COALESCE(p_patch->>'utilities_included',   utilities_included),
    flooring             = COALESCE(p_patch->>'flooring',             flooring),
    original_image_urls  = COALESCE(p_patch->>'original_image_urls',  original_image_urls),
    virtual_tour_url     = COALESCE(p_patch->>'virtual_tour_url',     virtual_tour_url),
    has_basement         = COALESCE((p_patch->>'has_basement')::boolean,   has_basement),
    has_central_air      = COALESCE((p_patch->>'has_central_air')::boolean,has_central_air),
    poster_landlord_id   = COALESCE(p_patch->>'poster_landlord_id',   poster_landlord_id),
    location_context     = COALESCE(p_patch->>'location_context',     location_context),
    field_provenance     = CASE WHEN p_patch ? 'field_provenance'     THEN p_patch->'field_provenance'     ELSE field_provenance END,
    structural_details   = CASE WHEN p_patch ? 'structural_details'   THEN p_patch->'structural_details'   ELSE structural_details END,
    utility_details      = CASE WHEN p_patch ? 'utility_details'      THEN p_patch->'utility_details'      ELSE utility_details END,
    financial_details    = CASE WHEN p_patch ? 'financial_details'    THEN p_patch->'financial_details'    ELSE financial_details END,
    location_details     = CASE WHEN p_patch ? 'location_details'     THEN p_patch->'location_details'     ELSE location_details END,
    source_facts_ledger  = CASE WHEN p_patch ? 'source_facts_ledger'  THEN p_patch->'source_facts_ledger'  ELSE source_facts_ledger END,
    unmapped_attributes  = CASE WHEN p_patch ? 'unmapped_attributes'  THEN p_patch->'unmapped_attributes'  ELSE unmapped_attributes END,
    floor_plans          = CASE WHEN p_patch ? 'floor_plans'          THEN p_patch->'floor_plans'          ELSE floor_plans END,
    videos               = CASE WHEN p_patch ? 'videos'               THEN p_patch->'videos'               ELSE videos END,
    edited_fields        = COALESCE(v_edited, '[]'),
    status               = CASE WHEN status = 'scraped' THEN 'edited' ELSE status END,
    updated_at           = now()
  WHERE id = p_id;

  RETURN json_build_object('ok', true);
END;
$function$;

NOTIFY pgrst, 'reload schema';
