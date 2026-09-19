import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Base tiles are optional; the demo must work using the committed boundary.
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
});

test('real map polygon → area facts → cited answer → unsupported question', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-interactive')).toBeVisible();
  await page.locator('.leaflet-interactive').click({ force: true });
  await expect(page.getByRole('heading', { name: 'Silver Spring CDP' })).toBeVisible();
  await expect(page.locator('dd').first()).toHaveText('81,015 people');
  await page.getByLabel('Map layer').selectOption('housing_units');
  await expect(page.locator('.leaflet-interactive')).toHaveAttribute('stroke', '#ffcc00');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const answer = page.getByRole('region', { name: 'Answer', exact: true });
  await expect(answer).toContainText('81,015');
  await expect(answer.getByRole('link')).toHaveAttribute('href', /tigerweb.geo.census.gov/);
  await page.getByLabel('Ask about this area').fill('Will population double next year?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(answer).toContainText('insufficient');
  await expect(answer.getByRole('link')).toHaveCount(0);
});

test('keyboard area selection and boundaries-only layer work', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Select area').selectOption('2472450');
  await expect(page.locator('dd').last()).toHaveText('35,150 units');
  await page.getByLabel('Map layer').selectOption('');
  await expect(page.locator('.leaflet-interactive')).toHaveAttribute('fill-opacity', '0.05');
});

test('API failure exposes retry and recovers', async ({ page }) => {
  await page.route('**/api/areas', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Unable to load');
  await page.unroute('**/api/areas');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.leaflet-interactive')).toBeVisible();
});
