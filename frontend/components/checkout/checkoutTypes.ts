import { EMPTY_CHECKOUT_ADDRESS } from "@/lib/ghnLocations";
import type { AddressDraft } from "@/components/GhnAddressFields";

export type Delivery = "giao_tan_noi" | "nhan_cua_hang";
export type PayMethod = "Cash" | "Transfer";

export const EMPTY_DRAFT: AddressDraft = {
  fullName: "",
  phone: "",
  detail: "",
  ...EMPTY_CHECKOUT_ADDRESS,
};
