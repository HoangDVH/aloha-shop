import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { cartPayload, mergeCart, saveCart } from "../backend/shopCart/writes.js";
import { normalizeCartLines } from "../backend/shopCart/models.js";

const lines = (qty = 2, ma = "P1") => normalizeCartLines([{ ma, qty, ten: ma, gia: 100, selected: true }]);
const mergeKey = (at = Date.now()) => `${at}.${randomUUID()}`;
// Atomic update adapter: independently scheduled callers read snapshots and must
// pass the same revision predicate as the production MongoDB write.
function database(initial?: any) {
  const rows = new Map<string, any>();
  if (initial) rows.set(initial.userId, structuredClone(initial));
  const collection: any = {
    findOne: async ({ userId }: any) => structuredClone(rows.get(userId) || null),
    updateOne: async (filter: any, update: any) => {
      if (filter.userId) {
        if (!rows.has(filter.userId)) rows.set(filter.userId, { _id: filter.userId, ...structuredClone(update.$setOnInsert) });
        return { matchedCount: 1 };
      }
      const row = rows.get(filter._id);
      const matches = row && (filter.revision?.$exists === false ? row.revision === undefined : row.revision === filter.revision);
      if (!matches) return { matchedCount: 0 };
      rows.set(filter._id, { ...row, ...structuredClone(update.$set) });
      return { matchedCount: 1 };
    },
  };
  return { collection, get: (userId = "u1") => cartPayload(rows.get(userId) || null, userId), rows };
}

