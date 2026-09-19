import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // The committed geographic boundary remains usable without external basemap tiles.
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
});

test('CivicLens workspace retains real Census map and source-linked metrics', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'CivicLens home' })).toBeVisible();
  const polygon = page.locator('.leaflet-interactive').first();
  await expect(polygon).toBeVisible();
  await polygon.click({ force: true });
  const panel = page.getByRole('complementary', { name: 'Area facts and evidence' });
  await expect(panel.getByRole('heading', { name: 'Silver Spring CDP' })).toBeVisible();
  await expect(panel).toContainText('81,015');
  await expect(panel).toContainText('35,150');
  await expect(polygon).toHaveAttribute('stroke', '#006948');
  await page.getByRole('tab', { name: /Evidence/ }).click();
  await expect(panel.getByRole('link', { name: /Open original document/ })).toHaveAttribute('href', /montgomeryplanning.org.*#page=104$/);
  await expect(panel.locator('a[href*="tigerweb.geo.census.gov"]').first()).toBeVisible();
});

test('real map opacity and metric controls reset without losing selection', async ({ page }) => {
  await page.goto('/');
  const polygon = page.locator('.leaflet-interactive').first();
  await expect(polygon).toBeVisible();
  await page.getByLabel('Opacity', { exact: true }).fill('30');
  await expect(polygon).toHaveAttribute('fill-opacity', '0.135');
  await page.getByRole('checkbox', { name: /^Housing Units/ }).uncheck();
  await page.getByRole('checkbox', { name: /^Housing Units/ }).check();
  await expect(polygon).toHaveAttribute('fill', '#8f4bb8');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('Opacity', { exact: true })).toHaveValue('75');
  await expect(polygon).toHaveAttribute('fill', '#087e8b');
  await expect(polygon).toHaveAttribute('stroke', '#006948');
});

test('query preview and segmentation controls work without model requests', async ({ page }) => {
  let calls = 0;
  page.on('request', request => { if (request.url().endsWith('/api/ask')) calls++; });
  await page.goto('/');
  await page.getByRole('button', { name: 'Where are older residents concentrated?', exact: true }).click();
  await page.getByRole('button', { name: 'Query Records' }).click();
  await expect(page.getByRole('tab', { name: 'Ask CivicLens' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.user-question')).toContainText('Where are older residents concentrated?');
  await expect(page.locator('.research-response')).toContainText('Workspace preview');
  await page.getByLabel('Variable A (Cohort)').selectOption('30');
  await page.getByLabel('Variable B (Economic)').selectOption('90');
  await page.getByRole('button', { name: 'Explore Co-occurrence' }).click();
  await expect(page.locator('.criteria-card')).toContainText('above 30%');
  await expect(page.locator('.criteria-card')).toContainText('$90,000');
  expect(calls).toBe(0);
});

test('data view, export, search, and methodology retain accurate source context', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-interactive').first()).toBeVisible();
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('81,015');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selected area' }).click();
  expect((await download).suggestedFilename()).toBe('civiclens-2472450.json');
  await page.getByRole('button', { name: 'Data Sources & Methodology' }).click();
  await expect(page.getByRole('dialog')).toContainText('illustrative design previews');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search addresses or areas' }).fill('2472450');
  await page.getByRole('textbox', { name: 'Search addresses or areas' }).press('Enter');
  await expect(page.locator('.insight-heading')).toContainText('Silver Spring CDP');
});

test('map data error exposes retry and recovers', async ({ page }) => {
  await page.route('**/api/areas', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Unable to load');
  await page.unroute('**/api/areas');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.leaflet-interactive').first()).toBeVisible();
});

test('mobile panels, evidence and business preview fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.leaflet-interactive').first()).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Workspace panels' });
  await navigation.getByRole('button', { name: 'Layers' }).click();
  await expect(page.getByRole('heading', { name: 'Geographic Layers' })).toBeVisible();
  await navigation.getByRole('button', { name: 'Insights' }).click();
  await expect(page.locator('.metric-card').first()).toContainText('81,015');
  await page.getByRole('button', { name: 'Evaluate Site Viability' }).click();
  await page.getByLabel('Street or location').fill('Fenton Street');
  await page.getByRole('button', { name: 'Prepare site brief' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Fenton Street');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await navigation.getByRole('button', { name: 'Map', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 667, height: 375 }]) {
  test(`open dialogs stay within ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const dialog = page.getByRole('dialog');
    const expectDialogToFit = async () => {
      await expect(dialog).toBeVisible();
      const bounds = await dialog.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(19);
      expect(bounds!.y).toBeGreaterThanOrEqual(19);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 19);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 19);
      expect(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth)).toBeTruthy();
    };
    await page.getByRole('button', { name: 'Data Sources & Methodology' }).click();
    await expectDialogToFit();
    await page.keyboard.press('Escape');
    await page.getByRole('navigation', { name: 'Workspace panels' }).getByRole('button', { name: 'Insights' }).click();
    await page.getByRole('button', { name: 'Evaluate Site Viability' }).click();
    await expectDialogToFit();
    await page.getByLabel('Street or location').fill('LongLocation'.repeat(25));
    await page.getByRole('button', { name: 'Prepare site brief' }).click();
    await expect(dialog.getByRole('status')).toBeVisible();
    await expectDialogToFit();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(dialog).toHaveCount(0);
  });
}
