ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS unit_floor text;

GRANT SELECT (unit_floor) ON public.properties TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.property_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('photo', 'floor_plan', 'video', 'virtual_tour', 'tour_3d')),
  title text NOT NULL DEFAULT 'Media',
  floor_label text,
  provider text,
  url text NOT NULL,
  file_id text,
  poster_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_hero boolean NOT NULL DEFAULT false,
  width integer,
  height integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_media
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Media',
  ADD COLUMN IF NOT EXISTS floor_label text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS file_id text,
  ADD COLUMN IF NOT EXISTS poster_url text,
  ADD COLUMN IF NOT EXISTS is_hero boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.property_media
SET title = CASE kind
  WHEN 'floor_plan' THEN 'Floor plan'
  WHEN 'video' THEN 'Video walkthrough'
  ELSE '3D virtual tour'
END
WHERE title = 'Media';

CREATE INDEX IF NOT EXISTS idx_property_media_property_order
  ON public.property_media(property_id, display_order, created_at);

ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_media FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.property_media TO anon, authenticated;
GRANT ALL ON public.property_media TO service_role;

DROP POLICY IF EXISTS property_media_read_active_listings ON public.property_media;
CREATE POLICY property_media_read_active_listings
  ON public.property_media
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties AS property
      WHERE property.id = property_media.property_id
        AND property.status = 'active'
    )
  );

INSERT INTO public.property_media (property_id, kind, title, url, display_order)
SELECT property.id, 'virtual_tour', '3D virtual tour', property.virtual_tour_url, 0
FROM public.properties AS property
WHERE property.virtual_tour_url IS NOT NULL
  AND btrim(property.virtual_tour_url) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.property_media AS media
    WHERE media.property_id = property.id
      AND media.kind = 'virtual_tour'
      AND media.url = property.virtual_tour_url
  );