"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Drawer, Empty, Space, Spin, Table, Tabs } from "antd";
import { useCtvCommissions } from "../../ctvQueries";
import {
  billStatusLabel,
  formatDt,
  formatFraudFlags,
  formatPeriodLabel,
  formatVnd,
} from "../../shared/format";
import { statusTag } from "../format";
import { CtvPagination } from "../../shared/CtvPagination";

export function PeriodCtvLinesDrawer({
  open,
  ctvCode,
  period,
  billStatus,
  onClose,
  onOpenFullList,
  onPayCtv,
  payPending,
}: {
  open: boolean;
  ctvCode: string;
  period: string;
  billStatus?: string;
  onClose: () => void;
  onOpenFullList: (ctvCode: string) => void;
  onPayCtv?: (ctvCode: string) => void;
  payPending?: boolean;
}) {
  const isLocked = billStatus === "locked" || billStatus === "paid";
  const [activeTab, setActiveTab] = useState<string>(isLocked ? "billed" : "all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (open) {
      setPage(1);
      setActiveTab(isLocked ? "billed" : "all");
    }
  }, [open, ctvCode, period, isLocked]);

  const queryParams = useMemo(() => {
    if (!open || !ctvCode) return { enabled: false };
    if (activeTab === "billed") {
      return {
        ctvCode,
        period,
        status: "billed,paid_out",
        inBill: true,
        page,
        limit: pageSize,
        enabled: true,
      };
    }
    if (activeTab === "eligible") {
      return {
        ctvCode,
        period,
        status: "eligible",
        page,
        limit: pageSize,
        enabled: true,
      };
    }
    return {
      ctvCode,
      period,
      page,
      limit: pageSize,
      enabled: true,
    };
  }, [open, ctvCode, period, activeTab, page, pageSize]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useCtvCommissions(queryParams);
  const rows = open && ctvCode ? data?.data || [] : [];
  const total = Number(data?.total) || rows.length;
  const totalHh = rows.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
  const ctvName = String(rows[0]?.ctvName || "").trim();
  const periodCounts = data?.periodCounts;

  const tabItems = useMemo(() => {
    if (isLocked) {
      return [
        {
          key: "billed",
          label: (
            <span className="flex items-center gap-1.5">
              <span>Đã vào kỳ thanh toán</span>
              {periodCounts?.inBill != null ? (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[11px] font-semibold text-blue-700">
                  {periodCounts.inBill}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          key: "eligible",
          label: (
            <span className="flex items-center gap-1.5">
              <span>Đơn đủ điều kiện chờ kỳ tới</span>
              {periodCounts?.eligible != null ? (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[11px] font-semibold text-emerald-700">
                  {periodCounts.eligible}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          key: "all",
          label: (
            <span className="flex items-center gap-1.5">
              <span>Tất cả đơn phát sinh trong tháng</span>
              {periodCounts?.all != null ? (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[11px] font-semibold text-slate-700">
                  {periodCounts.all}
                </span>
              ) : null}
            </span>
          ),
        },
      ];
    }
    return [
      {
        key: "eligible",
        label: (
          <span className="flex items-center gap-1.5">
            <span>Đủ điều kiện chi (dự kiến chốt)</span>
            {periodCounts?.eligible != null ? (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[11px] font-semibold text-emerald-700">
                {periodCounts.eligible}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: "all",
        label: (
          <span className="flex items-center gap-1.5">
            <span>Tất cả đơn trong tháng</span>
            {periodCounts?.all != null ? (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[11px] font-semibold text-slate-700">
                {periodCounts.all}
              </span>
            ) : null}
          </span>
        ),
      },
    ];
  }, [isLocked, periodCounts]);

  return (
    <Drawer
      title={
        <div>
          <div className="text-[15px] font-bold text-[#1a2e1a]">
            Chi tiết hoa hồng ·{" "}
            <Link
              href={`/admin/ctv/danh-sach/${encodeURIComponent(ctvCode)}`}
              className="text-[#2D5A27] hover:underline"
            >
              {ctvCode || "—"}
            </Link>
          </div>
          <div className="text-[12px] font-normal text-slate-500">
            {ctvName ? `${ctvName} · ` : ""}
            Kỳ {formatPeriodLabel(period)} ({period}) · {total} dòng
            {rows.length ? ` · trang này ${formatVnd(totalHh)}` : ""}
            {billStatus ? ` · ${billStatusLabel(billStatus)}` : ""}
          </div>
        </div>
      }
      open={open}
      onClose={onClose}
      width={Math.min(960, typeof window !== "undefined" ? window.innerWidth - 24 : 960)}
      destroyOnHidden
      extra={
        <Space wrap>
          {onPayCtv ? (
            <Button
              type="primary"
              size="small"
              loading={payPending}
              onClick={() => onPayCtv(ctvCode)}
            >
              Chi CTV này
            </Button>
          ) : null}
          <Button
            size="small"
            onClick={() => {
              if (ctvCode) onOpenFullList(ctvCode);
            }}
          >
            Mở tab Theo dòng
          </Button>
          <Button size="small" loading={isFetching} onClick={() => void refetch()}>
            Làm mới
          </Button>
        </Space>
      }
    >
      <div className="mb-3">
        <Tabs
          activeKey={activeTab}
          onChange={(k) => {
            setActiveTab(k);
            setPage(1);
          }}
          items={tabItems}
          className="!mb-2"
        />
        {activeTab === "billed" && isLocked ? (
          <div className="mb-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-[12.5px] text-blue-900 flex flex-wrap items-center justify-between gap-1">
            <div>
              <span className="font-semibold text-blue-800">Đơn trong kỳ thanh toán đã chốt:</span> Chỉ hiển thị các đơn được khóa sổ trong kỳ {period} (khớp với số tiền chốt ngoài bảng đối soát).
            </div>
            {periodCounts?.inBillSum != null ? (
              <span className="font-bold text-blue-800">
                {periodCounts.inBill} đơn · {formatVnd(periodCounts.inBillSum)}
              </span>
            ) : null}
          </div>
        ) : null}
        {activeTab === "eligible" ? (
          <div className="mb-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[12.5px] text-emerald-900 flex flex-wrap items-center justify-between gap-1">
            <div>
              <span className="font-semibold text-emerald-800">Đơn đủ điều kiện chờ kỳ tới:</span> Đã hết hạn đổi/trả nhưng chưa nằm trong đợt chốt kỳ này. Sẽ được đưa vào đợt thanh toán kế tiếp.
            </div>
            {periodCounts?.eligibleSum != null ? (
              <span className="font-bold text-emerald-800">
                {periodCounts.eligible} đơn · {formatVnd(periodCounts.eligibleSum)}
              </span>
            ) : null}
          </div>
        ) : null}
        {activeTab === "all" ? (
          <div className="mb-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[12.5px] text-slate-700 flex flex-wrap items-center justify-between gap-1">
            <div>
              <span className="font-semibold text-slate-800">Tất cả đơn phát sinh:</span> Toàn bộ các dòng hoa hồng của CTV trong kỳ (đang giữ đổi trả, cảnh báo gian lận, đủ điều kiện và đã chốt).
            </div>
            {periodCounts?.allSum != null ? (
              <span className="font-bold text-slate-800">
                {periodCounts.all} đơn · {formatVnd(periodCounts.allSum)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {isLoading && !data ? <Spin /> : null}
      {isError ? (
        <Alert
          type="error"
          message={(error as Error).message}
          action={<Button onClick={() => void refetch()}>Thử lại</Button>}
        />
      ) : null}
      {!isLoading && !rows.length ? (
        <Empty
          description={
            activeTab === "billed"
              ? "Không có đơn nào trong kỳ thanh toán này"
              : activeTab === "eligible"
              ? "Không có đơn nào đang chờ kỳ tới"
              : "Không có dòng hoa hồng trong kỳ này"
          }
        />
      ) : null}
      {rows.length ? (
        <>
          <Table
            size="small"
            rowKey={(r) => String(r.id)}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 900 }}
            columns={[
              {
                title: "Click",
                dataIndex: "clickAt",
                width: 132,
                render: (v: string | null) => (
                  <span className="whitespace-nowrap text-slate-600">{formatDt(v)}</span>
                ),
              },
              {
                title: "Mua",
                dataIndex: "purchasedAt",
                width: 132,
                render: (v: string | null) => (
                  <span className="whitespace-nowrap text-slate-600">{formatDt(v)}</span>
                ),
              },
              {
                title: "Đơn",
                dataIndex: "displayOrderCode",
                render: (v: string, r: any) => {
                  const code = String(v || r.orderCode || "").trim();
                  if (!code) return "—";
                  return (
                    <Link
                      href={`/don-hang/${encodeURIComponent(r.orderCode || code)}`}
                      className="font-bold text-[#2D5A27] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      #{code}
                    </Link>
                  );
                },
              },
              { title: "SP", dataIndex: "ma", width: 88 },
              {
                title: "DT",
                dataIndex: "lineTotal",
                width: 100,
                render: (v: number) => formatVnd(Number(v) || 0),
              },
              {
                title: "%",
                width: 56,
                render: (_: unknown, r: any) => `${r.rate ?? "—"}%`,
              },
              {
                title: "HH",
                dataIndex: "amount",
                width: 100,
                render: (v: number) => (
                  <span className="font-extrabold">{formatVnd(Number(v) || 0)}</span>
                ),
              },
              {
                title: "TT",
                dataIndex: "status",
                width: 120,
                render: (s: string, r: any) => (
                  <div>
                    {statusTag(s)}
                    {Array.isArray(r.fraudFlags) && r.fraudFlags.length ? (
                      <div className="mt-1 text-[11px] text-rose-600">
                        {formatFraudFlags(r.fraudFlags)}
                      </div>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <div className="mt-3">
            <CtvPagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              itemLabel="dòng"
            />
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
