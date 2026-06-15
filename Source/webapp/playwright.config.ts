import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Brings up both the webapp and the real local backend handlers. The Docker
  // stack (Postgres + cognito-local on :9229) and a migrated/seeded DB must
  // already be running — `make restart && make cognito-init && make migrate`.
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev',
      cwd: '../backend',
      url: 'http://localhost:3001/waitlist/status',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
