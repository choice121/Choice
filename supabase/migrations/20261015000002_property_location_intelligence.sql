CREATE TABLE IF NOT EXISTS public.property_location_intelligence (
  property_id text PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS property_location_intelligence_expires_at_idx
  ON public.property_location_intelligence (expires_at);

ALTER TABLE public.property_location_intelligence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_location_intelligence FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.property_location_intelligence TO service_role;

COMMENT ON TABLE public.property_location_intelligence IS
  'Server-cached third-party nearby-place and reverse-geocoding snapshots. Access is restricted to service_role.';

COMMENT ON COLUMN public.property_location_intelligence.data IS
  'Sanitized Geoapify location snapshot; distances are straight-line approximations and are not walk or drive times.';
