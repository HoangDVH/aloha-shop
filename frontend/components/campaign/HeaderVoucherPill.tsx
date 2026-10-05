"use client";

import { useState } from "react";
import { TicketPercent } from "lucide-react";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { HeaderVoucherModal } from "./HeaderVoucherModal";

/** Nút voucher trên header; click mở popup Kho Voucher tại chỗ theo chuẩn sàn TMĐT. */
export function HeaderVoucherPill({ className = "" }: { className?: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const { campaign, vouchers, viewer, offsetMs } = useCampaignView();
  const pill = campaign?.display.headerPill;

  if (!campaign || !pill?.text) return null;

  return (
    <>
      {/* NÚT TRÊN HEADER (Desktop & Mobile header) */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={modalOpen}
        className={`inline-flex h-8 sm:h-9 max-w-[7.25rem] sm:max-w-[12rem] cursor-pointer items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold text-white shadow-xs transition hover:brightness-110 active:scale-95 select-none ${className}`}
        style={{ background: campaign.display.colors.primary }}
        title="Nhận voucher ưu đãi"
      >
        <TicketPercent size={13} aria-hidden className="shrink-0 sm:h-4 sm:w-4" />
        <span className="truncate sm:hidden">{pill.text.replace(/^Voucher\s+/i, "")}</span>
        <span className="truncate hidden sm:inline">{pill.text}</span>
      </button>

      <HeaderVoucherModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        campaign={campaign}
        vouchers={vouchers}
        viewer={viewer}
        offsetMs={offsetMs}
        headerPillText={pill.text}
      />
    </>
  );
}
