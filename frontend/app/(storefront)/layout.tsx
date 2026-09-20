import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ShopWelcomePopupMount } from "@/components/ShopWelcomePopupMount";
import { ShopMobileTabBar } from "@/components/ShopMobileTabBar";

/** Menu danh mục tải phía client (SiteHeader) — không chặn SSR mỗi lần chuyển trang. */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<header className="h-[108px] bg-[var(--aloha-cream)]" />}>
        <SiteHeader />
      </Suspense>
      <div className="shop-storefront-with-tabbar">
        <main className="min-h-[70vh] bg-white">{children}</main>
        <SiteFooter />
      </div>
      <Suspense fallback={null}>
        <ShopMobileTabBar />
      </Suspense>
      <ShopWelcomePopupMount />
    </>
  );
}
