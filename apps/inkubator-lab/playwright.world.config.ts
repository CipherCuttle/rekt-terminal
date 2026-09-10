import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'world-composition-lab.spec.ts',
  fullyParallel: false,
  timeout: 45_000,
  expect: {timeout: 10_000},
  use: {
    baseURL: 'http://127.0.0.1:6006',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: '../../node_modules/.bin/storybook dev -p 6006 --ci --host 127.0.0.1',
    url: 'http://127.0.0.1:6006',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
