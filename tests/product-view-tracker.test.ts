import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as session from "../frontend/lib/visitSession.js";

const code = ts.transpileModule(readFileSync("frontend/components/ProductViewTracker.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(hidden = false, webdriver = false) {
  let now = 1000, raw: string | null = null, cleanup: any;
  const document = { visibilityState: hidden ? "hidden" : "visible", addEventListener: (_: string, fn: any) => listeners.add(fn), removeEventListener: (_: string, fn: any) => listeners.delete(fn) };
  const listeners = new Set<any>(), calls: any[] = [], exports: any = {};
  vm.runInNewContext(code, { exports, AbortController, Date: { now: () => now }, document,
    navigator: { webdriver, locks: { request: async (_: string, fn: any) => fn() } },
    localStorage: { getItem: () => raw, setItem: (_: string, value: string) => { raw = value; } },
    fetch: async (_: string, opts: any) => { calls.push(JSON.parse(opts.body)); return { ok: true }; },
    require(name: string) {
      if (name === "react") return { useEffect(fn: any) { cleanup = fn(); } };
      if (name === "@/lib/visitSession") return { ...session, makeVisitId: randomUUID };
      throw new Error(name);
    },
  });
  exports.ProductViewTracker({ productCode: "P" });
  return { calls, document, visible() { for (const fn of listeners) fn(); }, setNow: (n: number) => { now = n; }, cleanup: () => cleanup?.() };
}
test("one visible product view per session; returning after inactivity records a new session for the same visitor", async () => {
  const f = fixture(); await flush(); assert.equal(f.calls.length, 1);
  f.setNow(2000); f.visible(); await flush(); assert.equal(f.calls.length, 1);
  f.setNow(2000 + session.VISIT_IDLE_MS); f.visible(); await flush(); assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].visitorId, f.calls[1].visitorId); assert.notEqual(f.calls[0].sessionId, f.calls[1].sessionId);
  f.cleanup();
});
test("hidden tabs are counted only when visible, and webdriver sessions are skipped", async () => {
  const f = fixture(true); await flush(); assert.equal(f.calls.length, 0);
  f.document.visibilityState = "visible"; f.visible(); await flush(); assert.equal(f.calls.length, 1); f.cleanup();
  const bot = fixture(false, true); await flush(); assert.equal(bot.calls.length, 0);
});
