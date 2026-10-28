"use client";

import React from "react";
import { Button, DatePicker, Drawer, Tag, message } from "antd";
import dayjs from "dayjs";
import { Copy, Info, Package } from "lucide-react";
import type { ConversionRow } from "../../types";
import {
  formatDt,
  formatVnd,
  CTV_COMMISSION_UX,
  type CtvCommissionStatusKey,
} from "../../shared/format";
import {
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  getQuickRange,
  type ConversionFilters,
  type QuickRangeType,
} from "./conversionTypes";

const { RangePicker } = DatePicker;

const QUICK_RANGE_LIST: { type: QuickRangeType; label: string }[] = [
  { type: "today", label: "Hôm nay" },
  { type: "yesterday", label: "Hôm qua" },
  { type: "7days", label: "7 ngày qua" },
  { type: "this_month", label: "Tháng này" },
  { type: "last_month", label: "Tháng trước" },
];

export interface ConversionMobileDrawersProps {
  selectedConversion: ConversionRow | null;
  onCloseDetail: () => void;
  filterDrawerOpen: boolean;
  onCloseFilterDrawer: () => void;
  dateSheetOpen: boolean;
  onCloseDateSheet: () => void;
  applied: ConversionFilters;
  onChangeFilter: <K extends keyof ConversionFilters>(key: K, value: ConversionFilters[K]) => void;
  onResetFilters: () => void;
  onApplyQuickRange: (type: QuickRangeType) => void;
  onApplyCustomDate: (from: string, to: string) => void;
}

