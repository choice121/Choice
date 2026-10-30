const { test, expect } = require('@playwright/test');

const PROP_1_ID = '392d464a-8371-4f27-a15e-2946f73a60da';
const PROP_2_ID = '4397da60-c09f-4703-b0c9-86109ae12d26';

test.describe('Multi-Floor Floor Plan & Virtual Tour E2E Suite', () => {
  test('Property 1: Verifies multi-floor media, unit_floor, and interactive modals on Desktop', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(`http://localhost:3000/property.html?id=${PROP_1_ID}`, { waitUntil: 'networkidle' });

    // Wait for title and price to render
    await expect(page.locator('#detailTitle')).not.toHaveText('', { timeout: 15000 });
    await expect(page.locator('#detailPrice')).toContainText('$1,629');

    // Verify unit_floor is displayed in specs meta
    await expect(page.locator('#detailMeta')).toContainText('Unit Floor');
    await expect(page.locator('#detailMeta')).toContainText('Level 1, Unit 103');

    // Verify Layout & Spaces section is displayed
    const mediaSection = page.locator('#propertyMediaSection');
    await expect(mediaSection).toBeVisible();

    // Verify Floor Plan card is rendered with level badge
    const fpCard = page.locator('.floor-media-card', { hasText: 'Level 1 Residence Floor Plan' });
    await expect(fpCard).toBeVisible();

    // Verify 3D Virtual Tour card is rendered
    const tourCard = page.locator('.floor-media-card', { hasText: 'Interactive 3D Walkthrough' });
    await expect(tourCard).toBeVisible();

    // Verify hero mosaic tour button is present and visible
    const mosaicBtn = page.locator('#mosaicTourBtn');
    await expect(mosaicBtn).toBeVisible();

    // Test Floor Plan Lightbox Modal
    await fpCard.locator('button[data-action="open-floor-plan"]').click();
    const fpModal = page.locator('#floorPlanModal');
    await expect(fpModal).toBeVisible();
    await expect(page.locator('#fpModalImg')).toBeVisible();

    // Close via Escape
    await page.keyboard.press('Escape');
    await expect(fpModal).toBeHidden();

    // Test Virtual Tour Modal from card
    await tourCard.locator('button[data-action="open-tour"]').click();
    const vtModal = page.locator('#virtualTourModal');
    await expect(vtModal).toBeVisible();
    await expect(page.locator('#vtModalAddress')).toContainText('1506 N Prairie Ave');

    // Close via Close button
    await page.locator('#vtCloseBtn').click();
    await expect(vtModal).toBeHidden();

    // Ensure no unexpected page errors
    expect(pageErrors).toEqual([]);
  });

  test('Property 2: Verifies PropertyPanorama MLS 3D Tour and Mobile layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(`http://localhost:3000/property.html?id=${PROP_2_ID}`, { waitUntil: 'networkidle' });

    // Wait for price
    await expect(page.locator('#detailPrice')).toContainText('$1,200', { timeout: 15000 });

    // Verify unit floor spec
    await expect(page.locator('#detailMeta')).toContainText('Level 2, Apt 208');

    // Verify Layout & Spaces section
    const mediaSection = page.locator('#propertyMediaSection');
    await expect(mediaSection).toBeVisible();

    // Test opening tour from hero mosaic button on mobile
    const mosaicBtn = page.locator('#mosaicTourBtn');
    await expect(mosaicBtn).toBeVisible();
    await mosaicBtn.click();

    const vtModal = page.locator('#virtualTourModal');
    await expect(vtModal).toBeVisible();

    // Close via backdrop click
    await page.locator('#vtModalBackdrop').click({ position: { x: 10, y: 10 } });
    await expect(vtModal).toBeHidden();

    expect(pageErrors).toEqual([]);
  });
});
