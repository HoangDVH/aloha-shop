"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { formatVnd, type ShopProduct } from "@/lib/api";
import { prefetchShopPath } from "@/lib/prefetchShop";
import { notifyShopNavStart } from "@/lib/shopLoading";

function productHref(product: ShopProduct): string {
  const path = String(product.path || "").trim();
  if (path.startsWith("/") && !path.startsWith("//") && path.length > 1) return path;
  const ma = String(product.ma || "").trim();
  if (ma) return `/sp/${encodeURIComponent(ma)}`;
  return "/tim";
}

/**
 * Mở SP trên mousedown — với Telex, click đầu thường chỉ chốt dấu.
 */
export function SearchResultLink({
  product,
  active,
  router,
  onNavigate,
}: {
  product: ShopProduct;
  active: boolean;
  router: AppRouterInstance;
  onNavigate?: () => void;
}) {
  const href = productHref(product);

  const go = () => {
    onNavigate?.();
    notifyShopNavStart();
    window.location.href = href;
  };

  return (
    <a
      href={href}
      role="option"
      aria-selected={active}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        go();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseEnter={() => prefetchShopPath(router, href)}
      className={`relative flex w-full items-center gap-3 px-3 py-2.5 text-left no-underline transition ${
        active ? "bg-[var(--aloha-green-light)]" : "hover:bg-[var(--aloha-cream)]"
      }`}
    >
      <span className="pointer-events-none h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--aloha-line)] bg-[var(--aloha-cream)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.anh || "/brand/logo-icon.png"}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </span>
      <span className="pointer-events-none min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-semibold text-[var(--aloha-ink)]">{product.ten}</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          Mã: <span className="font-mono text-[var(--aloha-green)]">{product.ma}</span>
        </span>
      </span>
      <span className="pointer-events-none shrink-0 text-sm font-bold text-[var(--aloha-gold)]">
        {formatVnd(product.gia)}
      </span>
    </a>
  );
}
