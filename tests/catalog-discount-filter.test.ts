import { test } from "node:test";
import assert from "node:assert/strict";
import { discountMongoFilter } from "../backend/shopCatalog/webBadge.js";

test("DF01: không có chiến dịch → chỉ SP gắn nhãn giam_gia", () => {
  assert.deepEqual(discountMongoFilter([]), { webBadge: "giam_gia" });
});

test("DF02: có chiến dịch → SP chiến dịch (mọi kiểu hoa/thường) hoặc nhãn giam_gia", () => {
  assert.deepEqual(discountMongoFilter(["MMMCX", "TPKTTL"]), {
    $or: [{ webBadge: "giam_gia" }, { ma: { $in: ["MMMCX", "TPKTTL", "mmmcx", "tpkttl"] } }],
  });
});
