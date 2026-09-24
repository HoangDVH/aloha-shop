"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Row,
  Select,
  Spin,
  Statistic,
  Table,
  Tag,
} from "antd";
import { App } from "antd";
import {
  useCtvMeBills,
  useCtvMePayoutBank,
  useCtvMeStats,
  useSaveCtvPayoutBank,
} from "../ctvPortalQueries";
import { useCtvPortalUiStore } from "../ctvPortalUiStore";
import { payoutBankSchema, type PayoutBankInput } from "../schemas";
import {
  CTV_COMMISSION_UX,
  formatDt,
  formatPeriodLabel,
  formatVnd,
  monthRange,
} from "../shared/format";
import { visibleRefetchInterval } from "@/lib/visibleRefetchInterval";
import type { BillRow } from "../types";

function PayoutBankFormCard() {
  const { message } = App.useApp();
  const bankQ = useCtvMePayoutBank();
  const saveMut = useSaveCtvPayoutBank();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PayoutBankInput>({
    resolver: zodResolver(payoutBankSchema),
    defaultValues: {
      bankBin: "",
      bankName: "",
      accountNumber: "",
      accountName: "",
    },
  });

  useEffect(() => {
    if (bankQ.data) {
      reset({
        bankBin: bankQ.data.bankBin || "",
        bankName: bankQ.data.bankName || "",
        accountNumber: bankQ.data.accountNumber || "",
        accountName: bankQ.data.accountName || "",
      });
    }
  }, [bankQ.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await saveMut.mutateAsync(values);
      message.success("Đã lưu STK nhận hoa hồng.");
    } catch (e: any) {
      message.error(e?.message || "Lưu thất bại");
    }
  });

  return (
    <Card
      title="Tài khoản ngân hàng nhận hoa hồng"
      className="shadow-sm"
      extra={bankQ.isLoading ? <Spin size="small" /> : null}
    >
      <p className="mb-4 mt-0 text-xs text-slate-500">
        Bắt buộc để shop chuyển khoản khi tới đợt chi. Chỉ bạn và admin vận hành
        được xem.
      </p>
      <form onSubmit={onSubmit}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <label className="text-xs font-semibold text-slate-600">
              Mã NH (BIN)
              <Input className="mt-1" {...register("bankBin")} placeholder="VD: 970422" />
            </label>
            {errors.bankBin ? (
              <p className="mb-0 mt-1 text-xs text-red-600">{errors.bankBin.message}</p>
            ) : null}
          </Col>
          <Col xs={24} sm={12}>
            <label className="text-xs font-semibold text-slate-600">
              Tên ngân hàng
              <Input className="mt-1" {...register("bankName")} placeholder="VD: MB Bank" />
            </label>
            {errors.bankName ? (
              <p className="mb-0 mt-1 text-xs text-red-600">{errors.bankName.message}</p>
            ) : null}
          </Col>
          <Col xs={24} sm={12}>
            <label className="text-xs font-semibold text-slate-600">
              Số tài khoản
              <Input
                className="mt-1"
                {...register("accountNumber")}
                inputMode="numeric"
              />
            </label>
            {errors.accountNumber ? (
              <p className="mb-0 mt-1 text-xs text-red-600">
                {errors.accountNumber.message}
              </p>
            ) : null}
          </Col>
          <Col xs={24} sm={12}>
            <label className="text-xs font-semibold text-slate-600">
              Tên chủ tài khoản
              <Input className="mt-1" {...register("accountName")} />
            </label>
            {errors.accountName ? (
              <p className="mb-0 mt-1 text-xs text-red-600">
                {errors.accountName.message}
              </p>
            ) : null}
          </Col>
          <Col span={24}>
            <Button type="primary" htmlType="submit" loading={saveMut.isPending}>
              Lưu STK
            </Button>
          </Col>
        </Row>
      </form>
    </Card>
  );
}

