import type { CtvAdminSub } from "../ctvUiStore";

export const TITLE: Record<CtvAdminSub, string> = {
  overview: "Tổng quan",
  list: "Danh sách CTV",
  customers: "Quản lý khách hàng",
  commissions: "Hoa hồng",
  commissionConfig: "Cấu hình hoa hồng",
  orders: "Đơn hàng CTV",
  fraud: "Chống gian lận",
};

export const SUBTITLE: Record<CtvAdminSub, string> = {
  overview: "Hiệu suất chương trình cộng tác viên theo kỳ",
  list: "Duyệt, khóa và quản lý tài khoản CTV",
  customers: "Tài khoản khách mua trên web bán",
  commissions: "Đối soát dòng hoa hồng và kỳ thanh toán",
  commissionConfig: "Đặt % hoa hồng theo SP và CTV đặc biệt",
  orders: "Đơn hàng gắn mã giới thiệu CTV",
  fraud: "Cảnh báo và xử lý hành vi bất thường",
};

export function subFromPath(pathname: string): CtvAdminSub {
  if (pathname.startsWith("/admin/ctv/danh-sach")) return "list";
  if (pathname.startsWith("/admin/ctv/khach-hang")) return "customers";
  if (pathname.startsWith("/admin/ctv/cau-hinh-hoa-hong")) return "commissionConfig";
  if (pathname.startsWith("/admin/ctv/hoa-hong")) return "commissions";
  if (pathname.startsWith("/admin/ctv/don-hang")) return "orders";
  if (pathname.startsWith("/admin/ctv/chong-gian")) return "fraud";
  return "overview";
}

export function detailCodeFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/admin\/ctv\/danh-sach\/([^/?#]+)/i);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]).trim().toUpperCase() || null;
  } catch {
    return m[1].trim().toUpperCase() || null;
  }
}
