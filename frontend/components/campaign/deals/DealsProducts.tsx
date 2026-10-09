"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShopProduct } from "@/lib/api";
import { fetchLivePrices, type LivePriceRow } from "@/lib/livePrices";
import { ScopedProductCatalog } from "@/components/catalog/ScopedProductCatalog";

export function liveRowToProduct(r: LivePriceRow): ShopProduct {
  return {
    ma: r.ma,
    ten: r.ten || r.ma,
    dvt: r.dvt || "",
    nhom: "",
    nhomPath: "",
    gia: r.gia,
    webPrice: r.webPrice,
    priceKind: r.priceKind,
    allowBackorder: r.allowBackorder,
    ton: Number(r.ton) || 0,
    trongLuong: r.trongLuong,
    anh: r.anh || "",
    images: r.images?.length ? r.images : r.anh ? [r.anh] : [],
    videos: r.videos?.length ? r.videos : undefined,
    videoUrl: r.videoUrl || undefined,
    isActive: r.isActive !== false,
    path: r.path || "",
    categoryId: r.categoryId,
    categorySlug: "",
    productSlug: "",
    campaignPromo: r.campaignPromo ?? null,
  };
}

/** Nạp trọn bộ mã chiến dịch để lọc chính xác, phân trang sau khi lọc. */
export function DealsProducts({
  mas,
  emptyText,
  variant = "deal",
  columns = 4,
}: {
  mas: string[];
  emptyText?: string;
  variant?: "default" | "deal";
  columns?: 4 | 5 | 6;
  /** @deprecated dùng columns */
  homeRow6?: boolean;
}) {
  const [rows, setRows] = useState<Record<string, LivePriceRow>>({});
  const [loading, setLoading] = useState(true);
  const key = mas.join(",");

  useEffect(() => {
    const want = [...new Set(mas)];
    if (!want.length) return;
    let alive = true;
    setRows({});
    setLoading(true);
    fetchLivePrices(want)
      .then((list) => {
        if (!alive) return;
        setRows((prev) => {
          const next = { ...prev };
          for (const r of list) next[String(r.ma).toUpperCase()] = r;
          return next;
        });
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const products = useMemo(
    () =>
      [...new Set(mas)]
        .map((m) => rows[m.toUpperCase()])
        .filter((r): r is LivePriceRow => Boolean(r && r.isActive !== false))
        .map(liveRowToProduct),
    [mas, rows],
  );

  if (!mas.length) {
    return emptyText ? <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p> : null;
  }
  if (!products.length && loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-white/70" aria-busy="true" />;
  }
  return <ScopedProductCatalog key={key} products={products} columns={columns} variant={variant} />;
}
