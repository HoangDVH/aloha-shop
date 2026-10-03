import { test } from "node:test";
import assert from "node:assert/strict";
import { voucherReturnReason } from "../backend/shopPromotions/voucherHistory.js";

test("VH01: đơn huỷ / thất bại → voucher hoàn lại vì huỷ", () => {
  assert.equal(voucherReturnReason({ paymentStatus: "cancelled", orderStatus: "huy" }), "cancelled");
  assert.equal(voucherReturnReason({ paymentStatus: "failed" }), "cancelled");
  assert.equal(voucherReturnReason({ paymentStatus: "unpaid", orderStatus: "huy" }), "cancelled");
});

test("VH02: đơn quá hạn thanh toán → lý do expired", () => {
  assert.equal(voucherReturnReason({ paymentStatus: "expired", orderStatus: "huy" }), "expired");
});

test("VH03: đơn còn chạy hoặc không tìm thấy → không gắn nhãn hoàn", () => {
  assert.equal(voucherReturnReason({ paymentStatus: "unpaid", orderStatus: "cho_xac_nhan" }), null);
  assert.equal(voucherReturnReason({ paymentStatus: "paid", orderStatus: "hoan_thanh" }), null);
  assert.equal(voucherReturnReason(undefined), null);
});
