import { VisitOverview } from "@/components/admin/VisitOverview";
import { TopProductsOverview } from "@/components/admin/TopProductsOverview";
import { BusinessOverview } from "@/components/admin/BusinessOverview";
import { SiteHealthOverview } from "@/components/admin/SiteHealthOverview";

export default function AdminHomePage() {
  return (
    <div>
      <SiteHealthOverview />
      <BusinessOverview />
      <VisitOverview />
      <TopProductsOverview />
    </div>
  );
}
