-- Explicit public allow-list for rental listings. Source URLs, scraper poster
-- metadata, internal notes, and lease-duration fields stay out of this view.
DROP VIEW IF EXISTS public.properties_public;
CREATE VIEW public.properties_public
WITH (security_barrier = true)
AS
SELECT
  id,
  landlord_id,
  status,
  title,
  description,
  address,
  city,
  state,
  zip,
  county,
  property_type,
  year_built,
  floors,
  unit_number,
  total_units,
  bedrooms,
  bathrooms,
  half_bathrooms,
  total_bathrooms,
  square_footage,
  lot_size_sqft,
  garage_spaces,
  monthly_rent,
  security_deposit,
  last_months_rent,
  application_fee,
  pet_deposit,
  admin_fee,
  move_in_special,
  available_date,
  pets_allowed,
  pet_types_allowed,
  pet_weight_limit,
  pet_details,
  utilities_included,
  parking,
  parking_fee,
  amenities,
  appliances,
  flooring,
  heating_type,
  cooling_type,
  laundry_type,
  virtual_tour_url,
  views_count,
  applications_count,
  saves_count,
  created_at,
  updated_at,
  has_central_air,
  has_basement,
  location_context,
  neighborhood,
  building_name,
  is_multi_unit,
  featured,
  listed_at,
  parent_property_id,
  search_tsv
FROM public.properties
WHERE status = 'active';

ALTER VIEW public.properties_public OWNER TO postgres;
GRANT SELECT ON public.properties_public TO anon, authenticated;

COMMENT ON VIEW public.properties_public IS
  'Public listing allow-list. Never expose source URLs, scraper poster contact metadata, internal notes, or lease-duration fields here.';