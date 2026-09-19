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
  await expect(page.locator('.leaflet-interactive')).toHaveAttribute('stroke', '#8f4bb8');
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
  await expect(page.locator('.leaflet-interactive')).toHaveAttribute('fill-opacity', '0');
});

test('API failure exposes retry and recovers', async ({ page }) => {
  await page.route('**/api/areas', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Unable to load');
  await page.unroute('**/api/areas');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.leaflet-interactive')).toBeVisible();
});

test('selected area → real planning passage → page citation and geographic limitation', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Select area').selectOption('2472450');
  await page.getByLabel('Ask about this area').fill('How does the plan preserve affordable housing?');
  const submitted = page.waitForRequest(request => request.url().endsWith('/api/ask') && request.method() === 'POST');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  expect((await submitted).postDataJSON().geo_id).toBe('2472450');
  const answer = page.getByRole('region', { name: 'Answer', exact: true });
  await expect(answer.getByRole('heading', { name: 'Retrieved passages' })).toBeVisible();
  await expect(answer.locator('blockquote')).toContainText('naturally occurring affordable housing');
  await expect(answer).toContainText('Printed page 92 · PDF page 104');
  await expect(answer).toContainText('not the Silver Spring CDP boundary');
  await expect(answer.getByRole('link')).toHaveAttribute('href', /montgomeryplanning.org.*#page=104$/);
  await expect(answer).toContainText('does not produce an AI answer');
});

test('AI claims link to their source cards (mocked model result)', async ({ page }) => {
  await page.route('**/api/ask', async route => {
    const response = await route.fetch();
    const base = await response.json();
    const evidence = base.evidence.slice(0, 1);
    const evidence_ids = evidence.map((item: { evidence_id: string }) => item.evidence_id);
    const text = 'The 2022 plan recommends preserving affordable housing while adding housing.';
    await route.fulfill({ json: { ...base, mode: 'llm', summary: text, evidence, evidence_ids,
      claims: [{ text, evidence_ids }], limitations: ['Mocked model response for UI verification.'] } });
  });
  await page.goto('/');
  await page.getByLabel('Select area').selectOption('2472450');
  await page.getByLabel('Ask about this area').fill('How does the plan preserve affordable housing?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const answer = page.getByRole('region', { name: 'Answer', exact: true });
  await expect(answer.getByRole('heading', { name: 'AI explanation' })).toBeVisible();
  await expect(answer).toContainText('The 2022 plan recommends');
  const citation = answer.getByRole('link', { name: '1', exact: true });
  await expect(citation).toHaveAttribute('href', /^#evidence-silver-spring-dac-2022:/);
  await citation.click();
  await expect(answer.locator('blockquote')).toBeVisible();
});
