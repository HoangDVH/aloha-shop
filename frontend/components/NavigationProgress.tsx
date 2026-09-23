"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SAFE_MS = 8_000;
const HIDE_MS = 220;

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

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);
  const activeRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(`${pathname}?${searchParams?.toString() ?? ""}`);

  useEffect(() => {
    const clearTimers = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (safeTimer.current) clearTimeout(safeTimer.current);
      hideTimer.current = null;
      safeTimer.current = null;
    };

    const start = () => {
      clearTimers();
      activeRef.current = true;
      setDone(false);
      setActive(true);
      safeTimer.current = setTimeout(() => {
        activeRef.current = false;
        setActive(false);
        setDone(false);
      }, SAFE_MS);
    };

    const onClick = (e: MouseEvent) => {
      if (isInternalNavClick(e)) start();
    };

    const onNavStart = () => start();
    const onHistoryReset = () => {
      clearTimers();
      activeRef.current = false;
      setActive(false);
      setDone(false);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onHistoryReset);
    window.addEventListener("pageshow", onHistoryReset);
    window.addEventListener("shop:nav-start", onNavStart);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onHistoryReset);
      window.removeEventListener("pageshow", onHistoryReset);
      window.removeEventListener("shop:nav-start", onNavStart);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    const next = `${pathname}?${searchParams?.toString() ?? ""}`;
    if (next === keyRef.current) return;
    keyRef.current = next;
    if (!activeRef.current) return;

    setDone(true);
    if (safeTimer.current) {
      clearTimeout(safeTimer.current);
      safeTimer.current = null;
    }
    hideTimer.current = setTimeout(() => {
      activeRef.current = false;
      setActive(false);
      setDone(false);
    }, HIDE_MS);
  }, [pathname, searchParams]);

  if (!active && !done) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
      aria-hidden
    >
      <div
        className="h-full bg-[var(--aloha-green)] transition-[width] ease-out"
        style={{
          width: done ? "100%" : "80%",
          transitionDuration: done ? "120ms" : "1.2s",
        }}
      />
    </div>
  );
}
