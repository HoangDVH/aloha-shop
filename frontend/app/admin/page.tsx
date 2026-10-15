import { VisitOverview } from "@/components/admin/VisitOverview";
import { TopProductsOverview } from "@/components/admin/TopProductsOverview";
import { BusinessOverview } from "@/components/admin/BusinessOverview";

export default function AdminHomePage() {
  return (
    <div>
      <BusinessOverview />
      <VisitOverview />
      <TopProductsOverview />
    </div>
  );
}
