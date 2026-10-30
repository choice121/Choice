CREATE TABLE IF NOT EXISTS public.property_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  building_code text,
  sort_order integer NOT NULL DEFAULT 0,
  amenities text[] NOT NULL DEFAULT ARRAY[]::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_buildings_id_property_id_key UNIQUE (id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_buildings_property_order
  ON public.property_buildings(property_id, sort_order, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_buildings_property_code
  ON public.property_buildings(property_id, building_code)
  WHERE building_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.property_floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL,
  building_id uuid NOT NULL,
  floor_label text NOT NULL,
  floor_code text,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_floors_building_property_fkey
    FOREIGN KEY (building_id, property_id)
    REFERENCES public.property_buildings(id, property_id)
    ON DELETE CASCADE,
  CONSTRAINT property_floors_id_property_building_key
    UNIQUE (id, property_id, building_id)
);

CREATE INDEX IF NOT EXISTS idx_property_floors_building_order
  ON public.property_floors(building_id, sort_order, floor_label);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_floors_building_code
  ON public.property_floors(building_id, floor_code)
  WHERE floor_code IS NOT NULL;

ALTER TABLE public.property_units
  ADD COLUMN IF NOT EXISTS building_id uuid,
  ADD COLUMN IF NOT EXISTS floor_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.property_units'::regclass
      AND conname = 'property_units_building_property_fkey'
  ) THEN
    ALTER TABLE public.property_units
      ADD CONSTRAINT property_units_building_property_fkey
      FOREIGN KEY (building_id, property_id)
      REFERENCES public.property_buildings(id, property_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.property_units'::regclass
      AND conname = 'property_units_floor_property_building_fkey'
  ) THEN
    ALTER TABLE public.property_units
      ADD CONSTRAINT property_units_floor_property_building_fkey
      FOREIGN KEY (floor_id, property_id, building_id)
      REFERENCES public.property_floors(id, property_id, building_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.property_units'::regclass
      AND conname = 'property_units_floor_requires_building_check'
  ) THEN
    ALTER TABLE public.property_units
      ADD CONSTRAINT property_units_floor_requires_building_check
      CHECK (floor_id IS NULL OR building_id IS NOT NULL);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_property_units_building_floor
  ON public.property_units(building_id, floor_id, unit_number);

GRANT SELECT (building_id, floor_id)
  ON TABLE public.property_units TO anon, authenticated;

ALTER TABLE public.property_media
  ADD COLUMN IF NOT EXISTS building_id uuid,
  ADD COLUMN IF NOT EXISTS floor_id uuid,
  ADD COLUMN IF NOT EXISTS unit_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_units_id_property
  ON public.property_units(id, property_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.property_media'::regclass
      AND conname = 'property_media_building_property_fkey'
  ) THEN
    ALTER TABLE public.property_media
      ADD CONSTRAINT property_media_building_property_fkey
      FOREIGN KEY (building_id, property_id)
      REFERENCES public.property_buildings(id, property_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.property_media'::regclass
      AND conname = 'property_media_floor_property_building_fkey'
  ) THEN
    ALTER TABLE public.property_media
      ADD CONSTRAINT property_media_floor_property_building_fkey
      FOREIGN KEY (floor_id, property_id, building_id)
      REFERENCES public.property_floors(id, property_id, building_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.property_media'::regclass
      AND conname = 'property_media_unit_property_fkey'
  ) THEN
    ALTER TABLE public.property_media
      ADD CONSTRAINT property_media_unit_property_fkey
      FOREIGN KEY (unit_id, property_id)
      REFERENCES public.property_units(id, property_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.property_media'::regclass
      AND conname = 'property_media_single_scope_check'
  ) THEN
    ALTER TABLE public.property_media
      ADD CONSTRAINT property_media_single_scope_check
      CHECK (
        (unit_id IS NULL OR (building_id IS NULL AND floor_id IS NULL))
        AND (floor_id IS NULL OR building_id IS NOT NULL)
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_property_media_building_order
  ON public.property_media(building_id, display_order)
  WHERE building_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_media_floor_order
  ON public.property_media(floor_id, display_order)
  WHERE floor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_media_unit_order
  ON public.property_media(unit_id, display_order)
  WHERE unit_id IS NOT NULL;

GRANT SELECT (building_id, floor_id, unit_id)
  ON TABLE public.property_media TO anon, authenticated;

ALTER TABLE public.property_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_floors ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.property_buildings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.property_floors FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, property_id, name, building_code, sort_order, amenities)
  ON TABLE public.property_buildings TO anon, authenticated;
GRANT SELECT (id, property_id, building_id, floor_label, floor_code, sort_order)
  ON TABLE public.property_floors TO anon, authenticated;
GRANT ALL ON TABLE public.property_buildings TO service_role;
GRANT ALL ON TABLE public.property_floors TO service_role;

DROP POLICY IF EXISTS property_buildings_read_active_listings ON public.property_buildings;
CREATE POLICY property_buildings_read_active_listings
  ON public.property_buildings
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties AS property
      WHERE property.id = property_buildings.property_id
        AND property.status = 'active'
    )
  );

DROP POLICY IF EXISTS property_floors_read_active_listings ON public.property_floors;
CREATE POLICY property_floors_read_active_listings
  ON public.property_floors
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties AS property
      WHERE property.id = property_floors.property_id
        AND property.status = 'active'
    )
  );
