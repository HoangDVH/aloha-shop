"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  ShoppingBag,
  AlertCircle,
  XCircle,
  Loader2,
  Copy,
  Check,
  CreditCard,
  Truck,
  Phone,
} from "lucide-react";
import { formatVnd } from "@/lib/api";
import {
  cancelUnpaidOrder,
  displayShopOrderCode,
  getMyOrder,
  renewPaymentOrder,
  reportPaidOrder,
  subscribeShopOrdersStream,
  type ShopOrder,
} from "@/lib/orders";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import { BankTransferQrPanel } from "@/components/BankTransferQrPanel";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";

type HeroTone = "ok" | "wait" | "done" | "bad";

function waitingStaff(o: ShopOrder) {
  return (
    Boolean(o.customerReportedPaidAt) ||
    o.paymentStatus === "processing" ||
    o.statusValue === "Chờ shop xác nhận CK"
  );
}

function heroFor(o: ShopOrder): {
  Icon: typeof CheckCircle2;
  title: string;
  subtitle: string;
  tone: HeroTone;
} {
  const ps = o.paymentStatus || "";
  if (ps === "paid") {
    return {
      Icon: CheckCircle2,
      title: "Cảm ơn bạn đã mua hàng!",
      subtitle:
        "Cửa hàng đã xác nhận thanh toán thành công. Đơn đang được chuẩn bị giao.",
      tone: "done",
    };
  }
  if (ps === "cancelled") {
    return {
      Icon: XCircle,
      title: "Đơn đã hủy",
      subtitle: "Đơn này không còn hiệu lực.",
      tone: "bad",
    };
  }
  if (ps === "underpaid") {
    return {
      Icon: AlertCircle,
      title: "Thanh toán chưa đủ / cần kiểm tra",
      subtitle:
        "Hệ thống đã nhận được chuyển khoản nhưng số tiền chưa khớp. Shop đang kiểm tra — giữ trang này hoặc liên hệ cửa hàng.",
      tone: "wait",
    };
  }
  if (ps === "expired") {
    return {
      Icon: AlertCircle,
      title: "Hết hạn chuyển khoản",
      subtitle:
        "Thời gian thanh toán đã hết. Bấm «Tạo mã QR mới» để thanh toán tiếp (không cần đặt lại đơn).",
      tone: "bad",
    };
  }
  if (ps === "failed") {
    return {
      Icon: AlertCircle,
      title: "Xác nhận thanh toán lỗi",
      subtitle: "Liên hệ shop để được hỗ trợ.",
      tone: "bad",
    };
  }
  if (ps === "cod") {
    return {
      Icon: Package,
      title: "Đặt hàng thành công",
      subtitle: "Thanh toán khi nhận hàng. Nhân viên sẽ liên hệ / xử lý đơn sớm.",
      tone: "ok",
    };
  }
  if (waitingStaff(o)) {
    return {
      Icon: Clock,
      title: "Đang chờ xác nhận thanh toán",
      subtitle:
        "Bạn đã báo đã chuyển khoản. Hệ thống đang đối chiếu (hoặc nhân viên kiểm tra) — giữ trang này, sẽ tự cập nhật khi xong.",
      tone: "wait",
    };
  }
  if (ps === "unpaid") {
    return {
      Icon: Clock,
      title: "Đơn đã ghi nhận — chờ chuyển khoản",
      subtitle:
        "Chuyển đúng số tiền + nội dung bên dưới. Tiền vào sẽ tự xác nhận; hoặc bấm “Tôi đã chuyển khoản” rồi giữ trang để nhận kết quả.",
      tone: "wait",
    };
  }
  return {
    Icon: CheckCircle2,
    title: "Đặt hàng thành công",
    subtitle: "Cảm ơn bạn. Đơn đang được xử lý.",
    tone: "ok",
  };
}

function CopyOrderCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#C5D5C0] bg-white px-2.5 py-1 text-xs font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Đã chép" : "Sao chép"}
    </button>
  );
}

