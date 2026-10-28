"use client";

import React from "react";
import { Alert, Button, Drawer, Input, Modal } from "antd";
import { Barcode, Check, ChevronRight } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { WholesaleOrderCheck } from "../WholesaleOrderCheck";
import {
  DATE_OPTIONS,
  SEARCH_TABS,
  type DateFilterKey,
  type SearchTabKey,
  type OrderRow,
  fmtTime,
} from "./orderTypes";

export interface WebOrdersSearchAndDateModalsProps {
  // Search modal mobile
  isSearchActiveMobile: boolean;
  onCloseSearchMobile: () => void;
  q: string;
  setQ: (val: string) => void;
  searchType: SearchTabKey;
  setSearchType: (val: SearchTabKey) => void;
  onConfirmSearchMobile: (val: string) => void;

  // Date sheet mobile
  dateSheetOpen: boolean;
  onCloseDateSheet: () => void;
  dateFilter: DateFilterKey;
  setDateFilter: (val: DateFilterKey) => void;
  customFrom: string;
  setCustomFrom: (val: string) => void;
  customTo: string;
  setCustomTo: (val: string) => void;
  onApplyCustomDate: () => void;

  // Wholesale check modal
  policyCode: string | null;
  onClosePolicyModal: () => void;

  // Void test modal
  target: OrderRow | null;
  confirm: string;
  setConfirm: (val: string) => void;
  confirmOk: boolean;
  voidTestPending: boolean;
  voidTestError: Error | null;
  onConfirmVoidTest: () => void;
  onCloseVoidTest: () => void;
}

export function WebOrdersSearchAndDateModals({
  isSearchActiveMobile,
  onCloseSearchMobile,
  q,
  setQ,
  searchType,
  setSearchType,
  onConfirmSearchMobile,
  dateSheetOpen,
  onCloseDateSheet,
  dateFilter,
  setDateFilter,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  onApplyCustomDate,
  policyCode,
  onClosePolicyModal,
  target,
  confirm,
  setConfirm,
  confirmOk,
  voidTestPending,
  voidTestError,
  onConfirmVoidTest,
  onCloseVoidTest,
}: WebOrdersSearchAndDateModalsProps) {
  const currentSearchTab = SEARCH_TABS.find((t) => t.key === searchType) || SEARCH_TABS[0];

  return (
    <>
      {/* 1. MÀN HÌNH TÌM KIẾM TOÀN DIỆN MOBILE */}
      {isSearchActiveMobile ? (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-150">
          <div className="p-3.5 border-b border-slate-100 flex items-center gap-2.5">
            <div className="flex-1 relative flex items-center border border-blue-400/80 rounded-xl px-3 py-1.5 bg-white shadow-2xs">
              <input
                autoFocus
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onConfirmSearchMobile(q.trim());
                  }
                }}
                placeholder={currentSearchTab.placeholder}
                className="w-full text-sm text-slate-800 placeholder-slate-400 outline-none pr-7"
              />
              <Barcode size={18} className="text-slate-400 absolute right-3 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={onCloseSearchMobile}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 px-1"
            >
              Huỷ
            </button>
          </div>

          <div className="px-3.5 py-2.5 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
            {SEARCH_TABS.map((tab) => {
              const isActive = searchType === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSearchType(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    isActive
                      ? "bg-[#2D5A27] text-white shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {q.trim() ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => onConfirmSearchMobile(q.trim())}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-[#2D5A27]"
                >
                  <span>Tìm kiếm theo {currentSearchTab.label}: &ldquo;{q.trim()}&rdquo;</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : (
              <div className="text-center text-slate-400 text-xs pt-12">
                Nhập từ khoá để tìm kiếm theo {currentSearchTab.label.toLowerCase()}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* 2. BOTTOM SHEET BỘ LỌC THỜI GIAN MOBILE */}
      <Drawer
        open={dateSheetOpen}
        onClose={onCloseDateSheet}
        placement="bottom"
        size="auto"
        destroyOnHidden
        styles={{
          body: { padding: "12px 16px calc(24px + env(safe-area-inset-bottom, 0px))" },
          section: { borderTopLeftRadius: "20px", borderTopRightRadius: "20px" },
        }}
        title={<div className="text-center font-bold text-base text-slate-900 -mb-1">Thời gian</div>}
      >
        <div className="divide-y divide-slate-100 text-sm">
          {DATE_OPTIONS.map((opt) => {
            const isSelected = dateFilter === opt.key;
            return (
              <div
                key={opt.key}
                onClick={() => {
                  setDateFilter(opt.key);
                  if (opt.key !== "custom") onCloseDateSheet();
                }}
                className="py-3.5 flex items-center justify-between cursor-pointer active:bg-slate-50 transition"
              >
                <span className={`text-sm ${isSelected ? "font-bold text-slate-900" : "text-slate-700"}`}>
                  {opt.label}
                </span>
                {isSelected ? <Check size={18} className="text-[#2D5A27]" /> : null}
              </div>
            );
          })}

          {dateFilter === "custom" ? (
            <div className="pt-3 pb-2 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Từ ngày</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                </div>
              </div>
              <Button
                type="primary"
                block
                className="!bg-[#2D5A27] font-semibold mt-1"
                onClick={onApplyCustomDate}
              >
                Áp dụng
              </Button>
            </div>
          ) : null}
        </div>
      </Drawer>

      {/* 3. MODAL KIỂM TRA SỈ */}
      <Modal
        open={Boolean(policyCode)}
        onCancel={onClosePolicyModal}
        footer={null}
        width={720}
        destroyOnHidden
      >
        {policyCode ? <WholesaleOrderCheck code={policyCode} /> : null}
      </Modal>

      {/* 4. MODAL HUỶ ĐƠN TEST */}
      <Modal
        open={Boolean(target)}
        title={`Huỷ đơn test ${target?.kvOrderCode || target?.code || ""}`}
        okText="Huỷ trên KiotViet"
        cancelText="Đóng"
        okButtonProps={{ danger: true, disabled: !confirmOk, loading: voidTestPending }}
        onOk={onConfirmVoidTest}
        onCancel={onCloseVoidTest}
        destroyOnHidden
      >
        {target ? (
          <div className="space-y-3 text-sm">
            <p>
              Đơn của <b>{target.customerName || "khách"}</b> · {formatVnd(target.total)} · đặt lúc {fmtTime(target.createdAt)}
            </p>
            <Alert
              type="warning"
              showIcon
              message="Việc này không hoàn tác được"
              description={
                <ul className="list-disc space-y-0.5 pl-4 text-xs">
                  <li>
                    KiotViet chuyển {target.kvOrderCode ? `đặt hàng ${target.kvOrderCode}` : "đơn"}
                    {target.kvInvoiceCode ? ` và hoá đơn ${target.kvInvoiceCode}` : ""} sang &quot;Đã huỷ&quot;, không tính doanh thu.
                  </li>
                  <li>Đơn trên web chuyển &quot;Đã huỷ&quot; và gắn nhãn TEST, không tính bán chạy, đã bán hay hoa hồng.</li>
                  <li>Trả lại hàng giữ, lượt voucher và suất flash sale của đơn.</li>
                </ul>
              }
            />
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Gõ lại mã đơn <b>{target.kvOrderCode || target.code}</b> để xác nhận
              </label>
              <Input
                autoFocus
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={target.kvOrderCode || target.code}
                onPressEnter={() => confirmOk && !voidTestPending && onConfirmVoidTest()}
              />
            </div>
            {voidTestError ? <Alert type="error" showIcon message={voidTestError.message} /> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
