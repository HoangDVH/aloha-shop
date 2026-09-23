"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { advancePriceSession } from "@/lib/priceSession";
import { refreshCartPricesFromCatalog } from "@/lib/cartPriceRefresh";
import { useSiDraft } from "@/components/si-register/siRegisterDraftStore";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useCart } from "@/lib/cart";
import {
  isCartSyncPaused,
  onShopUserChanged,
  scheduleCartPushToServer,
} from "@/lib/cartSync";

/**
 * Đồng bộ giỏ hàng (chuẩn thương mại điện tử):
 * - Khách: localStorage — mỗi máy/trình duyệt riêng.
 * - Đã đăng nhập: Mongo theo userId; đăng nhập chỉ gộp giỏ khách (chưa login).
 * - Đăng xuất / đổi tài khoản: không mang giỏ tài khoản cũ sang người khác.
 */
export function CartSync() {
  const { user, loading } = useShopAuth();
  const lines = useCart((s) => s.lines);
  const router = useRouter();
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    const key = `${user?.id || "guest"}:${user?.siStatus || "web"}:${user?.siRegion || ""}`;
    if (previous.current === key) return;
    const changed = previous.current !== null;
    previous.current = key;
    advancePriceSession();
    if (!user) useSiDraft.getState().clear();
    void onShopUserChanged(user?.id ?? null).then(() => refreshCartPricesFromCatalog()).catch(() => {});
    if (changed) { router.refresh(); window.dispatchEvent(new Event("aloha-price-session")); }
  }, [loading, user?.id, user?.siStatus, user?.siRegion, router]);


  useEffect(() => {
    if (loading || !user?.id) return;
    if (isCartSyncPaused()) return;
    scheduleCartPushToServer(user.id);
  }, [loading, user?.id, lines]);

  return null;
}
