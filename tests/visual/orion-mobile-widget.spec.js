const { test, expect } = require('@playwright/test');

function zillowPageData(zpid, streetAddress, price) {
  return {
    props: {
      pageProps: {
        componentProps: {
          gdpClientCache: JSON.stringify({
            listing: {
              property: {
                zpid,
                address: {
                  streetAddress,
                  city: 'Columbus',
                  state: 'OH',
                  zipcode: '43215',
                },
                price,
                bedrooms: 2,
                bathrooms: 1,
                homeType: 'SINGLE_FAMILY',
                responsivePhotos: [],
                description: 'Listing details from the Zillow record.',
              },
            },
          }),
        },
      },
    },
  };
}

test('Orion mobile widget appears without refresh and saves the current Zillow listing in one tap', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile',
    });
  });

  await page.route('https://www.zillow.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html>
      <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body><main>Zillow listing</main><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
        zillowPageData('111111', '100 First St', 1500),
      )}</script></body></html>`,
  }));

  const savedPayloads = [];
  await page.route('https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/receive-pipeline-import**', async (route) => {
    const corsHeaders = {
      'access-control-allow-origin': 'https://www.zillow.com',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, x-import-secret',
    };
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }
    if (route.request().method() === 'POST') {
      savedPayloads.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: 'pipeline-property-id', title: 'Mock Zillow Listing' }),
      });
    }
    return route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, folders: [] }),
    });
  });

  await page.goto('https://www.zillow.com/homedetails/100-First-St-Columbus-OH-43215/111111_zpid/');
  await page.addScriptTag({ path: '.pages-orion/config.js' });
  await page.addScriptTag({ path: '.pages-orion/shared-extractors.js' });
  await page.addScriptTag({ path: '.pages-orion/live-content.js' });

  const widget = page.locator('#cp-widget-container');
  const compactSummary = page.locator('#cp-mini-summary');
  const saveButton = page.locator('#cp-mini-save-btn');
  await expect(widget).toHaveClass(/cp-minimized/);
  await expect(compactSummary).toContainText('100 First St, Columbus, OH');
  await expect(compactSummary).toContainText('$1,500/mo');
  await expect(saveButton).toBeVisible();

  await page.evaluate((nextListing) => {
    document.getElementById('__NEXT_DATA__').textContent = JSON.stringify(nextListing);
    history.pushState({}, '', '/homedetails/200-Second-St-Columbus-OH-43215/222222_zpid/');
  }, zillowPageData('222222', '200 Second St', 1750));

  await expect(compactSummary).toContainText('200 Second St, Columbus, OH', { timeout: 5000 });
  await expect(compactSummary).toContainText('$1,750/mo');

  await saveButton.click();
  await expect(saveButton).toHaveText('Saved ✓');
  expect(savedPayloads).toHaveLength(1);
  expect(savedPayloads[0].source_listing_id).toBe('222222');
  expect(savedPayloads[0].address).toBe('200 Second St');
  expect(savedPayloads[0].monthly_rent).toBe(1750);
});
