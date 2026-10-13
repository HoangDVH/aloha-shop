import test from "node:test";
import assert from "node:assert/strict";
import { productShareData } from "../frontend/lib/productShareData.js";
const files = [new File(["image"], "one.jpg", { type: "image/jpeg" })];
const input = { selectedCount: 1, files, target: "facebook" as const, title: "Product", caption: "Product https://example.com/p", url: "https://example.com/p", canShare: () => true };
test("Facebook receives files only, without text or link replacing photos", () => {
  assert.deepEqual(productShareData(input), { files });
});

test("videos are sent before photos regardless of selection or loading order", () => {
  const firstVideo = new File(["v1"], "video1.mp4", { type: "video/mp4" });
  const secondVideo = new File(["v2"], "video2.mp4", { type: "video/mp4" });
  const secondImage = new File(["image2"], "two.jpg", { type: "image/jpeg" });
  const mixed = [files[0], firstVideo, secondImage, secondVideo];
  for (const target of ["facebook", "zalo"] as const) {
    let checked: ShareData | undefined;
    const data = productShareData({ ...input, target, selectedCount: 4, files: mixed,
      canShare: payload => { checked = payload; return true; } });
    assert.deepEqual(data.files, [firstVideo, secondVideo, files[0], secondImage]);
    assert.equal(checked, data);
  }
  assert.deepEqual(mixed, [files[0], firstVideo, secondImage, secondVideo]);
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
