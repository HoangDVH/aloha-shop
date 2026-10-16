"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { onShopCatalogChanged } from "@/lib/catalogSync";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { fetchProducts, type ShopProduct } from "@/lib/api";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { isWholesaleHomeViewer, orderWholesaleHomeProducts } from "@/lib/homeWholesaleOrder";

export type HomeProductsQuery = Omit<Parameters<typeof fetchProducts>[0], "signal" | "homeOrder">;

/** Session-scoped client query keeps personalized ordering out of public HTML caches. */
export function useWholesaleHomeProducts(products: ShopProduct[], query: HomeProductsQuery | undefined, limit: number) {
  const { user } = useShopAuth();
  const wholesale = isWholesaleHomeViewer(user);
  const stockFirst = true;
  const qc = useQueryClient();
  useEffect(() => {
    if (!wholesale) return;
    return onShopCatalogChanged(() => { void qc.invalidateQueries({ queryKey: ["shop", "si", "home"] }); });
  }, [wholesale, qc]);
  const { campaign } = useCampaignView();
  const result = useQuery({
    queryKey: ["shop", "si", "home", "pots-stock-first-v3", user?.id, user?.siStatus, user?.siRegion, query, limit,
      query?.badge === "uu_dai" ? campaign : null],
    enabled: wholesale && Boolean(query),
    queryFn: async ({ signal }) => {
      const response = await fetchProducts({ ...query, homeOrder: "wholesale", page: 1, limit, signal });
      let items = response.items || [];
      if (query?.badge === "uu_dai" && items.length < 4 && response.homeAudience !== "wholesale") {
        const fallback = await fetchProducts({ ...query, badge: "ban_chay_sap_het", homeOrder: "wholesale", page: 1, limit, signal });
        const seen = new Set(items.map(p => p.ma));
        items = [...items, ...fallback.items.filter(p => !seen.has(p.ma))];
      }
      return orderWholesaleHomeProducts(items, stockFirst).slice(0, limit);
    },
    staleTime: 30_000,
  });
  return wholesale
    ? (result.data ?? orderWholesaleHomeProducts(products, stockFirst).slice(0, limit))
    : products.slice(0, limit);
}
