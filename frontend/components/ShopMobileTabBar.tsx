"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingCart, TicketPercent, UserRound, Zap } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useDealsNavAccent } from "@/lib/campaign/navAccent";

const OPEN_CATS = "aloha:open-mobile-cats";

function shouldHideTabBar(pathname: string) {
  // Chuẩn TMĐT lớn (Shopee/Tiki/Lazada & AI chat Gemini): ẩn tab bar điều hướng chung khi xem PDP, Giỏ hàng, Checkout, Đơn hàng
  // và Bác sĩ cây cảnh (vì giao diện AI chat có thanh nhập liệu Sticky/Docked riêng bám sát đáy màn hình).
  return (
    pathname.startsWith("/sp") ||
    (pathname.startsWith("/c/") && pathname.includes("/p/")) ||
    pathname.startsWith("/gio-hang") ||
    pathname.startsWith("/xac-nhan-don-hang") ||
    pathname.startsWith("/don-hang") ||
    pathname.startsWith("/bac-si-cay")
  );
}

/** Sticky tab bar mobile — Trang chủ / Danh mục / Ưu đãi / Giỏ / Tài khoản. */
export function ShopMobileTabBar() {
  const pathname = usePathname() || "/";
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const hide = shouldHideTabBar(pathname);
  const deals = useDealsNavAccent();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (hide) {
      root.style.setProperty("--shop-mobile-tab-h", "0px");
      return () => {
        root.style.removeProperty("--shop-mobile-tab-h");
      };
    }
    root.style.removeProperty("--shop-mobile-tab-h");
    return undefined;
  }, [hide]);

  if (hide) return null;

  // Luôn /tai-khoan — trang tự redirect login (tránh hydration SSR≠client auth)
  const accountHref = "/tai-khoan";
  const homeActive = pathname === "/";
  const cartActive = pathname.startsWith("/gio-hang");
  const accountActive =
    pathname.startsWith("/tai-khoan") ||
    pathname.startsWith("/dang-nhap") ||
    pathname.startsWith("/dang-ky");
  const cartBadge = mounted && count > 0 ? count : 0;
  const dealsActive = pathname.startsWith("/uu-dai");
  const dealsOn = mounted && deals.on;

  return (
    <nav
      className="shop-mobile-tabbar fixed inset-x-0 bottom-0 z-50 border-t border-[var(--aloha-line)] bg-white lg:hidden"
      aria-label="Điều hướng nhanh"
    >
      <div className="mx-auto flex h-[3.35rem] max-w-lg items-stretch justify-around px-1">
        <Link
          href="/"
          className={`shop-mobile-tab ${homeActive ? "is-active" : ""}`}
          aria-current={homeActive ? "page" : undefined}
        >
          <Home size={22} strokeWidth={homeActive ? 2.5 : 1.85} className={homeActive ? "fill-current/15" : ""} aria-hidden />
          <span>Trang chủ</span>
        </Link>

        <button
          type="button"
          className="shop-mobile-tab"
          onClick={() => {
            window.dispatchEvent(new CustomEvent(OPEN_CATS));
          }}
        >
          <LayoutGrid size={22} strokeWidth={1.85} aria-hidden />
          <span>Danh mục</span>
        </button>

        <Link
          href="/uu-dai"
          className={`shop-mobile-tab ${dealsActive ? "is-active" : ""}`}
          style={dealsOn ? { color: "var(--aloha-green, #2e7d32)" } : undefined}
          aria-current={dealsActive ? "page" : undefined}
          aria-label={dealsOn ? "Voucher, đang có chương trình" : "Voucher"}
        >
          <TicketPercent
            size={22}
            strokeWidth={dealsActive ? 2.5 : 2}
            className={dealsActive ? "fill-current/15" : ""}
            aria-hidden
          />
          <span className={dealsOn ? "font-bold" : undefined}>Voucher</span>
        </Link>

        <Link
          href="/gio-hang"
          data-cart-target=""
          className={`shop-mobile-tab ${cartActive ? "is-active" : ""}`}
          aria-current={cartActive ? "page" : undefined}
          aria-label={`Giỏ hàng${cartBadge ? `, ${cartBadge} sản phẩm` : ""}`}
        >
          <span className="relative inline-flex">
            <ShoppingCart size={22} strokeWidth={cartActive ? 2.5 : 1.85} className={cartActive ? "fill-current/15" : ""} aria-hidden />
            {cartBadge > 0 ? (
              <span className="absolute -right-3 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--aloha-terracotta)] px-1 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
                {cartBadge > 99 ? "99+" : cartBadge}
              </span>
            ) : null}
          </span>
          <span>Giỏ hàng</span>
        </Link>

        <Link
          href={accountHref}
          className={`shop-mobile-tab ${accountActive ? "is-active" : ""}`}
          aria-current={accountActive ? "page" : undefined}
        >
          <UserRound size={22} strokeWidth={accountActive ? 2.5 : 1.85} className={accountActive ? "fill-current/15" : ""} aria-hidden />
          <span>Tài khoản</span>
        </Link>
      </div>
    </nav>
  );
}

export const SHOP_OPEN_MOBILE_CATS = OPEN_CATS;
