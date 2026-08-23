// Choice Properties — Shared: Auth helpers
// Provides requireAuth() and requireAdmin() for Edge Functions.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors } from './cors.ts';

// The user shape exposed to callers. We surface only the fields callers
// actually use (id + email) so we are not leaking the full Supabase User
// object into the type system, but callers like revoke-signing-token can
// log the actor's email without a misleading `as any` cast.
export type AuthUser = { id: string; email?: string | null };

export type AuthResult =
  | { ok: true;  user: AuthUser; supabase: ReturnType<typeof createClient> }
  | { ok: false; response: Response };

// Returns a verified user + service-role supabase client,
// or a ready-to-return 401 Response if auth fails.
export async function requireAuth(req: Request): Promise<AuthResult> {
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      ),
    };
  }

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  );
  const { data: { user }, error: authErr } = await authClient.auth.getUser(jwt);

  if (authErr || !user) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      ),
    };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  return { ok: true, user, supabase };
}

// Like requireAuth, but also checks admin_roles and returns 403 if not admin.
export async function requireAdmin(req: Request): Promise<AuthResult> {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult;

  const { user, supabase } = authResult;
  const { data: adminRow } = await supabase
    .from('admin_roles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adminRow) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: 'Forbidden' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { ok: true, user, supabase };
}
