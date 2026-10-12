import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { TEST_MONGO_SKIP, openTestDb } from "./helpers/testMongo.js";
import { SHOP_ORDERS } from "../backend/shopOrders/models.js";
import { createShopStockHolds, releaseShopStockHolds, consumeShopStockHolds, extendShopStockHoldExpiry,
  releaseHoldsForExpiredOrders, sumHeldQtyByMa, availableTonAfterHold, SHOP_STOCK_HOLDS } from "../backend/shopOrders/stockHold.js";
import { holdOrderStock, type KvPushContext } from "../backend/shopOrders/create/kvOrderPush.js";
import { planStockHoldRepair, applyStockHoldRepair } from "../backend/shopOrders/stockHoldRepair.js";

test("stock holds survive WEB→DH rename for release, consume, renew and own-stock exclusion", { skip: TEST_MONGO_SKIP }, async () => {
  const fixture = await openTestDb("stock_hold_identity"), db = fixture.db;
  const old = process.env.SHOP_STOCK_HOLD; process.env.SHOP_STOCK_HOLD = "1";
  try {
    const id = new ObjectId();
    await db.collection(SHOP_ORDERS).insertOne({ _id: id, id: "WEB-A", code: "WEB-A", orderStatus: "cho_xac_nhan" });
    const details = [{ productCode: "P", quantity: 2, price: 100 }];
    await holdOrderStock({ shopDb: db, mongoId: id, code: "WEB-A", doc: {}, orderDetails: details } as KvPushContext);
    assert.equal((await db.collection(SHOP_STOCK_HOLDS).findOne({}))!.orderId, String(id));
    // An already-created legacy reservation must continue working too.
    await createShopStockHolds({ shopDb: db, orderId: "WEB-A", orderCode: "WEB-A", details });
    await db.collection(SHOP_ORDERS).updateOne({ _id: id }, { $set: { code: "DH-A", id: "DH-A", legacyCodes: ["WEB-A"] } });
    assert.equal(await availableTonAfterHold(db, "P", 10), 6);
    assert.equal((await sumHeldQtyByMa(db, ["P"], "DH-A")).get("P"), undefined);
    assert.equal((await sumHeldQtyByMa(db, ["P"], String(id))).get("P"), undefined);
    const expiry = new Date(Date.now() + 60000);
    assert.equal(await extendShopStockHoldExpiry(db, "DH-A", expiry), 2);
    assert.equal(await consumeShopStockHolds(db, "DH-A"), 2);
    assert.equal(await consumeShopStockHolds(db, "WEB-A"), 0);
    assert.equal(await availableTonAfterHold(db, "P", 10), 10);
    await createShopStockHolds({ shopDb: db, orderId: "WEB-A", orderCode: "WEB-A", details });
    assert.equal(await releaseShopStockHolds(db, "DH-A"), 1);
    assert.equal(await releaseShopStockHolds(db, "DH-A"), 0);
    await createShopStockHolds({ shopDb: db, orderId: "WEB-A", orderCode: "WEB-A", details });
    await releaseHoldsForExpiredOrders(db, ["DH-A"]);
    assert.equal(await db.collection(SHOP_STOCK_HOLDS).countDocuments({ status: "held" }), 0);
    // Partial returns are not routed to release; bulk holds of another order remain.
    await createShopStockHolds({ shopDb: db, orderId: "unrelated", orderCode: "unrelated", details });
    assert.equal(await releaseShopStockHolds(db, "DH-A"), 0);
    assert.equal(await db.collection(SHOP_STOCK_HOLDS).countDocuments({ status: "held" }), 1);
  } finally { if (old === undefined) delete process.env.SHOP_STOCK_HOLD; else process.env.SHOP_STOCK_HOLD = old; await fixture.close(); }
});
test("repair settles terminal holds, rebinds pending holds, skips ambiguous/orphaned data and is idempotent", { skip: TEST_MONGO_SKIP }, async () => {
  const fixture = await openTestDb("stock_hold_repair"), db = fixture.db;
  try {
    const orders = [
      { code: "DH-C", legacyCodes: ["WEB-C"], orderStatus: "huy", isTest: true },
      { code: "DH-D", legacyCodes: ["WEB-D"], orderStatus: "hoan_thanh" },
      { code: "DH-P", legacyCodes: ["WEB-P"], orderStatus: "cho_xac_nhan", isTest: true },
      { code: "X1", legacyCodes: ["AMB"], orderStatus: "huy" }, { code: "X2", legacyCodes: ["AMB"], orderStatus: "huy" },
    ];
    await db.collection(SHOP_ORDERS).insertMany(orders);
    await db.collection("aloha_products").insertOne({ ma: "P", ton: 10 });
    for (const ref of ["WEB-C", "WEB-D", "WEB-P", "AMB", "ORPHAN"]) await db.collection(SHOP_STOCK_HOLDS).insertOne({ orderId: ref, orderCode: ref, ma: "P", qty: 1, status: "held", expiresAt: null });
    const plan = await planStockHoldRepair(db);
    assert.equal(plan.changes.length, 3); assert.equal(plan.unresolved.length, 2);
    assert.equal(await db.collection(SHOP_STOCK_HOLDS).countDocuments({ status: "held" }), 5, "dry run cannot change holds");
    assert.deepEqual(await applyStockHoldRepair(db, plan.changes), { released: 1, consumed: 1, rebound: 1, skipped: 0 });
    const pending = await db.collection(SHOP_STOCK_HOLDS).findOne({ orderCode: "DH-P" });
    assert.equal(pending!.status, "held"); assert.equal(pending!.qty, 1);
    assert.equal((await db.collection("aloha_products").findOne({ ma: "P" }))!.ton, 10);
    assert.equal((await planStockHoldRepair(db)).changes.length, 0);
    assert.deepEqual(await applyStockHoldRepair(db, plan.changes), { released: 0, consumed: 0, rebound: 0, skipped: 3 });
    // Order changes after dry run prevent applying a stale action.
    await db.collection(SHOP_STOCK_HOLDS).updateOne({ orderCode: "DH-D" }, { $set: { status: "held" } });
    const stale = await planStockHoldRepair(db);
    await db.collection(SHOP_ORDERS).updateOne({ code: "DH-D" }, { $set: { orderStatus: "cho_xu_ly" } });
    assert.equal((await applyStockHoldRepair(db, stale.changes)).skipped, 1);
    assert.equal(await db.collection(SHOP_STOCK_HOLDS).countDocuments({ orderCode: "DH-D", status: "held" }), 1);
  } finally { await fixture.close(); }
});
