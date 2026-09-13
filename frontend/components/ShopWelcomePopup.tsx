"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { shopApiBase } from "@/lib/api";
import type { AppearancePopup } from "@/lib/appearanceTypes";

const SKIP_PREFIXES = [
  "/gio-hang",
  "/xac-nhan-don-hang",
  "/don-hang",
  "/dang-nhap",
  "/dang-ky",
  "/quen-mat-khau",
  "/cho-duyet-ctv",
];

type CapRecord = { at: string; imageUrl?: string };

function storageKey(campaignId: string) {
  return `aloha_popup_${campaignId || "promo"}`;
}

function wantForcePopup(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("popup") === "1";
  } catch {
    return false;
  }
}

function shouldSkipPath(pathname: string) {
  return SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function readCap(campaignId: string): CapRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(campaignId));
    if (!raw) return null;
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as CapRecord;
      if (parsed?.at) return parsed;
    }
    return { at: raw };
  } catch {
    return null;
  }
}

function isCapped(
  campaignId: string,
  imageUrl: string,
  frequencyDays: number,
  showOnce: boolean
): boolean {
  try {
    const rec = readCap(campaignId);
    if (!rec) return false;
    // Đổi ảnh → hiện lại
    if (imageUrl && rec.imageUrl && rec.imageUrl !== imageUrl) return false;
    if (showOnce) return true;
    const at = Date.parse(rec.at);
    if (!Number.isFinite(at)) return true;
    const ms = Math.max(1, frequencyDays) * 24 * 60 * 60 * 1000;
    return Date.now() - at < ms;
  } catch {
    return false;
  }
}

function markDismissed(campaignId: string, imageUrl: string) {
  try {
    localStorage.setItem(
      storageKey(campaignId),
      JSON.stringify({
        at: new Date().toISOString(),
        imageUrl: imageUrl || undefined,
      } satisfies CapRecord)
    );
  } catch {
    /* private mode */
  }
}

function clearCap(campaignId: string) {
  try {
    localStorage.removeItem(storageKey(campaignId));
  } catch {
    /* ignore */
  }
}

export function ShopWelcomePopup() {
  const pathname = usePathname() || "/";
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [popup, setPopup] = useState<AppearancePopup | null>(null);
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const forceShow = wantForcePopup();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const boot = (p: AppearancePopup) => {
      if (cancelled || !p.enabled) return;
      const imageUrl = String(p.imageUrl || "").trim();
      if (!imageUrl) return;

      if (forceShow) {
        clearCap(p.campaignId);
      } else {
        if (shouldSkipPath(pathname)) return;
        if (
          isCapped(
            p.campaignId,
            imageUrl,
            p.frequencyDays,
            p.showOncePerCampaign !== false
          )
        ) {
          return;
        }
      }

      const delay = forceShow
        ? 200
        : Math.max(0, Math.min(30, Number(p.delaySeconds) || 4)) * 1000;

      timer = setTimeout(() => {
        if (cancelled) return;
        setPopup(p);
        setOpen(true);
      }, delay);
    };

    void fetch(`${shopApiBase()}/api/shop/appearance`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const p = data?.theme?.popup as AppearancePopup | undefined;
        if (p) boot(p);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pathname, forceShow]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const t = requestAnimationFrame(() => setEntered(true));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dismiss = () => {
    if (popup && !forceShow) {
      markDismissed(popup.campaignId, String(popup.imageUrl || "").trim());
    }
    setOpen(false);
  };

  if (!open || !popup) return null;

  const href = popup.ctaHref?.trim() || "/tim";
  const img = popup.imageUrl.trim();
  const label = popup.title?.trim() || popup.ctaLabel?.trim() || "Xem ưu đãi";

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-3 transition-colors duration-300 sm:p-6 ${
        entered ? "bg-black/65" : "bg-black/0"
      }`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`group relative w-[min(92vw,420px)] transition-all duration-300 sm:w-[min(90vw,480px)] ${
          entered
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-4 scale-95 opacity-0"
        }`}
      >
        <div className="relative overflow-hidden rounded-2xl bg-transparent shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <button
            ref={closeRef}
            type="button"
            onClick={dismiss}
            className="absolute right-2.5 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full border-0 bg-black/45 text-white opacity-100 backdrop-blur-sm transition hover:bg-black/60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>

          <Link
            id={titleId}
            href={href}
            onClick={dismiss}
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label={label}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={label}
              className="block h-auto max-h-[min(88vh,900px)] w-full select-none object-contain"
              draggable={false}
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
