import test from "node:test";
import assert from "node:assert/strict";
import { accountCheckoutDraft, checkoutDraftKey, restoreCheckoutDraft } from "../frontend/lib/checkoutDraft.js";
import type { ShopUser } from "../frontend/lib/auth.js";

const account = (id: string, patch: Partial<ShopUser> = {}): ShopUser => ({ id, fullName: id, phone: "0900000000", roles: ["customer"], ...patch } as ShopUser);
function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, value); } };
}

test("old unowned draft and account A address never prefill account B", () => {
  const store = storage();
  store.setItem("aloha_checkout_draft", JSON.stringify({ fullName: "Other person", phone: "0337095980", detail: "Other address" }));
  store.setItem(checkoutDraftKey("A"), JSON.stringify({ fullName: "A receiver", detail: "A street" }));
  const b = restoreCheckoutDraft(store, account("B"));
  assert.equal(b.fullName, "B");
  assert.equal(b.detail, "");
  assert.equal(store.getItem("aloha_checkout_draft"), null);
  assert.equal(restoreCheckoutDraft(store, account("A")).fullName, "A receiver");
});

test("retail A to retail B to A restores only each account's full receiver and geography", () => {
  const store = storage();
  const a = account("retail-A", { fullName: "Customer A", phone: "0900000001" });
  const b = account("retail-B", { fullName: "Customer B", phone: "0900000002" });
  const draftA = { ...accountCheckoutDraft(a), fullName: "Receiver A", province: "Province A", district: "District A",
    ward: "Ward A", detail: "Street A", ghnProvinceId: 1, ghnDistrictId: 11, ghnWardCode: "111" };
  store.setItem(checkoutDraftKey(a.id), JSON.stringify(draftA));
  assert.deepEqual(restoreCheckoutDraft(store, b), accountCheckoutDraft(b));
  const draftB = { ...accountCheckoutDraft(b), fullName: "Receiver B", province: "Province B", district: "District B",
    ward: "Ward B", detail: "Street B", ghnProvinceId: 2, ghnDistrictId: 22, ghnWardCode: "222" };
  store.setItem(checkoutDraftKey(b.id), JSON.stringify(draftB));
  assert.deepEqual(restoreCheckoutDraft(store, a), draftA);
  assert.deepEqual(restoreCheckoutDraft(store, b), draftB);
});

test("wholesale profile provides full default receiver; own draft edits survive returning to checkout", () => {
  const store = storage();
  const user = account("si", { roles: ["si"], siProfile: { fullName: "si si", phone: "0334561594",
    province: "Hồ Chí Minh", district: "Quận 11", ward: "Phường 1", detail: "tesst" } });
  const draft = restoreCheckoutDraft(store, user);
  assert.equal(draft.fullName, "si si");
  assert.equal(draft.phone, "0334561594");
  assert.equal(draft.district, "Quận 11");
  assert.equal(draft.detail, "tesst");
  store.setItem(checkoutDraftKey(user.id), JSON.stringify({ ...draft, detail: "Chosen receiver", ghnDistrictId: 42 }));
  assert.equal(restoreCheckoutDraft(store, user).detail, "Chosen receiver");
  assert.equal(restoreCheckoutDraft(store, user).ghnDistrictId, 42);
});

test("retail ignores wholesale profile; malformed or blocked storage safely uses account defaults", () => {
  const store = storage(), user = account("customer", { siProfile: { detail: "Unused" } });
  assert.equal(accountCheckoutDraft(user).detail, "");
  store.setItem(checkoutDraftKey(user.id), "{invalid");
  assert.deepEqual(restoreCheckoutDraft(store, user), accountCheckoutDraft(user));
  const blocked = { getItem() { throw Error("denied"); }, removeItem() { throw Error("denied"); } };
  assert.deepEqual(restoreCheckoutDraft(blocked, user), accountCheckoutDraft(user));
  store.setItem(checkoutDraftKey(user.id), JSON.stringify({ phone: {}, ghnDistrictId: -1, ghnProvinceId: "1" }));
  assert.deepEqual(restoreCheckoutDraft(store, user), accountCheckoutDraft(user));
});
