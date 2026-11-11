import { getSiteUrl, getTenantLoginUrl } from './config.ts';

export interface MagicLoginOptions {
  next?: string;
  appId?: string;
}

// Mint a one-click sign-in URL that drops the applicant straight into
// /tenant/portal.html via /auth/callback.html — no email + magic-link round
// trip required. Used for the post-apply success card and every applicant-
// facing notification email so the portal is always one tap away.
//
// The returned URL points at Supabase's /auth/v1/verify endpoint; clicking
// it consumes a one-time token_hash, sets the session cookie, and 302s to
// our /auth/callback.html?next=<portal>. The existing callback page already
// handles every error mode (expired, already-used, cross-browser).
//
// Fails open: any error returns the regular tenant-login URL so an email is
// never broken — the worst case is the legacy "enter your email" flow.
export async function generateMagicLoginUrl(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  email: string,
  opts: MagicLoginOptions = {},
): Promise<string> {
  const fallback = getTenantLoginUrl(opts.appId, email);
  if (!email) return fallback;

  try {
    const siteUrl = getSiteUrl();
    const next = opts.next || (opts.appId
      ? `/tenant/portal.html?app_id=${encodeURIComponent(opts.appId)}`
      : '/tenant/portal.html');
    const redirectTo = `${siteUrl}/auth/callback.html?next=${encodeURIComponent(next)}`;

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });

    const actionLink = data?.properties?.action_link;
    if (error || !actionLink) {
      console.error(
        'generateMagicLoginUrl: no action_link returned',
        error?.message || '(no error message)',
      );
      return fallback;
    }
    return actionLink;
  } catch (e) {
    console.error('generateMagicLoginUrl threw:', (e as Error)?.message || String(e));
    return fallback;
  }
}
