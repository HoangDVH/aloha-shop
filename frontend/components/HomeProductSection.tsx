"use client";

import Link from "next/link";
import { ProductGrid } from "@/components/ProductCard";
import { SectionTitle } from "@/components/SectionTitle";
import type { ShopProduct } from "@/lib/api";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { isWholesaleHomeViewer, wholesaleHomeHref } from "@/lib/homeWholesaleOrder";

import { useWholesaleHomeProducts, type HomeProductsQuery } from "@/lib/useWholesaleHomeProducts";

type Props = {
  query?: HomeProductsQuery;
  limit?: number;
  title: string;
  href: string;
  products: ShopProduct[];
  variant?: "default" | "deal";
};

export function HomeProductSection({ title, href, products, variant = "default", query, limit = products.length || 12 }: Props) {
  const { user } = useShopAuth();
  const items = useWholesaleHomeProducts(products, query, limit);
  if (!items.length) return null;

  return (
    <section className="pb-2 sm:pb-4">
      <SectionTitle className="mb-5 sm:mb-7">{title}</SectionTitle>
      <ProductGrid products={items} shopee homeRow6 columns={6} variant={variant} />
      <div className="mt-4 flex justify-center pt-2 sm:mt-5 sm:pt-3">
        <Link
          href={wholesaleHomeHref(href, isWholesaleHomeViewer(user))}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--aloha-line)] bg-white px-5 text-sm font-bold text-[var(--aloha-green)] shadow-sm transition hover:border-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
        >
          Xem thêm
        </Link>
      </div>
    </section>
  );
}
