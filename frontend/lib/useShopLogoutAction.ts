"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useShopLogoutMutation } from "@/lib/authQueries";

const LOGGING_OUT_KEY = "aloha_shop_logging_out";

/** Đánh dấu đang đăng xuất — trang gated không redirect sang /dang-nhap. */
export function markShopLoggingOut() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LOGGING_OUT_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isShopLoggingOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(LOGGING_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearShopLoggingOut() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(LOGGING_OUT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Đăng xuất tức thì (optimistic) + về trang chủ không bật overlay chuyển trang.
 * Dùng next/router thuần — useShopRouter luôn notifyShopNavStart, và push("/")
 * khi đã ở "/" khiến overlay kẹt tới SAFE_MS (12s).
 */
export function useShopLogoutAction() {
  const logoutMut = useShopLogoutMutation();
  const router = useRouter();

  const logout = useCallback(() => {
    markShopLoggingOut();
    void logoutMut.mutateAsync().finally(() => {
      // Giữ flag thêm một nhịp để effect gated không race
      window.setTimeout(() => clearShopLoggingOut(), 800);
    });

    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    if (path !== "/") {
      router.replace("/");
    }
  }, [logoutMut, router]);

  return { logout, isPending: logoutMut.isPending };
}
