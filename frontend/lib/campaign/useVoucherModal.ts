"use client";

import { create } from "zustand";

interface VoucherModalState {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  setIsOpen: (isOpen: boolean) => void;
}

export const useVoucherModal = create<VoucherModalState>((set) => ({
  isOpen: false,
  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false }),
  setIsOpen: (isOpen: boolean) => set({ isOpen }),
}));

export const ALOHA_OPEN_VOUCHER_MODAL = "aloha:open-voucher-modal";

/** Mở popup Kho Voucher từ bất kỳ đâu (nút header, banner trang ưu đãi, link chiến dịch) */
export function openVoucherModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ALOHA_OPEN_VOUCHER_MODAL));
  }
  useVoucherModal.getState().openModal();
}
