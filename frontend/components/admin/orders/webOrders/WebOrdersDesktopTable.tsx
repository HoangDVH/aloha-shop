"use client";

import React from "react";
import { Dropdown, Table } from "antd";
import { ChevronDown, MoreHorizontal, Package, Printer, Trash2 } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { OrderDetailsExpanded } from "../OrderDetailsExpanded";
import {
  type OrderRow,
  PAYMENT_BADGES,
  PAGE_SIZE,
  fmtTime,
} from "./orderTypes";

export interface WebOrdersDesktopTableProps {
  orders: OrderRow[];
  isLoading: boolean;
  page: number;
  setPage: (p: number) => void;
  totalCount: number;
  expandedRowKeys: string[];
  setExpandedRowKeys: React.Dispatch<React.SetStateAction<string[]>>;
  onPrintReceipt: (order: OrderRow) => void;
  onPrintShipping: (order: OrderRow) => void;
  onCheckWholesale: (code: string) => void;
  onVoidTest: (order: OrderRow) => void;
  onRefresh: () => void;
}

export function WebOrdersDesktopTable({
  orders,
  isLoading,
  page,
  setPage,
  totalCount,
  expandedRowKeys,
  setExpandedRowKeys,
  onPrintReceipt,
  onPrintShipping,
  onCheckWholesale,
  onVoidTest,
  onRefresh,
}: WebOrdersDesktopTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
      <Table<OrderRow>
        rowKey="code"
        size="middle"
        loading={isLoading}
        dataSource={orders}
        className="[&_.ant-table-thead>tr>th]:!text-slate-900 [&_.ant-table-thead>tr>th]:!font-bold [&_.ant-table-thead>tr>th]:!bg-[#f5f5f5] [&_.ant-table-thead>tr>th]:!border-b [&_.ant-table-thead>tr>th]:!border-slate-300"
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: totalCount,
          showSizeChanger: false,
          onChange: (p) => {
            setPage(p);
            setExpandedRowKeys([]);
          },
        }}
        expandable={{
          expandedRowRender: (record) => (
            <OrderDetailsExpanded
              order={record}
              onPrintReceipt={() => onPrintReceipt(record)}
              onPrintShipping={() => onPrintShipping(record)}
              onCheckWholesale={() => onCheckWholesale(record.code)}
              onVoidTest={() => onVoidTest(record)}
              onCollapse={() => {
                setExpandedRowKeys((prev) => prev.filter((k) => k !== record.code));
              }}
              onRefresh={onRefresh}
            />
          ),
          expandedRowKeys,
          onExpand: (expanded, record) => {
            setExpandedRowKeys(expanded ? [record.code] : []);
          },
          showExpandColumn: false,
        }}
        onRow={(record) => {
          const isExpanded = expandedRowKeys.includes(record.code);
          return {
            "data-order-code": record.code,
            onClick: (e: React.MouseEvent) => {
              const el = e.target as HTMLElement;
              if (el.closest("button") || el.closest("a") || el.closest(".ant-btn")) return;
              setExpandedRowKeys((prev) => (prev.includes(record.code) ? [] : [record.code]));
            },
            className: `cursor-pointer transition-colors ${
              isExpanded ? "bg-[#2D5A27]/5 !border-l-4 !border-l-[#2D5A27]" : "hover:bg-slate-50/80"
            }`,
          } as any;
        }}
        columns={[
          {
            title: "Mã đặt hàng",
            width: 170,
            render: (_, r) => {
              const isExpanded = expandedRowKeys.includes(r.code);
              return (
                <div className="flex items-start gap-2 leading-tight">
                  <ChevronDown
                    size={14}
                    className={`text-[#2D5A27] mt-0.5 shrink-0 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                  <div>
                    <div className="font-bold text-[#2D5A27] hover:underline flex items-center gap-1 font-mono">
                      <span>{r.kvOrderCode || r.code}</span>
                    </div>
                    {r.kvOrderCode && r.kvOrderCode !== r.code ? (
                      <div className="text-[11px] text-slate-400 font-mono">Web: {r.code}</div>
                    ) : null}
                    {r.kvInvoiceCode ? (
                      <div className="text-[11px] text-slate-400 font-medium">HĐ: {r.kvInvoiceCode}</div>
                    ) : null}
                  </div>
                </div>
              );
            },
          },
          {
            title: "Thời gian",
            width: 140,
            render: (_, r) => <span className="text-xs text-slate-800 font-semibold">{fmtTime(r.createdAt)}</span>,
          },
          {
            title: "Khách hàng",
            render: (_, r) => (
              <div className="leading-tight">
                <div className="text-xs font-bold text-slate-900">{r.customerName || "Khách lẻ"}</div>
                <div className="text-xs text-slate-600 font-mono font-medium">{r.customerPhone || "—"}</div>
              </div>
            ),
          },
          {
            title: "Bảng giá",
            width: 125,
            render: (_, r) => (
              <span
                className={`text-[13px] ${
                  r.priceMode === "si" ? "font-bold text-purple-800" : "font-bold text-slate-900"
                }`}
              >
                {r.priceMode === "si" ? "Bảng giá sỉ" : "Bảng giá Web"}
              </span>
            ),
          },
          {
            title: "Tổng tiền hàng",
            align: "right",
            width: 140,
            render: (_, r) => (
              <span className="font-black text-slate-900 tabular-nums">
                {formatVnd(r.total)}
              </span>
            ),
          },
          {
            title: "Khách đã trả",
            align: "right",
            width: 130,
            render: (_, r) => (
              <span className="text-xs font-bold text-slate-900 tabular-nums">
                {r.paymentStatus === "paid" ? formatVnd(r.total) : "0 ₫"}
              </span>
            ),
          },
          {
            title: "Trạng thái",
            width: 150,
            render: (_, r) => {
              const badge = PAYMENT_BADGES[r.paymentStatus] || {
                label: r.paymentStatus,
                badgeCls: "bg-slate-100 text-slate-600 border-slate-200",
              };
              return (
                <div className="flex flex-wrap items-center gap-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.badgeCls}`}>
                    {badge.label}
                  </span>
                  {r.isTest ? (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200">
                      TEST
                    </span>
                  ) : null}
                </div>
              );
            },
          },
          {
            title: "",
            width: 50,
            align: "center",
            render: (_, r) => (
              <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
                <Dropdown
                  trigger={["click"]}
                  placement="bottomRight"
                  menu={{
                    items: [
                      {
                        key: "receipt",
                        label: "In hoá đơn K80",
                        icon: <Printer size={14} className="text-[#2D5A27]" />,
                        onClick: () => onPrintReceipt(r),
                      },
                      {
                        key: "shipping",
                        label: "In phiếu gửi A6",
                        icon: <Package size={14} className="text-slate-600" />,
                        onClick: () => onPrintShipping(r),
                      },
                      ...(r.priceMode === "si"
                        ? [
                            {
                              key: "si",
                              label: "Kiểm tra sỉ",
                              onClick: () => onCheckWholesale(r.code),
                            },
                          ]
                        : []),
                      { type: "divider" },
                      {
                        key: "void",
                        label: r.voidTestBlock ? "Không thể huỷ đơn" : "Huỷ đơn test KiotViet",
                        danger: !r.voidTestBlock,
                        disabled: Boolean(r.voidTestBlock),
                        icon: <Trash2 size={14} />,
                        onClick: () => onVoidTest(r),
                      },
                    ],
                  }}
                >
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </Dropdown>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
