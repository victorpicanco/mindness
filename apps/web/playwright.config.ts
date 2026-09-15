import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:3100',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @mindness/api test:e2e:server',
      url: 'http://127.0.0.1:3101/healthz',
      reuseExistingServer: false,
    },
    {
      command: 'pnpm build && pnpm start --port 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
      env: {
        API_BASE_URL: 'http://127.0.0.1:3101',
      },
    },
  ],
})
