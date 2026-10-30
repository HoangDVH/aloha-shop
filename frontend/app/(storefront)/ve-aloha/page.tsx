import type { Metadata } from "next";
import { VeAlohaLanding } from "@/components/about/VeAlohaLanding";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";
import { SHOP_ORIGIN, absUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const app = await fetchAppearance().catch(() => fallbackAppearance());
  const site = shopBrand(app.theme?.siteName) || SHOP_BRAND;
  const title = "Về chúng tôi - Câu chuyện thương hiệu Aloha";
  const description = `${site} — thương hiệu chuyên cây cảnh trong nhà, chậu cây thiết kế và giải pháp cây xanh văn phòng TP.HCM. Mang thiên nhiên xanh mát đến không gian sống của bạn.`;
  const canonical = `${SHOP_ORIGIN}/ve-aloha`;
  const ogImage = absUrl("/brand/logo-aloha.png");

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      url: canonical,
      siteName: site,
      title: `${title} · ${site}`,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${site} - Về chúng tôi`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${site}`,
      description,
      images: [ogImage],
    },
  };
}

export default function VeAlohaPage() {
  return <VeAlohaLanding />;
}
