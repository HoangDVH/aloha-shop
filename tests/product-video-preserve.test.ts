import test from "node:test";
import assert from "node:assert/strict";
import {
  mergePreserveProductVideos,
  shopNeedsVideoFill,
  stripProductVideoMutations,
  publicProductVideos,
} from "../backend/shopCatalog/productVideoUrl.ts";

const R2 =
  "https://pub-47761e6b4231489580175c7b8a2d0490.r2.dev/san-pham/demo.mp4";

test("publicProductVideos falls back to videoUrl when videos empty", () => {
  assert.deepEqual(publicProductVideos({ videos: [], videoUrl: R2 }), [R2]);
});

test("mergePreserve keeps existing when incoming empty", () => {
  const merged = mergePreserveProductVideos(
    { videos: [R2], videoUrl: R2 },
    { videos: [], videoUrl: "" }
  );
  assert.deepEqual(merged, { videos: [R2], videoUrl: R2 });
});

test("mergePreserve prefers incoming when present", () => {
  const next = R2.replace("demo.mp4", "next.mp4");
  const merged = mergePreserveProductVideos(
    { videos: [R2] },
    { videos: [next] }
  );
  assert.equal(merged.videoUrl, next);
});

test("shopNeedsVideoFill only when shop empty and source has urls", () => {
  assert.equal(shopNeedsVideoFill({ videos: [] }, [R2]), true);
  assert.equal(shopNeedsVideoFill({ videos: [R2] }, [R2]), false);
  assert.equal(shopNeedsVideoFill({ videos: [] }, []), false);
});

test("stripProductVideoMutations removes CMS keys from sync patches", () => {
  const patch = { ton: 1, videos: [], videoUrl: "x", giaBan: 2 };
  stripProductVideoMutations(patch);
  assert.deepEqual(patch, { ton: 1, giaBan: 2 });
});
