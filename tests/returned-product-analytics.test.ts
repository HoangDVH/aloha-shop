import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { salesLines } from "../backend/shopAnalytics/sales.js";

test("actual partial-return handler records an idempotent product marker for net-sales analytics", async () => {
  const order: any = { _id: "O", code: "WEB-O", orderStatus: "hoan_thanh", paymentStatus: "paid", total: 180,
    orderDetails: [{ productCode: "P", quantity: 1, price: 100 }, { productCode: "C", quantity: 1, price: 100 }] };
  const writes: any[] = [], exports: any = {};
  const code = ts.transpileModule(readFileSync("backend/shopOrders/completeReturned.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require(name: string) {
    if (name.endsWith("models.js")) return { SHOP_ORDERS: "orders" };
    if (name.endsWith("commission.js")) return { voidCommissionsForOrder: async () => 0 };
    if (name.endsWith("commissionClawback.js")) return { clawbackPaidOutCommissions: async () => ({ clawed: 0, amount: 0 }) };
    if (name.endsWith("stockHold.js")) return { releaseShopStockHolds: async () => 0 };
    if (name.endsWith("syncBus.js")) return { syncBus: { publish() {} } };
    if (name.endsWith("notifyOrderStatus.js")) return { notifyOrderStatus: async () => {} };
    if (name.endsWith("findShopOrder.js")) return { shopOrderLookupFilter: () => ({ code: "WEB-O" }) };
    if (name.endsWith("redemptionService.js")) return { releasePromotionHold: async () => {} };
    throw new Error(name);
  } });
  const db = { collection: () => ({ findOne: async () => order, updateOne: async (_: unknown, update: any) => {
    writes.push(update); Object.assign(order, update.$set);
    order.returnedProductCodes = [...new Set([...(order.returnedProductCodes || []), update.$addToSet.returnedProductCodes])];
  } }) };
  for (let i = 0; i < 2; i++) await exports.completeShopOrderReturned({ shopDb: db, orderRef: "WEB-O", confirmedBy: "test", ma: "p" });
  assert.deepEqual(order.returnedProductCodes, ["P"]); assert.equal(writes[0].$addToSet.returnedProductCodes, "P");
  assert.equal(order.orderStatus, "hoan_thanh"); assert.equal(order.total, 180);
  assert.equal(salesLines(order)[0].ma, "C"); assert.equal(salesLines(order)[0].revenue, 90);
});
