import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://server.arcgisonline.com/**', route => route.abort());
});

test('Overview shows sourced ACS profile values, not sample placeholders', async ({ page }) => {
  await page.goto('/');
  const panel = page.getByRole('complementary', { name: 'Area facts and evidence' });
  await expect(panel.getByRole('heading', { name: 'Census counts' })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Community profile' })).toBeVisible();
  await expect(panel).toContainText('ACS 5-year 2020–2024');
  for (const invented of ['$68,400', '58% of County', '27.1%', '74%', '26%', '18.2%', '33.4%']) {
    await expect(panel).not.toContainText(invented);
  }
  await expect(panel).toContainText('Median household income');
  await expect(panel.locator('.metric-card')).toHaveCount(6);
});

test('income and Gini layer rows carry no invented values', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('.layers-panel');
  await expect(rows).not.toContainText('$68,400');
  await expect(rows).not.toContainText('0.44');
  await expect(rows.getByRole('checkbox', { name: /Fenton Village overlay/ })).toBeVisible();
  await expect(rows.getByRole('checkbox', { name: /Purple Line alignment/ })).toBeVisible();
});
