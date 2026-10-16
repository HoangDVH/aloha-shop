import test from "node:test";
import assert from "node:assert/strict";
import type { Collection } from "mongodb";
import { registrationAddressPatch, ensureRegistrationAddress } from "../backend/shopWholesale/registrationAddress.js";

const profile = { fullName: "Customer", phone: "0901234567", province: "Hồ Chí Minh", district: "Quận 8", ward: "Phường 2", detail: "123 Street",
  ghnProvinceId: 202, ghnDistrictId: 1550, ghnWardCode: "12345" };
const other = { ...profile, id: "other", detail: "Other street", isDefault: true };

test("registration saves the complete address, preserves others and sets only one default", () => {
  const patch = registrationAddressPatch([other], profile);
  assert.equal(patch.addresses.length, 2);
  assert.equal(patch.addresses.filter(a => a.isDefault).length, 1);
  const saved = patch.addresses.find(a => a.id === patch.siRegistrationAddressId)!;
  for (const key of Object.keys(profile)) assert.equal((saved as any)[key], (profile as any)[key]);
  assert.equal(patch.addresses.find(a => a.id === "other")!.detail, other.detail);
});

test("matching address reuses its ID and carrier data even with a different label", () => {
  const existing = { ...profile, id: "existing", label: "Business", isDefault: false };
  const { ghnProvinceId, ghnDistrictId, ghnWardCode, ...withoutCarrier } = profile;
  const patch = registrationAddressPatch([other, existing], withoutCarrier);
  assert.equal(patch.addresses.length, 2);
  assert.equal(patch.siRegistrationAddressId, "existing");
  assert.equal(patch.addresses[1].ghnWardCode, ghnWardCode);
  assert.equal(registrationAddressPatch(patch.addresses, profile).addresses.length, 2);
});

test("old HCM/TINH accounts backfill once and preserve subsequent default changes or deletion", async () => {
  for (const siRegion of ["HCM", "TINH"]) {
    const user: any = { _id: "owner", roles: ["si"], siStatus: "active", siRegion, siProfile: profile, addresses: [other] };
    let writes = 0;
    const accounts = { updateOne: async (filter: any, update: any) => {
      assert.equal(filter._id, "owner");
      assert.deepEqual(filter.addresses.$eq, user.addresses);
      writes++; Object.assign(user, update.$set); return { matchedCount: 1 };
    } } as unknown as Collection;
    assert.equal((await ensureRegistrationAddress(accounts, user))!.length, 2);
    const id = user.siRegistrationAddressId;
    user.addresses = user.addresses.map((a: any) => ({ ...a, isDefault: a.id === "other" }));
    assert.equal((await ensureRegistrationAddress(accounts, user))!.find(a => a.isDefault)!.id, "other");
    user.addresses = user.addresses.filter((a: any) => a.id !== id);
    assert.equal((await ensureRegistrationAddress(accounts, user))!.length, 1);
    assert.equal(writes, 1);
  }
});

test("concurrent address saves are reloaded and preserved, with bounded contention", async () => {
  const initial: any = { _id: "owner", roles: ["si"], siStatus: "active", siProfile: profile };
  const latest = { ...initial, addresses: [other] };
  let writes = 0;
  const accounts = { findOne: async () => latest, updateOne: async (_filter: any, update: any) => {
    if (++writes === 1) return { matchedCount: 0 };
    assert.ok(update.$set.addresses.some((a: any) => a.id === "other"));
    return { matchedCount: 1 };
  } } as unknown as Collection;
  assert.equal((await ensureRegistrationAddress(accounts, initial))!.length, 2);
  assert.equal(writes, 2);
  const busy = { updateOne: async () => ({ matchedCount: 0 }), findOne: async () => initial } as unknown as Collection;
  assert.equal(await ensureRegistrationAddress(busy, initial), null);
});

test("retail, locked accounts and incomplete profiles do not gain an address", async () => {
  const accounts = { updateOne: async () => { throw Error("unexpected write"); } } as unknown as Collection;
  for (const patch of [{ roles: ["customer"] }, { siStatus: "khoa" }, { active: false }, { siProfile: {} }]) {
    const user: any = { _id: "owner", roles: ["si"], siStatus: "active", siProfile: profile, ...patch };
    assert.deepEqual(await ensureRegistrationAddress(accounts, user), []);
  }
});
