"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useShopRouter } from "@/lib/useShopRouter";
import { CTV_PENDING_PATH, isCtvPendingBlocked } from "@/lib/ctvGate";
import { onShopAccountChanged, startShopAuthStream } from "@/lib/authStream";

const AUTH_FREE = new Set([
  "/dang-nhap",
  "/dang-ky",
  CTV_PENDING_PATH,
]);

/**
 * - CTV thuần chờ duyệt → ép vào /cho-duyet-ctv
 * - Đã duyệt → nếu đang ở trang chờ → về trang chủ
 * - SSE: admin duyệt → refresh me → chuyển trang ngay
 */
export function CtvPendingGate() {
  const { user, loading, refresh, logout } = useShopAuth();
  const pathname = usePathname() || "/";
  const router = useShopRouter();

  useEffect(() => {
    if (!user) return;
    return startShopAuthStream();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    return onShopAccountChanged(() => {
      void refresh();
    });
  }, [user?.id, refresh]);

  useEffect(() => {
    if (loading) return;
    if (pathname.startsWith("/admin")) return;
    const onPendingPage = pathname === CTV_PENDING_PATH || pathname.startsWith(`${CTV_PENDING_PATH}/`);
    const blocked = isCtvPendingBlocked(user);

    if (blocked && !onPendingPage && !AUTH_FREE.has(pathname)) {
      router.replace(CTV_PENDING_PATH);
      return;
    }

    if (user && !blocked && onPendingPage) {
      // Đã duyệt (hoặc không còn bị khóa) → vào shop
      if (user.ctvStatus === "active" || user.roles.includes("customer")) {
        router.replace("/");
      }
    }
  }, [loading, user, pathname, router]);

  // Giữ logout khả dụng trên trang chờ qua event (nút trang gọi logout trực tiếp)
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__alohaShopLogout = () => void logout();
    return () => {
      try {
        delete (window as any).__alohaShopLogout;
      } catch {
        /* */
      }
    };
  }, [logout]);

  return null;
}
