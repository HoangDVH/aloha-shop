"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Heart } from "lucide-react";
import type { CampaignUI } from "@/lib/campaign/campaignApi";
import { fetchProducts, type ShopProduct } from "@/lib/api";
import { ProductGrid } from "@/components/ProductCard";
import { DealsSectionHead } from "./DealsSectionHead";

const PAGE = 20;
/** Tự nạp khi cuộn tối đa ngần này trang; sau đó mời sang trang tìm kiếm để trang ưu đãi không dài vô tận. */
const MAX_AUTO_PAGES = 5;

/** "Có thể bạn cũng thích": SP trang chủ còn hàng, bỏ SP đã có trong chiến dịch; cuộn tới đâu nạp tới đó. */
export function DealsMoreFeed({ campaign }: { campaign: CampaignUI }) {
  const exclude = useMemo(() => new Set(campaign.products.map((p) => p.ma.toUpperCase())), [campaign.products]);
  const [items, setItems] = useState<ShopProduct[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const done = page >= pages || page >= MAX_AUTO_PAGES;

  const loadNext = useRef<() => void>(() => {});
  loadNext.current = () => {
    if (loading || done) return;
    const next = page + 1;
    setLoading(true);
    fetchProducts({ home: true, inStock: true, page: next, limit: PAGE })
      .then((res) => {
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
      .catch(() => setPages(page))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    if (typeof IntersectionObserver === "undefined") {
      loadNext.current();
      return;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadNext.current(), {
      rootMargin: "600px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [done, page]);

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

      {items.length ? <ProductGrid products={items} shopee homeRow6 /> : null}
      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="aspect-[3/5] animate-pulse rounded-2xl bg-white/80" />
          ))}
        </div>
      ) : null}
      <div ref={sentinel} aria-hidden className="h-px" />
      {done && items.length ? (
        <div className="flex justify-center">
          <Link
            href="/tim?inStock=1"
            className="inline-flex min-h-[44px] items-center rounded-full bg-white px-6 text-sm font-bold text-[var(--campaign-primary,#C2185B)] ring-1 ring-[var(--campaign-primary,#C2185B)]/30 hover:bg-[#FFF5F8]"
          >
            Xem tất cả sản phẩm
          </Link>
        </div>
      ) : null}
    </section>
  );
}
