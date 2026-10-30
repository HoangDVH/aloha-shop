import type { Metadata } from "next";
import { CtvRecruitLanding } from "@/components/ctv-recruit/CtvRecruitLanding";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";
import { SHOP_ORIGIN } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const app = await fetchAppearance().catch(() => fallbackAppearance());
  const site = shopBrand(app.theme?.siteName) || SHOP_BRAND;
  return {
    title: "Tuyển cộng tác viên bán hàng (CTV)",
    description: `Gia nhập đội ngũ CTV ${site} — chia sẻ đam mê cây xanh, kiếm thêm thu nhập với chính sách hoa hồng minh bạch, không cần vốn.`,
    alternates: { canonical: `${SHOP_ORIGIN}/tuyen-ctv` },
  };
}

export default function TuyenCtvPage() {
  return <CtvRecruitLanding />;
}