export default function DonHangStatusPage() {
  const params = useParams();
  const code = decodeURIComponent(String(params?.code || "").trim());
  const router = useRouter();
  const { user, loading: authLoading } = useShopAuth();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [cancelMsg, setCancelMsg] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  const [renewMsg, setRenewMsg] = useState("");

  const reload = useCallback(
    async (silent = false) => {
      if (!code) return;
      if (!silent) setLoading(true);
      try {
        const data = await getMyOrder(code);
        setOrder((prev) => {
          if (prev && prev.paymentStatus !== "paid" && data.paymentStatus === "paid") {
            queueMicrotask(() => {
              setJustConfirmed(true);
              setShowThanks(true);
            });
          }
          return data;
        });
        setError("");
      } catch (e: any) {
        if (!silent) setError(e?.message || "Không tải được đơn");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [code]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/dang-nhap?next=${encodeURIComponent(`/don-hang/${code}`)}`);
      return;
    }
    void reload();
  }, [authLoading, user, code, router, reload]);

  // Khi hiện form cảm ơn: tải lại đơn để chắc có mã HĐ KV (HD…)
  useEffect(() => {
    if (!showThanks) return;
    void reload(true);
  }, [showThanks, reload]);

  const live =
    order &&
    (order.paymentStatus === "unpaid" ||
      order.paymentStatus === "processing" ||
      order.paymentStatus === "cod");

  useEffect(() => {
    if (!live) return;
    const unsub = subscribeShopOrdersStream(() => {
      void reload(true);
    });
    const poll = setInterval(() => {
      void reload(true);
    }, 6000);
    return () => {
      unsub();
      clearInterval(poll);
    };
  }, [live, reload]);

  if (authLoading || !user || loading) {
    return <ShopPageLoader fullscreen={false} />;
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <AlertCircle className="mx-auto text-[#EE6055]" size={40} />
        <h1 className="mt-4 text-xl font-extrabold text-[var(--aloha-ink)]">Không tìm thấy đơn</h1>
        <p className="mt-2 text-sm text-slate-500">
          {error || "Đơn không tồn tại hoặc không thuộc tài khoản này."}
        </p>
        <Link
          href="/tai-khoan?tab=don-mua"
          className="mt-6 inline-flex rounded-xl bg-[var(--aloha-green)] px-5 py-2.5 text-sm font-bold text-white"
        >
          Xem đơn mua
        </Link>
      </div>
    );
  }

  const hero = heroFor(order);
  const Icon = hero.Icon;
  const isPaid = order.paymentStatus === "paid";
  const isCod = order.paymentStatus === "cod";
  const isSuccessView = isPaid || isCod;
  const isExpiredCk = order.paymentStatus === "expired" && order.method !== "Cash";
  const isUnpaidCk = order.paymentStatus === "unpaid" && order.method !== "Cash";
  const qrExpired =
    isUnpaidCk &&
    Boolean(order.expiresAt) &&
    new Date(String(order.expiresAt)).getTime() <= Date.now();
  const isWaitingStaff = isUnpaidCk && waitingStaff(order);
  const addressLine =
    order.deliveryMethod === "nhan_cua_hang"
      ? "Nhận tại cửa hàng ALOHA"
      : [order.shippingAddress, order.ward, order.province].filter(Boolean).join(", ");
  const payLabel =
    order.method === "Transfer" || order.method === "Card"
      ? "Chuyển khoản"
      : "Thanh toán khi nhận hàng (COD)";
  const itemCount = (order.orderDetails || []).reduce(
    (n, d) => n + (Number(d.quantity) || 0),
    0
  );

  const doRenewPayment = async () => {
    setBusy(true);
    setRenewMsg("");
    setCancelMsg("");
    try {
      const res = await renewPaymentOrder(order.code);
      setOrder(res.data);
    } catch (e: any) {
      setRenewMsg(e?.message || "Không tạo được mã mới");
    } finally {
      setBusy(false);
    }
  };

  if (showThanks && isPaid) {
    const invoiceCode = displayShopOrderCode(order);
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--aloha-cream)] px-4 pt-[env(safe-area-inset-top,0px)]">
        <div className="w-full max-w-md animate-fade-up rounded-3xl bg-white px-6 py-10 text-center shadow-xl ring-1 ring-[#E8E2D6]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--aloha-green-light)]">
            <CheckCircle2 size={44} className="text-[var(--aloha-green)]" strokeWidth={1.75} />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--aloha-green)]">
            Thanh toán thành công
          </p>
          <h2 className="mt-2 text-2xl font-extrabold text-[var(--aloha-ink)]">Cảm ơn bạn!</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Cửa hàng đã xác nhận chuyển khoản. Hóa đơn đang được chuẩn bị.
          </p>
          {invoiceCode ? (
            <div className="mt-4 inline-flex flex-col items-center gap-1 rounded-xl bg-[#F4F8F2] px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {order.kvInvoiceCode ? "Mã hóa đơn" : "Mã đơn"}
              </span>
              <span className="font-mono text-lg font-extrabold text-[var(--aloha-green)]">
                {invoiceCode}
              </span>
            </div>
          ) : null}
          <button
            type="button"
            className="mt-8 w-full rounded-xl bg-[var(--aloha-green)] py-3.5 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)]"
            onClick={() => setShowThanks(false)}
          >
            Xem chi tiết đơn
          </button>
          <Link
            href="/tim"
            className="mt-3 inline-block text-sm font-semibold text-[var(--aloha-green)] hover:underline"
          >
            Tiếp tục mua sắm
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-5xl animate-fade-up px-3 py-4 sm:px-4 lg:py-6">
      {/* ===== Trang thành công kiểu sàn TMĐT ===== */}
      {isSuccessView ? (
        <div className="space-y-3 sm:space-y-4">
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E2D6]">
            <div className="bg-gradient-to-r from-[var(--aloha-green-light)] via-white to-[var(--aloha-cream)] px-4 py-6 sm:px-8 sm:py-8">
              <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--aloha-green)] text-white shadow-md shadow-[var(--aloha-green)]/25 sm:h-[72px] sm:w-[72px]">
                  <CheckCircle2 size={36} strokeWidth={2} />
                </div>
                <div className="mt-4 min-w-0 flex-1 sm:mt-0">
                  <h1 className="text-xl font-extrabold tracking-tight text-[var(--aloha-ink)] sm:text-2xl">
                    {hero.title}
                  </h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{hero.subtitle}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    {(() => {
                      const shown = displayShopOrderCode(order);
                      const label = order.kvInvoiceCode
                        ? "Mã HĐ"
                        : order.kvOrderCode
                          ? "Mã ĐH"
                          : "Mã đơn";
                      return (
                        <>
                          <span className="text-xs font-semibold text-slate-500">
                            {label}
                          </span>
                          <span
                            className={
                              order.kvInvoiceCode
                                ? "rounded-lg bg-[var(--aloha-green)] px-2.5 py-1 font-mono text-sm font-bold text-white"
                                : "rounded-lg bg-[var(--aloha-ink)]/5 px-2.5 py-1 font-mono text-sm font-bold text-[var(--aloha-ink)]"
                            }
                          >
                            {shown}
                          </span>
                          <CopyOrderCode code={shown} />
                        </>
                      );
                    })()}
                    {justConfirmed ? (
                      <span className="rounded-full bg-[var(--aloha-green)] px-2.5 py-1 text-[11px] font-bold text-white">
                        Vừa xác nhận
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-[var(--aloha-line)] px-3 py-5 sm:px-8">
              <OrderStatusTimeline order={order} />
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:items-start lg:gap-4">
            <div className="space-y-3">
              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E8E2D6] sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--aloha-green-light)] text-[var(--aloha-green)]">
                    <MapPin size={16} />
                  </span>
                  <h2 className="text-sm font-extrabold text-[var(--aloha-ink)]">Địa chỉ nhận hàng</h2>
                </div>
                <p className="text-[15px] font-bold text-[var(--aloha-ink)]">
                  {order.customerName}
                  <span className="mx-2 font-normal text-slate-300">|</span>
                  <span className="font-semibold text-slate-700">{order.customerPhone}</span>
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {addressLine || "—"}
                </p>
                {order.customerNote ? (
                  <p className="mt-3 rounded-lg bg-[var(--aloha-cream)] px-3 py-2 text-xs text-slate-600">
                    <span className="font-bold text-[var(--aloha-ink)]">Ghi chú: </span>
                    {order.customerNote}
                  </p>
                ) : null}
              </section>

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E8E2D6] sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--aloha-green-light)] text-[var(--aloha-green)]">
                    <CreditCard size={16} />
                  </span>
                  <h2 className="text-sm font-extrabold text-[var(--aloha-ink)]">Thanh toán</h2>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600">{payLabel}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      isPaid
                        ? "bg-[var(--aloha-green-light)] text-[var(--aloha-green-mid)]"
                        : "bg-[#FFF8E8] text-[#8a6a1a]"
                    }`}
                  >
                    {isPaid ? "Đã thanh toán" : "Thu hộ khi giao"}
                  </span>
                </div>
                {order.kvInvoiceCode ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Hóa đơn:{" "}
                    <span className="font-semibold text-[var(--aloha-ink)]">{order.kvInvoiceCode}</span>
                  </p>
                ) : null}
                <div className="mt-3 flex items-end justify-between border-t border-dashed border-[var(--aloha-line)] pt-3">
                  <span className="text-sm font-semibold text-slate-600">Tổng thanh toán</span>
                  <span className="text-xl font-extrabold text-[#EE6055]">
                    {formatVnd(order.totalPayment ?? order.total)}
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-[#C5D5C0]/80 bg-[#F4F8F2] p-4 sm:p-5">
                <div className="flex gap-3">
                  <Truck className="mt-0.5 shrink-0 text-[var(--aloha-green)]" size={20} />
                  <div>
                    <p className="text-sm font-extrabold text-[var(--aloha-ink)]">Bước tiếp theo</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Shop đang chuẩn bị hàng. Anh/chị sẽ nhận cập nhật khi đơn chuyển sang giao.
                      Cần hỗ trợ sớm: gọi cửa hàng hoặc xem lại đơn trong tài khoản.
                    </p>
                    <a
                      href="tel:0794901233"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--aloha-green)] hover:underline"
                    >
                      <Phone size={14} />
                      Gọi 079 490 1233
                    </a>
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-3 lg:sticky lg:top-3">
              <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E2D6]">
                <div className="flex items-center justify-between border-b border-[var(--aloha-line)] px-4 py-3">
                  <h2 className="text-sm font-extrabold text-[var(--aloha-ink)]">
                    Sản phẩm{" "}
                    <span className="font-semibold text-slate-400">({itemCount})</span>
                  </h2>
                  <Package size={16} className="text-[var(--aloha-green)]" />
                </div>
                <ul className="max-h-[40vh] divide-y divide-[var(--aloha-line)] overflow-y-auto px-4">
                  {(order.orderDetails || []).map((d, i) => (
                    <li key={`${d.productCode}-${i}`} className="flex gap-3 py-3">
                      {d.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={d.imageUrl}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-[#E8E2D6]"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--aloha-cream)]">
                          <Package size={20} className="text-[var(--aloha-green)]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-[var(--aloha-ink)]">
                          {d.productName}
                        </p>
                        {d.note ? (
                          <p className="mt-0.5 text-xs italic text-slate-500">
                            Ghi chú: {d.note}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-slate-500">
                          {d.productCode} · ×{d.quantity}
                        </p>
                        <p className="mt-1 text-sm font-bold text-[var(--aloha-ink)]">
                          {formatVnd(d.price * d.quantity)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="space-y-1.5 border-t border-[var(--aloha-line)] bg-[var(--aloha-card)] px-4 py-3 text-sm">
                  {order.subtotal != null ? (
                    <div className="flex justify-between text-slate-600">
                      <span>Tiền hàng</span>
                      <span>{formatVnd(order.subtotal)}</span>
                    </div>
                  ) : null}
                  {(order.shippingFee ?? 0) > 0 || order.freeShipApplied ? (
                    <div className="flex justify-between text-slate-600">
                      <span>Phí vận chuyển</span>
                      <span className={order.freeShipApplied ? "font-semibold text-[var(--aloha-green)]" : ""}>
                        {(order.shippingFee ?? 0) > 0
                          ? formatVnd(order.shippingFee || 0)
                          : "Miễn phí"}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-t border-dashed border-[var(--aloha-line)] pt-2">
                    <span className="font-extrabold text-[var(--aloha-ink)]">Thành tiền</span>
                    <span className="text-lg font-extrabold text-[#EE6055]">
                      {formatVnd(order.totalPayment ?? order.total)}
                    </span>
                  </div>
                </div>
              </section>

              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <Link
                  href="/tim"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--aloha-green)] px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[var(--aloha-green-hover)]"
                >
                  <ShoppingBag size={16} />
                  Tiếp tục mua sắm
                </Link>
                <Link
                  href="/tai-khoan?tab=don-mua"
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#C5D5C0] bg-white px-4 py-3.5 text-sm font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
                >
                  Đơn mua của tôi
                </Link>
              </div>
            </aside>
          </div>
        </div>
      ) : (
        /* ===== Chờ CK / hết hạn / lỗi — giữ luồng QR gọn ===== */
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-[#E8E2D6]">
            <div className="flex min-w-0 items-center gap-2">
              {hero.tone === "wait" ? (
                <Loader2 size={18} className="shrink-0 animate-spin text-[#dfb451]" />
              ) : (
                <Icon
                  size={18}
                  className={`shrink-0 ${
                    hero.tone === "bad" ? "text-[#DC2626]" : "text-[var(--aloha-green)]"
                  }`}
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-[var(--aloha-ink)]">{hero.title}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {displayShopOrderCode(order)}
                  {order.method === "Transfer" ? " · Chuyển khoản" : " · COD"}
                </p>
              </div>
            </div>
            {isUnpaidCk && !isWaitingStaff ? (
              <p className="text-[11px] font-medium text-slate-500">
                Quét QR bên dưới · trang tự cập nhật
              </p>
            ) : null}
          </div>

          <div className="mb-3 rounded-xl bg-white px-3 py-4 shadow-sm ring-1 ring-[#E8E2D6] sm:px-5">
            <OrderStatusTimeline order={order} />
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-start lg:gap-4">
            <div className="space-y-3">
              {isWaitingStaff ? (
                <section className="rounded-xl border border-[#dfb451]/40 bg-[#FFF8E8] px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 shrink-0 text-[#dfb451]" size={16} />
                    <p className="text-xs leading-snug text-slate-700">
                      <span className="font-extrabold text-[var(--aloha-ink)]">Đang đối chiếu CK</span>
                      {" — "}
                      trang tự cập nhật khi xong, không cần F5.
                    </p>
                  </div>
                </section>
              ) : null}

              {isExpiredCk ? (
                <section className="space-y-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-[#E8E2D6]">
                  <h2 className="text-sm font-extrabold text-[var(--aloha-ink)]">Mã QR đã hết hạn</h2>
                  <button
                    type="button"
                    disabled={busy}
                    className="w-full rounded-lg bg-[var(--aloha-green)] py-2.5 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)] disabled:opacity-50"
                    onClick={() => void doRenewPayment()}
                  >
                    {busy ? "Đang tạo…" : "Tạo mã QR mới"}
                  </button>
                  {renewMsg ? (
                    <p className="text-center text-xs font-semibold text-red-600">{renewMsg}</p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    className="w-full rounded-lg border border-slate-300 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    onClick={async () => {
                      setBusy(true);
                      setCancelMsg("");
                      try {
                        await cancelUnpaidOrder(order.code);
                        await reload(true);
                      } catch (e: any) {
                        setCancelMsg(e?.message || "Không hủy được");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Hủy đơn
                  </button>
                  {cancelMsg ? (
                    <p className="text-center text-xs font-semibold text-red-600">{cancelMsg}</p>
                  ) : null}
                </section>
              ) : null}

              {isUnpaidCk && (order.paymentCode || order.kvInvoiceCode) ? (
                <section className="space-y-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-[#E8E2D6]">
                  {isWaitingStaff ? (
                    <details className="group">
                      <summary className="cursor-pointer list-none text-sm font-extrabold text-[var(--aloha-ink)] outline-none [&::-webkit-details-marker]:hidden">
                        Thông tin CK (đã gửi){" "}
                        <span className="text-xs font-semibold text-[var(--aloha-green)] group-open:hidden">
                          · xem
                        </span>
                      </summary>
                      <div className="mt-2 space-y-2">
                        <BankTransferQrPanel
                          compact
                          amount={Number(order.totalPayment ?? order.total) || 0}
                          paymentCode={
                            order.transferContent ||
                            order.kvInvoiceCode ||
                            order.paymentCode ||
                            ""
                          }
                          transferContent={order.transferContent}
                          qrKind={order.qrKind}
                          kvInvoiceCode={order.kvInvoiceCode}
                          kovCode={order.kovCode}
                          qrString={order.qrString}
                          bank={order.bank}
                          qrUrl={order.qrUrl}
                          expiresAt={order.expiresAt}
                        />
                      </div>
                    </details>
                  ) : (
                    <>
                      {qrExpired ? (
                        <p className="text-xs font-semibold text-[#EE6055]">
                           QR hết hạn — tạo mã mới để tiếp tục.
                        </p>
                      ) : null}
                      <BankTransferQrPanel
                        compact={false}
                        amount={Number(order.totalPayment ?? order.total) || 0}
                        paymentCode={
                          order.transferContent ||
                          order.kvInvoiceCode ||
                          order.paymentCode ||
                          ""
                        }
                        transferContent={order.transferContent}
                        qrKind={order.qrKind}
                        kvInvoiceCode={order.kvInvoiceCode}
                        kovCode={order.kovCode}
                        qrString={order.qrString}
                        bank={order.bank}
                        qrUrl={order.qrUrl}
                        expiresAt={order.expiresAt}
                      />
                      <div className="flex flex-col gap-1.5 sm:flex-row">
                        {qrExpired ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="flex-1 rounded-lg bg-[var(--aloha-green)] py-2.5 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)] disabled:opacity-50"
                            onClick={() => void doRenewPayment()}
                          >
                            {busy ? "Đang tạo…" : "Tạo mã QR mới"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            className="flex-1 rounded-lg bg-[var(--aloha-green)] py-2.5 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)] disabled:opacity-50"
                            onClick={async () => {
                              setBusy(true);
                              setReportMsg("");
                              try {
                                const res = await reportPaidOrder(order.code);
                                setOrder(res.data);
                              } catch (e: any) {
                                setReportMsg(e?.message || "Không gửi được báo cáo");
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {busy ? "Đang gửi…" : "Tôi đã chuyển khoản"}
                          </button>
                        )}
                        {!qrExpired ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-lg border border-[var(--aloha-green)] px-3 py-2.5 text-sm font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)] disabled:opacity-50 sm:w-auto"
                            onClick={() => void doRenewPayment()}
                          >
                            Gia hạn QR
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                          onClick={async () => {
                            setBusy(true);
                            setCancelMsg("");
                            try {
                              await cancelUnpaidOrder(order.code);
                              await reload(true);
                            } catch (e: any) {
                              setCancelMsg(e?.message || "Không hủy được");
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Hủy đơn
                        </button>
                      </div>
                      {renewMsg || reportMsg || cancelMsg ? (
                        <p className="text-center text-xs font-semibold text-red-600">
                          {renewMsg || reportMsg || cancelMsg}
                        </p>
                      ) : null}
                    </>
                  )}
                </section>
              ) : null}

              {isCod && order.orderStatus === "cho_xu_ly" ? (
                <section className="space-y-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-[#E8E2D6]">
                  <button
                    type="button"
                    disabled={busy}
                    className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    onClick={async () => {
                      if (!window.confirm("Hủy đơn COD này?")) return;
                      setBusy(true);
                      setCancelMsg("");
                      try {
                        await cancelUnpaidOrder(order.code);
                        await reload(true);
                      } catch (e: any) {
                        setCancelMsg(e?.message || "Không hủy được");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Hủy đơn
                  </button>
                  {cancelMsg ? (
                    <p className="text-center text-xs font-semibold text-red-600">{cancelMsg}</p>
                  ) : null}
                </section>
              ) : null}

              {!isUnpaidCk && !isExpiredCk ? (
                <section className="rounded-xl bg-[#FEF2F2] px-3 py-3 text-sm leading-snug text-[#991B1B] shadow-sm ring-1 ring-[#E8E2D6]">
                  {hero.subtitle}
                </section>
              ) : null}
            </div>

            <aside className="space-y-2 lg:sticky lg:top-3">
              <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#E8E2D6]">
                <div className="border-b border-[var(--aloha-line)] px-3 py-2.5">
                  <h2 className="text-sm font-extrabold text-[var(--aloha-ink)]">Chi tiết đơn</h2>
                </div>
                <ul className="max-h-[22vh] divide-y divide-[var(--aloha-line)] overflow-y-auto px-3 lg:max-h-[28vh]">
                  {(order.orderDetails || []).map((d, i) => (
                    <li key={`${d.productCode}-${i}`} className="flex gap-2 py-2">
                      {d.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={d.imageUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-[#E8E2D6]"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--aloha-cream)]">
                          <Package size={16} className="text-[var(--aloha-green)]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[13px] font-semibold text-[var(--aloha-ink)]">
                          {d.productName}
                        </p>
                        {d.note ? (
                          <p className="text-[10px] italic text-slate-500">
                            Ghi chú: {d.note}
                          </p>
                        ) : null}
                        <p className="text-[10px] text-slate-500">
                          {d.productCode} · ×{d.quantity}
                        </p>
                      </div>
                      <p className="shrink-0 text-[13px] font-bold text-[var(--aloha-ink)]">
                        {formatVnd(d.price * d.quantity)}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="space-y-0.5 border-t border-[var(--aloha-line)] px-3 py-2.5 text-[13px]">
                  {order.subtotal != null ? (
                    <div className="flex justify-between text-slate-600">
                      <span>Tiền hàng</span>
                      <span>{formatVnd(order.subtotal)}</span>
                    </div>
                  ) : null}
                  {(order.shippingFee ?? 0) > 0 || order.freeShipApplied ? (
                    <div className="flex justify-between text-slate-600">
                      <span>Phí ship</span>
                      <span>
                        {(order.shippingFee ?? 0) > 0
                          ? formatVnd(order.shippingFee || 0)
                          : "Miễn phí"}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-0.5 text-sm font-extrabold">
                    <span>Tổng</span>
                    <span className="text-[#EE6055]">
                      {formatVnd(order.totalPayment ?? order.total)}
                    </span>
                  </div>
                </div>
                {addressLine ? (
                  <div className="flex gap-2 border-t border-[var(--aloha-line)] px-3 py-2 text-[12px] text-slate-600">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-[var(--aloha-green)]" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--aloha-ink)]">
                        {order.customerName} · {order.customerPhone}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug">{addressLine}</p>
                    </div>
                  </div>
                ) : null}
              </section>

              <div className="flex gap-2">
                <Link
                  href="/tim"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--aloha-green)] px-3 py-2.5 text-[13px] font-bold text-white hover:bg-[var(--aloha-green-hover)]"
                >
                  <ShoppingBag size={15} />
                  Tiếp tục mua
                </Link>
                <Link
                  href="/tai-khoan?tab=don-mua"
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-[#C5D5C0] bg-white px-3 py-2.5 text-[13px] font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
                >
                  Đơn mua
                </Link>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
