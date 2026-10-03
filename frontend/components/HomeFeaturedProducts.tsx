"use client";

import Link from "next/link";
import { ProductGrid } from "@/components/ProductCard";
import { SectionTitle } from "@/components/SectionTitle";
import { HomeFlashSaleStage } from "@/components/campaign/HomeFlashSaleStage";
import type { ShopProduct } from "@/lib/api";
import { useHomeDealProducts } from "@/lib/campaign/useHomeDealProducts";

type Props = {
  title: string;
  products: ShopProduct[];
  href: string;
  /** Số SP tối đa hiện trên lưới (mặc định 10 = 2 hàng × 5 cột) */
  limit?: number;
  ctaLabel?: string;
  variant?: "default" | "deal";
};

/** Mục SP trang chủ — tiêu đề giữa + lá + lưới 5 cột desktop. */
export function HomeFeaturedProducts({
  title,
  products,
  href,
  limit = 10,
  ctaLabel = "Xem thêm sản phẩm →",
  variant = "default",
}: Props) {
  if (variant === "deal") {
    return <HomeDealSection title={title} products={products} href={href} limit={limit} ctaLabel={ctaLabel} />;
  }
  return <Section title={title} products={products.slice(0, limit)} href={href} ctaLabel={ctaLabel} variant={variant} />;
}

function HomeDealSection({ products, limit, ...rest }: Omit<Props, "variant"> & { limit: number; ctaLabel: string }) {
  const merged = useHomeDealProducts(products, limit);
  return <Section {...rest} products={merged} variant="deal" />;
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
  if (!products.length) return null;

  return (
    <section className="bg-[var(--aloha-surface)] py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4">
        {variant === "deal" ? (
          <div className="mb-6 sm:mb-8">
            <HomeFlashSaleStage />
          </div>
        ) : (
          <SectionTitle className="mb-6 sm:mb-8">{title}</SectionTitle>
        )}
        <ProductGrid
          products={products}
          shopee
          homeRow6
          variant={variant}
        />
        <div className="mt-6 flex justify-center">
          <Link
            href={href}
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--aloha-green)] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--aloha-green-dark)]"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
