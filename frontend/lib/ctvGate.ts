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

export function isActiveCtv(user: ShopUser | null | undefined): boolean {
  return Boolean(user?.roles?.includes("ctv") && user.ctvStatus === "active");
}

export const CTV_PENDING_PATH = "/cho-duyet-ctv";
export const CTV_DASHBOARD_PATH = "/cong-tac-vien";

/** Path «mặc định» — CTV active sẽ vào dashboard thay vì về trang này. */
function isDefaultPostLoginPath(pathOnly: string): boolean {
  return pathOnly === "/" || pathOnly === "" || pathOnly === "/tai-khoan";
}

/**
 * Sau đăng nhập: CTV chờ duyệt → /cho-duyet-ctv;
 * CTV active + next mặc định (/ hoặc /tai-khoan) → dashboard;
 * còn lại giữ `next` (checkout, giỏ, SP…).
 */
export function resolvePostLoginPath(
  user: ShopUser,
  nextRaw?: string | null
): string {
  if (isCtvPendingBlocked(user)) return CTV_PENDING_PATH;
  const next = String(nextRaw || "/").trim();
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const pathOnly = safe.split("?")[0] || "/";
  if (isActiveCtv(user) && isDefaultPostLoginPath(pathOnly)) {
    return CTV_DASHBOARD_PATH;
  }
  return safe;
}
