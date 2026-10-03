"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { shortHash, useCampaignView } from "@/lib/campaign/useCampaignView";
import { dealsHref } from "@/lib/campaign/dealsTabs";
import { CountdownText } from "./CountdownText";

const DISMISS_KEY = "aloha-announce-dismissed";

/** Thanh thông báo đầu trang khi chiến dịch đang khởi động / chạy. Tắt rồi thì chỉ hiện lại khi nội dung đổi. */
export function AnnouncementBar() {
  const { campaign, offsetMs, lastHours } = useCampaignView();
  const text = campaign?.display.announcement.text || "";
  const token = campaign ? `${campaign.id}:${shortHash(text + (campaign.phaseEndsAt || ""))}` : "";
  const [dismissed, setDismissed] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const textMeasureRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [durationSec, setDurationSec] = useState(12);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY));
    } catch {
      setDismissed(null);
    }
  }, []);

  useEffect(() => {
    if (!text) return;

    const checkOverflow = () => {
      const container = containerRef.current;
      const measure = textMeasureRef.current;
      if (!container || !measure) return;

      const contentWidth = measure.offsetWidth;
      const availableWidth = container.clientWidth;

      if (availableWidth > 0 && contentWidth > availableWidth) {
        setIsOverflowing(true);
        // Tốc độ lướt đọc mượt: ~35px/giây, tối thiểu 8s để không chạy quá nhanh
        const calculatedDuration = Math.max(8, Math.round((contentWidth + 32) / 35));
        setDurationSec(calculatedDuration);
      } else {
        setIsOverflowing(false);
      }
    };

    checkOverflow();

    window.addEventListener("resize", checkOverflow);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(checkOverflow) : null;
    if (containerRef.current && ro) {
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", checkOverflow);
      ro?.disconnect();
    };
  }, [text]);

  if (!campaign || !text || dismissed === token) return null;
  const { colors, announcement } = campaign.display;
  const endsAt = campaign.phaseEndsAt ? Date.parse(campaign.phaseEndsAt) : null;
  const label = campaign.phase === "teaser" ? "Bắt đầu sau" : lastHours ? "Giờ chót · còn" : "Kết thúc sau";
  const bg = lastHours ? "#C8102E" : colors.primary;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, token);
    } catch {
      /* bỏ qua */
    }
    setDismissed(token);
  };

  const textNode = (
    <div
      ref={containerRef}
      className={`relative min-w-0 flex-1 overflow-hidden ${
        isOverflowing ? "aloha-marquee-mask" : "sm:flex-initial"
      }`}
    >
      {/* Hidden element để đo width thực tế của text */}
      <span
        ref={textMeasureRef}
        className="pointer-events-none absolute left-0 top-0 invisible whitespace-nowrap font-semibold opacity-0"
        aria-hidden="true"
      >
        {text}
      </span>

      {isOverflowing ? (
        <div
          className="aloha-marquee-track cursor-pointer"
          style={{ animationDuration: `${durationSec}s` }}
        >
          <span className="shrink-0 pr-8 font-semibold">{text}</span>
          <span className="shrink-0 pr-8 font-semibold" aria-hidden="true">
            {text}
          </span>
        </div>
      ) : (
        <span className="block truncate font-semibold">
          {text}
        </span>
      )}
    </div>
  );

  const countdownNode = endsAt ? (
    <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold sm:text-xs">
      <span className="hidden sm:inline">{label}</span>
      <CountdownText target={endsAt} offsetMs={offsetMs} boxClass="rounded bg-black/25 px-1" />
    </span>
  ) : null;

  const content = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:flex-initial sm:justify-center sm:gap-3">
      {textNode}
      {countdownNode}
    </div>
  );

  return (
    <div
      className="relative text-white select-none"
      style={{ background: bg }}
      role="region"
      aria-label="Thông báo ưu đãi"
    >
      <div className="mx-auto flex h-9 max-w-7xl items-center pl-3 pr-10 text-xs sm:px-10 sm:text-sm">
        {announcement.href ? (
          <Link
            href={dealsHref(announcement.href)}
            className="flex min-w-0 flex-1 items-center justify-between sm:justify-center hover:underline"
          >
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tắt thông báo"
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
