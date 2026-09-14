import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: [
        '**/public-order.spec.ts',
        '**/public-tracking.spec.ts',
        '**/driver-workspace.spec.ts',
        '**/driver-trip-actions.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'driver-chromium',
      testMatch: ['**/driver-workspace.spec.ts', '**/driver-trip-actions.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3102',
        serviceWorkers: 'block',
      },
    },
    {
      name: 'public-order-chromium',
      testMatch: '**/public-order.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3102',
        serviceWorkers: 'block',
      },
    },
    {
      name: 'public-tracking-chromium',
      testMatch: '**/public-tracking.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3102',
        serviceWorkers: 'block',
      },
    },
  ],
  webServer: [
    {
      command: 'npx next dev --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100/login',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORTA_BUILD_DIR: '.next-foundation-test',
        NEXT_PUBLIC_APP_MODE: 'foundation',
        NEXT_PUBLIC_API_BASE_URL: '',
        NEXT_PUBLIC_ENABLE_PREVIEW: 'true',
      },
    },
    {
      command: 'npx next dev --hostname localhost --port 3102',
      url: 'http://localhost:3102/order',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORTA_BUILD_DIR: '.next-public-test',
        NEXT_PUBLIC_APP_MODE: 'connected',
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8080',
        NEXT_PUBLIC_ENABLE_PREVIEW: 'false',
      },
    },
  ],
});
