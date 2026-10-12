import { AdminPageHeader } from "@/components/admin/shell/AdminUi";
import { VisitOverview } from "@/components/admin/VisitOverview";
import { TopProductsOverview } from "@/components/admin/TopProductsOverview";
import { BusinessOverview } from "@/components/admin/BusinessOverview";

export default function AdminHomePage() {
  return (
    <div>
      <AdminPageHeader
        title="Tổng quan"
        description="Theo dõi bán hàng, chuyển đổi mua hàng, truy cập và sản phẩm trên website."
      />
      <BusinessOverview />
      <VisitOverview />
      <TopProductsOverview />
    </div>
  );
}
