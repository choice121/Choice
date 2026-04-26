# Phase C — SEO & Discoverability

**Status:** Not started
**Risk:** Low
**Impact:** **Very high** (this is the single biggest growth lever — 772 active properties currently invisible to search engines)
**Depends on:** Nothing
**Blocks:** Nothing

---

## Goal

Make every active property crawlable, indexable, and rich-snippet
eligible. Specifically:

1. Generate a dynamic `/sitemap-properties.xml` with all 772 active
   property URLs.
2. Render correct `<title>`, `<meta description>`, `og:*`, and
   `twitter:*` tags **into the HTML the crawler receives** (not only at
   JS runtime).
3. Add `RealEstateListing` (or `Apartment`) JSON-LD per property page.
4. Switch property URLs from `?id=PROP-AJEH3KTF` to keyword-rich slugs
   like `/rent/ga/atlanta/3br-townhouse-prop-b3125385/` while keeping
   the old URL as a 301 redirect for inbound link equity.

## Why now

- `sitemap.xml` has only 15 static URLs. The 772 active properties
  aren't crawled.
- `property.html`'s static `<title>` is "Property — Choice Properties"
  for every property until JS runs. Most crawlers index the initial
  HTML.
- No `RealEstateListing` JSON-LD means Google can't show rich rental
  snippets (rent, beds, baths, photos) in SERPs.
- Opaque IDs in URLs leak no keywords.

This is the single most leveraged area: each fix is small, there are
no migrations, no schema changes, and the impact is on every listing.

## Files touched

| Layer | File | Change |
|---|---|---|
| Pages Function | `functions/sitemap-properties.xml.js` (new) | Reads active properties from Supabase REST and returns XML. Cache 1h. |
| Pages Function | `functions/rent/[state]/[city]/[slug].js` (new) | Slug router → renders the existing `property.html` shell with **server-rendered `<head>`** containing the per-property meta + JSON-LD. The body is still the same skeleton; JS hydrates the rest. |
| Pages Function | `functions/property.html.js` (new) | If `?id=PROP-XXX` is hit, look up the property, build the slug, and 301 to `/rent/<state>/<city>/<slug>/`. |
| Static | `sitemap.xml` | Add `<sitemap>` index entry pointing to `/sitemap-properties.xml`. Convert root sitemap into a sitemap index. |
| Static | `robots.txt` | Add `Sitemap: https://…/sitemap-properties.xml` line. |
| HTML | `property.html` | Keep the static fallback title/desc but the Pages Function will rewrite them on the edge. Add a `<script type="application/ld+json" id="ld-property">` placeholder that the Function fills in. |
| JS | `js/property.js` lines around the OG-tag setup | No-op when the Function has already set them. |
| JS | `js/listings.js` card link builder | Build slug URLs instead of `?id=` URLs. Helper: `buildPropertyUrl(p)` in `js/cp-api.js`. |

## Pages Function sketch — `functions/sitemap-properties.xml.js`

```js
export async function onRequestGet({ env }) {
  const SUPA = env.SUPABASE_URL;
  const ANON = env.SUPABASE_ANON_KEY;

  const r = await fetch(
    `${SUPA}/rest/v1/properties?status=eq.active&select=id,title,city,state,updated_at`,
    { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }
  );
  const rows = await r.json();
  const urls = rows.map(p => {
    const slug = slugify(p);
    return `<url>
  <loc>https://choice-properties-site.pages.dev/rent/${p.state.toLowerCase()}/${slugifyCity(p.city)}/${slug}/</loc>
  <lastmod>${p.updated_at.slice(0,10)}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.7</priority>
</url>`;
  }).join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
    { headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    }}
  );
}
function slugify(p) { /* `${beds}br-${type}-${id_lower}` */ }
function slugifyCity(s) { /* lowercase, dashes */ }
```

## Pages Function sketch — `functions/rent/[state]/[city]/[slug].js`

