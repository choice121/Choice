-- 20260425000005 — fix generate_lease_tokens
--
-- Bug: SECURITY DEFINER fn was set to `search_path = public, pg_temp`,
-- which excludes the `extensions` schema where pgcrypto's
-- `gen_random_bytes(integer)` lives. As a result, every call to
-- `supabase.rpc('generate_lease_tokens', …)` from the `generate-lease`
-- edge function was failing with:
--   "Token generation failed: function gen_random_bytes(integer) does not exist"
-- which silently broke the entire lease pipeline (no token issued,
-- lease_status never moved to 'sent', no email sent to the tenant).
--
-- Fix: fully qualify the call as `extensions.gen_random_bytes(…)` so
-- the function works regardless of search_path. We keep the restricted
-- search_path for security.

CREATE OR REPLACE FUNCTION public.generate_lease_tokens(p_app_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  app_rec RECORD;
  tenant_token TEXT;
  co_token TEXT;
BEGIN
  SELECT * INTO app_rec FROM applications WHERE app_id = p_app_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Application not found."}'::JSONB;
  END IF;

  -- Generate cryptographically secure random tokens (64 hex chars each).
  -- Schema-qualify because extensions is not on this fn's search_path.
  tenant_token := encode(extensions.gen_random_bytes(32), 'hex');

  IF app_rec.has_co_applicant THEN
    co_token := encode(extensions.gen_random_bytes(32), 'hex');
  ELSE
    co_token := NULL;
  END IF;

  UPDATE applications SET
    tenant_sign_token        = tenant_token,
    co_applicant_lease_token = co_token,
    lease_status             = 'sent',
    lease_sent_date          = now(),
    updated_at               = now()
  WHERE app_id = p_app_id;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_token', tenant_token,
    'co_applicant_token', co_token
  );
END;
$function$;
