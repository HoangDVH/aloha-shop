import test from "node:test";
import assert from "node:assert/strict";
import { checkProducts, checkVouchers, overlappingSlots } from "../backend/shopCampaigns/admin/prepublishChecks.js";
import type { ProductFacts } from "../backend/shopCampaigns/admin/productFacts.js";
import { daiLeContent } from "./helpers/campaignFixtures.js";
import { promo } from "./helpers/walletFixtures.js";

const facts = new Map<string, ProductFacts>([
  ["SP_A", { ma: "SP_A", ten: "SP_A", listPrice: 200_000, cost: 90_000, stock: 50, nhomPath: "" }],
  ["SP_B", { ma: "SP_B", ten: "SP_B", listPrice: 500_000, cost: 0, stock: 20, nhomPath: "" }],
  ["SP_C", { ma: "SP_C", ten: "SP_C", listPrice: 80_000, cost: 0, stock: 3, nhomPath: "" }],
  ["QUA_G", { ma: "QUA_G", ten: "QUA_G", listPrice: 30_000, cost: 0, stock: 5, nhomPath: "" }],
]);

const withA = (salePrice: number, quota = 10) => {
  const c = daiLeContent();
  c.products[0] = { ...c.products[0], salePrice, quota };
  return c;
};

test("AD04: giá sale ≥ giá thường → lỗi chặn bật, đúng dòng", () => {
  const issues = checkProducts(withA(200_000), facts);
  const e = issues.find((i) => i.path === "products.0.salePrice");
  assert.equal(e?.level, "error");
});

test("AD05: giá sale 9.000đ dưới giá vốn 90.000đ → cần xác nhận (confirm), kèm số tiền lỗ", () => {
  const issues = checkProducts(withA(9_000), facts);
  const c = issues.find((i) => i.level === "confirm");
  assert.ok(c);
  assert.match(c!.message, /giá vốn 90\.000đ/);
});

test("AD06: giảm > 50% → cảnh báo, vẫn bật được", () => {
  const issues = checkProducts(withA(95_000), facts);
  assert.ok(issues.some((i) => i.level === "warn" && /50%/.test(i.message)));
  assert.ok(!issues.some((i) => i.level === "error"));
});

test("AD07: mở 5 suất SP_C nhưng chỉ còn 3 cái → cảnh báo nói rõ con số", () => {
  const issues = checkProducts(daiLeContent(), facts);
  const w = issues.find((i) => i.path === "products.1.quota");
  assert.equal(w?.level, "warn");
  assert.match(w!.message, /mở 5 suất nhưng chỉ còn 3 cái/);
});

test("Mẫu chuẩn (SP_A 124.000đ) không có lỗi chặn", () => {
  assert.equal(checkProducts(daiLeContent(), facts).filter((i) => i.level === "error").length, 0);
});

test("Sản phẩm / quà không có trên web → lỗi", () => {
  const c = daiLeContent();
  c.products[2] = { ...c.products[2], gift: undefined, gifts: [{ ma: "QUA_G", qty: 1, quota: 3 }, { ma: "KHONG_CO", qty: 1, quota: 3 }] };
  const issues = checkProducts(c, facts);
  assert.ok(issues.some((i) => i.level === "error" && i.path === "products.2.gifts.1.ma"));
  assert.ok(!issues.some((i) => i.path === "products.2.gifts.0.ma"));
});

test("Quà mở nhiều suất hơn tồn kho → cảnh báo đúng quà", () => {
  const c = daiLeContent();
  c.products[2] = { ...c.products[2], gift: undefined, gifts: [{ ma: "QUA_G", qty: 1, quota: 9 }] };
  const w = checkProducts(c, facts).find((i) => i.path === "products.2.gifts.0.quota");
  assert.equal(w?.level, "warn");
  assert.match(w!.message, /mở 9 suất nhưng kho chỉ còn 5 cái/);
});

test("AD08: 2 khung giờ chồng nhau (kể cả khung qua nửa đêm) → chặn", () => {
  assert.deepEqual(overlappingSlots([{ key: "A", start: "09:00", end: "12:00" }, { key: "B", start: "11:00", end: "13:00" }]), [[0, 1]]);
  assert.deepEqual(overlappingSlots([{ key: "A", start: "09:00", end: "12:00" }, { key: "B", start: "12:00", end: "13:00" }]), []);
  assert.deepEqual(
    overlappingSlots([{ key: "N", start: "22:00", end: "01:00", overnight: true }, { key: "S", start: "00:30", end: "02:00" }]),
    [[0, 1]]
  );
});

test("AD09: voucher hết hạn / không bật / voucher sỉ → chặn, báo tên voucher", () => {
  const c = daiLeContent();
  c.voucherIds = ["HET_HAN", "TAT", "VSI", "V30K", "MAT"];
  const issues = checkVouchers(
    c,
    [
      promo("HET_HAN", { endDate: "2020-01-01T00:00:00.000Z" }),
      promo("TAT", { status: "paused" }),
      promo("VSI", { targetCustomer: "wholesale" }),
      promo("V30K"),
    ],
    Date.parse("2026-09-30T00:00:00Z")
  );
  assert.deepEqual(issues.map((i) => i.path), ["voucherIds.0", "voucherIds.1", "voucherIds.2", "voucherIds.4"]);
  assert.match(issues[0].message, /"HET_HAN" đã hết hạn/);
});
