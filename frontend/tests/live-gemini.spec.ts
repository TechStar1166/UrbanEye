import { expect, test } from '@playwright/test';

// This opt-in provider check complements the browser tests for research answers.
test('live Gemini API returns grounded answers for CivicLens research', async ({ request }) => {
  test.skip(process.env.LIVE_GEMINI !== '1', 'Set LIVE_GEMINI=1 with a configured running backend.');
  test.setTimeout(60_000);
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  expect(await health.json()).toMatchObject({ llm_enabled: true, llm_model: 'gemini-3.6-flash' });
  const response = await request.post('/api/ask', { data: {
    geo_id: '2472450', question: 'How does the plan preserve affordable housing?',
  } });
  expect(response.ok()).toBeTruthy();
  const result = await response.json();
  expect(result.mode).toBe('llm');
  expect(result.claims.length).toBeGreaterThan(0);
  for (const claim of result.claims) {
    for (const id of claim.evidence_ids) {
      expect(result.evidence.some((source: { evidence_id: string }) => source.evidence_id === id)).toBeTruthy();
    }
  }
});
