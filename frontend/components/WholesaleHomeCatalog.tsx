"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { ProductGrid } from "@/components/ProductCard";
import { CatalogLayout } from "@/components/CatalogLayout";
import { fetchProducts } from "@/lib/api";
import { isWholesaleHomeViewer } from "@/lib/homeWholesaleOrder";
import { onShopCatalogChanged } from "@/lib/catalogSync";
import type { HomeProductsQuery } from "@/lib/useWholesaleHomeProducts";

/** Private view-more lists are fetched in the browser, never embedded in shared page HTML. */
export function WholesaleHomeCatalog({ query }: { query: HomeProductsQuery }) {
  const { user, loading } = useShopAuth();
  const wholesale = isWholesaleHomeViewer(user);
  const qc = useQueryClient();
  useEffect(() => onShopCatalogChanged(() => {
    void qc.invalidateQueries({ queryKey: ["shop", "si", "home", "catalog"] });
  }), [qc]);
  const result = useQuery({
    queryKey: ["shop", "si", "home", "catalog", user?.id, user?.siStatus, user?.siRegion, query],
    enabled: !loading,
    queryFn: ({ signal }) => fetchProducts({ ...query, homeOrder: wholesale ? "wholesale" : undefined, signal }),
    staleTime: 30_000,
  });
  const deals = query.badge === "uu_dai";
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <CatalogLayout total={result.data?.total || 0} page={query.page || 1} pages={result.data?.pages || 1}
        title={deals ? "Sản phẩm ưu đãi" : "Sản phẩm nổi bật"}>
        {loading || result.isPending ? <p role="status">Đang tải sản phẩm…</p> : null}
        {result.isError ? <p role="alert">Không tải được sản phẩm. Vui lòng thử lại.</p> : null}
        {result.data ? <ProductGrid products={result.data.items} shopee homeRow6={deals} variant={deals ? "deal" : "default"} /> : null}
      </CatalogLayout>
    </div>
  );
}
