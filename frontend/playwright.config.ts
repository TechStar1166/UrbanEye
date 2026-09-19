import { defineConfig } from '@playwright/test';

// Set PLAYWRIGHT_BASE_URL to test a stack that is already running (for example the
// Compose containers); the suite then skips starting its own dev server.
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests',
  use: { baseURL: externalBaseURL ?? 'http://127.0.0.1:5173', browserName: 'chromium' },
  webServer: externalBaseURL ? undefined : {
    command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI,
  },
});