```js
export async function onRequestGet({ env, params, request }) {
  // 1. Extract id from slug (last token after final dash, prefixed PROP-)
  const id = extractIdFromSlug(params.slug);

  // 2. Fetch property from Supabase
  const p = await fetchProperty(env, id);
  if (!p || p.status !== 'active') return new Response('Not found', { status: 404 });

  // 3. Read the static property.html body
  const shell = await env.ASSETS.fetch(new URL('/property.html', request.url));
  let html = await shell.text();

  // 4. Inject per-property meta + JSON-LD
  const meta = buildMetaTags(p);
  const ld   = buildJsonLd(p);
  html = html
    .replace('<title>Property — Choice Properties</title>', `<title>${escape(p.title)} in ${p.city}, ${p.state} — Choice Properties</title>`)
    .replace('<meta name="description" content="View property details and apply online.">', `<meta name="description" content="${escape(p.description?.slice(0,155) || '')}">`)
    .replace('<!--LD_PROPERTY_PLACEHOLDER-->', `<script type="application/ld+json">${ld}</script>`)
    .replace('id="ogTitle"       content="Rental Property — Choice Properties"', `id="ogTitle"       content="${escape(p.title)}"`)
    .replace('id="ogDescription" content="View property details and apply online."', `id="ogDescription" content="${escape(p.description?.slice(0,155) || '')}"`)
    .replace('id="ogImage"       content=""', `id="ogImage"       content="${firstPhoto(p)}"`)
    .replace('id="ogUrl"         content=""', `id="ogUrl"         content="${request.url}"`);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
    }
  });
}
```

## JSON-LD shape (Schema.org `RealEstateListing` + `Product`)

```json
{
  "@context": "https://schema.org",
  "@type": ["RealEstateListing","Product"],
  "name": "3BR Single Family in Knoxville",
  "description": "...",
  "url": "https://choice-properties-site.pages.dev/rent/tn/knoxville/3br-single-family-prop-744cdf58/",
  "image": ["https://ik.imagekit.io/...jpg", "..."],
  "offers": {
    "@type": "Offer",
    "price": 1750,
    "priceCurrency": "USD",
    "priceSpecification": { "@type": "UnitPriceSpecification", "price": 1750, "priceCurrency": "USD", "unitCode": "MON" },
    "availability": "https://schema.org/InStock"
  },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "...",
    "addressLocality": "Knoxville",
    "addressRegion": "TN",
    "postalCode": "...",
    "addressCountry": "US"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": ..., "longitude": ... },
  "numberOfRooms": 3,
  "numberOfBathroomsTotal": 2,
  "floorSize": { "@type": "QuantitativeValue", "value": 1662, "unitCode": "FTK" },
  "petsAllowed": true
}
```

## Acceptance criteria

- [ ] `https://choice-properties-site.pages.dev/sitemap-properties.xml` returns 200 with all active properties listed.
- [ ] Google Search Console "Coverage" report shows the new URLs being indexed within 14 days.
- [ ] `view-source:` of any property page shows the **correct title and description** in the HTML (not the generic placeholder).
- [ ] JSON-LD validates in https://validator.schema.org/ for at least 5 sample property URLs.
- [ ] Old `?id=` URL returns 301 to the new slug URL.
- [ ] Lighthouse SEO score on a property page ≥ 95.

## Verification commands

```bash
# Sitemap
curl -s https://choice-properties-site.pages.dev/sitemap-properties.xml | head -20
curl -s https://choice-properties-site.pages.dev/sitemap-properties.xml | grep -c '<url>'
# expect: ~772

# A property page rendered by the Pages Function
curl -s "https://choice-properties-site.pages.dev/rent/tn/knoxville/3br-single-family-prop-744cdf58/" \
  | grep -E '<title>|<meta name="description"|application/ld\+json'

# Old URL still works (301 redirect)
curl -sI "https://choice-properties-site.pages.dev/property.html?id=PROP-744CDF58" | head -5

# Validate JSON-LD locally
curl -s "https://.../rent/tn/knoxville/.../" \
  | grep -oP '(?<=<script type="application/ld\+json">).*?(?=</script>)' \
  | jq .
```

## Rollback

Each Pages Function is independent. To roll back, delete the function
file and push. The previous behavior (static `property.html` served
verbatim) returns immediately — Cloudflare Pages re-deploys in ~30s.

## Estimated complexity

- 3 Pages Functions (~200 lines total)
- 1 sitemap.xml conversion to sitemap index
- 1 robots.txt line
- 1 JS helper `buildPropertyUrl`
- ~1 day of work; the trickiest piece is the slug ↔ id round-trip
