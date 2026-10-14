const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.', testMatch: '*.spec.js', timeout: 45_000, workers: 1, retries: 0,
  reporter: process.env.QA_REPORT === '1' ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL: process.env.QA_BASE_URL || 'https://alohathegioichaucay.com',
    trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 20_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
});
