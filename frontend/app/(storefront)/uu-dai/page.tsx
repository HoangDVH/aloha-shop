import { Suspense } from "react";
import type { Metadata } from "next";
import { shopApiBase } from "@/lib/api";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";
import type { CurrentCampaignResponse } from "@/lib/campaign/campaignApi";
import { DealsPage } from "@/components/campaign/deals/DealsPage";

async function currentCampaignForMeta(): Promise<CurrentCampaignResponse | null> {
  try {
    const res = await fetch(`${shopApiBase()}/api/shop/campaigns/current`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    return res.ok ? ((await res.json()) as CurrentCampaignResponse) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [app, current] = await Promise.all([
    fetchAppearance().catch(() => fallbackAppearance()),
    currentCampaignForMeta(),
  ]);
  const site = shopBrand(app.theme?.siteName) || SHOP_BRAND;
  const c = current?.campaign;
  if (!c) {
    return { title: `Ưu đãi · ${site}`, description: `Voucher và ưu đãi đang có tại ${site}.` };
  }
  const title = `${c.display.hero.title || c.name} · ${site}`;
  const description = c.display.hero.subtitle || `Chương trình ${c.name} tại ${site}.`;
  const image = c.display.banners.find((b) => b.kind === "main")?.imageUrl;
  return {
    title,
    description,
    openGraph: { title, description, ...(image ? { images: [{ url: image }] } : {}) },
  };
}

export default function UuDaiPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-4">
          <div className="h-56 animate-pulse rounded-3xl bg-white/70" />
          <div className="h-32 animate-pulse rounded-2xl bg-white/70" />
        </div>
      }
    >
      <DealsPage />
    </Suspense>
  );
}
