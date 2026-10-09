"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUp } from "lucide-react";
import type { CampaignUI, CampaignVoucherUI, CampaignViewerUI } from "@/lib/campaign/campaignApi";
import { QuickTiles } from "@/components/campaign/QuickTiles";
import { DealsBanner } from "./DealsBanner";
import { DealsTrust } from "./DealsStrips";
import { DealsVoucherStrip } from "./DealsVoucherStrip";
import { DealsBestSellers } from "./DealsBestSellers";
import { DealsProductTabs } from "./DealsProductTabs";
import { DealsRules } from "./DealsRules";
import { DealsMoreFeed } from "./DealsMoreFeed";
import { DealsShipBar } from "./DealsShipBar";

const ID_RE = /^[\w.-]{1,60}$/;

/** `?focus=id1,id2` từ link popup → danh sách id hợp lệ (tối đa 6). */
export function parseFocusIds(raw: string | null): string[] {
  return [...new Set(String(raw || "").split(",").map((s) => s.trim()).filter((s) => ID_RE.test(s)))].slice(0, 6);
}

/** Chỉ gắn nội dung khi sắp cuộn tới (giữ sẵn chiều cao để trang không nhảy). */
export function LazyMount({ minHeight, children }: { minHeight: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show]);
  return (
    <div ref={ref} style={show ? undefined : { minHeight }}>
      {show ? children : null}
    </div>
  );
}

function BackToTop() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const onScroll = () => setOn(window.scrollY > 900);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!on) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Lên đầu trang"
      className="fixed right-3.5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[var(--campaign-primary)] shadow-lg ring-1 ring-black/[0.06] transition hover:scale-105 lg:right-7 lg:h-12 lg:w-12"
      style={{ bottom: "calc(var(--shop-float-bottom) + var(--shop-float-step))" }}
    >
      <ArrowUp size={20} aria-hidden />
    </button>
  );
}

/**
 * `/uu-dai` không có `?tab=`: trang cuộn dài kiểu sàn — banner, dải voucher, flash sale, bán chạy,
 * video cây thật, lưới SP lọc được, cam kết + thể lệ, gợi ý thêm.
 */
export function DealsOverview({
  campaign,
  vouchers,
  viewer,
  offsetMs,
}: {
  campaign: CampaignUI;
  vouchers: CampaignVoucherUI[];
  viewer: CampaignViewerUI | null;
  offsetMs: number;
  lastHours: boolean;
}) {
  const searchParams = useSearchParams();
  const focusIds = parseFocusIds(searchParams.get("focus"));

  return (
    <div className="space-y-8 pb-20 sm:space-y-12 lg:pb-0">
      <DealsBanner
        campaign={campaign}
        below={<QuickTiles campaign={campaign} vouchers={vouchers} offsetMs={offsetMs} className="pt-2 sm:pt-4 sm:px-0" />}
      />

      <DealsVoucherStrip vouchers={vouchers} viewer={viewer} offsetMs={offsetMs} focusIds={focusIds} />

      <DealsBestSellers campaign={campaign} />

      <DealsProductTabs campaign={campaign} offsetMs={offsetMs} initialSlot={searchParams.get("slot")} />

      <LazyMount minHeight={260}>
        <section id="the-le" className="scroll-mt-24 space-y-3">
          <DealsTrust campaign={campaign} />
          <DealsRules campaign={campaign} />
        </section>
      </LazyMount>

      <LazyMount minHeight={400}>
        <DealsMoreFeed campaign={campaign} />
      </LazyMount>

      <BackToTop />
      <DealsShipBar vouchers={vouchers} viewer={viewer} offsetMs={offsetMs} />
    </div>
  );
}
