import "./helpers/noRedis.js";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";
import { settleCampaignHolds } from "../backend/shopCampaigns/orderCampaign.js";
import { beginHoldOperation, resumeHoldOperations, runHoldOperation, RESUME_AFTER_MS } from "../backend/shopCampaigns/flash/settleOperation.js";
import { reconcileFlashCounters } from "../backend/shopCampaigns/worker/reconcileCounters.js";
import { FLASH_COUNTERS_COL } from "../backend/shopCampaigns/types.js";
import { SHOP_ORDERS } from "../backend/shopOrders/models.js";
import { TEST_MONGO_SKIP, blockOutboundFetch, openTestDb, type TestDb } from "./helpers/testMongo.js";

let t: TestDb;
let restoreFetch: () => void = () => undefined;

before(async () => {
  if (TEST_MONGO_SKIP) return;
  restoreFetch = blockOutboundFetch();
  t = await openTestDb("campaign_settle_resume");
});
after(async () => {
  restoreFetch();
  await t?.close();
});

const OLD = new Date(Date.now() - 10 * 60_000).toISOString();

/** Đơn WK03 giữ 3 suất flash (bộ đếm SP + khách) và 1 quà; đơn khác cùng giữ thêm 2 suất. */
async function seed(db: Db) {
  await db.collection(FLASH_COUNTERS_COL).deleteMany({});
  await db.collection(SHOP_ORDERS).deleteMany({});
  await db.collection(FLASH_COUNTERS_COL).insertMany([
    { _id: "c1" as any, kind: "flash", campaignId: "cmp", ma: "SP_A", quota: 10, held: 5, sold: 0, updatedAt: OLD },
    { _id: "c1:acc:1" as any, kind: "customer", counterId: "c1", held: 3, sold: 0, updatedAt: OLD },
    { _id: "g1" as any, kind: "gift", campaignId: "cmp", ma: "QUA_G", quota: 5, held: 1, sold: 0, updatedAt: OLD },
  ]);
  const holds = (flash: unknown[], gifts: unknown[]) => ({ campaignId: "cmp", state: "held", flash, gifts, heldAt: OLD });
  await db.collection(SHOP_ORDERS).insertMany([
    { code: "WK03", campaignHolds: holds([{ counterId: "c1", qty: 3, customerIds: ["acc:1"] }], [{ counterId: "g1", qty: 1 }]) },
    { code: "OTHER", campaignHolds: holds([{ counterId: "c1", qty: 2, customerIds: [] }], []) },
  ]);
}

/** Db giả: lệnh ghi bộ đếm thứ `n + 1` (updateOne / updateMany) ném lỗi như tiến trình chết. */
function crashAfter(db: Db, n: number): Db {
  let calls = 0;
  return new Proxy(db, {
    get(target, prop) {
      if (prop !== "collection") return Reflect.get(target, prop);
      return (name: string) => {
        const col = target.collection(name);
        if (name !== FLASH_COUNTERS_COL) return col;
        return new Proxy(col, {
          get(c, p) {
            if (p !== "updateOne" && p !== "updateMany") return Reflect.get(c, p);
            return (...args: unknown[]) => {
              if (++calls > n) throw new Error("crash");
              return (c[p] as (...a: unknown[]) => unknown).apply(c, args);
            };
          },
        });
      };
    },
  });
}

const counters = async (db: Db) =>
  Object.fromEntries(
    (await db.collection(FLASH_COUNTERS_COL).find({}).toArray()).map((d) => [String(d._id), { held: d.held, sold: d.sold, ops: d.ops || [] }])
  );

test("WK03: chết sau bước 1/3 khi nhả suất → worker làm nốt theo operationId, không nhả đôi, không sót", { skip: TEST_MONGO_SKIP }, async () => {
  await seed(t.db);
  const started = await beginHoldOperation(t.db, "WK03", "held", "released");
  assert.ok(started);
  await assert.rejects(runHoldOperation(crashAfter(t.db, 1), "WK03", started.holds, started.op), /crash/);

  let c = await counters(t.db);
  assert.equal(c.c1.held, 2, "bước 1 đã nhả");
  assert.equal(c["c1:acc:1"].held, 3, "bước 2 chưa chạy");
  assert.equal(c.g1.held, 1, "bước 3 chưa chạy");

  assert.equal(await settleCampaignHolds(t.db, "WK03", "released"), false, "gọi lại không nhả đôi");
  assert.equal(await resumeHoldOperations(t.db, Date.now()), 0, "chưa đủ lâu thì chưa làm tiếp");
  const r = await reconcileFlashCounters(t.db, { fix: true, quietMs: 0 });
  assert.equal(r.fixed, 0, "đối soát không đụng bộ đếm đang có thao tác dở");

  assert.equal(await resumeHoldOperations(t.db, Date.now() + RESUME_AFTER_MS + 1000), 1);
  c = await counters(t.db);
  assert.deepEqual(
    [c.c1.held, c["c1:acc:1"].held, c.g1.held],
    [2, 0, 0],
    "nhả đúng 3 + 3 + 1, suất của đơn khác còn nguyên"
  );
  for (const k of Object.keys(c)) assert.deepEqual(c[k].ops, [], `gỡ hết dấu thao tác trên ${k}`);
  const order = await t.db.collection(SHOP_ORDERS).findOne({ code: "WK03" });
  assert.equal(order?.campaignHolds.state, "released");
  assert.equal(order?.campaignHolds.op, undefined);

  assert.equal(await resumeHoldOperations(t.db, Date.now() + RESUME_AFTER_MS + 1000), 0, "chạy lại không làm gì thêm");
  assert.deepEqual(await counters(t.db), c);
});

test("WK03: chết ở bước gỡ dấu vẫn làm tiếp đúng, chốt `sold` 1 lần", { skip: TEST_MONGO_SKIP }, async () => {
  await seed(t.db);
  const started = await beginHoldOperation(t.db, "WK03", "held", "sold");
  assert.ok(started);
  await assert.rejects(runHoldOperation(crashAfter(t.db, 3), "WK03", started.holds, started.op), /crash/);
  const mid = await t.db.collection(SHOP_ORDERS).findOne({ code: "WK03" });
  assert.equal(mid?.campaignHolds.op.phase, "cleanup");

  assert.equal(await resumeHoldOperations(t.db, Date.now() + RESUME_AFTER_MS + 1000), 1);
  const c = await counters(t.db);
  assert.deepEqual([c.c1.held, c.c1.sold, c["c1:acc:1"].sold, c.g1.sold], [2, 3, 3, 1]);
  for (const k of Object.keys(c)) assert.deepEqual(c[k].ops, []);
});
