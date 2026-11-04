"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Drawer, Empty, Space, Spin, Table, Tabs, Tag } from "antd";
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
  selectedLine,
  onClose,
  onOpenFullList,
  onPayCtv,
  payPending,
}: {
  open: boolean;
  ctvCode: string;
  period: string;
  billStatus?: string;
  selectedLine?: any;
  onClose: () => void;
  onOpenFullList: (ctvCode: string) => void;
  onPayCtv?: (ctvCode: string) => void;
  payPending?: boolean;
}) {
  const isLocked = billStatus === "locked" || billStatus === "paid";
  const defaultTab = isLocked ? "billed" : "eligible";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [page, setPage] = useState(1);
  const [showDebtDetail, setShowDebtDetail] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    if (open) {
      setPage(1);
      setShowDebtDetail(false);
      setActiveTab(isLocked ? "billed" : "eligible");
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
  const ctvName = String(rows[0]?.ctvName || selectedLine?.ctvName || "").trim();
  const periodCounts = data?.periodCounts;

  const debtOffset = Number(selectedLine?.debtOffset || 0);
  const adjustmentsList = selectedLine?.adjustmentEntries || [];
  const postAdjustmentsList = selectedLine?.postPaymentAdjustments || [];
  const hasDebt = debtOffset > 0 || adjustmentsList.length > 0 || postAdjustmentsList.length > 0;
  const adjustmentEntriesCount = adjustmentsList.length + postAdjustmentsList.length;

  const grossAmount = useMemo(() => {
    if (selectedLine?.gross != null) return Number(selectedLine.gross);
    if (selectedLine?.commission != null) return Number(selectedLine.commission);
    if (selectedLine?.net != null) return Number(selectedLine.net) + debtOffset;
    if (isLocked && periodCounts?.inBillSum != null) return Number(periodCounts.inBillSum);
    if (periodCounts?.eligibleSum != null) return Number(periodCounts.eligibleSum);
    return totalHh;
  }, [selectedLine, debtOffset, isLocked, periodCounts, totalHh]);

  const netAmount = useMemo(() => {
    if (selectedLine?.net != null) return Number(selectedLine.net);
    return Math.max(0, grossAmount - debtOffset);
  }, [selectedLine, grossAmount, debtOffset]);

  const validOrderCount = useMemo(() => {
    if (selectedLine?.orderCount != null) return Number(selectedLine.orderCount);
    if (isLocked && periodCounts?.inBill != null) return Number(periodCounts.inBill);
    if (periodCounts?.eligible != null) return Number(periodCounts.eligible);
    return rows.filter((r: any) => r.status === "billed" || r.status === "eligible" || r.status === "paid_out").length;
  }, [selectedLine, isLocked, periodCounts, rows]);

  const debtOrderCodes = useMemo(() => {
    const set = new Set<string>();
    adjustmentsList.forEach((e: any) => {
      if (e.orderCode) set.add(String(e.orderCode).trim());
    });
    postAdjustmentsList.forEach((e: any) => {
      if (e.orderCode) set.add(String(e.orderCode).trim());
    });
    return set;
  }, [adjustmentsList, postAdjustmentsList]);

  const tabItems = useMemo(() => {
    if (isLocked) {
      return [
        {
          key: "billed",
          label: (
            <span className="flex items-center gap-1.5 font-medium">
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
            <span className="flex items-center gap-1.5 font-medium">
              <span>Chờ kỳ tới</span>
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
            <span className="flex items-center gap-1.5 font-medium">
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
    }
    return [
      {
        key: "eligible",
        label: (
          <span className="flex items-center gap-1.5 font-medium">
            <span>Đủ điều kiện chi</span>
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
          <span className="flex items-center gap-1.5 font-medium">
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
        <div className="flex items-center gap-2">
          <div>
            <div className="text-[15px] font-bold text-[#1a2e1a] flex items-center gap-2">
              <span>Chi tiết hoa hồng · </span>
              <Link
                href={`/admin/ctv/danh-sach/${encodeURIComponent(ctvCode)}`}
                className="text-[#2D5A27] hover:underline"
              >
                {ctvCode || "—"}
              </Link>
              {ctvName ? <span className="text-slate-500 font-normal">({ctvName})</span> : null}
              {billStatus ? (
                <Tag
                  color={billStatus === "paid" ? "cyan" : billStatus === "locked" ? "blue" : "orange"}
                  className="!m-0 text-[11px] font-medium"
                >
                  {billStatusLabel(billStatus)}
                </Tag>
              ) : null}
            </div>
            <div className="text-[12px] font-normal text-slate-500 mt-0.5">
              Kỳ đối soát: <strong className="text-slate-700">{formatPeriodLabel(period)}</strong> ({period})
            </div>
          </div>
        </div>
      }
      open={open}
      onClose={onClose}
      width={Math.min(920, typeof window !== "undefined" ? window.innerWidth - 24 : 920)}
      destroyOnHidden
      extra={
        <Space wrap>
          {onPayCtv ? (
            <Button
              type="primary"
              size="small"
              loading={payPending}
              onClick={() => onPayCtv(ctvCode)}
              className="!bg-[#2D5A27] hover:!bg-[#23471f] font-semibold"
            >
              {netAmount > 0 ? `Chi CTV: ${formatVnd(netAmount)}` : "Chi CTV này"}
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
      {/* Khối Quyết toán dòng tiền (Phiếu Sao Kê Thanh Lịch Tối Giản) */}
      <div className="mb-4 rounded-xl border border-slate-200/80 bg-[#fbfcfb] p-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* 1. Hoa hồng được duyệt */}
          <div className="rounded-lg bg-white p-3 border border-slate-200/70">
            <div className="text-[11.5px] font-medium text-slate-500">
              1. Hoa hồng được tính
            </div>
            <div className="mt-1 text-base font-extrabold text-slate-800">
              {formatVnd(grossAmount)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {validOrderCount} đơn hợp lệ
            </div>
          </div>

          {/* 2. Cấn trừ nợ hoàn hàng */}
          <div
            className={`rounded-lg p-3 border ${
              hasDebt
                ? "border-rose-200 bg-rose-50/40 text-rose-900"
                : "border-slate-200/70 bg-white text-slate-600"
            }`}
          >
            <div className="flex items-center justify-between text-[11.5px] font-medium">
              <span>2. Cấn trừ hoàn nợ</span>
              {hasDebt ? (
                <span className="rounded bg-rose-100 px-1 text-[10px] font-bold text-rose-700">
                  {adjustmentEntriesCount} khoản
                </span>
              ) : null}
            </div>
            <div
              className={`mt-1 text-base font-extrabold ${
                hasDebt ? "text-rose-600" : "text-slate-400"
              }`}
            >
              {hasDebt ? `−${formatVnd(debtOffset)}` : "0 đ"}
            </div>
            {hasDebt ? (
              <button
                type="button"
                onClick={() => setShowDebtDetail(!showDebtDetail)}
                className="mt-0.5 text-[11px] font-semibold text-rose-700 hover:text-rose-900 underline cursor-pointer"
              >
                {showDebtDetail ? "Ẩn chi tiết ▲" : "Xem chi tiết đơn nợ ▼"}
              </button>
            ) : (
              <div className="mt-0.5 text-[11px] text-slate-400">Không có nợ tồn</div>
            )}
          </div>

          {/* 3. Tiền thực chi (Net Payout) */}
          <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-3 text-emerald-950">
            <div className="text-[11.5px] font-semibold text-emerald-800">
              3. Thực chi (= 1 − 2)
            </div>
            <div className="mt-1 text-lg font-black text-[#2D5A27]">
              {formatVnd(netAmount)}
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-emerald-700">
              Số tiền cần chuyển khoản
            </div>
          </div>
        </div>

        {/* Chi tiết đơn nợ chỉ hiện khi bấm mở rộng */}
        {hasDebt && showDebtDetail ? (
          <div className="mt-2.5 pt-2 border-t border-rose-100 space-y-1.5 text-xs">
            {(selectedLine?.adjustmentEntries || []).map((entry: any) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-md border border-rose-100 bg-white px-2.5 py-1.5"
              >
                <div>
                  <span className="font-bold text-rose-700">#{entry.orderCode}</span>
                  {entry.ma ? ` (${entry.ma})` : ""}: {entry.reason || "Thu hồi nợ hoàn hàng"}
                </div>
                <span className="font-extrabold text-rose-700">
                  {formatVnd(Number(entry.amount) || 0)}
                </span>
              </div>
            ))}
            {(selectedLine?.postPaymentAdjustments || []).map((entry: any) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-md border border-rose-100 bg-white px-2.5 py-1.5"
              >
                <div>
                  <span className="font-bold text-rose-700">#{entry.orderCode}</span>
                  {entry.ma ? ` (${entry.ma})` : ""}: Thu hồi sau chi · {entry.reason || "Hoàn hàng"}
                </div>
                <span className="font-extrabold text-rose-700">
                  {formatVnd(Number(entry.amount) || 0)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Tabs lọc đơn */}
      <div className="mb-2">
        <Tabs
          activeKey={activeTab}
          onChange={(k) => {
            setActiveTab(k);
            setPage(1);
          }}
          items={tabItems}
          className="!mb-1"
        />
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
            columns={[
              {
                title: "Đơn hàng",
                key: "order",
                render: (_: unknown, r: any) => {
                  const code = String(r.displayOrderCode || r.orderCode || "").trim();
                  const isDebtOrder = debtOrderCodes.has(code);
                  const time = r.purchasedAt || r.clickAt;
                  return (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/don-hang/${encodeURIComponent(r.orderCode || code)}`}
                          className="font-bold text-[#2D5A27] hover:underline text-[13px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          #{code || "—"}
                        </Link>
                        {r.ma ? (
                          <span className="rounded bg-slate-100 px-1 py-0.2 text-[10.5px] font-medium text-slate-600">
                            {r.ma}
                          </span>
                        ) : null}
                        {isDebtOrder ? (
                          <span className="rounded bg-rose-100 px-1 py-0.2 text-[10px] font-bold text-rose-700 border border-rose-200">
                            Thu nợ
                          </span>
                        ) : null}
                      </div>
                      {time ? (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {formatDt(time)}
                        </div>
                      ) : null}
                    </div>
                  );
                },
              },
              {
                title: "Doanh số",
                dataIndex: "lineTotal",
                width: 110,
                align: "right" as const,
                render: (v: number) => (
                  <span className="text-[12.5px] font-medium text-slate-700">
                    {formatVnd(Number(v) || 0)}
                  </span>
                ),
              },
              {
                title: "%",
                width: 60,
                align: "center" as const,
                render: (_: unknown, r: any) => (
                  <span className="text-[12px] text-slate-500 font-medium">{r.rate ?? "—"}%</span>
                ),
              },
              {
                title: "Hoa hồng",
                dataIndex: "amount",
                width: 140,
                align: "right" as const,
                render: (v: number, r: any) => {
                  const num = Number(v) || 0;
                  const isCancelled = r.status === "cancelled" || r.status === "rejected";
                  const isSuspect =
                    r.status === "suspect" ||
                    (Array.isArray(r.fraudFlags) && r.fraudFlags.length > 0);
                  const isHeld = r.status === "held" || r.status === "pending_return";

                  if (isCancelled) {
                    return (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-[11px] text-slate-400 line-through">
                          {formatVnd(num)}
                        </span>
                        <span className="text-[12px] font-bold text-rose-600">
                          0 đ <span className="text-[10px] font-normal">(Đã hủy)</span>
                        </span>
                      </div>
                    );
                  }

                  if (isSuspect) {
                    return (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-[12.5px] font-bold text-amber-700">
                          {formatVnd(num)}
                        </span>
                        <span className="rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-700 border border-amber-200">
                          Tạm giữ
                        </span>
                      </div>
                    );
                  }

                  if (isHeld) {
                    return (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-[12.5px] font-semibold text-slate-600">
                          {formatVnd(num)}
                        </span>
                        <span className="text-[10px] text-slate-500">Chờ đối soát</span>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-[13px] font-black text-emerald-700">
                        +{formatVnd(num)}
                      </span>
                      <span className="text-[10px] font-medium text-emerald-600">Được tính</span>
                    </div>
                  );
                },
              },
              {
                title: "Trạng thái",
                dataIndex: "status",
                width: 130,
                align: "center" as const,
                render: (s: string, r: any) => (
                  <div>
                    {statusTag(s)}
                    {Array.isArray(r.fraudFlags) && r.fraudFlags.length ? (
                      <div className="mt-1 text-[10.5px] text-rose-600 leading-tight">
                        {formatFraudFlags(r.fraudFlags)}
                      </div>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />

          {/* Dòng tóm tắt chân bảng tinh gọn */}
          <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-slate-500 px-1">
            <span>
              Hiển thị {rows.length} {rows.length < total ? `trên tổng ${total} đơn` : "đơn"}
            </span>
            <span className="text-slate-600">
              Tổng hoa hồng đơn trang này: <strong className="text-slate-800">{formatVnd(totalHh)}</strong>
            </span>
          </div>

          <div className="mt-2">
            <CtvPagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              itemLabel="đơn"
            />
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
