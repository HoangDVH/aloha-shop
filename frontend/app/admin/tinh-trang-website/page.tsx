import type { Metadata } from "next";
import { SiteHealthOverview } from "@/components/admin/SiteHealthOverview";

export const metadata: Metadata = {
  title: "Tình trạng website - Admin Shop",
};

export default function AdminSiteHealthPage() {
  return <SiteHealthOverview />;
}
