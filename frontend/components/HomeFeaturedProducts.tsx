"use client";

import Link from "next/link";
import { ProductGrid } from "@/components/ProductCard";
import { SectionTitle } from "@/components/SectionTitle";
import type { ShopProduct } from "@/lib/api";

type Props = {
  banChay: ShopProduct[];
  moi?: ShopProduct[];
  noiBat?: ShopProduct[];
};

/** Sản phẩm bán chạy — tiêu đề giữa + lá, không tab lọc. */
export function HomeFeaturedProducts({ banChay }: Props) {
  const products = banChay;
  if (!products.length) return null;

  return (
    <section className="bg-[var(--aloha-surface)] py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4">
        <SectionTitle className="mb-6 sm:mb-8">SẢN PHẨM BÁN CHẠY</SectionTitle>
        <ProductGrid products={products.slice(0, 12)} shopee homeRow6 />
        <div className="mt-6 flex justify-center">
          <Link
            href="/tim?sort=ban_chay"
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--aloha-green)] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--aloha-green-dark)]"
          >
            Xem thêm sản phẩm →
          </Link>
        </div>
      </div>
    </section>
  );
}
