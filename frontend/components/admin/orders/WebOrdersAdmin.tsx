"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Drawer, Input, Modal, Pagination, Popover, Segmented, Table, Tag, Tooltip } from "antd";
import { AlertTriangle, ChevronRight, HelpCircle, Info, Phone, RefreshCw, Search, Trash2 } from "lucide-react";
import { siRequest } from "@/lib/siQueries";
import { formatVnd } from "@/lib/api";
import { WholesaleOrderCheck } from "./WholesaleOrderCheck";
import { PaymentVerificationNotice } from "./PaymentVerificationNotice";

type OrderRow = {
  code: string;
  kvOrderCode?: string | null;
  kvInvoiceCode?: string | null;
  kvDeliveryAddress?: { state: string; reason?: string; original?: { province: string; district?: string; ward: string }; current?: { province: string; ward: string } };
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  total: number;
  paymentStatus: string;
  kvPaymentVerification?: { state: string; reason: string; attempts: number };
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
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);
  const [policyCode, setPolicyCode] = useState<string | null>(null);
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
      setDetailOrder(null);
      void qc.invalidateQueries({ queryKey: ["admin", "web-orders"] });
    },
  });

  const codesOf = (r: OrderRow) => [r.code, r.kvOrderCode].filter(Boolean).map((c) => String(c).toUpperCase());
  const confirmOk = target ? codesOf(target).includes(confirm.trim().toUpperCase()) : false;

  const totalCount = query.data?.total ?? 0;
  const orders = query.data?.data || [];

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden md:p-6 md:space-y-4">
      {/* 1A. ĐIỀU KHIỂN TRÊN DESKTOP */}
      <div className="hidden md:block space-y-4">
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
        <div className="flex items-center justify-between gap-3">
          <Segmented
            options={FILTERS}
            value={payment}
            onChange={(v) => {
              setPayment(String(v));
              setPage(1);
            }}
          />
          <div className="w-72">
            <Input
              prefix={<Search size={15} className="text-slate-400 mr-1.5 shrink-0" />}
              allowClear
              placeholder="Tìm mã đơn (DH…, WEB-…)"
              value={q}
              onChange={(e) => {
                const val = e.target.value;
                setQ(val);
                if (!val) {
                  setSearch("");
                  setPage(1);
                }
              }}
              onPressEnter={() => {
                setSearch(q.trim());
                setPage(1);
              }}
              suffix={
                q.trim() && q.trim() !== search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch(q.trim());
                      setPage(1);
                    }}
                    className="text-[11px] font-bold text-[#2D5A27] hover:underline px-1 py-0.5 rounded cursor-pointer"
                  >
                    Tìm
                  </button>
                ) : null
              }
              className="h-9 rounded-xl border-slate-200 bg-slate-50/70 text-xs focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* 1B. KHỐI ĐIỀU KHIỂN TRÊN MOBILE (HEADER + TABS + UNIFIED SEARCH) */}
      <div className="md:hidden p-3.5 space-y-2.5 border-b border-slate-100">
        {/* Header 1 dòng gọn gàng */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-bold text-slate-900">Đơn hàng web</h1>
            {totalCount > 0 ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                {totalCount}
              </span>
            ) : null}
            <Popover
              content={
                <div className="max-w-[260px] text-xs text-slate-600 leading-relaxed">
                  Huỷ đơn test để KiotViet không tính vào doanh thu. Chỉ huỷ được đơn chưa thanh toán và chưa giao.
                </div>
              }
              trigger="click"
            >
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-0.5"
                aria-label="Xem hướng dẫn đơn test"
              >
                <HelpCircle size={15} />
              </button>
            </Popover>
          </div>
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition"
            aria-label="Làm mới danh sách đơn"
          >
            <RefreshCw size={14} className={query.isFetching ? "animate-spin text-[#2D5A27]" : ""} />
          </button>
        </div>

        {/* Flat Tabs vuốt ngang mượt mà */}
        <div className="flex items-stretch border-b border-slate-100 -mx-3.5 px-3.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => {
            const isActive = payment === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setPayment(f.value);
                  setPage(1);
                }}
                className={`relative py-2 px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? "text-[#2D5A27]"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>{f.label}</span>
                {isActive ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#2D5A27]" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Thanh tìm kiếm nguyên khối chuẩn iOS / Shopee (Kính lúp nằm trong, không lệch) */}
        <div className="relative w-full">
          <Input
            prefix={<Search size={15} className="text-slate-400 mr-1.5 shrink-0" />}
            allowClear
            placeholder="Tìm mã đơn (DH…, WEB-…)"
            value={q}
            onChange={(e) => {
              const val = e.target.value;
              setQ(val);
              if (!val) {
                setSearch("");
                setPage(1);
              }
            }}
            onPressEnter={() => {
              setSearch(q.trim());
              setPage(1);
            }}
            suffix={
              q.trim() && q.trim() !== search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch(q.trim());
                    setPage(1);
                  }}
                  className="text-[11px] font-bold text-[#2D5A27] hover:underline px-1 py-0.5 rounded cursor-pointer"
                >
                  Tìm
                </button>
              ) : null
            }
            className="w-full h-9 rounded-xl border-slate-200 bg-slate-50/70 text-xs focus:bg-white transition"
          />
        </div>
      </div>

      {query.error ? (
        <div className="p-3 md:p-0">
          <Alert type="error" showIcon message={(query.error as Error).message} />
        </div>
      ) : null}

      {/* 2A. BẢNG DỮ LIỆU ĐẦY ĐỦ TRÊN DESKTOP (TABLE CHO MÁY TÍNH) */}
      <div className="hidden md:block">
        <Table<OrderRow>
          rowKey="code"
          size="middle"
          loading={query.isLoading}
          dataSource={orders}
          scroll={{ x: 860 }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: totalCount,
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
            { title: "Điều kiện sỉ", render: (_, r) => r.priceMode === "si" ? <Button size="small" onClick={() => setPolicyCode(r.code)}>Kiểm tra</Button> : "—" },
            {
              title: "Trạng thái",
              render: (_, r) => {
                const p = PAYMENT[r.paymentStatus] || { label: r.paymentStatus, color: "default" };
                return (
                  <div className="flex flex-wrap items-center gap-1">
                    <Tag color={p.color}>{p.label}</Tag>
                    {["unpaid", "processing", "underpaid", "expired", "failed"].includes(r.paymentStatus) && r.kvPaymentVerification?.state === "pending" && <PaymentVerificationNotice code={r.code} reason={r.kvPaymentVerification.reason} attempts={r.kvPaymentVerification.attempts} />}
                    {r.priceMode === "si" ? <Tag color="purple">Sỉ</Tag> : null}
                    {r.kvDeliveryAddress?.state === "needs_review" ? <Tooltip title={r.kvDeliveryAddress.reason}><Tag color="orange">Cần xác nhận địa chỉ 2 cấp</Tag></Tooltip> : r.kvDeliveryAddress?.current ? <Tooltip title={`Đã gửi KiotViet: ${r.kvDeliveryAddress.current.ward}, ${r.kvDeliveryAddress.current.province}. Địa chỉ gốc: ${[r.kvDeliveryAddress.original?.ward, r.kvDeliveryAddress.original?.district, r.kvDeliveryAddress.original?.province].filter(Boolean).join(", ")}`}><Tag color="blue">Địa chỉ 2 cấp</Tag></Tooltip> : null}
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
      </div>

      {/* 2B. DANH SÁCH ĐƠN HÀNG MOBILE DẠNG PHẲNG LIỀN MẠCH (OPTION 2: CHUẨN IOS / APPS NGÂN HÀNG / KIOTVIET) */}
      <div className="block md:hidden">
        {query.isLoading ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-28 bg-slate-200 rounded" />
                  <div className="h-4 w-16 bg-slate-200 rounded" />
                </div>
                <div className="h-3 w-40 bg-slate-200 rounded" />
                <div className="flex items-center justify-between pt-1">
                  <div className="h-4 w-24 bg-slate-200 rounded" />
                  <div className="h-6 w-16 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Không có đơn hàng nào phù hợp
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((r) => {
              const p = PAYMENT[r.paymentStatus] || { label: r.paymentStatus, color: "default" };
              return (
                <div
                  key={r.code}
                  onClick={() => setDetailOrder(r)}
                  className="group relative p-3.5 transition hover:bg-slate-50/70 active:bg-slate-100/70 cursor-pointer space-y-2"
                >
                  {/* Hàng 1: Mã đơn, Trạng thái & Gợi ý xem chi tiết */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-[#2D5A27] tracking-tight">
                          {r.kvOrderCode || r.code}
                        </span>
                        <ChevronRight size={14} className="text-slate-400 group-hover:text-[#2D5A27] transition shrink-0" />
                      </div>
                      {r.kvOrderCode && r.kvOrderCode !== r.code ? (
                        <div className="text-[10.5px] text-slate-400">Web: {r.code}</div>
                      ) : null}
                      {r.kvInvoiceCode ? (
                        <div className="text-[10.5px] text-slate-400 font-medium">HĐ: {r.kvInvoiceCode}</div>
                      ) : null}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <Tag color={p.color} className="mr-0 text-xs font-semibold">
                        {p.label}
                      </Tag>
                      <div className="flex items-center gap-1">
                        {r.priceMode === "si" ? (
                          <Tag color="purple" className="mr-0 text-[10px]">
                            Sỉ
                          </Tag>
                        ) : null}
                        {r.isTest ? (
                          <Tag color="magenta" className="mr-0 text-[10px]">
                            TEST
                          </Tag>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Hàng 2: Khách hàng & Thời gian đặt */}
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <div className="min-w-0 truncate pr-2">
                      <span className="font-semibold text-slate-800">
                        {r.customerName || "Khách mua web"}
                      </span>
                      {r.customerPhone ? (
                        <span className="text-slate-400 ml-1.5 font-normal">
                          ({r.customerPhone})
                        </span>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-[11px] text-slate-400 tabular-nums">
                      {fmtTime(r.createdAt)}
                    </div>
                  </div>

                  {/* Hàng 3: Cảnh báo địa chỉ KiotViet nếu có */}
                  {r.kvDeliveryAddress?.state === "needs_review" ? (
                    <div className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800 leading-snug">
                      ⚠️ {r.kvDeliveryAddress.reason || "Cần xác nhận lại địa chỉ 2 cấp"}
                    </div>
                  ) : null}
                  {["unpaid", "processing", "underpaid", "expired", "failed"].includes(r.paymentStatus) &&
                  r.kvPaymentVerification?.state === "pending" ? (
                    <PaymentVerificationNotice
                      code={r.code}
                      reason={r.kvPaymentVerification.reason}
                      attempts={r.kvPaymentVerification.attempts}
                    />
                  ) : null}

                  {/* Hàng 4: Tổng tiền & Nút thao tác nhanh */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-[11px] text-slate-400 mr-1.5">Tổng tiền:</span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                        {formatVnd(r.total)}
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.priceMode === "si" ? (
                        <Button size="small" onClick={() => setPolicyCode(r.code)}>
                          Xem sỉ
                        </Button>
                      ) : null}
                      {r.voidTestBlock ? (
                        <Tooltip title={r.voidTestBlock}>
                          <span>
                            <Button size="small" disabled icon={<Trash2 size={13} />}>
                              Huỷ test
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
                          Huỷ test
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Phân trang cho Mobile */}
        {totalCount > PAGE_SIZE ? (
          <div className="flex justify-center py-3 border-t border-slate-100 bg-slate-50/40">
            <Pagination
              size="small"
              current={page}
              pageSize={PAGE_SIZE}
              total={totalCount}
              showSizeChanger={false}
              onChange={setPage}
            />
          </div>
        ) : null}
      </div>

      {/* 3. BOTTOM SHEET (DRAWER TRƯỢT LÊN XEM 100% CHI TIẾT ĐƠN HÀNG TRÊN MOBILE CHUẨN SHOPEE/TIKTOK) */}
      <Drawer
        open={Boolean(detailOrder)}
        onClose={() => setDetailOrder(null)}
        placement="bottom"
        height="auto"
        destroyOnHidden
        styles={{
          body: { padding: "16px 18px calc(24px + env(safe-area-inset-bottom, 0px))", maxHeight: "85vh", overflowY: "auto" },
          header: { borderBottom: "1px solid #f1f5f9", padding: "14px 18px" },
          content: { borderTopLeftRadius: "20px", borderTopRightRadius: "20px" },
        }}
        title={
          <div className="flex items-center justify-between">
            <span className="font-bold text-base text-[#2D5A27]">
              Chi tiết đơn {detailOrder?.kvOrderCode || detailOrder?.code}
            </span>
          </div>
        }
      >
        {detailOrder ? (
          <div className="space-y-4 text-xs">
            {/* Khối 1: Thông tin mã đơn & Thời gian */}
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Mã đơn KiotViet:</span>
                <span className="font-bold text-slate-900">{detailOrder.kvOrderCode || "Chưa có"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Mã đơn Web:</span>
                <span className="font-semibold text-slate-800">{detailOrder.code}</span>
              </div>
              {detailOrder.kvInvoiceCode ? (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Mã hoá đơn KiotViet:</span>
                  <span className="font-semibold text-slate-800">HĐ {detailOrder.kvInvoiceCode}</span>
                </div>
              ) : null}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Thời gian đặt:</span>
                <span className="text-slate-700">{fmtTime(detailOrder.createdAt)}</span>
              </div>
            </div>

            {/* Khối 2: Thông tin khách hàng & Trạng thái */}
            <div className="rounded-xl border border-slate-200/90 p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-bold text-slate-900">{detailOrder.customerName || "Khách lẻ"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Số điện thoại:</span>
                {detailOrder.customerPhone ? (
                  <a
                    href={`tel:${detailOrder.customerPhone}`}
                    className="inline-flex items-center gap-1 font-semibold text-[#2D5A27] hover:underline"
                  >
                    <Phone size={12} />
                    <span>{detailOrder.customerPhone}</span>
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                <span className="text-slate-500">Thanh toán:</span>
                <Tag color={PAYMENT[detailOrder.paymentStatus]?.color || "default"} className="mr-0 font-semibold">
                  {PAYMENT[detailOrder.paymentStatus]?.label || detailOrder.paymentStatus}
                </Tag>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Phân loại:</span>
                <div className="flex items-center gap-1">
                  {detailOrder.priceMode === "si" ? <Tag color="purple" className="mr-0">Đơn sỉ</Tag> : <Tag color="blue" className="mr-0">Đơn lẻ</Tag>}
                  {detailOrder.isTest ? <Tag color="magenta" className="mr-0">Đơn TEST</Tag> : null}
                </div>
              </div>
            </div>

            {/* Khối 3: Địa chỉ KiotViet 2 cấp (đầy đủ như desktop tooltip) */}
            {detailOrder.kvDeliveryAddress?.state === "needs_review" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1 text-amber-900">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                  <span>Cần xác nhận lại địa chỉ 2 cấp KiotViet</span>
                </div>
                <div className="text-[11.5px] leading-relaxed">{detailOrder.kvDeliveryAddress.reason}</div>
              </div>
            ) : detailOrder.kvDeliveryAddress?.current ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 space-y-1.5 text-blue-950">
                <div className="font-bold text-blue-800 flex items-center gap-1">
                  <Tag color="blue" className="mr-0">Địa chỉ 2 cấp KiotViet</Tag>
                </div>
                <div className="text-[11.5px] leading-relaxed">
                  <span className="text-slate-500">Đã gửi KiotViet: </span>
                  <span className="font-semibold">{detailOrder.kvDeliveryAddress.current.ward}, {detailOrder.kvDeliveryAddress.current.province}</span>
                </div>
                {detailOrder.kvDeliveryAddress.original ? (
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    <span>Địa chỉ gốc: </span>
                    {[detailOrder.kvDeliveryAddress.original.ward, detailOrder.kvDeliveryAddress.original.district, detailOrder.kvDeliveryAddress.original.province].filter(Boolean).join(", ")}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Khối 4: Trạng thái xác minh KiotViet (nếu có) */}
            {["unpaid", "processing", "underpaid", "expired", "failed"].includes(detailOrder.paymentStatus) &&
            detailOrder.kvPaymentVerification?.state === "pending" ? (
              <div className="p-1">
                <PaymentVerificationNotice
                  code={detailOrder.code}
                  reason={detailOrder.kvPaymentVerification.reason}
                  attempts={detailOrder.kvPaymentVerification.attempts}
                />
              </div>
            ) : null}

            {/* Khối 5: Tổng tiền đơn hàng */}
            <div className="flex items-center justify-between rounded-xl bg-[#2D5A27]/5 p-3.5 border border-[#2D5A27]/20">
              <span className="font-medium text-slate-700">Tổng thanh toán:</span>
              <span className="text-base font-black text-[#2D5A27] tabular-nums">
                {formatVnd(detailOrder.total)}
              </span>
            </div>

            {/* Khối 6: Lý do chặn huỷ đơn test (nếu có) */}
            {detailOrder.voidTestBlock ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-2.5 text-xs text-rose-800 flex items-start gap-1.5">
                <Info size={14} className="shrink-0 text-rose-600 mt-0.5" />
                <div className="leading-snug">
                  <span className="font-semibold">Không thể huỷ đơn: </span>
                  <span>{detailOrder.voidTestBlock}</span>
                </div>
              </div>
            ) : null}

            {/* Khối 7: Nút hành động trực tiếp trên Bottom Sheet */}
            <div className="flex items-center gap-2 pt-1">
              {detailOrder.priceMode === "si" ? (
                <Button
                  className="flex-1 font-semibold"
                  onClick={() => {
                    setPolicyCode(detailOrder.code);
                  }}
                >
                  Kiểm tra điều kiện sỉ
                </Button>
              ) : null}

              {detailOrder.voidTestBlock ? (
                <Button className="flex-1" disabled icon={<Trash2 size={13} />}>
                  Huỷ đơn test
                </Button>
              ) : (
                <Button
                  danger
                  type="primary"
                  className="flex-1 font-semibold"
                  icon={<Trash2 size={13} />}
                  onClick={() => {
                    setTarget(detailOrder);
                    setConfirm("");
                    voidTest.reset();
                  }}
                >
                  Huỷ đơn test KiotViet
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* MODAL KIỂM TRA ĐIỀU KIỆN SỈ */}
      <Modal title="Điều kiện mua sỉ" open={Boolean(policyCode)} onCancel={() => setPolicyCode(null)} footer={null} destroyOnHidden>
        {policyCode && <WholesaleOrderCheck code={policyCode} />}
      </Modal>

      {/* MODAL XÁC NHẬN HUỶ ĐƠN TEST */}
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
