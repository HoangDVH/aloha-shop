import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GIFT_MA, inDefaultGiftGroup, withDefaultGift } from "../frontend/lib/campaign/defaultGift.js";

const row = (ma: string, extra = {}) => ({ ma, salePrice: 100_000, quota: 10, perCustomerLimit: 2, ...extra });

test("Nhóm Cây thành phẩm trồng sẵn / sale (kể cả nhóm con) được tặng túi giấy", () => {
  assert.ok(inDefaultGiftGroup("CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM TRỒNG SẴN >> CÂY THÀNH PHẨM TRÊN 300K - DƯỚI 500K"));
  assert.ok(inDefaultGiftGroup("CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM SALE >> CÂY THÀNH PHẨM SALE ĐỒNG GIÁ 170K"));
  assert.ok(inDefaultGiftGroup("CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM SALE"));
  assert.ok(inDefaultGiftGroup("cây cảnh đủ loại >> cây thành phẩm trồng sẵn"));
});

test("Nhóm khác không được tặng quà mặc định", () => {
  assert.equal(inDefaultGiftGroup("TÚI VÀ HỘP ĐỂ SẢN PHẨM >> TÚI GIẤY CỬA KÍNH"), false);
  assert.equal(inDefaultGiftGroup("CHẬU TRỒNG CÂY >> CHẬU BÁT TRÀNG"), false);
  assert.equal(inDefaultGiftGroup(""), false);
  assert.equal(inDefaultGiftGroup(undefined), false);
});

test("SP cây thành phẩm chưa có quà → gắn 1 túi giấy, tổng quà theo số lượng sale", () => {
  const r = withDefaultGift(row("CBDVDP"), "CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM TRỒNG SẴN");
  assert.deepEqual(r.gifts, [{ ma: DEFAULT_GIFT_MA, qty: 1, quota: 10 }]);
});

test("Đã cài quà thì giữ nguyên; nhóm khác giữ không quà", () => {
  const own = row("LYTSCV", { gifts: [{ ma: "DDTC", qty: 1, quota: 5 }] });
  assert.equal(withDefaultGift(own, "CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM TRỒNG SẴN"), own);
  const other = row("CHAU1");
  assert.equal(withDefaultGift(other, "CHẬU TRỒNG CÂY >> CHẬU BÁT TRÀNG"), other);
});
