import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ShopWelcomePopupMount } from "@/components/ShopWelcomePopupMount";

/** Menu danh mục tải phía client (SiteHeader) — không chặn SSR mỗi lần chuyển trang. */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<header className="h-[108px] bg-[var(--aloha-green)]" />}>
        <SiteHeader />
      </Suspense>
      <main className="min-h-[70vh]">{children}</main>
      <SiteFooter />
      <ShopWelcomePopupMount />
    </>
  );
}
