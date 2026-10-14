import test from "node:test";
import assert from "node:assert/strict";
import { buildArticleCaption, buildProductCaption, publicSharePrice, shareVoucherLines, shareCaptionWithLink } from "../frontend/lib/shareCaption.js";
import { fetchPublicShareProduct } from "../frontend/lib/publicShareProduct.js";
import type { ShopProduct } from "../frontend/lib/api.js";

const now = Date.parse("2026-10-14T10:00:00Z");
test("edited captions preserve referral URLs without duplicating an existing link", () => {
  const url = "https://example.com/p?ctv=CTV01";
  assert.equal(shareCaptionWithLink("Edited", url), `Edited\n\n${url}`);
  assert.equal(shareCaptionWithLink(`Edited\n${url}`, url), `Edited\n${url}`);
});
const product = { ma: "P", ten: "Chậu A", gia: 500000, webPrice: 500000, priceKind: "web", ton: 10, description: "<p>Chậu cho ban công</p>", attributes: [{ attributeName: "Kích thước", attributeValue: "40 cm" }], campaignPromo: {
  kind: "flash", salePrice: 450000, listPrice: 500000, slotOpen: true, endsAt: "2026-10-15T10:00:00Z", remaining: 5, perCustomerLimit: 2, gifts: [{ ma: "G", name: "Đĩa lót", qty: 1, left: 2 }],
} } as ShopProduct;

test("public share shows exact saving, factual details, gift and deadline; preserves referral URL", () => {
  const caption = buildProductCaption(product, "https://example.com/sp/P?ctv=CTV01", now);
  for (const text of ["450.000đ", "500.000đ", "50.000đ (10%)", "40 cm", "1 Đĩa lót", "15/10/2026", "?ctv=CTV01"]) assert.ok(caption.includes(text), text);
  assert.ok(!caption.includes("<p>"));
});

test("expired, teaser, closed slot and sold-out sale cannot advertise a discounted price", () => {
  for (const overrides of [{ endsAt: "2026-10-13T10:00:00Z" }, { kind: "teaser" }, { slotOpen: false }, { remaining: 0 }]) {
    const p = { ...product, campaignPromo: { ...product.campaignPromo!, ...overrides } } as ShopProduct;
    assert.equal(publicSharePrice(p, now).price, 500000);
    assert.ok(!buildProductCaption(p, "https://example.com/p", now).includes("Giá ưu đãi"));
  }
});

test("wholesale prices never leak into public caption; unavailable prices request a quote", () => {
  assert.equal(publicSharePrice({ ...product, gia: 100000, priceKind: "si", campaignPromo: null }, now).price, 500000);
  const p = { ...product, gia: 100000, webPrice: undefined, priceKind: "si", campaignPromo: null } as ShopProduct;
  assert.ok(buildProductCaption(p, "https://example.com/p", now).includes("Liên hệ ALOHA"));
  assert.ok(!buildProductCaption(p, "https://example.com/p", now).includes("100.000"));
});

test("voucher is conditional text and never subtracted from the product price", () => {
  const offers: any[] = [{ title: "Khách mới 5%", targetCustomer: "new_web", benefitType: "goods", minOrderThreshold: 1000000, maxDiscountVnd: 100000, claimRequired: true }, { title: "Khách cũ 7%", targetCustomer: "returning_web", benefitType: "goods" }, { title: "Sai sản phẩm", scope: "product", productMas: ["OTHER"], benefitType: "goods" }];
  assert.equal(shareVoucherLines(product, offers, now).length, 1);
  const caption = buildProductCaption(product, "https://example.com/p", now, offers);
  assert.ok(caption.includes("Giá ưu đãi: 450.000đ"));
  assert.ok(caption.includes("dành cho khách mua lần đầu"));
  assert.ok(caption.includes("cần lưu voucher"));
  assert.ok(!caption.includes("Khách cũ 7%"));
});

test("article without linked products does not invent offers; linked products include current prices", () => {
  const bare = buildArticleCaption("Cách chăm cây", "<p>Mẹo tưới nước</p>", "https://example.com/article", [], now);
  assert.ok(bare.includes("Mẹo tưới nước"));
  assert.ok(!bare.includes("Giá"));
  const caption = buildArticleCaption("Cách chăm cây", "Mẹo tưới", "https://example.com/article", [{ product, url: "https://example.com/sp/P?ctv=A" }], now);
  assert.ok(caption.includes("450.000đ"));
  assert.ok(caption.includes("?ctv=A"));
});

test("share product fetch is anonymous and uncached, including authenticated users", async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      assert.equal(url, "/api/shop/products/P");
      assert.equal(init.credentials, "omit");
      assert.equal(init.cache, "no-store");
      return new Response(JSON.stringify({ item: product }), { status: 200 });
    }) as typeof fetch;
    assert.equal((await fetchPublicShareProduct("P")).ma, "P");
  } finally { globalThis.fetch = oldFetch; }
});
