import type { Metadata } from "next";
import { CtvPortalShell } from "@/components/ctv-portal/CtvPortalShell";

export const metadata: Metadata = {
  title: "Cộng tác viên",
  robots: { index: false, follow: false },
};

export default function CtvPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CtvPortalShell>{children}</CtvPortalShell>;
}
