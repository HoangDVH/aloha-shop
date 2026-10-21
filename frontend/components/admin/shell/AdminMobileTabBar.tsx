"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Menu, Package, ShoppingBag, Users } from "lucide-react";
import { useAdminBadgeCounts } from "@/components/admin/shell/AdminOpsSync";

export function AdminMobileTabBar({
  menuOpen,
  onOpenMenu,
}: {
  menuOpen: boolean;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const badges = useAdminBadgeCounts(true);

  const websiteTab = searchParams?.get("tab");

  const homeActive = pathname === "/admin";
  const ordersActive = pathname.startsWith("/admin/don-hang-web");
  const productsActive =
    pathname === "/admin/website" && websiteTab === "hang-hoa-web";
  const ctvActive =
    (pathname === "/admin/ctv" || pathname.startsWith("/admin/ctv/")) &&
    !pathname.startsWith("/admin/ctv/khach-hang");

  // Nếu đang ở bất kỳ trang nào khác ngoài 4 tab chính, thì highlight tab "Menu"
  const isOtherSectionActive =
    !homeActive && !ordersActive && !productsActive && !ctvActive;
  const menuActive = menuOpen || isOtherSectionActive;

  const ordersBadge = badges.ordersNeedAction > 0 ? badges.ordersNeedAction : 0;
  const ctvBadge = badges.ctvPending > 0 ? badges.ctvPending : 0;

  return (
    <nav
      className="shop-mobile-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden"
      aria-label="Thanh điều hướng quản trị nhanh"
    >
      <div className="mx-auto flex h-[3.35rem] max-w-lg items-stretch justify-around px-1">
        {/* 1. Tổng quan */}
        <Link
          href="/admin"
          className={`shop-mobile-tab ${homeActive ? "is-active" : ""}`}
          aria-current={homeActive ? "page" : undefined}
        >
          <LayoutDashboard
            size={20}
            strokeWidth={homeActive ? 2.5 : 1.85}
            className={homeActive ? "fill-current/15" : ""}
            aria-hidden
          />
          <span className="text-[11px]">Tổng quan</span>
        </Link>

        {/* 2. Đơn hàng */}
        <Link
          href="/admin/don-hang-web"
          className={`shop-mobile-tab ${ordersActive ? "is-active" : ""}`}
          aria-current={ordersActive ? "page" : undefined}
          aria-label={`Đơn hàng${ordersBadge ? `, ${ordersBadge} cần xử lý` : ""}`}
        >
          <span className="relative inline-flex">
            <ShoppingBag
              size={20}
              strokeWidth={ordersActive ? 2.5 : 1.85}
              className={ordersActive ? "fill-current/15" : ""}
              aria-hidden
            />
            {ordersBadge > 0 ? (
              <span className="absolute -right-2.5 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#C62828] px-1 text-[8.5px] font-black text-white ring-1 ring-white">
                {ordersBadge > 99 ? "99+" : ordersBadge}
              </span>
            ) : null}
          </span>
          <span className="text-[11px]">Đơn hàng</span>
        </Link>

        {/* 3. Hàng hóa (Kho cây / chậu) */}
        <Link
          href="/admin/website?tab=hang-hoa-web"
          className={`shop-mobile-tab ${productsActive ? "is-active" : ""}`}
          aria-current={productsActive ? "page" : undefined}
        >
          <Package
            size={20}
            strokeWidth={productsActive ? 2.5 : 1.85}
            className={productsActive ? "fill-current/15" : ""}
            aria-hidden
          />
          <span className="text-[11px]">Hàng hóa</span>
        </Link>

        {/* 4. Sỉ & CTV */}
        <Link
          href="/admin/ctv"
          className={`shop-mobile-tab ${ctvActive ? "is-active" : ""}`}
          aria-current={ctvActive ? "page" : undefined}
          aria-label={`Sỉ và CTV${ctvBadge ? `, ${ctvBadge} chờ duyệt` : ""}`}
        >
          <span className="relative inline-flex">
            <Users
              size={20}
              strokeWidth={ctvActive ? 2.5 : 1.85}
              className={ctvActive ? "fill-current/15" : ""}
              aria-hidden
            />
            {ctvBadge > 0 ? (
              <span className="absolute -right-2.5 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#C62828] px-1 text-[8.5px] font-black text-white ring-1 ring-white">
                {ctvBadge > 99 ? "99+" : ctvBadge}
              </span>
            ) : null}
          </span>
          <span className="text-[11px]">Sỉ & CTV</span>
        </Link>

        {/* 5. Menu / Thêm */}
        <button
          type="button"
          onClick={onOpenMenu}
          className={`shop-mobile-tab ${menuActive ? "is-active" : ""}`}
          aria-label="Mở tất cả menu quản trị"
        >
          <Menu
            size={20}
            strokeWidth={menuActive ? 2.5 : 1.85}
            aria-hidden
          />
          <span className="text-[11px]">Menu</span>
        </button>
      </div>
    </nav>
  );
}
