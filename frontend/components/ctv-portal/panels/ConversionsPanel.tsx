"use client";

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { useCtvMeConversions } from "../ctvPortalQueries";
import { useCtvPortalUiStore } from "../ctvPortalUiStore";
import {
  exportCsv,
  monthRange,
  ymd,
} from "../shared/format";
import { visibleRefetchInterval } from "@/lib/visibleRefetchInterval";
import type { ConversionRow } from "../types";
import {
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  PAGE_SIZE,
  getQuickRange,
  type ConversionFilters,
  type QuickRangeType,
} from "./conversions/conversionTypes";
import { ConversionDesktopView } from "./conversions/ConversionDesktopView";
import { ConversionMobileCards } from "./conversions/ConversionMobileCards";
import { ConversionMobileDrawers } from "./conversions/ConversionMobileDrawers";

export { type ConversionFilters } from "./conversions/conversionTypes";

export function ConversionsPanel() {
  const { dateRange } = useCtvPortalUiStore();
  const initial = monthRange(0);
  const [orderCode, setOrderCode] = useState("");
  const [applied, setApplied] = useState<ConversionFilters>({
    from: dateRange.from || initial.from,
    to: dateRange.to || initial.to,
    orderCode: "",
    orderStatus: "all",
    paymentStatus: "all",
  });
  const { from, to, orderStatus, paymentStatus } = applied;
  const [page, setPage] = useState(1);

  // Mobile state
  const [selectedConversion, setSelectedConversion] = useState<ConversionRow | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);

  const q = useCtvMeConversions(applied, {
    refetchInterval: visibleRefetchInterval(30_000),
  });
  const rows = q.data || [];

  const totalCommission = useMemo(() => {
    return rows.reduce((sum, r) => sum + (Number(r.totalCommission) || 0), 0);
  }, [rows]);

  // Labels & active filters
  const orderStatusLabel = useMemo(() => {
    return ORDER_STATUS_OPTIONS.find((o) => o.value === orderStatus)?.label || "Tất cả";
  }, [orderStatus]);

  const paymentStatusLabel = useMemo(() => {
    return PAYMENT_STATUS_OPTIONS.find((o) => o.value === paymentStatus)?.label || "Tất cả";
  }, [paymentStatus]);

  const datePresetLabel = useMemo(() => {
    const today = ymd(new Date());
    const yesterday = ymd(new Date(Date.now() - 86400000));
    const thisMonth = monthRange(0);
    const lastMonth = monthRange(-1);

    if (from === today && to === today) return "Hôm nay";
    if (from === yesterday && to === yesterday) return "Hôm qua";
    if (from === thisMonth.from && to === thisMonth.to) return "Tháng này";
    if (from === lastMonth.from && to === lastMonth.to) return "Tháng trước";
    if (from && to) {
      return `${dayjs(from).format("DD/MM")} - ${dayjs(to).format("DD/MM")}`;
    }
    return "Thời gian";
  }, [from, to]);

  const hasActiveFilters = useMemo(() => {
    const thisMonth = monthRange(0);
    return (
      orderStatus !== "all" ||
      paymentStatus !== "all" ||
      Boolean(applied.orderCode) ||
      from !== thisMonth.from ||
      to !== thisMonth.to
    );
  }, [orderStatus, paymentStatus, applied.orderCode, from, to]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (orderStatus !== "all") count++;
    if (paymentStatus !== "all") count++;
    if (applied.orderCode) count++;
    const thisMonth = monthRange(0);
    if (from !== thisMonth.from || to !== thisMonth.to) count++;
    return count;
  }, [orderStatus, paymentStatus, applied.orderCode, from, to]);

  // Mobile paginated rows
  const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1;
  const pagedMobileRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  function applyFilters() {
    setApplied((current) => ({ ...current, orderCode }));
    setPage(1);
  }

  function changeFilter<K extends keyof ConversionFilters>(
    key: K,
    value: ConversionFilters[K]
  ) {
    setApplied((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function resetFilters() {
    const r = monthRange(0);
    setOrderCode("");
    setApplied({
      from: r.from,
      to: r.to,
      orderCode: "",
      orderStatus: "all",
      paymentStatus: "all",
    });
    setPage(1);
  }

  function applyQuickRange(type: QuickRangeType) {
    const r = getQuickRange(type);
    setApplied((c) => ({ ...c, from: r.from, to: r.to }));
    setPage(1);
  }

  function applyCustomDate(newFrom: string, newTo: string) {
    setApplied((c) => ({ ...c, from: newFrom, to: newTo }));
    setPage(1);
  }

  function doExport() {
    exportCsv(
      `bao-cao-chuyen-doi-${applied.from}_${applied.to}.csv`,
      [
        "clickAt",
        "purchasedAt",
        "orderCode",
        "productSummary",
        "totalCommission",
        "orderLabel",
        "payLabel",
        "completedAt",
        "commissionStatus",
        "commissionStatusHint",
        "buyerStatus",
      ],
      rows.map((r) => [
        r.clickAt || "",
        r.purchasedAt || "",
        r.orderCode,
        r.productSummary,
        String(r.totalCommission || 0),
        r.orderLabel,
        r.payLabel || r.paymentStatus || "",
        r.completedAt || "",
        r.commissionStatus,
        r.commissionStatusHint || "",
        r.buyerStatus,
      ])
    );
  }

  return (
    <div className="ctv-page-flow flex flex-col gap-4 sm:gap-7">
      {/* 1. GIAO DIỆN DESKTOP */}
      <ConversionDesktopView
        applied={applied}
        orderCode={orderCode}
        setOrderCode={setOrderCode}
        onApplyFilters={applyFilters}
        onChangeFilter={changeFilter}
        onResetFilters={resetFilters}
        onExport={doExport}
        rows={rows}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error as Error | null}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      {/* 2. GIAO DIỆN MOBILE TỐI ƯU */}
      <ConversionMobileCards
        applied={applied}
        orderCode={orderCode}
        setOrderCode={setOrderCode}
        onApplyFilters={applyFilters}
        onChangeFilter={changeFilter}
        onResetFilters={resetFilters}
        rows={rows}
        pagedRows={pagedMobileRows}
        totalCommission={totalCommission}
        isLoading={q.isLoading}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        orderStatusLabel={orderStatusLabel}
        paymentStatusLabel={paymentStatusLabel}
        datePresetLabel={datePresetLabel}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onSelectConversion={setSelectedConversion}
        onOpenFilterDrawer={() => setFilterDrawerOpen(true)}
        onOpenDateSheet={() => setDateSheetOpen(true)}
      />

      {/* 3. MOBILE DRAWERS (Chi tiết đơn, Bộ lọc nâng cao, Chọn ngày) */}
      <ConversionMobileDrawers
        selectedConversion={selectedConversion}
        onCloseDetail={() => setSelectedConversion(null)}
        filterDrawerOpen={filterDrawerOpen}
        onCloseFilterDrawer={() => setFilterDrawerOpen(false)}
        dateSheetOpen={dateSheetOpen}
        onCloseDateSheet={() => setDateSheetOpen(false)}
        applied={applied}
        onChangeFilter={changeFilter}
        onResetFilters={resetFilters}
        onApplyQuickRange={applyQuickRange}
        onApplyCustomDate={applyCustomDate}
      />
    </div>
  );
}
