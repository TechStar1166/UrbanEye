import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
});

test('Overview shows no sample income, age or tenure values', async ({ page }) => {
  await page.goto('/');
  const panel = page.getByRole('complementary', { name: 'Area facts and evidence' });
  await expect(panel.getByRole('heading', { name: 'Ground-Truth Core Metrics' })).toBeVisible();
  for (const invented of ['$68,400', '58% of County', '27.1%', '74%', '26%', '18.2%', '33.4%', 'Renter Occupied']) {
    await expect(panel).not.toContainText(invented);
  }
  await expect(panel.getByRole('heading', { name: 'Housing Tenure and Age Distribution' })).toBeVisible();
  await expect(panel).toContainText('No values are shown until then');
});

test('extended profile cards show a dash and say they are not connected', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('.metric-card').filter({ hasText: /MEDIAN HH INCOME|AGE 50\+ COHORT/ });
  await expect(cards).toHaveCount(2);
  for (const card of await cards.all()) {
    await expect(card.locator('strong')).toHaveText('—');
    await expect(card).toContainText('Not connected yet');
  }
});

test('income and Gini layer rows carry no invented values', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('.layers-panel');
  await expect(rows).not.toContainText('$68,400');
  await expect(rows).not.toContainText('0.44');
});
