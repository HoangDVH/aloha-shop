import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { openTestDb, TEST_MONGO_SKIP, blockOutboundFetch, type TestDb } from "./helpers/testMongo.js";
import { lockMonthlyBill, markBillPaid, voidCommissionsForOrder } from "../backend/shopOrders/commission.js";
import { SHOP_COMMISSIONS, SHOP_COMMISSION_BILLS, ensureCommissionIndexes } from "../backend/shopOrders/commissionModels.js";
import { clawbackPaidOutCommissions } from "../backend/shopOrders/commissionClawback.js";
import { reconcileCommissionBills } from "../backend/shopOrders/billSettlement.js";
import { completeShopOrderReturned } from "../backend/shopOrders/completeReturned.js";
import type { Db } from "mongodb";
import express from "express";
import { registerShopCommissionAdminRoutes } from "../backend/shopOrders/commissionAdminRoutes.js";
import { registerShopCtvMeRoutes } from "../backend/shopOrders/ctvMeRoutes.js";
import { signAccessToken } from "../backend/auth/tokens.js";
import { signShopAccessToken } from "../backend/shopAuth/tokens.js";
import ExcelJS from "exceljs";

let fixture: TestDb, restore: () => void;
const period = "2025-01";
before(async () => { if (TEST_MONGO_SKIP) return; restore = blockOutboundFetch(); fixture = await openTestDb("bill_adjustments"); await ensureCommissionIndexes(fixture.db); });
after(async () => { if (fixture) await fixture.close(); restore?.(); });
beforeEach(async () => { if (fixture) for (const name of [SHOP_COMMISSIONS, SHOP_COMMISSION_BILLS, "aloha_shop_ctv_ledger", "aloha_shop_accounts", "aloha_shop_orders"]) await fixture.db.collection(name).deleteMany({}); });
async function seed() {
  await fixture.db.collection("aloha_shop_accounts").insertOne({ ctvCode: "TESTCTV", ctvBalanceDebt: 0 });
  await fixture.db.collection(SHOP_COMMISSIONS).insertMany([
    { orderCode: "ORDER1", ma: "SKU1", ctvCode: "TESTCTV", amount: 50000, status: "eligible", eligibleAt: "2025-01-10T00:00:00.000Z", billingPeriod: null },
    { orderCode: "ORDER2", ma: "SKU2", ctvCode: "TESTCTV", amount: 30000, status: "eligible", eligibleAt: "2025-01-10T00:00:00.000Z", billingPeriod: null },
  ]);
  return (await lockMonthlyBill(fixture.db, period, "test-admin")).bill as any;
}
test("return after lock changes 80k bill to 50k, keeps an auditable -30k entry; stale confirmation is rejected", { skip: TEST_MONGO_SKIP }, async () => {
  const original = await seed();
  await voidCommissionsForOrder(fixture.db, "ORDER2", { reason: "Khách hoàn hàng" });
  const bill = await fixture.db.collection(SHOP_COMMISSION_BILLS).findOne({ period });
  assert.equal(bill?.ctvLines[0].gross, 80000);
  assert.equal(bill?.ctvLines[0].adjustments, -30000);
  assert.equal(bill?.ctvLines[0].net, 50000);
  assert.equal(bill?.ctvLines[0].adjustmentEntries[0].orderCode, "ORDER2");
  assert.equal(bill?.ctvLines[0].adjustmentEntries[0].reason, "Khách hoàn hàng");
  const stale = await markBillPaid(fixture.db, period, { ctvCode: "TESTCTV", expectedRevision: original.revision, expectedAmount: 80000 } as any);
  assert.equal(stale.ok, false);
  assert.equal(await fixture.db.collection(SHOP_COMMISSIONS).countDocuments({ status: "paid_out" }), 0);
  const paid = await markBillPaid(fixture.db, period, { ctvCode: "TESTCTV", expectedRevision: bill?.revision, expectedAmount: 50000 } as any);
  assert.equal(paid.ok, true);
  assert.equal((await fixture.db.collection(SHOP_COMMISSION_BILLS).findOne({ period }))?.ctvLines[0].paidAmount, 50000);
});
test("duplicate cancellation is idempotent; fully cancelled bill cannot be marked paid", { skip: TEST_MONGO_SKIP }, async () => {
  await seed();
  await Promise.all([voidCommissionsForOrder(fixture.db, "ORDER1"), voidCommissionsForOrder(fixture.db, "ORDER1")]);
  await voidCommissionsForOrder(fixture.db, "ORDER2");
  const bill = await fixture.db.collection(SHOP_COMMISSION_BILLS).findOne({ period });
  assert.equal(bill?.ctvLines[0].net, 0);
  assert.equal(bill?.ctvLines[0].adjustments, -80000);
  assert.equal(bill?.ctvLines[0].adjustmentEntries.length, 2);
  assert.equal(bill?.ctvLines[0].paidAt, undefined);
  assert.equal(bill?.status, "cancelled");
  assert.equal((await markBillPaid(fixture.db, period, { expectedRevision: bill?.revision, expectedAmount: 0 } as any)).ok, false);
});
test("return after payment keeps paid history and creates debt exactly once under concurrent retries", { skip: TEST_MONGO_SKIP }, async () => {
  const bill = await seed();
  await markBillPaid(fixture.db, period, { expectedRevision: bill.revision, expectedAmount: 80000 } as any);
  await voidCommissionsForOrder(fixture.db, "ORDER2");
  await Promise.all([clawbackPaidOutCommissions(fixture.db, "ORDER2"), clawbackPaidOutCommissions(fixture.db, "ORDER2")]);
  const current = await fixture.db.collection(SHOP_COMMISSION_BILLS).findOne({ period });
  assert.equal(current?.ctvLines[0].net, 80000);
  assert.equal(current?.ctvLines[0].paidAmount, 80000);
  assert.equal(await fixture.db.collection("aloha_shop_ctv_ledger").countDocuments(), 1);
  assert.equal((await fixture.db.collection("aloha_shop_accounts").findOne({ ctvCode: "TESTCTV" }))?.ctvBalanceDebt, 30000);
});

