"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronRight, FileText, Flame, Gift, Sparkles, TicketPercent, Truck } from "lucide-react";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { toDealsTab, type DealsTabId } from "@/lib/campaign/dealsTabs";
import { VoucherVault } from "@/components/voucher/VoucherVault";
import { QuickTiles } from "@/components/campaign/QuickTiles";
import { DealsProducts } from "./DealsProducts";
import { DealsRules } from "./DealsRules";
import { DealsEmpty } from "./DealsEmpty";
import { DealsOverview, LazyMount } from "./DealsOverview";
import { DealsBanner } from "./DealsBanner";
import { DealsProductTabs } from "./DealsProductTabs";
import { DealsMoreFeed } from "./DealsMoreFeed";
import { DealsSectionHead } from "./DealsSectionHead";
import { VoucherKindFilter, filterVouchers, toVoucherKind, type VoucherKind } from "./VoucherKindFilter";

export function DealsPage() {
  const { loading, data, campaign, viewer, vouchers, offsetMs, lastHours, upcoming } = useCampaignView();
  const pathname = usePathname() || "/uu-dai";
  const searchParams = useSearchParams();

  const groups = useMemo(() => {
    const list = campaign?.products || [];
    return {
      hot: list.filter((p) => p.dealHot).map((p) => p.ma),
      gift: list.filter((p) => p.hasGift).map((p) => p.ma),
      all: list.filter((p) => !p.slotKey).map((p) => p.ma),
    };
  }, [campaign?.products]);

  const rawTab = searchParams.get("tab");
  const voucherKind = toVoucherKind(searchParams.get("loai"));
  const tabFromUrl = toDealsTab(rawTab);
  // Không chọn tab (link popup, banner, tab bar) → trang tổng quan cuộn dài; ?tab= giữ kiểu một mục.
  const overview = !tabFromUrl && !searchParams.get("loai");
  const activeTab: DealsTabId = tabFromUrl || "voucher";

  const shownVouchers = useMemo(() => filterVouchers(vouchers, voucherKind), [vouchers, voucherKind]);
  const kindHref = useCallback(
    (kind: VoucherKind) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "voucher");
      if (kind === "all") params.delete("loai");
      else params.set("loai", kind);
      return `${pathname}?${params.toString()}`;
    },
    [pathname, searchParams],
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (rawTab && contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [rawTab, voucherKind]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-4">
        <div className="aspect-[9/5] animate-pulse rounded-3xl bg-white/70 md:aspect-[8/3]" />
        <div className="h-32 animate-pulse rounded-2xl bg-white/70" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-8 sm:px-4">
        <DealsEmpty paused={data?.state === "paused"} upcoming={upcoming} />
      </div>
    );
  }

  const { primary, cream } = campaign.display.colors;
  const themeStyle = {
    "--campaign-primary": primary || "#C8102E",
    "--campaign-cream": cream || "#FFF0F5",
    background: `radial-gradient(1200px 260px at 50% 0, ${primary || "#C8102E"}1f, transparent 70%), ${cream || "#FFF0F5"}`,
  } as React.CSSProperties;

  // Link cũ tới tab Deal hot khi chiến dịch không gắn SP deal hot → về trang tổng quan thay vì trang trống.
  if (overview || (activeTab === "deal-hot" && !groups.hot.length)) {
    return (
      <div style={themeStyle}>
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-5">
          <DealsOverview campaign={campaign} vouchers={vouchers} viewer={viewer} offsetMs={offsetMs} lastHours={lastHours} />
        </div>
      </div>
    );
  }

  // CHỈ RENDER ĐÚNG 1 MỤC ĐƯỢC CHỌN THEO CHUẨN SÀN TMĐT (KHÔNG BỊ TRÀN LAN TẤT CẢ)
  const renderActiveContent = () => {
    switch (activeTab) {
      case "voucher":
        return (
          <section id="kho-voucher" className="space-y-3 sm:space-y-4">
            <DealsSectionHead
              icon={voucherKind === "ship" ? Truck : TicketPercent}
              title={voucherKind === "ship" ? "Voucher hỗ trợ phí vận chuyển" : "Kho voucher ưu đãi"}
              subtitle={
                voucherKind === "ship"
                  ? "Mã hỗ trợ phí giao hàng tận nơi cho đơn hàng của bạn"
                  : "Lưu mã ngay để áp dụng tối đa 3 tầng giảm giá khi thanh toán"
              }
            />
            <VoucherVault
              vouchers={shownVouchers}
              viewer={viewer}
              offsetMs={offsetMs}
              variant="full"
              lastHours={lastHours}
              notchBg={cream || "#FFF0F5"}
              filterNode={
                <VoucherKindFilter vouchers={vouchers} active={voucherKind} hrefFor={kindHref} />
              }
            />
          </section>
        );

      case "flash-sale":
        return (
          <DealsProductTabs
            campaign={campaign}
            offsetMs={offsetMs}
            initialSlot={searchParams.get("slot")}
          />
        );

      case "qua-tang":
        return (
          <section id="qua-tang" className="space-y-4">
            <DealsSectionHead icon={Gift} title="Mua kèm quà tặng 0Đ" subtitle="Mỗi đơn hàng được tặng kèm phụ kiện decor, sỏi hoặc dinh dưỡng miễn phí" />
            <DealsProducts mas={groups.gift} variant="deal" homeRow6 />
          </section>
        );

      case "deal-hot":
        return (
          <section id="deal-hot" className="space-y-4">
            <DealsSectionHead icon={Flame} title="Deal hot giá sốc" subtitle="Các sản phẩm bán chạy giảm sâu nhất trong chiến dịch" />
            <DealsProducts mas={groups.hot} variant="deal" homeRow6 />
          </section>
        );

      case "san-pham":
        return (
          <section id="san-pham" className="space-y-4">
            <DealsSectionHead icon={Sparkles} title="Sản phẩm trong chương trình" subtitle="Toàn bộ cây cảnh và chậu cây áp dụng mức giá ưu đãi đặc biệt" />
            <DealsProducts mas={groups.all} variant="deal" homeRow6 />
          </section>
        );

      case "the-le":
        return (
          <section id="the-le">
            <DealsRules campaign={campaign} />
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div style={themeStyle}>
      <div className="mx-auto max-w-7xl space-y-4 px-3 py-3 sm:space-y-6 sm:px-4 sm:py-5">
        <DealsBanner campaign={campaign} offsetMs={offsetMs} />
        <QuickTiles
          variant="tabs"
          className="hidden sm:block"
          campaign={campaign}
          vouchers={vouchers}
          offsetMs={offsetMs}
          activeTab={activeTab}
          activeLoai={searchParams.get("loai")}
        />

        <div ref={contentRef} className="min-h-[40vh] scroll-mt-20 sm:scroll-mt-24">
          {renderActiveContent()}
        </div>

        {activeTab === "deal-hot" ? (
          <div className="space-y-8 sm:space-y-12">
            <DealsProductTabs campaign={campaign} offsetMs={offsetMs} />
            <LazyMount minHeight={400}>
              <DealsMoreFeed campaign={campaign} />
            </LazyMount>
          </div>
        ) : activeTab === "flash-sale" ? (
          <div className="space-y-8 sm:space-y-12">
            <LazyMount minHeight={400}>
              <DealsMoreFeed campaign={campaign} />
            </LazyMount>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 border-t border-rose-200/50 pt-6 pb-2">
          <Link
            href="/uu-dai"
            className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--campaign-primary,#C8102E)] via-[#E11D48] to-[#C8102E] bg-[length:200%_auto] px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-rose-950/15 transition-all duration-300 hover:bg-right hover:shadow-lg hover:shadow-rose-950/25 active:scale-[0.98] select-none"
          >
            <Sparkles size={16} className="text-amber-300 shrink-0 transition-transform duration-300 group-hover:scale-110" />
            <span>Xem toàn bộ ưu đãi</span>
            <ArrowRight size={15} className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          {activeTab !== "the-le" ? (
            <Link
              href="/uu-dai?tab=the-le"
              className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-rose-200/90 bg-white/95 backdrop-blur-xs px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs transition-all duration-200 hover:border-rose-300 hover:bg-white hover:text-rose-600 hover:shadow-sm active:scale-[0.98] select-none"
            >
              <FileText size={15} className="text-rose-500 shrink-0 transition-colors duration-200 group-hover:text-rose-600" />
              <span>Xem thể lệ chương trình</span>
              <ChevronRight size={15} className="text-slate-400 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-rose-500" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
