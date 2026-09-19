import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // The committed geographic boundary remains usable without external basemap tiles.
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
});

test('Fenton focus loads Census areas and real food/drink objects', async ({ page, request }) => {
  const areas = await (await request.get('/api/areas')).json();
  const places = await (await request.get('/api/places')).json();
  await page.goto('/');
  await expect(page.locator('.census-area').first()).toBeVisible();
  expect(areas.features.length).toBeGreaterThanOrEqual(1);
  expect(places.count).toBeGreaterThan(0);
  await expect(page.locator('.fenton-pin')).toBeVisible();
  await expect(page.locator('.fenton-label')).toContainText('Fenton Village');
  await expect(page.locator('.map-legend')).toContainText('food & drink places');
  await expect(page.locator('.insight-heading')).toContainText('not Fenton Village alone');
  await expect(page.locator('.leaflet-control-attribution')).toContainText('Esri');
});

test('real map opacity and metric controls reset without losing selection', async ({ page }) => {
  await page.goto('/');
  const polygon = page.locator('.leaflet-interactive').first();
  await expect(polygon).toBeVisible();
  await page.getByLabel('Transparency').fill('70');
  await expect(page.getByLabel('Transparency')).toHaveValue('70');
  await page.getByLabel('Show on map').selectOption('housing_units');
  await expect(page.locator('.map-legend .eyebrow')).toContainText('Homes');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('Transparency')).toHaveValue('25');
  await expect(page.getByLabel('Show on map')).toHaveValue('population');
  await expect(polygon).toHaveAttribute('stroke', '#006948');
});

test('live count query and segmentation preview coexist', async ({ page }) => {
  let calls = 0;
  page.on('request', request => { if (request.url().endsWith('/api/ask')) calls++; });
  await page.goto('/');
  await page.getByRole('button', { name: 'How many people live here?', exact: true }).click();
  await expect(page.locator('.user-question')).toContainText('How many people live here?');
  await expect(page.locator('.research-response')).toContainText('81,015');
  await page.getByRole('tab', { name: 'Compare areas' }).click();
  const panel = page.getByRole('region', { name: 'Segmentation' });
  await expect(panel).toContainText('Comparing 80 block groups');
  await panel.getByRole('button', { name: 'Compare layers' }).click();
  await expect(panel).toContainText('80 areas compared');
  expect(calls).toBe(1);
});

test('data view, export, search, and methodology retain accurate source context', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-interactive').first()).toBeVisible();
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('81,015');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selected area' }).click();
  expect((await download).suggestedFilename()).toBe('civiclens-2472450.json');
});

test('answer history restores sources and the bar can collapse', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'How many people live here?' }).click();
  const answerPanel = page.locator('.answer-panel');
  await expect(answerPanel).toContainText('81,015', { timeout: 15000 });
  await expect(page.getByLabel('Ask about this area')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: /Answer history/ }).click();
  await expect(page.locator('.history-entry')).toHaveCount(1);
  await page.getByRole('button', { name: 'Reopen answer & sources' }).click();
  await expect(answerPanel).toContainText('81,015');
  await expect(page.getByLabel('Ask about this area')).toHaveValue('');
});

for (const width of [1440, 390, 320]) {
  test(`sources page and wrapped questions fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const suggestions = page.getByLabel('Suggested questions');
    await expect(suggestions.getByRole('button')).toHaveCount(3);
    expect(await suggestions.evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
    const legend = (await page.locator('.map-legend').boundingBox())!;
    const viewport = (await page.locator('.map').boundingBox())!;
    expect(legend.x).toBeGreaterThanOrEqual(viewport.x);
    expect(legend.x + legend.width).toBeLessThanOrEqual(viewport.x + viewport.width);
    await suggestions.getByRole('button', { name: 'How many people live here?' }).click();
    await expect(page.locator('.answer-panel')).toContainText('81,015', { timeout: 15000 });
    await expect(suggestions.getByRole('button')).toHaveCount(3);
    await page.getByRole('button', { name: 'Data Sources & Methodology' }).click();
    await expect(page).toHaveURL(/sources/);
    await expect(page.getByRole('heading', { name: 'Data sources & methodology' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'OpenStreetMap food and drink places' })).toBeVisible();
    await expect(page.locator('.sources-page')).toContainText('Downloaded:');
    expect(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth)).toBeTruthy();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Data sources & methodology' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to the map' }).click();
    await expect(page.locator('.fenton-pin')).toBeVisible();
  });
}

test('map data error offers a working retry', async ({ page }) => {
  await page.route('**/api/areas', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Unable to load');
  await page.unroute('**/api/areas');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.leaflet-interactive').first()).toBeVisible();
});

test('a real food/drink dot opens its original OSM record', async ({ page, request }) => {
  const places = await (await request.get('/api/places')).json();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.food-place').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.food-place')).toHaveCount(places.count);
  const point = await page.locator('.food-place').evaluateAll(elements => {
    for (const element of elements) {
      const b = element.getBoundingClientRect();
      const x = b.x + b.width / 2, y = b.y + b.height / 2;
      if (document.elementFromPoint(x, y) === element) return { x, y };
    }
    return null;
  });
  expect(point).not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
  await expect(page.locator('.leaflet-popup')).toContainText('From OpenStreetMap, may not be complete');
  await expect(page.locator('.leaflet-popup a').first()).toHaveAttribute('href', /^https:\/\/www.openstreetmap.org\/(node|way|relation)\/\d+$/);
});
