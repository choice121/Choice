-- ============================================================
-- 20260929000001 — centralized source identity contract
-- ============================================================
-- Source classification is a data-integrity rule, not a UI convention.
-- The trigger below is a database backstop for legacy/Python importers that
-- write directly to pipeline.pipeline_properties.

CREATE TABLE IF NOT EXISTS public.source_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  profile_key TEXT NOT NULL,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('agent', 'company')),
  display_name TEXT NOT NULL,
  image_url TEXT,
  profile_url TEXT,
  website_url TEXT,
  description TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, profile_key)
);

ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS identity_strategy TEXT,
  ADD COLUMN IF NOT EXISTS identity_status TEXT DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS source_profile_id UUID REFERENCES public.source_profiles(id),
  ADD COLUMN IF NOT EXISTS source_profile_type TEXT,
  ADD COLUMN IF NOT EXISTS source_profile_name TEXT,
  ADD COLUMN IF NOT EXISTS source_profile_image_url TEXT,
  ADD COLUMN IF NOT EXISTS source_profile_url TEXT,
  ADD COLUMN IF NOT EXISTS agent_profile_url TEXT;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_listing_id TEXT,
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_image_url TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS identity_strategy TEXT,
  ADD COLUMN IF NOT EXISTS identity_status TEXT DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS source_profile_id UUID REFERENCES public.source_profiles(id),
  ADD COLUMN IF NOT EXISTS source_profile_type TEXT,
  ADD COLUMN IF NOT EXISTS source_profile_name TEXT,
  ADD COLUMN IF NOT EXISTS source_profile_image_url TEXT,
  ADD COLUMN IF NOT EXISTS source_profile_url TEXT,
  ADD COLUMN IF NOT EXISTS agent_profile_url TEXT;

CREATE INDEX IF NOT EXISTS source_profiles_source_key_idx
  ON public.source_profiles (source, profile_key);

CREATE INDEX IF NOT EXISTS pipeline_properties_identity_idx
  ON pipeline.pipeline_properties (source, identity_strategy, source_profile_id);

CREATE INDEX IF NOT EXISTS properties_identity_idx
  ON public.properties (source, identity_strategy, source_profile_id);

GRANT SELECT (
  id, source, profile_type, display_name, image_url, profile_url,
  website_url, description, first_seen_at, last_seen_at
) ON public.source_profiles TO anon, authenticated;

-- This function intentionally uses a small, explicit source policy. It is a
-- fallback for direct REST importers; the shared TypeScript builder supplies
-- the same fields for Edge Function imports.
CREATE OR REPLACE FUNCTION public.apply_source_identity_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  v_source TEXT := lower(coalesce(NEW.source, 'unknown'));
  v_strategy TEXT := 'UNKNOWN_REVIEW';
  v_type TEXT := 'UNKNOWN';
  v_profile_type TEXT := NULL;
  v_profile_name TEXT := NULL;
  v_profile_key TEXT := NULL;
  v_profile_image TEXT := NULL;
  v_profile_url TEXT := NULL;
  v_profile_id UUID := NULL;
