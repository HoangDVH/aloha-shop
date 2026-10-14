const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  const appearance = await (await page.request.get('/api/shop/appearance')).json();
  if (appearance.theme?.popup) appearance.theme.popup.enabled = false;
  await page.route('**/api/shop/appearance', route => route.fulfill({ json: appearance }));
  for (const path of ['client-errors', 'visits', 'appearance/popup-event', 'campaigns/track']) await page.route(`**/api/shop/${path}`, route => route.fulfill({ status: 204 }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__shareCopied = text; } } });
  });
});

test('product share previews public sale price, edits caption and preserves referral link', async ({ page }) => {
  const items = (await (await page.request.get('/api/shop/products?limit=10')).json()).items;
  const product = items.find(p => !p.hasVariants && p.ton > 0) || items[0];
  expect(product).toBeTruthy();
  const fixture = { ...product, ten: 'QA product', gia: 500000, webPrice: 500000, priceKind: 'web', campaignPromo: {
    kind: 'flash', salePrice: 450000, listPrice: 500000, slotOpen: true, remaining: 10, endsAt: new Date(Date.now() + 86400000).toISOString(), perCustomerLimit: 2, gifts: [],
  } };
  await page.route(`**/api/shop/products/${encodeURIComponent(product.ma)}`, route => route.fulfill({ json: { item: fixture } }));
  await page.route('**/api/shop/promotions/available', route => route.fulfill({ json: { ok: true, items: [] } }));
  await page.goto(product.path, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Chia sẻ', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Chia sẻ sản phẩm' });
  const caption = dialog.getByRole('textbox', { name: 'Nội dung chia sẻ' });
  await expect(caption).toHaveValue(/450.000đ/, { timeout: 25000 });
  await expect(caption).toHaveValue(/50.000đ \(10%\)/);
  await caption.fill('Nội dung đã chỉnh sửa');
  await dialog.getByRole('button', { name: 'Sao chép nội dung & link', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__shareCopied)).toContain('Nội dung đã chỉnh sửa');
  await expect.poll(() => page.evaluate(() => window.__shareCopied)).toContain(`/sp/${product.ma}`);
  await dialog.getByRole('button', { name: 'Khôi phục nội dung' }).click();
  await expect(caption).toHaveValue(/Giá ưu đãi/);
  await dialog.getByRole('button', { name: 'Đóng chia sẻ' }).click();
  await page.evaluate(ma => window.dispatchEvent(new CustomEvent('aloha-product-share', { detail: { ma, ctvCode: 'CTVQA01' } })), product.ma);
  await expect(dialog.getByRole('textbox', { name: 'Nội dung chia sẻ' })).toHaveValue(/ctv=CTVQA01/, { timeout: 25000 });
  await expect(page.locator('body')).not.toContainText('Application error: a client-side exception');
});

test('article share previews summary and supports edited content with its article URL', async ({ page }) => {
  const article = (await (await page.request.get('/api/shop/articles?limit=1')).json()).items[0];
  expect(article).toBeTruthy();
  await page.goto(`/bai-viet/${article.slug}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Chia sẻ bài viết' });
  const caption = dialog.getByRole('textbox', { name: 'Nội dung chia sẻ' });
  await expect(caption).toBeEnabled({ timeout: 25000 });
  await expect(caption).toHaveValue(new RegExp(article.slug));
  await caption.fill('Bài viết hữu ích');
  await dialog.getByRole('button', { name: 'Sao chép nội dung & link', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__shareCopied)).toContain('Bài viết hữu ích');
  await expect.poll(() => page.evaluate(() => window.__shareCopied)).toContain(`/bai-viet/${article.slug}`);
  await dialog.getByRole('button', { name: 'Đóng chia sẻ' }).click();
  await expect(dialog).not.toBeVisible();
});

for (const kind of ['product', 'article']) test(`${kind} share waits for JavaScript initialization on a slow connection`, async ({ page }) => {
  const endpoint = kind === 'product' ? '/api/shop/products?limit=10' : '/api/shop/articles?limit=1';
  const item = (await (await page.request.get(endpoint)).json()).items[0];
  const path = kind === 'product' ? item.path : `/bai-viet/${item.slug}`;
  const waiting = [];
  let blocked = true;
  await page.route('**/_next/static/chunks/**', route => {
    if (blocked && new URL(route.request().url()).pathname.endsWith('.js')) waiting.push(route);
    else return route.continue();
  });
  await page.goto(path, { waitUntil: 'commit' });
  const button = page.getByRole('button', { name: 'Chia sẻ', exact: true }).first();
  await expect(button).toBeDisabled({ timeout: 25000 });
  blocked = false;
  await Promise.all(waiting.map(route => route.continue()));
  await expect(button).toBeEnabled({ timeout: 25000 });
  await button.click();
  await expect(page.getByRole('dialog', { name: kind === 'product' ? 'Chia sẻ sản phẩm' : 'Chia sẻ bài viết' })).toBeVisible({ timeout: 25000 });
});
