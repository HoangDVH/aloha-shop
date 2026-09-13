import type { ShopProduct } from "@/lib/api";
import { buildProductJsonLd } from "@/lib/seo";

/** JSON-LD Product — không ảnh hưởng UI / mua hàng. */
export function ProductJsonLd({
  product,
  pageUrl,
}: {
  product: ShopProduct;
  pageUrl: string;
}) {
  const data = buildProductJsonLd(product, pageUrl);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
