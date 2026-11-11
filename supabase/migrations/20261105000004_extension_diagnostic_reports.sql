CREATE TABLE IF NOT EXISTS public.extension_diagnostic_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_version text NOT NULL,
  source text NOT NULL,
  source_url text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  diagnostic jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS extension_diagnostic_reports_created_at_idx
  ON public.extension_diagnostic_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS extension_diagnostic_reports_expires_at_idx
  ON public.extension_diagnostic_reports (expires_at);

ALTER TABLE public.extension_diagnostic_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.extension_diagnostic_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.extension_diagnostic_reports TO service_role;

COMMENT ON TABLE public.extension_diagnostic_reports IS
  'Privacy-minimized browser extension extraction diagnostics. Reports are available to admins and expire after 30 days.';
