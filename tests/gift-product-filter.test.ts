import test from "node:test";
import assert from "node:assert/strict";
import { parseGiftQuery, giftProductCodes } from "../backend/shopGifts/productFilter.js";
import type { GiftCollectionItem } from "../backend/shopGifts/types.js";
const gift = (recipientType: string, linkedProductCodes: string[], isActive = true) => ({ recipientType, linkedProductCodes, isActive } as GiftCollectionItem);
test("gift query accepts only supported recipients", () => {
  for (const value of ["nguoi-thuong", "gia-dinh", "khai-truong", "ban-lam-viec"]) assert.equal(parseGiftQuery(value), value);
  for (const value of ["doanh-nghiep", "unknown", { $ne: "" }, ["gia-dinh"], undefined]) assert.equal(parseGiftQuery(value), null);
});
test("gift products include only active matching collections and deduplicate codes", () => {
  const codes = giftProductCodes([gift("gia-dinh", [" B ", "A", ""]), gift("gia-dinh", ["A", "C"]), gift("gia-dinh", ["HIDDEN"], false), gift("nguoi-thuong", ["OTHER"])], "gia-dinh");
  assert.deepEqual(codes, ["A", "B", "C"]);
});
test("empty gift collection does not match other catalog products", () => {
  assert.deepEqual(giftProductCodes([], "gia-dinh"), []);
});
