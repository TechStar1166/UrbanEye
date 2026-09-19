import { expect, test } from '@playwright/test';
import { mockAreas } from './fixtures';

const colors = (page: import('@playwright/test').Page) =>
  page.locator('.census-area').evaluateAll(els => els.map(el => el.getAttribute('fill')));
const population = ['#d0e9e5', '#78b9b1', '#277d78', '#07504d'];

test('block-group fill scales with value and the legend explains it', async ({ page }) => {
  await mockAreas(page, 4);
  await page.goto('/');
  await expect.poll(() => colors(page)).toEqual(population);
  await expect(page.locator('.map-legend')).toContainText('Darker = higher values.');
});

test('a large CDP stays neutral and does not distort the block-group scale', async ({ page }) => {
  await mockAreas(page, 4, { cdp: true });
  await page.goto('/');
  await expect.poll(() => colors(page)).toEqual(['#d9dfdc', ...population]);
  await expect(page.locator('.area-cdp')).toHaveAttribute('fill-opacity', '0');
});

test('boundaries-only drops the scale and its legend text', async ({ page }) => {
  await mockAreas(page, 4);
  await page.goto('/');
  await page.getByLabel('Show on map', { exact: true }).selectOption('');
  await expect.poll(() => colors(page)).toEqual(Array(4).fill('#d9dfdc'));
  await expect(page.locator('.choropleth-ramp')).toHaveCount(0);
  await expect(page.locator('.map-legend')).toContainText('Boundaries only');
});

test('a single area keeps the flat fill and the not-comparative legend', async ({ page }) => {
  await mockAreas(page, 1);
  await page.goto('/');
  await expect.poll(() => colors(page)).toEqual(['#78b9b1']);
  await expect(page.locator('.map-legend')).toContainText('not a comparative scale');
});
