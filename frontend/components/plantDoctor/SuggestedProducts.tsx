"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { searchProductsClient, type ShopProduct } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";

/** Sản phẩm shop khớp từ khoá AI gợi ý (đá bọt, chậu đất nung…), tối đa 4 SP còn hàng. */
export function SuggestedProducts({ keywords }: { keywords: string[] }) {
  const [items, setItems] = useState<ShopProduct[] | null>(null);
  const key = keywords.join("|");

  useEffect(() => {
    let alive = true;
    const terms = key.split("|").filter(Boolean);
    Promise.all(terms.map((t) => searchProductsClient(t, 6).catch(() => ({ items: [] as ShopProduct[] }))))
      .then((results) => {
        if (!alive) return;
        const seen = new Set<string>();
        const picked: ShopProduct[] = [];
        for (let round = 0; round < 6 && picked.length < 4; round++) {
          for (const r of results) {
            const p = r.items[round];
            if (p && !seen.has(p.ma) && picked.length < 4) {
              seen.add(p.ma);
              picked.push(p);
            }
          }
        }
        setItems(picked);
      });
    return () => {
      alive = false;
    };
  }, [key]);

  if (!keywords.length || (items && !items.length)) return null;
  return (
    <div className="mt-3.5 rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-[#F7FAF6] to-white p-3.5 sm:p-4 shadow-2xs">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-[#1C4C40]">
            <ShoppingBag size={13} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs font-bold text-[#1C4C40]">
              Vật tư điều trị bác sĩ gợi ý
            </p>
            <p className="text-[10.5px] text-stone-500">
              Có sẵn tại shop: {keywords.join(" · ")}
            </p>
          </div>
        </div>

        <Link
          href={`/tim?q=${encodeURIComponent(keywords[0])}`}
          className="text-[11px] font-bold text-[#2e7139] hover:underline"
        >
          Xem tất cả ›
        </Link>
      </div>

      {items ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.ma} product={p} variant="default" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-stone-200/60" />
          ))}
        </div>
      )}
    </div>
  );
}
