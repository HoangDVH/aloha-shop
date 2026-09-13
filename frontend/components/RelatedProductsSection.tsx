import { fetchRelatedProducts } from "@/lib/shopProductServer";
import { ProductGrid } from "@/components/ProductCard";

export async function RelatedProductsSection({
  nhom,
  ma,
}: {
  nhom: string;
  ma: string;
}) {
  const related = await fetchRelatedProducts(nhom, ma);
  if (!related.length) return null;

  return (
    <section className="mx-auto max-w-6xl space-y-3 px-4 pb-8">
      <h2 className="text-lg font-extrabold text-[#222]">Các sản phẩm, dịch vụ khác</h2>
      <ProductGrid products={related} shopee />
    </section>
  );
}

export function RelatedProductsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-3 px-4 pb-8">
      <div className="h-6 w-56 rounded bg-[#EDE6D8]" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-sm bg-[#EDE6D8]" />
        ))}
      </div>
    </div>
  );
}
