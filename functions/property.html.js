// ============================================================
// Pages Function: /property.html
// ============================================================
// Legacy URL handler. The original detail-page URL was
// `/property.html?id=PROP-XXXXXXXX`. Phase C introduced
// keyword-rich slug URLs at `/rent/<state>/<city>/<slug>/`.
// To preserve inbound link equity (back-links, social shares,
// bookmarks), this Function 301-redirects requests carrying
// the legacy `?id=` query parameter to the canonical slug URL.
//
// Anything else hitting /property.html (e.g. `?preview=true`
// from the landlord new-listing flow, or the bare URL) is
// passed through unchanged so existing in-app behavior is
// preserved.
// ============================================================

const ID_RE = /^PROP-[A-Z0-9]{8}$/i;

function slugSeg(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();

  // No `?id=` (or `?preview=true`, `?utm_*` etc) → fall through to
  // the static asset.
  if (!id || !ID_RE.test(id)) {
    return env.ASSETS.fetch(request);
  }

  const SUPA = env.SUPABASE_URL;
  const ANON = env.SUPABASE_ANON_KEY;
  const SITE = env.SITE_URL || url.origin;

  // Backend not configured? Degrade gracefully — keep the old URL working.
  if (!SUPA || !ANON) return env.ASSETS.fetch(request);

  // Look up the row to build the canonical slug.
  const res = await fetch(
    `${SUPA}/rest/v1/properties?id=eq.${encodeURIComponent(id.toUpperCase())}` +
      `&status=eq.active&select=id,city,state,bedrooms,property_type`,
    { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }
  );

  // If the property is not active or doesn't exist, fall through so
  // the static page (which itself shows a "not found" toast) handles
  // it. Avoids an empty 301 chain.
  if (!res.ok) return env.ASSETS.fetch(request);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return env.ASSETS.fetch(request);
  const p = rows[0];

  const beds = p.bedrooms == null ? 'home' : (p.bedrooms === 0 ? 'studio' : `${p.bedrooms}br`);
  const path =
    `/rent/${(p.state || '').toLowerCase().slice(0, 2)}` +
    `/${slugSeg(p.city) || 'us'}` +
    `/${beds}-${slugSeg(p.property_type) || 'home'}-${String(p.id).toLowerCase()}/`;

  // Forward any extra query params (utm_*, ref, etc.) so analytics
  // attribution survives the redirect, but drop the legacy `id`.
  url.searchParams.delete('id');
  const extra = url.searchParams.toString();
  const target = `${SITE}${path}${extra ? '?' + extra : ''}`;

  return new Response(null, {
    status: 301,
    headers: {
      location: target,
      'cache-control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
