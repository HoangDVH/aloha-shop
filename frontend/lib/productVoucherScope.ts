import type { ShopProduct } from "./api";
import { voucherItemInScope, voucherFlashActive, type VoucherScope } from "../../shared/voucherScope";

export function productMatchesVoucher(product: ShopProduct, voucher: VoucherScope, now = Date.now()) {
  const flash = voucherFlashActive(product.campaignPromo, now);
  return voucherItemInScope({ ma: product.ma, categoryId: product.categoryId, flash },
    { ...voucher, scope: voucher.scope || "all" });
}
