import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { clientErrorInput, redactErrorText, registerClientErrors } from "../backend/clientErrors.js";

test("telemetry validates size, source, release and excludes extra fields", () => {
  const valid = { name: "Error", message: "oops", path: "/", release: "20261014-d22a15b", source: "boundary" };
  assert.equal(clientErrorInput.safeParse(valid).success, true);
  for (const extra of [{ cookie: "secret" }, { message: "x".repeat(1001) }, { source: "other" }, { release: "a\nb" }]) {
    assert.equal(clientErrorInput.safeParse({ ...valid, ...extra }).success, false);
  }
  const cleaned = redactErrorText("https://shop.test/x?token=secret#hash a@b.com Bearer abcdefghijklmnopqrstuvwxyz 0901234567\n");
  for (const secret of ["token=", "secret", "a@b.com", "abcdefghijklmnopqrstuvwxyz", "0901234567", "\n"]) assert.equal(cleaned.includes(secret), false);
});
test("endpoint rejects foreign origins, logs bounded reports, and rate limits", async () => {
  const app = express();
  app.use(express.json());
  const stored: unknown[] = [];
  const db = { collection: () => ({ createIndexes: async () => [], insertOne: async (row: unknown) => { stored.push(row); } }) } as any;
  registerClientErrors(app, async () => db, async () => db);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/api/shop/client-errors`;
  const body = JSON.stringify({ name: "Error", message: "test", path: "/?token=secret", release: "test", source: "boundary" });
  const logs: unknown[][] = [];
  const original = console.warn;
  console.warn = (...args) => { logs.push(args); };
  try {
    const post = (origin: string, data = body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: data });
    assert.equal((await post("https://evil.test")).status, 403);
    assert.equal((await fetch(url.replace("client-errors", "admin/site-health"))).status, 401);
    assert.equal((await post("http://localhost:3002", "{}")).status, 400);
    for (let i = 0; i < 10; i++) assert.equal((await post("http://localhost:3002")).status, 204);
    assert.equal((await post("http://localhost:3002")).status, 429);
    const report = JSON.parse(String(logs.find(row => row[0] === "[client-error]")?.[1]));
    assert.equal(report.path, "/");
    assert.equal(stored.length, 10);
    const row = stored[0] as { at: Date; expiresAt: Date; path: string };
    assert.equal(row.expiresAt.getTime() - row.at.getTime(), 7 * 86400_000);
    assert.equal(row.path, "/");
  } finally {
    console.warn = original;
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