function failOnce(db: Db, collectionName: string, method: string, matches: (args: any[]) => boolean): Db {
  let failed = false;
  return new Proxy(db, { get(target, prop) {
    if (prop === "collection") return (name: string) => {
      const collection = target.collection(name);
      if (name !== collectionName) return collection;
      return new Proxy(collection, { get(col, key) {
        const value = Reflect.get(col, key);
        if (key === method) return async (...args: any[]) => {
          if (!failed && matches(args)) { failed = true; throw new Error("injected settlement failure"); }
          return value.apply(col, args);
        };
        return typeof value === "function" ? value.bind(col) : value;
      } });
    };
    const value = Reflect.get(target, prop); return typeof value === "function" ? value.bind(target) : value;
  } }) as Db;
}

test("payment journal finishes safely after a failure between recording confirmation and updating commissions", { skip: TEST_MONGO_SKIP }, async () => {
  const bill = await seed();
  const broken = failOnce(fixture.db, SHOP_COMMISSIONS, "updateMany", args => args[1]?.$set?.status === "paid_out");
  await assert.rejects(markBillPaid(broken, period, { expectedRevision: bill.revision, expectedAmount: 80000 }), /injected/);
  assert.ok((await fixture.db.collection(SHOP_COMMISSION_BILLS).findOne({ period }))?.paymentPending);
  await reconcileCommissionBills(fixture.db);
  const recovered = await fixture.db.collection(SHOP_COMMISSION_BILLS).findOne({ period });
  assert.equal(recovered?.status, "paid"); assert.equal(recovered?.ctvLines[0].paidAmount, 80000);
  assert.equal(recovered?.paymentPending, undefined);
  assert.equal(await fixture.db.collection(SHOP_COMMISSIONS).countDocuments({ status: "paid_out" }), 2);
  assert.equal((await markBillPaid(fixture.db, period, { expectedRevision: bill.revision, expectedAmount: 80000 })).ok, false);
});

test("clawback retries after account increment do not double debt", { skip: TEST_MONGO_SKIP }, async () => {
  const bill = await seed();
  await markBillPaid(fixture.db, period, { expectedRevision: bill.revision, expectedAmount: 80000 });
  const broken = failOnce(fixture.db, "aloha_shop_ctv_ledger", "updateOne", args => args[1]?.$set?.debtApplied === true);
  await assert.rejects(clawbackPaidOutCommissions(broken, "ORDER2"), /injected/);
  await clawbackPaidOutCommissions(fixture.db, "ORDER2");
  assert.equal((await fixture.db.collection("aloha_shop_accounts").findOne({ ctvCode: "TESTCTV" }))?.ctvBalanceDebt, 30000);
  assert.equal(await fixture.db.collection("aloha_shop_ctv_ledger").countDocuments({ type: "clawback" }), 1);
});

