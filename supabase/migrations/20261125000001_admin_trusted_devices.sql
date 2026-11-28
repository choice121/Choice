-- Choice Properties — Admin Trusted Devices (2-Digit Device-Bound Quick PIN)
-- Stores cryptographic hashes of per-device HttpOnly tokens and 2-digit PINs.
-- Strictly server-side / service_role only; never exposed to anon or authenticated clients.

CREATE TABLE IF NOT EXISTS public.admin_trusted_devices (
  id              uuid PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label           text NOT NULL DEFAULT 'Trusted Device',
  token_hash      text NOT NULL,
  pin_hash        text NOT NULL,
  pin_salt        text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  revoked_at      timestamptz NULL,
  revoked_reason  text NULL,
  last_used_at    timestamptz NULL,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_trusted_devices_user_id
  ON public.admin_trusted_devices (user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.admin_trusted_devices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_trusted_devices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_trusted_devices TO service_role;
