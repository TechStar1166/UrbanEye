import { expect, test } from '@playwright/test';
import { mockAreas, openSegmentation } from './fixtures';

const strokes = (page: import('@playwright/test').Page) =>
  page.locator('.census-area').evaluateAll(els => els.map(el => el.getAttribute('stroke')));
const OUTLINE = 'Outline areas that are high in both layers';
// bg1 is selected by default (dark green); high areas get the dark slate outline (distinct from the orange food and drink dots).
const TEAL = '#087e8b', SELECTED = '#006948', HIGH = '#0f172a';

test('segmentation is blocked with fewer than 3 comparable areas and sends no request', async ({ page }) => {
  await mockAreas(page, 1);
  let called = false;
  await page.route('**/api/segment', route => { called = true; return route.abort(); });
  const panel = await openSegmentation(page);
  await expect(panel).toContainText('at least 3 areas of the same type');
  await expect(panel).toContainText('largest comparable group has 1');
  await expect(panel.getByRole('button', { name: 'Compare layers' })).toBeDisabled();
  expect(called).toBe(false);
});

test('a CDP is never compared with block groups', async ({ page }) => {
  await mockAreas(page, 2, { cdp: true });
  const panel = await openSegmentation(page);
  // 3 areas have both values, but only 2 share a geography type.
  await expect(panel).toContainText('largest comparable group has 2');
  await expect(panel.getByRole('button', { name: 'Compare layers' })).toBeDisabled();
});

test('only same-type areas are sent to /segment', async ({ page }) => {
  await mockAreas(page, 4, { cdp: true });
  await page.route('**/api/segment', route => route.fulfill({ json: {
    schema_version: '1.0', x_metric: 'population', y_metric: 'housing_units', correlation_coefficient: 1, sample_size: 4, explanation: 'x', data_points: [] } }));
  const panel = await openSegmentation(page);
  const request = page.waitForRequest(r => r.url().endsWith('/api/segment'));
  await panel.getByRole('button', { name: 'Compare layers' }).click();
  expect((await request).postDataJSON().geo_ids).toEqual(['bg1', 'bg2', 'bg3', 'bg4']);
});

test('choosing the same layer twice is blocked', async ({ page }) => {
  await mockAreas(page, 4);
  const panel = await openSegmentation(page);
  await panel.getByLabel('Second layer').selectOption('population');
  await expect(panel).toContainText('Choose two different layers.');
  await expect(panel.getByRole('button', { name: 'Compare layers' })).toBeDisabled();
});

test('two layers over comparable areas show correlation, sample size, caveat and per-area values', async ({ page }) => {
  await mockAreas(page, 4);
  await page.route('**/api/segment', route => route.fulfill({ json: {
    schema_version: '1.0', x_metric: 'population', y_metric: 'housing_units', correlation_coefficient: 0.874, sample_size: 4,
    explanation: 'Correlation measures statistical association, not causation.',
    data_points: [1, 2, 3, 4].map((n, i) => ({ geo_id: `bg${n}`, x_value: 1000 + i * 500, y_value: 400 + i * 150 })) } }));
  const panel = await openSegmentation(page);
  const request = page.waitForRequest(r => r.url().endsWith('/api/segment') && r.method() === 'POST');
  await panel.getByRole('button', { name: 'Compare layers' }).click();
  expect((await request).postDataJSON()).toEqual({ geo_ids: ['bg1', 'bg2', 'bg3', 'bg4'], x_metric: 'population', y_metric: 'housing_units' });
  await expect(panel).toContainText('Correlation: 0.87');
  await expect(panel).toContainText('4 areas compared');
  await expect(panel).toContainText('not causation');
  await expect(panel.locator('tbody tr')).toHaveCount(4);
  await expect(panel.locator('tbody tr').first()).toContainText('Area bg1');
  await expect(panel.locator('tbody tr').first()).toContainText('1,000 people');
  await expect(panel.locator('tbody tr').first()).toContainText('400 units');
});

