import test from "node:test";
import assert from "node:assert/strict";
import { diskSeverity, recordClientError, siteHealth } from "../backend/clientErrorStore.js";

test("disk warnings trigger at 80% and critical at 90%", () => {
  assert.equal(diskSeverity(79), "ok");
  assert.equal(diskSeverity(80), "warning");
  assert.equal(diskSeverity(89), "warning");
  assert.equal(diskSeverity(90), "critical");
});
test("TTL and time index are created once; health reads a bounded recent list", async () => {
  const indexes: unknown[] = [];
  const reports: any[] = [];
  const filters: any[] = [];
  let limit = 0;
  const collection = {
    createIndexes: async (value: unknown) => { indexes.push(value); },
    insertOne: async (value: unknown) => { reports.push(value); },
    countDocuments: async (filter: unknown) => { filters.push(filter); return 5; },
    find: () => ({ sort: () => ({ limit: (value: number) => { limit = value; return { toArray: async () => reports }; } }) }),
  };
  const db = { collection: () => collection } as any;
  await recordClientError(db, { message: "safe" });
  const health = await siteHealth(db);
  assert.equal(indexes.length, 1);
  assert.equal((indexes[0] as any[])[1].expireAfterSeconds, 0);
  assert.equal(reports[0].expiresAt.getTime() - reports[0].at.getTime(), 7 * 86400_000);
  assert.equal(health.errorAlert, true);
  assert.equal(limit, 20);
  assert.equal(filters.length, 2);
  assert.ok(filters[0].at.$gte instanceof Date);
});
