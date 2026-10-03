import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_FULL_KV_PRODUCTS, planKvActiveChanges } from "../backend/shopCatalog/kvActiveSync.js";
import { applyCatalogPrices } from "../backend/shopOrders/orderRouteShared.js";
import { tonFromKvProduct } from "../backend/shopCatalog/kvStockPoller.js";

const kv = (code: string, isActive = true) => ({ code, isActive });
const doc = (ma: string, isActive?: boolean) => ({ _id: ma, ma, ...(isActive === undefined ? {} : { isActive }) });
/** Danh sách KV đủ dài để vượt ngưỡng an toàn của full sync. */
const fullKv = (...extra: Array<Record<string, unknown>>) => [
  ...Array.from({ length: MIN_FULL_KV_PRODUCTS }, (_, i) => kv(`FILL${i}`)),
  ...extra,
];

test("KA01: full sync ẩn SP shop không còn trên KV (đã xoá)", () => {
  const plan = planKvActiveChanges([doc("TLHT30"), doc("LIVE")], fullKv(kv("LIVE")), { full: true });
  assert.deepEqual(plan.changes, [{ _id: "TLHT30", ma: "TLHT30", isActive: false, reason: "kv_deleted" }]);
  assert.equal(plan.blockedDeletes, 0);
});

test("KA02: delta không ẩn SP vắng mặt (delta chỉ trả mã vừa sửa)", () => {
  const plan = planKvActiveChanges([doc("TLHT30")], [kv("OTHER")], { full: false });
  assert.deepEqual(plan.changes, []);
});

test("KA03: KV ngừng kinh doanh → ẩn; KV bán lại → mở lại; không đổi thì không ghi", () => {
  const plan = planKvActiveChanges(
    [doc("STOP"), doc("BACK", false), doc("SAME"), doc("SAMEOFF", false)],
    [kv("STOP", false), kv("BACK"), kv("SAME"), kv("SAMEOFF", false)],
    { full: false }
  );
  assert.deepEqual(
    plan.changes.map((c) => [c.ma, c.isActive, c.reason]),
    [["STOP", false, "kv_inactive"], ["BACK", true, "kv_active"]]
  );
});

test("KA04: mã khác hoa/thường vẫn khớp (KV «50k» ↔ shop «50K»)", () => {
  const plan = planKvActiveChanges([doc("50K")], fullKv(kv("50k")), { full: true });
  assert.deepEqual(plan.changes, []);
});

test("KA05: KV trả thiếu hoặc vắng quá nhiều mã → không ẩn hàng loạt", () => {
  const short = planKvActiveChanges([doc("A"), doc("B")], [kv("A")], { full: true });
  assert.deepEqual(short.changes, []);
  assert.equal(short.blockedDeletes, 1);

  const shop = Array.from({ length: 1000 }, (_, i) => doc(`S${i}`));
  const mass = planKvActiveChanges(shop, fullKv(...shop.slice(0, 800).map((d) => kv(d.ma))), { full: true });
  assert.deepEqual(mass.changes, []);
  assert.equal(mass.blockedDeletes, 200);

  const atCap = planKvActiveChanges(shop, fullKv(...shop.slice(0, 900).map((d) => kv(d.ma))), { full: true });
  assert.equal(atCap.changes.length, 100);
});

test("KA08: tồn shop = tồn chi nhánh bán web, không cộng kho khác", () => {
  const p = {
    inventories: [
      { branchId: 1, branchName: "Chi nhánh trung tâm", onHand: 33 },
      { branchId: 2, branchName: "KHU VỰC BÁN HÀNG", onHand: 0 },
      { branchId: 3, branchName: "KHO TRUNG TÂM", onHand: 524 },
    ],
  };
  assert.equal(tonFromKvProduct(p, 1), 33);
  assert.equal(tonFromKvProduct(p, 3), 524);
  assert.equal(tonFromKvProduct({ inventories: [] }, 1), 0);
});

function productsDb(products: any[]) {
  const cursor = (list: any[]) => ({ project() { return this; }, limit() { return this; }, toArray: async () => list });
  return {
    collection: (name: string) => ({
      find: () => cursor(name === "aloha_products" ? products : []),
      findOne: async () => null,
      aggregate: () => ({ toArray: async () => [] }),
    }),
  } as any;
}
const line = (code: string) => ({ productCode: code, productName: "Cây", quantity: 1, price: 1 });

test("KA06: tạo đơn chặn SP đã ngừng kinh doanh, báo giá thì không chặn", async () => {
  const db = productsDb([{ ma: "TLHT30", ten: "Cây", giaWeb: 230000, isActive: false }]);
  const order = await applyCatalogPrices(db, [line("TLHT30")]);
  assert.equal(order.ok, false);
  assert.match(String(order.error), /ngừng kinh doanh/);
  assert.equal((await applyCatalogPrices(db, [line("TLHT30")], { quoteOnly: true })).ok, true);
  assert.equal((await applyCatalogPrices(db, [line("TLHT30")], { allowInactive: true })).ok, true);
});

test("KA07: bản trùng đã gộp (isActive=false) không chặn mã chính đang bán", async () => {
  const db = productsDb([
    { ma: "50k", ten: "Combo", giaWeb: 50000, isActive: false, mergedInto: "x" },
    { ma: "50K", ten: "Combo", giaWeb: 50000 },
  ]);
  const order = await applyCatalogPrices(db, [line("50K")]);
  assert.equal(order.ok, true);
});
