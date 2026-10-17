import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import { orderBodyHash, findIdempotentReplay } from "../backend/shopOrders/create/orderResponse.js";
import { registerShopOrderCreateRoutes } from "../backend/shopOrders/orderCreateRoutes.js";
import { signShopAccessToken } from "../backend/shopAuth/tokens.js";
import { createMockDb } from "./helpers/antiAbuseMockDb.js";
import { checkoutReceiverSchema } from "../frontend/lib/checkoutSchemas.js";
import { registerSchema, loginSchema } from "../frontend/lib/authSchemas.js";

const checkout = {
  orderDetails: [{ productCode: "QA_PLANT", productName: "QA plant", quantity: 1, price: 100000 }],
  customerPhone: "0901234567", deliveryMethod: "giao_tan_noi", shippingAddress: "123 QA",
  province: "TP. Hồ Chí Minh", district: "Tân Bình", ward: "Phường A", ghnDistrictId: 1457,
  ghnWardCode: "QA01", subtotal: 100000,
};
const saved = (bodyHash?: string) => ({ ...checkout, code: "QA-ORDER", id: "QA-ORDER",
  shopAccountId: "qa-buyer", idempotencyKey: "qa-key", method: "Pending", bodyHash });
const legacyHash = () => crypto.createHash("sha256").update(JSON.stringify({
  items: checkout.orderDetails.map(({ productCode, quantity, price }) => ({ productCode, quantity, price })),
  customerPhone: checkout.customerPhone, deliveryMethod: checkout.deliveryMethod,
  shippingAddress: checkout.shippingAddress, subtotal: checkout.subtotal,
})).digest("hex");

test("same checkout content replays exactly one saved order", async () => {
  const hash = orderBodyHash(checkout);
  const { db } = createMockDb({ aloha_shop_orders: [saved(hash)] });
  const replay = await findIdempotentReplay(db, "qa-buyer", "qa-key", orderBodyHash({ ...checkout }));
  assert.equal(replay.kind, "reused");
});

for (const [field, value] of Object.entries({ province: "Đồng Nai", district: "Quận 1", ward: "Phường B",
  ghnDistrictId: 1442, ghnWardCode: "QA02", shippingAddress: "456 QA" })) {
  test(`same key with changed ${field} conflicts instead of replaying the wrong destination`, async () => {
    const { db } = createMockDb({ aloha_shop_orders: [saved(orderBodyHash(checkout))] });
    const replay = await findIdempotentReplay(db, "qa-buyer", "qa-key", orderBodyHash({ ...checkout, [field]: value }));
    assert.equal(replay.kind, "conflict");
  });
}

for (const storedHash of [legacyHash(), undefined]) {
  test(`legacy order (${storedHash ? "old hash" : "missing hash"}) permits the same address but rejects a changed ward`, async () => {
    const { db } = createMockDb({ aloha_shop_orders: [saved(storedHash)] });
    assert.equal((await findIdempotentReplay(db, "qa-buyer", "qa-key", orderBodyHash(checkout))).kind, "reused");
    assert.equal((await findIdempotentReplay(db, "qa-buyer", "qa-key", orderBodyHash({ ...checkout, ward: "Phường B" }))).kind, "conflict");
  });
}

test("idempotency stays isolated by account and absent keys do not reuse orders", async () => {
  const { db } = createMockDb({ aloha_shop_orders: [saved(orderBodyHash(checkout))] });
  assert.equal((await findIdempotentReplay(db, "other-buyer", "qa-key", orderBodyHash(checkout))).kind, "none");
  assert.equal((await findIdempotentReplay(db, "qa-buyer", "", orderBodyHash(checkout))).kind, "none");
});

test("checkout accepts Vietnamese mobile, landline and international phone formats", () => {
  for (const phone of ["0901234567", "090 123 4567", "090-123-4567", "+84 90 123 4567", "84901234567", "02812345678", "+842812345678"]) {
    assert.equal(checkoutReceiverSchema.safeParse({ customerName: "QA", customerPhone: phone }).success, true, phone);
  }
});

test("checkout rejects letters, foreign prefixes, impossible lengths and multiple phone numbers", () => {
  for (const phone of ["abc", "abcdefghij", "abc0901234567", "0901234567abc", "12345678", "090123", "090123456789", "+1901234567", "0901234567/0912345678"]) {
    assert.equal(checkoutReceiverSchema.safeParse({ customerName: "QA", customerPhone: phone }).success, false, phone);
  }
});

test("order API rejects malformed phones before catalog pricing or order creation", async () => {
  const account = { _id: "qa-phone", roles: ["customer"], email: "qa@example.invalid", active: true };
  const { db, collections } = createMockDb({ aloha_shop_accounts: [account] });
  const app = express(); app.use(express.json());
  registerShopOrderCreateRoutes(app, async () => db, async () => db, async () => {});
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/shop/orders`;
  const token = signShopAccessToken({ sub: account._id, email: account.email, roles: account.roles });
  try {
    for (const customerPhone of ["abc", "abcdefghij", "abc0901234567", "12345678", "+1901234567"]) {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...checkout, customerName: "QA", customerPhone, policyAccepted: true, method: "Cash" }) });
      assert.equal(res.status, 400);
      assert.match((await res.json()).error, /Số điện thoại không hợp lệ/);
    }
    assert.equal((collections.aloha_shop_orders || []).length, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

const registration = { fullName: "QA", email: "qa@example.invalid", asCustomer: true, asCtv: false };
test("registration rejects six/seven characters and accepts eight with matching confirmation", () => {
  for (const password of ["abc123", "abc1234"]) {
    const result = registerSchema.safeParse({ ...registration, password, passwordConfirm: password });
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.error.issues[0].message, /8 ký tự/);
  }
  assert.equal(registerSchema.safeParse({ ...registration, password: "abc12345", passwordConfirm: "abc12345" }).success, true);
  assert.equal(registerSchema.safeParse({ ...registration, password: "abc12345", passwordConfirm: "different" }).success, false);
});

test("existing accounts can still log in with their old six-character passwords", () => {
  assert.equal(loginSchema.safeParse({ email: "qa@example.invalid", password: "abc123" }).success, true);
});
