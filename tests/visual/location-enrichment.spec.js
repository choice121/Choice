const fs = require('node:fs');
const { test, expect } = require('@playwright/test');

function getConfigValue(configText, key) {
  const match = configText.match(new RegExp(`\\b${key}\\s*:\\s*['\"]([^'\"]+)['\"]`));
  if (!match) throw new Error(`Missing ${key} in generated config.js`);
  return match[1];
}

test('active property shows nearby places and Geoapify map markers', async ({ page, request }, testInfo) => {
  const configText = fs.readFileSync('config.js', 'utf8');
  const supabaseUrl = getConfigValue(configText, 'SUPABASE_URL');
  const anonKey = getConfigValue(configText, 'SUPABASE_ANON_KEY');
  const siteUrl = process.env.CHOICE_SITE_URL || 'https://choice-properties-site.pages.dev';
  const propertyResponse = await request.get(
    `${supabaseUrl}/rest/v1/properties?select=id&status=eq.active&lat=not.is.null&lng=not.is.null&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
  );

  expect(propertyResponse.ok()).toBeTruthy();
  const properties = await propertyResponse.json();
  expect(properties.length).toBeGreaterThan(0);

  const pageErrors = [];
  const locationWarnings = [];
  const basemapStatuses = [];
  const leafletFailures = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('[property]')) {
      locationWarnings.push(message.text());
    }
  });
  page.on('response', (response) => {
    if (response.url().includes('arcgisonline.com') || response.url().includes('cartocdn.com') || response.url().includes('tile.openstreetmap.org')) basemapStatuses.push(response.status());
    if (response.url().includes('leaflet.min.')) leafletFailures.push(`HTTP ${response.status()}`);
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('leaflet.min.')) leafletFailures.push(request.failure()?.errorText || 'request failed');
  });
  await page.goto(`${siteUrl}/property.html?id=${encodeURIComponent(properties[0].id)}`, {
    waitUntil: 'domcontentloaded',
  });

  const nearbyContent = page.locator('#nearbyPlacesContent');
  await nearbyContent.waitFor({ state: 'visible' });
  await nearbyContent.scrollIntoViewIfNeeded();
  await expect(nearbyContent.locator('li').first()).toBeVisible();

  const mapContainer = page.locator('#mapContainer');
  await mapContainer.scrollIntoViewIfNeeded();
  const map = page.locator('#propertyMiniMap');
  if (!(await map.count())) {
    const state = await page.evaluate(() => ({
      leafletLoaded: Boolean(window.L),
      fallbackText: document.getElementById('mapContainer')?.innerText || '',
    }));
    console.log(`Map initialization diagnostics: ${JSON.stringify({ ...state, leafletRequests: leafletFailures, locationWarnings })}`);
  }
  await expect(map).toBeVisible();
  const nearbyMarkers = map.locator('.leaflet-overlay-pane path.leaflet-interactive');
  await expect.poll(() => nearbyMarkers.count()).toBeGreaterThan(0);
  const attribution = map.locator('.leaflet-control-attribution');
  await expect(attribution).toBeVisible();
  await expect(attribution).toContainText(/Esri|OpenStreetMap/);
  await expect.poll(() => map.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const visibleTiles = [...element.querySelectorAll('img.leaflet-tile')].filter((tile) => {
      const rect = tile.getBoundingClientRect();
      return rect.right > bounds.left && rect.left < bounds.right
        && rect.bottom > bounds.top && rect.top < bounds.bottom;
    });
    return visibleTiles.length > 0 && visibleTiles.every((tile) =>
      tile.complete && tile.naturalWidth > 0 && tile.classList.contains('leaflet-tile-loaded')
        && Number(getComputedStyle(tile).opacity) >= 0.99
    );
  })).toBeTruthy();
  await expect.poll(() => basemapStatuses.filter((status) => status === 200).length).toBeGreaterThan(0);
  await mapContainer.screenshot({ path: testInfo.outputPath('location-map.png') });

  expect(pageErrors).toEqual([]);
});