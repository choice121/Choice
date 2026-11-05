CREATE TABLE IF NOT EXISTS public.zillow_gallery_reference_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  report jsonb NOT NULL,
  read_token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zillow_gallery_reference_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.zillow_gallery_reference_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.zillow_gallery_reference_reports TO service_role;

COMMENT ON TABLE public.zillow_gallery_reference_reports IS
  'Admin-submitted, privacy-minimized Zillow gallery layout snapshots. Reports contain measured visible UI metadata only; a random bearer link grants read-only access.';

COMMENT ON COLUMN public.zillow_gallery_reference_reports.read_token_hash IS
  'SHA-256 of a 256-bit read token returned once to the extension; the raw bearer token is never stored.';
