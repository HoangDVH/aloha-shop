"use client";

import { Loader2 } from "lucide-react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { formatVnd, type ShopProduct } from "@/lib/api";
import { prefetchShopPath } from "@/lib/prefetchShop";
import { notifyShopNavStart } from "@/lib/shopLoading";

/** Dropdown search: luôn dùng /sp/MÃ — ngắn, chắc mở được, tránh soft-nav /c/... bị hủy. */
function productHref(product: ShopProduct): string {
  const ma = String(product.ma || "").trim();
  if (ma) return `/sp/${encodeURIComponent(ma)}`;
  const path = String(product.path || "").trim();
  if (path.startsWith("/") && !path.startsWith("//") && path.length > 1) return path;
  return "/tim";
}

export function SearchResultLink({
  product,
  active,
  router,
  onPick,
  onHover,
}: {
  product: ShopProduct;
  active: boolean;
  router: AppRouterInstance;
  onPick: () => void;
  onHover: () => void;
}) {
  const href = productHref(product);

  const go = () => {
    onPick();
    notifyShopNavStart();
    // Hard navigation — App Router soft-nav hay bị hủy khi portal dropdown unmount.
    window.location.assign(href);
  };

  return (
    <a
      href={href}
      role="option"
      aria-selected={active}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        // Chặn blur ô tìm + đảm bảo đi ngay từ lần bấm đầu (không chờ click).
        e.preventDefault();
        e.stopPropagation();
        go();
      }}
      onClick={(e) => {
        // Đã xử lý ở mousedown
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseEnter={() => {
        onHover();
        prefetchShopPath(router, href);
      }}
      onFocus={() => prefetchShopPath(router, href)}
      className={`relative flex items-center gap-3 px-3 py-2.5 transition ${
        active ? "bg-[var(--aloha-green-light)]" : "hover:bg-[var(--aloha-cream)]"
      }`}
    >
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--aloha-line)] bg-[var(--aloha-cream)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.anh || "/brand/logo-icon.png"}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-semibold text-[var(--aloha-ink)]">{product.ten}</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          Mã: <span className="font-mono text-[var(--aloha-green)]">{product.ma}</span>
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-[var(--aloha-gold)]">{formatVnd(product.gia)}</span>
    </a>
  );
}
