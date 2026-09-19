"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import { useCtvMeConversions } from "../ctvPortalQueries";
import { useCtvPortalUiStore } from "../ctvPortalUiStore";
import { exportCsv, formatDt, formatVnd, monthRange, CTV_COMMISSION_UX, resolveCtvCommissionStatus, ctvCommissionHint } from "../shared/format";
import { visibleRefetchInterval } from "@/lib/visibleRefetchInterval";
import type { ConversionRow } from "../types";
import type { CtvCommissionStatusKey } from "../shared/format";

const PAGE_SIZE = 10;

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

export function ConversionsPanel() {
  const { dateRange } = useCtvPortalUiStore();
  const initial = monthRange(0);
  const [from, setFrom] = useState(dateRange.from || initial.from);
  const [to, setTo] = useState(dateRange.to || initial.to);
  const [orderCode, setOrderCode] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [applied, setApplied] = useState({
    from: dateRange.from || initial.from,
    to: dateRange.to || initial.to,
    orderCode: "",
    orderStatus: "all",
    paymentStatus: "all",
  });
  const [page, setPage] = useState(1);

  const q = useCtvMeConversions(applied, {
    refetchInterval: visibleRefetchInterval(30_000),
  });
  const rows = q.data || [];

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
          <span className="whitespace-nowrap font-bold">{v}</span>
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
                    <div className="h-9 w-9 shrink-0 rounded bg-slate-100" />
                  )}
                  <span className="line-clamp-2 text-[12px] leading-snug">
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
          <span className="whitespace-nowrap font-semibold">{formatVnd(v)}</span>
        ),
        width: 128,
      },
      {
        title: "Trạng thái đơn",
        dataIndex: "orderLabel",
        width: 132,
        render: (v: string) => <Tag className="m-0">{v || "—"}</Tag>,
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
          <span className="whitespace-nowrap">{formatDt(v)}</span>
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
          <span className="whitespace-nowrap">{v || "—"}</span>
        ),
      },
    ],
    []
  );

  function applyFilters() {
    setApplied({ from, to, orderCode, orderStatus, paymentStatus });
    setPage(1);
  }

  function resetFilters() {
    const r = monthRange(0);
    setFrom(r.from);
    setTo(r.to);
    setOrderCode("");
    setOrderStatus("all");
    setPaymentStatus("all");
    setApplied({
      from: r.from,
      to: r.to,
      orderCode: "",
      orderStatus: "all",
      paymentStatus: "all",
    });
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
    <div className="space-y-5">
      <h1 className="m-0 text-xl font-extrabold text-[#163A2A]">
        Báo cáo chuyển đổi
      </h1>

      <Card className="shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs font-semibold text-slate-600">
            Thời gian mua hàng
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <span>–</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Trạng thái đơn hàng
            <Select
              className="mt-1 w-full"
              value={orderStatus}
              onChange={setOrderStatus}
              options={[
                { value: "all", label: "Tất cả" },
                { value: "cho_xu_ly", label: "Chờ xử lý" },
                { value: "cho_thanh_toan", label: "Chờ thanh toán" },
                { value: "dang_giao", label: "Đang giao" },
                { value: "hoan_thanh", label: "Hoàn thành" },
                { value: "thieu_hang", label: "Thiếu hàng" },
                { value: "huy", label: "Đã hủy" },
              ]}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Trạng thái thanh toán
            <Select
              className="mt-1 w-full"
              value={paymentStatus}
              onChange={setPaymentStatus}
              options={[
                { value: "all", label: "Tất cả" },
                { value: "pending", label: "Chờ thanh toán" },
                { value: "paid", label: "Đã thanh toán" },
                { value: "cod", label: "COD" },
              ]}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-3">
            Mã đơn hàng
            <Space.Compact className="mt-1 w-full">
              <Input
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
                onPressEnter={applyFilters}
                placeholder="Tìm theo mã HĐ / đơn"
              />
              <Button type="primary" onClick={applyFilters}>
                Tìm kiếm
              </Button>
            </Space.Compact>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
            <Button onClick={resetFilters}>Thiết lập lại</Button>
            <Button
              type="primary"
              ghost
              disabled={!rows.length}
              onClick={doExport}
            >
              Xuất dữ liệu
            </Button>
          </div>
        </div>
      </Card>

      <Alert
        type="info"
        showIcon
        message="Hoa hồng chỉ phát sinh sau khi đơn giao thành công. Đơn đang xử lý / COD chưa giao vẫn hiện nhưng hoa hồng có thể = 0."
      />

      {q.error ? (
        <Alert type="error" showIcon message={(q.error as Error).message} />
      ) : null}

      <Card
        className="overflow-hidden shadow-sm"
        styles={{ body: { padding: 0 } }}
      >
        {q.isLoading && !rows.length ? (
          <div className="flex justify-center py-16">
            <Spin />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table
              rowKey={(r) => r.shopOrderCode || r.orderCode}
              columns={columns}
              dataSource={rows}
              scroll={{ x: 1530 }}
              pagination={{
                current: page,
                pageSize: PAGE_SIZE,
                total: rows.length,
                onChange: setPage,
                showTotal: (t) => `${t} đơn`,
                className: "px-4 py-3",
              }}
              size="middle"
              className="ctv-conversions-table [&_.ant-table-thead>tr>th]:whitespace-nowrap [&_.ant-table-thead>tr>th]:px-4 [&_.ant-table-tbody>tr>td]:px-4 [&_.ant-table-cell]:align-middle"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
