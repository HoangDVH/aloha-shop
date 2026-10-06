"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  BarChart3,
  Briefcase,
  CalendarHeart,
  Inbox,
  ChevronDown,
  Coins,
  ExternalLink,
  FileText,
  Globe,
  LayoutDashboard,
  LogOut,
  Percent,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Sprout,
  Store,
  Ticket,
  UserRound,
  Users,
} from "lucide-react";
import { useAdminSession } from "@/components/admin/auth/useAdminSession";
import { useAdminBadgeCounts } from "@/components/admin/shell/AdminOpsSync";

const PROMOTIONS_SUB = [
  { href: "/admin/uu-dai?tab=campaigns", tab: "campaigns", label: "Chiến dịch", Icon: CalendarHeart },
  { href: "/admin/uu-dai?tab=programs", tab: "programs", label: "Đợt phát hành voucher", Icon: Sparkles },
  { href: "/admin/uu-dai?tab=codes", tab: "codes", label: "Danh sách mã Voucher", Icon: Ticket },
  { href: "/admin/uu-dai?tab=reports", tab: "reports", label: "Lịch sử & Đối soát", Icon: BarChart3 },
  { href: "/admin/uu-dai?tab=kiotviet", tab: "kiotviet", label: "Đồng bộ KiotViet", Icon: Store },
];

const CTV_SUB = [
  { href: "/admin/ctv", label: "Tổng quan", exact: true, Icon: LayoutDashboard, badgeKey: null as null | "ctv" | "orders" | "fraud" },
  { href: "/admin/ctv/danh-sach", label: "Danh sách CTV", Icon: Users, badgeKey: "ctv" as const },
  { href: "/admin/ctv/hoa-hong", label: "Hoa hồng", Icon: Coins, badgeKey: null },
  { href: "/admin/ctv/cau-hinh-hoa-hong", label: "Cấu hình hoa hồng", Icon: Percent, badgeKey: null },
  { href: "/admin/ctv/don-hang", label: "Đơn hàng", Icon: FileText, badgeKey: "orders" as const },
  { href: "/admin/ctv/chong-gian", label: "Chống gian lận", Icon: Shield, badgeKey: "fraud" as const },
];

const RECRUITMENT_SUB = [
  { href: "/admin/tuyen-dung/ho-so", label: "Hồ sơ ứng viên", Icon: Inbox },
  { href: "/admin/tuyen-dung/viec-lam", label: "Tin tuyển dụng", Icon: FileText },
];

const CUSTOMERS_HREF = "/admin/ctv/khach-hang";

function normalizePath(path: string) {
  if (!path) return "/";
  const trimmed = path.replace(/\/+$/, "");
  return trimmed || "/";
}

const activeNavStyle: React.CSSProperties = {
  backgroundColor: "#2D5A27",
  color: "#ffffff",
};

function linkClass(active: boolean, nested = false) {
  const base = nested
    ? "group flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition"
    : "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition";
  if (active) {
    return nested
      ? `${base} !bg-[#2D5A27] !text-white shadow-sm ring-1 ring-[#2D5A27]/40 [&_svg]:!text-white`
      : `${base} !bg-[#2D5A27] !text-white shadow-sm [&_svg]:!text-white`;
  }
  return nested
    ? `${base} text-slate-600 hover:!bg-[#F0F5EE] hover:!text-slate-900 [&_svg]:text-slate-400 group-hover:[&_svg]:!text-slate-700`
    : `${base} text-slate-600 hover:!bg-[#F0F5EE] hover:!text-slate-900 [&_svg]:text-slate-400 group-hover:[&_svg]:!text-slate-700`;
}

