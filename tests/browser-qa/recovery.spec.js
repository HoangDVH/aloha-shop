const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Read-only production checks: simulated errors and analytics never reach the server.
  await page.route('**/api/shop/client-errors', route => route.fulfill({ status: 204 }));
  await page.route('**/api/shop/visits', route => route.fulfill({ status: 204 }));
});

for (const path of ['/', '/tim', '/gio-hang', '/dang-nhap']) test(`public page ${path} renders without the default exception screen`, async ({ page }, info) => {
  const runtimeErrors = [];
  const reported = [];
  await page.route('**/api/shop/client-errors', async route => { reported.push(route.request().postDataJSON()); await route.fulfill({ status: 204 }); });
  page.on('pageerror', error => runtimeErrors.push(error.message));
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response.status()).toBe(200);
    await expect(page.locator('body')).not.toContainText('Application error: a client-side exception');
    await expect(page.locator('body')).not.toContainText('Trang gặp sự cố');
    await expect(page.locator('body')).toContainText('ALOHA');
    await expect.poll(async () => {
      await page.evaluate(message => window.dispatchEvent(new ErrorEvent('error', { error: new Error(message) })), 'QA ready ' + path);
      return reported.some(report => report.message === 'QA ready ' + path);
    }).toBe(true);
  expect(runtimeErrors).toEqual([]);
  await page.screenshot({ path: info.outputPath('public-mobile-or-desktop.png'), fullPage: true });
});

test('chunk failure reloads once and the next failure cannot reload-loop', async ({ page }) => {
  const reports = [];
  let documents = 0;
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await page.route('**/api/shop/client-errors', async route => {
    reports.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.goto('/');
  const ping = async () => page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { error: new Error('QA monitor ready') })));
  await expect.poll(async () => { await ping(); return reports.some(r => r.message === 'QA monitor ready'); }).toBe(true);
  const fail = () => page.evaluate(() => {
    const error = new Error('Loading chunk 987654 failed.'); error.name = 'ChunkLoadError';
    window.dispatchEvent(new ErrorEvent('error', { error }));
  });
  await Promise.all([page.waitForEvent('domcontentloaded'), fail().catch(() => {})]);
  expect(documents).toBe(2);
  await expect.poll(async () => { await ping(); return reports.filter(r => r.message === 'QA monitor ready').length; }).toBe(2);
  await fail();
  await expect.poll(() => reports.filter(r => r.name === 'ChunkLoadError').length).toBe(2);
  expect(documents).toBe(2);
  await expect(page.locator('body')).not.toContainText('Application error: a client-side exception');
});

test('a missing page chunk shows the retry interface after recovery is exhausted', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('aloha_chunk_recovery_at', String(Date.now())));
  let blocked = 0;
  await page.route(url => /\/_next\/static\/chunks\/app\/\(storefront\)\/tim\/page-[^/]+\.js/.test(decodeURI(url.pathname)), route => {
    blocked++; return route.fulfill({ status: 404, contentType: 'application/javascript', body: '' });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('a[href^="/tim"]').first()).toBeAttached();
  await page.locator('a[href^="/tim"]').first().evaluate(link => link.click());
  await expect.poll(() => blocked).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Trang gặp sự cố' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Về trang chủ' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Application error: a client-side exception');
});

test('admin warning and disk information render using isolated API fixtures', async ({ page }, info) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'qa', username: 'qa-manager', role: 'manager', active: true } } }));
  await page.route('**/api/shop/admin/**', route => route.fulfill({ status: 503, json: { error: 'Other panels use isolated fixtures' } }));
  await page.route('**/api/shop/admin/site-health', route => route.fulfill({ json: {
    updatedAt: new Date().toISOString(), recentCount: 7, dayCount: 12, errorAlert: true,
    disk: { freeBytes: 10 * 1024 ** 3, usedPercent: 85, status: 'warning' },
    latest: [{ _id: 'qa-report', at: new Date().toISOString(), name: 'ChunkLoadError', message: 'QA simulated error',
      path: '/tim', release: 'qa-release', browser: 'QA browser', stack: 'fixture only' }],
  } }));
  await page.goto('/admin');
  const panel = page.getByRole('region', { name: 'Tình trạng website' });
  // section has an accessible name and is exposed as a region.
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Lỗi giao diện tăng');
  await expect(panel).toContainText('85%');
  await panel.getByText('QA simulated error', { exact: false }).click();
  await expect(panel).toContainText('qa-release');
  await panel.screenshot({ path: info.outputPath('site-health-alert.png') });
});

test('real monitoring API remains private', async ({ request }) => {
  const response = await request.get('/api/shop/admin/site-health');
  expect(response.status()).toBe(401);
});
