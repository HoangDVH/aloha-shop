"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ShoppingCart,
  Menu,
  X,
  BadgePercent,
  Leaf,
  MapPin,
  Phone,
  Mail,
  ShoppingBag,
  LayoutGrid,
  UserRound,
  FileText,
  ChevronRight,
  Home,
  Sparkles,
  Zap,
  Building2,
  Users,
  Stethoscope,
  Briefcase,
  Gift,
  Clock,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { fetchCategoryTreeCached, shopApiBase, type ShopCategoryNavNode } from "@/lib/api";
import { HeaderSearch } from "@/components/HeaderSearch";
import { HeaderAccountMenu } from "@/components/HeaderAccountMenu";
import { CategoryMobileNav } from "@/components/CategoryNavMenu";
import { CategoryMegaMenu } from "@/components/CategoryMegaMenu";
import { RecruitmentNavDropdown } from "@/components/RecruitmentNavDropdown";
import { QuaTangNavDropdown } from "@/components/QuaTangNavDropdown";
import { FooterFacebookCard } from "@/components/footer/FooterFacebookCard";
import { FooterGoogleMap } from "@/components/footer/FooterGoogleMap";
import { applyNavConfig } from "@/lib/navConfig";
import type { NavConfig, AppearanceTheme } from "@/lib/appearanceTypes";
import { applyThemeCssVars } from "@/lib/themeCss";
import { onShopAppearanceChanged } from "@/lib/catalogSync";
import { SHOP_OPEN_MOBILE_CATS } from "@/components/ShopMobileTabBar";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
import { AnnouncementBar } from "@/components/campaign/AnnouncementBar";
import { PreviewBar } from "@/components/campaign/PreviewBar";
import { HeaderVoucherPill, HeaderVoucherGlobalModal } from "@/components/campaign/HeaderVoucherPill";
import { ZaloFloatButton } from "@/components/ZaloFloatButton";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { useDealsNavAccent } from "@/lib/campaign/navAccent";
const LOGO_HEADER_SRC = "/brand/logo-header-on-theme.png?v=1";
const LOGO_WIDTH = 976;
const LOGO_HEIGHT = 194;

const DEFAULT_FOOTER = {
  address: "90/2 Nguyễn Phúc Chu, Phường Tân Bình, Thành phố Hồ Chí Minh",
  phone: "079 490 1233",
  email: "alohathegioichaucay01@gmail.com",
  zalo: "079 490 1233",
};

const FEATURED_DEALS_HREF = "/tim?badge=noi_bat&inStock=1";

/** Menu «Ưu đãi»: có chiến dịch đang chạy → /uu-dai; không thì trang SP nổi bật như trước. */
function useDealsNavHref() {
  const { running } = useCampaignView();
  return running ? "/uu-dai" : FEATURED_DEALS_HREF;
}

function zaloHref(zalo: string) {
  const raw = String(zalo || "").trim();
  if (!raw) return "https://zalo.me/0794901233";
  if (/^https?:\/\//i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `https://zalo.me/${digits}` : "https://zalo.me/0794901233";
}

/** Logo cũ (nền xanh cứng) → bản trong suốt để nền theo màu chủ đạo. */
function resolveThemeLogoSrc(logoUrl?: string | null) {
  const raw = String(logoUrl || "").trim();
  if (!raw) return LOGO_HEADER_SRC;
  if (/logo-header\.png/i.test(raw) && !/on-theme/i.test(raw)) {
    return LOGO_HEADER_SRC;
  }
  return raw;
}

function AlohaLogo({
  onNavigate,
  logoUrl,
  siteName,
}: {
  onNavigate?: () => void;
  logoUrl?: string;
  siteName?: string;
}) {
  const src = resolveThemeLogoSrc(logoUrl);
  const title = shopBrand(siteName) || SHOP_BRAND;
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="flex max-w-[min(40vw,9.75rem)] shrink-0 items-center self-center sm:max-w-[min(52vw,280px)]"
      title={title}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className="block h-[38px] w-auto max-w-full object-contain object-left sm:h-[44px]"
        draggable={false}
      />
    </Link>
  );
}