BEGIN
  IF v_source IN ('progress', 'progress-residential') THEN
    v_source := 'progress_residential';
  ELSIF v_source IN ('invitation', 'invitation-homes', 'invitation homes') THEN
    v_source := 'invitation_homes';
  ELSIF v_source IN ('main-street-renewal', 'main street renewal', 'mainstreetrenewal') THEN
    v_source := 'main_street_renewal';
  ELSIF v_source IN ('cjrealestate', 'cj', 'cj properties', 'cj realty') THEN
    v_source := 'cj_real_estate';
  END IF;
  NEW.source := v_source;

  IF v_source = 'opendoor' THEN
    -- Explicit special-case invariant: no poster, agent, landlord, or
    -- profile is ever inferred for Opendoor at this stage.
    NEW.source_type := 'SPECIAL_CASE';
    NEW.identity_strategy := 'NO_IDENTITY';
    NEW.identity_status := 'unavailable';
    NEW.source_profile_id := NULL;
    NEW.source_profile_type := NULL;
    NEW.source_profile_name := NULL;
    NEW.source_profile_image_url := NULL;
    NEW.source_profile_url := NULL;
    NEW.agent_name := NULL;
    NEW.agent_image_url := NULL;
    NEW.agent_profile_url := NULL;
    NEW.poster_landlord_id := NULL;
    RETURN NEW;
  END IF;

  IF v_source IN ('progress_residential', 'invitation_homes', 'main_street_renewal', 'cj_real_estate') THEN
    v_type := 'DIRECT_PROPERTY_COMPANY';
    v_strategy := 'COMPANY_SOURCE';
    v_profile_type := 'company';
    v_profile_name := coalesce(
      nullif(trim(NEW.source_profile_name), ''),
      nullif(trim(NEW.broker_name), ''),
      CASE v_source
        WHEN 'progress_residential' THEN 'Progress Residential'
        WHEN 'invitation_homes' THEN 'Invitation Homes'
        WHEN 'main_street_renewal' THEN 'Main Street Renewal'
        WHEN 'cj_real_estate' THEN 'CJ Real Estate'
      END
    );
    NEW.agent_name := NULL;
    NEW.agent_image_url := NULL;
    NEW.agent_profile_url := NULL;
    NEW.poster_landlord_id := NULL;
  ELSIF v_source IN ('zillow', 'realtor') OR
        nullif(trim(NEW.agent_name), '') IS NOT NULL OR
        nullif(trim(NEW.agent_profile_url), '') IS NOT NULL THEN
    v_type := 'AGENT_PLATFORM';
    v_strategy := 'AGENT_POSTER';
    v_profile_type := 'agent';
    v_profile_name := nullif(trim(NEW.agent_name), '');
  ELSIF v_source IN ('apartments', 'redfin') THEN
    v_type := 'AGGREGATOR';
    v_strategy := 'UNKNOWN_REVIEW';
  END IF;

  NEW.source_type := coalesce(NEW.source_type, v_type);
  NEW.identity_strategy := coalesce(NEW.identity_strategy, v_strategy);
  NEW.source_profile_type := coalesce(NEW.source_profile_type, v_profile_type);
  NEW.source_profile_name := coalesce(NEW.source_profile_name, v_profile_name);
  NEW.identity_status := coalesce(
    NEW.identity_status,
    CASE
      WHEN v_profile_name IS NOT NULL THEN 'confirmed'
      WHEN v_strategy = 'UNKNOWN_REVIEW' THEN 'review'
      ELSE 'unavailable'
    END
  );

  IF NEW.identity_strategy IN ('AGENT_POSTER', 'COMPANY_SOURCE')
     AND nullif(trim(NEW.source_profile_name), '') IS NOT NULL THEN
    v_profile_key := md5(
      v_source || '|' || lower(trim(NEW.source_profile_type)) || '|' ||
      lower(trim(NEW.source_profile_name)) || '|' ||
      lower(coalesce(trim(NEW.broker_name), ''))
    );
    v_profile_image := nullif(trim(NEW.source_profile_image_url), '');
    v_profile_url := nullif(trim(NEW.source_profile_url), '');

    INSERT INTO public.source_profiles (
      source, profile_key, profile_type, display_name, image_url, profile_url,
      last_seen_at, updated_at
    ) VALUES (
      v_source, v_profile_key, NEW.source_profile_type, NEW.source_profile_name,
      v_profile_image, v_profile_url, now(), now()
    )
    ON CONFLICT (source, profile_key) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      image_url = coalesce(EXCLUDED.image_url, public.source_profiles.image_url),
      profile_url = coalesce(EXCLUDED.profile_url, public.source_profiles.profile_url),
      last_seen_at = now(),
      updated_at = now()
    RETURNING id INTO v_profile_id;

    IF v_profile_id IS NULL THEN
      SELECT id INTO v_profile_id
      FROM public.source_profiles
      WHERE source = v_source AND profile_key = v_profile_key;
    END IF;
    NEW.source_profile_id := v_profile_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pipeline_source_identity_contract
  ON pipeline.pipeline_properties;
CREATE TRIGGER pipeline_source_identity_contract
BEFORE INSERT OR UPDATE OF source, agent_name, broker_name,
  source_profile_name, source_profile_image_url, source_profile_url,
  poster_landlord_id
ON pipeline.pipeline_properties
FOR EACH ROW EXECUTE FUNCTION public.apply_source_identity_contract();

