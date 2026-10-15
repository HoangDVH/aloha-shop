import test from "node:test";
import assert from "node:assert/strict";
import { kvDeliveryAddressForOrder, matchKvDeliveryRegion, resolveKvDeliveryRegion } from "../backend/shopOrders/kvDeliveryAddress.js";
import { ensureReviewKvOrder, ensureAwaitingInvoice } from "../backend/shopInvoices/invoiceService.js";
const address = { province: "Hồ Chí Minh", district: "Quận 12", ward: "Phường An Phú Đông" };
test("old addresses match province and district together, without using GHN IDs", () => {
  const order = { deliveryMethod: "giao_tan_noi", ...address, ghnDistrictId: 1454 };
  assert.deepEqual(kvDeliveryAddressForOrder(order), address);
  assert.deepEqual(matchKvDeliveryRegion(address, [{ id: 339, name: "Hồ Chí Minh - Quận 12" }]),
    { locationId: 339, locationName: "Hồ Chí Minh - Quận 12", wardName: address.ward });
  assert.equal(matchKvDeliveryRegion({ ...address, province: "TP. Hồ Chí Minh" }, [{ id: 339, name: "Hồ Chí Minh - Quận 12" }]).locationId, 339);
  assert.equal(matchKvDeliveryRegion(address, [{ id: 999, name: "Tỉnh khác - Quận 12" }]).locationId, undefined);
  assert.equal(kvDeliveryAddressForOrder({ ...order, deliveryMethod: "nhan_cua_hang" }), undefined);
  assert.equal(kvDeliveryAddressForOrder({ province: "Hồ Chí Minh" }), undefined);
});
test("new addresses keep their two-level format; ambiguous locations do not guess IDs", () => {
  assert.deepEqual(matchKvDeliveryRegion({ province: address.province, ward: address.ward }, [{ id: 79, name: address.province }]),
    { locationId: 79, locationName: address.province, wardName: address.ward });
  assert.equal(matchKvDeliveryRegion(address, [{ id: 1, name: "Hồ Chí Minh - Quận 12" }, { id: 2, name: "Hồ Chí Minh - Quận 12" }]).locationId, undefined);
});
test("directory reads all pages, caches results and retries failed loads", async () => {
  const original = globalThis.fetch;
  const creds = { retailer: "directory-test", clientId: "test", clientSecret: "test" };
  let calls = 0;
  try {
    globalThis.fetch = (async url => {
      const offset = Number(new URL(String(url)).searchParams.get("currentItem")); calls++;
      return Response.json({ total: 2, data: offset ? [{ id: 339, name: "Hồ Chí Minh - Quận 12" }] : [{ id: 1, name: "Other" }] });
    }) as typeof fetch;
    assert.equal((await resolveKvDeliveryRegion(creds, "token", address)).locationId, 339);
    assert.equal((await resolveKvDeliveryRegion(creds, "token", address)).locationId, 339);
    assert.equal(calls, 2);
    const failure = { ...creds, retailer: "retry-test" };
    globalThis.fetch = (async () => new Response("", { status: 503 })) as typeof fetch;
    assert.equal((await resolveKvDeliveryRegion(failure, "token", address)).locationName, "Hồ Chí Minh - Quận 12");
    globalThis.fetch = (async () => Response.json({ total: 1, data: [{ id: 339, name: "Hồ Chí Minh - Quận 12" }] })) as typeof fetch;
    assert.equal((await resolveKvDeliveryRegion(failure, "token", address)).locationId, 339);
  } finally { globalThis.fetch = original; }
});
test("orders and invoices send separate address fields without changing prices or payment", async () => {
  const original = globalThis.fetch, env = { ...process.env }, payloads: any[] = [];
  try {
    Object.assign(process.env, { KV_CLIENT_ID: "test", KV_CLIENT_SECRET: "test", KV_RETAILER: "payload-test",
      SHOP_KV_BRANCH_ID: "1", SHOP_KV_SOLD_BY_ID: "2", SHOP_KV_SALE_CHANNEL_ID: "3", SHOP_KV_ACCOUNT_ID: "0" });
    globalThis.fetch = (async (url, init) => {
      if (String(url).includes("connect/token")) return Response.json({ access_token: "test" });
      if (String(url).includes("/locations")) return Response.json({ total: 1, data: [{ id: 770, name: "Thành phố Hồ Chí Minh" }] });
      assert.equal(init?.method, "POST"); payloads.push(JSON.parse(String(init?.body)));
      return Response.json({ id: 99, code: "QA99" });
    }) as typeof fetch;
    const base = { mainDb: {} as any, customerId: 5, customerName: "QA", customerPhone: "0000000000",
      address: "45f, Phường An Phú Đông, Quận 12, Hồ Chí Minh", deliveryAddress: address,
      orderDetails: [{ productCode: "P", productName: "P", quantity: 1, price: 250000 }],
      description: "QA", totalPayment: 0, shippingFee: 0, discount: 12500 };
    await ensureReviewKvOrder(base); await ensureAwaitingInvoice(base);
    for (const payload of payloads) {
      const delivery = payload.orderDelivery || payload.invoiceDelivery;
      assert.equal(delivery.locationId, 770); assert.equal(delivery.wardName, address.ward);
      assert.equal(delivery.address, "45f, Phường An Phú Đông, Thành phố Hồ Chí Minh"); assert.equal(payload.totalPayment, 0);
    }
    assert.equal(payloads[0].discount, 12500); assert.equal(payloads[0].orderDetails[0].price, 250000);
    assert.equal(payloads[0].usingCod, false);
  } finally { globalThis.fetch = original; process.env = env; }
});