export function SiteHeader({ categoryTree }: { categoryTree?: ShopCategoryNavNode[] }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const dealsNavHref = useDealsNavHref();
  const dealsAccent = useDealsNavAccent();
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const [tree, setTree] = useState<ShopCategoryNavNode[]>(() =>
    categoryTree?.length ? categoryTree : []
  );
  const [nav, setNav] = useState<NavConfig | null>(null);
  const [theme, setTheme] = useState<AppearanceTheme | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileNavTab, setMobileNavTab] = useState<"cats" | "pages">("cats");
  const chromeRef = useRef<HTMLElement | null>(null);

  const navActiveKey = useMemo(() => {
    if (
      pathname.startsWith("/tuyen-dung") ||
      pathname.startsWith("/tuyen-ctv") ||
      pathname === "/dang-ky-si"
    )
      return "tuyen-dung";
    if (pathname === "/bai-viet" || pathname.startsWith("/bai-viet/")) return "bai-viet";
    if (pathname === "/ve-aloha" || pathname.startsWith("/ve-aloha/")) return "ve-aloha";
    if (pathname === "/qua-tang" || pathname.startsWith("/qua-tang/")) return "qua-tang";
    if (pathname === "/bac-si-cay") return "bac-si-cay";
    if (pathname === "/uu-dai" || pathname.startsWith("/uu-dai/")) return "noi-bat-uu-dai";
    if (pathname === "/tim") {
      const sort = searchParams.get("sort") || "";
      const badge = searchParams.get("badge") || "";
      const inStock = searchParams.get("inStock") === "1";
      if (badge === "noi_bat" || (sort === "ban_chay" && inStock)) return "noi-bat-uu-dai";
      return "";
    }
    if (pathname === "/" || pathname === "") return "trang-chu";
    return "";
  }, [pathname, searchParams]);

  /** Tab bar mobile «Danh mục» → mở drawer danh mục. */
  useEffect(() => {
    const onOpen = () => {
      setMobileNavTab("cats");
      setMobileNav(true);
    };
    window.addEventListener(SHOP_OPEN_MOBILE_CATS, onOpen);
    return () => window.removeEventListener(SHOP_OPEN_MOBILE_CATS, onOpen);
  }, []);

  /** Chiều cao header+nav → banner đầy khung hình (trừ chrome). */
  useEffect(() => {
    const el = chromeRef.current;
    if (!el || typeof window === "undefined") return;
    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty("--shop-chrome-h", `${h}px`);
      }
    };
    apply();
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [mobileNav, theme?.logoUrl, theme?.siteName]);

  useEffect(() => {
    if (categoryTree?.length) setTree(categoryTree);
  }, [categoryTree]);

  useEffect(() => {
    if (tree.length > 0) return;
    let cancelled = false;
    void fetchCategoryTreeCached().then((items) => {
      if (!cancelled && items.length) setTree(items);
    });
    return () => {
      cancelled = true;
    };
  }, [tree.length]);

  useEffect(() => {
    let cancelled = false;
    const loadNav = () => {
      void fetch(`${shopApiBase()}/api/shop/appearance`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled) return;
          if (data?.nav) setNav(data.nav as NavConfig);
          if (data?.theme) {
            const t = data.theme as AppearanceTheme;
            setTheme(t);
            applyThemeCssVars(t);
          }
        })
        .catch(() => {});
    };
    loadNav();
    const unsub = onShopAppearanceChanged(() => loadNav());
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const navApplied = useMemo(() => applyNavConfig(tree, nav), [tree, nav]);

  useEffect(() => {
    if (!mobileNav) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNav]);

  const closeMenus = () => {
    setMobileNav(false);
  };

  const chromeInk = "var(--aloha-ink)";
  const chromeHover = "hover:bg-[var(--aloha-green-light)]";
  const iconClass = "text-[var(--aloha-muted)]";
  const linkTextClass = "text-[var(--aloha-ink)]";

  /** Cùng URL Zalo với nút «Đăng ký sỉ · Zalo» trên banner. */
  const wholesaleZaloUrl = zaloHref(
    theme?.footer?.zalo || theme?.footer?.phone || DEFAULT_FOOTER.zalo
  );

  return (
    <header
      ref={chromeRef}
      className="sticky top-0 z-50 shadow-sm"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <PreviewBar />
      <AnnouncementBar />
      {/* Hàng logo + search — kem ấm #FDF6E3 */}
      <div className="border-b border-[var(--aloha-border-brown)]/40 bg-[#FDF6E3]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2 sm:px-4 sm:py-2.5 md:flex-row md:items-center md:gap-4 lg:gap-5">
          {/* HÀNG 1 TRÊN MOBILE (MD+: NẰM CÙNG HÀNG BÊN TRÁI) */}
          <div className="flex w-full items-center justify-between gap-2 md:w-auto">
            <AlohaLogo
              onNavigate={closeMenus}
              logoUrl={theme?.logoUrl}
              siteName={theme?.siteName}
            />

            {/* CỤM NÚT ACTION TRÊN MOBILE (< 768px): VOUCHER + GIỎ HÀNG + MENU TIỆN ÍCH */}
            <div className="flex items-center gap-1 sm:gap-1.5 md:hidden" style={{ color: chromeInk }}>
              <HeaderVoucherPill />
              <Link
                href="/gio-hang"
                data-cart-target=""
                className={`flex h-9 w-9 items-center justify-center rounded-full text-[var(--aloha-green-dark)] ${chromeHover} transition active:scale-95`}
                onClick={closeMenus}
                aria-label={`Giỏ hàng${count ? `, ${count} sản phẩm` : ""}`}
              >
                <span className="relative inline-flex">
                  <ShoppingCart size={21} strokeWidth={1.8} aria-hidden />
                  {count > 0 ? (
                    <span className="absolute -right-2 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[var(--aloha-green)] px-1 text-[9.5px] font-black text-white shadow-xs">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </span>
              </Link>
              <button
                type="button"
                className={`flex h-9 w-9 items-center justify-center rounded-full ${linkTextClass} ${chromeHover} transition active:scale-95`}
                onClick={() => {
                  setMobileNavTab("pages");
                  setMobileNav((v) => !v);
                }}
                aria-label="Menu Khám phá & Tiện ích"
                aria-expanded={mobileNav}
              >
                {mobileNav ? <X size={21} /> : <Menu size={21} />}
              </button>
            </div>
          </div>

          {/* HÀNG 2 TRÊN MOBILE (MD+: NẰM Ở GIỮA LOGO VÀ ICON) */}
          <div className="w-full min-w-0 md:flex-1">
            <HeaderSearch onSubmitExtra={closeMenus} />
          </div>

          {/* CỤM NÚT ACTION TRÊN DESKTOP/TABLET (MD+) */}
          <div className="hidden md:flex ml-auto shrink-0 items-center gap-1 sm:gap-2" style={{ color: chromeInk }}>
            <a
              href="/dang-ky-si"
              className={`hidden min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-bold sm:inline-flex ${linkTextClass} ${chromeHover} lg:hidden`}
              aria-label="Nhận báo giá sỉ"
            >
              <BadgePercent size={18} strokeWidth={2.25} aria-hidden className={iconClass} />
              <span className="hidden sm:inline">Đăng ký sỉ</span>
            </a>
            <HeaderVoucherPill />
            <Link
              href="/gio-hang"
              data-cart-target=""
              className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-[var(--aloha-green-dark)] ${chromeHover} sm:px-3`}
              onClick={closeMenus}
              aria-label={`Giỏ hàng${count ? `, ${count} sản phẩm` : ""}`}
            >
              <span className="relative inline-flex">
                <ShoppingCart size={22} strokeWidth={1.75} aria-hidden />
                {count > 0 ? (
                  <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--aloha-green)] px-1 text-[10px] font-black text-white shadow-sm">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </span>
              <span className="hidden text-sm font-semibold sm:inline">Giỏ hàng</span>
            </Link>
            <HeaderAccountMenu />
          </div>
        </div>
      </div>

      {/* Hàng menu — Trang chủ → Danh mục → Ưu đãi */}
      <nav className="hidden overflow-visible border-b border-[var(--aloha-line)] bg-white text-[var(--aloha-ink)] lg:block shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="mx-auto flex max-w-7xl items-center overflow-visible px-3 sm:px-4 py-1.5 min-h-[50px]">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-1 xl:gap-1.5">
            {(
              [
                { href: "/", label: "Trang chủ", key: "trang-chu", kind: "link" as const },
                { kind: "mega" as const, key: "danh-muc" },
                { kind: "qua-tang" as const, key: "qua-tang" },
                {
                  href: dealsNavHref,
                  label: "Ưu đãi",
                  key: "noi-bat-uu-dai",
                  kind: "link" as const,
                },
                { href: "/bai-viet", label: "Bài viết", key: "bai-viet", kind: "link" as const },
                { href: "/bac-si-cay", label: "Bác sĩ cây", key: "bac-si-cay", kind: "link" as const },
                { href: "/ve-aloha", label: "Về Aloha", key: "ve-aloha", kind: "link" as const },
                { kind: "recruitment" as const, key: "tuyen-dung" },
              ] as const
            ).map((item) => {
              if (item.kind === "mega") {
                return (
                  <div key="danh-muc" className="flex shrink-0 items-center">
                    <CategoryMegaMenu tree={navApplied.tree} onNavigate={closeMenus} />
                  </div>
                );
              }
              if (item.kind === "qua-tang") {
                return (
                  <div key="qua-tang" className="flex shrink-0 items-center">
                    <QuaTangNavDropdown active={navActiveKey === "qua-tang"} onNavigate={closeMenus} />
                  </div>
                );
              }
              if (item.kind === "recruitment") {
                return (
                  <div key="tuyen-dung" className="flex shrink-0 items-center">
                    <RecruitmentNavDropdown active={navActiveKey === "tuyen-dung"} onNavigate={closeMenus} />
                  </div>
                );
              }
              const active = item.key === navActiveKey;
              const isDeals = item.key === "noi-bat-uu-dai";
              const dealsColor = dealsAccent.color || "#C8102E";

              if (isDeals) {
                const dealsCls = `group relative inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-[15px] xl:px-3.5 xl:text-[15.5px] rounded-xl border transition-all duration-150 select-none cursor-pointer active:scale-95 ${
                  active
                    ? "font-bold text-[#C8102E] bg-rose-50 border-rose-300 shadow-2xs ring-1 ring-rose-200"
                    : "font-semibold text-neutral-800 hover:text-[var(--aloha-green)] hover:bg-neutral-100/70 border-transparent"
                }`;
                const dealsUnderline = (
                  <span
                    className={`pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-300 ease-out ${
                      active
                        ? "w-4/5 opacity-100 shadow-xs bg-[#C8102E]"
                        : "w-0 opacity-0 group-hover:w-3/5 group-hover:opacity-80 bg-[var(--aloha-green)]"
                    }`}
                    aria-hidden
                  />
                );
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={closeMenus}
                    className={dealsCls}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="relative inline-flex items-center justify-center shrink-0">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                        className="shrink-0 transition-transform duration-200 group-hover:scale-115 group-hover:-rotate-6 drop-shadow-[0_1px_2px_rgba(234,29,44,0.35)]"
                      >
                        <defs>
                          <linearGradient id="deal-flame-grad" x1="0" y1="1" x2="0.2" y2="0">
                            <stop offset="0%" stopColor="#D32F2F" />
                            <stop offset="45%" stopColor="#FF5722" />
                            <stop offset="85%" stopColor="#FF9800" />
                            <stop offset="100%" stopColor="#FFD54F" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
                          fill="url(#deal-flame-grad)"
                        />
                      </svg>
                    </span>
                    <span>{item.label}</span>
                    <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FF3B30] to-[#E53935] px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow-2xs leading-none tracking-wider transition-transform duration-200 group-hover:scale-105">
                      HOT
                    </span>
                    <span className="sr-only">, đang có chương trình</span>
                    {dealsUnderline}
                  </Link>
                );
              }

              const cls = `group relative inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 text-[15px] xl:px-3.5 xl:text-[15.5px] rounded-xl border transition-all duration-150 select-none cursor-pointer active:scale-95 ${
                active
                  ? "font-bold text-[var(--aloha-green)] bg-emerald-50 border-emerald-200/90 shadow-2xs"
                  : "font-semibold text-neutral-800 hover:text-[var(--aloha-green)] hover:bg-neutral-100/70 border-transparent"
              }`;
              const underline = (
                <span
                  className={`pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-300 ease-out bg-[var(--aloha-green)] ${
                    active
                      ? "w-4/5 opacity-100 shadow-xs"
                      : "w-0 opacity-0 group-hover:w-3/5 group-hover:opacity-80"
                  }`}
                  aria-hidden
                />
              );
              if ("external" in item && item.external) {
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeMenus}
                    className={cls}
                  >
                    {item.label}
                    {underline}
                  </a>
                );
              }
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={closeMenus}
                  className={cls}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                  {underline}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {mobileNav ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px] transition-opacity"
            aria-label="Đóng menu"
            onClick={closeMenus}
          />
          <div className="absolute inset-x-0 bottom-0 top-0 flex min-h-0 flex-col bg-white shadow-2xl">
            {/* Header drawer có 2 tab chuyển đổi */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#eee] bg-[#fafafa] px-3 py-2.5">
              <div className="flex items-center gap-1 rounded-xl bg-slate-200/70 p-1">
                <button
                  type="button"
                  onClick={() => setMobileNavTab("cats")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    mobileNavTab === "cats"
                      ? "bg-white text-[var(--aloha-green)] shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid size={14} />
                  <span>Danh mục</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileNavTab("pages")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    mobileNavTab === "pages"
                      ? "bg-white text-[var(--aloha-green)] shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sparkles size={14} />
                  <span>Khám phá & Tiện ích</span>
                </button>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm hover:bg-slate-100"
                onClick={closeMenus}
                aria-label="Đóng"
              >
                <X size={18} strokeWidth={2.25} />
              </button>
            </div>

            {mobileNavTab === "cats" ? (
              <CategoryMobileNav tree={navApplied.tree} onNavigate={closeMenus} />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
                <div className="space-y-4">
                  <div>
                    <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Khám phá ALOHA
                    </p>
                    <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                      <Link
                        href="/"
                        onClick={closeMenus}
                        className="flex items-center justify-between p-3.5 transition-all duration-150 hover:bg-[var(--aloha-cream)]/50 active:bg-emerald-50/70 active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green)]">
                            <Home size={18} strokeWidth={2} />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-[var(--aloha-ink)]">Trang chủ</p>
                            <p className="text-xs text-slate-500">Cây cảnh, chậu cây & phụ kiện</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </Link>

                      <Link
                        href="/#goi-y-qua-tang"
                        onClick={closeMenus}
                        className="flex items-center justify-between p-3.5 transition-all duration-150 hover:bg-[var(--aloha-cream)]/50 active:bg-emerald-50/70 active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                            <Gift size={18} strokeWidth={2} />
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-[var(--aloha-ink)]">Gợi ý Quà tặng</p>
                              <span className="rounded-full bg-rose-100 text-rose-700 px-1.5 py-0.5 text-[9.5px] font-bold">
                                20/10
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">Cho nàng, gia đình, khai trương & B2B</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </Link>

                      <Link
                        href={dealsNavHref}
                        onClick={closeMenus}
                        className="flex items-center justify-between p-3.5 transition-all duration-150 hover:bg-[var(--aloha-cream)]/50 active:bg-emerald-50/70 active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green)]">
                            <BadgePercent size={18} strokeWidth={2} />
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-[var(--aloha-ink)]">Ưu đãi nổi bật</p>
                              <span className="rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-1.5 py-0.5 text-[9.5px] font-black uppercase text-white shadow-xs">
                                HOT
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">Sản phẩm giá tốt, sẵn hàng giao ngay</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </Link>

                      <Link
                        href="/bai-viet"
                        onClick={closeMenus}
                        className="flex items-center justify-between p-3.5 transition-all duration-150 hover:bg-[var(--aloha-cream)]/50 active:bg-emerald-50/70 active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green)]">
                            <FileText size={18} strokeWidth={2} />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-[var(--aloha-ink)]">Bài viết & Cẩm nang</p>
                            <p className="text-xs text-slate-500">Mẹo chăm sóc cây, phối chậu đẹp</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </Link>

                      <Link href="/bac-si-cay" onClick={closeMenus} className="flex items-center justify-between p-3.5 transition-all duration-150 hover:bg-[var(--aloha-cream)]/50 active:bg-emerald-50/70 active:scale-[0.98]">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green)]"><Stethoscope size={18} strokeWidth={2} /></span>
                          <div>
                            <p className="text-sm font-bold text-[var(--aloha-ink)]">Bác sĩ cây cảnh</p>
                            <p className="text-xs text-slate-500">Chụp ảnh cây bệnh, AI bắt bệnh miễn phí</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </Link>

                      <Link
                        href="/ve-aloha"
                        onClick={closeMenus}
                        className="flex items-center justify-between p-3.5 transition-all duration-150 hover:bg-[var(--aloha-cream)]/50 active:bg-emerald-50/70 active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                            <Leaf size={18} strokeWidth={2} />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-[var(--aloha-ink)]">Về ALOHA</p>
                            <p className="text-xs text-slate-500">Quà tặng xanh độc bản, xưởng sản xuất & câu chuyện</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </Link>
                    </div>
                  </div>

                  <div>
                    <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Tuyển dụng & Hợp tác
                    </p>
                    <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                      {(
                        [
                          { href: "/tuyen-dung", label: "Tuyển dụng nhân viên", badge: "Việc làm", sub: "Cơ hội việc làm & gia nhập đội ngũ Aloha", icon: Briefcase },
                          { href: "/tuyen-ctv", label: "Tuyển Cộng tác viên (CTV)", badge: "CTV", sub: "Kiếm thêm thu nhập hoa hồng cùng Aloha", icon: Users },
                          { href: "/dang-ky-si", label: "Đăng ký mua sỉ (B2B)", badge: "Đại lý", sub: "Chính sách chiết khấu & giá sỉ đặc quyền", icon: Building2 },
                        ] as const
                      ).map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMenus}
                          className="flex items-center justify-between p-3.5 transition hover:bg-[var(--aloha-cream)]/50 active:bg-[var(--aloha-cream)]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green)]">
                              <item.icon size={18} strokeWidth={2} />
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-bold text-[var(--aloha-ink)]">{item.label}</p>
                                <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[9.5px] font-bold text-stone-600">
                                  {item.badge}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">{item.sub}</p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-slate-300" />
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Hỗ trợ trực tiếp 24/7
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2.5">
                      <a
                        href={`tel:${theme?.footer?.phone || DEFAULT_FOOTER.phone}`}
                        className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700 transition hover:bg-slate-100"
                      >
                        <Phone size={16} className="text-[var(--aloha-green)]" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold">Hotline</p>
                          <p className="truncate text-xs font-bold text-[var(--aloha-ink)]">
                            {theme?.footer?.phone || DEFAULT_FOOTER.phone}
                          </p>
                        </div>
                      </a>
                      <a
                        href={wholesaleZaloUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-blue-900 transition hover:bg-blue-100/50"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
                          Z
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold">Chat Zalo</p>
                          <p className="truncate text-xs font-bold text-blue-700">Tư vấn ngay</p>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
      <HeaderVoucherGlobalModal />
    </header>
  );
}

export function SiteFooter() {
  const pathname = usePathname() || "";
  const [theme, setTheme] = useState<AppearanceTheme | null>(null);
  const dealsNavHref = useDealsNavHref();

  useEffect(() => {
    if (pathname.startsWith("/bac-si-cay")) return;
    let cancelled = false;
    const load = () => {
      void fetch(`${shopApiBase()}/api/shop/appearance`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled) return;
          if (data?.theme) {
            const t = data.theme as AppearanceTheme;
            setTheme(t);
            applyThemeCssVars(t);
          }
        })
        .catch(() => {});
    };
    load();
    const unsub = onShopAppearanceChanged(() => load());
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const siteName = shopBrand(theme?.siteName) || SHOP_BRAND;
  const footer = {
    address: theme?.footer?.address?.trim() || DEFAULT_FOOTER.address,
    phone: theme?.footer?.phone?.trim() || DEFAULT_FOOTER.phone,
    email: theme?.footer?.email?.trim() || DEFAULT_FOOTER.email,
    zalo: theme?.footer?.zalo?.trim() || DEFAULT_FOOTER.zalo,
  };

  if (pathname.startsWith("/bac-si-cay")) {
    return null;
  }

  return (
    <>
    <ZaloFloatButton href={zaloHref(footer.zalo || footer.phone)} />
    <footer
      id="ve-chung-toi"
      className="relative isolate mt-12 overflow-hidden border-t border-[#deddbd] bg-[#FAF8F5] text-stone-800 md:mt-16"
    >
      {/* Họa tiết lá tự nhiên phía sau mờ nhẹ thanh lịch */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/leaves-bl.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={240}
        height={240}
        className="pointer-events-none absolute bottom-0 left-0 -z-10 w-28 opacity-15 sm:w-44 lg:w-56 lg:opacity-25"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/leaves-br.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={240}
        height={240}
        className="pointer-events-none absolute bottom-0 right-0 -z-10 w-28 opacity-15 sm:w-44 lg:w-56 lg:opacity-25"
      />

      {/* Lưới 4 cột phẳng liền mạch (Seamless 4-Column Grid) chuẩn quốc tế */}
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* CỘT 1 (lg:col-span-4): THƯƠNG HIỆU & PHÁP LÝ DOANH NGHIỆP */}
          <div className="lg:col-span-4 flex flex-col justify-between">
            <div>
              <Link href="/" aria-label={`${siteName} — Trang chủ`} className="inline-block text-[#0E5242]">
                <span className="flex items-start gap-1.5 font-serif text-3xl font-semibold leading-none tracking-[0.03em] sm:text-4xl text-[#0E5242]">
                  ALOHA<Leaf size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[var(--aloha-green)]" aria-hidden />
                </span>
                <span className="mt-2 block text-xs font-bold tracking-[0.18em] text-stone-600">THẾ GIỚI CHẬU CÂY</span>
              </Link>

              <p className="mt-3.5 text-xs sm:text-[13px] leading-relaxed text-stone-600 max-w-sm">
                Xưởng sản xuất chậu cây &amp; vườn ươm cây cảnh thuần dưỡng. Kiến tạo không gian sống trong lành, thẩm mỹ cho gia đình &amp; văn phòng Việt.
              </p>

              {/* Thông tin liên hệ nhanh dạng list icon mảnh thanh lịch */}
              <div className="mt-5 space-y-2.5 text-xs sm:text-[13px] text-stone-700">
                <div className="flex items-start gap-2.5">
                  <MapPin size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--aloha-green)]" aria-hidden />
                  <span className="leading-snug">{footer.address}</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <Phone size={15} strokeWidth={2} className="shrink-0 text-[var(--aloha-green)]" aria-hidden />
                  <span className="text-stone-500">Hotline:</span>
                  <a
                    href={zaloHref(footer.zalo || footer.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#0E5242] hover:underline"
                  >
                    {footer.phone || footer.zalo} (Zalo)
                  </a>
                </div>

                <div className="flex items-center gap-2.5">
                  <Clock size={15} strokeWidth={2} className="shrink-0 text-[var(--aloha-green)]" aria-hidden />
                  <span className="text-stone-500">Mở cửa:</span>
                  <span>08:00 – 18:30 (Thứ 2 – Chủ Nhật)</span>
                </div>

                {footer.email && (
                  <div className="flex items-center gap-2.5">
                    <Mail size={15} strokeWidth={2} className="shrink-0 text-[var(--aloha-green)]" aria-hidden />
                    <span className="text-stone-500">Email:</span>
                    <a href={`mailto:${footer.email}`} className="truncate hover:underline text-stone-700">
                      {footer.email}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Thông tin pháp lý GPKD gom gọn tại đáy Cột 1 */}
            <div className="mt-6 pt-4 border-t border-stone-200/80 text-[11.5px] text-stone-500 leading-relaxed">
              <p className="font-semibold text-stone-700 uppercase">HỘ KINH DOANH ALOHA</p>
              <p className="mt-0.5">GPKD: 41N8043688 • UBND Q.Tân Bình, TP.HCM cấp</p>
            </div>
          </div>

          {/* CỘT 2 (lg:col-span-2): KHÁM PHÁ & QUÀ TẶNG */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 pb-2.5 border-b border-stone-200/80">
              Khám phá &amp; Quà tặng
            </h3>
            <ul className="mt-3.5 space-y-2 text-xs sm:text-[13px]">
              <li>
                <Link href="/qua-tang/doanh-nghiep" className="text-stone-600 hover:text-[var(--aloha-green)] transition-colors block py-0.5">
                  Quà tặng doanh nghiệp (B2B)
                </Link>
              </li>
              <li>
                <Link href="/qua-tang" className="text-stone-600 hover:text-[var(--aloha-green)] transition-colors block py-0.5">
                  Bộ sưu tập quà tặng độc bản
                </Link>
              </li>
              <li>
                <Link href="/ve-aloha" className="text-stone-600 hover:text-[var(--aloha-green)] transition-colors block py-0.5">
                  Về Aloha &amp; Tầm nhìn xanh
                </Link>
              </li>
              <li>
                <Link href="/ve-aloha#nang-luc-cung-ung" className="text-stone-600 hover:text-[var(--aloha-green)] transition-colors block py-0.5">
                  Dự án &amp; Xưởng sản xuất
                </Link>
              </li>
              <li>
                <Link href="/bac-si-cay" className="text-stone-600 hover:text-[var(--aloha-green)] transition-colors block py-0.5">
                  Bác sĩ cây cảnh AI (Cẩm nang)
                </Link>
              </li>
              <li>
                <Link href="/bai-viet" className="text-stone-600 hover:text-[var(--aloha-green)] transition-colors block py-0.5">
                  Tin tức &amp; Kinh nghiệm làm vườn
                </Link>
              </li>
            </ul>
          </div>

          {/* CỘT 3 (lg:col-span-3): CHÍNH SÁCH & HỖ TRỢ */}
          <div className="lg:col-span-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 pb-2.5 border-b border-stone-200/80">
              Chính sách &amp; Hỗ trợ
            </h3>
            <ul className="mt-3.5 space-y-2 text-xs sm:text-[13px]">
              <li>
                <Link href="/ve-aloha#gia-tri-cot-loi" className="text-stone-600 hover:text-[var(--aloha-green)] transition-colors block py-0.5">
                  Cam kết bảo hành &amp; đổi trả cây
                </Link>
              </li>
              <li>
                <Link href="/ve-aloha#nang-luc-cung-ung" className="text-stone-600 hover:text-[var(--aloha-green)] transition-colors block py-0.5">
                  Quy trình đóng gói &amp; giao an toàn
                </Link>
              </li>
              <li>
                <Link href={dealsNavHref} className="text-stone-600 hover:text-[var(--aloha-green)] transition-colors block py-0.5">
                  Kho voucher &amp; Ưu đãi tháng
                </Link>
              </li>
              <li>
                <a
                  href={zaloHref(footer.zalo || footer.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-600 hover:text-[var(--aloha-green)] transition-colors block py-0.5"
                >
                  Báo giá sỉ cho công ty &amp; dự án
                </a>
              </li>
            </ul>

            <div className="mt-5 rounded-2xl bg-emerald-50/70 border border-emerald-800/10 p-3 text-[11.5px] text-emerald-950 leading-relaxed">
              <span className="font-bold text-emerald-900">Hỗ trợ doanh nghiệp:</span> Cung cấp hóa đơn VAT hợp lệ, hợp đồng &amp; chiết khấu quà tặng sự kiện.
            </div>
          </div>

          {/* CỘT 4 (lg:col-span-3): SHOWROOM & KẾT NỐI */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 pb-2.5 border-b border-stone-200/80">
              Showroom &amp; Kết nối
            </h3>

            {/* Bản đồ Google Maps tinh gọn */}
            <FooterGoogleMap
              address={footer.address}
              directMapUrl="https://www.google.com/maps/search/?api=1&query=Aloha+Th%E1%BA%BF+Gi%E1%BB%9Bi+Ch%E1%BA%ADu+C%C3%A2y,+90/2+Nguy%E1%BB%85n+Ph%C3%BAc+Chu,+T%C3%A2n+B%C3%ACnh"
            />

            {/* Fanpage Facebook thẻ tinh gọn */}
            <FooterFacebookCard
              pageUrl="https://www.facebook.com/share/19iQ1PMqpx/?mibextid=wwXIfr"
              pageName="Aloha Thế Giới Chậu Cây"
            />
          </div>
        </div>
      </div>

      {/* TẦNG ĐÁY (Bottom Bar): Bản quyền & Mạng xã hội */}
      <div className="border-t border-stone-200/80 bg-white/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-center text-xs text-stone-500 sm:text-left">
            © {new Date().getFullYear()} {siteName}. Xưởng sản xuất chậu cây &amp; cây cảnh phong thủy.
          </p>

          <div className="flex items-center gap-4 text-xs font-medium text-stone-600">
            <a
              href="https://www.facebook.com/share/19iQ1PMqpx/?mibextid=wwXIfr"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#1877F2] transition-colors"
            >
              Facebook
            </a>
            <span className="text-stone-300">•</span>
            <a
              href={zaloHref(footer.zalo || footer.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--aloha-green)] transition-colors"
            >
              Zalo OA
            </a>
            <span className="text-stone-300">•</span>
            <Link href="/ve-aloha" className="hover:text-[var(--aloha-green)] transition-colors">
              Về Aloha
            </Link>
          </div>
        </div>
      </div>
    </footer>
    </>
  );
}
