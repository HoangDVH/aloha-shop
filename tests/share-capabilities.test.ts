import test from "node:test";
import assert from "node:assert/strict";
import { canShareFilesOnDevice } from "../frontend/lib/shareMedia.js";
test("desktop and mobile depend on API capabilities rather than pointer type", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  try {
    for (const coarse of [false, true]) {
      Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: coarse }) } });
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
        share() {}, canShare(data: ShareData) { assert.equal(data.files?.length, 1); return true; },
      } });
      assert.equal(canShareFilesOnDevice(), true);
    }
    for (const api of [{}, { share() {} }, { canShare: () => true }, { share() {}, canShare: () => false },
      { share() {}, canShare() { throw new Error("unsupported"); } }]) {
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: api });
      assert.equal(canShareFilesOnDevice(), false);
    }
    Reflect.deleteProperty(globalThis, "window");
    assert.equal(canShareFilesOnDevice(), false);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator); else Reflect.deleteProperty(globalThis, "navigator");
  }
});
