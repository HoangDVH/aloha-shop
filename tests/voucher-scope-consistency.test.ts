import test from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";
import type { ShopProduct } from "../frontend/lib/api.js";
import { isItemInScope, evaluatePromotions } from "../backend/shopPromotions/evaluator.js";
import { productMatchesVoucher } from "../frontend/lib/productVoucherScope.js";
import { pdpApplicableVouchers, pdpVoucherSheetEntries } from "../frontend/lib/pdpVouchers.js";
import { shareVoucherLines } from "../frontend/lib/shareCaption.js";
import { withServerPrices } from "../backend/shopPromotions/publicRoutes.js";
import { applyCatalogPrices, parseOrderDetails } from "../backend/shopOrders/orderRouteShared.js";
import { orderVoucherItems, splitLineDiscounts } from "../backend/shopOrders/create/orderPromotions.js";
import { claimedEditError } from "../backend/shopPromotions/admin/promotionPayload.js";
import { toVariantModel } from "../backend/variant/siblings.js";
import { promo } from "./helpers/walletFixtures.js";

const now = Date.parse("2026-10-14T10:00:00Z");
const product = { ma: "GSDL", categoryId: 12, categorySlug: "sen-da", nhom: "Sen đá" } as ShopProduct;
const base = promo("20", { scope: "product", productMas: ["GSDL"], discountType: "percentage", discountValue: 10, minOrderThreshold: 0 });

test("PDP, sharing and server agree on allowlists, exclusions and exact catalog category", () => {
  for (const [over, expected] of [
    [{ scope: "all" }, true], [{ productMas: [" gsdl "] }, true], [{ productMas: ["OTHER"] }, false],
    [{ scope: "all", excludedProductMas: [" gsdl "] }, false], [{ productMas: [] }, false],
    [{ scope: "category", categoryIds: ["12"] }, true], [{ scope: "category", categoryIds: ["sen-da"] }, false],
    [{ scope: "category", categoryIds: [] }, false],
  ] as const) {
    const p = { ...base, ...over, audienceEligible: true } as any;
    assert.equal(isItemInScope({ ma: product.ma, categoryId: "12", price: 250000, quantity: 1 }, p), expected);
    assert.equal(productMatchesVoucher(product, p, now), expected);
    assert.equal(pdpApplicableVouchers([p], product, { newBuyer: true }, false, now).length, expected ? 1 : 0);
    assert.equal(shareVoucherLines(product, [p], now).length, expected ? 1 : 0);
  }
});

test("Flash exclusion blocks active flash only; closed or sold-out offers use ordinary pricing", () => {
  const p = { ...base, excludeFlash: true, audienceEligible: true } as any;
  const flash = { ...product, campaignPromo: { kind: "flash", slotOpen: true, salePrice: 200000,
    listPrice: 250000, remaining: 10, endsAt: "2026-10-20T16:59:00Z" } } as ShopProduct;
  assert.equal(productMatchesVoucher(flash, p, now), false);
  assert.equal(shareVoucherLines(flash, [p], now).length, 0);
  assert.equal(isItemInScope({ ma: "GSDL", price: 200000, quantity: 1, flash: true }, p), false);
  for (const overrides of [{ slotOpen: false }, { remaining: 0 }, { kind: "teaser" }, { endsAt: "2026-10-13T00:00:00Z" }]) {
    assert.equal(productMatchesVoucher({ ...flash, campaignPromo: { ...flash.campaignPromo, ...overrides } } as ShopProduct, p, now), true);
  }
});

test("saved out-of-scope voucher stays in sheet with reason but cannot become applicable", () => {
  const p = { ...base, productMas: ["OTHER"], audienceEligible: true } as any;
  assert.equal(pdpVoucherSheetEntries([p], product, {}, new Set(), false, now).length, 0);
  const entries = pdpVoucherSheetEntries([p], product, {}, new Set([p.id]), false, now);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].reason, "Không áp dụng cho sản phẩm này.");
  assert.equal(pdpApplicableVouchers([p], product, {}, false, now).length, 0);
});

test("public quote and order creation use catalog categories, never forged client category IDs", async () => {
  const docs = [{ ma: "GSDL", ten: "Sen đá", giaWeb: 250000, categoryId: 12 },
    { ma: "KCL1", ten: "Chậu", giaWeb: 40000, categoryId: 99 }];
  const db = { collection: (name: string) => ({ find: () => ({ project() { return this; }, limit() { return this; },
    async toArray() { return name === "aloha_products" ? docs : []; } }) }) } as unknown as Db;
  const requested = [{ ma: "GSDL", price: 1, quantity: 1, categoryId: "forged" },
    { ma: "KCL1", price: 1, quantity: 1, categoryId: "12" }];
  const quoted = await withServerPrices(db, requested, null);
  assert.deepEqual(quoted.map(i => i.categoryId), ["12", "99"]);
  const priced = await applyCatalogPrices(db, parseOrderDetails(requested));
  assert.equal(priced.ok, true);
  if (!priced.ok) return;
  const orderItems = orderVoucherItems(priced.details);
  const categoryPromo = { ...base, scope: "category" as const, categoryIds: ["12"] };
  for (const items of [quoted, orderItems]) {
    const quote = evaluatePromotions({ items, promotions: [categoryPromo], buyer: { isWholesale: false } });
    assert.equal(quote.discountTotal, 25000);
    assert.equal(quote.finalTotal, 265000);
    assert.equal(quote.lineDiscounts.KCL1, 0);
  }
});

test("issued voucher scope cannot change after claims, but same list reordered is allowed", () => {
  const issued = { ...base, claimedCount: 5, productMas: ["GSDL", "KCL1"] };
  assert.ok(claimedEditError(issued, { productMas: ["GSDL"] }));
  assert.ok(claimedEditError(issued, { excludedProductMas: ["KCL1"] }));
  assert.ok(claimedEditError(issued, { excludeFlash: true }));
  assert.ok(claimedEditError(issued, { scope: "category" }));
  assert.equal(claimedEditError(issued, { productMas: ["kcl1", "gsdl"] }), null);
  assert.equal(claimedEditError(issued, { excludeFlash: false }), null);
});

test("variant models retain their own catalog category for product voucher previews", () => {
  const variant = toVariantModel({ ma: "KCL1" }, () => ({ ma: "KCL1", ten: "B", dvt: "cái", gia: 40000,
    ton: 10, anh: "b.jpg", images: ["b.jpg"], path: "/sp/KCL1", categoryId: 99 }));
  assert.equal(variant.categoryId, 99);
  assert.equal(productMatchesVoucher({ ...product, ...variant } as ShopProduct,
    { scope: "category", categoryIds: ["12"] }, now), false);
});

test("mixed flash/ordinary rows of one SKU allocate the voucher only to eligible ordinary rows", () => {
  const details = [
    { productCode: "GSDL", productName: "A", quantity: 1, price: 200000, flash: { listPrice: 250000 } },
    { productCode: "GSDL", productName: "A", quantity: 1, price: 250000 },
  ] as any;
  const p = { ...base, excludeFlash: true };
  const quote = evaluatePromotions({ items: orderVoucherItems(details), promotions: [p], buyer: { isWholesale: false } });
  assert.equal(quote.discountTotal, 25000);
  splitLineDiscounts(details, quote.lineDiscounts, p);
  assert.equal(details[0].discount, 0);
  assert.equal(details[1].discount, 25000);
});
