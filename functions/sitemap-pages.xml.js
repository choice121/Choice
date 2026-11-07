// ============================================================
// Pages Function: /sitemap-pages.xml
// ============================================================
// Static public marketing, search, and platform policy pages.
// ============================================================

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/listings.html', priority: '0.9', changefreq: 'daily' },
  { path: '/about.html', priority: '0.6', changefreq: 'monthly' },
  { path: '/how-it-works.html', priority: '0.7', changefreq: 'monthly' },
  { path: '/how-to-apply.html', priority: '0.8', changefreq: 'monthly' },
  { path: '/faq.html', priority: '0.7', changefreq: 'weekly' },
  { path: '/policies.html', priority: '0.5', changefreq: 'monthly' },
  { path: '/fair-housing.html', priority: '0.5', changefreq: 'monthly' },
  { path: '/rental-application-policy.html', priority: '0.5', changefreq: 'monthly' },
  { path: '/application-credit-policy.html', priority: '0.5', changefreq: 'monthly' },
  { path: '/holding-deposit-policy.html', priority: '0.5', changefreq: 'monthly' },
  { path: '/terms.html', priority: '0.4', changefreq: 'monthly' },
  { path: '/privacy.html', priority: '0.4', changefreq: 'monthly' },
];

export async function onRequestGet({ env, request }) {
  const SITE = (env.SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');
  const today = new Date().toISOString().slice(0, 10);

  const urls = STATIC_PAGES.map(p => {
    return (
      `  <url>\n` +
      `    <loc>${SITE}${p.path}</loc>\n` +
      `    <lastmod>${today}</lastmod>\n` +
      `    <changefreq>${p.changefreq}</changefreq>\n` +
      `    <priority>${p.priority}</priority>\n` +
      `  </url>`
    );
  }).join('\n');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
