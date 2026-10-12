import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as session from "../frontend/lib/visitSession.js";

const code = ts.transpileModule(readFileSync("frontend/lib/funnelTracking.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function fixture(path = "/", webdriver = false) {
  let raw: string | null = null, now = 1000, storageBroken = false, fetchBroken = false;
  const calls: any[] = [], exports: any = {};
  vm.runInNewContext(code, { exports, Date: { now: () => now }, window: { location: { pathname: path } }, navigator: { webdriver },
    localStorage: { getItem() { if (storageBroken) throw new Error("blocked"); return raw; }, setItem(_: string, value: string) { raw = value; } },
    fetch: (_: string, options: any) => { if (fetchBroken) throw new Error("offline"); calls.push(JSON.parse(options.body)); return Promise.resolve({ ok: true }); },
    require: () => ({ ...session, makeVisitId: randomUUID }),
  });
  return { exports, calls, advance: (n: number) => { now = n; }, breakStorage: () => { storageBroken = true; }, breakFetch: () => { fetchBroken = true; } };
}
test("cart, checkout and backend placement payload share the visit identity; inactivity starts a new session", () => {
  const f = fixture();
  f.exports.trackFunnel("visit"); f.exports.trackFunnel("cart"); f.exports.trackFunnel("checkout");
  const payload = f.exports.funnelSession();
  assert.equal(f.calls.length, 3);
  for (const call of f.calls) { assert.equal(call.sessionId, payload.sessionId); assert.equal(call.visitorId, payload.visitorId); }
  f.advance(session.VISIT_IDLE_MS + 1000);
  const later = f.exports.funnelSession();
  assert.equal(later.visitorId, payload.visitorId); assert.notEqual(later.sessionId, payload.sessionId);
});
test("admin/bots are skipped, storage/network errors never interrupt shopping", () => {
  for (const f of [fixture("/admin"), fixture("/", true)]) {
    f.exports.trackFunnel("cart"); assert.equal(f.exports.funnelSession(), undefined); assert.equal(f.calls.length, 0);
  }
  const storage = fixture(); storage.breakStorage(); assert.doesNotThrow(() => storage.exports.trackFunnel("cart"));
  assert.equal(storage.exports.funnelSession(), undefined);
  const network = fixture(); network.breakFetch(); assert.doesNotThrow(() => network.exports.trackFunnel("checkout"));
});
