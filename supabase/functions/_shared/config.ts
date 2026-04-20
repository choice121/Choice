export function getAdminEmails(): string[] {
  return (Deno.env.get('ADMIN_EMAILS') || Deno.env.get('ADMIN_EMAIL') || 'support@choiceproperties.com')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

export function getSiteUrl(): string {
  return (Deno.env.get('SITE_URL') || Deno.env.get('PUBLIC_SITE_URL') || 'https://choice-properties-site.pages.dev').replace(/\/$/, '');
}

export function getTenantPortalUrl(): string {
  return (Deno.env.get('TENANT_PORTAL_URL') || `${getSiteUrl()}/tenant/portal.html`).replace(/\/$/, '');
}

export function getAdminUrl(path = '/admin/applications.html'): string {
  return `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getContactEmail(): string {
  return Deno.env.get('COMPANY_EMAIL') || Deno.env.get('CONTACT_EMAIL') || 'support@choiceproperties.com';
}
