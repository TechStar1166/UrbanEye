import { expect, test } from '@playwright/test';

const selected = '/#area=240317025021&tab=Overview';
test.beforeEach(async ({ page }) => {
  await page.route('https://server.arcgisonline.com/**', route => route.abort());
});

test('Census answer leads with the count, scope and visible record provenance', async ({ page, request }) => {
  await page.goto(selected);
  await page.getByRole('button', { name: 'How many people live here?' }).click();
  const answer = page.getByRole('region', { name: 'Answer', exact: true });
  await expect(answer.locator('.answer-number')).toHaveText('1,731');
  await expect(answer).toContainText('About 1,731 people lived in this area in 2020.');
  await expect(answer).toContainText('This is one Census block group near Fenton Village, not the whole district.');
  await expect(answer).toContainText('The outline shows the area this count covers.');
  await expect(answer).not.toContainText('The plan may cover');
  await expect(answer.locator('.source-record').first()).toBeVisible();
  await expect(answer).toContainText('Geographic ID 240317025021');
  await expect(answer).toContainText('POP100');
  const area = await (await request.get('/api/areas/240317025021')).json();
  await expect(answer).toContainText('Pulled ' + area.evidence[0].retrieved_at.slice(0, 10));
  const source = answer.locator('.source-chip');
  const url = new URL((await source.getAttribute('href'))!);
  expect(url.searchParams.get('where')).toBe("GEOID='240317025021'");
  expect(url.searchParams.get('outFields')).toContain('POP100');
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(page.getByLabel('Ask about this area')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeDisabled();
  await expect(answer.locator('..').getByLabel('Suggested questions').getByRole('button')).toHaveCount(3);
  await expect(page.getByRole('tab', { name: /Answer history/ })).toContainText('1');
  await page.getByRole('tab', { name: /Evidence/ }).click();
  // The existing Census sources are already counted; the answer must not duplicate them.
  await expect(page.getByRole('tabpanel').locator('.evidence li')).toHaveCount(3);
});

test('homes answer states occupied and vacant units', async ({ page }) => {
  await page.goto(selected);
  await page.getByRole('button', { name: 'How many homes are there?' }).click();
  const answer = page.getByRole('region', { name: 'Answer', exact: true });
  await expect(answer.locator('.answer-number')).toHaveText('1,316');
  await expect(answer).toContainText('including occupied and vacant homes');
  await expect(answer).toContainText('HU100');
});

test('a plan follow-up is available for block groups, keeps regional scope and adds its evidence', async ({ page, request }) => {
  // Use deterministic reviewed passages, without calling a live model.
  const sources = await (await request.get('/api/sources')).json();
  const planSource = sources.find((item: { name: string }) => item.name.includes('Plan'));
  await page.route('**/api/ask', async route => {
    expect(route.request().postDataJSON().geo_id).toBe('2472450');
    const evidence = { evidence_id: 'plan-test', type: 'document', title: 'Silver Spring housing preservation', source: 'Montgomery Planning', date: '2022-06', geo_id: 'plan:silver-spring-dac-2022', url: planSource.url, excerpt: 'Preserve affordable housing.', page: 104, page_label: '92' };
    await route.fulfill({ json: { mode: 'retrieval', summary: 'Related planning passages.', evidence: [evidence], evidence_ids: ['plan-test'], limitations: [] } });
  });
  await page.goto(selected);
  await page.getByRole('button', { name: 'What does the Silver Spring plan say about affordable housing?' }).click();
  await expect(page.getByRole('region', { name: 'Answer', exact: true })).toContainText('not a finding about the selected block group');
  await expect(page.locator('.insight-heading')).toContainText('Fenton study area B');
  await expect(page.locator('.area-240317025021')).not.toHaveAttribute('stroke', '#b43b73');
  await page.getByRole('tab', { name: /Evidence/ }).click();
  await expect(page.getByRole('tabpanel').locator('.evidence li')).toHaveCount(4);
  await expect(page.getByRole('tabpanel')).toContainText('Silver Spring housing preservation');
});

for (const width of [1440, 390, 320]) {
  test(`answer, questions and zoom controls stay clear of the map at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(selected);
    const map = page.locator('.map');
    const dock = page.locator('.query-dock');
    const mapBefore = (await map.boundingBox())!;
    const dockBefore = (await dock.boundingBox())!;
    expect(dockBefore.y).toBeGreaterThanOrEqual(mapBefore.y + mapBefore.height - 1);
    const zoom = (await page.locator('.leaflet-control-zoom-out').boundingBox())!;
    const legend = (await page.locator('.map-legend').boundingBox())!;
    expect(legend.x + legend.width <= zoom.x || legend.y >= zoom.y + zoom.height).toBe(true);
    await page.getByRole('button', { name: 'How many people live here?' }).click();
    await expect(page.locator('.answer-number')).toBeVisible();
    await expect(page.locator('.query-dock .research-response')).toHaveCount(0);
    if (width <= 760) await page.getByRole('button', { name: 'Back to the map', exact: true }).click();
    const mapAfter = (await map.boundingBox())!;
    const dockAfter = (await dock.boundingBox())!;
    expect(dockAfter.y).toBeGreaterThanOrEqual(mapAfter.y + mapAfter.height - 1);
    expect(mapAfter.height).toBeGreaterThan(mapBefore.height);
    expect(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440) await page.screenshot({ path: '/tmp/urbaneye-answer-desktop.png' });
  });
}
