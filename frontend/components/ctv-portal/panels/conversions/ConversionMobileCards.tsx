"use client";

import React from "react";
import { Button, Dropdown, Spin, Tag } from "antd";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Package,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { ConversionRow } from "../../types";
import {
  formatDt,
  formatVnd,
  CTV_COMMISSION_UX,
  resolveCtvCommissionStatus,
  type CtvCommissionStatusKey,
} from "../../shared/format";
import {
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  type ConversionFilters,
} from "./conversionTypes";

export interface ConversionMobileCardsProps {
  applied: ConversionFilters;
  orderCode: string;
  setOrderCode: (val: string) => void;
  onApplyFilters: () => void;
  onChangeFilter: <K extends keyof ConversionFilters>(key: K, value: ConversionFilters[K]) => void;
  onResetFilters: () => void;
  rows: ConversionRow[];
  pagedRows: ConversionRow[];
  totalCommission: number;
  isLoading: boolean;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  orderStatusLabel: string;
  paymentStatusLabel: string;
  datePresetLabel: string;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onSelectConversion: (row: ConversionRow) => void;
  onOpenFilterDrawer: () => void;
  onOpenDateSheet: () => void;
}

export function ConversionMobileCards({
  applied,
  orderCode,
  setOrderCode,
  onApplyFilters,
  onChangeFilter,
  onResetFilters,
  rows,
  pagedRows,
  totalCommission,
  isLoading,
  hasActiveFilters,
  activeFilterCount,
  orderStatusLabel,
  paymentStatusLabel,
  datePresetLabel,
  page,
  totalPages,
  onPageChange,
  onSelectConversion,
  onOpenFilterDrawer,
  onOpenDateSheet,
}: ConversionMobileCardsProps) {
  const { orderStatus, paymentStatus } = applied;

  return (
    <div className="block lg:hidden space-y-3">
      {/* Mobile Sticky Search & Filter Header */}
      <div className="sticky top-0 z-10 -mx-3.5 -mt-3.5 bg-[#F1F5F9]/95 px-3.5 pt-2 pb-2.5 backdrop-blur-md border-b border-slate-200/80 space-y-2 shadow-2xs">
        <div className="flex items-center gap-2">
          {/* Input tìm kiếm nhanh */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={orderCode}
              onChange={(e) => setOrderCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onApplyFilters();
              }}
              placeholder="Tìm mã đơn hàng..."
              className="w-full h-9 pl-9 pr-8 bg-white border border-slate-200 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2D5A27]"
            />
            {orderCode ? (
              <button
                type="button"
                onClick={() => {
                  setOrderCode("");
                  onChangeFilter("orderCode", "");
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>

          {/* Nút Bộ lọc nâng cao */}
          <button
            type="button"
            onClick={onOpenFilterDrawer}
            className={`h-9 px-3 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
              hasActiveFilters
                ? "bg-[#2D5A27] text-white border-[#2D5A27] shadow-xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>Lọc</span>
            {activeFilterCount > 0 ? (
              <span className="w-4 h-4 rounded-full bg-white text-[#2D5A27] text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* Thanh Filter Pills chọn nhanh */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
          {/* Pill Thời gian */}
          <button
            type="button"
            onClick={onOpenDateSheet}
            className="h-7 px-2.5 rounded-full bg-white border border-slate-200 text-slate-700 font-medium flex items-center gap-1 shrink-0 text-[11px] shadow-2xs hover:bg-slate-50"
          >
            <Calendar size={12} className="text-[#2D5A27]" />
            <span>{datePresetLabel}</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>

          {/* Pill Trạng thái đơn */}
          <Dropdown
            menu={{
              items: ORDER_STATUS_OPTIONS.map((m) => ({
                key: m.value,
                label: m.label,
                icon: orderStatus === m.value ? <Check size={14} className="text-[#2D5A27]" /> : null,
                onClick: () => onChangeFilter("orderStatus", m.value),
              })),
            }}
            trigger={["click"]}
          >
            <button
              type="button"
              className={`h-7 px-2.5 rounded-full border text-[11px] font-medium flex items-center gap-1 shrink-0 transition ${
                orderStatus !== "all"
                  ? "bg-[#2D5A27]/10 text-[#2D5A27] border-[#2D5A27]/30"
                  : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              <span>Đơn: {orderStatusLabel}</span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>
          </Dropdown>

          {/* Pill Thanh toán */}
          <Dropdown
            menu={{
              items: PAYMENT_STATUS_OPTIONS.map((m) => ({
                key: m.value,
                label: m.label,
                icon: paymentStatus === m.value ? <Check size={14} className="text-[#2D5A27]" /> : null,
                onClick: () => onChangeFilter("paymentStatus", m.value),
              })),
            }}
            trigger={["click"]}
          >
            <button
              type="button"
              className={`h-7 px-2.5 rounded-full border text-[11px] font-medium flex items-center gap-1 shrink-0 transition ${
                paymentStatus !== "all"
                  ? "bg-[#2D5A27]/10 text-[#2D5A27] border-[#2D5A27]/30"
                  : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              <span>{paymentStatusLabel}</span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>
          </Dropdown>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onResetFilters}
              className="h-7 px-2 rounded-full text-slate-500 hover:text-red-600 text-[11px] font-semibold flex items-center gap-1 shrink-0"
            >
              <RotateCcw size={11} />
              <span>Đặt lại</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Dải tổng hợp KPI chuyển đổi Mobile */}
      <div className="bg-white rounded-xl border border-slate-200/80 px-4 py-2.5 flex items-center justify-between shadow-2xs text-xs">
        <div className="text-slate-600">
          <span className="font-bold text-slate-900 text-sm">{rows.length}</span> chuyển đổi
        </div>
        <div className="text-right">
          <span className="text-slate-500 text-[11px] mr-1">Tổng hoa hồng:</span>
          <span className="font-black text-sm text-[#2D5A27] tabular-nums">
            {formatVnd(totalCommission)}
          </span>
        </div>
      </div>

      {/* Thanh ghi chú nhẹ trên mobile */}
      <div className="rounded-xl border border-emerald-100 bg-[#F4F9F2] p-2.5 text-[11px] text-[#2D5A27] flex items-start gap-2 shadow-2xs">
        <Info size={14} className="shrink-0 text-[#2D5A27] mt-0.5" />
        <span className="leading-snug">
          Hoa hồng phát sinh sau khi đơn giao thành công và hoàn tất đối soát.
        </span>
      </div>

      {/* Danh sách thẻ chuyển đổi Mobile (Card View) */}
      {isLoading && !rows.length ? (
        <div className="flex justify-center py-12">
          <Spin />
        </div>
      ) : !rows.length ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center text-slate-400 space-y-2">
          <Package size={32} className="mx-auto text-slate-300" />
          <div className="text-sm font-semibold text-slate-600">Chưa có đơn chuyển đổi nào</div>
          <div className="text-xs text-slate-400">Hãy chia sẻ liên kết giới thiệu để nhận hoa hồng!</div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pagedRows.map((r) => {
            const key = (r.commissionStatusKey
              ? (r.commissionStatusKey as CtvCommissionStatusKey)
              : resolveCtvCommissionStatus([r.commissionStatus])) as CtvCommissionStatusKey;
            const ux = CTV_COMMISSION_UX[key] || CTV_COMMISSION_UX.none;
            const firstProduct = r.products?.[0];
            const otherCount = (r.products?.length || 1) - 1;

            return (
              <div
                key={r.shopOrderCode || r.orderCode}
                onClick={() => onSelectConversion(r)}
                className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-2.5 active:bg-slate-50 transition cursor-pointer"
              >
                {/* Hàng 1: Mã đơn, Thời gian mua, Tag trạng thái đơn */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#2D5A27] font-mono">
                      {r.orderCode}
                    </span>
                    {r.purchasedAt ? (
                      <span className="text-[11px] text-slate-400">
                        {formatDt(r.purchasedAt)}
                      </span>
                    ) : null}
                  </div>

                  <Tag
                    className="mr-0 rounded-full px-2 py-0.2 text-[10.5px] font-semibold border-0"
                    color={
                      r.orderStatus === "hoan_thanh"
                        ? "green"
                        : r.orderStatus === "huy"
                        ? "default"
                        : "orange"
                    }
                  >
                    {r.orderLabel || "Chờ xử lý"}
                  </Tag>
                </div>

                {/* Hàng 2: Thumbnail sản phẩm + Tên sản phẩm */}
                <div className="flex items-center gap-2.5 py-0.5">
                  {firstProduct?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={firstProduct.imageUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-100"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                      <Package size={18} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs uppercase text-slate-800 line-clamp-2 leading-snug">
                      {firstProduct?.name || r.productSummary || "Sản phẩm"}
                    </div>
                    {otherCount > 0 ? (
                      <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                        +{otherCount} sản phẩm khác
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Hàng 3: Trạng thái thanh toán, Hoa hồng & Trạng thái hoa hồng */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <span className="text-[11px] font-medium">
                      {r.payLabel || r.paymentStatus || "Chờ thanh toán"}
                    </span>
                    {r.buyerStatus ? (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                        {r.buyerStatus}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-black text-sm text-[#2D5A27] tabular-nums">
                        +{formatVnd(r.totalCommission)}
                      </div>
                      <Tag color={ux.color} className="mr-0 text-[10px] leading-tight px-1 py-0 border-0">
                        {r.commissionStatus || ux.label}
                      </Tag>
                    </div>
                    <ChevronRight size={15} className="text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Phân trang Mobile gọn gàng */}
          {totalPages > 1 ? (
            <div className="flex items-center justify-between pt-2 pb-4 text-xs text-slate-600">
              <Button
                size="small"
                disabled={page <= 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                icon={<ChevronLeft size={14} />}
                className="font-medium"
              >
                Trang trước
              </Button>
              <span className="font-semibold text-slate-700">
                {page} / {totalPages}
              </span>
              <Button
                size="small"
                disabled={page >= totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                className="font-medium"
              >
                <span>Trang sau</span>
                <ChevronRight size={14} />
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
