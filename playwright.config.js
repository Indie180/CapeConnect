const { defineConfig, devices } = require('@playwright/test');
const runOutputDir = `.pw-test-results/${Date.now()}-${process.pid}`;
const useExternalServers = process.env.CC_EXTERNAL_SERVERS === '1';

module.exports = defineConfig({
  testDir: './e2e',
  outputDir: runOutputDir,
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: useExternalServers
    ? undefined
    : [
        {
          command: 'node scripts/static-server.js',
          url: 'http://127.0.0.1:4173',
          reuseExistingServer: !process.env.CI,
          timeout: 15_000,
        },
        {
          command: 'node backend/src/server.js',
          url: 'http://127.0.0.1:4100/health',
          reuseExistingServer: false,
          timeout: 20_000,
          env: {
            ...process.env,
            NODE_ENV: 'test',
            USE_SQLITE: 'true',
            PORT: '4100',
            FRONTEND_ORIGIN: 'http://127.0.0.1:4173',
          },
        },
      ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
