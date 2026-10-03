"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { useZaloAskProduct, zaloAskText } from "@/lib/zaloAsk";
import { ZaloAskSheet } from "./ZaloAskSheet";

/** Trang thanh toán: không hiện nút để khách tập trung chốt đơn. */
const HIDDEN_PREFIXES = ["/xac-nhan-don-hang"];

/**
 * Nút chat Zalo nổi góc dưới phải (kiểu sàn TMĐT). Trên trang SP: chép sẵn câu hỏi kèm link SP
 * rồi mở bảng hướng dẫn dán vào Zalo (Zalo không cho web điền sẵn tin nhắn).
 */
export function ZaloFloatButton({ href }: { href: string }) {
  const pathname = usePathname() || "/";
  const product = useZaloAskProduct((s) => s.product);
  const [ask, setAsk] = useState<{ text: string; copied: boolean } | null>(null);

  const copy = useCallback((text: string) => {
    const done = () => setAsk((a) => (a ? { ...a, copied: true } : a));
    const legacy = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try {
        if (document.execCommand("copy")) done();
      } catch {
        /* trình duyệt chặn: khách bấm "Sao chép" hoặc chọn tay ô tin nhắn */
      }
      ta.remove();
    };
    if (!navigator.clipboard?.writeText) return legacy();
    navigator.clipboard.writeText(text).then(done, legacy);
  }, []);
  const close = useCallback(() => setAsk(null), []);

  if (!href || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const onClick = (e: React.MouseEvent) => {
    if (!product) return;
    e.preventDefault();
    const text = zaloAskText(product, `${window.location.origin}${window.location.pathname}`);
    setAsk({ text, copied: false });
    copy(text);
  };

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        aria-label={product ? "Hỏi Aloha về sản phẩm này qua Zalo" : "Chat Zalo với Aloha để được tư vấn"}
        className="aloha-zalo-float group fixed right-3 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#0068FF] text-white shadow-[0_6px_18px_rgba(0,104,255,0.45)] ring-2 ring-white transition-transform active:scale-95 lg:right-6 lg:h-14 lg:w-14 lg:hover:scale-105"
        style={{ bottom: "var(--shop-float-bottom)" }}
      >
        <span className="aloha-zalo-ring pointer-events-none absolute inset-0 rounded-full" aria-hidden />
        <span className="relative text-[13px] font-black tracking-tight lg:text-[15px]" aria-hidden>
          Zalo
        </span>
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#0068FF] opacity-0 shadow-md ring-1 ring-black/[0.06] transition-opacity group-hover:opacity-100 lg:block">
          {product ? "Hỏi về sản phẩm này" : "Chat Zalo tư vấn"}
        </span>
      </a>
      {ask && product ? (
        <ZaloAskSheet product={product} text={ask.text} copied={ask.copied} href={href} onCopy={() => copy(ask.text)} onClose={close} />
      ) : null}
    </>
  );
}
