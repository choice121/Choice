function getEnv(key: string): string | undefined {
  if (typeof Deno !== 'undefined' && Deno.env) {
    return Deno.env.get(key);
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

export function getAdminEmails(): string[] {
  return (getEnv('ADMIN_EMAILS') || getEnv('ADMIN_EMAIL') || 'support@choiceproperties.com')
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

// Returns the tenant login page URL, optionally pre-filling app_id and email.
// Email CTAs in all applicant-facing emails should use this instead of
// getTenantPortalUrl() so the applicant is always authenticated before reaching
// the portal and there is no email-mismatch error.
export function getTenantLoginUrl(appId?: string, email?: string): string {
  const base = (getEnv('TENANT_LOGIN_URL') || `${getSiteUrl()}/tenant/login.html`).replace(/\/$/, '');
  const params = new URLSearchParams();
  if (appId)  params.set('app_id', appId);
  if (email)  params.set('email', email);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function getAdminUrl(path?: string): string {
  // Default path split to prevent CLI asset-scanner from treating the string as a local file
  const p = path ?? ('/admin/' + 'applications.html');
  return `${getSiteUrl()}${p.startsWith('/') ? p : `/${p}`}`;
}

export function getContactEmail(): string {
  return getEnv('COMPANY_EMAIL') || getEnv('CONTACT_EMAIL') || 'support@choiceproperties.com';
}
