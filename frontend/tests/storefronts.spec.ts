import { expect, test, type Page } from '@playwright/test';

const MARKERS = '.leaflet-storefronts-pane path';
const BLOCK_GROUP = '240317025011';

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
});

// The map animates when it zooms; wait until marker positions stop changing instead of sleeping.
async function settled(page: Page) {
  const sample = () => page.locator(MARKERS).first().evaluate(el => { const r = el.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)}`; });
  let previous = '', stable = 0;
  await expect.poll(async () => {
    const now = await sample();
    stable = now === previous ? stable + 1 : 0;
    previous = now;
    return stable;
  }, { timeout: 15000, intervals: [150] }).toBeGreaterThanOrEqual(4);
}

const toggleStorefronts = (page: Page) => page.getByRole('checkbox', { name: /^Storefront Locations/ });

async function selectByBlockGroup(page: Page, id: string) {
  const search = page.getByRole('textbox', { name: 'Search addresses or areas' });
  await search.fill(id);
  await search.press('Enter');
  await expect(page.locator('.insight-heading')).toContainText(id);
}

test('storefronts are off by default and the real snapshot loads when turned on', async ({ page, request }) => {
  const total = (await (await request.get('/api/storefronts')).json()).storefronts.length;
  await page.goto('/');
  await expect(page.locator('.leaflet-interactive')).toHaveCount(3); // area shapes only
  await expect(page.locator(MARKERS)).toHaveCount(0);
  await toggleStorefronts(page).check();
  await expect(page.locator(MARKERS)).toHaveCount(total);
  await expect(page.locator('.map-legend')).toContainText('Food & drink');
  await expect(page.locator('.map-legend')).toContainText('OpenStreetMap-mapped');
});

test('category filters change the visible markers to match their counts', async ({ page }) => {
  await page.goto('/');
  await toggleStorefronts(page).check();
  const chips = page.getByRole('group', { name: 'Storefront categories' });
  const before = await page.locator(MARKERS).count();
  const food = chips.locator('label', { hasText: 'Food & drink' });
  const foodCount = Number(await food.locator('small').innerText());
  expect(foodCount).toBeGreaterThan(0);
  await food.getByRole('checkbox').uncheck();
  await expect(page.locator(MARKERS)).toHaveCount(before - foodCount);
  await food.getByRole('checkbox').check();
  await expect(page.locator(MARKERS)).toHaveCount(before);
});

test('opening a marker shows its name, category and nearby same-category count', async ({ page }) => {
  await page.goto('/');
  await toggleStorefronts(page).check();
  await settled(page);
  await page.locator(MARKERS).first().dispatchEvent('click');
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toContainText(/other .* within 300 m \(OpenStreetMap-mapped\)/);
  await expect(popup.locator('strong')).not.toBeEmpty();
});

test('the block group card summarizes its storefronts with attribution and can show them on the map', async ({ page, request }) => {
  const all = (await (await request.get('/api/storefronts')).json()).storefronts as { block_group_id: string | null }[];
  const inside = all.filter(item => item.block_group_id === BLOCK_GROUP).length;
  await page.goto('/');
  await selectByBlockGroup(page, BLOCK_GROUP);
  const card = page.getByRole('region', { name: 'Storefronts' });
  await expect(card).toContainText(`${inside} mapped businesses in this block group`);
  await expect(card).toContainText('© OpenStreetMap contributors');
  await expect(card).toContainText('not all businesses');
  await expect(page.locator(MARKERS)).toHaveCount(0);
  await card.getByRole('button', { name: 'Show on map' }).click();
  await expect(card.getByRole('button', { name: 'Shown on map' })).toBeDisabled();
  await expect(page.locator(MARKERS)).toHaveCount(all.length);
});

test('the CDP card explains that storefront data covers the block groups only', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Storefronts' })).toContainText('Select one to see its businesses');
});

test('a storefront API failure does not break the map and is stated in the card', async ({ page }) => {
  await page.route('**/api/storefronts', route => route.fulfill({ status: 500, body: '{}' }));
  await page.goto('/');
  await expect(page.locator('.leaflet-interactive')).toHaveCount(3);
  await expect(page.getByRole('region', { name: 'Storefronts' })).toContainText('could not be loaded');
});

test('business names are rendered as text, never as HTML', async ({ page }) => {
  await page.route('**/api/storefronts', route => route.fulfill({ json: {
    schema_version: '1.0', source: 's', license: 'ODbL 1.0', attribution: '(c) OpenStreetMap contributors', retrieved_at: '2026-09-19T00:00:00+00:00',
    osm_data_timestamp: null, limitations: 'x', storefronts: [{ osm_id: 'node/1', name: '<img src=x onerror="window.__pwned=1">', category_key: 'shop',
      category: 'books', address: null, block_group_id: null, lon: -77.0283, lat: 38.9955 }] } }));
  await page.goto('/');
  await toggleStorefronts(page).check();
  await page.locator(MARKERS).first().dispatchEvent('click');
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toContainText('<img src=x');
  await expect(popup.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
});

test('dragging the opacity slider or changing selection does not rebuild map shapes', async ({ page }) => {
  await page.goto('/');
  await toggleStorefronts(page).check();
  await expect(page.locator(MARKERS).first()).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __churn: number };
    w.__churn = 0;
    const observer = new MutationObserver(list => list.forEach(m => { w.__churn += m.addedNodes.length + m.removedNodes.length; }));
    for (const selector of ['.leaflet-overlay-pane', '.leaflet-storefronts-pane']) observer.observe(document.querySelector(selector)!, { childList: true, subtree: true });
  });
  const slider = page.getByLabel('Opacity', { exact: true });
  for (let value = 74; value >= 30; value -= 2) await slider.fill(String(value));
  await selectByBlockGroup(page, BLOCK_GROUP);
  await page.getByLabel('Search addresses or areas').fill('2472450');
  await page.getByLabel('Search addresses or areas').press('Enter');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __churn: number }).__churn)).toBe(0);
  await expect(page.locator(MARKERS).first()).toBeVisible();
});

test('turning storefronts on zooms the map so the markers are spread out and visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await toggleStorefronts(page).check();
  await settled(page);
  // The study area is tall and narrow, so judge the larger dimension of the marker cloud.
  const spread = await page.locator(MARKERS).evaluateAll(els => {
    const boxes = els.map(el => el.getBoundingClientRect());
    const span = (values: number[]) => Math.max(...values) - Math.min(...values);
    return Math.max(span(boxes.map(box => box.x)), span(boxes.map(box => box.y)));
  });
  expect(spread).toBeGreaterThan(300); // px; a clump at the default zoom is well under 100
});

test('changing a category filter does not re-zoom the map', async ({ page }) => {
  await page.goto('/');
  await toggleStorefronts(page).check();
  await settled(page);
  const box = () => page.locator(MARKERS).first().evaluate(el => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)]; });
  const before = await box();
  await page.getByRole('group', { name: 'Storefront categories' }).locator('label', { hasText: 'Banks & pharmacy' }).getByRole('checkbox').uncheck();
  await page.waitForTimeout(600); // long enough that a wrongly triggered zoom would have started moving markers
  expect(await box()).toEqual(before);
});
