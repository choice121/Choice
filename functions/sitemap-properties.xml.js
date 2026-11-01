// ============================================================
// Pages Function: /sitemap-properties.xml
// ============================================================
// Dynamic sitemap of every active property — Phase C of the
// Properties improvement plan (.local/plans/properties/).
//
// Reads the live `properties` table (anon key, RLS-protected to
// status='active' rows) and emits an XML sitemap that points
// every active listing's canonical slug URL.
//
// Cached at the edge for 1 hour; cache busted by the property
// update webhook (see Phase H, future work).
// ============================================================

const SLUG_MAX = 60;

function escXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugifySegment(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX);
}

function bedsLabel(b) {
  if (b == null) return 'home';
  if (Number(b) === 0) return 'studio';
  return `${Number(b)}br`;
}

function buildPropertyPath(p) {
  const state = (p.state || '').toLowerCase().slice(0, 2);
  const city = slugifySegment(p.city) || 'us';
  const beds = bedsLabel(p.bedrooms);
  const type = slugifySegment(p.property_type) || 'home';
  const idLow = String(p.id || '').toLowerCase();
  return `/rent/${state}/${city}/${beds}-${type}-${idLow}/`;
}

export async function onRequestGet({ env, request }) {
  const SUPA = env.SUPABASE_URL;
  const ANON = env.SUPABASE_ANON_KEY;
  const SITE = env.SITE_URL || new URL(request.url).origin;

  if (!SUPA || !ANON) {
    return new Response('Sitemap unavailable: backend not configured', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  let rows = [];
  try {
    // Page through to be safe even if active count grows past the
    // PostgREST 1000-row default. Two pages of 1000 covers ~2000
    // active listings; loop again if we ever blow past that.
    for (let from = 0; from < 5000; from += 1000) {
      const res = await fetch(
        `${SUPA}/rest/v1/properties?status=eq.active` +
          `&select=id,city,state,bedrooms,property_type,updated_at` +
          `&order=updated_at.desc`,
        {
          headers: {
            apikey: ANON,
            Authorization: `Bearer ${ANON}`,
            Range: `${from}-${from + 999}`,
            'Range-Unit': 'items',
          },
        }
      );
      if (!res.ok) break;
      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      rows = rows.concat(batch);
      if (batch.length < 1000) break;
    }
  } catch (e) {
    return new Response(`Sitemap fetch failed: ${e.message}`, {
      status: 502,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const urls = rows
    .map(p => {
      const loc = `${SITE}${buildPropertyPath(p)}`;
      const lastmod = (p.updated_at || '').slice(0, 10);
      return (
        `  <url>\n` +
        `    <loc>${escXml(loc)}</loc>\n` +
        (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') +
        `    <changefreq>weekly</changefreq>\n` +
        `    <priority>0.7</priority>\n` +
        `  </url>`
      );
    })
    .join('\n');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- ${rows.length} active properties — generated at ${new Date().toISOString()} -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      'x-row-count': String(rows.length),
    },
  });
}
