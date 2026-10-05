import type { Metadata } from "next";
import { PlantDoctorPage } from "@/components/plantDoctor/PlantDoctorPage";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";

export async function generateMetadata(): Promise<Metadata> {
  const app = await fetchAppearance().catch(() => fallbackAppearance());
  const site = shopBrand(app.theme?.siteName) || SHOP_BRAND;
  return {
    title: `Bác sĩ cây cảnh · ${site}`,
    description: `Chụp ảnh cây đang bệnh để AI của ${site} bắt bệnh, hướng dẫn chữa từng bước và gợi ý cách trồng cho cây khoẻ lại. Miễn phí.`,
  };
}

export default function BacSiCayPage() {
  return <PlantDoctorPage />;
}