export function PayoutPanel() {
  const { payRange, setPayRange } = useCtvPortalUiStore();
  const statsQ = useCtvMeStats({ refetchInterval: visibleRefetchInterval(30_000) });
  const billsQ = useCtvMeBills({ refetchInterval: visibleRefetchInterval(30_000) });
  const [billDetail, setBillDetail] = useState<BillRow | null>(null);

  const stats = statsQ.data;
  const bills = billsQ.data || [];

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (!b.period) return true;
      const [y, m] = b.period.split("-").map(Number);
      if (!y || !m) return true;
      const pStart = `${y}-${String(m).padStart(2, "0")}-01`;
      const last = new Date(y, m, 0).getDate();
      const pEnd = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
      return pEnd >= payRange.from && pStart <= payRange.to;
    });
  }, [bills, payRange.from, payRange.to]);

  const totalPaidOut = useMemo(
    () =>
      filteredBills
        .filter((b) => b.billStatus === "paid" || b.paidAt)
        .reduce((s, b) => s + (b.net || 0), 0),
    [filteredBills]
  );
  const totalLocked = useMemo(
    () =>
      filteredBills
        .filter((b) => b.billStatus === "locked" && !b.paidAt)
        .reduce((s, b) => s + (b.net || 0), 0),
    [filteredBills]
  );

  const err = statsQ.error || billsQ.error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-xl font-extrabold text-[#163A2A]">Thanh toán</h1>
        <Select
          className="min-w-[220px]"
          value={`${payRange.from}|${payRange.to}`}
          onChange={(v) => {
            const [from, to] = String(v).split("|");
            setPayRange({ from, to });
          }}
          options={[monthRange(0), monthRange(-1), monthRange(-2)].map((r) => ({
            value: `${r.from}|${r.to}`,
            label: r.label,
          }))}
        />
      </div>

      {err ? (
        <Alert type="error" showIcon message={(err as Error).message} />
      ) : null}

      <PayoutBankFormCard />

      <Card className="shadow-sm">
        <Row gutter={[24, 16]}>
          <Col xs={24} lg={10}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
              Thu nhập của tôi
            </p>
            <p className="mb-2 mt-0 text-sm text-slate-600">
              Tổng số tiền đã thanh toán
            </p>
            <Statistic
              value={formatVnd(totalPaidOut || stats?.paidOut.amount || 0)}
            />
          </Col>
          <Col xs={24} lg={14}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              Chi tiết thu nhập
            </p>
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={6}>
                <Card size="small" className="bg-[#FFFDF8]">
                  <div className="text-[11px] text-slate-500">
                    {CTV_COMMISSION_UX.held.label}
                  </div>
                  <div className="font-extrabold">
                    {formatVnd(stats?.held.amount || 0)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {CTV_COMMISSION_UX.held.explain}
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" className="bg-[#FFFDF8]">
                  <div className="text-[11px] text-slate-500">
                    {CTV_COMMISSION_UX.eligible.label}
                  </div>
                  <div className="font-extrabold">
                    {formatVnd(stats?.eligible.amount || 0)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {CTV_COMMISSION_UX.eligible.explain}
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" className="bg-[#FFFDF8]">
                  <div className="text-[11px] text-slate-500">
                    {CTV_COMMISSION_UX.billed.label}
                  </div>
                  <div className="font-extrabold">
                    {formatVnd(
                      Math.max(stats?.billed.amount || 0, totalLocked)
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {CTV_COMMISSION_UX.billed.explain}
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" className="bg-[#FFFDF8]">
                  <div className="text-[11px] text-slate-500">
                    {CTV_COMMISSION_UX.paid_out.label}
                  </div>
                  <div className="font-extrabold">
                    {formatVnd(stats?.paidOut.amount || 0)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {CTV_COMMISSION_UX.paid_out.explain}
                  </div>
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card
        title="Lịch sử thanh toán"
        className="shadow-sm overflow-hidden"
        styles={{ body: { padding: 0 } }}
      >
        {billsQ.isLoading && !bills.length ? (
          <div className="flex justify-center py-16">
            <Spin />
          </div>
        ) : (
          <Table
            rowKey={(r) => r.period}
            dataSource={filteredBills}
            pagination={false}
            scroll={{ x: 720 }}
            columns={[
              {
                title: "Kỳ hoa hồng",
                dataIndex: "period",
                render: (p: string) => {
                  const lab = formatPeriodLabel(p);
                  return (
                    <div>
                      <div className="font-bold">{lab.title}</div>
                      <div className="text-[11px] text-slate-500">{lab.range}</div>
                    </div>
                  );
                },
              },
              {
                title: "Tháng đơn",
                dataIndex: "period",
                render: (p: string) => p,
              },
              {
                title: "Hoa hồng (₫)",
                dataIndex: "gross",
                align: "right",
                render: (_: number, r: BillRow) =>
                  formatVnd(r.gross ?? r.net),
              },
              {
                title: "Thực nhận (₫)",
                dataIndex: "net",
                align: "right",
                render: (v: number) => formatVnd(v),
              },
              {
                title: "Trạng thái",
                dataIndex: "billStatus",
                render: (s: string, r: BillRow) => {
                  const paid = s === "paid" || r.paidAt;
                  const label = paid
                    ? CTV_COMMISSION_UX.paid_out.label
                    : s === "locked"
                      ? CTV_COMMISSION_UX.billed.label
                      : s || "—";
                  const color = paid
                    ? "cyan"
                    : s === "locked"
                      ? "blue"
                      : "default";
                  return <Tag color={color}>{label}</Tag>;
                },
              },
              {
                title: "Thao tác",
                key: "act",
                render: (_: unknown, r: BillRow) => (
                  <Button type="link" size="small" onClick={() => setBillDetail(r)}>
                    Chi tiết
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={Boolean(billDetail)}
        onCancel={() => setBillDetail(null)}
        footer={null}
        title={
          billDetail
            ? `Chi tiết ${formatPeriodLabel(billDetail.period).title} (${billDetail.period})`
            : "Chi tiết"
        }
      >
        {billDetail ? (
          <div className="space-y-2 text-sm">
            <p>
              Số đơn: <strong>{billDetail.orderCount}</strong>
            </p>
            <p>
              Hoa hồng:{" "}
              <strong>{formatVnd(billDetail.gross ?? billDetail.net)}</strong>
            </p>
            <p>
              Thực nhận: <strong>{formatVnd(billDetail.net)}</strong>
            </p>
            <p>
              Trạng thái:{" "}
              <strong>
                {billDetail.billStatus === "paid" || billDetail.paidAt
                  ? CTV_COMMISSION_UX.paid_out.label
                  : billDetail.billStatus === "locked"
                    ? CTV_COMMISSION_UX.billed.label
                    : billDetail.billStatus}
              </strong>
            </p>
            {billDetail.paidAt ? (
              <p>Ngày nhận: {formatDt(billDetail.paidAt)}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
