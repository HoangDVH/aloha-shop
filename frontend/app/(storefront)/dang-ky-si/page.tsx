import { Suspense } from "react";
import type { Metadata } from "next";
import { SiRegisterWizard } from "@/components/si-register/SiRegisterWizard";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";
import { SHOP_ORIGIN } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const app = await fetchAppearance().catch(() => fallbackAppearance());
  const site = shopBrand(app.theme?.siteName) || SHOP_BRAND;
  return {
    title: "Đăng ký khách sỉ & Đại lý phân phối",
    description: `Gửi hồ sơ đăng ký đối tác sỉ cùng ${site} — nhận bảng giá sỉ chiết khấu cao dành riêng cho nhà vườn, đại lý và cửa hàng cây cảnh.`,
    alternates: { canonical: `${SHOP_ORIGIN}/dang-ky-si` },
  };
}

export default function DangKySiPage() {
  return (
    <Suspense fallback={<ShopPageLoader fullscreen={false} />}>
      <SiRegisterWizard />
    </Suspense>
  );
}
