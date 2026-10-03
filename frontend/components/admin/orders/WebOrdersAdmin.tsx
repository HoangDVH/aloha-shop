"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Input, Modal, Segmented, Table, Tag, Tooltip } from "antd";
import { RefreshCw, Trash2 } from "lucide-react";
import { siRequest } from "@/lib/siQueries";
import { formatVnd } from "@/lib/api";

type OrderRow = {
  code: string;
  kvOrderCode?: string | null;
  kvInvoiceCode?: string | null;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  total: number;
  paymentStatus: string;
  statusValue?: string;
  isTest?: boolean;
  priceMode?: string;
  voidTestBlock: string | null;
};

type ListRes = { total: number; page: number; limit: number; data: OrderRow[] };
type VoidRes = { ok: true; code: string; kvCancelled: string[] };

const PAYMENT: Record<string, { label: string; color: string }> = {
  unpaid: { label: "Chưa thanh toán", color: "orange" },
  processing: { label: "Đang xử lý", color: "blue" },
  paid: { label: "Đã thanh toán", color: "green" },
  underpaid: { label: "Thiếu tiền", color: "red" },
  expired: { label: "Hết hạn", color: "default" },
  cancelled: { label: "Đã huỷ", color: "default" },
  failed: { label: "Lỗi thanh toán", color: "red" },
  cod: { label: "COD", color: "cyan" },
};

const FILTERS = [
  { label: "Tất cả", value: "" },
  { label: "Chưa thanh toán", value: "unpaid,cod,expired,failed" },
  { label: "Đã huỷ", value: "cancelled" },
];

const PAGE_SIZE = 20;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function WebOrdersAdmin() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("");
  const [target, setTarget] = useState<OrderRow | null>(null);
  const [confirm, setConfirm] = useState("");

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (search) params.set("q", search);
  if (payment) params.set("paymentStatus", payment);
  const query = useQuery({
    queryKey: ["admin", "web-orders", page, search, payment],
    queryFn: () => siRequest<ListRes>(`/api/shop/admin/orders?${params}`),
    refetchOnWindowFocus: false,
  });

  const voidTest = useMutation({
    mutationFn: (row: OrderRow) =>
      siRequest<VoidRes>(`/api/shop/admin/orders/${encodeURIComponent(row.code)}/void-test`, { confirmCode: confirm.trim() }),
    onSuccess: (r) => {
      message.success(
        r.kvCancelled.length
          ? `Đã huỷ ${r.kvCancelled.join(", ")} trên KiotViet và đánh dấu đơn ${r.code} là đơn test`
          : `Đơn ${r.code} chưa có trên KiotViet, đã đánh dấu là đơn test`
      );
      setTarget(null);
      void qc.invalidateQueries({ queryKey: ["admin", "web-orders"] });
    },
  });

  const codesOf = (r: OrderRow) => [r.code, r.kvOrderCode].filter(Boolean).map((c) => String(c).toUpperCase());
  const confirmOk = target ? codesOf(target).includes(confirm.trim().toUpperCase()) : false;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Đơn hàng web</h1>
          <p className="text-xs text-slate-500">
            Huỷ đơn test để KiotViet không tính vào doanh thu. Chỉ huỷ được đơn chưa thanh toán và chưa giao.
          </p>
        </div>
        <Button icon={<RefreshCw size={14} />} onClick={() => void query.refetch()} loading={query.isFetching}>
          Làm mới
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          options={FILTERS}
          value={payment}
          onChange={(v) => {
            setPayment(String(v));
            setPage(1);
          }}
        />
        <Input.Search
          allowClear
          placeholder="Tìm mã đơn (DH…, WEB-…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onSearch={(v) => {
            setSearch(v.trim());
            setPage(1);
          }}
          className="sm:!w-72"
        />
      </div>

      {query.error ? <Alert type="error" showIcon message={(query.error as Error).message} /> : null}

      <Table<OrderRow>
        rowKey="code"
        size="middle"
        loading={query.isLoading}
        dataSource={query.data?.data || []}
        scroll={{ x: 860 }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: query.data?.total || 0,
          showSizeChanger: false,
          onChange: setPage,
        }}
        columns={[
          {
            title: "Mã đơn",
            render: (_, r) => (
              <div className="leading-tight">
                <div className="font-bold text-[#2D5A27]">{r.kvOrderCode || r.code}</div>
                {r.kvOrderCode && r.kvOrderCode !== r.code ? <div className="text-[11px] text-slate-400">{r.code}</div> : null}
                {r.kvInvoiceCode ? <div className="text-[11px] text-slate-400">HĐ {r.kvInvoiceCode}</div> : null}
              </div>
            ),
          },
          { title: "Ngày đặt", width: 120, render: (_, r) => <span className="text-xs">{fmtTime(r.createdAt)}</span> },
          {
            title: "Khách",
            render: (_, r) => (
              <div className="leading-tight">
                <div className="text-sm">{r.customerName || "—"}</div>
                <div className="text-[11px] text-slate-400">{r.customerPhone || ""}</div>
              </div>
            ),
          },
          { title: "Tổng tiền", align: "right", render: (_, r) => <span className="tabular-nums">{formatVnd(r.total)}</span> },
          {
            title: "Trạng thái",
            render: (_, r) => {
              const p = PAYMENT[r.paymentStatus] || { label: r.paymentStatus, color: "default" };
              return (
                <div className="flex flex-wrap items-center gap-1">
                  <Tag color={p.color}>{p.label}</Tag>
                  {r.priceMode === "si" ? <Tag color="purple">Sỉ</Tag> : null}
                  {r.isTest ? <Tag color="magenta">TEST</Tag> : null}
                </div>
              );
            },
          },
          {
            title: "",
            width: 150,
            align: "right",
            render: (_, r) =>
              r.voidTestBlock ? (
                <Tooltip title={r.voidTestBlock}>
                  <span>
                    <Button size="small" disabled icon={<Trash2 size={13} />}>
                      Huỷ đơn test
                    </Button>
                  </span>
                </Tooltip>
              ) : (
                <Button
                  size="small"
                  danger
                  icon={<Trash2 size={13} />}
                  onClick={() => {
                    setTarget(r);
                    setConfirm("");
                    voidTest.reset();
                  }}
                >
                  Huỷ đơn test
                </Button>
              ),
          },
        ]}
      />

      <Modal
        open={!!target}
        title={`Huỷ đơn test ${target?.kvOrderCode || target?.code || ""}`}
        okText="Huỷ trên KiotViet"
        cancelText="Đóng"
        okButtonProps={{ danger: true, disabled: !confirmOk, loading: voidTest.isPending }}
        onOk={() => target && voidTest.mutate(target)}
        onCancel={() => !voidTest.isPending && setTarget(null)}
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
                    KiotViet không cho xoá hẳn qua API; muốn xoá khỏi lịch sử thì xoá tay trên KiotViet.
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
                onPressEnter={() => confirmOk && !voidTest.isPending && voidTest.mutate(target)}
              />
            </div>
            {voidTest.error ? <Alert type="error" showIcon message={(voidTest.error as Error).message} /> : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
