import type { AppearancePopup, PopupAudience, PopupPages } from "./appearanceTypes";

/** Không bao giờ chen popup vào luồng mua / tài khoản. */
const SKIP_PREFIXES = [
  "/gio-hang",
  "/xac-nhan-don-hang",
  "/don-hang",
  "/dang-nhap",
  "/dang-ky",
  "/tai-khoan",
  "/tuyen-ctv",
  "/quen-mat-khau",
  "/cho-duyet-ctv",
];

const DEAL_PREFIXES = ["/uu-dai"];

const startsWithAny = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function popupPathAllowed(pathname: string, pages: PopupPages = "home"): boolean {
  if (startsWithAny(pathname, SKIP_PREFIXES)) return false;
  if (pages === "all" || pathname === "/") return true;
  return pages === "home_deals" && startsWithAny(pathname, DEAL_PREFIXES);
}

export function popupInSchedule(
  p: Pick<AppearancePopup, "startAt" | "endAt">,
  nowMs: number
): boolean {
  const start = Date.parse(p.startAt || "");
  const end = Date.parse(p.endAt || "");
  if (Number.isFinite(start) && nowMs < start) return false;
  if (Number.isFinite(end) && nowMs >= end) return false;
  return true;
}

export type PopupViewer = { loggedIn: boolean; newBuyer: boolean } | null;

/** Khách chưa đăng nhập tính là khách mới. */
export function popupAudienceAllowed(audience: PopupAudience = "all", viewer: PopupViewer): boolean {
  if (audience === "all") return true;
  if (audience === "new") return viewer?.newBuyer !== false;
  return Boolean(viewer?.loggedIn && viewer.newBuyer === false);
}

export type PopupCapRecord = { at: string; imageUrl?: string };

/** Đã đóng/bấm gần đây → chưa hiện lại. Đổi ảnh thì hiện lại ngay. */
export function popupCapped(
  rec: PopupCapRecord | null,
  imageUrl: string,
  frequencyDays: number,
  showOnce: boolean,
  nowMs: number
): boolean {
  if (!rec) return false;
  if (imageUrl && rec.imageUrl && rec.imageUrl !== imageUrl) return false;
  if (showOnce) return true;
  const at = Date.parse(rec.at);
  if (!Number.isFinite(at)) return true;
  return nowMs - at < Math.max(1, frequencyDays) * 24 * 60 * 60 * 1000;
}
