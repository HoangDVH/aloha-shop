"use client";

import React, { useMemo } from "react";
import { Alert, Button, DatePicker, Input, Select, Space, Spin, Table, Tag } from "antd";
import dayjs from "dayjs";
import { Package } from "lucide-react";
import type { ConversionRow } from "../../types";
import {
  formatDt,
  formatVnd,
  monthRange,
  CTV_COMMISSION_UX,
  resolveCtvCommissionStatus,
  ctvCommissionHint,
  type CtvCommissionStatusKey,
} from "../../shared/format";
import {
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  type ConversionFilters,
} from "./conversionTypes";

const { RangePicker } = DatePicker;

function commissionCell(r: ConversionRow) {
  const key = (r.commissionStatusKey
    ? (r.commissionStatusKey as CtvCommissionStatusKey)
    : resolveCtvCommissionStatus([r.commissionStatus])) as CtvCommissionStatusKey;
  const ux = CTV_COMMISSION_UX[key] || CTV_COMMISSION_UX.none;
  const hint =
    r.commissionStatusHint ||
    ctvCommissionHint(key) ||
    ux.explain;
  return (
    <div className="min-w-[120px]">
      <Tag color={ux.color} className="m-0">
        {r.commissionStatus || ux.label}
      </Tag>
      <div className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</div>
    </div>
  );
}

