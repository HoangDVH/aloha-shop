import test from "node:test";
import assert from "node:assert/strict";
import { parseVoucherQuery, voucherProductFilter } from "../backend/shopPromotions/voucherProductFilter.js";
import { voucherUseHref } from "../frontend/lib/voucherFormat.js";

function fakeDb(doc: Record<string, unknown> | null) {
  const seen: unknown[] = [];
  const db = {
    collection: () => ({
      findOne: async (q: unknown) => {
        seen.push(q);
        return doc;
      },
    }),
  };
  return { db: db as never, seen };
}

test("Dùng ngay → /tim?voucher=<id>; id lạ bị bỏ", () => {
  assert.equal(voucherUseHref("promo_abc-1"), "/tim?voucher=promo_abc-1");
  assert.equal(parseVoucherQuery("promo_abc-1"), "promo_abc-1");
  assert.equal(parseVoucherQuery("x'; drop"), "");
  assert.equal(parseVoucherQuery({ $ne: 1 }), "");
});

test("Voucher theo mã SP: chỉ các mã đó, trừ SP loại trừ", async () => {
  const { db, seen } = fakeDb({ title: "Giảm 10%", scope: "product", productMas: ["tpkttl", "MMMCX"], excludedProductMas: ["mmmcx"] });
  const r = await voucherProductFilter(db, "p1");
  assert.deepEqual(seen[0], { id: "p1", status: "active" });
  assert.equal(r.title, "Giảm 10%");
  assert.deepEqual(r.filter, { $and: [{ ma: { $nin: ["MMMCX"] } }, { ma: { $in: ["TPKTTL", "MMMCX"] } }] });
});

test("Voucher theo nhóm: khớp categoryId dạng chuỗi và số", async () => {
  const { db } = fakeDb({ title: "Nhóm", scope: "category", categoryIds: ["12"] });
  const r = await voucherProductFilter(db, "p2");
  assert.deepEqual(r.filter, { $and: [{ categoryId: { $in: ["12", 12] } }] });
});

test("Voucher toàn shop: không lọc; voucher không còn chạy: không SP nào", async () => {
  assert.deepEqual((await voucherProductFilter(fakeDb({ title: "Freeship", scope: "all" }).db, "p3")).filter, {});
  const gone = await voucherProductFilter(fakeDb(null).db, "p4");
  assert.equal(gone.title, "");
  assert.deepEqual(gone.filter, { ma: { $in: [] } });
});
