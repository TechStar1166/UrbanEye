import { expect, test } from '@playwright/test';
import { mockAreas } from './fixtures';

// Fill opacity = slider (default 75%) x scale (0.15 lightest .. 0.75 darkest) for comparative scales.
const fills = (page: import('@playwright/test').Page) =>
  page.locator('.leaflet-interactive').evaluateAll(els => els.map(el => Number(el.getAttribute('fill-opacity'))).sort((a, b) => a - b));

test('block-group fill scales with value and the legend explains it', async ({ page }) => {
  await mockAreas(page, 4);
  await page.goto('/');
  await expect(page.locator('.leaflet-interactive')).toHaveCount(4);
  const values = await fills(page);
  expect(values[0]).toBeCloseTo(0.75 * 0.15, 3);
  expect(values[1]).toBeCloseTo(0.75 * 0.35, 3);
  expect(values[2]).toBeCloseTo(0.75 * 0.55, 3);
  expect(values[3]).toBeCloseTo(0.75 * 0.75, 3);
  await expect(page.locator('.map-legend')).toContainText('darker fill means a higher value');
});

test('a large CDP does not distort the block-group scale', async ({ page }) => {
  await mockAreas(page, 4, { cdp: true });
  await page.goto('/');
  await expect(page.locator('.leaflet-interactive')).toHaveCount(5);
  const values = await fills(page);
  // Four block groups span the full scale; the lone CDP keeps the original flat CDP fill (0.75 x 0.25).
  const expected = [0.75 * 0.15, 0.75 * 0.25, 0.75 * 0.35, 0.75 * 0.55, 0.75 * 0.75].sort((a, b) => a - b);
  expected.forEach((value, i) => expect(values[i]).toBeCloseTo(value, 3));
});

test('boundaries-only drops the scale and its legend text', async ({ page }) => {
  await mockAreas(page, 4);
  await page.goto('/');
  await page.getByRole('checkbox', { name: /^Total Population/ }).uncheck();
  await expect.poll(() => fills(page)).toEqual([0.05, 0.05, 0.05, 0.05]);
  await expect(page.locator('.map-legend')).toContainText('not a comparative scale');
});

test('a single area keeps the flat fill and the not-comparative legend', async ({ page }) => {
  await mockAreas(page, 1);
  await page.goto('/');
  await expect(page.locator('.leaflet-interactive')).toHaveCount(1);
  expect((await fills(page))[0]).toBeCloseTo(0.75 * 0.45, 3);
  await expect(page.locator('.map-legend')).toContainText('not a comparative scale');
});
