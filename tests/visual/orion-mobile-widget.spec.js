const { test, expect } = require('@playwright/test');

function zillowPageData(zpid, streetAddress, price, homeType = 'SINGLE_FAMILY') {
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
                homeType,
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

async function mockOrionBackground(page) {
  await page.addInitScript(() => {
    const runtime = {
      lastError: null,
      sendMessage(message, callback) {
        window.__extensionMessages = window.__extensionMessages || [];
        window.__extensionMessages.push(message);
        if (typeof callback !== 'function') return;
        const response = message.type === 'LIST_FOLDERS'
          ? { ok: true, folders: [] }
          : { ok: true, id: 'pipeline-property-id', title: 'Mock Zillow Listing' };
        callback(response);
      },
    };
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: { runtime },
    });
  });
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
        zillowPageData('111111', '100 First St', 1500))}</script></body></html>`,
  }));

  await mockOrionBackground(page);

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
  const savedPayload = await page.evaluate(() =>
    window.__extensionMessages.find((message) => message.type === 'UPLOAD_PAYLOAD')?.payload);
  expect(savedPayload.source_listing_id).toBe('222222');
  expect(savedPayload.address).toBe('200 Second St');
  expect(savedPayload.monthly_rent).toBe(1750);
});

test('Orion detects Zillow apartment pages without a zpid suffix and saves starting rent', async ({ page }) => {
  await page.route('https://www.zillow.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html>
      <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body><main>Zillow apartment building</main>${Array.from({ length: 11 }, (_, index) =>
        `<img data-src="https://photos.zillowstatic.com/fp/${String(index).padStart(16, '0')}-photo.jpg">`
      ).join('')}<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
        zillowPageData('building-123', '500 Magnolia Ave', '$1,450+', 'APARTMENT'))}</script></body></html>`,
  }));

  await mockOrionBackground(page);

  await page.goto('https://www.zillow.com/apartments/the-magnolia/building-123/');
  await page.addScriptTag({ path: '.pages-orion/config.js' });
  await page.addScriptTag({ path: '.pages-orion/shared-extractors.js' });
  await page.addScriptTag({ path: '.pages-orion/live-content.js' });

  const compactSummary = page.locator('#cp-mini-summary');
  const saveButton = page.locator('#cp-btn-save');
  await expect(saveButton).toBeAttached();
  await expect(compactSummary).toContainText('500 Magnolia Ave, Columbus, OH');
  await expect(compactSummary).toContainText('Starting at $1,450/mo');
  await expect(page.locator('#cp-photos-chip')).toHaveText('📸 11 photos');

  await saveButton.click();
  await expect(page.locator('#cp-success-box')).toContainText('Saved to');
  const savedPayload = await page.evaluate(() =>
    window.__extensionMessages.find((message) => message.type === 'UPLOAD_PAYLOAD')?.payload);
  expect(savedPayload.source_listing_id).toBe('building-123');
  expect(savedPayload.monthly_rent).toBeNull();
  expect(savedPayload.community_starting_rent).toBe(1450);
  expect(savedPayload.is_multi_unit).toBe(true);
  expect(JSON.parse(savedPayload.original_image_urls)).toHaveLength(11);
});

test('Orion extracts and saves a Paseo-shaped Zillow building page', async ({ page }) => {
  const nestedBuildingData = {
    props: {
      pageProps: {
        initialState: {
          clientCache: {
            gdpClientCache: JSON.stringify({
              building: {
                data: {
                  property: {
                    zpid: 461916207,
                    address: null,
                    responsivePhotos: [],
                  },
                },
              },
            }),
          },
        },
      },
    },
  };

  await page.route('https://www.zillow.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html>
      <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body>
        <h1>Paseo Apartments</h1>
        <p>4836 Sunnyvale St, Dallas, TX 75216</p>
        <p>Special offer: $0 App Fee $0 Admin Fee</p>
        <span data-testid="community-rent">Starting at $1,450+ per month</span>
        ${Array.from({ length: 11 }, (_, index) =>
          `<img src="https://photos.zillowstatic.com/fp/${String(index + 1).padStart(16, '0')}-gallery.jpg">`
        ).join('')}
        <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nestedBuildingData)}</script>
      </body></html>`,
  }));

  await mockOrionBackground(page);

  await page.goto('https://www.zillow.com/apartments/dallas-tx/paseo-apartments/5YLsV5/');
  await page.addScriptTag({ path: '.pages-orion/config.js' });
  await page.addScriptTag({ path: '.pages-orion/shared-extractors.js' });
  await page.addScriptTag({ path: '.pages-orion/live-content.js' });

  const summary = page.locator('#cp-mini-summary');
  const saveButton = page.locator('#cp-btn-save');
  await expect(saveButton).toBeAttached();
  await expect(summary).toContainText('4836 Sunnyvale St, Dallas, TX');
  await expect(summary).toContainText('Starting at $1,450/mo');
  await expect(page.locator('#cp-photos-chip')).toHaveText('📸 11 photos');

  await saveButton.click();
  await expect(page.locator('#cp-success-box')).toContainText('Saved to');
  const savedPayload = await page.evaluate(() =>
    window.__extensionMessages.find((message) => message.type === 'UPLOAD_PAYLOAD')?.payload);
  expect(savedPayload.source_listing_id).toBe('461916207');
  expect(savedPayload.address).toBe('4836 Sunnyvale St');
  expect(savedPayload.monthly_rent).toBeNull();
  expect(savedPayload.community_starting_rent).toBe(1450);
  expect(savedPayload.is_multi_unit).toBe(true);
  expect(JSON.parse(savedPayload.original_image_urls)).toHaveLength(11);
});

test('Chrome importer appears on Zillow apartment pages without a zpid suffix', async ({ page }) => {
  await page.addInitScript(() => {
    const runtime = {
      lastError: null,
      sendMessage(message, callback) {
        window.__extensionMessages = window.__extensionMessages || [];
        window.__extensionMessages.push(message);
        if (typeof callback === 'function') callback({ ok: true, id: 'pipeline-test-id' });
      },
    };
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: { runtime },
    });
  });

  await page.route('https://www.zillow.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html>
      <html><body><main>Zillow apartment building</main>${Array.from({ length: 11 }, (_, index) =>
        `<img data-src="https://photos.zillowstatic.com/fp/${String(index).padStart(16, '0')}-photo.jpg">`
      ).join('')}
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
        zillowPageData('building-456', '500 Magnolia Ave', '$1,450+', 'APARTMENT'))}</script></body></html>`,
  }));

  await page.goto('https://www.zillow.com/apartments/the-magnolia/building-456/');
  await page.addScriptTag({ path: 'chrome-extension/config.js' });
  await page.addScriptTag({ path: 'chrome-extension/shared-extractors.js' });
  await page.addScriptTag({ path: 'chrome-extension/content.js' });

  await expect(page.locator('#cp-btn-save')).toBeAttached();
  await expect(page.locator('.cp-chip-price')).toContainText('$1,450/mo');
  await expect(page.locator('.cp-chip-photos')).toHaveText('📸 11 photos');

  await page.locator('#cp-btn-save').click();
  await expect(page.locator('#cp-success-box')).toBeVisible();
  const message = await page.evaluate(() => window.__extensionMessages.find((entry) => entry.type === 'UPLOAD_PAYLOAD'));
  expect(message.type).toBe('UPLOAD_PAYLOAD');
  expect(message.payload.source_listing_id).toBe('building-456');
});
