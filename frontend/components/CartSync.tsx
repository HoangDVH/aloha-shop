"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (loading) return;
    void onShopUserChanged(user?.id ?? null);
  }, [loading, user?.id]);

  useEffect(() => {
    if (loading || !user?.id) return;
    if (isCartSyncPaused()) return;
    scheduleCartPushToServer(user.id);
  }, [loading, user?.id, lines]);

  return null;
}
