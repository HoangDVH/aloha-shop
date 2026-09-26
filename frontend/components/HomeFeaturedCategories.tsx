"use client";

import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { SectionTitle } from "@/components/SectionTitle";
import type { ShopProduct } from "@/lib/api";
import {
  livePropsForMa,
  useLiveProductPrices,
} from "@/lib/useLiveProductPrices";

const VIEW_ALL_HREF = "/tim?badge=noi_bat";
const HOME_NOI_BAT_LIMIT = 6;

/** Khối «Sản phẩm nổi bật» — SP gắn nhãn tay `noi_bat` ở Hàng hóa web. */
export function HomeFeaturedCategories({
  products,
}: {
  products: ShopProduct[];
}) {
  const items = products.slice(0, HOME_NOI_BAT_LIMIT);
  const liveMap = useLiveProductPrices(items);
  if (!items.length) return null;

  return (
    <section className="bg-white py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-center justify-between gap-3 sm:hidden">
          <h2 className="min-w-0 text-base font-extrabold uppercase tracking-wide text-[var(--aloha-ink)]">
            Sản phẩm nổi bật
          </h2>
          <Link
            href={VIEW_ALL_HREF}
            className="shrink-0 text-sm font-semibold text-[var(--aloha-green)]"
          >
            Xem tất cả →
          </Link>
        </div>

        <div className="relative mb-8 hidden sm:mb-10 sm:block">
          <SectionTitle>SẢN PHẨM NỔI BẬT</SectionTitle>
          <Link
            href={VIEW_ALL_HREF}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--aloha-green)] transition hover:text-[var(--aloha-green-dark)]"
          >
            Xem tất cả →
          </Link>
        </div>

        {/* Cùng tỉ lệ card catalog (2→5 cột); 1 SP không bị kéo full ngang. Gạch dọc desktop. */}
        <ul className="mt-2 grid grid-cols-2 gap-3 sm:mt-4 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-0">
          {items.map((p, i) => (
            <li
              key={p.ma}
              className={`min-w-0 lg:px-2.5 ${
                i < items.length - 1 ? "lg:border-r lg:border-[var(--aloha-line)]" : ""
              }`}
            >
              <ProductCard product={p} shopee {...livePropsForMa(liveMap, p.ma)} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
