import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/shell/AdminShell";

export const metadata: Metadata = {
  title: "Admin Shop",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
