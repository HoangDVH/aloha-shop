"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingCart, UserRound } from "lucide-react";
import { useCart } from "@/lib/cart";

const OPEN_CATS = "aloha:open-mobile-cats";

function shouldHideTabBar(pathname: string) {
  // Giữ tab bar trên giỏ hàng; chỉ ẩn khi checkout / chi tiết đơn (có sticky riêng).
  return (
    pathname.startsWith("/xac-nhan-don-hang") ||
    pathname.startsWith("/don-hang")
  );
}

/** Sticky tab bar mobile — Trang chủ / Danh mục / Giỏ / Tài khoản. */
export function ShopMobileTabBar() {
  const pathname = usePathname() || "/";
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const hide = shouldHideTabBar(pathname);
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
          <Home size={22} strokeWidth={homeActive ? 2.4 : 1.9} aria-hidden />
          <span>Trang chủ</span>
        </Link>

        <button
          type="button"
          className="shop-mobile-tab"
          onClick={() => {
            window.dispatchEvent(new CustomEvent(OPEN_CATS));
          }}
        >
          <LayoutGrid size={22} strokeWidth={1.9} aria-hidden />
          <span>Danh mục</span>
        </button>

        <Link
          href="/gio-hang"
          className={`shop-mobile-tab ${cartActive ? "is-active" : ""}`}
          aria-current={cartActive ? "page" : undefined}
          aria-label={`Giỏ hàng${cartBadge ? `, ${cartBadge} sản phẩm` : ""}`}
        >
          <span className="relative inline-flex">
            <ShoppingCart size={22} strokeWidth={cartActive ? 2.4 : 1.9} aria-hidden />
            {cartBadge > 0 ? (
              <span className="absolute -right-3 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--aloha-terracotta)] px-1 text-[10px] font-black text-white ring-2 ring-white">
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
          <UserRound size={22} strokeWidth={accountActive ? 2.4 : 1.9} aria-hidden />
          <span>Tài khoản</span>
        </Link>
      </div>
    </nav>
  );
}

export const SHOP_OPEN_MOBILE_CATS = OPEN_CATS;