export function AdminSidebar() {
  const pathname = normalizePath(usePathname() || "");
  const { user, logout } = useAdminSession();
  const badges = useAdminBadgeCounts(true);
  const onCustomers =
    pathname === CUSTOMERS_HREF || pathname.startsWith(`${CUSTOMERS_HREF}/`);
  const onCtv =
    !onCustomers &&
    (pathname === "/admin/ctv" || pathname.startsWith("/admin/ctv/"));
  const [ctvOpen, setCtvOpen] = useState(onCtv);

  const onPromotions =
    pathname === "/admin/uu-dai" || pathname.startsWith("/admin/uu-dai/");
  const [promotionsOpen, setPromotionsOpen] = useState(onPromotions);

  const onRecruitment = pathname.startsWith("/admin/tuyen-dung");
  const [recruitmentOpen, setRecruitmentOpen] = useState(onRecruitment);

  const searchParams = useSearchParams();
  const currentTab = searchParams?.get("tab") || "campaigns";

  useEffect(() => {
    if (onCtv) setCtvOpen(true);
  }, [onCtv]);

  useEffect(() => {
    if (onPromotions) setPromotionsOpen(true);
  }, [onPromotions]);

  useEffect(() => {
    if (onRecruitment) setRecruitmentOpen(true);
  }, [onRecruitment]);

  const badgeFor = (key: null | "ctv" | "orders" | "fraud") => {
    if (key === "ctv") return badges.ctvPending;
    if (key === "orders") return badges.ordersNeedAction;
    if (key === "fraud") return badges.fraudOpen;
    return 0;
  };

  return (
    <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col border-r border-[#e8eaed] bg-white">
      <div className="border-b border-[#eef0f3] px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--aloha-green)]">
          ALOHA Admin
        </p>
        <p className="mt-0.5 text-sm font-bold text-[var(--aloha-ink)]">
          ALOHA — THẾ GIỚI CHẬU CÂY
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        <Link
          href="/admin"
          className={linkClass(pathname === "/admin")}
          style={pathname === "/admin" ? activeNavStyle : undefined}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          Tổng quan
        </Link>

        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setCtvOpen((v) => !v)}
            className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
              onCtv
                ? "!bg-[#EAF3E8] !text-[#2D5A27] font-bold ring-1 ring-[#2D5A27]/20 [&_svg]:!text-[#2D5A27]"
                : "text-slate-600 hover:!bg-[#F0F5EE] hover:!text-slate-900 [&_svg]:text-slate-400 group-hover:[&_svg]:!text-slate-700"
            }`}
          >
            <Users className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">Quản lý CTV</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition ${
                ctvOpen ? "rotate-0 text-[#2D5A27]" : "-rotate-90 text-slate-400"
              }`}
            />
          </button>
          {ctvOpen ? (
            <div className="ml-2 mt-0.5 space-y-0.5 border-l border-[#e8e2d6] pl-2">
              {CTV_SUB.map(({ href, label, exact, Icon, badgeKey }) => {
                const active = exact
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);
                const n = badgeFor(badgeKey);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={linkClass(active, true)}
                    style={active ? activeNavStyle : undefined}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        active ? "!text-white" : "text-slate-400 group-hover:text-slate-700"
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {n > 0 ? (
                      <span
                        className={`ml-1 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          active
                            ? "bg-white/25 text-white"
                            : "bg-[#C62828] text-white"
                        }`}
                      >
                        {n > 99 ? "99+" : n}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <Link
          href={CUSTOMERS_HREF}
          className={linkClass(onCustomers)}
          style={onCustomers ? activeNavStyle : undefined}
        >
          <UserRound className="h-4 w-4 shrink-0" />
          Quản lý khách hàng
        </Link>

        <Link
          href="/admin/don-hang-web"
          className={linkClass(pathname.startsWith("/admin/don-hang-web"))}
          style={pathname.startsWith("/admin/don-hang-web") ? activeNavStyle : undefined}
        >
          <ShoppingBag className="h-4 w-4 shrink-0" />
          Đơn hàng web
        </Link>

        <Link
          href="/admin/website"
          className={linkClass(pathname.startsWith("/admin/website"))}
          style={pathname.startsWith("/admin/website") ? activeNavStyle : undefined}
        >
          <Globe className="h-4 w-4 shrink-0" />
          Website bán hàng
        </Link>
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setPromotionsOpen((v) => !v)}
            className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
              onPromotions
                ? "!bg-[#EAF3E8] !text-[#2D5A27] font-bold ring-1 ring-[#2D5A27]/20 [&_svg]:!text-[#2D5A27]"
                : "text-slate-600 hover:!bg-[#F0F5EE] hover:!text-slate-900 [&_svg]:text-slate-400 group-hover:[&_svg]:!text-slate-700"
            }`}
          >
            <Ticket className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">Ưu đãi & Voucher</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition ${
                promotionsOpen ? "rotate-0 text-[#2D5A27]" : "-rotate-90 text-slate-400"
              }`}
            />
          </button>
          {promotionsOpen ? (
            <div className="ml-2 mt-0.5 space-y-0.5 border-l border-[#e8e2d6] pl-2">
              {PROMOTIONS_SUB.map(({ href, tab, label, Icon }) => {
                const active = onPromotions && currentTab === tab;
                return (
                  <Link
                    key={tab}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={linkClass(active, true)}
                    style={active ? activeNavStyle : undefined}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        active ? "!text-white" : "text-slate-400 group-hover:text-slate-700"
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setRecruitmentOpen((v) => !v)}
            className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
              onRecruitment
                ? "!bg-[#EAF3E8] !text-[#2D5A27] font-bold ring-1 ring-[#2D5A27]/20 [&_svg]:!text-[#2D5A27]"
                : "text-slate-600 hover:!bg-[#F0F5EE] hover:!text-slate-900 [&_svg]:text-slate-400 group-hover:[&_svg]:!text-slate-700"
            }`}
          >
            <Briefcase className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">Tuyển dụng</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition ${
                recruitmentOpen ? "rotate-0 text-[#2D5A27]" : "-rotate-90 text-slate-400"
              }`}
            />
          </button>
          {recruitmentOpen ? (
            <div className="ml-2 mt-0.5 space-y-0.5 border-l border-[#e8e2d6] pl-2">
              {RECRUITMENT_SUB.map(({ href, label, Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={linkClass(active, true)}
                    style={active ? activeNavStyle : undefined}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "!text-white" : "text-slate-400 group-hover:text-slate-700"}`} />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <Link
          href="/admin/seo"
          className={linkClass(pathname.startsWith("/admin/seo"))}
          style={pathname.startsWith("/admin/seo") ? activeNavStyle : undefined}
        >
          <Search className="h-4 w-4 shrink-0" />
          Tối ưu SEO
        </Link>

        <Link
          href="/admin/bac-si-cay"
          className={linkClass(pathname.startsWith("/admin/bac-si-cay"))}
          style={pathname.startsWith("/admin/bac-si-cay") ? activeNavStyle : undefined}
        >
          <Sprout className="h-4 w-4 shrink-0" />
          Bác sĩ cây cảnh
        </Link>

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
      <div className="border-t border-[#eef0f3] p-3">
        <p className="truncate text-xs font-semibold text-slate-700">
          {user?.fullName || user?.username}
        </p>
        <p className="truncate text-[11px] text-slate-500">{user?.role}</p>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#e8eaed] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#2D5A27]/30 hover:bg-[#F7F8FA]"
        >
          <LogOut className="h-3.5 w-3.5" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
