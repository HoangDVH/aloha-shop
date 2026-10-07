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
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { fetchCategoryTreeCached, shopApiBase, type ShopCategoryNavNode } from "@/lib/api";
import { HeaderSearch } from "@/components/HeaderSearch";
import { HeaderAccountMenu } from "@/components/HeaderAccountMenu";
import { CategoryMobileNav } from "@/components/CategoryNavMenu";
import { CategoryMegaMenu } from "@/components/CategoryMegaMenu";
import { RecruitmentNavDropdown } from "@/components/RecruitmentNavDropdown";
import { applyNavConfig } from "@/lib/navConfig";
import type { NavConfig, AppearanceTheme } from "@/lib/appearanceTypes";
import { applyThemeCssVars } from "@/lib/themeCss";
import { onShopAppearanceChanged } from "@/lib/catalogSync";
import { SHOP_OPEN_MOBILE_CATS } from "@/components/ShopMobileTabBar";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
import { AnnouncementBar } from "@/components/campaign/AnnouncementBar";
import { PreviewBar } from "@/components/campaign/PreviewBar";
import { HeaderVoucherPill } from "@/components/campaign/HeaderVoucherPill";
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
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green)]">
                            <Leaf size={18} strokeWidth={2} />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-[var(--aloha-ink)]">Về ALOHA</p>
                            <p className="text-xs text-slate-500">Thế giới chậu cây & câu chuyện thương hiệu</p>
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
      className="relative isolate mt-10 overflow-hidden border-t border-[#e7dfc7] bg-[#FDF6E3] text-[#284d32] md:mt-14"
    >
      {/* Decorative leaves stay behind the content and never intercept links. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/decor/leaves-bl.png" alt="" aria-hidden="true" loading="lazy" width={240} height={240}
        className="pointer-events-none absolute bottom-0 left-0 -z-10 w-28 opacity-20 sm:w-44 lg:w-60 lg:opacity-35" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/decor/leaves-br.png" alt="" aria-hidden="true" loading="lazy" width={240} height={240}
        className="pointer-events-none absolute bottom-0 right-0 -z-10 w-28 opacity-20 sm:w-44 lg:w-60 lg:opacity-35" />
      <div className="mx-auto grid max-w-7xl gap-4 px-4 pb-7 pt-10 sm:grid-cols-2 sm:px-6 sm:pt-14 lg:grid-cols-[1.15fr_1fr_1fr] lg:gap-5">
        <section aria-label="Thương hiệu và địa chỉ" className="min-w-0 rounded-3xl border border-white/60 bg-white/45 p-6 sm:col-span-2 sm:p-8 lg:col-span-1">
          <Link href="/" aria-label={`${siteName} — Trang chủ`} className="inline-block rounded-lg text-[#284d32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-800">
            <span className="flex items-start gap-1.5 font-serif text-5xl font-semibold leading-none tracking-[0.04em] sm:text-6xl">
              ALOHA<Leaf size={23} strokeWidth={1.6} className="mt-0.5 shrink-0" aria-hidden />
            </span>
            <span className="mt-3 block text-xs font-medium tracking-[0.17em] sm:text-sm">THẾ GIỚI CHẬU CÂY</span>
          </Link>
          <address className="mt-7 flex items-start gap-3 text-sm not-italic leading-7 text-stone-600">
            <MapPin size={23} strokeWidth={1.7} className="mt-0.5 shrink-0 text-[#456a43]" aria-hidden />
            <span>{footer.address}</span>
          </address>
        </section>
        <section aria-labelledby="footer-contact-title" className="min-w-0 rounded-3xl border border-white/60 bg-white/45 p-6 sm:p-8">
          <h2 id="footer-contact-title" className="flex items-center gap-3 text-xl font-bold">
            <Leaf size={25} strokeWidth={1.7} aria-hidden />Liên hệ
          </h2>
          <div className="ml-9 mt-3 h-0.5 w-11 bg-[#d8dfbf]" />
          <div className="mt-6 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e9ecd5]"><Phone size={23} strokeWidth={1.7} aria-hidden /></span>
            <div className="min-w-0">
              <p className="text-sm text-stone-600">Zalo / Điện thoại:</p>
              <a href={zaloHref(footer.zalo || footer.phone)} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-lg font-semibold text-[#2e7139] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                {footer.phone || footer.zalo}
              </a>
            </div>
          </div>
          {footer.email && (
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e9ecd5]"><Mail size={23} strokeWidth={1.7} aria-hidden /></span>
              <a href={`mailto:${footer.email}`} className="flex min-h-11 min-w-0 items-center break-all text-sm font-semibold text-[#2e7139] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                {footer.email}
              </a>
            </div>
          )}
        </section>
        <nav aria-labelledby="footer-shopping-title" className="min-w-0 rounded-3xl border border-white/60 bg-white/45 p-6 sm:p-8">
          <h2 id="footer-shopping-title" className="flex items-center gap-3 text-xl font-bold">
            <ShoppingBag size={25} strokeWidth={1.7} aria-hidden />Mua sắm
          </h2>
          <div className="ml-9 mt-3 h-0.5 w-11 bg-[#d8dfbf]" />
          <ul className="mt-4 divide-y divide-[#e7dfc7]/60">
            {[
              { href: "/tim", label: "Tất cả sản phẩm", icon: LayoutGrid },
              { href: dealsNavHref, label: "Ưu đãi", icon: BadgePercent },
              { href: "/ve-aloha", label: "Về Aloha", icon: UserRound },
              { href: "/bai-viet", label: "Bài viết", icon: FileText },
              { href: "/bac-si-cay", label: "Bác sĩ cây cảnh", icon: Stethoscope },
              { href: "/tuyen-dung", label: "Tuyển dụng", icon: Briefcase },
            ].map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="group flex min-h-12 items-center gap-3 rounded-md py-2 text-sm text-stone-600 transition hover:text-[#2e7139] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800">
                  <Icon size={21} strokeWidth={1.7} className="shrink-0 text-[#456a43]" aria-hidden />
                  <span>{label}</span>
                  <ChevronRight size={17} className="ml-auto shrink-0 text-[#65845a] transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-7 sm:px-6">
        <div className="flex items-center gap-5" aria-hidden="true">
          <span className="h-px flex-1 bg-[#deddbd]" /><Leaf size={23} strokeWidth={1.6} className="text-[#789461]" /><span className="h-px flex-1 bg-[#deddbd]" />
        </div>
        <p className="mt-3 text-center text-xs leading-6 text-stone-600">© {new Date().getFullYear()} {siteName}</p>
      </div>
    </footer>
    </>
  );
}
