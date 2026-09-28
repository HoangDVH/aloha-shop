"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Table,
  Tabs,
} from "antd";
import { Filter, Search } from "lucide-react";
import { toast } from "@/components/admin/toast";
import {
  useClearCommissionFlag,
  useClearSoftFraudFlags,
  useConfirmCommissionFraud,
  useCtvCommissions,
} from "../../ctvQueries";
import { CtvPagination } from "../../shared/CtvPagination";
import {
  AdminRefreshingBadge,
  AdminTableSkeleton,
} from "@/components/admin/ui/AdminSkeleton";
import { getCommissionLinesColumns } from "./commissionLinesColumns";

export function CommissionLinesTable({
  embedded = false,
  initialCtv,
  initialPeriod,
  onGoPeriod,
  hubPeriod,
  hubRange,
}: {
  embedded?: boolean;
  initialCtv?: string;
  initialPeriod?: string;
  onGoPeriod?: () => void;
  hubPeriod?: string;
  hubRange?: { from: string; to: string };
}) {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [filterCtv, setFilterCtv] = useState("");
  const [appliedCtv, setAppliedCtv] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [appliedPeriod, setAppliedPeriod] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    if (!initialCtv) return;
    const code = String(initialCtv).trim().toUpperCase();
    if (!code) return;
    setFilterCtv(code);
    setAppliedCtv(code);
    setPage(1);
  }, [initialCtv]);

  useEffect(() => {
    if (!initialPeriod) return;
    const p = String(initialPeriod).trim();
    if (!/^\d{4}-\d{2}(-K[12])?$/.test(p)) return;
    setFilterPeriod(p);
    setAppliedPeriod(p);
    setPage(1);
  }, [initialPeriod]);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [status, qDebounced, appliedCtv, appliedPeriod, hubRange?.from, hubRange?.to]);

  const { data, isLoading, isError, error, refetch, isFetching } = useCtvCommissions({
    status,
    q: qDebounced || undefined,
    ctvCode: appliedCtv || undefined,
    period: appliedPeriod || undefined,
    from: !appliedPeriod && hubRange?.from ? hubRange.from : undefined,
    to: !appliedPeriod && hubRange?.to ? hubRange.to : undefined,
    page,
    limit: pageSize,
  });
  const clearFlag = useClearCommissionFlag();
  const confirmFraud = useConfirmCommissionFraud();
  const clearSoft = useClearSoftFraudFlags();
  const rows = data?.data || [];
  const total = Number(data?.total) || rows.length;
  const filterActive = Boolean(appliedCtv || appliedPeriod);

  const columns = useMemo(
    () => getCommissionLinesColumns({ clearFlag, confirmFraud }),
    [clearFlag, confirmFraud]
  );

  const headerExtra = (
    <Button
      size="small"
      loading={clearSoft.isPending}
      onClick={() => {
        const ok = window.confirm(
          "Gỡ tất cả cờ chỉ do trùng SĐT (không phải tự mua)? Các dòng self-buy sẽ giữ nguyên."
        );
        if (!ok) return;
        clearSoft.mutate(undefined, {
          onSuccess: (r: any) =>
            toast.success(`Đã gỡ ${r.modified || 0} dòng cờ mềm`),
          onError: (e: unknown) => toast.error((e as Error).message),
        });
      }}
    >
      Gỡ cờ trùng SĐT (hàng loạt)
    </Button>
  );

  const wrap = (children: React.ReactNode) =>
    embedded ? (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-[15px] font-bold text-[#1a2e1a]">
            Theo dòng · giao dịch hoa hồng
          </h3>
          {headerExtra}
        </div>
        {children}
      </div>
    ) : (
      <Card
        bordered={false}
        className="shadow-sm"
        title="Danh sách dòng hoa hồng"
        extra={headerExtra}
      >
        {children}
      </Card>
    );

  return wrap(
    <>
      <Tabs
        activeKey={status || "all"}
        onChange={(k) => setStatus(k === "all" ? undefined : k)}
        items={[
          { key: "all", label: "Tất cả" },
          { key: "held", label: "Đang giữ" },
          { key: "eligible", label: "Đủ điều kiện" },
          { key: "billed", label: "Đã vào kỳ" },
          { key: "paid_out", label: "Đã thanh toán" },
          { key: "cancelled", label: "Đã hủy" },
          { key: "flagged", label: "Nghi gian lận" },
        ]}
        className="!mb-3"
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          allowClear
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên CTV, mã đơn…"
          prefix={<Search size={15} className="text-slate-400" />}
          className="min-w-[220px] flex-1 sm:max-w-md"
        />
        <Dropdown
          open={filterOpen}
          onOpenChange={setFilterOpen}
          trigger={["click"]}
          dropdownRender={() => (
            <div className="w-[280px] rounded-xl border border-[#e4ebe3] bg-white p-3 shadow-lg">
              <p className="mb-2 mt-0 text-[12px] font-bold uppercase tracking-wide text-slate-400">
                Bộ lọc
              </p>
              <label className="mb-1 block text-[12px] font-semibold text-slate-600">
                Mã CTV
              </label>
              <Input
                allowClear
                value={filterCtv}
                onChange={(e) => setFilterCtv(e.target.value.toUpperCase())}
                placeholder="VD: NGUYENVANC"
                className="mb-3"
              />
              <label className="mb-1 block text-[12px] font-semibold text-slate-600">
                Kỳ thanh toán
              </label>
              <Input
                allowClear
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value.trim())}
                placeholder="VD: 2026-09, 2026-09-K1..."
                className="mb-3"
              />
              <label className="mb-1 block text-[12px] font-semibold text-slate-600">
                Trạng thái
              </label>
              <select
                value={status || "all"}
                onChange={(e) =>
                  setStatus(e.target.value === "all" ? undefined : e.target.value)
                }
                className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
              >
                <option value="all">Tất cả</option>
                <option value="held">Đang giữ</option>
                <option value="eligible">Đủ điều kiện</option>
                <option value="billed">Đã vào kỳ</option>
                <option value="paid_out">Đã thanh toán</option>
                <option value="cancelled">Đã hủy</option>
                <option value="flagged">Nghi gian lận</option>
              </select>
              <div className="flex justify-end gap-2">
                <Button
                  size="small"
                  onClick={() => {
                    setFilterCtv("");
                    setAppliedCtv("");
                    setFilterPeriod("");
                    setAppliedPeriod("");
                    setStatus(undefined);
                    setFilterOpen(false);
                  }}
                >
                  Xóa lọc
                </Button>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    setAppliedCtv(filterCtv.trim());
                    setAppliedPeriod(filterPeriod.trim());
                    setFilterOpen(false);
                  }}
                >
                  Áp dụng
                </Button>
              </div>
            </div>
          )}
        >
          <Button
            icon={<Filter size={14} />}
            className={filterActive ? "!border-[#2D5A27] !text-[#2D5A27]" : undefined}
          >
            Lọc{filterActive ? ` · ${[appliedCtv && "CTV", appliedPeriod && "Kỳ"].filter(Boolean).length}` : ""}
          </Button>
        </Dropdown>
      </div>

      {isLoading && !data ? (
        <AdminTableSkeleton
          rows={8}
          cols={9}
          headers={[
            "Click",
            "Mua",
            "CTV",
            "Đơn",
            "SP",
            "DT",
            "%",
            "HH",
            "TT",
          ]}
        />
      ) : null}
      {isError && !data ? (
        <Alert
          type="error"
          message={(error as Error).message}
          action={<Button onClick={() => void refetch()}>Thử lại</Button>}
        />
      ) : null}
      {!isLoading && !rows.length ? (
        <Empty
          description={
            <div className="space-y-2">
              <p className="m-0">Chưa có dòng hoa hồng theo bộ lọc hiện tại.</p>
              <p className="m-0 text-[12px] text-slate-500">
                Đang giữ / chưa đủ điều kiện sẽ không nằm trong kỳ thanh toán. Xem kỳ{" "}
                <b>{hubPeriod || appliedPeriod || "hiện tại"}</b> để chốt chi.
              </p>
              {onGoPeriod ? (
                <Button type="link" onClick={onGoPeriod}>
                  Sang tab Theo kỳ (thanh toán)
                </Button>
              ) : null}
            </div>
          }
        />
      ) : null}
      {rows.length ? (
        <>
          <div className="mb-1 flex justify-end">
            <AdminRefreshingBadge show={Boolean(isFetching && data)} />
          </div>
          <Table
            size="middle"
            rowKey={(r) => String(r.id)}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 1480 }}
            columns={columns}
          />
          <CtvPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            itemLabel="dòng HH"
          />
        </>
      ) : null}
    </>
  );
}
