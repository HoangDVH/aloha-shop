import type { ShopUser } from "@/lib/auth";

/**
 * CTV thuần (không phải khách mua) đang chờ duyệt → khóa cửa hàng
 * đến khi admin duyệt (giống cổng đăng ký CTV công ty).
 */
export function isCtvPendingBlocked(user: ShopUser | null | undefined): boolean {
  if (!user?.roles?.includes("ctv")) return false;
  if (user.ctvStatus !== "cho_duyet") return false;
  return !user.roles.includes("customer");
}

export function isCtvPendingAny(user: ShopUser | null | undefined): boolean {
  return Boolean(user?.roles?.includes("ctv") && user.ctvStatus === "cho_duyet");
}

export const CTV_PENDING_PATH = "/cho-duyet-ctv";
