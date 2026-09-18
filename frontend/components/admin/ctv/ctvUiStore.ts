"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaultThisMonthRange,
  type AdminDateRange,
} from "@/components/admin/ui/AdminDateRangePicker";

export type CtvAdminSub =
  | "overview"
  | "list"
  | "customers"
  | "commissions"
  | "orders"
  | "fraud";

type CtvUiState = {
  activeSub: CtvAdminSub;
  /** Kỳ thanh toán / chốt bill — YYYY-MM */
  periodKey: string;
  /** Khoảng lọc analytics (overview / detail / list) */
  dateRange: AdminDateRange;
  selectedCtvCode: string | null;
  setActiveSub: (s: CtvAdminSub) => void;
  setPeriodKey: (p: string) => void;
  setDateRange: (r: AdminDateRange) => void;
  setSelectedCtvCode: (c: string | null) => void;
};

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function periodFromRange(r: AdminDateRange): string {
  const m = String(r.to || "").match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : currentPeriod();
}

export const useCtvUiStore = create<CtvUiState>()(
  persist(
    (set) => ({
      activeSub: "overview",
      periodKey: currentPeriod(),
      dateRange: defaultThisMonthRange(),
      selectedCtvCode: null,
      setActiveSub: (activeSub) => set({ activeSub }),
      setPeriodKey: (periodKey) => set({ periodKey }),
      setDateRange: (dateRange) =>
        set({ dateRange, periodKey: periodFromRange(dateRange) }),
      setSelectedCtvCode: (selectedCtvCode) => set({ selectedCtvCode }),
    }),
    {
      name: "aloha-admin-ctv-ui",
      partialize: (s) => ({
        periodKey: s.periodKey,
        dateRange: s.dateRange,
        activeSub: s.activeSub,
      }),
    }
  )
);
