"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { shopApiBase } from "@/lib/api";
import type { AppearancePopup } from "@/lib/appearanceTypes";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import {
  popupAudienceAllowed,
  popupCapped,
  popupInSchedule,
  popupPathAllowed,
  type PopupCapRecord,
} from "@/lib/popupRules";
import { PopupReopenBadge } from "@/components/PopupReopenBadge";

/** Cuộn tới tỉ lệ này của trang thì hiện luôn, không chờ hết thời gian trễ. */
const SCROLL_TRIGGER = 0.35;

const capKey = (id: string) => `aloha_popup_${id || "promo"}`;
const seenKey = (id: string) => `aloha_popup_seen_${id || "promo"}`;
const badgeOffKey = (id: string) => `aloha_popup_badge_off_${id || "promo"}`;

type StoreKind = "local" | "session";

function readStore(kind: StoreKind, key: string): string | null {
  try {
    return (kind === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStore(kind: StoreKind, key: string, value: string | null) {
  try {
    const s = kind === "local" ? localStorage : sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function readCap(campaignId: string): PopupCapRecord | null {
  const raw = readStore("local", capKey(campaignId));
  if (!raw) return null;
  if (!raw.startsWith("{")) return { at: raw };
  try {
    const parsed = JSON.parse(raw) as PopupCapRecord;
    return parsed?.at ? parsed : null;
  } catch {
    return null;
  }
}

function isCapped(p: AppearancePopup): boolean {
  return popupCapped(
    readCap(p.campaignId),
    p.imageUrl.trim(),
    p.frequencyDays,
    p.showOncePerCampaign !== false,
    Date.now()
  );
}

function wantForcePopup(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("popup") === "1";
  } catch {
    return false;
  }
}

function sendPopupEvent(event: "view" | "click" | "close") {
  void fetch(`${shopApiBase()}/api/shop/appearance/popup-event`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}

export function ShopWelcomePopup() {
  const pathname = usePathname() || "/";
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const forcedRef = useRef(false);
  const { viewer, loading: viewerLoading } = useCampaignView();
  const [popup, setPopup] = useState<AppearancePopup | null>(null);
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  /** Đổi giá trị để vẽ lại sau khi ghi localStorage/sessionStorage. */
  const [, setStorageTick] = useState(0);
  const [forceShow] = useState(wantForcePopup);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${shopApiBase()}/api/shop/appearance`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const p = data?.theme?.popup as AppearancePopup | undefined;
        if (!cancelled && p?.enabled && String(p.imageUrl || "").trim()) setPopup(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const audience = popup?.audience || "all";
  const eligible = Boolean(
    popup &&
      (audience === "all" || !viewerLoading) &&
      popupInSchedule(popup, Date.now()) &&
      popupAudienceAllowed(audience, viewer) &&
      popupPathAllowed(pathname, popup.pages)
  );

  useEffect(() => {
    if (!popup || open) return;
    if (forceShow) {
      if (forcedRef.current) return;
      forcedRef.current = true;
      writeStore("local", capKey(popup.campaignId), null);
      const t = setTimeout(() => setOpen(true), 200);
      return () => clearTimeout(t);
    }
    if (!eligible || readStore("session", seenKey(popup.campaignId)) || isCapped(popup)) return;

    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      writeStore("session", seenKey(popup.campaignId), "1");
      sendPopupEvent("view");
      setOpen(true);
    };
    const delay = Number(popup.delaySeconds);
    const timer = setTimeout(show, (Number.isFinite(delay) ? Math.max(0, Math.min(30, delay)) : 3) * 1000);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= SCROLL_TRIGGER) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      done = true;
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [popup, eligible, forceShow, open]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const t = requestAnimationFrame(() => setEntered(true));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss("close");
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

  const dismiss = (reason: "close" | "click") => {
    if (popup && !forceShow) {
      writeStore(
        "local",
        capKey(popup.campaignId),
        JSON.stringify({
          at: new Date().toISOString(),
          imageUrl: popup.imageUrl.trim() || undefined,
        } satisfies PopupCapRecord)
      );
      if (reason === "click") writeStore("session", badgeOffKey(popup.campaignId), "1");
      sendPopupEvent(reason);
    }
    setOpen(false);
    setStorageTick((n) => n + 1);
  };

  if (!popup) return null;

  const href = popup.ctaHref?.trim() || "/tim";
  const img = popup.imageUrl.trim();
  const label = popup.title?.trim() || popup.ctaLabel?.trim() || "Xem ưu đãi";

  const showBadge =
    !open &&
    !forceShow &&
    eligible &&
    !pathname.startsWith("/uu-dai") &&
    popup.reopenBadge !== false &&
    !readStore("session", badgeOffKey(popup.campaignId)) &&
    (Boolean(readStore("session", seenKey(popup.campaignId))) || isCapped(popup));

  return (
    <>
      {showBadge ? (
        <PopupReopenBadge
          imageUrl={img}
          label={label}
          onOpen={() => {
            sendPopupEvent("view");
            setOpen(true);
          }}
          onHide={() => {
            writeStore("session", badgeOffKey(popup.campaignId), "1");
            setStorageTick((n) => n + 1);
          }}
        />
      ) : null}
      {open ? (
        <div
          className={`fixed inset-0 z-[200] flex items-center justify-center p-3 transition-all duration-300 sm:p-6 ${
            entered ? "bg-black/55 backdrop-blur-[3px]" : "bg-black/0 backdrop-blur-0"
          }`}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) dismiss("close");
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative w-[min(92vw,420px)] sm:w-[min(90vw,480px)] ${entered ? "aloha-popup-pop" : "opacity-0"}`}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={() => dismiss("close")}
              className="absolute -right-1 -top-1 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white text-slate-700 shadow-[0_4px_14px_rgba(0,0,0,0.28)] transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:-right-3 sm:-top-3"
              aria-label="Đóng"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </button>

            <Link
              id={titleId}
              href={href}
              onClick={() => dismiss("click")}
              className="relative block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label={label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={label}
                className="block h-auto max-h-[min(86vh,880px)] w-full select-none rounded-2xl object-contain drop-shadow-[0_18px_36px_rgba(0,0,0,0.35)]"
                draggable={false}
              />
              {entered ? (
                <span
                  className="aloha-popup-shine"
                  style={{ "--popup-mask": `url(${JSON.stringify(img)})` } as React.CSSProperties}
                  aria-hidden
                />
              ) : null}
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