test("100 simultaneous deliveries of one merge increment quantity exactly once", async () => {
  const db = database(); const key = mergeKey();
  const results = await Promise.all(Array.from({ length: 100 }, () => mergeCart(db.collection, "u1", lines(), key)));
  assert.equal(db.get().lines[0].qty, 2);
  assert.equal(db.get().revision, 1);
  assert.equal(results.filter(r => !r.reused).length, 1);
});
test("different devices merge concurrently without losing quantities", async () => {
  const db = database();
  await Promise.all([1, 2, 3, 4].map(qty => mergeCart(db.collection, "u1", lines(qty), mergeKey())));
  assert.equal(db.get().lines[0].qty, 10);
  assert.equal(db.get().revision, 4);
});
test("lost merge response replay returns current cart, including later edits", async () => {
  const db = database(); const key = mergeKey();
  await mergeCart(db.collection, "u1", lines(), key);
  await saveCart(db.collection, "u1", lines(8), 1);
  const replay = await mergeCart(db.collection, "u1", lines(), key);
  assert.equal(replay.reused, true); assert.equal(replay.lines[0].qty, 8); assert.equal(replay.revision, 2);
});
test("same key with different payload is rejected; keys are scoped to account", async () => {
  const db = database(); const key = mergeKey();
  await mergeCart(db.collection, "u1", lines(), key);
  await assert.rejects(mergeCart(db.collection, "u1", lines(5), key), { code: "merge_key_reused" });
  await mergeCart(db.collection, "u2", lines(3), key);
  assert.equal(db.get("u2").lines[0].qty, 3); assert.equal(db.get().lines[0].qty, 2);
});
test("stale PUT and unversioned clients cannot overwrite latest cart", async () => {
  const db = database();
  await saveCart(db.collection, "u1", lines(), 0);
  const result = await Promise.allSettled([saveCart(db.collection, "u1", lines(4), 1), saveCart(db.collection, "u1", lines(7), 1)]);
  assert.equal(result.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(db.get().revision, 2);
  await assert.rejects(saveCart(db.collection, "u1", [], undefined), { code: "cart_revision_required" });
});
test("legacy carts upgrade from missing revision without dropping existing items", async () => {
  const db = database({ _id: "u1", userId: "u1", lines: lines(3) });
  await mergeCart(db.collection, "u1", lines(), mergeKey());
  assert.equal(db.get().lines[0].qty, 5); assert.equal(db.get().revision, 1);
});
test("expired operations cannot be replayed after receipt retention; malformed keys rejected", async () => {
  const db = database();
  await assert.rejects(mergeCart(db.collection, "u1", lines(), mergeKey(Date.now() - 31 * 86400_000)), { code: "merge_expired" });
  await assert.rejects(mergeCart(db.collection, "u1", lines(), undefined), { code: "merge_key_required" });
  assert.equal(db.get().revision, 0);
});

function sharedBrowser(db = database()) {
  const storage = new Map<string, string>();
  let lockQueue = Promise.resolve();
  let mergeCalls = 0; let saveCalls = 0; let loseResponse = false;
  let gate: Promise<void> | undefined;
  const api = {
    fetchServerCart: async () => { if (gate) await gate; return db.get(); },
    mergeServerCart: async (guest: any, userId: string, key: string) => {
      mergeCalls++;
      const result = await mergeCart(db.collection, userId, guest, key);
      if (loseResponse) { loseResponse = false; throw new Error("response lost"); }
      return result;
    },
    saveServerCart: async (value: any, userId: string, revision: number) => {
      saveCalls++;
      return saveCart(db.collection, userId, value, revision);
    },
  };
  const source = readFileSync(new URL("../frontend/lib/cartSync.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  function tab(initial = lines(), options: { storageFailure?: boolean; noLocks?: boolean } = {}) {
    let local: any[] = structuredClone(initial); let generation = 0;
    const timers: Array<() => void> = [];
    const exports: any = {};
    const deps: any = {
      zustand: { create: (init: any) => { let state = init(); return { getState: () => state, setState: (next: any) => { state = { ...state, ...next }; } }; } },
      "./priceSession": { priceSessionGeneration: () => generation },
      "./cart": { useCart: { getState: () => ({ lines: local, replaceLines: (value: any) => { local = value; }, clear: () => { local = []; } }) } },
      "./cartApi": api,
    };
    vm.runInNewContext(compiled, { exports, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; },
      crypto: { randomUUID }, queueMicrotask, setTimeout: (fn: () => void) => timers.push(fn), clearTimeout() {},
      localStorage: { getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => { if (options.storageFailure) throw new Error("storage blocked"); storage.set(key, value); },
        removeItem: (key: string) => storage.delete(key) },
      navigator: options.noLocks ? {} : { locks: { request: (_: string, work: any) => {
        const task = lockQueue.then(work); lockQueue = task.catch(() => {}); return task;
      } } },
    });
    return { ...exports, local: () => local, edit: (value: any) => { local = value; },
      advance: () => { generation++; }, timers };
  }
  return { tab, db, storage, calls: () => ({ mergeCalls, saveCalls }), loseNextResponse: () => { loseResponse = true; },
    pause: () => { let release!: () => void; gate = new Promise<void>(resolve => { release = resolve; }); return () => { gate = undefined; release(); }; } };
}

test("same tab shares an in-flight promise instead of issuing multiple merges", async () => {
  const env = sharedBrowser(); const tab = env.tab(); const release = env.pause();
  const a = tab.syncCartForUser("u1"); const b = tab.syncCartForUser("u1");
  assert.equal(a, b); release(); await a;
  assert.equal(env.calls().mergeCalls, 1);
});
test("two tabs share Web Lock and recheck metadata inside the lock", async () => {
  const env = sharedBrowser(); const a = env.tab(); const b = env.tab();
  await Promise.all([a.syncCartForUser("u1"), b.syncCartForUser("u1")]);
  assert.equal(env.calls().mergeCalls, 1); assert.equal(env.db.get().lines[0].qty, 2);
  assert.equal(a.local()[0].qty, 2); assert.equal(b.local()[0].qty, 2);
});
test("reload after committed merge with lost response replays the persisted intent", async () => {
  const env = sharedBrowser(); env.loseNextResponse(); const a = env.tab();
  await assert.rejects(a.syncCartForUser("u1"));
  assert.equal(env.db.get().lines[0].qty, 2);
  assert.ok(env.storage.has("aloha-shop-cart-pending-merge-v1"));
  await a.pushCartToServerNow("u1"); assert.equal(env.calls().saveCalls, 0);
  const reloaded = env.tab(); await reloaded.syncCartForUser("u1");
  assert.equal(env.db.get().lines[0].qty, 2); assert.equal(env.db.get().revision, 1);
  assert.equal(env.storage.has("aloha-shop-cart-pending-merge-v1"), false);
});
test("storage failure or missing cross-tab locking never sends an unsafe merge", async () => {
  for (const options of [{ storageFailure: true }, { noLocks: true }]) {
    const env = sharedBrowser(); const tab = env.tab(lines(), options);
    await assert.rejects(tab.syncCartForUser("u1"));
    assert.equal(env.calls().mergeCalls, 0); assert.equal(tab.local()[0].qty, 2);
    assert.ok(tab.useCartSyncStatus.getState().error);
  }
});
test("stale tab PUT loads latest cart and reports conflict instead of overwriting", async () => {
  const env = sharedBrowser(); const a = env.tab(); const b = env.tab();
  await a.syncCartForUser("u1"); await b.syncCartForUser("u1");
  a.edit(lines(4)); await a.pushCartToServerNow("u1");
  b.edit(lines(9)); await b.pushCartToServerNow("u1");
  assert.equal(env.db.get().lines[0].qty, 4); assert.equal(b.local()[0].qty, 4);
  assert.ok(b.useCartSyncStatus.getState().error);
});
test("failed sync can retry in the same tab without a second increment", async () => {
  const env = sharedBrowser(); const tab = env.tab(); env.loseNextResponse();
  await assert.rejects(tab.onShopUserChanged("u1"));
  await tab.onShopUserChanged("u1");
  assert.equal(env.db.get().lines[0].qty, 2); assert.equal(tab.useCartSyncStatus.getState().error, "");
});
test("logout during a fetch prevents the stale response from merging or hydrating", async () => {
  const env = sharedBrowser(); const tab = env.tab(); const release = env.pause();
  const pending = tab.syncCartForUser("u1");
  await Promise.resolve(); await Promise.resolve();
  tab.advance(); await tab.onShopUserChanged(null); release(); await pending;
  assert.equal(env.calls().mergeCalls, 0); assert.equal(env.db.get().revision, 0);
});
test("a pending merge for another account is never submitted to the current account", async () => {
  const env = sharedBrowser();
  env.storage.set("aloha-shop-cart-pending-merge-v1", JSON.stringify({ userId: "old", key: mergeKey(), lines: lines(99) }));
  const tab = env.tab(lines(99)); await tab.syncCartForUser("u1");
  assert.equal(env.calls().mergeCalls, 0); assert.equal(tab.local().length, 0);
});
test("local edits during synchronization are retained and scheduled for versioned save", async () => {
  const env = sharedBrowser(); const tab = env.tab(); const release = env.pause();
  const pending = tab.syncCartForUser("u1");
  await Promise.resolve(); await Promise.resolve();
  tab.edit(lines(5)); release(); await pending;
  await tab.pushCartToServerNow("u1");
  assert.equal(env.db.get().lines[0].qty, 5);
});

test("edits after a lost response survive retry without re-merging the changed payload", async () => {
  const env = sharedBrowser(); const tab = env.tab(); env.loseNextResponse();
  await assert.rejects(tab.syncCartForUser("u1"));
  tab.edit(lines(5)); await tab.retryCartSync("u1");
  await tab.pushCartToServerNow("u1");
  assert.equal(env.db.get().lines[0].qty, 5);
  assert.equal(env.calls().mergeCalls, 2);
});

test("crash after local acknowledgement does not interpret merged lines as new guest edits", async () => {
  const db = database(); const key = mergeKey();
  await saveCart(db.collection, "u1", lines(3), 0);
  const merged = await mergeCart(db.collection, "u1", lines(2), key);
  const env = sharedBrowser(db);
  env.storage.set("aloha-shop-cart-pending-merge-v1", JSON.stringify({ userId: "u1", key, lines: lines(2) }));
  env.storage.set("aloha-shop-cart-sync-meta", JSON.stringify({ userId: "u1", completedMergeKey: key, revision: merged.revision }));
  const tab = env.tab(lines(5)); await tab.syncCartForUser("u1");
  await tab.pushCartToServerNow("u1");
  assert.equal(db.get().lines[0].qty, 5); assert.equal(env.calls().saveCalls, 0);
});

test("hydration does not write back unchanged data; clearing the cart does save", async () => {
  const env = sharedBrowser(); const tab = env.tab(); await tab.syncCartForUser("u1");
  await tab.pushCartToServerNow("u1"); assert.equal(env.calls().saveCalls, 0);
  tab.edit([]); await tab.pushCartToServerNow("u1");
  assert.equal(env.calls().saveCalls, 1); assert.equal(env.db.get().lines.length, 0);
});
