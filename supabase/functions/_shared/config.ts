type NodeGlobal = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

function getEnv(key: string): string | undefined {
  if (typeof Deno !== 'undefined' && Deno.env) {
    return Deno.env.get(key);
  }
  return (globalThis as NodeGlobal).process?.env?.[key];
}

export function getAdminEmails(): string[] {
  return (getEnv('ADMIN_EMAILS') || getEnv('ADMIN_EMAIL') || 'choiceproperties404@gmail.com')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

export function getSiteUrl(): string {
  return (getEnv('SITE_URL') || getEnv('PUBLIC_SITE_URL') || 'https://choice-properties-site.pages.dev').replace(/\/$/, '');
}

export function getTenantPortalUrl(): string {
  return (getEnv('TENANT_PORTAL_URL') || `${getSiteUrl()}/tenant/portal.html`).replace(/\/$/, '');
}

export function getDirectTenantPortalUrl(
  appId?: string,
  opts?: { applicantId?: string; email?: string; next?: string },
): string {
  const site = getSiteUrl();
  if (opts?.next && opts.next.startsWith('/')) {
    try {
      const u = new URL(opts.next, site);
      if (appId && !u.searchParams.has('app_id')) u.searchParams.set('app_id', appId);
      if (opts.applicantId && !u.searchParams.has('applicant_id')) u.searchParams.set('applicant_id', opts.applicantId);
      return u.toString();
    } catch {
      return `${site}${opts.next}`;
    }
  }
  const base = getTenantPortalUrl();
  const params = new URLSearchParams();
  if (appId) params.set('app_id', appId);
  if (opts?.applicantId) params.set('applicant_id', opts.applicantId);
  if (opts?.email && !appId) params.set('email', opts.email);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// Backward-compatible export kept for existing callers — now emits the
// direct passwordless auto-login portal URL instead of /tenant/login.html.
export function getTenantLoginUrl(appId?: string, email?: string): string {
  return getDirectTenantPortalUrl(appId, { email });
}

export function getAdminUrl(path?: string): string {
  // Default path split to prevent CLI asset-scanner from treating the string as a local file
  const p = path ?? ('/admin/' + 'applications.html');
  return `${getSiteUrl()}${p.startsWith('/') ? p : `/${p}`}`;
}

export function getContactEmail(): string {
  return getEnv('COMPANY_EMAIL') || getEnv('CONTACT_EMAIL') || 'choiceproperties404@gmail.com';
}
