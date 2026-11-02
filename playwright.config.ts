import { defineConfig, devices } from '@playwright/test';

// `npm test` builds first, then these tests run against `astro preview`,
// so they always see the production output in dist/. `--ignore-lock` keeps the
// server in the foreground: Astro otherwise detaches it when an AI agent runs
// the command, and Playwright would see the process exit.
const PORT = 4321;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run preview -- --port ${PORT} --host 127.0.0.1 --ignore-lock`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
