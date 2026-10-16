import type { Collection, Document, WithId } from "mongodb";
import { z } from "zod";
import { addressSchema } from "./schema.js";
import { isActiveWholesale } from "./policy.js";
import { normalizeAddresses, newAddressId } from "../shopOrders/models.js";
import { addressSnapshotFilter } from "../shopOrders/addressWrite.js";

const profileSchema = addressSchema.extend({ fullName: z.string().trim().min(2).max(120) });
export function registrationAddressPatch(rawAddresses: unknown, profile: unknown) {
  const value = profileSchema.parse(profile);
  const addresses = normalizeAddresses(rawAddresses);
  const fields = ["fullName", "phone", "province", "district", "ward", "detail"] as const;
  const existing = addresses.find(address => fields.every(field => String(address[field] || "").trim() === String(value[field] || "").trim()));
  const id = existing?.id || newAddressId();
  if (!existing) addresses.push({ id, fullName: value.fullName, phone: value.phone, province: value.province,
    district: value.district || undefined, ward: value.ward, detail: value.detail,
    ghnProvinceId: value.ghnProvinceId || undefined, ghnDistrictId: value.ghnDistrictId || undefined,
    ghnWardCode: value.ghnWardCode || undefined, isDefault: true });
  return { addresses: addresses.map(address => ({ ...address, isDefault: address.id === id })), siRegistrationAddressId: id };
}

/** Backfill old wholesale profiles once, with the same optimistic guard as address-book writes. */
export async function ensureRegistrationAddress(accounts: Collection, initial: WithId<Document>) {
  let user: WithId<Document> | null = initial;
  for (let attempt = 0; attempt < 5 && user; attempt++) {
    const addresses = normalizeAddresses(user.addresses);
    if (!isActiveWholesale(user) || typeof user.siRegistrationAddressId === "string") return addresses;
    if (!profileSchema.safeParse(user.siProfile).success) return addresses;
    const patch = registrationAddressPatch(user.addresses, user.siProfile);
    const result = await accounts.updateOne({ ...addressSnapshotFilter(user), siStatus: "active", active: { $ne: false },
      roles: "si", siProfile: { $eq: user.siProfile } }, { $set: { ...patch, updatedAt: new Date() } });
    if (result.matchedCount) return patch.addresses;
    user = await accounts.findOne({ _id: initial._id });
  }
  return null;
}
