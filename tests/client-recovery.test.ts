import test from "node:test";
import assert from "node:assert/strict";
import { claimRecovery, isChunkFailure } from "../frontend/lib/clientRecovery.js";

test("reload only recognized missing chunks, never ordinary component errors", () => {
  assert.equal(isChunkFailure({ name: "ChunkLoadError" }), true);
  assert.equal(isChunkFailure({ message: "Loading chunk 245 failed.\n(error: /_next/static/x.js)" }), true);
  assert.equal(isChunkFailure({ message: "Failed to fetch dynamically imported module: x" }), true);
  assert.equal(isChunkFailure({ message: "Cannot read properties of undefined" }), false);
  assert.equal(isChunkFailure({ message: "Failed to fetch" }), false);
});
test("reload guard survives page reloads and limits recovery across routes", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) || null, setItem: (k: string, v: string) => { values.set(k, v); } };
  assert.equal(claimRecovery(storage, 1_000_000), true);
  assert.equal(claimRecovery(storage, 1_000_001), false);
  assert.equal(claimRecovery(storage, 1_599_999), false);
  assert.equal(claimRecovery(storage, 1_600_000), true);
});
test("blocked storage disables automatic reload to prevent loops", () => {
  assert.equal(claimRecovery({ getItem: () => { throw new Error("blocked"); }, setItem: () => {} }), false);
});
