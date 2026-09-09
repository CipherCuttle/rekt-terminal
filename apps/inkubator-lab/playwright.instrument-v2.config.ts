import {defineConfig} from '@playwright/test';
import base from './playwright.config';

// A separate port keeps other worktree previews untouched.
export default defineConfig({
  ...base,
  testMatch: ['instrument-v2.spec.ts', 'instrument-lab.spec.ts'],
  use: {...base.use, baseURL: 'http://127.0.0.1:5184'},
  webServer: {
    command: 'npm run dev -- --port 5184',
    url: 'http://127.0.0.1:5184/?lab=instrument-v2',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
