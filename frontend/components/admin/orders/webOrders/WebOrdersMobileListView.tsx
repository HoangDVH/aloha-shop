"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Dropdown, Pagination } from "antd";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  type OrderRow,
  PAYMENT_BADGES,
  PAGE_SIZE,
  fmtTime,
  type DateFilterKey,
} from "./orderTypes";

export interface WebOrdersMobileListViewProps {
  orders: OrderRow[];
  groupedOrders: { dateLabel: string; orders: OrderRow[] }[];
  summaryStats: { count: number; totalRevenue: number };
  isLoading: boolean;
  page: number;
  setPage: (p: number) => void;
  totalCount: number;
  sortOrder: "newest" | "oldest" | "amountDesc" | "amountAsc";
  setSortOrder: (s: "newest" | "oldest" | "amountDesc" | "amountAsc") => void;
  currentDateOptionLabel: string;
  payment: string;
  setPayment: (p: string) => void;
  search: string;
  setSearch: (s: string) => void;
  setQ: (q: string) => void;
  onOpenSearchMobile: () => void;
  onOpenDateSheet: () => void;
  onOpenFilterDrawer: () => void;
  onSelectOrder: (order: OrderRow) => void;
  onRefresh: () => void;
}

export function WebOrdersMobileListView({
  orders,
  groupedOrders,
  summaryStats,
  isLoading,
  page,
  setPage,
  totalCount,
  sortOrder,
  setSortOrder,
  currentDateOptionLabel,
  payment,
  setPayment,
  search,
  setSearch,
  setQ,
  onOpenSearchMobile,
  onOpenDateSheet,
  onOpenFilterDrawer,
  onSelectOrder,
  onRefresh,
}: WebOrdersMobileListViewProps) {
  const router = useRouter();

  return (
    <div className="block lg:hidden w-full max-w-full overflow-x-hidden min-h-screen bg-[#F7F8FA] pb-24">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-3.5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="p-1 -ml-1 text-slate-700 hover:text-slate-900 active:scale-95 transition"
            aria-label="Quay lại"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Đặt hàng</h1>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSearchMobile}
            className="p-2 text-slate-600 hover:text-slate-900 active:scale-95 transition"
            aria-label="Tìm kiếm"
          >
            <Search size={20} />
          </button>

          <Dropdown
            trigger={["click"]}
            placement="bottomRight"
            menu={{
              items: [
                {
                  key: "newest",
                  label: "Mới nhất",
                  icon: sortOrder === "newest" ? <Check size={14} className="text-[#2D5A27]" /> : null,
                  onClick: () => setSortOrder("newest"),
                },
                {
                  key: "oldest",
                  label: "Cũ nhất",
                  icon: sortOrder === "oldest" ? <Check size={14} className="text-[#2D5A27]" /> : null,
                  onClick: () => setSortOrder("oldest"),
                },
                {
                  key: "amountDesc",
                  label: "Giá trị cao nhất",
                  icon: sortOrder === "amountDesc" ? <Check size={14} className="text-[#2D5A27]" /> : null,
                  onClick: () => setSortOrder("amountDesc"),
                },
                {
                  key: "amountAsc",
                  label: "Giá trị thấp nhất",
                  icon: sortOrder === "amountAsc" ? <Check size={14} className="text-[#2D5A27]" /> : null,
                  onClick: () => setSortOrder("amountAsc"),
                },
              ],
            }}
          >
            <button
              type="button"
              className="p-2 text-slate-600 hover:text-slate-900 active:scale-95 transition"
              aria-label="Sắp xếp"
            >
              <ArrowUpDown size={19} />
            </button>
          </Dropdown>
        </div>
      </header>

      {/* Thanh bộ lọc nhanh mobile */}
      <div className="bg-white border-b border-slate-100 px-3.5 py-2.5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenFilterDrawer}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition"
          aria-label="Lọc nâng cao"
        >
          <SlidersHorizontal size={15} />
        </button>

        <button
          type="button"
          onClick={onOpenDateSheet}
          className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 active:scale-95 transition"
        >
          <span>{currentDateOptionLabel}</span>
          <ChevronDown size={14} className="text-slate-500" />
        </button>

        {payment ? (
          <div className="flex items-center gap-1 bg-[#2D5A27]/10 text-[#2D5A27] px-2.5 py-1 rounded-full text-xs font-semibold">
            <span>{payment === "paid" ? "Đã TT" : "Chưa TT"}</span>
            <button type="button" onClick={() => setPayment("")}>
              <X size={12} />
            </button>
          </div>
        ) : null}

        {search ? (
          <div className="flex items-center gap-1 bg-[#2D5A27]/10 text-[#2D5A27] px-2.5 py-1 rounded-full text-xs font-semibold truncate max-w-[130px]">
            <span className="truncate">{search}</span>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setQ("");
              }}
            >
              <X size={12} />
            </button>
          </div>
        ) : null}
      </div>

      {/* Dải tổng tiền hàng mobile */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-1 text-sm font-semibold text-slate-800">
            <span>Tổng tiền hàng</span>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {summaryStats.count.toLocaleString("vi-VN")} phiếu
          </div>
        </div>
        <div className="text-lg font-black text-slate-900 tabular-nums">
          {summaryStats.totalRevenue.toLocaleString("vi-VN")}
        </div>
      </div>

      {/* Danh sách đơn mobile gom theo ngày */}
      {isLoading ? (
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white p-3.5 rounded-xl border border-slate-200/60 space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-4 w-20 bg-slate-200 rounded" />
              </div>
              <div className="h-3 w-44 bg-slate-200 rounded" />
              <div className="h-3 w-40 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs px-4">
          <Package size={32} className="mx-auto mb-2 text-slate-300" />
          Không có đơn đặt hàng nào trong khoảng thời gian này
        </div>
      ) : (
        <div className="space-y-3 pb-8">
          {groupedOrders.map((group) => (
            <div key={group.dateLabel}>
              <div className="px-4 pt-3.5 pb-1.5 text-xs font-bold text-slate-400 uppercase tracking-wide">
                {group.dateLabel}
              </div>

              <div className="bg-white border-y border-slate-200/70 divide-y divide-slate-100">
                {group.orders.map((r) => {
                  const badge = PAYMENT_BADGES[r.paymentStatus] || {
                    label: r.paymentStatus,
                    badgeCls: "bg-slate-100 text-slate-600 border-slate-200",
                  };
                  const items = r.orderDetails || [];
                  const firstItem = items[0];
                  const moreItemsCount = Math.max(0, items.length - 1);

                  return (
                    <div
                      key={r.code}
                      onClick={() => onSelectOrder(r)}
                      className="p-3.5 hover:bg-slate-50/70 active:bg-slate-100/70 transition cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-sm text-slate-900 tracking-tight leading-snug">
                          {r.customerName || "Khách lẻ"}
                        </span>
                        <span className="font-bold text-sm text-slate-900 tabular-nums shrink-0">
                          {r.total.toLocaleString("vi-VN")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="truncate">
                          <span>{fmtTime(r.createdAt)}</span>
                          <span className="mx-1">·</span>
                          <span className="font-medium text-slate-600 font-mono">{r.kvOrderCode || r.code}</span>
                        </div>
                        <div className="shrink-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badge.badgeCls}`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 leading-tight">
                        {firstItem ? (
                          <div>
                            <span>
                              {firstItem.productName || "Sản phẩm"}
                              {firstItem.variantLabel ? ` (${firstItem.variantLabel.toUpperCase()})` : ""}
                            </span>
                            {" "}
                            <b className="text-slate-900 font-bold">x{firstItem.quantity || 1}</b>
                          </div>
                        ) : (
                          <span>Đơn hàng web</span>
                        )}

                        {moreItemsCount > 0 ? (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            +{moreItemsCount} mặt hàng khác
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalCount > PAGE_SIZE ? (
        <div className="flex justify-center py-4 bg-white border-t border-slate-100">
          <Pagination
            size="small"
            current={page}
            pageSize={PAGE_SIZE}
            total={totalCount}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={onRefresh}
        className="fixed right-4 bottom-20 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#2D5A27] text-white shadow-lg hover:bg-[#23471f] active:scale-95 transition"
        aria-label="Làm mới danh sách đơn"
        title="Làm mới danh sách đơn"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>
    </div>
  );
}
