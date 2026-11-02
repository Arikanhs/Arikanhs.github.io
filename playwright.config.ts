import { defineConfig, devices } from '@playwright/test';

// `npm test` builds first, then most tests run against `astro preview`, so they
// see the production output in dist/. Dev-only pages (the ASCII lab) are tested
// against `astro dev`. `--ignore-lock` keeps both servers in the foreground:
// Astro otherwise detaches them when an AI agent runs the command, and
// Playwright would see the process exit.
const PORT = 4321;
const DEV_PORT = 4322;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A hung browser or test must not hang the whole run.
  globalTimeout: 10 * 60_000,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /(ascii|cards|transitions)\.spec\.ts/ },
    // WebGL tests need a real GPU. Playwright's headless shell only has software
    // WebGL (SwiftShader), which the site deliberately treats as "no WebGL", so
    // these run in the installed Google Chrome against the dev server.
    {
      name: 'chrome-gpu',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: `http://127.0.0.1:${DEV_PORT}` },
      testMatch: /(ascii|cards|transitions)\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: `npm run preview -- --port ${PORT} --host 127.0.0.1 --ignore-lock`,
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --port ${DEV_PORT} --host 127.0.0.1 --ignore-lock`,
      url: `http://127.0.0.1:${DEV_PORT}/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
