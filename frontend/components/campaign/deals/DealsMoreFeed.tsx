"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Heart } from "lucide-react";
import type { CampaignUI } from "@/lib/campaign/campaignApi";
import { fetchProducts, type ShopProduct } from "@/lib/api";
import { ProductGrid } from "@/components/ProductCard";

const PAGE = 12;

/** Show twelve suggestions at a time; further pages require an explicit click. */
export function DealsMoreFeed({ campaign }: { campaign: CampaignUI }) {
  const excludeKey = campaign.products.map(p => p.ma.toUpperCase()).sort().join("|");
  const exclude = useMemo(() => new Set(excludeKey.split("|").filter(Boolean)), [excludeKey]);
  const [items, setItems] = useState<ShopProduct[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);
  const done = page > 0 && page >= pages;

  const loadPage = useCallback((next: number, reset = false) => {
    if (busy.current && !reset) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    busy.current = true;
    setLoading(true);
    setError(false);
    if (reset) { setItems([]); setPage(0); setPages(1); }
    fetchProducts({ home: true, inStock: true, page: next, limit: PAGE, signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.ma.toUpperCase()));
          const add = res.items.filter((p) => {
            const k = p.ma.toUpperCase();
            if (exclude.has(k) || seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          return [...prev, ...add];
        });
        setPages(res.pages || next);
        setPage(next);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => {
        if (request.current !== controller || controller.signal.aborted) return;
        busy.current = false;
        setLoading(false);
      });
  }, [exclude]);

  useEffect(() => {
    loadPage(1, true);
    return () => request.current?.abort();
  }, [loadPage]);

  if (page > 0 && !items.length && done) return null;

  return (
    <section id="goi-y" className="scroll-mt-24 space-y-5 pt-4">
      {/* HEADER PHÂN CÁCH TRUNG TÂM KIỂU SHOPEE / LAZADA FEED */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="h-px flex-1 max-w-[80px] sm:max-w-[140px] bg-gradient-to-r from-transparent to-rose-300/80" />
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-[var(--campaign-primary,#C8102E)] shadow-2xs">
              <Heart size={15} className="fill-[var(--campaign-primary,#C8102E)] text-[var(--campaign-primary,#C8102E)]" />
            </span>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-800">
              Có thể bạn cũng thích
            </h2>
          </div>
          <div className="h-px flex-1 max-w-[80px] sm:max-w-[140px] bg-gradient-to-l from-transparent to-rose-300/80" />
        </div>
        <p className="mt-1 text-xs text-slate-500 font-medium">Thêm lựa chọn cây xinh đang sẵn hàng tại Aloha</p>
      </div>

      {items.length ? <ProductGrid products={items} shopee columns={4} /> : null}
      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-2.5 md:grid-cols-3 md:gap-3 lg:grid-cols-4 lg:gap-3.5" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-white/80" />
          ))}
        </div>
      ) : null}
      {error ? <p role="status" className="text-center text-sm text-rose-700">Chưa tải được sản phẩm. Bạn có thể bấm thử lại.</p> : null}
      {!done ? (
        <div className="flex justify-center">
          <button type="button" disabled={loading} onClick={() => loadPage(page + 1)}
            className="min-h-11 rounded-full bg-white px-6 text-sm font-bold text-[var(--campaign-primary,#C2185B)] ring-1 ring-[var(--campaign-primary,#C2185B)]/30 hover:bg-[#FFF5F8] disabled:opacity-60">
            {loading ? "Đang tải…" : error ? "Thử lại" : "Xem thêm"}
          </button>
        </div>
      ) : null}
      {done && items.length ? (
        <div className="flex justify-center">
          <Link
            href="/tim"
            className="inline-flex min-h-[44px] items-center rounded-full bg-white px-6 text-sm font-bold text-[var(--campaign-primary,#C2185B)] ring-1 ring-[var(--campaign-primary,#C2185B)]/30 hover:bg-[#FFF5F8]"
          >
            Xem tất cả sản phẩm
          </Link>
        </div>
      ) : null}
    </section>
  );
}
