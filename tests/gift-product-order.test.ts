import test from "node:test";
import assert from "node:assert/strict";
import { giftProductPage, insertGiftProduct, moveGiftProduct } from "../frontend/components/admin/website/gifts/productOrder.js";

test("moving directly or by drag preserves other products and the input", () => {
  const codes = ["A", "B", "C", "D"];
  assert.deepEqual(moveGiftProduct(codes, "D", 2), ["A", "D", "B", "C"]);
  assert.deepEqual(moveGiftProduct(codes, "A", 4), ["B", "C", "D", "A"]);
  assert.deepEqual(moveGiftProduct(codes, "C", 1), ["C", "A", "B", "D"]);
  assert.deepEqual(codes, ["A", "B", "C", "D"]);
  for (const position of [NaN, 1.5]) assert.equal(moveGiftProduct(codes, "A", position), codes);
  assert.equal(moveGiftProduct(codes, "missing", 1), codes);
  assert.deepEqual(moveGiftProduct(codes, "D", -10), ["D", "A", "B", "C"]);
  assert.deepEqual(moveGiftProduct(codes, "A", 999), ["B", "C", "D", "A"]);
});

test("insert at first, last or chosen position without duplicates or exceeding 100", () => {
  const codes = ["A", "B"];
  assert.deepEqual(insertGiftProduct(codes, "C", 1), ["C", "A", "B"]);
  assert.deepEqual(insertGiftProduct(codes, "C", 2), ["A", "C", "B"]);
  assert.deepEqual(insertGiftProduct(codes, "C", 3), ["A", "B", "C"]);
  assert.deepEqual(insertGiftProduct([], "A", 1), ["A"]);
  assert.equal(insertGiftProduct(codes, "A", 1), codes);
  assert.equal(insertGiftProduct(codes, "C", NaN), codes);
  const full = Array.from({ length: 100 }, (_, i) => String(i));
  assert.equal(insertGiftProduct(full, "new", 1), full);
});

test("selected pagination keeps absolute positions and clamps after deletion", () => {
  const codes = Array.from({ length: 11 }, (_, i) => `P${i + 1}`);
  assert.deepEqual(giftProductPage(codes, 2, 5), { page: 2, start: 5, codes: codes.slice(5, 10) });
  assert.deepEqual(giftProductPage(codes.slice(0, 10), 3, 5), { page: 2, start: 5, codes: codes.slice(5, 10) });
  assert.deepEqual(giftProductPage([], 3, 5), { page: 1, start: 0, codes: [] });
  const reordered = moveGiftProduct(codes, "P11", 2);
  assert.equal(giftProductPage(reordered, 1, 5).codes[1], "P11");
  assert.equal(reordered.length, codes.length);
  assert.deepEqual(giftProductPage(codes, 2, 10).codes, ["P11"]);
});
