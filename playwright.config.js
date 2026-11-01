const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/visual',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
});