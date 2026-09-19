"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Coins,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  Menu,
  Package,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { AdminAntdProvider } from "@/components/admin/AdminAntdProvider";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { CTV_PENDING_PATH, isCtvPendingBlocked } from "@/lib/ctvGate";
import { CtvMeStreamSync } from "@/components/ctv-portal/CtvMeStreamSync";
import { Toaster } from "sonner";

const NAV = [
  { href: "/cong-tac-vien", label: "Tổng quan", exact: true, Icon: LayoutDashboard },
  { href: "/cong-tac-vien/bao-cao", label: "Báo cáo chuyển đổi", Icon: Link2 },
  { href: "/cong-tac-vien/thanh-toan", label: "Thanh toán", Icon: Coins },
  { href: "/cong-tac-vien/san-pham", label: "Sản phẩm", Icon: Package },
  { href: "/cong-tac-vien/tai-khoan", label: "Tài khoản", Icon: UserRound },
];

function normalizePath(path: string) {
  const trimmed = (path || "/").replace(/\/+$/, "");
  return trimmed || "/";
}

function linkClass(active: boolean) {
  const base =
    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition";
  if (active) return `${base} bg-[#2D5A27] text-white shadow-sm`;
  return `${base} text-slate-600 hover:bg-[#F3F7F2] hover:text-[#1a2e1a]`;
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = normalizePath(usePathname() || "");
  const { user, logout } = useShopAuth();

  return (
    <>
      <div className="border-b border-[#eef0f3] px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--aloha-green)]">
          ALOHA CTV
        </p>
        <p className="mt-0.5 truncate text-sm font-bold text-[var(--aloha-ink)]">
          {user?.fullName || "Cộng tác viên"}
        </p>
        {user?.ctvCode ? (
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Mã: <span className="text-[#2D5A27]">{user.ctvCode}</span>
          </p>
        ) : null}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map(({ href, label, exact, Icon }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={linkClass(active)}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-[#eef0f3] p-2">
        <Link
          href="/"
          onClick={onNavigate}
          className={linkClass(false)}
        >
          <Store className="h-4 w-4 shrink-0" />
          Về cửa hàng
        </Link>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            void logout();
          }}
          className={`${linkClass(false)} w-full text-left text-red-600 hover:bg-red-50 hover:text-red-700`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Đăng xuất
        </button>
      </div>
    </>
  );
}

export function CtvPortalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useShopAuth();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = encodeURIComponent(
        typeof window !== "undefined" ? window.location.pathname : "/cong-tac-vien"
      );
      router.replace(`/dang-nhap?next=${next}`);
      return;
    }
    if (isCtvPendingBlocked(user)) {
      router.replace(CTV_PENDING_PATH);
      return;
    }
    if (!user.roles.includes("ctv") || user.ctvStatus !== "active") {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--aloha-green)]" />
      </div>
    );
  }

  if (
    isCtvPendingBlocked(user) ||
    !user.roles.includes("ctv") ||
    user.ctvStatus !== "active"
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--aloha-green)]" />
      </div>
    );
  }

  return (
    <AdminAntdProvider>
      <CtvMeStreamSync />
      <div className="flex min-h-screen bg-[#F7F8FA] text-[var(--aloha-ink)]">
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-[#e8eaed] bg-white lg:flex">
          <SidebarNav />
        </aside>

        {drawer ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Đóng menu"
              onClick={() => setDrawer(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-[min(86vw,280px)] flex-col bg-white shadow-xl">
              <div className="flex items-center justify-end border-b border-[#eef0f3] px-2 py-2">
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  onClick={() => setDrawer(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarNav onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#e8eaed] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-[#F3F7F2]"
              onClick={() => setDrawer(true)}
              aria-label="Mở menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </header>
          <main className="min-w-0 flex-1 bg-[#F7F8FA]">
            <div className="mx-auto h-full w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
        <Toaster richColors position="top-right" closeButton />
      </div>
    </AdminAntdProvider>
  );
}
