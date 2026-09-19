import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://server.arcgisonline.com/**', route => route.abort());
});

async function downloadCsv(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all areas (CSV)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('civiclens-areas.csv');
  return readFileSync((await file.path())!, 'utf8');
}

test('CSV export lists every area and metric with its source', async ({ page }) => {
  await page.goto('/');
  const csv = await downloadCsv(page);
  const lines = csv.trim().split('\r\n');
  expect(lines[0]).toBe('geo_id,name,geography_type,boundary_vintage,metric,value,unit,source,data_date,source_url');
  expect(lines.length).toBe(1 + 81 * 7); // 81 areas x 7 metrics
  expect(lines.some(line => line.startsWith('2472450,Silver Spring CDP,census_designated_place,2020-01-01,population,81015,'))).toBe(true);
  expect(csv).toContain('tigerweb.geo.census.gov');
  expect(csv).toContain('240317025011');
});

test('CSV export quotes special characters and neutralizes spreadsheet formulas', async ({ page }) => {
  await page.route('**/api/areas', route => route.fulfill({
    json: {
      type: 'FeatureCollection', schema_version: '1.0', features: [{
        type: 'Feature', id: 'x1', geometry: { type: 'Polygon', coordinates: [[[-77.03, 38.99], [-77.02, 38.99], [-77.02, 39.0], [-77.03, 39.0], [-77.03, 38.99]]] },
        properties: {
          geo_id: 'x1', name: '=HYPERLINK("http://x")', geography_type: 'block_group', boundary_vintage: '2020-01-01', metrics: { population: 5 },
          evidence: [{ evidence_id: 'e1', type: 'structured_data', title: 't', source: 'Source, Inc', date: '2020-04-01', url: 'https://example.test/a', geo_id: 'x1', metric: 'population', value: 5, unit: 'people' }]
        }
      }]
    }
  }));
  await page.goto('/');
  const csv = await downloadCsv(page);
  expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
  expect(csv).toContain('"Source, Inc"');
  expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
});

test('opening a shared link restores the area and tab', async ({ page }) => {
  await page.goto('/#area=240317025011&tab=Evidence');
  await expect(page.locator('.insight-heading')).toContainText('Fenton study area A');
  await expect(page.getByRole('tab', { name: /Evidence/ })).toHaveAttribute('aria-selected', 'true');
});

test('an unknown area or tab in the link is ignored', async ({ page }) => {
  await page.goto('/#area=does-not-exist&tab=Bogus');
  await expect(page.getByRole('complementary', { name: 'Area facts and evidence' }).getByRole('heading', { name: 'Silver Spring area' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
});

test('the address bar follows the selected area and tab', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Search for a place' }).fill('240317025011');
  await page.getByRole('textbox', { name: 'Search for a place' }).press('Enter');
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#area=240317025011&tab=Overview');
  await page.getByRole('tab', { name: /Evidence/ }).click();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#area=240317025011&tab=Evidence');
});

test('copy link puts the current view URL on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#area=240317025011&tab=Evidence');
  await expect(page.locator('.insight-heading')).toContainText('Fenton study area A');
  await page.getByRole('button', { name: 'Copy link to this view' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  expect(page.url()).toContain('#area=240317025011&tab=Evidence');
});

test('the Overview states what the dataset cannot tell you', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('region', { name: 'Data coverage' });
  await expect(card).toContainText('population: 81,015');
  await expect(card).toContainText('housing units: 35,150');
  for (const missing of ['Complete, verified competitor coverage', 'Rent and lease prices', 'Foot traffic', 'Business revenue']) {
    await expect(card).toContainText(missing);
  }
  await expect(card).toContainText('median household income');
});


for (const tab of ['Compare areas', 'Answer history']) {
  test(`sharing restores ${tab} and sources navigation preserves the selected view`, async ({ page }) => {
    await page.goto('/#area=240317025011&tab=' + encodeURIComponent(tab));
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.insight-heading')).toContainText('Fenton study area A');
    await page.getByRole('button', { name: 'Data Sources & Methodology' }).click();
    await expect(page).toHaveURL(/#sources$/);
    await expect(page.getByRole('heading', { name: 'Data sources & methodology' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to the map' }).click();
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.insight-heading')).toContainText('Fenton study area A');
    await expect.poll(() => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('tab'))).toBe(tab);
  });
}
