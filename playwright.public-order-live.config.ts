import { defineConfig, devices } from '@playwright/test';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

// Deliberate one-order acceptance only; never included in the ordinary regression suite.
if (process.env.PORTA_PUBLIC_ORDER_WRITE !== '1') {
  throw new Error('Set PORTA_PUBLIC_ORDER_WRITE=1 only for an approved disposable live booking.');
}

export default defineConfig({
  testDir: './tests/acceptance',
  testMatch: 'public-order.live.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3000',
    viewport: { width: 390, height: 844 },
    trace: 'off',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
});
