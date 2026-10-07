"use client";

import { useEffect } from "react";
import { TicketPercent } from "lucide-react";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { HeaderVoucherModal } from "./HeaderVoucherModal";
import { ALOHA_OPEN_VOUCHER_MODAL, useVoucherModal } from "@/lib/campaign/useVoucherModal";

/** Nút voucher trên header; click mở popup Kho Voucher tại chỗ theo chuẩn sàn TMĐT. */
export function HeaderVoucherPill({ className = "" }: { className?: string }) {
  const { isOpen, openModal } = useVoucherModal();
  const { campaign } = useCampaignView();
  const pill = campaign?.display.headerPill;

  if (!campaign || !pill?.text) return null;

  return (
    <button
      type="button"
      onClick={openModal}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      className={`inline-flex h-8 sm:h-9 cursor-pointer items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-3.5 text-[11px] sm:text-xs font-bold text-white shadow-xs transition hover:brightness-110 active:scale-95 select-none bg-[var(--aloha-green)] ${className}`}
      style={{ background: "var(--aloha-green, #2e7d32)" }}
      title="Nhận voucher ưu đãi"
    >
      <TicketPercent size={13} aria-hidden className="shrink-0 sm:h-4 sm:w-4" />
      <span>Voucher</span>
    </button>
  );
}

/**
 * Popup Kho Voucher toàn cục (chỉ render 1 lần duy nhất trong SiteHeader để tránh lặp modal).
 * Lắng nghe cả Zustand store và CustomEvent để mở từ bất cứ đâu (Header, Banner trang ưu đãi...).
 */
export function HeaderVoucherGlobalModal() {
  const { isOpen, closeModal, openModal } = useVoucherModal();
  const { campaign, vouchers, viewer, offsetMs } = useCampaignView();

  useEffect(() => {
    const handleOpen = () => openModal();
    window.addEventListener(ALOHA_OPEN_VOUCHER_MODAL, handleOpen);
    return () => window.removeEventListener(ALOHA_OPEN_VOUCHER_MODAL, handleOpen);
  }, [openModal]);

  return (
    <HeaderVoucherModal
      open={isOpen}
      onClose={closeModal}
      campaign={campaign}
      vouchers={vouchers}
      viewer={viewer}
      offsetMs={offsetMs}
      headerPillText="Voucher"
    />
  );
}
