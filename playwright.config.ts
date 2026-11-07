import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), 'golf-sg-e2e-'));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Runs the production build: the API serves the compiled SPA, exactly as in the container.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'node apps/api/dist/main.js',
        url: `${baseURL}/api/ready`,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        env: {
          NODE_ENV: 'production',
          PORT: String(PORT),
          HOST: '127.0.0.1',
          LOG_LEVEL: 'warn',
          DATABASE_PATH: join(dataDir, 'e2e.db'),
          WEB_DIST_DIR: 'apps/web/dist',
        },
      },
});
