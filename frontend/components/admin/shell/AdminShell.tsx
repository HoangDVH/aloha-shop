"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AdminSidebar } from "@/components/admin/shell/AdminSidebar";
import { useAdminSession } from "@/components/admin/auth/useAdminSession";
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--aloha-cream)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--aloha-green)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--aloha-cream)] text-[var(--aloha-ink)]">
      <AdminSidebar />
      <main className="min-h-screen min-w-0 flex-1">
        <div className="mx-auto h-full w-full max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <Toaster richColors position="top-right" closeButton />
    </div>
  );
}