test('an undefined correlation is shown as Undefined, not 0', async ({ page }) => {
  await mockAreas(page, 4);
  await page.route('**/api/segment', route => route.fulfill({ json: {
    schema_version: '1.0', x_metric: 'population', y_metric: 'housing_units', correlation_coefficient: null, sample_size: 4,
    explanation: 'Correlation measures statistical association, not causation. Correlation is undefined here due to a constant variable.',
    data_points: [] } }));
  const panel = await openSegmentation(page);
  await panel.getByRole('button', { name: 'Compare layers' }).click();
  await expect(panel).toContainText('Correlation: Undefined');
  await expect(panel).toContainText('constant variable');
});

test('a failed comparison shows an error and can be retried', async ({ page }) => {
  await mockAreas(page, 4);
  await page.route('**/api/segment', route => route.fulfill({ status: 500, body: '{}' }));
  const panel = await openSegmentation(page);
  await panel.getByRole('button', { name: 'Compare layers' }).click();
  await expect(panel.getByRole('alert')).toContainText('could not be completed');
  await expect(panel.getByRole('button', { name: 'Compare layers' })).toBeEnabled();
});

test('outline toggle marks areas at or above the 60th percentile in both layers, and clears when unchecked', async ({ page }) => {
  await mockAreas(page, 4);
  const panel = await openSegmentation(page);
  await expect.poll(() => strokes(page)).toEqual([SELECTED, TEAL, TEAL, TEAL]);
  await panel.getByLabel(OUTLINE).check();
  await expect(panel).toContainText('2 of 4 block groups are at or above the 60th percentile');
  await expect.poll(() => strokes(page)).toEqual([SELECTED, TEAL, HIGH, HIGH]);
  await expect(page.locator('.map-legend')).toContainText('High in both compared layers');
  await panel.getByLabel(OUTLINE).uncheck();
  await expect.poll(() => strokes(page)).toEqual([SELECTED, TEAL, TEAL, TEAL]);
});

test('the outline ranks block groups only, ignoring a CDP with larger values', async ({ page }) => {
  await mockAreas(page, 4, { cdp: true });
  const panel = await openSegmentation(page);
  await panel.getByLabel(OUTLINE).check();
  await expect(panel).toContainText('2 of 4 block groups');
  const cdp = page.locator('.census-area').first();
  await expect(cdp).not.toHaveAttribute('stroke', HIGH);
});

test('outline toggle is disabled without enough comparable areas', async ({ page }) => {
  await mockAreas(page, 1);
  const panel = await openSegmentation(page);
  await expect(panel.getByLabel(OUTLINE)).toBeDisabled();
});

test('choosing the same layer removes an active outline; leaving the tab clears it', async ({ page }) => {
  await mockAreas(page, 4);
  const panel = await openSegmentation(page);
  await panel.getByLabel(OUTLINE).check();
  await expect.poll(() => strokes(page)).toContain(HIGH);
  await panel.getByLabel('Second layer').selectOption('population');
  await expect(panel.getByLabel(OUTLINE)).toBeDisabled();
  await expect.poll(() => strokes(page)).not.toContain(HIGH);
  await panel.getByLabel('Second layer').selectOption('housing_units');
  await panel.getByLabel(OUTLINE).check();
  await expect.poll(() => strokes(page)).toContain(HIGH);
  await page.getByRole('tab', { name: 'Overview' }).click();
  await expect.poll(() => strokes(page)).not.toContain(HIGH);
});


test('the expanded Census snapshot supports a live block-group comparison', async ({ page }) => {
  await page.route('https://server.arcgisonline.com/**', route => route.abort());
  const panel = await openSegmentation(page);
  await expect(panel).toContainText('Comparing 80 block groups');
  await panel.getByRole('button', { name: 'Compare layers' }).click();
  await expect(panel).toContainText('80 areas compared');
  await expect(panel.locator('tbody tr')).toHaveCount(80);
  await expect(panel).toContainText('not causation');
});
