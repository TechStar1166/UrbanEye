import { expect, test } from '@playwright/test';

// Explicit opt-in: normal browser checks must not spend provider quota.
test('live Gemini: map → answer → cited passage → unsupported question', async ({ page, request }) => {
  test.skip(process.env.LIVE_GEMINI !== '1', 'Set LIVE_GEMINI=1 with a configured running backend.');
  test.setTimeout(60_000);
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  expect(await health.json()).toMatchObject({ llm_enabled: true, llm_model: 'gemini-3.6-flash' });
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.goto('/');
  await page.locator('.leaflet-interactive').click({ force: true });
  await expect(page.getByRole('heading', { name: 'Silver Spring CDP' })).toBeVisible();
  await page.getByLabel('Ask about this area').fill('How does the plan preserve affordable housing?');
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/ask'));
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const result = await response.json();
  expect(result.mode).toBe('llm');
  expect(result.claims.length).toBeGreaterThan(0);
  const answer = page.getByRole('region', { name: 'Answer', exact: true });
  await expect(answer.getByRole('heading', { name: 'AI explanation' })).toBeVisible();
  for (const claim of result.claims) {
    await expect(answer).toContainText(claim.text);
    for (const id of claim.evidence_ids) {
      expect(result.evidence.some((source: { evidence_id: string }) => source.evidence_id === id)).toBeTruthy();
    }
  }
  await answer.locator('a[href^="#evidence-"]').first().click();
  await expect(answer.locator('blockquote').first()).toBeVisible();
  await expect(answer).toContainText('Printed page 92 · PDF page 104');
  await expect(answer).toContainText('not the Silver Spring CDP boundary');
  await expect(answer.locator('a[href*="montgomeryplanning.org"]').first()).toHaveAttribute('href', /#page=104$/);
  await page.getByLabel('Ask about this area').fill('Will population double next year?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(answer).toContainText('insufficient');
  await expect(answer.getByRole('link')).toHaveCount(0);
});
