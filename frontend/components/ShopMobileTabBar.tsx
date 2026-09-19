"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingCart, UserRound } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useShopLoginHref } from "@/lib/useShopLoginHref";

const OPEN_CATS = "aloha:open-mobile-cats";

/** Sticky tab bar mobile — Trang chủ / Danh mục / Giỏ / Tài khoản. */
export function ShopMobileTabBar() {
  const pathname = usePathname() || "/";
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const { user } = useShopAuth();
  const loginHref = useShopLoginHref();

  const accountHref = user ? "/tai-khoan" : loginHref;
  const homeActive = pathname === "/";
  const cartActive = pathname.startsWith("/gio-hang");
  const accountActive =
    pathname.startsWith("/tai-khoan") ||
    pathname.startsWith("/dang-nhap") ||
    pathname.startsWith("/dang-ky");

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
          aria-label={`Giỏ hàng${count ? `, ${count} sản phẩm` : ""}`}
        >
          <span className="relative inline-flex">
            <ShoppingCart size={22} strokeWidth={cartActive ? 2.4 : 1.9} aria-hidden />
            {count > 0 ? (
              <span className="absolute -right-2 -top-1.5 h-2 w-2 rounded-full bg-[var(--aloha-green)] ring-2 ring-white" />
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
