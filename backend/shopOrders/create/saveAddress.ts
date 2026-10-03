import type { Db } from "mongodb";
import { SHOP_ACCOUNTS } from "../../shopAuth/models.js";
import { ensureOneDefault, newAddressId, normalizeAddresses } from "../models.js";

/** Lưu địa chỉ giao vào sổ địa chỉ của tài khoản nếu chưa có. */
export async function rememberShippingAddress(
  shopDb: Db,
  user: any,
  addr: { customerName: string; customerPhone: string; province: string; ward: string; shippingAddress: string }
): Promise<void> {
  let addresses = normalizeAddresses(user.addresses);
  const dup = addresses.find(
    (a) =>
      a.fullName === addr.customerName &&
      a.phone === addr.customerPhone &&
      a.province === addr.province &&
      a.ward === addr.ward &&
      a.detail === addr.shippingAddress
  );
  if (dup) return;
  addresses = ensureOneDefault([
    ...addresses.map((a) => ({ ...a, isDefault: false })),
    {
      id: newAddressId(),
      fullName: addr.customerName,
      phone: addr.customerPhone,
      province: addr.province,
      ward: addr.ward,
      detail: addr.shippingAddress,
      isDefault: addresses.length === 0,
    },
  ]);
  await shopDb
    .collection(SHOP_ACCOUNTS)
    .updateOne({ _id: user._id }, { $set: { addresses, updatedAt: new Date() } });
}
