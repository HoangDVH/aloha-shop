"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { formatVnd, type ShopProduct } from "@/lib/api";
import { prefetchShopPath } from "@/lib/prefetchShop";

function RowPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="absolute inset-0 z-10 flex items-center justify-center bg-white/55">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--aloha-green)]" aria-hidden />
    </span>
  );
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
  return (
    <Link
      href={product.path}
      prefetch
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      onMouseEnter={() => {
        onHover();
        prefetchShopPath(router, product.path);
      }}
      onFocus={() => prefetchShopPath(router, product.path)}
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
      <RowPending />
    </Link>
  );
}