-- Public/admin list RPC includes structured identity and verification fields.
CREATE OR REPLACE FUNCTION public.pipeline_list(
  p_status text DEFAULT 'scraped',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      p.id, p.status, p.title, p.address, p.city, p.state, p.zip,
      p.bedrooms, p.bathrooms, p.square_footage, p.monthly_rent,
      p.property_type, p.year_built, p.unit_number,
      p.description, p.original_description, p.showing_instructions,
      p.pets_allowed, p.smoking_allowed, p.parking,
      p.minimum_lease_months, p.security_deposit, p.application_fee,
      p.garage_spaces, p.available_date, p.virtual_tour_url,
      p.has_basement, p.has_central_air,
      p.data_quality_score, p.missing_fields, p.edited_fields,
      p.original_image_urls, p.source_url, p.source, p.agent_name,
      p.broker_name, p.agent_image_url, p.agent_profile_url,
      p.poster_landlord_id, p.choice_property_id,
      p.source_type, p.identity_strategy, p.identity_status,
      p.source_profile_id, p.source_profile_type, p.source_profile_name,
      p.source_profile_image_url, p.source_profile_url,
      p.scraped_at, p.updated_at, p.published_at,
      p.neighborhood, p.county, p.location_context,
      p.listed_at, p.source_last_updated_at, p.imported_at,
      p.source_status, p.last_verified_at, p.lat, p.lng
    FROM pipeline.pipeline_properties p
    WHERE (p_status = 'all' OR p.status = p_status)
    ORDER BY COALESCE(p.listed_at, p.imported_at, p.scraped_at::timestamptz) DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pipeline_list(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pipeline_list(text, int, int) TO authenticated;

-- Publish copies the structured source identity into the public listing. The
-- existing landlord assignment remains available for manually managed listings,
-- but it is never used to invent a source identity.
CREATE OR REPLACE FUNCTION public.pipeline_publish(
  p_id text,
  p_landlord_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline
AS $$
DECLARE
  p pipeline.pipeline_properties%ROWTYPE;
  new_id text;
  v_avail date;
  v_listed date;
  v_imported_at timestamptz;
BEGIN
  SELECT * INTO p FROM pipeline.pipeline_properties WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Listing not found in pipeline');
  END IF;

  IF p.title IS NULL OR p.address IS NULL OR p.city IS NULL
     OR p.state IS NULL OR p.zip IS NULL OR p.monthly_rent IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Missing required fields: title, address, city, state, zip, monthly_rent');
  END IF;

  new_id := gen_random_uuid()::text;
  v_avail := CASE WHEN p.available_date IS NOT NULL
    AND p.available_date ~ '^\d{4}-\d{2}-\d{2}$'
    THEN p.available_date::date ELSE CURRENT_DATE END;
  -- A source listing date is optional evidence. Never substitute scrape/import
  -- time here, otherwise an unknown date is published as a fabricated "new"
  -- listing date.
  v_listed := CASE
    WHEN p.listed_at IS NOT NULL AND p.listed_at ~ '^\d{4}-\d{2}-\d{2}'
      THEN p.listed_at::date
    ELSE NULL
  END;
  v_imported_at := COALESCE(p.imported_at, p.scraped_at::timestamptz, now());

  INSERT INTO public.properties (
    id, landlord_id, status,
    title, description, showing_instructions,
    address, city, state, zip, county, neighborhood,
    lat, lng, property_type, year_built, floors,
    unit_number, total_units,
    bedrooms, bathrooms, half_bathrooms, square_footage,
    lot_size_sqft, garage_spaces,
    monthly_rent, security_deposit, last_months_rent,
    application_fee, pet_deposit, admin_fee, move_in_special,
    available_date, minimum_lease_months, lease_terms,
    pets_allowed, pet_details, pet_weight_limit, smoking_allowed,
    parking, parking_fee,
    amenities, appliances, utilities_included,
    heating_type, cooling_type, laundry_type,
    location_context, virtual_tour_url, has_basement, has_central_air,
    listed_at, source_last_updated_at, imported_at, source_status, last_verified_at,
    source, source_url, source_listing_id,
    source_type, identity_strategy, identity_status, source_profile_id,
    source_profile_type, source_profile_name, source_profile_image_url,
    source_profile_url, agent_name, agent_image_url, agent_profile_url
  ) VALUES (
    new_id, COALESCE(p_landlord_id, p.poster_landlord_id::uuid), 'active',
    p.title, p.description, p.showing_instructions,
    p.address, p.city, p.state, p.zip, p.county, p.neighborhood,
    p.lat, p.lng, p.property_type, p.year_built, p.floors,
    p.unit_number, p.total_units,
    p.bedrooms, p.bathrooms, p.half_bathrooms, p.square_footage,
    p.lot_size_sqft, p.garage_spaces,
    p.monthly_rent, COALESCE(p.security_deposit, p.monthly_rent), p.last_months_rent,
    50, p.pet_deposit, p.admin_fee, p.move_in_special,
    v_avail, NULL, NULL,
    true, p.pet_details, p.pet_weight_limit, false,
    p.parking, p.parking_fee,
    CASE WHEN p.amenities IS NOT NULL AND p.amenities NOT IN ('', '[]')
      THEN p.amenities::jsonb ELSE NULL END,
    CASE WHEN p.appliances IS NOT NULL AND p.appliances NOT IN ('', '[]')
      THEN p.appliances::jsonb ELSE NULL END,
    CASE WHEN p.utilities_included IS NOT NULL AND p.utilities_included NOT IN ('', '[]')
      THEN p.utilities_included::jsonb ELSE NULL END,
    p.heating_type, p.cooling_type, p.laundry_type,
    p.location_context, p.virtual_tour_url, COALESCE(p.has_basement, false),
    COALESCE(p.has_central_air, false),
    v_listed, p.source_last_updated_at, v_imported_at,
    COALESCE(p.source_status, 'available'), p.last_verified_at,
    p.source, p.source_url, p.source_listing_id,
    p.source_type, p.identity_strategy, p.identity_status, p.source_profile_id,
    p.source_profile_type, p.source_profile_name, p.source_profile_image_url,
    p.source_profile_url, p.agent_name, p.agent_image_url, p.agent_profile_url
  );

  UPDATE pipeline.pipeline_properties
  SET status = 'published',
      choice_property_id = new_id,
      imported_at = COALESCE(imported_at, now()),
      published_at = now()::text,
      updated_at = now()
  WHERE id = p_id;

  RETURN json_build_object('ok', true, 'choice_property_id', new_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pipeline_publish(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pipeline_publish(text, uuid) TO authenticated, service_role, anon;