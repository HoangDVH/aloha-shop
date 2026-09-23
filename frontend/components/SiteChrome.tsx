"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ShoppingCart,
  Menu,
  X,
  BadgePercent,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { fetchCategoryTreeCached, shopApiBase, type ShopCategoryNavNode } from "@/lib/api";
import { HeaderSearch } from "@/components/HeaderSearch";
import { HeaderAccountMenu } from "@/components/HeaderAccountMenu";
import { CategoryMobileNav } from "@/components/CategoryNavMenu";
import { CategoryMegaMenu } from "@/components/CategoryMegaMenu";
import { applyNavConfig } from "@/lib/navConfig";
import type { NavConfig, AppearanceTheme } from "@/lib/appearanceTypes";
import { applyThemeCssVars } from "@/lib/themeCss";
import { onShopAppearanceChanged } from "@/lib/catalogSync";
import { SHOP_OPEN_MOBILE_CATS } from "@/components/ShopMobileTabBar";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
const LOGO_HEADER_SRC = "/brand/logo-header-on-theme.png?v=1";
const LOGO_WIDTH = 976;
const LOGO_HEIGHT = 194;

const DEFAULT_FOOTER = {
  address: "90/2 Nguyễn Phúc Chu, Phường Tân Bình, Thành phố Hồ Chí Minh",
  phone: "079 490 1233",
  email: "alohathegioichaucay01@gmail.com",
  zalo: "079 490 1233",
};

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
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const [tree, setTree] = useState<ShopCategoryNavNode[]>(() =>
    categoryTree?.length ? categoryTree : []
  );
  const [nav, setNav] = useState<NavConfig | null>(null);
  const [theme, setTheme] = useState<AppearanceTheme | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const chromeRef = useRef<HTMLElement | null>(null);

  const navActiveKey = useMemo(() => {
    if (pathname === "/tuyen-ctv" || pathname.startsWith("/tuyen-ctv/")) return "tuyen-ctv";
    if (pathname === "/bai-viet" || pathname.startsWith("/bai-viet/")) return "bai-viet";
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
    const onOpen = () => setMobileNav(true);
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
      {/* Hàng logo + search — kem ấm #FDF6E3 */}
      <div className="border-b border-[var(--aloha-border-brown)]/40 bg-[#FDF6E3]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:gap-x-3 sm:px-4 sm:py-2.5 lg:flex-nowrap lg:gap-5">
          <AlohaLogo
            onNavigate={closeMenus}
            logoUrl={theme?.logoUrl}
            siteName={theme?.siteName}
          />

          {/* Mobile/tablet: hàng riêng full ngang (kiểu Shopee/Tiki). Desktop: giữa logo và icon. */}
          <div className="order-last w-full basis-full lg:order-none lg:min-w-0 lg:flex-1 lg:basis-auto">
            <HeaderSearch onSubmitExtra={closeMenus} />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2" style={{ color: chromeInk }}>
            <a
              href="/dang-ky-si"
              className={`hidden min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-bold sm:inline-flex ${linkTextClass} ${chromeHover} lg:hidden`}
              aria-label="Nhận báo giá sỉ"
            >
              <BadgePercent size={18} strokeWidth={2.25} aria-hidden className={iconClass} />
              <span className="hidden sm:inline">Đăng ký sỉ</span>
            </a>
            <Link
              href="/gio-hang"
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
            <button
              type="button"
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl ${linkTextClass} ${chromeHover} lg:hidden`}
              onClick={() => setMobileNav((v) => !v)}
              aria-label="Menu"
              aria-expanded={mobileNav}
            >
              {mobileNav ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Hàng menu — Trang chủ → Danh mục → Ưu đãi */}
      <nav className="hidden overflow-visible border-b border-[var(--aloha-line)] bg-white text-[var(--aloha-ink)] lg:block">
        <div className="mx-auto flex max-w-7xl items-stretch overflow-visible px-3 sm:px-4">
          <div className="flex min-w-0 flex-1 items-stretch justify-between gap-0.5 xl:gap-1">
            {(
              [
                { href: "/", label: "Trang chủ", key: "trang-chu", kind: "link" as const },
                { kind: "mega" as const, key: "danh-muc" },
                {
                  href: "/tim?badge=noi_bat&inStock=1",
                  label: "Ưu đãi",
                  key: "noi-bat-uu-dai",
                  kind: "link" as const,
                },
                { href: "/bai-viet", label: "Bài viết", key: "bai-viet", kind: "link" as const },
                {
                  href: "/dang-ky-si",
                  label: "Đăng ký sỉ",
                  key: "bao-gia",
                  kind: "link" as const,
                },
                {
                  href: "/tuyen-ctv",
                  label: "Tuyển CTV",
                  key: "tuyen-ctv",
                  kind: "link" as const,
                },
              ] as const
            ).map((item) => {
              if (item.kind === "mega") {
                return (
                  <div
                    key="danh-muc"
                    className="flex shrink-0 items-stretch"
                  >
                    <CategoryMegaMenu tree={navApplied.tree} onNavigate={closeMenus} />
                  </div>
                );
              }
              const active = item.key === navActiveKey;
              const cls = `group relative inline-flex h-full shrink-0 items-center justify-center whitespace-nowrap px-2 text-[15px] xl:px-2.5 xl:text-[16px] ${
                active
                  ? "font-bold text-[var(--aloha-green)]"
                  : "font-semibold text-[var(--aloha-ink)] hover:text-[var(--aloha-green)]"
              }`;
              const underline = (
                <span
                  className={`pointer-events-none absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-[var(--aloha-green)] transition-opacity ${
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
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
            className="absolute inset-0 bg-black/45"
            aria-label="Đóng menu"
            onClick={closeMenus}
          />
          <div className="absolute inset-0 flex flex-col bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[#eee] px-4 py-3">
              <span className="text-[15px] font-bold text-[#222]">Danh mục sản phẩm</span>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f3f4f6] text-[#666] hover:bg-[#e8e8e8]"
                onClick={closeMenus}
                aria-label="Đóng"
              >
                <X size={18} strokeWidth={2.25} />
              </button>
            </div>

            <CategoryMobileNav tree={navApplied.tree} onNavigate={closeMenus} />
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  const [theme, setTheme] = useState<AppearanceTheme | null>(null);

  useEffect(() => {
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

  return (
    <footer
      id="ve-chung-toi"
      className="mt-10 border-t border-[var(--aloha-border-brown)]/40 bg-[#FDF6E3] text-[var(--aloha-ink)] md:mt-14"
    >
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-2 sm:gap-8 sm:py-10 lg:grid-cols-3">
        <div>
          <div className="text-base font-bold text-[var(--aloha-ink)]">{siteName}</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--aloha-muted)]">{footer.address}</p>
        </div>
        <div className="text-sm">
          <div className="font-bold text-[var(--aloha-ink)]">Liên hệ</div>
          <p className="mt-2 text-[var(--aloha-muted)]">
            Zalo / Điện thoại:{" "}
            <a
              href={zaloHref(footer.zalo || footer.phone)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center font-semibold text-[var(--aloha-green)] underline-offset-2 hover:text-[var(--aloha-green-hover)] hover:underline"
            >
              {footer.phone || footer.zalo}
            </a>
          </p>
          {footer.email ? (
            <p className="mt-1 text-[var(--aloha-muted)]">
              <a
                href={`mailto:${footer.email}`}
                className="inline-flex min-h-10 items-center font-semibold text-[var(--aloha-green)] underline-offset-2 hover:text-[var(--aloha-green-hover)] hover:underline"
              >
                {footer.email}
              </a>
            </p>
          ) : null}
        </div>
        <div className="text-sm text-[var(--aloha-muted)]">
          <div className="font-bold text-[var(--aloha-ink)]">Mua sắm</div>
          <div className="mt-2 flex flex-col">
            <Link
              href="/tim"
              className="inline-flex min-h-10 items-center py-1 hover:text-[var(--aloha-green)]"
            >
              Tất cả sản phẩm
            </Link>
            <Link
              href="/tim?badge=noi_bat&inStock=1"
              className="inline-flex min-h-10 items-center py-1 hover:text-[var(--aloha-green)]"
            >
              Ưu đãi
            </Link>
            <Link
              href="/ve-aloha"
              className="inline-flex min-h-10 items-center py-1 hover:text-[var(--aloha-green)]"
            >
              Về Aloha
            </Link>
            <Link
              href="/bai-viet"
              className="inline-flex min-h-10 items-center py-1 hover:text-[var(--aloha-green)]"
            >
              Bài viết
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--aloha-border-brown)]/40 px-4 py-4 text-center text-[11px] text-[var(--aloha-muted)]">
        © {new Date().getFullYear()} {siteName}
      </div>
    </footer>
  );
}
