import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { registerKvInvoiceWebhookRoutes, verifyKvWebhookSignature } from "../backend/shopOrders/kvInvoiceWebhook.js";
import { registerKvOrderWebhookRoutes } from "../backend/shopOrders/kvOrderEditSync.js";
import { reconcileShopOrderAgainstKv } from "../backend/shopOrders/kvPaymentReconcile.js";
import { markShopOrderPaid } from "../backend/shopOrders/markPaid.js";
import { registerKvPaymentAdminRoutes } from "../backend/shopOrders/kvPaymentAdmin.js";

const secret = Buffer.from("test-secret-12345678").toString("base64");
function withSecret(run: () => unknown) {
  const before = process.env.KIOTVIET_WEBHOOK_SECRET;
  process.env.KIOTVIET_WEBHOOK_SECRET = secret;
  try { return run(); } finally { if (before === undefined) delete process.env.KIOTVIET_WEBHOOK_SECRET; else process.env.KIOTVIET_WEBHOOK_SECRET = before; }
}
test("invalid signatures on invoice and order endpoints are rejected before DB/API work", async () => {
  for (const register of [registerKvInvoiceWebhookRoutes, registerKvOrderWebhookRoutes]) {
    let handler: any; let calls = 0; let status = 200;
    register({ post(_path: string, fn: any) { handler = fn; } } as any,
      async () => { calls++; throw new Error("DB must not be accessed"); }, async () => { calls++; throw new Error("API must not be accessed"); });
    const before = process.env.KIOTVIET_WEBHOOK_SECRET;
    process.env.KIOTVIET_WEBHOOK_SECRET = secret;
    try {
      await handler({ headers: { "x-hub-signature": "bad" }, rawBody: Buffer.from("{}"), body: { Notifications: [{ Data: [{ Id: 123, TotalPayment: 99999999 }] }] } },
        { status(value: number) { status = value; return this; }, json() {} });
      assert.equal(status, 401);
      assert.equal(calls, 0);
    } finally { if (before === undefined) delete process.env.KIOTVIET_WEBHOOK_SECRET; else process.env.KIOTVIET_WEBHOOK_SECRET = before; }
  }
});
test("raw body and SHA256 decoded secret required; SHA1 and reserialized body rejected", () => withSecret(() => {
  const rawBody = Buffer.from('{ "Notifications": [] }');
  const sig = createHmac("sha256", Buffer.from(secret, "base64")).update(rawBody).digest("base64");
  assert.equal(verifyKvWebhookSignature({ headers: { "x-hub-signature": sig }, rawBody, body: { Notifications: [] } } as any), true);
  assert.equal(verifyKvWebhookSignature({ headers: { "x-hub-signature": sig }, body: { Notifications: [] } } as any), false);
  const sha1 = createHmac("sha1", secret).update(rawBody).digest("hex");
  assert.equal(verifyKvWebhookSignature({ headers: { "x-hub-signature": sha1 }, rawBody } as any), false);
  assert.equal(verifyKvWebhookSignature({ headers: { "x-signature": sig }, rawBody } as any), false);
  assert.equal(verifyKvWebhookSignature({ headers: { "x-hub-signature": sig }, rawBody: Buffer.from('{}') } as any), false);
  assert.equal(verifyKvWebhookSignature({ headers: { "x-hub-signature": sig.toLowerCase() }, rawBody } as any), false);
}));
test("missing or malformed secret never enables unsigned local webhooks", () => {
  const before = process.env.KIOTVIET_WEBHOOK_SECRET;
  try {
    for (const value of ["", "not-a-base64-secret!"]) {
      process.env.KIOTVIET_WEBHOOK_SECRET = value;
      assert.equal(verifyKvWebhookSignature({ headers: {}, rawBody: Buffer.from('{}') } as any), false);
    }
  } finally { if (before === undefined) delete process.env.KIOTVIET_WEBHOOK_SECRET; else process.env.KIOTVIET_WEBHOOK_SECRET = before; }
});

