import type { ShopUser } from "./auth";
import type { AddressDraft } from "../components/GhnAddressFields";
import { EMPTY_CHECKOUT_ADDRESS } from "./ghnLocations";

export const checkoutDraftKey = (accountId: string) => `aloha_checkout_draft:${encodeURIComponent(accountId)}`;

type DraftOwner = Pick<ShopUser, "id" | "fullName" | "phone" | "roles" | "siProfile">;
export function accountCheckoutDraft(user: DraftOwner): AddressDraft {
  const profile = user.roles.includes("si") ? user.siProfile : null;
  const str = (key: string) => typeof profile?.[key] === "string" ? profile[key] as string : "";
  return { ...EMPTY_CHECKOUT_ADDRESS, fullName: str("fullName") || user.fullName || "",
    phone: str("phone") || user.phone || "", detail: str("detail"),
    province: str("province"), district: str("district"), ward: str("ward") };
}

export function restoreCheckoutDraft(storage: Pick<Storage, "getItem" | "removeItem">, user: DraftOwner): AddressDraft {
  const draft = accountCheckoutDraft(user);
  try {
    // Legacy drafts have no owner: never migrate them into a signed-in account.
    storage.removeItem("aloha_checkout_draft");
    const saved = JSON.parse(storage.getItem(checkoutDraftKey(user.id)) || "null");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return draft;
    for (const key of ["fullName", "phone", "detail", "province", "district", "ward", "ghnWardCode"] as const) {
      if (typeof saved[key] === "string") draft[key] = saved[key];
    }
    for (const key of ["ghnProvinceId", "ghnDistrictId"] as const) {
      if (Number.isSafeInteger(saved[key]) && saved[key] >= 0) draft[key] = saved[key];
    }
  } catch { /* Unavailable storage or malformed drafts fall back to this account only. */ }
  return draft;
}
