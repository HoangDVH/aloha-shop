import { Suspense } from "react";
import type { Metadata } from "next";
import { shopApiBase } from "@/lib/api";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";
import type { CurrentCampaignResponse } from "@/lib/campaign/campaignApi";
import { DealsPage } from "@/components/campaign/deals/DealsPage";
import { SHOP_ORIGIN, shortHash } from "@/lib/seo";

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
  const canonical = `${SHOP_ORIGIN}/uu-dai`;
  const c = current?.campaign;
  if (!c) {
    return {
      title: "Ưu đãi & Mã giảm giá",
      description: `Tổng hợp voucher và chương trình ưu đãi mới nhất tại ${site}.`,
      alternates: { canonical },
    };
  }
  const title = c.display.hero.title || c.name || "Ưu đãi & Mã giảm giá";
  const description = c.display.hero.subtitle || `Chương trình ${c.name} tại ${site}.`;
  const banners = c.display?.banners || [];
  const shareBanner = banners.find((b) => (b.kind as string) === "share" || (b.kind as string) === "og");
  const mainBanner = shareBanner || banners.find((b) => b.kind === "main") || banners[0];
  const bannerUrl = String(mainBanner?.imageUrl || "").trim();
  const hasBanner = Boolean(bannerUrl);
  const vHash = bannerUrl ? shortHash(bannerUrl) : "auto";
  const ogImageUrl = hasBanner
    ? `${SHOP_ORIGIN}/og/uu-dai?v=${vHash}`
    : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      url: canonical,
      title: `${title} · ${site}`,
      description,
      ...(ogImageUrl
        ? {
            images: [
              {
                url: ogImageUrl,
                secureUrl: ogImageUrl,
                width: 1200,
                height: 630,
                alt: `${title} · ${site}`,
                type: "image/jpeg",
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${site}`,
      description,
      images: ogImageUrl ? [ogImageUrl] : undefined,
    },
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
