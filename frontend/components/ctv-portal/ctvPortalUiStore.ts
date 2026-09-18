"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaultThisMonthRange,
  type AdminDateRange,
} from "@/components/admin/ui/AdminDateRangePicker";
import { monthRange } from "./shared/format";

type PortalUiState = {
  dateRange: AdminDateRange;
  payRange: AdminDateRange;
  productSearch: string;
  setDateRange: (r: AdminDateRange) => void;
  setPayRange: (r: AdminDateRange) => void;
  setProductSearch: (q: string) => void;
};

const thisMonth = monthRange(0);

export const useCtvPortalUiStore = create<PortalUiState>()(
  persist(
    (set) => ({
      dateRange: defaultThisMonthRange(),
      payRange: { from: thisMonth.from, to: thisMonth.to },
      productSearch: "",
      setDateRange: (dateRange) => set({ dateRange }),
      setPayRange: (payRange) => set({ payRange }),
      setProductSearch: (productSearch) => set({ productSearch }),
    }),
    { name: "aloha-ctv-portal-ui", partialize: (s) => ({ dateRange: s.dateRange }) }
  )
);
