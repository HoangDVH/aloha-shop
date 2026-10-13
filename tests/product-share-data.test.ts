import test from "node:test";
import assert from "node:assert/strict";
import { productShareData } from "../frontend/lib/productShareData.js";
const files = [new File(["image"], "one.jpg", { type: "image/jpeg" })];
const input = { selectedCount: 1, files, target: "facebook" as const, title: "Product", caption: "Product https://example.com/p", url: "https://example.com/p", canShare: () => true };
test("Facebook receives files only, without text or link replacing photos", () => {
  assert.deepEqual(productShareData(input), { files });
});
test("incomplete or unsupported selected files never silently degrade to link sharing", () => {
  assert.throws(() => productShareData({ ...input, selectedCount: 5 }), /media_incomplete/);
  assert.throws(() => productShareData({ ...input, files: [] }), /media_incomplete/);
  assert.throws(() => productShareData({ ...input, canShare: () => false }), /media_unsupported/);
});
test("link sharing requires explicitly deselecting media; Zalo retains accompanying caption", () => {
  assert.deepEqual(productShareData({ ...input, selectedCount: 0, files: [] }), { title: input.title, url: input.url });
  assert.deepEqual(productShareData({ ...input, target: "zalo" }), { files, title: input.title, text: input.caption });
});
