import { getDirectTenantPortalUrl } from './config.ts';

export interface MagicLoginOptions {
  next?: string;
  appId?: string;
  applicantId?: string;
}

// Returns a clean, reusable direct portal URL that establishes the applicant's
// session on click via /api/tenant/auto-login without single-use link expiry
// or corporate email-scanner pre-fetch invalidation.
export async function generateMagicLoginUrl(
  // deno-lint-ignore no-explicit-any
  _supabase: any,
  email: string,
  opts: MagicLoginOptions = {},
): Promise<string> {
  return getDirectTenantPortalUrl(opts.appId, {
    applicantId: opts.applicantId,
    email,
    next: opts.next,
  });
}
