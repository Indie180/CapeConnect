const { defineConfig, devices } = require('@playwright/test');
const isWindows = process.platform === 'win32';

module.exports = defineConfig({
  testDir: './e2e',
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
  webServer: [
    {
      command: 'node scripts/static-server.js',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: isWindows ? 'npm.cmd --prefix backend start' : 'npm --prefix backend start',
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
