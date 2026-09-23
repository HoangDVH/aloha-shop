"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ShopPageLoader } from "@/components/ShopPageLoader";

/** Giữ tối thiểu để tránh nhấp nháy (chuẩn web bán). */
const MIN_VISIBLE_MS = 280;
/** Ẩn sau khi route ổn định. */
const HIDE_MS = 160;
/** Chờ ngắn trước khi hiện overlay cho fetch dữ liệu (tránh flash request nhanh). */
const DATA_DELAY_MS = 120;
const SAFE_MS = 6_000;

function isInternalNavClick(e: MouseEvent): boolean {
  if (e.defaultPrevented) return false;
  if (e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;

  const el = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!el) return false;
  if (el.target && el.target !== "_self") return false;
  if (el.hasAttribute("download")) return false;

  const href = el.getAttribute("href");
  if (!href || href.startsWith("#")) return false;

  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash
  ) {
    return false;
  }
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    !url.hash
  ) {
    return false;
  }
  return true;
}

/**
 * Overlay loading toàn trang — chuyển route, fetch dữ liệu, auth.
 * Một overlay duy nhất (logo nhỏ + vòng quay), giống KiotViet.
 */
export function ShopGlobalLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const depthRef = useRef(0);
  const navPendingRef = useRef(false);
  const shownAtRef = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(`${pathname}?${searchParams?.toString() ?? ""}`);

  useEffect(() => {
    const syncVisible = () => setVisible(depthRef.current > 0);

    const clearTimers = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (dataDelayTimer.current) clearTimeout(dataDelayTimer.current);
      if (safeTimer.current) clearTimeout(safeTimer.current);
      hideTimer.current = null;
      dataDelayTimer.current = null;
      safeTimer.current = null;
    };

    const markShown = () => {
      shownAtRef.current = Date.now();
      syncVisible();
      if (safeTimer.current) clearTimeout(safeTimer.current);
      safeTimer.current = setTimeout(() => {
        depthRef.current = 0;
        navPendingRef.current = false;
        syncVisible();
      }, SAFE_MS);
    };

    const bump = (delta: number) => {
      if (delta > 0) {
        depthRef.current += delta;
        markShown();
        return;
      }
      if (depthRef.current <= 0) return;

      const elapsed = Date.now() - shownAtRef.current;
      const minWait = Math.max(0, MIN_VISIBLE_MS - elapsed);

      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        depthRef.current = Math.max(0, depthRef.current + delta);
        if (depthRef.current <= 0) {
          navPendingRef.current = false;
          if (safeTimer.current) {
            clearTimeout(safeTimer.current);
            safeTimer.current = null;
          }
        }
        syncVisible();
      }, minWait);
    };

    const startNav = () => {
      if (dataDelayTimer.current) {
        clearTimeout(dataDelayTimer.current);
        dataDelayTimer.current = null;
      }
      navPendingRef.current = true;
      if (depthRef.current === 0) bump(1);
      else markShown();
    };

    const startLoading = () => {
      if (depthRef.current > 0 || dataDelayTimer.current) return;
      dataDelayTimer.current = setTimeout(() => {
        dataDelayTimer.current = null;
        bump(1);
      }, DATA_DELAY_MS);
    };

    const endLoading = () => {
      if (dataDelayTimer.current) {
        clearTimeout(dataDelayTimer.current);
        dataDelayTimer.current = null;
        return;
      }
      bump(-1);
    };

    const onClick = (e: MouseEvent) => {
      if (isInternalNavClick(e)) startNav();
    };

    const resetLoading = () => {
      depthRef.current = 0;
      navPendingRef.current = false;
      clearTimers();
      syncVisible();
    };

    /** Back/Forward & bfcache: không bật/kẹt overlay toàn trang. */
    const onPopState = () => {
      resetLoading();
    };

    const onPageShow = () => {
      resetLoading();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("shop:nav-start", startNav);
    window.addEventListener("shop:loading-start", startLoading);
    window.addEventListener("shop:loading-end", endLoading);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("shop:nav-start", startNav);
      window.removeEventListener("shop:loading-start", startLoading);
      window.removeEventListener("shop:loading-end", endLoading);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    const next = `${pathname}?${searchParams?.toString() ?? ""}`;
    if (next === keyRef.current) return;
    keyRef.current = next;

    if (!navPendingRef.current && depthRef.current === 0) return;

    if (hideTimer.current) clearTimeout(hideTimer.current);
    const elapsed = Date.now() - shownAtRef.current;
    const minWait = Math.max(HIDE_MS, MIN_VISIBLE_MS - elapsed);

    hideTimer.current = setTimeout(() => {
      if (navPendingRef.current) {
        navPendingRef.current = false;
        depthRef.current = Math.max(0, depthRef.current - 1);
      }
      setVisible(depthRef.current > 0);
    }, minWait);
  }, [pathname, searchParams]);

  if (!visible) return null;
  return <ShopPageLoader />;
}
