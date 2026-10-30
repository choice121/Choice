-- Provision apartment unit layouts and restrict public access to active listings and safe fields.
CREATE TABLE IF NOT EXISTS public.property_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_number text,
  bedrooms numeric,
  bathrooms numeric,
  square_footage integer,
  monthly_rent integer NOT NULL,
  security_deposit integer,
  available_date date,
  status text,
  floor_plan_name text,
  floor_plan_image_url text,
  unit_photos jsonb DEFAULT '[]'::jsonb,
  amenities text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.property_units
  ADD COLUMN IF NOT EXISTS unit_number text,
  ADD COLUMN IF NOT EXISTS bedrooms numeric,
  ADD COLUMN IF NOT EXISTS bathrooms numeric,
  ADD COLUMN IF NOT EXISTS square_footage integer,
  ADD COLUMN IF NOT EXISTS monthly_rent integer,
  ADD COLUMN IF NOT EXISTS security_deposit integer,
  ADD COLUMN IF NOT EXISTS available_date date,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS floor_plan_name text,
  ADD COLUMN IF NOT EXISTS floor_plan_image_url text,
  ADD COLUMN IF NOT EXISTS unit_photos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS amenities text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.property_units
  ALTER COLUMN unit_number DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_units_property_unit_number
  ON public.property_units(property_id, unit_number);
CREATE INDEX IF NOT EXISTS idx_property_units_property_id
  ON public.property_units(property_id);

ALTER TABLE public.property_units ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.property_units FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  property_id,
  unit_number,
  bedrooms,
  bathrooms,
  square_footage,
  monthly_rent,
  floor_plan_name,
  floor_plan_image_url,
  unit_photos,
  amenities
) ON TABLE public.property_units TO anon, authenticated;
GRANT ALL ON TABLE public.property_units TO service_role;

DROP POLICY IF EXISTS "Public read property units" ON public.property_units;
DROP POLICY IF EXISTS "Authenticated users manage property units" ON public.property_units;
DROP POLICY IF EXISTS "Service role manages property units" ON public.property_units;
DROP POLICY IF EXISTS property_units_read_active_properties ON public.property_units;

CREATE POLICY property_units_read_active_properties
  ON public.property_units
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties AS property
      WHERE property.id = property_units.property_id
        AND property.status = 'active'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_units_property_unit_number
  ON public.property_units(property_id, unit_number);
