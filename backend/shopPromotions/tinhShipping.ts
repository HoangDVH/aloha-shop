import { isActiveWholesale } from "../shopWholesale/policy.js";
export function isWholesaleTinh(account: any): boolean {
  return isActiveWholesale(account) && account.siRegion === "TINH";
}
export function isWholesaleHcm(account: any): boolean {
  return isActiveWholesale(account) && account.siRegion === "HCM";
}
export function allowsWholesaleShipping(promo: { benefitType?: string; allowWholesaleTinh?: boolean; allowWholesaleHcm?: boolean } | null | undefined, account: any): boolean {
  return promo?.benefitType === "shipping" && ((promo.allowWholesaleTinh === true && isWholesaleTinh(account)) ||
    (promo.allowWholesaleHcm === true && isWholesaleHcm(account)));
}
export const allowsTinhShipping = allowsWholesaleShipping;