export function ConversionMobileDrawers({
  selectedConversion,
  onCloseDetail,
  filterDrawerOpen,
  onCloseFilterDrawer,
  dateSheetOpen,
  onCloseDateSheet,
  applied,
  onChangeFilter,
  onResetFilters,
  onApplyQuickRange,
  onApplyCustomDate,
}: ConversionMobileDrawersProps) {
  const { from, to, orderStatus, paymentStatus } = applied;

  const copyToClipboard = (text: string, label = "mã đơn") => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    message.success(`Đã sao chép ${label}!`);
  };

  return (
    <>
      {/* 1. MOBILE DETAIL DRAWER */}
      <Drawer
        open={Boolean(selectedConversion)}
        onClose={onCloseDetail}
        placement="bottom"
        height="85%"
        styles={{ body: { padding: "16px", backgroundColor: "#F8FAFC" } }}
        title={
          selectedConversion ? (
            <div className="flex items-center justify-between pr-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-slate-900 font-mono">
                  {selectedConversion.orderCode}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(selectedConversion.orderCode)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <Copy size={14} />
                </button>
              </div>
              <Tag
                color={
                  selectedConversion.orderStatus === "hoan_thanh"
                    ? "green"
                    : selectedConversion.orderStatus === "huy"
                    ? "default"
                    : "orange"
                }
                className="mr-0 font-semibold text-xs"
              >
                {selectedConversion.orderLabel || "Chờ xử lý"}
              </Tag>
            </div>
          ) : null
        }
      >
        {selectedConversion ? (
          <div className="space-y-3.5 text-xs text-slate-800 pb-6">
            {/* Card 1: Khối tài chính hoa hồng */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Hoa hồng phát sinh
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-black text-[#2D5A27] tabular-nums">
                  {formatVnd(selectedConversion.totalCommission)}
                </div>
                <Tag
                  color={
                    CTV_COMMISSION_UX[
                      (selectedConversion.commissionStatusKey as CtvCommissionStatusKey) || "none"
                    ]?.color || "default"
                  }
                  className="font-bold text-xs"
                >
                  {selectedConversion.commissionStatus || "Chưa phát sinh"}
                </Tag>
              </div>
              {selectedConversion.commissionStatusHint ? (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 text-[11px] leading-relaxed flex items-start gap-1.5">
                  <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>{selectedConversion.commissionStatusHint}</span>
                </div>
              ) : null}
            </div>

            {/* Card 2: Danh sách sản phẩm mua */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Sản phẩm mua ({(selectedConversion.products?.length || 1)})
              </div>
              <div className="divide-y divide-slate-100">
                {(selectedConversion.products?.length
                  ? selectedConversion.products
                  : [{ ma: "", name: selectedConversion.productSummary, imageUrl: "" }]
                ).map((p, idx) => (
                  <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-lg object-cover border border-slate-100"
                      />
                    ) : (
                      <div className="h-11 w-11 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                        <Package size={20} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs uppercase text-slate-900 leading-snug">
                        {p.name}
                      </div>
                      {p.ma ? (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Mã: {p.ma}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: Thông tin đối soát & Timeline thời gian */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Thông tin đối soát & Thời gian
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>Thời gian click link:</span>
                <span className="font-medium text-slate-900">
                  {formatDt(selectedConversion.clickAt)}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>Thời gian đặt mua:</span>
                <span className="font-medium text-slate-900">
                  {formatDt(selectedConversion.purchasedAt)}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>Thời gian hoàn thành:</span>
                <span className="font-medium text-slate-900">
                  {formatDt(selectedConversion.completedAt)}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600 pt-2 border-t border-slate-100">
                <span>Trạng thái thanh toán:</span>
                <span className="font-semibold text-slate-900">
                  {selectedConversion.payLabel || selectedConversion.paymentStatus || "—"}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>Người mua:</span>
                <span className="font-medium text-slate-900">
                  {selectedConversion.buyerStatus || "Khách mua qua link"}
                </span>
              </div>

              {selectedConversion.total ? (
                <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-slate-100">
                  <span className="font-bold text-slate-800">Tổng tiền đơn:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {formatVnd(selectedConversion.total)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* 2. MOBILE FILTER DRAWER */}
      <Drawer
        open={filterDrawerOpen}
        onClose={onCloseFilterDrawer}
        placement="bottom"
        height="80%"
        styles={{ body: { padding: "16px", backgroundColor: "#F8FAFC" } }}
        title={<span className="font-bold text-base text-slate-900">Bộ lọc chuyển đổi</span>}
        footer={
          <div className="flex items-center gap-3 p-2">
            <Button
              onClick={() => {
                onResetFilters();
                onCloseFilterDrawer();
              }}
              className="flex-1 !h-10 font-semibold"
            >
              Thiết lập lại
            </Button>
            <Button
              type="primary"
              onClick={onCloseFilterDrawer}
              className="flex-1 !h-10 !bg-[#2D5A27] font-semibold"
            >
              Áp dụng
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Lọc Trạng thái đơn hàng */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Trạng thái đơn hàng
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ORDER_STATUS_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => onChangeFilter("orderStatus", m.value)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                    orderStatus === m.value
                      ? "bg-[#2D5A27] text-white border-[#2D5A27]"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lọc Trạng thái thanh toán */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Trạng thái thanh toán
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_STATUS_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => onChangeFilter("paymentStatus", m.value)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                    paymentStatus === m.value
                      ? "bg-[#2D5A27] text-white border-[#2D5A27]"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lọc thời gian */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Khoảng thời gian
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {QUICK_RANGE_LIST.map((btn) => (
                <button
                  key={btn.type}
                  type="button"
                  onClick={() => onApplyQuickRange(btn.type)}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 text-center"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Drawer>

      {/* 3. MOBILE DATE SHEET */}
      <Drawer
        open={dateSheetOpen}
        onClose={onCloseDateSheet}
        placement="bottom"
        height="auto"
        styles={{ body: { padding: "16px", backgroundColor: "#F8FAFC" } }}
        title={<span className="font-bold text-base text-slate-900">Chọn thời gian chuyển đổi</span>}
      >
        <div className="space-y-3 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {QUICK_RANGE_LIST.map((btn) => (
              <button
                key={btn.type}
                type="button"
                onClick={() => {
                  onApplyQuickRange(btn.type);
                  onCloseDateSheet();
                }}
                className="p-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold hover:bg-[#2D5A27]/5 hover:border-[#2D5A27] hover:text-[#2D5A27] text-center transition"
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Tuỳ chọn ngày bắt đầu - kết thúc
            </label>
            <RangePicker
              className="w-full !h-[42px]"
              format="DD/MM/YYYY"
              allowClear={false}
              value={
                from && to && dayjs(from).isValid() && dayjs(to).isValid()
                  ? [dayjs(from), dayjs(to)]
                  : null
              }
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  onApplyCustomDate(
                    dates[0]!.format("YYYY-MM-DD"),
                    dates[1]!.format("YYYY-MM-DD")
                  );
                  onCloseDateSheet();
                }
              }}
            />
          </div>
        </div>
      </Drawer>
    </>
  );
}