test("debt is reserved once across unpaid periods, offset at settlement, and paid history is preserved", { skip: TEST_MONGO_SKIP }, async () => {
  const january = await seed();
  await markBillPaid(fixture.db, period, { expectedRevision: january.revision, expectedAmount: 80000 });
  await clawbackPaidOutCommissions(fixture.db, "ORDER2");
  await fixture.db.collection(SHOP_COMMISSIONS).insertMany([
    { orderCode: "FEB", ma: "FEB", ctvCode: "TESTCTV", amount: 100000, status: "eligible", eligibleAt: "2025-02-10T00:00:00.000Z", billingPeriod: null },
    { orderCode: "MAR", ma: "MAR", ctvCode: "TESTCTV", amount: 100000, status: "eligible", eligibleAt: "2025-03-10T00:00:00.000Z", billingPeriod: null },
  ]);
  const feb = (await lockMonthlyBill(fixture.db, "2025-02", "test")).bill as any;
  const mar = (await lockMonthlyBill(fixture.db, "2025-03", "test")).bill as any;
  assert.equal(feb.ctvLines[0].debtOffset, 30000); assert.equal(feb.ctvLines[0].net, 70000);
  assert.equal(mar.ctvLines[0].debtOffset, 0); assert.equal(mar.ctvLines[0].net, 100000);
  const broken = failOnce(fixture.db, SHOP_COMMISSION_BILLS, "updateOne", args => args[1]?.$unset?.paymentPending === "");
  await assert.rejects(markBillPaid(broken, "2025-02", { expectedRevision: feb.revision, expectedAmount: 70000 }), /injected/);
  await reconcileCommissionBills(fixture.db);
  await reconcileCommissionBills(fixture.db);
  assert.equal((await fixture.db.collection("aloha_shop_accounts").findOne({ ctvCode: "TESTCTV" }))?.ctvBalanceDebt, 0);
  assert.equal(await fixture.db.collection("aloha_shop_ctv_ledger").countDocuments({ type: "debt_offset" }), 1);
  assert.equal((await fixture.db.collection("aloha_shop_ctv_ledger").findOne({ type: "clawback" }))?.recoveredAmount, 30000);
  assert.equal((await fixture.db.collection("aloha_shop_ctv_ledger").findOne({ type: "clawback" }))?.recovered, true);
  assert.equal((await fixture.db.collection(SHOP_COMMISSION_BILLS).findOne({ period }))?.ctvLines[0].paidAmount, 80000);
  const unchanged = await fixture.db.collection(SHOP_COMMISSION_BILLS).findOne({ period: "2025-03" });
  assert.equal(unchanged?.ctvLines[0].net, 100000);
});

test("zero cash settlement due to debt is distinct from a fully cancelled payout", { skip: TEST_MONGO_SKIP }, async () => {
  await seed();
  await fixture.db.collection("aloha_shop_accounts").updateOne({ ctvCode: "TESTCTV" }, { $set: { ctvBalanceDebt: 100000 } });
  await reconcileCommissionBills(fixture.db);
  const bill = await fixture.db.collection(SHOP_COMMISSION_BILLS).findOne({ period });
  assert.equal(bill?.ctvLines[0].net, 0); assert.equal(bill?.ctvLines[0].debtOffset, 80000);
  assert.equal((await markBillPaid(fixture.db, period, { expectedRevision: bill?.revision, expectedAmount: 0 })).ok, true);
  assert.equal((await fixture.db.collection("aloha_shop_accounts").findOne({ ctvCode: "TESTCTV" }))?.ctvBalanceDebt, 20000);
});

test("a cancelled CTV is not shown as paid when another CTV in the bill was already paid", { skip: TEST_MONGO_SKIP }, async () => {
  await fixture.db.collection(SHOP_COMMISSIONS).insertOne({ orderCode: "OTHER", ma: "OTHER", ctvCode: "OTHERCTV", amount: 40000, status: "eligible", eligibleAt: "2025-01-10T00:00:00.000Z", billingPeriod: null });
  const original = await seed();
  await markBillPaid(fixture.db, period, { ctvCode: "TESTCTV", expectedRevision: original.revision, expectedAmount: 80000 });
  await voidCommissionsForOrder(fixture.db, "OTHER");
  const current = await fixture.db.collection(SHOP_COMMISSION_BILLS).findOne({ period });
  assert.equal(current?.status, "paid");
  const other = current?.ctvLines.find((line: any) => line.ctvCode === "OTHERCTV");
  assert.equal(other.net, 0); assert.ok(other.voidedAt); assert.equal(other.paidAt, undefined);
});

test("retrying an already cancelled order finishes unpaid commission cleanup", { skip: TEST_MONGO_SKIP }, async () => {
  await seed();
  await fixture.db.collection("aloha_shop_orders").insertOne({ code: "ORDER2", orderStatus: "huy" });
  await completeShopOrderReturned({ shopDb: fixture.db, orderRef: "ORDER2", confirmedBy: "test", reason: "refund" });
  assert.equal((await fixture.db.collection(SHOP_COMMISSION_BILLS).findOne({ period }))?.ctvLines[0].net, 50000);
});

test("manual adjustment with eligibleAt in the same month is included exactly once", { skip: TEST_MONGO_SKIP }, async () => {
  await fixture.db.collection(SHOP_COMMISSIONS).insertOne({ orderCode: "MANUAL", ma: "MANUAL", ctvCode: "TESTCTV", amount: -5000, status: "eligible", isAdjustment: true, billingPeriodTarget: period, eligibleAt: "2025-01-10T00:00:00.000Z", billingPeriod: null });
  const bill = await seed();
  assert.equal(bill.ctvLines[0].gross, 80000);
  assert.equal(bill.ctvLines[0].adjustments, -5000);
  assert.equal(bill.ctvLines[0].net, 75000);
});

