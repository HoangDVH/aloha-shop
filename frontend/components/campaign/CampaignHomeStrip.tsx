"use client";

import Link from "next/link";
import { Gift, Ticket } from "lucide-react";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { VoucherVault } from "@/components/voucher/VoucherVault";
import { QuickTiles } from "./QuickTiles";

/** Dưới banner trang chủ: ô lối tắt ưu đãi. */
export function CampaignHomeStrip() {
  const { campaign, vouchers, offsetMs } = useCampaignView();
  if (!campaign) return null;
  const { colors } = campaign.display;
  return (
    <section className="py-4" style={{ background: colors.cream }} aria-label={campaign.name}>
      <QuickTiles campaign={campaign} vouchers={vouchers} offsetMs={offsetMs} />
    </section>
  );
}

/** Khối kho voucher trang chủ: thiết kế tinh gọn chuẩn TMĐT (Shopee/TikTok). */
export function CampaignHomeVouchers() {
  const { campaign, vouchers, viewer, offsetMs, lastHours } = useCampaignView();
  if (!campaign || !vouchers.length) return null;
  const newUser = Boolean(viewer?.newBuyer && viewer.canUse);
  const headerTitle = newUser
    ? "ƯU ĐÃI KHÁCH MỚI"
    : campaign.name
      ? `MÃ GIẢM GIÁ ${campaign.name.toUpperCase()}`
      : "MÃ GIẢM GIÁ HÔM NAY";

  return (
    <section className="bg-[var(--aloha-surface,#f8faf8)] py-5 sm:py-7 border-t border-black/[0.04]" aria-label="Kho voucher">
      <div className="mx-auto max-w-7xl px-4">
        {/* HEADER TINH GỌN: KHÔNG THUẬT NGỮ RƯỜM RÀ */}
        <div className="mb-3 sm:mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F3822] text-white shadow-xs">
              <Gift size={20} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-[15px] sm:text-lg font-black uppercase tracking-wide text-[#0F3822] leading-tight">
                  {headerTitle}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600 border border-slate-200/80">
                  <Ticket size={11} className="text-slate-500" />
                  <span>Mã của bạn</span>
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 leading-snug line-clamp-1">
                Tự động áp dụng mức giảm cao nhất khi thanh toán
              </p>
            </div>
          </div>
          <Link
            href="/uu-dai?tab=voucher"
            className="inline-flex min-h-[36px] items-center gap-1 text-xs sm:text-sm font-bold text-[#0F3822] hover:text-[var(--aloha-green,#2D5A27)] hover:underline shrink-0"
          >
            <span>Xem tất cả ({vouchers.length})</span>
            <span aria-hidden>→</span>
          </Link>
        </div>

        {/* LƯỚI CARD VOUCHER */}
        <VoucherVault
          vouchers={vouchers}
          viewer={viewer}
          offsetMs={offsetMs}
          variant={newUser ? "newUser" : "compact"}
          lastHours={lastHours}
          notchBg="var(--aloha-surface, #F8FAF8)"
        />
      </div>
    </section>
  );
}
