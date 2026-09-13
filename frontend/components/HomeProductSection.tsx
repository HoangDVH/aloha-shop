import Link from "next/link";
import { ProductGrid } from "@/components/ProductCard";
import { SectionTitle } from "@/components/SectionTitle";
import type { ShopProduct } from "@/lib/api";

type Props = {
  title: string;
  href: string;
  products: ShopProduct[];
};

export function HomeProductSection({ title, href, products }: Props) {
  if (!products.length) return null;

  return (
    <section className="pb-2 sm:pb-4">
      <SectionTitle className="mb-5 sm:mb-7">{title}</SectionTitle>
      <ProductGrid products={products} shopee homeRow6 />
      <div className="mt-4 flex justify-center pt-2 sm:mt-5 sm:pt-3">
        <Link
          href={href}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--aloha-line)] bg-white px-5 text-sm font-bold text-[var(--aloha-green)] shadow-sm transition hover:border-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
        >
          Xem thêm
        </Link>
      </div>
    </section>
  );
}
