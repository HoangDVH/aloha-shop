import test from "node:test";
import assert from "node:assert/strict";
import { megaMenuAvailableHeight } from "../frontend/lib/megaMenuViewport.ts";
test("menu fits short screens below the header", () => {
  assert.equal(megaMenuAvailableHeight(600, 160), 422);
  assert.equal(megaMenuAvailableHeight(782, 180), 584);
});
test("menu respects viewport changes and never gets a negative height", () => {
  assert.equal(megaMenuAvailableHeight(500, 580), 0);
  assert.equal(megaMenuAvailableHeight(900.5, 160.2), 722);
});
