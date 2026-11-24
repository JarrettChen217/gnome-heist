// AI-use disclosure: Claude (Claude Code) wrote this file under Hao's direction for the Playwright smoke suite.
// Browser smoke tests against the local Worker, which serves the built client and the morning API on one origin.
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = 8790;

// These tests must never reach a paid model. The Worker only calls one when FARMER_PROVIDER is
// "anthropic" (worker/src/provider.ts); refuse to start if the local secrets file selects it.
const devVars = 'worker/.dev.vars';
if (existsSync(devVars) && /^\s*FARMER_PROVIDER\s*=\s*["']?anthropic/m.test(readFileSync(devVars, 'utf8'))) {
  throw new Error(`${devVars} selects a paid provider; move it aside before running the browser tests.`);
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Locally, the installed Google Chrome avoids a separate browser download; CI uses Playwright's Chromium.
      use: { ...devices['Desktop Chrome'], ...(process.env['CI'] ? {} : { channel: 'chrome' }) },
    },
  ],
  webServer: {
    command: `npm run build -w game && npm exec -w worker -- wrangler dev --port ${PORT} --ip 127.0.0.1 --var FARMER_PROVIDER:none --show-interactive-dev-session=false`,
    url: `http://127.0.0.1:${PORT}/`,
    // A dedicated port and a fresh server, so a hand-run `npm run dev` on 8787 is never reused.
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
  },
});
