"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App } from "antd";
import { siRequest } from "@/lib/siQueries";
import { OrderPrintModal, type PrintableOrder, resolveOrderAddress } from "./OrderPrintModal";
import {
  type OrderRow,
  type ListRes,
  type VoidRes,
  PAYMENT_BADGES,
  DATE_OPTIONS,
  type DateFilterKey,
  type SearchTabKey,
  PAGE_SIZE,
  getDateRange,
  formatVietnameseDateGroup,
  fmtTime,
} from "./webOrders/orderTypes";
import { WebOrdersDesktopToolbar } from "./webOrders/WebOrdersDesktopToolbar";
import { WebOrdersDesktopTable } from "./webOrders/WebOrdersDesktopTable";
import { WebOrdersMobileListView } from "./webOrders/WebOrdersMobileListView";
import { WebOrdersMobileDetailDrawer } from "./webOrders/WebOrdersMobileDetailDrawer";
import { WebOrdersFilterDrawer } from "./webOrders/WebOrdersFilterDrawer";
import { WebOrdersSearchAndDateModals } from "./webOrders/WebOrdersSearchAndDateModals";
import { QuickOrderModal } from "./quickOrder/QuickOrderModal";

export type { OrderRow };

export function WebOrdersAdmin() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const codeParam = (searchParams?.get("code") || searchParams?.get("q") || "").trim();

  // State quản lý danh sách & bộ lọc
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(codeParam);
  const [search, setSearch] = useState(codeParam);
  const [searchType, setSearchType] = useState<SearchTabKey>("code");
  const [isSearchActiveMobile, setIsSearchActiveMobile] = useState(false);

  // Bộ lọc thời gian
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [dateSheetOpen, setDateSheetOpen] = useState(false);

  // Bộ lọc trạng thái thanh toán & Bảng giá
  const [payment, setPayment] = useState("");
  const [priceMode, setPriceMode] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "amountDesc" | "amountAsc">("newest");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Xem chi tiết & thao tác đơn hàng
  const [target, setTarget] = useState<OrderRow | null>(null);
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);
  const [policyCode, setPolicyCode] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [printTarget, setPrintTarget] = useState<{
    order: PrintableOrder;
    mode: "receipt" | "shipping";
  } | null>(null);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const lastOpenedCodeRef = useRef<string>("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "v") || (e.altKey && e.key.toLowerCase() === "v")) {
        e.preventDefault();
        setQuickOrderOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { from: fromDate, to: toDate } = useMemo(
    () => getDateRange(dateFilter, customFrom, customTo),
    [dateFilter, customFrom, customTo]
  );

  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
  });
  if (search) {
    params.set("q", search);
    params.set("searchType", searchType);
  }
  if (payment) params.set("paymentStatus", payment);
  if (priceMode) params.set("priceMode", priceMode);
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);

  const query = useQuery({
    queryKey: ["admin", "web-orders", page, search, searchType, payment, priceMode, dateFilter, fromDate, toDate],
    queryFn: () => siRequest<ListRes>(`/api/shop/admin/orders?${params}`),
    refetchOnWindowFocus: false,
  });

  const voidTest = useMutation({
    mutationFn: (row: OrderRow) =>
      siRequest<VoidRes>(
        `/api/shop/admin/orders/${encodeURIComponent(row.code)}/void-test`,
        { confirmCode: confirm.trim() }
      ),
    onSuccess: (r) => {
      message.success(
        r.kvCancelled.length
          ? `Đã huỷ ${r.kvCancelled.join(", ")} trên KiotViet và đánh dấu đơn ${r.code} là đơn test`
          : `Đơn ${r.code} chưa có trên KiotViet, đã đánh dấu là đơn test`
      );
      setTarget(null);
      setDetailOrder(null);
      void qc.invalidateQueries({ queryKey: ["admin", "web-orders"] });
    },
  });

  const codesOf = (r: OrderRow) =>
    [r.code, r.kvOrderCode].filter(Boolean).map((c) => String(c).toUpperCase());
  const confirmOk = target ? codesOf(target).includes(confirm.trim().toUpperCase()) : false;

  const totalCount = query.data?.total ?? 0;
  const rawOrders = query.data?.data || [];

  const orders = useMemo(() => {
    const list = [...rawOrders];
    if (sortOrder === "oldest") {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortOrder === "amountDesc") {
      list.sort((a, b) => b.total - a.total);
    } else if (sortOrder === "amountAsc") {
      list.sort((a, b) => a.total - b.total);
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [rawOrders, sortOrder]);

  const summaryStats = useMemo(() => {
    return {
      count: totalCount,
      totalRevenue: query.data?.summary?.totalRevenue ?? orders.reduce((sum, r) => sum + (r.total || 0), 0),
    };
  }, [totalCount, query.data?.summary?.totalRevenue, orders]);

  const groupedOrders = useMemo(() => {
    const groups: { [key: string]: OrderRow[] } = {};
    for (const order of orders) {
      const dateKey = order.createdAt ? order.createdAt.slice(0, 10) : "Khác";
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey]!.push(order);
    }
    return Object.keys(groups).map((dateKey) => ({
      dateLabel: formatVietnameseDateGroup(dateKey),
      orders: groups[dateKey]!,
    }));
  }, [orders]);

  useEffect(() => {
    if (codeParam && codeParam !== search) {
      setQ(codeParam);
      setSearch(codeParam);
      setPage(1);
      lastOpenedCodeRef.current = "";
    }
  }, [codeParam, search]);

  useEffect(() => {
    if (!search || !orders.length) return;
    const targetCode = search.trim().toUpperCase();
    if (lastOpenedCodeRef.current === targetCode) return;

    const matched =
      orders.find(
        (r) =>
          r.code?.toUpperCase() === targetCode ||
          r.kvOrderCode?.toUpperCase() === targetCode
      ) || (orders.length === 1 ? orders[0] : null);

    if (matched) {
      lastOpenedCodeRef.current = targetCode;
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setDetailOrder(matched);
      } else {
        setExpandedRowKeys([matched.code]);
      }
    }
  }, [orders, search]);

  const exportCsv = () => {
    if (!orders.length) {
      message.info("Không có dữ liệu đơn hàng để xuất file");
      return;
    }
    const headers = [
      "Mã đơn KiotViet",
      "Mã đơn Web",
      "Thời gian",
      "Khách hàng",
      "Số điện thoại",
      "Địa chỉ",
      "Bảng giá",
      "Tổng tiền hàng",
      "Phí ship",
      "Khách cần trả",
      "Trạng thái",
      "Ghi chú",
    ];
    const rows = orders.map((o) => [
      `"${o.kvOrderCode || ""}"`,
      `"${o.code || ""}"`,
      `"${fmtTime(o.createdAt)}"`,
      `"${o.customerName || "Khách lẻ"}"`,
      `"${o.customerPhone || ""}"`,
      `"${resolveOrderAddress(o).replace(/"/g, '""')}"`,
      `"${o.priceMode === "si" ? "Bảng giá sỉ" : "Bảng giá Web"}"`,
      o.subtotal || o.total,
      o.shippingFee || 0,
      o.total,
      `"${PAYMENT_BADGES[o.paymentStatus]?.label || o.paymentStatus}"`,
      `"${(o.notes || o.customerNote || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Danh_sach_dat_hang_ALOHA_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("Đã xuất file dữ liệu đơn hàng");
  };

  const currentDateOption = DATE_OPTIONS.find((o) => o.key === dateFilter) || DATE_OPTIONS[4];
  const hasActiveFilters = Boolean(
    payment || priceMode || dateFilter !== "thisMonth" || search
  );

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-screen bg-[#F7F8FA] text-slate-800">
      {/* 1. GIAO DIỆN DESKTOP */}
      <div className="hidden lg:block space-y-4">
        <WebOrdersDesktopToolbar
          q={q}
          setQ={setQ}
          search={search}
          setSearch={setSearch}
          searchType={searchType}
          setSearchType={setSearchType}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          payment={payment}
          setPayment={setPayment}
          priceMode={priceMode}
          setPriceMode={setPriceMode}
          setPage={setPage}
          hasActiveFilters={hasActiveFilters}
          setFilterDrawerOpen={setFilterDrawerOpen}
          exportCsv={exportCsv}
          onRefresh={() => void query.refetch()}
          isFetching={query.isFetching}
          onOpenQuickOrder={() => setQuickOrderOpen(true)}
        />

        <WebOrdersDesktopTable
          orders={orders}
          isLoading={query.isLoading}
          page={page}
          setPage={setPage}
          totalCount={totalCount}
          expandedRowKeys={expandedRowKeys}
          setExpandedRowKeys={setExpandedRowKeys}
          onPrintReceipt={(order) => setPrintTarget({ order, mode: "receipt" })}
          onPrintShipping={(order) => setPrintTarget({ order, mode: "shipping" })}
          onCheckWholesale={(code) => setPolicyCode(code)}
          onVoidTest={(order) => {
            setTarget(order);
            setConfirm("");
            voidTest.reset();
          }}
          onRefresh={() => void query.refetch()}
        />
      </div>

      {/* 2. GIAO DIỆN MOBILE */}
      <WebOrdersMobileListView
        orders={orders}
        groupedOrders={groupedOrders}
        summaryStats={summaryStats}
        isLoading={query.isLoading}
        page={page}
        setPage={setPage}
        totalCount={totalCount}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        currentDateOptionLabel={currentDateOption.label}
        payment={payment}
        setPayment={setPayment}
        search={search}
        setSearch={setSearch}
        setQ={setQ}
        onOpenSearchMobile={() => setIsSearchActiveMobile(true)}
        onOpenDateSheet={() => setDateSheetOpen(true)}
        onOpenFilterDrawer={() => setFilterDrawerOpen(true)}
        onSelectOrder={(order) => setDetailOrder(order)}
        onRefresh={() => void query.refetch()}
      />

      {/* 3. MODALS VÀ DRAWERS CHO MOBILE & THAO TÁC */}
      <WebOrdersMobileDetailDrawer
        detailOrder={detailOrder}
        onClose={() => setDetailOrder(null)}
        onPrintReceipt={(order) => setPrintTarget({ order, mode: "receipt" })}
        onPrintShipping={(order) => setPrintTarget({ order, mode: "shipping" })}
        onCheckWholesale={(code) => setPolicyCode(code)}
        onVoidTest={(order) => {
          setTarget(order);
          setConfirm("");
          voidTest.reset();
        }}
      />

      <WebOrdersFilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        payment={payment}
        setPayment={setPayment}
        priceMode={priceMode}
        setPriceMode={setPriceMode}
        setPage={setPage}
      />

      <WebOrdersSearchAndDateModals
        isSearchActiveMobile={isSearchActiveMobile}
        onCloseSearchMobile={() => setIsSearchActiveMobile(false)}
        q={q}
        setQ={setQ}
        searchType={searchType}
        setSearchType={setSearchType}
        onConfirmSearchMobile={(val) => {
          setSearch(val);
          setIsSearchActiveMobile(false);
          setPage(1);
        }}
        dateSheetOpen={dateSheetOpen}
        onCloseDateSheet={() => setDateSheetOpen(false)}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        onApplyCustomDate={() => setDateSheetOpen(false)}
        policyCode={policyCode}
        onClosePolicyModal={() => setPolicyCode(null)}
        target={target}
        confirm={confirm}
        setConfirm={setConfirm}
        confirmOk={confirmOk}
        voidTestPending={voidTest.isPending}
        voidTestError={voidTest.error as Error | null}
        onConfirmVoidTest={() => target && voidTest.mutate(target)}
        onCloseVoidTest={() => !voidTest.isPending && setTarget(null)}
      />

      <QuickOrderModal
        open={quickOrderOpen}
        onClose={() => setQuickOrderOpen(false)}
        onOrderCreated={(code) => {
          void query.refetch();
          setSearch(code);
          setPage(1);
        }}
      />

      <OrderPrintModal
        open={Boolean(printTarget)}
        order={printTarget?.order ?? null}
        initialMode={printTarget?.mode ?? "receipt"}
        onClose={() => setPrintTarget(null)}
      />
    </div>
  );
}
