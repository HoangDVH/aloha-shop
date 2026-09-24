import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createAddressSafely, addressSnapshotFilter } from "../backend/shopOrders/addressWrite.js";

const address = { fullName: "Khách", phone: "0901234567", province: "HCM", ward: "P1", detail: "123 A", isDefault: true };

function accountsFixture() {
  let row: any = { _id: "account", addresses: [] };
  const collection: any = {
    findOne: async () => structuredClone(row),
    updateOne: async (filter: any, update: any) => {
      if (JSON.stringify(filter.addresses.$eq) !== JSON.stringify(row.addresses)) return { matchedCount: 0 };
      row = { ...row, ...structuredClone(update.$set) };
      return { matchedCount: 1 };
    },
  };
  return { collection, snapshot: () => structuredClone(row) };
}

test("concurrent identical address creates and a lost-response retry reuse one ID", async () => {
  const f = accountsFixture();
  const results = await Promise.all(Array.from({ length: 10 }, () => createAddressSafely(f.collection, f.snapshot(), address)));
  assert.equal(f.snapshot().addresses.length, 1);
  assert.equal(new Set(results.map(r => r?.addressId)).size, 1);
  const replay = await createAddressSafely(f.collection, f.snapshot(), address);
  assert.equal(replay?.reused, true);
  assert.equal(replay?.addressId, results[0]?.addressId);
});

test("different concurrent addresses are preserved with exactly one default", async () => {
  const f = accountsFixture();
  const results = await Promise.all(["A", "B", "C"].map(detail => createAddressSafely(f.collection, f.snapshot(), { ...address, detail })));
  assert.ok(results.every(Boolean));
  assert.equal(f.snapshot().addresses.length, 3);
  assert.equal(f.snapshot().addresses.filter((a: any) => a.isDefault).length, 1);
  const replay = await createAddressSafely(f.collection, f.snapshot(), { ...address, detail: "A" });
  assert.equal(replay?.addressId, results[0]?.addressId);
  assert.equal(replay?.addresses.find(a => a.isDefault)?.id, results[0]?.addressId);
});

test("stale address edits cannot overwrite a concurrent create", async () => {
  const f = accountsFixture();
  const old = f.snapshot();
  await createAddressSafely(f.collection, old, address);
  const result = await f.collection.updateOne(addressSnapshotFilter(old), { $set: { addresses: [] } });
  assert.equal(result.matchedCount, 0);
  assert.equal(f.snapshot().addresses.length, 1);
});

test("address contention is bounded and missing legacy arrays use exists:false", async () => {
  const user: any = { _id: "legacy" };
  assert.deepEqual(addressSnapshotFilter(user).addresses, { $exists: false });
  let writes = 0;
  const collection: any = { updateOne: async () => { writes++; return { matchedCount: 0 }; }, findOne: async () => user };
  assert.equal(await createAddressSafely(collection, user, address), null);
  assert.equal(writes, 5);
});