const order = { _id: "order1", code: "WEB1", kvInvoiceId: 123, kvInvoiceCode: "HD123", paymentStatus: "unpaid", totalPayment: 100000, method: "Transfer" };
function reconcileFixture() {
  const writes: any[] = [];
  const db: any = { collection: () => ({ updateOne: async (filter: any, update: any) => { writes.push({ filter, update }); return { modifiedCount: 1 }; } }) };
  let paid = 0;
  const markPaid: any = async () => { paid++; return { ok: true, order: { paymentStatus: "paid" } }; };
  return { db, writes, markPaid, paid: () => paid };
}
test("API outage cannot trust attacker supplied fallbackReceived or mark payment paid", async () => {
  const h = reconcileFixture();
  const result = await reconcileShopOrderAgainstKv({ shopDb: h.db, mainDb: h.db, order, fallbackReceived: 99999999 } as any,
    { getInvoice: async () => { throw new Error("KV unavailable"); }, markPaid: h.markPaid });
  assert.equal(result, "fail");
  assert.equal(h.paid(), 0);
  assert.equal(h.writes[0].update.$set["kvPaymentVerification.state"], "pending");
  assert.equal(h.writes[0].update.$set.paymentStatus, undefined);
});
test("already paid/cancelled orders do not reprocess duplicate notifications", async () => {
  for (const paymentStatus of ["paid", "cancelled", "cod"]) {
    const h = reconcileFixture();
    const result = await reconcileShopOrderAgainstKv({ shopDb: h.db, mainDb: h.db, order: { ...order, paymentStatus } },
      { getInvoice: async () => { throw new Error("Must not fetch"); }, markPaid: h.markPaid });
    assert.equal(result, "skip"); assert.equal(h.paid(), 0); assert.equal(h.writes.length, 0);
  }
});
test("invalid amount, wrong customer and cancelled payment rows cannot authorize payment", async () => {
  for (const invoice of [
    { id: 123, code: "HD123", status: 1, totalPayment: Infinity, customerId: 7 },
    { id: 123, code: "HD123", status: 1, totalPayment: 100000, customerId: 8 },
    { id: 123, code: "HD123", status: 1, totalPayment: 0, customerId: 7, payments: [{ amount: 100000, status: 2 }] },
  ]) {
    const h = reconcileFixture();
    assert.notEqual(await reconcileShopOrderAgainstKv({ shopDb: h.db, mainDb: h.db, order: { ...order, kvCustomerId: 7 } },
      { getInvoice: async () => invoice, markPaid: h.markPaid }), "paid");
    assert.equal(h.paid(), 0);
  }
});
test("markPaid rejects absent proof and proof for a stale invoice/order amount before any writes", async () => {
  let writes = 0;
  const shopDb: any = { collection: () => ({ findOne: async () => ({ ...order, totalPayment: 200000 }), updateOne: async () => { writes++; } }) };
  for (const proof of [undefined, { invoiceId: "123", invoiceCode: "HD123", expected: 100000, received: 100000 }]) {
    const result = await markShopOrderPaid({ shopDb, mainDb: shopDb, orderCode: order.code, source: "kiotqr", kvPaymentProof: proof });
    assert.equal(result.ok, false); assert.equal(result.code, "kv_payment_verification_required");
  }
  assert.equal(writes, 0);
});
test("admin retry is manager-gated and rejects non-transfer orders", async () => {
  let handlers: any[] = []; let status = 200; let mainCalls = 0;
  const shop: any = { collection: () => ({ findOne: async () => ({ ...order, method: "Cash" }) }) };
  registerKvPaymentAdminRoutes({ post(_path: string, ...fns: any[]) { handlers = fns; } } as any,
    async () => { mainCalls++; throw new Error("Must not fetch API for COD"); }, async () => shop);
  assert.equal(handlers.length, 4);
  await handlers.at(-1)({ headers: {}, ip: "retry-fixture", params: { id: "WEB1" } },
    { setHeader() {}, status(value: number) { status = value; return this; }, json() {}, sendStatus(value: number) { status = value; } });
  assert.equal(status, 400); assert.equal(mainCalls, 0);
});
test("only authoritative matching invoice with sufficient received payment marks paid", async () => {
  for (const [invoice, expected] of [[{ id: 123, code: "HD123", status: 1, totalPayment: 100000 }, "paid"],
    [{ id: 123, code: "HD123", status: 1, totalPayment: 99999 }, "skip"],
    [{ id: 999, code: "HD999", status: 1, totalPayment: 100000 }, "fail"],
    [{ id: 123, code: "HD123", status: 2, totalPayment: 100000 }, "fail"],
    [null, "fail"]] as const) {
    const h = reconcileFixture();
    const result = await reconcileShopOrderAgainstKv({ shopDb: h.db, mainDb: h.db, order }, { getInvoice: async () => invoice, markPaid: h.markPaid });
    assert.equal(result, expected);
    assert.equal(h.paid(), expected === "paid" ? 1 : 0);
  }
});
