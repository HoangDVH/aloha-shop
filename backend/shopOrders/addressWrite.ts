import type { Collection, Document, WithId } from "mongodb";
import { ensureOneDefault, newAddressId, normalizeAddresses, type ShopAddress } from "./models.js";

/** Compare the original array atomically so another request cannot be overwritten. */
export function addressSnapshotFilter(user: WithId<Document>) {
  return {
    _id: user._id,
    addresses: user.addresses === undefined ? { $exists: false } : { $eq: user.addresses },
  };
}

const identityFields = ["fullName", "phone", "province", "district", "ward", "detail",
  "ghnProvinceId", "ghnDistrictId", "ghnWardCode", "label"] as const;

function sameAddress(a: ShopAddress, b: Omit<ShopAddress, "id">) {
  return identityFields.every(field => String(a[field] ?? "").trim() === String(b[field] ?? "").trim());
}

/** Repeated identical creates reuse the address; different concurrent creates are retried. */
export async function createAddressSafely(
  accounts: Collection,
  initialUser: WithId<Document>,
  input: Omit<ShopAddress, "id">,
) {
  let user: WithId<Document> | null = initialUser;
  const id = newAddressId();
  for (let attempt = 0; attempt < 5 && user; attempt++) {
    let addresses = normalizeAddresses(user.addresses);
    const existing = addresses.find(address => sameAddress(address, input));
    const addressId = existing?.id ?? id;
    if (existing && (!input.isDefault || existing.isDefault)) {
      return { user, addresses, addressId, reused: true };
    }
    if (!existing) addresses.push({ ...input, id, isDefault: input.isDefault || addresses.length === 0 });
    if (input.isDefault) addresses = addresses.map(address => ({ ...address, isDefault: address.id === addressId }));
    addresses = ensureOneDefault(addresses);
    const result = await accounts.updateOne(addressSnapshotFilter(user), {
      $set: { addresses, updatedAt: new Date() },
    });
    if (result.matchedCount) return { user, addresses, addressId, reused: Boolean(existing) };
    user = await accounts.findOne({ _id: initialUser._id });
  }
  return null;
}
