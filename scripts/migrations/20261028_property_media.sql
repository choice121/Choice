-- Migration: unified property media for floor plans, videos, and tours
CREATE TABLE IF NOT EXISTS public.property_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('photo','floor_plan','video','virtual_tour','tour_3d')),
  url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1,
  is_hero BOOLEAN NOT NULL DEFAULT FALSE,
  width INTEGER,
  height INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_property_media_property ON public.property_media(property_id, kind, display_order);

-- Backfill existing virtual_tour_url into property_media (idempotent)
INSERT INTO public.property_media (property_id, kind, url, display_order, is_hero)
SELECT id, 'virtual_tour', virtual_tour_url, 1, FALSE
FROM public.properties
WHERE virtual_tour_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.property_media pm
    WHERE pm.property_id = properties.id AND pm.kind = 'virtual_tour' AND pm.url = properties.virtual_tour_url
  );
