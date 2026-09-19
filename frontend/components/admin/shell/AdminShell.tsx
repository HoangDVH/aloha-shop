"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AdminSidebar } from "@/components/admin/shell/AdminSidebar";
import { AdminAntdProvider } from "@/components/admin/AdminAntdProvider";
import { useAdminSession } from "@/components/admin/auth/useAdminSession";
import { AdminOpsSync } from "@/components/admin/shell/AdminOpsSync";
import { Loader2 } from "lucide-react";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const isLogin = pathname.startsWith("/admin/dang-nhap");
  const { loading, user, isManager } = useAdminSession({ requireManager: !isLogin });

  if (isLogin) {
    return (
      <>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </>
    );
  }

  if (loading || !user || !isManager) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--aloha-green)]" />
      </div>
    );
  }

  return (
    <AdminAntdProvider>
      <AdminOpsSync enabled />
      <div className="flex min-h-screen bg-[#F7F8FA] text-[var(--aloha-ink)]">
        <AdminSidebar />
        <main className="min-h-screen min-w-0 flex-1 bg-[#F7F8FA]">
          <div className="mx-auto h-full w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
        <Toaster richColors position="top-right" closeButton />
      </div>
    </AdminAntdProvider>
  );
}
