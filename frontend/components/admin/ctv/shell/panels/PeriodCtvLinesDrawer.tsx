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
  const pageSize = 20;

  useEffect(() => {
    if (open) {
      setPage(1);
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
            Kỳ {formatPeriodLabel(period)} ({period})
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
              className="!bg-[#2D5A27] hover:!bg-[#23471f]"
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
      {/* Khối Quyết toán dòng tiền (Settlement Breakdown) chuẩn Shopee / TikTok Shop */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <div className="border-b border-slate-100 bg-[#f8faf8] px-4 py-2.5 flex items-center justify-between">
          <div className="text-[12px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <span>Sao kê quyết toán kỳ này</span>
            {billStatus ? (
              <Tag color={billStatus === "paid" ? "cyan" : billStatus === "locked" ? "blue" : "orange"} className="!mr-0">
                {billStatusLabel(billStatus)}
              </Tag>
            ) : null}
          </div>
          <span className="text-[11.5px] text-slate-500">
            {ctvName ? `${ctvName} · ` : ""}{ctvCode}
          </span>
        </div>

        <div className="p-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Hoa hồng đơn hàng */}
            <div className="rounded-xl border border-slate-200 bg-[#fbfcfb] p-3">
              <div className="text-[11.5px] font-medium text-slate-500">
                1. Hoa hồng được duyệt
              </div>
              <div className="mt-1 text-[17px] font-extrabold text-slate-800">
                {formatVnd(grossAmount)}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                {validOrderCount} đơn hợp lệ trong kỳ
              </div>
            </div>

            {/* 2. Cấn trừ nợ hoàn hàng */}
            <div
              className={`rounded-xl border p-3 ${
                hasDebt
                  ? "border-rose-200 bg-rose-50/50 text-rose-900"
                  : "border-slate-200 bg-[#fbfcfb] text-slate-600"
              }`}
            >
              <div className="flex items-center justify-between text-[11.5px] font-medium">
                <span>2. Giảm trừ / Hoàn nợ</span>
                {hasDebt ? (
                  <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-700">
                    {adjustmentEntriesCount} khoản
                  </span>
                ) : null}
              </div>
              <div
                className={`mt-1 text-[17px] font-extrabold ${
                  hasDebt ? "text-rose-600" : "text-slate-400"
                }`}
              >
                {hasDebt ? `−${formatVnd(debtOffset)}` : "0 đ"}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {hasDebt ? "Cấn trừ nợ trả hàng kỳ này" : "Không có khoản nợ tồn"}
              </div>
            </div>

            {/* 3. Tiền thực chi (Net Payout) */}
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 text-emerald-950 shadow-xs">
              <div className="text-[11.5px] font-bold text-emerald-800">
                3. Thực chi cho CTV (= 1 − 2)
              </div>
              <div className="mt-1 text-[19px] font-black text-[#2D5A27]">
                {formatVnd(netAmount)}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-emerald-700">
                Số tiền chuyển khoản
              </div>
            </div>
          </div>

          {/* Chi tiết từng đơn bị cấn trừ nợ */}
          {hasDebt ? (
            <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/40 p-2.5 text-xs">
              <div className="mb-1.5 font-bold text-rose-800 text-[11.5px]">
                Chi tiết các khoản cấn trừ hoàn hàng / thu hồi:
              </div>
              <div className="space-y-1.5">
                {(selectedLine?.adjustmentEntries || []).map((entry: any) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-rose-100 bg-white/90 px-2.5 py-1.5"
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
                    className="flex items-center justify-between rounded-lg border border-rose-100 bg-white/90 px-2.5 py-1.5"
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
            </div>
          ) : null}
        </div>
      </div>

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
              <span className="font-semibold text-emerald-800">Đơn đủ điều kiện:</span> Đã hết hạn đổi/trả và hợp lệ để đưa vào kỳ thanh toán.
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
              <span className="font-semibold text-slate-800">Tất cả đơn phát sinh:</span> Toàn bộ các dòng hoa hồng của CTV trong kỳ (đang giữ đổi trả, cảnh báo gian lận, đủ điều kiện, và đơn hủy/hoàn).
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
            scroll={{ x: 920 }}
            columns={[
              {
                title: "Click",
                dataIndex: "clickAt",
                width: 120,
                render: (v: string | null) => (
                  <span className="whitespace-nowrap text-slate-600 text-xs">{formatDt(v)}</span>
                ),
              },
              {
                title: "Mua",
                dataIndex: "purchasedAt",
                width: 120,
                render: (v: string | null) => (
                  <span className="whitespace-nowrap text-slate-600 text-xs">{formatDt(v)}</span>
                ),
              },
              {
                title: "Đơn",
                dataIndex: "displayOrderCode",
                render: (v: string, r: any) => {
                  const code = String(v || r.orderCode || "").trim();
                  if (!code) return "—";
                  const isDebtOrder = debtOrderCodes.has(code);
                  return (
                    <div className="flex flex-col items-start gap-0.5">
                      <Link
                        href={`/don-hang/${encodeURIComponent(r.orderCode || code)}`}
                        className="font-bold text-[#2D5A27] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        #{code}
                      </Link>
                      {isDebtOrder ? (
                        <span className="inline-block rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-700 border border-rose-200">
                          Thu hồi nợ cấn trừ
                        </span>
                      ) : null}
                    </div>
                  );
                },
              },
              { title: "SP", dataIndex: "ma", width: 88 },
              {
                title: "DT",
                dataIndex: "lineTotal",
                width: 95,
                render: (v: number) => formatVnd(Number(v) || 0),
              },
              {
                title: "%",
                width: 50,
                render: (_: unknown, r: any) => `${r.rate ?? "—"}%`,
              },
              {
                title: "HH",
                dataIndex: "amount",
                width: 130,
                render: (v: number, r: any) => {
                  const num = Number(v) || 0;
                  const isCancelled = r.status === "cancelled" || r.status === "rejected";
                  const isSuspect =
                    r.status === "suspect" ||
                    (Array.isArray(r.fraudFlags) && r.fraudFlags.length > 0);
                  const isHeld = r.status === "held" || r.status === "pending_return";

                  if (isCancelled) {
                    return (
                      <div className="flex flex-col items-start leading-tight">
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
                      <div className="flex flex-col items-start leading-tight">
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
                      <div className="flex flex-col items-start leading-tight">
                        <span className="text-[12.5px] font-semibold text-slate-600">
                          {formatVnd(num)}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Chờ đối soát
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col items-start leading-tight">
                      <span className="text-[13px] font-extrabold text-emerald-700">
                        +{formatVnd(num)}
                      </span>
                      <span className="text-[10px] font-medium text-emerald-600">
                        Được tính
                      </span>
                    </div>
                  );
                },
              },
              {
                title: "TT",
                dataIndex: "status",
                width: 130,
                render: (s: string, r: any) => (
                  <div>
                    {statusTag(s)}
                    {Array.isArray(r.fraudFlags) && r.fraudFlags.length ? (
                      <div className="mt-1 text-[11px] text-rose-600 leading-tight">
                        {formatFraudFlags(r.fraudFlags)}
                      </div>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />

          {/* Footer tổng kết dòng tiền dưới bảng */}
          <div className="mt-3 rounded-xl border border-slate-200 bg-[#f8faf8] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-slate-600">
              <span className="font-semibold text-slate-700">Tổng kết bảng:</span>{" "}
              {activeTab === "all" ? (
                <span>
                  {total} đơn phát sinh ({rows.filter((r: any) => r.status === "billed" || r.status === "eligible" || r.status === "paid_out").length} đơn tính hoa hồng · {rows.filter((r: any) => r.status === "cancelled" || r.status === "rejected").length} đơn hủy · {rows.filter((r: any) => r.status === "suspect" || (Array.isArray(r.fraudFlags) && r.fraudFlags.length)).length} đơn tạm giữ)
                </span>
              ) : (
                <span>
                  {total} đơn trong đợt thanh toán này
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 font-medium">
              {hasDebt && (activeTab === "billed" || activeTab === "eligible") ? (
                <>
                  <span className="text-slate-700">Hoa hồng: <strong>{formatVnd(grossAmount)}</strong></span>
                  <span className="text-rose-600">Trừ nợ: <strong>−{formatVnd(debtOffset)}</strong></span>
                  <span className="text-[#2D5A27] font-black text-[13px]">
                    = Thực chi: {formatVnd(netAmount)}
                  </span>
                </>
              ) : (
                <span className="text-[#2D5A27] font-bold text-[13px]">
                  Tổng hoa hồng trang này: {formatVnd(totalHh)}
                </span>
              )}
            </div>
          </div>

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
