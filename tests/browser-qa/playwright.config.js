const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.', testMatch: '*.spec.js', timeout: 60_000, workers: 1, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.QA_BASE_URL || 'https://alohathegioichaucay.com',
    trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 15_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
});