// Execute the actual hook with isolated hook/API adapters; no browser or live API needed.
function checkoutFixture() {
  let addressCalls = 0;
  const orders: any[] = [];
  const submitting: boolean[] = [];
  const errors: string[] = [];
  let resolveAddress!: (value: any) => void;
  let rejectAddress!: (error: Error) => void;
  let pending = new Promise((resolve, reject) => { resolveAddress = resolve; rejectAddress = reject; });
  let failOrder = false;
  const refs: any[] = [];
  let refIndex = 0;
  const pass = { safeParse: () => ({ success: true }) };
  const adapters: Record<string, any> = {
    react: { useRef: (value: any) => refs[refIndex++] ||= { current: value } },
    "@tanstack/react-query": { useQueryClient: () => ({ invalidateQueries() {}, setQueryData() {} }),
      useMutation: ({ mutationFn }: any) => ({ mutateAsync: mutationFn }) },
    "@/lib/orders": { createAddress: () => { addressCalls++; return pending; },
      displayShopOrderCode: (data: any) => data.code,
      placeShopOrder: async (body: any) => { orders.push(body); if (failOrder) throw new Error("network lost"); return { data: { code: "ORDER-1" } }; } },
    "@/lib/checkoutFlags": { shopShowCheckoutShipping: () => false },
    "@/lib/checkoutSchemas": { checkoutAgreeSchema: { safeParse: ({ agree }: any) => agree ? { success: true } : { success: false, error: { issues: [{ message: "agree" }] } } }, checkoutReceiverSchema: pass, checkoutShipAddressSchema: pass },
    "@/lib/priceSession": { usePriceSession: { getState: () => ({ ready: true }) } },
    "@/lib/cartVariant": { formatVariantLabel: () => "" },
    "@/lib/auth": {}, "@/lib/authQueries": {}, "@/lib/cart": {}, "@/lib/api": {}, antd: {},
  };
  const source = readFileSync(new URL("../frontend/components/checkout/usePlaceOrder.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports: any = {};
  vm.runInNewContext(compiled, { exports, require: (id: string) => {
    assert.ok(id in adapters, `Unexpected dependency ${id}`); return adapters[id];
  } });
  const args: any = { agree: true, selected: [{ ma: "P1", ten: "Plant", qty: 1, gia: 10 }],
    delivery: "giao_tan_noi", showNewForm: true, addresses: [], draft: { ...address, district: "" },
    setAddresses() {}, setSelectedAddrId() {}, setShowNewForm() {}, shippingQuote: null,
    note: "", user: { phone: address.phone }, replace() {}, removeSelected() {},
    setError: (message: string) => errors.push(message), setSubmitting: (value: boolean) => submitting.push(value) };
  const render = () => { refIndex = 0; return exports.usePlaceOrder(args); };
  return { args, render, orders, submitting, errors, addressCalls: () => addressCalls,
    resolve: () => resolveAddress({ addressId: "reused-first", addresses: [{ id: "reused-first" }, { id: "another-last" }] }),
    reject: () => rejectAddress(new Error("address unavailable")),
    resetAddress: () => { pending = Promise.resolve({ addressId: "reused-first", addresses: [] }); },
    failOrder: (value: boolean) => { failOrder = value; } };
}

test("rapid submits, including a rerender while address is pending, create only one order", async () => {
  const f = checkoutFixture();
  const hook = f.render();
  const first = hook.placeOrder({ policyAccepted: true });
  await hook.placeOrder({ policyAccepted: true });
  await f.render().placeOrder({ policyAccepted: true });
  assert.equal(f.addressCalls(), 1);
  assert.deepEqual(f.submitting, [true]);
  f.resolve(); await first;
  assert.equal(f.orders.length, 1);
  assert.equal(f.orders[0].addressId, "reused-first");
  await f.render().placeOrder({ policyAccepted: true });
  assert.equal(f.addressCalls(), 1);
  assert.equal(f.orders.length, 1);
});

test("address failure releases the lock and allows retry", async () => {
  const f = checkoutFixture(); const hook = f.render();
  const first = hook.placeOrder({ policyAccepted: true });
  f.reject(); await first;
  assert.equal(f.orders.length, 0);
  assert.equal(f.submitting.at(-1), false);
  f.resetAddress(); await hook.placeOrder({ policyAccepted: true });
  assert.equal(f.orders.length, 1);
});

test("validation early return releases lock without creating an address", async () => {
  const f = checkoutFixture(); f.args.note = "x".repeat(256);
  await f.render().placeOrder({ policyAccepted: true });
  assert.equal(f.addressCalls(), 0);
  assert.equal(f.submitting.at(-1), false);
  f.args.note = ""; f.resetAddress();
  await f.render().placeOrder({ policyAccepted: true });
  assert.equal(f.orders.length, 1);
});

test("order failure allows retry using the same idempotency key", async () => {
  const f = checkoutFixture(); f.resetAddress(); f.failOrder(true);
  const hook = f.render(); await hook.placeOrder({ policyAccepted: true });
  assert.equal(f.submitting.at(-1), false);
  f.failOrder(false); await hook.placeOrder({ policyAccepted: true });
  assert.equal(f.orders.length, 2);
  assert.equal(f.orders[0].idempotencyKey, f.orders[1].idempotencyKey);
});