test("API requires a current confirmation; admin, CTV and Excel show the same adjusted amount", { skip: TEST_MONGO_SKIP }, async () => {
  await seed();
  await voidCommissionsForOrder(fixture.db, "ORDER2", { reason: "Khách hoàn hàng" });
  const manager = await fixture.db.collection("users").insertOne({ username: "bill-test-manager", role: "manager", active: true });
  const account = await fixture.db.collection("aloha_shop_accounts").findOneAndUpdate({ ctvCode: "TESTCTV" }, { $set: { active: true, roles: ["ctv"], ctvStatus: "active", email: "ctv@bill-test.invalid" } }, { returnDocument: "after" });
  const token = signAccessToken({ sub: String(manager.insertedId), username: "bill-test-manager", role: "manager" });
  const ctvToken = signShopAccessToken({ sub: String(account!._id), email: "ctv@bill-test.invalid", roles: ["ctv"] });
  const app = express(); app.use(express.json());
  registerShopCommissionAdminRoutes(app, async () => fixture.db, async () => fixture.db);
  registerShopCtvMeRoutes(app, async () => fixture.db, async () => fixture.db);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    assert.equal((await fetch(`${base}/api/shop/admin/ctv/bills/${period}/mark-paid`, { method: "POST", headers, body: "{}" })).status, 409);
    const response = await fetch(`${base}/api/shop/admin/ctv/bills?period=${period}`, { headers });
    assert.equal(response.status, 200);
    const { bill } = await response.json();
    assert.equal(bill.ctvLines[0].net, 50000);
    const portal = await fetch(`${base}/api/shop/ctv/me/bills`, { headers: { Authorization: `Bearer ${ctvToken}` } });
    assert.equal(portal.status, 200);
    const own = (await portal.json()).data[0];
    assert.equal(own.net, 50000); assert.equal(own.adjustments, -30000); assert.equal(own.adjustmentEntries[0].reason, "Khách hoàn hàng");
    const exported = await fetch(`${base}/api/shop/admin/ctv/bills/${period}/export.xlsx`, { headers });
    assert.equal(exported.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await exported.arrayBuffer()) as any);
    const sheet = workbook.getWorksheet("ChiHH")!;
    const headings = sheet.getRow(1).values as string[];
    assert.equal(sheet.getRow(2).getCell(headings.indexOf("net")).value, 50000);
    assert.equal(sheet.getRow(2).getCell(headings.indexOf("adjustments")).value, -30000);
    const paid = await fetch(`${base}/api/shop/admin/ctv/bills/${period}/mark-paid`, { method: "POST", headers,
      body: JSON.stringify({ ctvCode: "TESTCTV", expectedRevision: bill.revision, expectedAmount: 50000 }) });
    assert.equal(paid.status, 200);
    const after = await fetch(`${base}/api/shop/admin/ctv/bills/${period}/export.xlsx`, { headers });
    const history = new ExcelJS.Workbook(); await history.xlsx.load(Buffer.from(await after.arrayBuffer()) as any);
    assert.equal(history.getWorksheet("ChiHH")!.rowCount, 1, "Paid rows must not appear in transfer sheet again");
    assert.equal(history.getWorksheet("LichSu")!.rowCount, 2);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test("concurrent return and payment serialize; cancellation either prevents payment or becomes a debt", { skip: TEST_MONGO_SKIP }, async () => {
  const bill = await seed();
  await fixture.db.collection("aloha_shop_orders").insertOne({ code: "ORDER2", orderStatus: "hoan_thanh" });
  const [returned, paid] = await Promise.all([
    completeShopOrderReturned({ shopDb: fixture.db, orderRef: "ORDER2", confirmedBy: "test" }),
    markBillPaid(fixture.db, period, { expectedRevision: bill.revision, expectedAmount: 80000 }),
  ]);
  assert.equal(returned.ok, true);
  const current = await fixture.db.collection(SHOP_COMMISSION_BILLS).findOne({ period });
  const debt = await fixture.db.collection("aloha_shop_accounts").findOne({ ctvCode: "TESTCTV" });
  if (paid.ok) {
    assert.equal(current?.ctvLines[0].paidAmount, 80000); assert.equal(debt?.ctvBalanceDebt, 30000);
  } else {
    assert.equal(current?.ctvLines[0].net, 50000); assert.equal(debt?.ctvBalanceDebt, 0);
    assert.equal(await fixture.db.collection(SHOP_COMMISSIONS).countDocuments({ status: "paid_out" }), 0);
  }
});
