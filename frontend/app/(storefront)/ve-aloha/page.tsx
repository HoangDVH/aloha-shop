import type { Metadata } from "next";
import { VeAlohaLanding } from "@/components/about/VeAlohaLanding";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";

export async function generateMetadata(): Promise<Metadata> {
  const app = await fetchAppearance().catch(() => fallbackAppearance());
  const site = shopBrand(app.theme?.siteName) || SHOP_BRAND;
  return {
    title: `Về chúng tôi · ${site}`,
    description: `${site} — cửa hàng chuyên cây cảnh, chậu cây và phụ kiện trang trí. Mang thiên nhiên đến gần hơn với cuộc sống của bạn.`,
  };
}

export default function VeAlohaPage() {
  return <VeAlohaLanding />;
}
