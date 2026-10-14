"use client";
import { useEffect, useMemo, useState } from "react";
import type { ShopProduct } from "./api";
import { getAvailablePromotions, type AvailablePromotionUI } from "./promotions";
import { pdpApplicableVouchers, pdpDefaultVouchers } from "./pdpVouchers";
import { formatVoucherBadge } from "./voucherFormat";
import { useShopAuth } from "@/components/ShopAuthProvider";

export function usePdpVoucherBadges(product: ShopProduct, viewer: { newBuyer?: boolean } | null | undefined,
  isWholesale: boolean, campaignKey: unknown) {
  const { user } = useShopAuth();
  const [items, setItems] = useState<AvailablePromotionUI[]>([]);
  useEffect(() => {
    let active = true;
    setItems([]);
    getAvailablePromotions().then(data => { if (active) setItems(data); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id, user?.siStatus, user?.siRegion, viewer?.newBuyer, campaignKey]);
  return useMemo(() => pdpDefaultVouchers(pdpApplicableVouchers(items, product, viewer, isWholesale), viewer)
    .map(formatVoucherBadge), [items, product, viewer, isWholesale]);
}
