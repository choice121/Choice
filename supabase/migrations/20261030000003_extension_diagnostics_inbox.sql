CREATE TABLE IF NOT EXISTS public.extension_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_url text NOT NULL,
  extension_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_extension_diagnostics_created_at
  ON public.extension_diagnostics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_extension_diagnostics_expires_at
  ON public.extension_diagnostics(expires_at);

ALTER TABLE public.extension_diagnostics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.extension_diagnostics FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.extension_diagnostics TO service_role;

COMMENT ON TABLE public.extension_diagnostics IS
  'Opt-in, privacy-filtered browser-extension extraction diagnostics. Reports expire after 30 days.';
