// ============================================================
// Pages Function: /sitemap.xml
// ============================================================
// Root XML Sitemap Index that points crawlers to:
//   1. /sitemap-pages.xml      — static marketing & policy pages
//   2. /sitemap-properties.xml — dynamic active property listings
// ============================================================

export async function onRequestGet({ env, request }) {
  const SITE = (env.SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');
  const today = new Date().toISOString().slice(0, 10);

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <sitemap>\n` +
    `    <loc>${SITE}/sitemap-pages.xml</loc>\n` +
    `    <lastmod>${today}</lastmod>\n` +
    `  </sitemap>\n` +
    `  <sitemap>\n` +
    `    <loc>${SITE}/sitemap-properties.xml</loc>\n` +
    `    <lastmod>${today}</lastmod>\n` +
    `  </sitemap>\n` +
    `</sitemapindex>\n`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

