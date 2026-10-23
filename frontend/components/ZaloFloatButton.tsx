"use client";

import { usePathname } from "next/navigation";
import { useZaloAskProduct } from "@/lib/zaloAsk";
import { AlohaChatWidget } from "@/components/chatbot/AlohaChatWidget";
import { useEffect, useState } from "react";

/** Trang thanh toán: không hiện nút để khách tập trung chốt đơn. */
const HIDDEN_PREFIXES = ["/xac-nhan-don-hang"];
/** Vùng nút nổi tính từ đáy màn hình (bottom 1.5rem + nút 3.5rem + viền). */
const FLOAT_ZONE_PX = 96;

/** Trang chủ: ẩn nút khi banner chính còn nằm dưới vùng nút, tránh che SĐT/chữ in trên banner. */
function useOverHomeHero(pathname: string) {
  const isHome = pathname === "/";
  const [over, setOver] = useState(isHome);
  useEffect(() => {
    if (!isHome) {
      setOver(false);
      return;
    }
    const check = () => {
      const hero = document.querySelector(".hero-banner--home");
      setOver(!!hero && hero.getBoundingClientRect().bottom > window.innerHeight - FLOAT_ZONE_PX);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(document.body);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [isHome]);
  return over;
}

/**
 * Nút chat nổi góc dưới phải chuẩn công ty lớn: tích hợp Trợ lý AI ALOHA 24/7 và kết nối Zalo trực tiếp.
 */
export function ZaloFloatButton({ href }: { href: string }) {
  const pathname = usePathname() || "/";
  const product = useZaloAskProduct((s) => s.product);
  const overHero = useOverHomeHero(pathname);

  if (!href || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <AlohaChatWidget
      zaloHref={href}
      product={product}
      overHero={overHero}
    />
  );
}
