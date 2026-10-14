const { test, expect } = require('@playwright/test');
const { campaignFixture } = require('./campaign-fixture.cjs');
for (const newBuyer of [true, false]) test(`voucher page shows only ${newBuyer ? 'new' : 'returning'} customer vouchers`, async ({ page }) => {
  const fixture = campaignFixture(newBuyer);
  await page.route('**/api/shop/campaigns/current', route => route.fulfill({ json: fixture }));
  await page.route('**/api/shop/auth/me', route => route.fulfill({ json: { ok: true, user: { id: 'qa-audience', email: 'qa@example.invalid', fullName: 'QA', roles: ['customer'] } } }));
  await page.route('**/api/shop/vouchers/wallet', route => route.fulfill({ json: { ok: true, enabled: true, items: [], claimedIds: [] } }));
  for (const path of ['client-errors', 'visits', 'appearance/popup-event', 'campaigns/track']) await page.route(`**/api/shop/${path}`, route => route.fulfill({ status: 204 }));
  const appearance = await (await page.request.get('/api/shop/appearance')).json();
  if (appearance.theme?.popup) appearance.theme.popup.enabled = false;
  await page.route('**/api/shop/appearance', route => route.fulfill({ json: appearance }));
  await page.goto('/uu-dai?tab=voucher&loai=giam', { waitUntil: 'domcontentloaded' });
  const expected = `QA audience ${newBuyer ? 'new_web' : 'returning_web'}`;
  const opposite = `QA audience ${newBuyer ? 'returning_web' : 'new_web'}`;
  await expect(page.getByText(expected, { exact: true }).first()).toBeVisible({ timeout: 25000 });
  await expect(page.getByText(opposite, { exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Application error: a client-side exception');
});
