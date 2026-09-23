import { Suspense } from "react";
import type { Metadata } from "next";
import { SiRegisterWizard } from "@/components/si-register/SiRegisterWizard";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";

export async function generateMetadata(): Promise<Metadata> {
  const app = await fetchAppearance().catch(() => fallbackAppearance());
  const site = shopBrand(app.theme?.siteName) || SHOP_BRAND;
  return {
    title: `Đăng ký khách sỉ · ${site}`,
    description: `Gửi hồ sơ đăng ký khách sỉ cùng ${site} — nhận chính sách giá ưu đãi dành riêng cho đại lý và cửa hàng cây xanh, chậu cảnh.`,
  };
}

export default function DangKySiPage() {
  return (
    <Suspense fallback={<ShopPageLoader fullscreen={false} />}>
      <SiRegisterWizard />
    </Suspense>
  );
}
