import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://server.arcgisonline.com/**', route => route.abort());
});

test('Fenton defaults use one snapshot, an official outline, and explicit count scopes', async ({ page, request }) => {
  const snapshot = await (await request.get('/api/storefronts')).json();
  await page.goto('/');
  await expect(page).toHaveURL(/area=240317025021/);
  await expect(page.locator('.area-240317025021')).toHaveAttribute('stroke', '#006948');
  await expect(page.getByRole('checkbox', { name: /Fenton Village overlay/ })).toBeChecked();
  await expect(page.locator('.fenton-overlay')).toHaveCount(1);
  await expect(page.locator('.food-place, .leaflet-fenton-pane path')).toHaveCount(0);
  await expect(page.locator('.leaflet-storefronts-pane path')).toHaveCount(snapshot.storefronts.length);
  const counts = await page.getByRole('group', { name: 'Storefront categories' }).locator('small').allTextContents();
  expect(counts.map(Number).reduce((sum, n) => sum + n, 0)).toBe(snapshot.storefronts.length);
  const summary = page.getByRole('region', { name: 'Storefronts' });
  await expect(summary).toContainText('243 named businesses in the Fenton study query box');
  await expect(summary).toContainText('61 of these mapped businesses fall inside the Fenton Village zoning overlay');
  await expect(summary).toContainText('65 mapped businesses in this block group');
  await expect(summary).toContainText(snapshot.retrieved_at.slice(0, 10));
  await expect(page.locator('.map-legend')).not.toContainText(/storefront|food|600 m/i);
  await expect(page.locator('.place-summary')).toHaveCount(0);
});

test('business brief shares the community cards and does not turn missing coverage into zero', async ({ page }) => {
  await page.goto('/#area=240317024022&tab=Overview');
  await page.getByRole('button', { name: 'Is this a good spot for a business?' }).click();
  const panel = page.getByRole('complementary', { name: 'Area facts and evidence' });
  await expect(panel.locator('.metric-card').filter({ hasText: /^Population/ })).toHaveCount(1);
  await expect(panel.locator('.metric-card')).toHaveCount(6);
  const income = panel.locator('.metric-card').filter({ hasText: 'Median household income' });
  await expect(income).toContainText('$73,368');
  await expect(income).toContainText('Give or take $28,985 (90% confidence)');
  await expect(income).toContainText('Rough estimate, could be off by 30% or more');
  await expect(income.locator('a')).toHaveAttribute('href', /acsdt5y2024-b19013/);
  await expect(panel.getByRole('region', { name: 'Storefronts' })).toContainText('no block-group count is shown');
  await expect(panel).not.toContainText('Mapped storefronts0');
});

test('a missing survey margin is not guessed from a reliability flag', async ({ page, request }) => {
  const data = await (await request.get('/api/areas')).json();
  const area = data.features.find((f: { id: string }) => f.id === '240317024022');
  area.properties.evidence.find((e: { metric: string }) => e.metric === 'median_household_income').excerpt = 'Margin of error not available.';
  await page.route('**/api/areas', route => route.fulfill({ json: data }));
  await page.goto('/#area=240317024022&tab=Overview');
  const card = page.locator('.metric-card').filter({ hasText: 'Median household income' });
  await expect(card).toContainText('Margin of error unavailable');
  await expect(card).not.toContainText('Give or take');
});

for (const width of [1440, 390, 320]) {
  test(`legend and sidebar text are not clipped at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.fenton-overlay')).toHaveCount(1);
    const legend = page.locator('.map-legend');
    expect(await legend.evaluate(el => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true);
    const map = (await page.locator('.map').boundingBox())!;
    const box = (await legend.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(map.y);
    expect(box.y + box.height).toBeLessThanOrEqual(map.y + map.height);
    await page.screenshot({ path: `/tmp/fenton-map-${width}.png` });
    if (width < 761) await page.getByRole('navigation', { name: 'Workspace panels' }).getByRole('button', { name: 'Layers', exact: true }).click();
    const note = page.getByText('The zoning boundary does not come with Census counts.');
    await note.scrollIntoViewIfNeeded();
    await expect(note).toBeInViewport();
    await page.screenshot({ path: `/tmp/fenton-sidebar-${width}.png` });
    await expect(note).toContainText('tagged as under construction in OpenStreetMap');
    expect(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth)).toBe(true);
  });
}
