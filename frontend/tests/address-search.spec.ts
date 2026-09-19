import { expect, test, type Page } from '@playwright/test';

const NOMINATIM = 'https://nominatim.openstreetmap.org/**';

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.route('https://server.arcgisonline.com/**', route => route.abort());
});

const box = (page: Page) => page.getByRole('textbox', { name: 'Search for a place' });

// A real point inside a Fenton block group, taken from the storefront snapshot so the test never hard-codes coordinates.
async function pointInsideBlockGroup(page: Page) {
  const body = await (await page.request.get('/api/storefronts')).json();
  const item = body.storefronts.find((s: { block_group_id: string | null }) => s.block_group_id);
  const area = await (await page.request.get(`/api/areas/${item.block_group_id}`)).json();
  return { lat: item.lat as number, lon: item.lon as number, population: area.metrics.population as number };
}

const answerWith = (page: Page, body: unknown, log?: { url: string; at: number }[]) => page.route(NOMINATIM, route => {
  log?.push({ url: route.request().url(), at: Date.now() });
  return route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
});

test('typing an address sends nothing until the user asks, and says where the text goes', async ({ page }) => {
  const log: { url: string; at: number }[] = [];
  await answerWith(page, [], log);
  await page.goto('/');
  await box(page).fill('7720 Blair Road');
  await expect(page.getByRole('button', { name: /Search address for “7720 Blair Road”/ })).toBeVisible();
  await expect(page.locator('.address-search')).toContainText('Sends your text to OpenStreetMap');
  await page.waitForTimeout(1500);
  expect(log).toHaveLength(0); // no search-as-you-type
});

test('Enter geocodes with the coverage box, US filter and limit, then a pin drops and the containing block group is selected', async ({ page }) => {
  const point = await pointInsideBlockGroup(page);
  const log: { url: string; at: number }[] = [];
  await answerWith(page, [{ display_name: '8250 Georgia Avenue, Silver Spring, Maryland, United States', lat: String(point.lat), lon: String(point.lon) }], log);
  await page.goto('/');
  await box(page).fill('8250 Georgia Avenue');
  await box(page).press('Enter');
  const row = page.locator('.address-row', { hasText: '8250 Georgia Avenue' });
  await expect(row).toBeVisible();
  const params = new URL(log[0].url).searchParams;
  expect(params.get('q')).toBe('8250 Georgia Avenue');
  expect(params.get('format')).toBe('jsonv2');
  expect(params.get('limit')).toBe('5');
  expect(params.get('countrycodes')).toBe('us');
  expect(params.get('bounded')).toBe('1');
  expect(params.get('viewbox')!.split(',')).toHaveLength(4);
  await row.click();
  await expect(page.locator('.address-pin')).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: 'Pinned:' })).toContainText('8250 Georgia Avenue');
  await expect(page.locator('aside').last()).toContainText(point.population.toLocaleString()); // the containing block group is selected
});

test('an address outside the covered area gets a pin and an explanation, and changes no selection', async ({ page }) => {
  await answerWith(page, [{ display_name: 'Far Away Road, Elsewhere', lat: '40.5', lon: '-75.5' }]);
  await page.goto('/');
  const panel = page.locator('aside').last();
  await expect(panel).toContainText('Silver Spring area'); // the whole-area default selection
  await box(page).fill('Far Away Road');
  await box(page).press('Enter');
  await page.locator('.address-row', { hasText: 'Far Away Road' }).click();
  await expect(page.locator('.address-pin')).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: 'outside the Census coverage' })).toBeVisible();
  await expect(panel).toContainText('Silver Spring area'); // still the same selection
  await expect(panel).not.toContainText('Fenton study area');
});

test('empty results and a service failure are reported without breaking area search', async ({ page }) => {
  await answerWith(page, []);
  await page.goto('/');
  await box(page).fill('Nowhere Lane');
  await box(page).press('Enter');
  await expect(page.getByText('No matching address in the Silver Spring area.')).toBeVisible();
  await page.unroute(NOMINATIM);
  await page.route(NOMINATIM, route => route.fulfill({ status: 500, body: '{}', headers: { 'access-control-allow-origin': '*' } }));
  await box(page).fill('Broken Street');
  await box(page).press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Address search is unavailable' })).toBeVisible({ timeout: 8000 });
  await box(page).fill('');
  await box(page).fill('Silver Spring');
  await expect(page.locator('.search-results')).toContainText('Silver Spring area'); // area search unaffected
});

test('repeat queries are served from cache and different queries are spaced at least a second apart', async ({ page }) => {
  const log: { url: string; at: number }[] = [];
  await answerWith(page, [{ display_name: 'One Street, Silver Spring', lat: '38.99', lon: '-77.03' }], log);
  await page.goto('/');
  await box(page).fill('One Street');
  await box(page).press('Enter');
  await expect(page.locator('.address-row', { hasText: 'One Street' })).toBeVisible();
  await box(page).fill('Two Street');
  await box(page).press('Enter');
  await expect(page.locator('.address-row', { hasText: 'One Street' })).toBeVisible();
  expect(log).toHaveLength(2);
  expect(log[1].at - log[0].at).toBeGreaterThanOrEqual(1000);
  await box(page).fill('One Street'); // cached
  await box(page).press('Enter');
  await expect(page.locator('.address-row', { hasText: 'One Street' })).toBeVisible();
  expect(log).toHaveLength(2);
});

test('geocoder text is rendered as text, never as HTML', async ({ page }) => {
  await answerWith(page, [{ display_name: '<img src=x onerror="window.__pwned=1">, Silver Spring', lat: '38.99', lon: '-77.03' }]);
  await page.goto('/');
  await box(page).fill('anything');
  await box(page).press('Enter');
  await expect(page.locator('.address-label')).toContainText('<img src=x');
  await expect(page.locator('.address-search img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
});

test('Clear pin removes the marker', async ({ page }) => {
  await answerWith(page, [{ display_name: 'Pin Street, Silver Spring', lat: '38.99', lon: '-77.03' }]);
  await page.goto('/');
  await box(page).fill('Pin Street');
  await box(page).press('Enter');
  await page.locator('.address-row', { hasText: 'Pin Street' }).click();
  await expect(page.locator('.address-pin')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear pin' }).click();
  await expect(page.locator('.address-pin')).toHaveCount(0);
});
