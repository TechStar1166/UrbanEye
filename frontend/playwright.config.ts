import { defineConfig } from '@playwright/test';

// Set PLAYWRIGHT_BASE_URL to test a stack that is already running (for example the
// Compose containers); the suite then skips starting its own dev server.
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: 'chrome',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_BASE: 'http://127.0.0.1:8000' },
  },
});
