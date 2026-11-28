-- ============================================================
-- Choice Properties — Migration: Sort pipeline_list by import recency
-- ============================================================
-- Previously public.pipeline_list ordered by:
--   ORDER BY COALESCE(listed_at, imported_at, scraped_at::timestamptz) DESC NULLS LAST
-- Because Zillow/Realtor listings frequently carry an older source `listed_at`
-- date (weeks or months old), newly saved listings were sorted below older
-- imports or onto later pagination pages — causing users to think their
-- save disappeared from Admin Pipeline while re-saving returned
-- "Already in pipeline".
--
-- Ordering by COALESCE(imported_at, scraped_at::timestamptz) DESC NULLS LAST, id DESC
-- guarantees the most recently saved listing always appears first at the top
-- of Admin Pipeline.

CREATE OR REPLACE FUNCTION public.pipeline_list(
  p_status text DEFAULT 'scraped'::text,
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $function$
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
      monthly_rent, security_deposit, last_months_rent,
      application_fee, pet_deposit, admin_fee, parking_fee,
      hoa_fee, hoa_fee_frequency, tax_annual_amount, tax_value, move_in_special,
      property_type, property_subtype, year_built,
      description, original_description, showing_instructions,
      pets_allowed, pet_types_allowed, pet_weight_limit, pet_details,
      smoking_allowed, available_date, minimum_lease_months, lease_terms,
      parking, amenities, appliances, utilities_included, flooring,
      heating_type, cooling_type, laundry_type, ev_charging,
      virtual_tour_url, has_basement, has_central_air,
      data_quality_score, missing_fields, edited_fields,
      original_image_urls, local_image_paths,
      source_url, source, source_listing_id, agent_name, broker_name,
      poster_landlord_id, choice_property_id, batch_id,
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
$function$;
