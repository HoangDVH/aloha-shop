"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Button, Drawer } from "antd";
import { Toaster } from "sonner";
import { AdminSidebar } from "@/components/admin/shell/AdminSidebar";
import { AdminAntdProvider } from "@/components/admin/AdminAntdProvider";
import { useAdminSession } from "@/components/admin/auth/useAdminSession";
import { AdminOpsSync } from "@/components/admin/shell/AdminOpsSync";
import { AdminMobileTabBar } from "@/components/admin/shell/AdminMobileTabBar";
import { AdminNotificationCenter } from "@/components/admin/shell/AdminNotificationCenter";
import { Loader2, Menu, PanelLeftClose, PanelLeftOpen, Volume2 } from "lucide-react";

function getAdminSectionTitle(path: string): string {
  if (path.startsWith("/admin/don-hang-web")) return "Đơn hàng web";
  if (path.startsWith("/admin/ctv/khach-hang")) return "Quản lý khách hàng";
  if (path.startsWith("/admin/ctv/danh-sach")) return "Danh sách CTV";
  if (path.startsWith("/admin/ctv/hoa-hong")) return "Hoa hồng CTV";
  if (path.startsWith("/admin/ctv/cau-hinh-hoa-hong")) return "Cấu hình hoa hồng";
  if (path.startsWith("/admin/ctv/don-hang")) return "Đơn hàng CTV";
  if (path.startsWith("/admin/ctv/chong-gian")) return "Chống gian lận CTV";
  if (path.startsWith("/admin/ctv")) return "Quản lý CTV";
  if (path.startsWith("/admin/si")) return "Quản lý sỉ";
  if (path.startsWith("/admin/website")) return "Website bán hàng";
  if (path.startsWith("/admin/uu-dai")) return "Ưu đãi & Voucher";
  if (path.startsWith("/admin/tuyen-dung/ho-so")) return "Hồ sơ ứng viên tuyển dụng";
  if (path.startsWith("/admin/tuyen-dung/viec-lam")) return "Tin tuyển dụng";
  if (path.startsWith("/admin/tuyen-dung")) return "Tuyển dụng";
  if (path.startsWith("/admin/seo")) return "Tối ưu SEO";
  if (path.startsWith("/admin/bac-si-cay")) return "Bác sĩ cây cảnh";
  if (path.startsWith("/admin/tinh-trang-website")) return "Tình trạng website";
  return "Tổng quan quản trị";
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("aloha_admin_sidebar_collapsed");
      if (saved === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("aloha_admin_sidebar_collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const isLogin = pathname.startsWith("/admin/dang-nhap");
  const { loading, user, isManager } = useAdminSession({ requireManager: !isLogin });
  const sectionTitle = getAdminSectionTitle(pathname);

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
        <div className="hidden lg:block">
          <Suspense fallback={<aside className="h-screen w-[248px] shrink-0 border-r border-[#e8eaed] bg-white" />}>
            <AdminSidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
          </Suspense>
        </div>
        <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} placement="left" title="Điều hướng" size={248} styles={{ body: { padding: 0 } }} destroyOnHidden>
          <div className="h-full [&>aside]:h-full">
            <Suspense fallback={null}>
              <AdminSidebar onNavigate={() => setMenuOpen(false)} />
            </Suspense>
          </div>
        </Drawer>
        <main className="min-h-screen min-w-0 flex-1 bg-[#F7F8FA] pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
          {/* Top Bar Mobile - Menu + Title + Bell */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 pt-[max(0.65rem,env(safe-area-inset-top))] lg:hidden">
            <div className="flex items-center gap-2.5">
              <Button aria-label="Mở menu quản trị" icon={<Menu size={18} />} onClick={() => setMenuOpen(true)} />
              <span className="text-sm font-bold text-[#2D5A27]">ALOHA Admin</span>
            </div>
            <div className="flex items-center gap-2">
              <AdminNotificationCenter mode="mobile" />
            </div>
          </div>

          {/* Top Bar Desktop - Chuẩn KiotViet & các sàn thương mại điện tử lớn */}
          <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur-sm lg:flex">
            <div className="flex items-center gap-2">
              {/* Nút Toggle thu gọn/mở rộng sidebar chuẩn Shopify / VS Code */}
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition mr-1"
                title={collapsed ? "Mở rộng thanh menu (248px)" : "Thu gọn thanh menu (68px)"}
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-[#2D5A27]">ALOHA</span>
              <span className="text-slate-300">/</span>
              <span className="text-sm font-bold text-slate-800">{sectionTitle}</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Nút cài đặt âm thanh thông báo chuẩn các sàn TMĐT */}
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("aloha_open_chime_settings"));
                  }
                }}
                title="Cài đặt âm thanh & chuông thông báo (Đơn hàng, Khách sỉ, CTV, Tuyển dụng)"
                className="flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
              >
                <Volume2 className="h-3.5 w-3.5 text-emerald-700" />
                <span>Âm thanh báo</span>
              </button>

              {/* Chuông thông báo KiotViet */}
              <AdminNotificationCenter mode="desktop" />

              {/* Thông tin tài khoản admin */}
              <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-[#2D5A27]">
                  {((user?.fullName || user?.username || "A")[0]).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="max-w-[120px] truncate text-xs font-bold text-slate-800 leading-tight">
                    {user?.fullName || user?.username}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {user?.role === "manager" ? "Quản lý" : "Nhân viên"}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Full-width content workspace (Chuẩn KiotViet/Shopee - đệm gọn gàng 16px) */}
          <div
            className={`w-full h-full ${
              pathname.startsWith("/admin/don-hang-web") ? "p-0 lg:p-4" : "p-2.5 sm:p-4 lg:p-4"
            }`}
          >
            {children}
          </div>
        </main>
        <Suspense fallback={null}>
          <AdminMobileTabBar menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />
        </Suspense>
        <Toaster richColors position="top-right" closeButton />
      </div>
    </AdminAntdProvider>
  );
}
