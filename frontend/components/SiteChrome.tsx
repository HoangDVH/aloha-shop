"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingBasket, Menu, X, LogOut, Receipt, BadgePercent } from "lucide-react";
import { useCart } from "@/lib/cart";
import { fetchCategoryTreeCached, shopApiBase, type ShopCategoryNavNode } from "@/lib/api";
import { HeaderSearch } from "@/components/HeaderSearch";
import { HeaderAccountMenu } from "@/components/HeaderAccountMenu";
import { AccountAvatar } from "@/components/AccountAvatar";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { CategoryMobileNav, CategoryNavBar } from "@/components/CategoryNavMenu";
import { useShopLoginHref } from "@/lib/useShopLoginHref";
import { useShopLogoutAction } from "@/lib/useShopLogoutAction";
import { applyNavConfig } from "@/lib/navConfig";
import type { NavConfig, AppearanceTheme } from "@/lib/appearanceTypes";
import { applyThemeCssVars } from "@/lib/themeCss";
const LOGO_HEADER_SRC = "/brand/logo-header-on-theme.png?v=1";
const LOGO_WIDTH = 976;
const LOGO_HEIGHT = 194;
const DEFAULT_PRIMARY = "#16C45A";

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
  const title = siteName || "ALOHA Thế Giới Chậu Cây";
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="flex max-w-[min(52vw,280px)] shrink-0 items-center self-center"
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
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const { user } = useShopAuth();
  const loginHref = useShopLoginHref();
  const { logout, isPending: logoutPending } = useShopLogoutAction();
  const [tree, setTree] = useState<ShopCategoryNavNode[]>(() =>
    categoryTree?.length ? categoryTree : []
  );
  const [nav, setNav] = useState<NavConfig | null>(null);
  const [theme, setTheme] = useState<AppearanceTheme | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const chromeRef = useRef<HTMLElement | null>(null);

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
    let unsub = () => {};
    void import("@/lib/catalogSync").then(({ onShopAppearanceChanged }) => {
      if (cancelled) return;
      unsub = onShopAppearanceChanged(() => loadNav());
    });
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

  const headerBg = "var(--aloha-header)";
  const headerBorder = "rgba(255,255,255,0.14)";
  const chromeInk = "#FFFFFF";
  const chromeHover = "hover:bg-white/15";

  /** Cùng URL Zalo với nút «Báo giá sỉ · Zalo» trên banner. */
  const wholesaleZaloUrl = zaloHref(
    theme?.footer?.zalo || theme?.footer?.phone || DEFAULT_FOOTER.zalo
  );

  return (
    <header
      ref={chromeRef}
      className="sticky top-0 z-50 shadow-sm"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="border-b" style={{ background: headerBg, borderColor: headerBorder }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 lg:gap-5">
          <AlohaLogo
            onNavigate={closeMenus}
            logoUrl={theme?.logoUrl}
            siteName={theme?.siteName}
          />

          <div className="order-3 flex w-full flex-1 items-stretch sm:order-none sm:min-w-[220px]">
            <HeaderSearch onSubmitExtra={closeMenus} />
          </div>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-2" style={{ color: chromeInk }}>
            <a
              href={wholesaleZaloUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-bold text-white ${chromeHover} lg:hidden`}
              aria-label="Nhận báo giá sỉ"
            >
              <BadgePercent size={18} strokeWidth={2.25} aria-hidden className="text-[var(--aloha-cream)]" />
              <span className="hidden sm:inline">Báo giá sỉ</span>
            </a>
            <HeaderAccountMenu />
            <Link
              href="/gio-hang"
              className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-2 text-white ${chromeHover} sm:min-w-0 sm:px-3`}
              onClick={closeMenus}
              aria-label={`Giỏ hàng${count ? `, ${count} sản phẩm` : ""}`}
            >
              <span className="relative inline-flex">
                <ShoppingBasket size={22} className="text-white" />
                {count > 0 ? (
                  <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--aloha-gold)] px-1 text-[10px] font-black text-[var(--aloha-ink)] shadow-sm">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </span>
              <span className="hidden text-sm font-semibold sm:inline">Giỏ hàng</span>
            </Link>
            <button
              type="button"
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white ${chromeHover} lg:hidden`}
              onClick={() => setMobileNav((v) => !v)}
              aria-label="Menu"
              aria-expanded={mobileNav}
            >
              {mobileNav ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      <nav className="hidden overflow-visible border-b border-[var(--aloha-line)] bg-[var(--aloha-cream)] text-[var(--aloha-ink)] lg:block">
        <div className="mx-auto flex max-w-7xl items-stretch overflow-visible px-1 sm:px-2">
          <div className="hidden min-w-0 flex-1 items-stretch lg:flex">
            {navApplied.before.map((c) => (
              <a
                key={c.id}
                href={c.href}
                target={c.openInNewTab ? "_blank" : undefined}
                rel={c.openInNewTab ? "noopener noreferrer" : undefined}
                onClick={closeMenus}
                className="group relative inline-flex shrink-0 items-center px-2.5 text-[13px] font-semibold text-[var(--aloha-ink)] hover:text-[var(--aloha-green)]"
              >
                {c.label}
                <span
                  className="pointer-events-none absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-[var(--aloha-green)] opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </a>
            ))}
            <CategoryNavBar
              tree={navApplied.tree}
              onNavigate={closeMenus}
              className="flex min-w-0 flex-1"
            />
            {navApplied.after.map((c) => (
              <a
                key={c.id}
                href={c.href}
                target={c.openInNewTab ? "_blank" : undefined}
                rel={c.openInNewTab ? "noopener noreferrer" : undefined}
                onClick={closeMenus}
                className="group relative inline-flex shrink-0 items-center px-2.5 text-[13px] font-semibold text-[var(--aloha-ink)] hover:text-[var(--aloha-green)]"
              >
                {c.label}
                <span
                  className="pointer-events-none absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-[var(--aloha-green)] opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </a>
            ))}
          </div>
          <a
            href={wholesaleZaloUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="my-2 ml-2 hidden shrink-0 items-center gap-1.5 self-center rounded-full bg-[var(--aloha-green)] px-3 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--aloha-green-hover)] xl:inline-flex"
          >
            <BadgePercent size={16} strokeWidth={2.25} aria-hidden />
            Nhận báo giá sỉ
          </a>
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
          <div className="absolute inset-y-0 left-0 flex w-[min(88vw,360px)] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--aloha-line)] px-4 py-3">
              <span className="text-sm font-extrabold text-[var(--aloha-ink)]">Danh mục</span>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-[var(--aloha-cream)]"
                onClick={closeMenus}
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {user ? (
                <div className="mb-3 space-y-2">
                  <Link
                    href="/tai-khoan"
                    onClick={closeMenus}
                    className="flex items-center gap-3 rounded-xl bg-[var(--aloha-green-light)] px-3 py-2.5"
                  >
                    <AccountAvatar user={user} size={36} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-[var(--aloha-ink)]">
                        {user.fullName || "Tài khoản"}
                      </div>
                      <div className="truncate text-xs text-slate-500">{user.email}</div>
                    </div>
                  </Link>
                  <Link
                    href="/tai-khoan?tab=don-mua"
                    onClick={closeMenus}
                    className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--aloha-cream)]"
                  >
                    <Receipt size={18} className="text-[var(--aloha-green)]" />
                    Đơn mua
                  </Link>
                  <button
                    type="button"
                    disabled={logoutPending}
                    onClick={() => {
                      closeMenus();
                      logout();
                    }}
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-[#fff1f0] hover:text-red-600"
                  >
                    <LogOut size={18} />
                    Đăng xuất
                  </button>
                </div>
              ) : (
                <Link
                  href={loginHref}
                  onClick={closeMenus}
                  className="mb-3 flex min-h-11 items-center rounded-xl bg-[var(--aloha-green-light)] px-3 py-2.5 text-sm font-bold text-[var(--aloha-green)]"
                >
                  Đăng nhập
                </Link>
              )}
              <a
                href={wholesaleZaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenus}
                className="mb-3 flex min-h-11 w-full items-center gap-2 rounded-xl bg-[var(--aloha-green)] px-3 py-2.5 text-sm font-bold text-white"
              >
                <BadgePercent size={18} strokeWidth={2.25} aria-hidden />
                Nhận báo giá sỉ
              </a>
              <CategoryMobileNav tree={navApplied.tree} onNavigate={closeMenus} />
            </div>
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
    let unsub = () => {};
    void import("@/lib/catalogSync").then(({ onShopAppearanceChanged }) => {
      if (cancelled) return;
      unsub = onShopAppearanceChanged(() => load());
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const siteName = theme?.siteName || "ALOHA Thế Giới Chậu Cây";
  const footer = {
    address: theme?.footer?.address?.trim() || DEFAULT_FOOTER.address,
    phone: theme?.footer?.phone?.trim() || DEFAULT_FOOTER.phone,
    email: theme?.footer?.email?.trim() || DEFAULT_FOOTER.email,
    zalo: theme?.footer?.zalo?.trim() || DEFAULT_FOOTER.zalo,
  };

  return (
    <footer
      id="ve-chung-toi"
      className="mt-10 border-t border-white/10 bg-[var(--aloha-green-mid)] text-white md:mt-14"
    >
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-2 sm:gap-8 sm:py-10 lg:grid-cols-3">
        <div>
          <div className="text-base font-bold text-[var(--aloha-cream)]">{siteName}</div>
          <p className="mt-2 text-sm leading-relaxed text-white/80">{footer.address}</p>
        </div>
        <div className="text-sm">
          <div className="font-bold text-[var(--aloha-cream)]">Liên hệ</div>
          <p className="mt-2 text-white/85">
            Zalo / Điện thoại:{" "}
            <a
              href={zaloHref(footer.zalo || footer.phone)}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:text-white hover:underline"
            >
              {footer.phone || footer.zalo}
            </a>
          </p>
          {footer.email ? (
            <p className="mt-1 text-white/85">
              <a
                href={`mailto:${footer.email}`}
                className="underline-offset-2 hover:text-white hover:underline"
              >
                {footer.email}
              </a>
            </p>
          ) : null}
        </div>
        <div className="text-sm text-white/80">
          <div className="font-bold text-[var(--aloha-cream)]">Mua sắm</div>
          <div className="mt-2 flex flex-col gap-2">
            <Link href="/tim" className="hover:text-white">
              Tất cả sản phẩm
            </Link>
            <Link href="/?sort=ban_chay" className="hover:text-white">
              Bán chạy
            </Link>
            <Link href="/bai-viet" className="hover:text-white">
              Bài viết
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-3 text-center text-[11px] text-white/55">
        © {new Date().getFullYear()} {siteName}
      </div>
    </footer>
  );
}
