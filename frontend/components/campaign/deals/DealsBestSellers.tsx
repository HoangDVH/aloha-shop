"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import type { CampaignUI } from "@/lib/campaign/campaignApi";
import { fetchBestSellers } from "@/lib/campaign/campaignApi";
import { fetchLivePrices } from "@/lib/livePrices";
import type { ShopProduct } from "@/lib/api";
import { ProductDealCard } from "@/components/campaign/ProductDealCard";
import { liveRowToProduct } from "./DealsProducts";
import { DealsSectionHead } from "./DealsSectionHead";

type Ranked = { product: ShopProduct; sold: number };

/** Top 3 bán chạy theo số bán thật; nếu chưa đủ số liệu thì lấy top sản phẩm nổi bật của chiến dịch. */
export function DealsBestSellers({ campaign }: { campaign: CampaignUI }) {
  const [items, setItems] = useState<Ranked[]>([]);

  useEffect(() => {
    let alive = true;
    fetchBestSellers()
      .then(async (top) => {
        let targets = top;
        // Fallback: nếu chưa có số liệu đơn hàng thật từ server, lấy 3 sản phẩm nổi bật nhất trong chiến dịch
        if (!targets.length && campaign.products?.length) {
          const candidates = [
            ...campaign.products.filter((p) => p.dealHot),
            ...campaign.products.filter((p) => !p.dealHot),
          ].slice(0, 3);
          targets = candidates.map((p) => ({ ma: p.ma, sold: 0 }));
        }
        if (!targets.length) return [];
        const rows = await fetchLivePrices(targets.map((t) => t.ma));
        const byMa = new Map(rows.map((r) => [String(r.ma).toUpperCase(), r]));
        return targets.flatMap((t) => {
          const r = byMa.get(t.ma.toUpperCase());
          return r && r.isActive !== false ? [{ product: liveRowToProduct(r), sold: t.sold }] : [];
        });
      })
      .then((list) => alive && setItems(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [campaign.id, campaign.products]);

  if (!items.length) return null;
  const shortName = campaign.display.hero.title?.match(/\d{1,2}\/\d{1,2}/)?.[0];

  return (
    <section id="ban-chay" className="scroll-mt-24 space-y-4 rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-rose-100/80">
      <DealsSectionHead
        icon={Trophy}
        title={shortName ? `Top bán chạy nhất ${shortName}` : "Top sản phẩm bán chạy nhất"}
        subtitle="Top cây cảnh & chậu được yêu thích nhất trong đợt ưu đãi"
      />
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible lg:max-w-4xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((x, i) => (
          <li key={x.product.ma} className="w-[46vw] max-w-[220px] shrink-0 snap-start sm:w-auto sm:max-w-none">
            <ProductDealCard product={x.product} rank={i + 1} soldCount={x.sold} />
          </li>
        ))}
      </ul>
    </section>
  );
}
