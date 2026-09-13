"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  Globe,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import { useAdminSession } from "@/components/admin/auth/useAdminSession";

const NAV = [
  { href: "/admin", label: "Tổng quan", Icon: LayoutDashboard, exact: true },
  { href: "/admin/ctv", label: "CTV / Hoa hồng", Icon: Users },
  { href: "/admin/website", label: "Website bán hàng", Icon: Globe },
];

export function AdminSidebar() {
  const pathname = usePathname() || "";
  const { user, logout } = useAdminSession();

  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-[#e2ddd2] bg-white/90 backdrop-blur-sm">
      <div className="border-b border-[#ebe6dc] px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--aloha-green)]">
          ALOHA Admin
        </p>
        <p className="mt-0.5 text-sm font-bold text-[var(--aloha-ink)]">Vận hành shop</p>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--aloha-green)] text-white shadow-sm"
                  : "text-slate-600 hover:bg-[var(--aloha-green-light)] hover:text-[var(--aloha-ink)]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              {label}
            </Link>
          );
        })}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-[var(--aloha-green-light)] hover:text-[var(--aloha-ink)]"
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          Mở storefront
        </a>
      </nav>
      <div className="border-t border-[#ebe6dc] p-3">
        <p className="truncate text-xs font-semibold text-slate-700">
          {user?.fullName || user?.username}
        </p>
        <p className="truncate text-[11px] text-slate-500">{user?.role}</p>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#e2ddd2] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[var(--aloha-green)]/40 hover:bg-[var(--aloha-green-light)]"
        >
          <LogOut className="h-3.5 w-3.5" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
