"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  Empty,
  Segmented,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { ChevronRight } from "lucide-react";
import { toast } from "@/components/admin/toast";
import {
  useCtvBills,
  useExportBillExcel,
  useLockBill,
  useMarkBillPaid,
} from "../../ctvQueries";
import {
  billStatusLabel,
  formatPeriodLabel,
  formatVnd,
} from "../../shared/format";
import { PeriodCtvLinesDrawer } from "./PeriodCtvLinesDrawer";
import { CommissionLinesTable } from "./CommissionLinesTable";

const { Text } = Typography;

export function CommissionsHub({
  period: initialPeriod,
  dateRange,
  onExported,
}: {
  period: string;
  dateRange: { from: string; to: string };
  onExported: () => void;
}) {
  const [seg, setSeg] = useState<"dong" | "ky">("dong");
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialPeriod);

  // Cập nhật selectedPeriod khi initialPeriod đổi (từ range)
  useEffect(() => {
    if (initialPeriod) {
      setSelectedPeriod((prev) => {
        // Nếu prev đang có hậu tố K1/K2 của cùng tháng thì giữ nguyên cycle
        const baseM = /^(\d{4}-\d{2})/.exec(initialPeriod);
        const prevM = /^(\d{4}-\d{2})(-K[12])?/.exec(prev);
        if (baseM && prevM && baseM[1] === prevM[1] && prevM[2]) {
          return `${baseM[1]}${prevM[2]}`;
        }
        return initialPeriod;
      });
    }
  }, [initialPeriod]);

  const period = selectedPeriod;
  const [drillCtv, setDrillCtv] = useState<string | null>(null);
  const [listSeedCtv, setListSeedCtv] = useState<string | undefined>();
  const [listSeedPeriod, setListSeedPeriod] = useState<string | undefined>();
  const billQ = useCtvBills(period);
  const lockM = useLockBill();
  const paidM = useMarkBillPaid();
  const exportM = useExportBillExcel();
  const bill = billQ.data?.bill;
  const preview = billQ.data?.preview;
  const billLocked = bill?.status === "locked" || bill?.status === "paid" || bill?.status === "cancelled";
  const tableLines = billLocked
    ? (Array.isArray(bill?.ctvLines) ? bill.ctvLines : [])
    : (Array.isArray(preview?.ctvLines) ? preview!.ctvLines : []);
  const tableTotals = billLocked ? bill?.totals : preview?.totals;

  // Lấy gốc tháng YYYY-MM
  const monthBase = /^(\d{4}-\d{2})/.exec(period)?.[1] || period;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-[#e4ebe3] bg-white shadow-sm">
        <div className="border-b border-[#eef2ee] bg-[#f4f6f4] px-3 py-2.5">
          <div className="mb-1 text-[11px] font-bold tracking-wide text-slate-400 uppercase">
            Thanh toán & đối soát
          </div>
          <Segmented
            block
            value={seg}
            onChange={(v) => setSeg(v as "dong" | "ky")}
            options={[
              { label: "Theo dòng (giao dịch)", value: "dong" },
              { label: "Theo kỳ (thanh toán)", value: "ky" },
            ]}
          />
        </div>

        <div className="p-4">
          {seg === "ky" ? (
            <div className="space-y-4">
              {/* Chọn đợt thanh toán (Bi-weekly) hoặc cả tháng */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e4ebe3] bg-[#fafcfa] px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                    Đợt thanh toán:
                  </span>
                  <Select
                    value={period}
                    onChange={(val) => setSelectedPeriod(val)}
                    style={{ minWidth: 260 }}
                    options={[
                      {
                        value: `${monthBase}-K1`,
                        label: `Đợt 1 (01–15) · ${monthBase}-K1`,
                      },
                      {
                        value: `${monthBase}-K2`,
                        label: `Đợt 2 (16–hết tháng) · ${monthBase}-K2`,
                      },
                      {
                        value: monthBase,
                        label: `Cả tháng (Gộp) · ${monthBase}`,
                      },
                    ]}
                  />
                </div>
                <div className="text-[12px] text-slate-500">
                  {period.endsWith("-K1")
                    ? "Chốt các đơn đủ điều kiện từ ngày 01 đến ngày 15"
                    : period.endsWith("-K2")
                    ? "Chốt từ ngày 16 đến cuối tháng (kèm đơn sót đợt 1)"
                    : "Chốt toàn bộ đơn đủ điều kiện trong cả tháng"}
                </div>
              </div>

              <div className="rounded-xl border border-[#d7e3d2] bg-[#f7faf6] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Tag
                        color={
                          bill?.status === "paid"
                            ? "cyan"
                            : bill?.status === "locked"
                              ? "blue"
                              : "orange"
                        }
                      >
                        {billStatusLabel(bill?.status)}
                      </Tag>
                      <span className="text-[12px] text-slate-500">
                        Statement · {period}
                        {bill?.id ? ` · ${bill.id}` : ""}
                      </span>
                    </div>
                    <h3 className="m-0 text-lg font-extrabold text-[#1a2e1a]">
                      Kỳ thanh toán {formatPeriodLabel(period)}
                    </h3>
                    <p className="mb-0 mt-1 text-sm text-slate-600">
                      {Number(tableTotals?.ctvCount) || 0} CTV ·{" "}
                      {Number(tableTotals?.orderCount) || 0} đơn
                      {bill?.lockedBy ? ` · chốt bởi ${bill.lockedBy}` : ""}
                      {bill?.paidBy ? ` · chi bởi ${bill.paidBy}` : ""}
                    </p>
                    {!billLocked ? (
                      <p className="mb-0 mt-1 text-[12px] text-amber-700">
                        Đang xem trước dòng đủ điều kiện — bấm «Chốt kỳ» để khóa sổ như sàn.
                      </p>
                    ) : null}
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Tổng hoa hồng
                    </div>
                    <div className="text-2xl font-black text-[#2D5A27]">
                      {formatVnd(Number(tableTotals?.commission) || 0)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="primary"
                    loading={lockM.isPending}
                    disabled={billLocked}
                    onClick={() => {
                      const ok = window.confirm(
                        `Chốt kỳ ${period}? Sau khi chốt, các dòng đủ điều kiện sẽ vào kỳ thanh toán.`
                      );
                      if (!ok) return;
                      lockM.mutate(period, {
                        onSuccess: () => toast.success("Đã chốt kỳ"),
                        onError: (e: unknown) => toast.error((e as Error).message),
                      });
                    }}
                  >
                    Chốt kỳ thanh toán
                  </Button>
                  <Button
                    loading={exportM.isPending}
                    disabled={bill?.status !== "locked" && bill?.status !== "paid"}
                    onClick={() => {
                      exportM.mutate(period, {
                        onSuccess: () => {
                          toast.success("Đã tải Excel");
                          onExported();
                        },
                        onError: (e: unknown) => toast.error((e as Error).message),
                      });
                    }}
                  >
                    Xuất Excel chuyển khoản
                  </Button>
                  <Button
                    loading={paidM.isPending}
                    disabled={bill?.status !== "locked"}
                    onClick={() => {
                      const ok = window.confirm(
                        `Xác nhận đã chi ${formatVnd(tableLines.filter((l: any) => !l.paidAt && !l.voidedAt).reduce((sum: number, l: any) => sum + Number(l.net || 0), 0))} cho kỳ ${period}? Kiểm tra số tiền chuyển khoản thực tế trước khi xác nhận.`
                      );
                      if (!ok) return;
                      paidM.mutate({ period, expectedRevision: Number(bill.revision || 0), expectedAmount: tableLines.filter((l: any) => !l.paidAt && !l.voidedAt).reduce((sum: number, l: any) => sum + Number(l.net || 0), 0) }, {
                        onSuccess: () =>
                          toast.success("Đã đánh dấu thanh toán xong"),
                        onError: (e: unknown) => toast.error((e as Error).message),
                      });
                    }}
                  >
                    Đã chuyển khoản xong
                  </Button>
                </div>
              </div>

              {billQ.isLoading ? (
                <Spin />
              ) : tableLines.length ? (
                <Table
                  size="middle"
                  pagination={false}
                  rowKey={(r: any) => String(r.ctvCode || "")}
                  dataSource={tableLines}
                  scroll={{ x: 680 }}
                  onRow={(r: any) => ({
                    onClick: () => {
                      const code = String(r.ctvCode || "").trim();
                      if (code) setDrillCtv(code);
                    },
                    className: "cursor-pointer hover:!bg-[#f3f7f2]",
                  })}
                  columns={[
                    {
                      title: "CTV",
                      key: "ctv",
                      render: (_: unknown, r: any) => (
                        <div>
                          <div className="font-semibold text-[#2D5A27]">{r.ctvCode}</div>
                          {r.ctvName ? (
                            <div className="text-[12px] text-slate-500">{r.ctvName}</div>
                          ) : null}
                        </div>
                      ),
                    },
                    {
                      title: "Đơn",
                      dataIndex: "orderCount",
                      width: 72,
                      render: (n: number) => Number(n) || 0,
                    },
                    {
                      title: "Hoa hồng",
                      dataIndex: "net",
                      align: "right" as const,
                      render: (n: number) => (
                        <span className="font-bold">{formatVnd(Number(n) || 0)}</span>
                      ),
                    },
                    {
                      title: "Điều chỉnh",
                      key: "adjustments",
                      render: (_: unknown, line: any) => <div className="text-xs text-slate-600">
                        <div>{formatVnd(Number(line.adjustments || 0))}</div>
                        {line.debtOffset > 0 && <div>Bù trừ nợ: −{formatVnd(line.debtOffset)}</div>}
                        {(line.adjustmentEntries || []).map((entry: any) => <div key={entry.id}>{entry.orderCode}: {entry.reason} ({formatVnd(entry.amount)})</div>)}
                        {(line.postPaymentAdjustments || []).map((entry: any) => <div key={entry.id}>Thu hồi sau chi · {entry.orderCode}: {formatVnd(entry.amount)}</div>)}
                      </div>,
                    },
                    {
                      title: "Chi CTV",
                      key: "paid",
                      width: 140,
                      render: (_: unknown, l: any) =>
                        l.voidedAt ? <Tag>Đã hủy khoản chi</Tag> : l.paidAt ? (
                          <Tag color="cyan">Đã chi</Tag>
                        ) : bill?.status === "locked" ? (
                          <Button
                            size="small"
                            loading={paidM.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              const ok = window.confirm(
                                `Xác nhận đã chi ${formatVnd(Number(l.net || 0))} cho ${l.ctvCode}${l.debtOffset > 0 ? `, đã bù trừ nợ ${formatVnd(l.debtOffset)}` : ""}?`
                              );
                              if (!ok) return;
                              paidM.mutate(
                                { period, ctvCode: String(l.ctvCode || ""), expectedRevision: Number(bill.revision || 0), expectedAmount: Number(l.net || 0) },
                                {
                                  onSuccess: () =>
                                    toast.success(`Đã chi ${l.ctvCode}`),
                                  onError: (err: unknown) =>
                                    toast.error((err as Error).message),
                                }
                              );
                            }}
                          >
                            {Number(l.net || 0) === 0 && l.debtOffset > 0 ? "Xác nhận bù trừ" : "Chi CTV này"}
                          </Button>
                        ) : (
                          <Text type="secondary">Chưa chốt kỳ</Text>
                        ),
                    },
                    {
                      title: "",
                      key: "detail",
                      width: 128,
                      align: "right" as const,
                      render: () => (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2D5A27]">
                          Xem chi tiết
                          <ChevronRight size={16} aria-hidden />
                        </span>
                      ),
                    },
                  ]}
                />
              ) : (
                <Empty description="Chưa có hoa hồng đủ điều kiện trong kỳ này" />
              )}
            </div>
          ) : null}

          <PeriodCtvLinesDrawer
            open={Boolean(drillCtv)}
            ctvCode={drillCtv || ""}
            period={period}
            billStatus={bill?.status}
            onClose={() => setDrillCtv(null)}
            onOpenFullList={(code) => {
              setListSeedCtv(code);
              setListSeedPeriod(period);
              setSeg("dong");
              setDrillCtv(null);
            }}
            onPayCtv={
              bill?.status === "locked"
                ? (code) => {
                    const line = tableLines.find((l: any) => l.ctvCode === code && !l.paidAt && !l.voidedAt);
                    if (!line) { toast.error("Không còn khoản chi cho CTV này."); return; }
                    const ok = window.confirm(
                      `Xác nhận đã chi ${formatVnd(Number(line.net || 0))} cho ${code}?`
                    );
                    if (!ok) return;
                    paidM.mutate(
                      { period, ctvCode: code, expectedRevision: Number(bill.revision || 0), expectedAmount: Number(line.net || 0) },
                      {
                        onSuccess: () => toast.success(`Đã chi ${code}`),
                        onError: (e: unknown) => toast.error((e as Error).message),
                      }
                    );
                  }
                : undefined
            }
            payPending={paidM.isPending}
          />

          {seg === "dong" ? (
            <CommissionLinesTable
              embedded
              initialCtv={listSeedCtv}
              initialPeriod={listSeedPeriod}
              onGoPeriod={() => setSeg("ky")}
              hubPeriod={period}
              hubRange={dateRange}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
