import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://server.arcgisonline.com/**', route => route.abort());
});

test('Overview shows no sample income, age or tenure values', async ({ page }) => {
  await page.goto('/');
  const panel = page.getByRole('complementary', { name: 'Area facts and evidence' });
  await expect(panel.getByRole('heading', { name: 'Census counts' })).toBeVisible();
  for (const invented of ['$68,400', '58% of County', '27.1%', '74%', '26%', '18.2%', '33.4%', 'Renter Occupied']) {
    await expect(panel).not.toContainText(invented);
  }
  await expect(panel.getByRole('heading', { name: 'Extended community profile' })).toBeVisible();
  await expect(panel).toContainText('will appear when sourced datasets are connected');
});

test('extended profile explains missing data without fabricated values', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('.insight-section').filter({ has: page.getByRole('heading', { name: 'Extended community profile' }) });
  await expect(section).toContainText('Income, age distribution and housing tenure will appear when sourced datasets are connected.');
  await expect(section.locator('.metric-card')).toHaveCount(0);
});

test('income and Gini layer rows carry no invented values', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('.layers-panel');
  await expect(rows).not.toContainText('$68,400');
  await expect(rows).not.toContainText('0.44');
});
