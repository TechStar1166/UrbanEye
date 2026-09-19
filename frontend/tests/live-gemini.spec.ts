import { expect, test } from '@playwright/test';

// CivicLens research panels are currently a UI preview. This opt-in check keeps
// validating the existing provider through the API until the new UI is wired.
test('live Gemini API retains grounded answers behind the CivicLens preview', async ({ request }) => {
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
