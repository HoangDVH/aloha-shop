"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShopProduct } from "@/lib/api";
import { fetchLivePrices, type LivePriceRow } from "@/lib/livePrices";
import { ProductGrid } from "@/components/ProductCard";

const PAGE = 20;

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
    categorySlug: "",
    productSlug: "",
    campaignPromo: r.campaignPromo ?? null,
  };
}

/** Lưới SP chiến dịch, tải dần mỗi lần 20 mã (danh sách có thể vài trăm SP). */
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
  const [shown, setShown] = useState(PAGE);
  const [rows, setRows] = useState<Record<string, LivePriceRow>>({});
  const [loading, setLoading] = useState(false);
  const key = mas.join(",");

  useEffect(() => setShown(PAGE), [key]);

  useEffect(() => {
    const want = mas.slice(0, shown).filter((m) => !rows[m.toUpperCase()]);
    if (!want.length) return;
    let alive = true;
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
  }, [key, shown]);

  const products = useMemo(
    () =>
      mas
        .slice(0, shown)
        .map((m) => rows[m.toUpperCase()])
        .filter((r): r is LivePriceRow => Boolean(r && r.isActive !== false))
        .map(liveRowToProduct),
    [mas, shown, rows],
  );

  if (!mas.length) {
    return emptyText ? <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p> : null;
  }
  if (!products.length && loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-white/70" aria-busy="true" />;
  }
  return (
    <div>
      <ProductGrid products={products} shopee columns={columns} variant={variant} />
      {shown < mas.length ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            disabled={loading}
            className="min-h-[44px] rounded-full bg-white px-6 text-sm font-bold text-[#C8102E] ring-1 ring-[#C8102E]/30 disabled:opacity-60"
          >
            {loading ? "Đang tải…" : "Xem thêm"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
