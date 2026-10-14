import test from "node:test";
import assert from "node:assert/strict";
import { buildArticleCaption, buildProductCaption, publicSharePrice, shareCaptionWithLink } from "../frontend/lib/shareCaption.js";
import { fetchPublicShareProduct, fetchPublicSharePreview } from "../frontend/lib/publicShareProduct.js";
import type { ShopProduct } from "../frontend/lib/api.js";
import type { PublicSharePreview } from "../shared/publicSharePreview.js";
const now = Date.parse("2026-10-14T10:00:00Z");
const product = { ma: "P", ten: "Chậu A", dvt: "cái", gia: 500000, webPrice: 500000, priceKind: "web", ton: 10,
  campaignPromo: { kind: "flash", salePrice: 450000, listPrice: 500000, slotOpen: true,
    endsAt: "2026-10-15T10:00:00Z", remaining: 5, perCustomerLimit: 2, gifts: [] } } as ShopProduct;
test("requested caption uses actual product, program, total saving, unit and voucher", () => {
  const p = { ...product, ma: "GSDL", ten: "GIỎ SEN ĐÁ LỚN", dvt: "CHẬU" };
  const preview: PublicSharePreview = { ma: "GSDL", price: 250000, reference: 344000, finalPrice: 225000,
    expiresAt: new Date(now + 60000).toISOString(), campaignName: "20/10 và 20/11",
    voucher: { title: "Đặt trước 10%", targetCustomer: "retail", claimRequired: true } };
  assert.equal(buildProductCaption(p, "https://example.com/sp/GSDL?ctv=A", now, preview),
    "GIỎ SEN ĐÁ LỚN — ưu đãi 20/10 và 20/11 GIẢM ĐẾN 35%!\nGiá 344.000đ chỉ còn 225.000đ/CHẬU\nKhi áp dụng voucher “Đặt trước 10%” đặt hàng TẠI WEB, cần lưu voucher.\nChưa gồm phí vận chuyển.\nXem chi tiết & đặt mua tại: https://example.com/sp/GSDL?ctv=A\nMua ngay để nhận mức giá ưu đãi tốt nhất!");
  const other = buildProductCaption({ ...product, ma: "OTHER", ten: "CHẬU KHÁC", dvt: "bộ", webPrice: 120000, campaignPromo: null }, "https://example.com/sp/OTHER", now, preview);
  assert.ok(other.includes("Giá 120.000đ/bộ"));
  for (const text of ["GSDL", "225.000", "20/11", "voucher", "GIẢM ĐẾN"]) assert.ok(!other.includes(text), text);
});
test("expired and malformed server offers fall back safely", () => {
  const base: PublicSharePreview = { ma: "P", price: 450000, reference: 500000, finalPrice: 400000, expiresAt: new Date(now + 60000).toISOString() };
  for (const overrides of [{ expiresAt: new Date(now).toISOString() }, { finalPrice: -1 }, { finalPrice: 500001 }, { reference: NaN }]) {
    assert.ok(buildProductCaption(product, "https://example.com/sp/P", now, { ...base, ...overrides }).includes("chỉ còn 450.000đ/cái"));
  }
});
test("new and returning audience conditions are explicit; percentage discounts are compounded", () => {
  for (const targetCustomer of ["new_web", "returning_web"]) {
    const caption = buildProductCaption(product, "https://example.com/sp/P", now, { ma: "P", price: 450000,
      reference: 500000, finalPrice: 405000, expiresAt: new Date(now + 60000).toISOString(),
      voucher: { title: "Voucher 10%", targetCustomer, claimRequired: false } });
    assert.ok(caption.includes("GIẢM ĐẾN 19%"));
    assert.ok(caption.includes(targetCustomer === "new_web" ? "khách mua lần đầu" : "khách đã mua thành công"));
  }
});
test("inactive flash and private wholesale prices are not advertised", () => {
  for (const overrides of [{ endsAt: "2026-10-13T10:00:00Z" }, { kind: "teaser" }, { slotOpen: false }, { remaining: 0 }]) {
    const p = { ...product, campaignPromo: { ...product.campaignPromo!, ...overrides } } as ShopProduct;
    assert.equal(publicSharePrice(p, now).price, 500000);
    assert.ok(!buildProductCaption(p, "https://example.com/p", now).includes("GIẢM ĐẾN"));
  }
  assert.equal(publicSharePrice({ ...product, gia: 100000, priceKind: "si", campaignPromo: null }, now).price, 500000);
  const p = { ...product, gia: 100000, webPrice: undefined, priceKind: "si", campaignPromo: null } as ShopProduct;
  assert.ok(buildProductCaption(p, "https://example.com/p", now).includes("Liên hệ ALOHA"));
  assert.ok(!buildProductCaption(p, "https://example.com/p", now).includes("100.000"));
});
test("article behavior and referral links remain intact", () => {
  const url = "https://example.com/p?ctv=A";
  assert.equal(shareCaptionWithLink("Edited", url), `Edited\n\n${url}`);
  assert.equal(shareCaptionWithLink(`Edited\n${url}`, url), `Edited\n${url}`);
  assert.ok(!buildArticleCaption("Title", "Summary", url, [], now).includes("Giá"));
  assert.ok(buildArticleCaption("Title", "Summary", url, [{ product, url }], now).includes("Giá ưu đãi: 450.000đ"));
});
test("public requests omit account identity and bypass caches", async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      assert.equal(init.credentials, "omit");
      assert.equal(init.cache, "no-store");
      if (url === "/api/shop/products/P") return new Response(JSON.stringify({ item: product }));
      assert.equal(url, "/api/shop/promotions/quote");
      assert.deepEqual(JSON.parse(String(init.body)), { sharePreview: true, items: [{ ma: "P" }] });
      return new Response(JSON.stringify({ ok: true, preview: { ma: "P" } }));
    }) as typeof fetch;
    assert.equal((await fetchPublicShareProduct("P")).ma, "P");
    assert.equal((await fetchPublicSharePreview("P"))?.ma, "P");
  } finally { globalThis.fetch = oldFetch; }
});
