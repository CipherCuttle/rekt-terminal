import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 30_000,
  expect: {timeout: 8_000},
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5174/?lab=signals&screen=command',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