export interface ConversionDesktopViewProps {
  applied: ConversionFilters;
  orderCode: string;
  setOrderCode: (val: string) => void;
  onApplyFilters: () => void;
  onChangeFilter: <K extends keyof ConversionFilters>(key: K, value: ConversionFilters[K]) => void;
  onResetFilters: () => void;
  onExport: () => void;
  rows: ConversionRow[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
}

export function ConversionDesktopView({
  applied,
  orderCode,
  setOrderCode,
  onApplyFilters,
  onChangeFilter,
  onResetFilters,
  onExport,
  rows,
  isLoading,
  isFetching,
  error,
  page,
  pageSize,
  onPageChange,
}: ConversionDesktopViewProps) {
  const { from, to, orderStatus, paymentStatus } = applied;

  const columns = useMemo(
    () => [
      {
        title: "Thời gian click",
        dataIndex: "clickAt",
        render: (v: string | null) => (
          <span className="whitespace-nowrap">{formatDt(v)}</span>
        ),
        width: 148,
      },
      {
        title: "Thời gian mua",
        dataIndex: "purchasedAt",
        render: (v: string | null) => (
          <span className="whitespace-nowrap">{formatDt(v)}</span>
        ),
        width: 148,
      },
      {
        title: "Mã đơn",
        dataIndex: "orderCode",
        render: (v: string) => (
          <span className="whitespace-nowrap font-bold text-slate-900">{v}</span>
        ),
        width: 128,
      },
      {
        title: "Sản phẩm",
        key: "products",
        width: 280,
        render: (_: unknown, r: ConversionRow) => {
          const products =
            r.products?.length
              ? r.products
              : r.productSummary && r.productSummary !== "—"
                ? [{ ma: "", name: r.productSummary, imageUrl: "" }]
                : [];
          if (!products.length) return "—";
          return (
            <div className="flex flex-col gap-2 py-0.5">
              {products.map((p, i) => (
                <div
                  key={`${p.ma || p.name}-${i}`}
                  className="flex items-center gap-2.5"
                >
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                      <Package size={16} />
                    </div>
                  )}
                  <span className="line-clamp-2 text-[12px] leading-snug font-medium text-slate-800">
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          );
        },
      },
      {
        title: "Hoa hồng (₫)",
        dataIndex: "totalCommission",
        align: "right" as const,
        render: (v: number) => (
          <span className="whitespace-nowrap font-bold text-[#2D5A27]">{formatVnd(v)}</span>
        ),
        width: 128,
      },
      {
        title: "Trạng thái đơn",
        dataIndex: "orderLabel",
        width: 132,
        render: (v: string, r: ConversionRow) => (
          <Tag
            color={
              r.orderStatus === "hoan_thanh"
                ? "green"
                : r.orderStatus === "huy"
                ? "default"
                : "orange"
            }
            className="m-0 font-medium"
          >
            {v || "—"}
          </Tag>
        ),
      },
      {
        title: "Trạng thái thanh toán",
        dataIndex: "payLabel",
        width: 150,
        render: (v: string, r: ConversionRow) => (
          <span className="whitespace-nowrap text-[12px] font-medium text-slate-600">
            {v || r.paymentStatus || "—"}
          </span>
        ),
      },
      {
        title: "Hoàn thành",
        dataIndex: "completedAt",
        render: (v: string | null) => (
          <span className="whitespace-nowrap text-slate-600">{formatDt(v)}</span>
        ),
        width: 148,
      },
      {
        title: "Trạng thái hoa hồng",
        dataIndex: "commissionStatus",
        width: 168,
        render: (_: string, r: ConversionRow) => commissionCell(r),
      },
      {
        title: "Người mua",
        dataIndex: "buyerStatus",
        width: 120,
        render: (v: string) => (
          <span className="whitespace-nowrap text-slate-600">{v || "—"}</span>
        ),
      },
    ],
    []
  );

  return (
    <div className="hidden lg:flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-extrabold text-[#163A2A]">
            Báo cáo chuyển đổi
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Theo dõi chi tiết đơn hàng, trạng thái đối soát và hoa hồng phát sinh
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        {/* Bộ lọc đơn hàng */}
        <div className="border-b border-slate-100 p-5 bg-white">
          {/* Hàng 1: 3 bộ lọc chính kích thước cân đối đồng bộ */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Thời gian mua hàng
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
                    onChangeFilter("from", dates[0]!.format("YYYY-MM-DD"));
                    onChangeFilter("to", dates[1]!.format("YYYY-MM-DD"));
                  } else {
                    const r = monthRange(0);
                    onChangeFilter("from", r.from);
                    onChangeFilter("to", r.to);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Trạng thái đơn hàng
              </label>
              <Select
                className="w-full !h-[42px]"
                value={orderStatus}
                onChange={(value) => onChangeFilter("orderStatus", value)}
                options={ORDER_STATUS_OPTIONS}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Trạng thái thanh toán
              </label>
              <Select
                className="w-full !h-[42px]"
                value={paymentStatus}
                onChange={(value) => onChangeFilter("paymentStatus", value)}
                options={PAYMENT_STATUS_OPTIONS}
              />
            </div>
          </div>

          {/* Hàng 2: Tìm kiếm mã đơn hàng & Các nút thao tác */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="w-full sm:max-w-md">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Mã đơn hàng
              </label>
              <Space.Compact className="w-full">
                <Input
                  value={orderCode}
                  onChange={(e) => setOrderCode(e.target.value)}
                  onPressEnter={onApplyFilters}
                  placeholder="Tìm theo mã HĐ / đơn hàng..."
                  allowClear
                  className="!h-[42px]"
                />
                <Button
                  type="primary"
                  onClick={onApplyFilters}
                  className="!h-[42px] px-5 font-medium !bg-[#2D5A27]"
                >
                  Tìm kiếm
                </Button>
              </Space.Compact>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end">
              <Button
                onClick={onResetFilters}
                className="!h-[42px] px-4 font-medium"
              >
                Thiết lập lại
              </Button>
              <Button
                type="primary"
                ghost
                disabled={!rows.length || isFetching}
                onClick={onExport}
                className="!h-[42px] px-4 font-medium"
              >
                Xuất dữ liệu
              </Button>
            </div>
          </div>
        </div>

        {/* Thanh ghi chú nhẹ */}
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-[#F4F9F2] px-5 py-3 text-xs font-medium text-[#2D5A27]">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#2D5A27] text-[10px] font-bold text-white">
            i
          </span>
          <span>
            Hoa hồng chỉ phát sinh sau khi đơn giao thành công. Đơn đang xử lý / COD chưa giao vẫn hiện nhưng hoa hồng có thể = 0.
          </span>
        </div>

        {error ? (
          <div className="border-b border-slate-100 p-4">
            <Alert type="error" showIcon message={error.message} />
          </div>
        ) : null}

        {/* Bảng dữ liệu Desktop */}
        {isLoading && !rows.length ? (
          <div className="flex justify-center py-16">
            <Spin />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table
              rowKey={(r) => r.shopOrderCode || r.orderCode}
              columns={columns}
              dataSource={rows}
              loading={isFetching}
              scroll={{ x: 1530 }}
              pagination={{
                current: page,
                pageSize: pageSize,
                total: rows.length,
                onChange: onPageChange,
                showTotal: (t) => `${t} đơn`,
                className: "px-4 py-3",
              }}
              size="middle"
              className="ctv-conversions-table [&_.ant-table-thead>tr>th]:whitespace-nowrap [&_.ant-table-thead>tr>th]:px-4 [&_.ant-table-tbody>tr>td]:px-4 [&_.ant-table-cell]:align-middle"
            />
          </div>
        )}
      </div>
    </div>
  );
}
