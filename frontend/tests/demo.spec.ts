import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Committed Census polygons and OSM places work even when basemap tiles fail.
  await page.route('https://server.arcgisonline.com/**', route => route.abort());
});

test('Fenton focus loads complete Census coverage and real food/drink objects', async ({ page, request }) => {
  const areas = await (await request.get('/api/areas')).json();
  const places = await (await request.get('/api/places')).json();
  await page.goto('/');
  await expect(page.locator('.census-area')).toHaveCount(areas.features.length);
  expect(areas.features.length).toBeGreaterThan(50);
  await expect(page.locator('.food-place')).toHaveCount(places.count);
  expect(places.count).toBeGreaterThan(0);
  await expect(page.locator('.fenton-pin')).toBeVisible();
  await expect(page.locator('.fenton-label')).toContainText('Fenton Village');
  await expect(page.locator('.map-legend')).toContainText(`${places.count} food & drink places`);
  await expect(page.locator('.map-selection-card')).toHaveCount(0);
  await expect(page.locator('.insight-heading')).toContainText('not Fenton Village alone');
  await expect(page.locator('.leaflet-control-attribution')).toContainText('Esri');
});

test('map recenter restores the Fenton pin after panning', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const pin = page.locator('.fenton-pin');
  await expect(pin).toBeVisible();
  const before = (await pin.boundingBox())!;
  const bounds = (await page.locator('.map').boundingBox())!;
  await page.mouse.move(bounds.x + 25, bounds.y + 300);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 120, bounds.y + 340, { steps: 15 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await pin.boundingBox())!.x - before.x)).toBeGreaterThan(30);
  await page.getByRole('button', { name: 'Zoom to Fenton Village' }).click();
  await expect.poll(async () => Math.abs((await pin.boundingBox())!.x - before.x)).toBeLessThan(1);
});

test('show-on-map controls change block-group shading and reset', async ({ page }) => {
  await page.goto('/');
  const polygon = page.locator('.area-240317025021');
  await expect(polygon).toHaveCount(1);
  const populationColor = await polygon.getAttribute('fill');
  await page.getByLabel('Show on map', { exact: true }).selectOption('housing_units');
  await expect(polygon).not.toHaveAttribute('fill', populationColor!);
  await page.getByLabel('Transparency', { exact: true }).fill('70');
  await expect(polygon).toHaveAttribute('fill-opacity', '0.195');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(polygon).toHaveAttribute('fill', populationColor!);
});

test('area selection shows whole-area counts and citations', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('textbox', { name: 'Search for a place' });
  await search.fill('240317025021'); await search.press('Enter');
  await expect(page.locator('.insight-heading')).toContainText('Fenton study area B');
  await expect(page.locator('.metric-card').first()).toContainText('1,731');
  await page.getByRole('button', { name: 'How many people live here?', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Answer', exact: true })).toContainText('1,731');
  await expect(page.locator('.area-240317025021')).toHaveAttribute('stroke', '#b43b73');
  await expect(page.locator('.source-chips a').first()).toHaveAttribute('href', /tigerweb/);
});

test('unbuilt actions are disabled and future layers stay collapsed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Show where these overlap' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Is this a good spot for a business?' })).toBeDisabled();
  await expect(page.locator('.upcoming-catalog')).not.toHaveAttribute('open');
  await expect(page.locator('.avatar, kbd')).toHaveCount(0);
});

test('Data view and export remain functional', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.census-area').first()).toHaveCount(1);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('81,015');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selected area' }).click();
  expect((await download).suggestedFilename()).toBe('civiclens-2472450.json');
});

test('answer history restores sources in the right panel with an empty input', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'How many homes are there?' }).click();
  await expect(page.locator('.answer-panel .research-response')).toContainText('35,150');
  await expect(page.getByLabel('Ask about this area')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: /Answer history/ }).click();
  await expect(page.locator('.history-entry')).toHaveCount(1);
  await page.getByRole('button', { name: 'Reopen answer & sources' }).click();
  await expect(page.locator('.research-response')).toContainText('35,150');
  await expect(page.locator('.source-chips')).toContainText('Census');
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
    await suggestions.getByRole('button', { name: 'How many homes are there?' }).click();
    await expect(page.locator('.research-response')).toContainText('35,150');
    await expect(suggestions.getByRole('button')).toHaveCount(3);
    await page.getByRole('button', { name: 'Data Sources & Methodology' }).click();
    await expect(page).toHaveURL(/#sources$/);
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
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.fenton-pin')).toBeVisible();
});

test('a real food/drink dot opens its original OSM record', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.food-place')).toHaveCount(90);
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
