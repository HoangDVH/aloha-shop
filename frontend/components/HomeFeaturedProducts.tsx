"use client";

import Link from "next/link";
import { ProductGrid } from "@/components/ProductCard";
import { SectionTitle } from "@/components/SectionTitle";
import { HomeFlashSaleStage } from "@/components/campaign/HomeFlashSaleStage";
import type { ShopProduct } from "@/lib/api";
import { useHomeDealProducts } from "@/lib/campaign/useHomeDealProducts";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { isWholesaleHomeViewer, wholesaleHomeHref } from "@/lib/homeWholesaleOrder";

import { useWholesaleHomeProducts, type HomeProductsQuery } from "@/lib/useWholesaleHomeProducts";

type Props = {
  query?: HomeProductsQuery;
  title: string;
  products: ShopProduct[];
  href: string;
  /** Số SP tối đa hiện trên lưới (mặc định 12 = 2 hàng × 6 cột) */
  limit?: number;
  ctaLabel?: string;
  variant?: "default" | "deal";
};

/** Mục SP trang chủ — tiêu đề giữa + lá + lưới 6 cột desktop. */
export function HomeFeaturedProducts({
  title,
  products,
  href,
  limit = 12,
  ctaLabel = "Xem thêm sản phẩm →",
  variant = "default",
  query,
}: Props) {
  if (variant === "deal") {
    return <HomeDealSection title={title} products={products} href={href} limit={limit} ctaLabel={ctaLabel} query={query} />;
  }
  return <HomeDefaultSection title={title} products={products} href={href} ctaLabel={ctaLabel} variant={variant} limit={limit} query={query} />;
}

function HomeDefaultSection({ products, limit, query, ...rest }: Props & { limit: number; ctaLabel: string; variant: "default" }) {
  const items = useWholesaleHomeProducts(products, query, limit);
  return <Section {...rest} products={items} />;
}

function HomeDealSection({ products, limit, query, ...rest }: Omit<Props, "variant"> & { limit: number; ctaLabel: string }) {
  const merged = useHomeDealProducts(products, limit);
  const items = useWholesaleHomeProducts(merged, query, limit);
  return <Section {...rest} products={items} variant="deal" />;
}

function Section({
  title,
  products,
  href,
  ctaLabel,
  variant,
}: {
  title: string;
  products: ShopProduct[];
  href: string;
  ctaLabel: string;
  variant: "default" | "deal";
}) {
  const { user } = useShopAuth();
  if (!products.length) return null;

  return (
    <section className="bg-[var(--aloha-surface)] py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4">
        {variant === "deal" ? (
          <div className="mb-3 sm:mb-4">
            <HomeFlashSaleStage />
          </div>
        ) : (
          <SectionTitle className="mb-6 sm:mb-8">{title}</SectionTitle>
        )}
        <ProductGrid
          products={products}
          shopee
          homeRow6
          columns={6}
          variant={variant}
        />
        <div className="mt-6 flex justify-center">
          <Link
            href={wholesaleHomeHref(href, isWholesaleHomeViewer(user))}
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--aloha-green)] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--aloha-green-dark)]"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
