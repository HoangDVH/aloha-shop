"use client";

import React from "react";
import Link from "next/link";
import {
  Clock,
  Loader2,
  MapPin,
  Package,
  ShoppingBag,
} from "lucide-react";
import { formatVnd } from "@/lib/api";
import {
  cancelUnpaidOrder,
  displayShopOrderCode,
  reportPaidOrder,
  type ShopOrder,
} from "@/lib/orders";
import { BackorderProposal } from "@/components/BackorderProposal";
import { BankTransferQrPanel } from "@/components/BankTransferQrPanel";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import type { heroFor } from "./orderHero";

export function OrderPendingView({
  order,
  hero,
  isUnpaidCk,
  isWaitingStaff,
  isExpiredCk,
  isCod,
  qrExpired,
  addressLine,
  busy,
  setBusy,
  renewMsg,
  cancelMsg,
  setCancelMsg,
  reportMsg,
  setReportMsg,
  reload,
  setOrder,
  doRenewPayment,
}: {
  order: ShopOrder;
  hero: ReturnType<typeof heroFor>;
  isUnpaidCk: boolean;
  isWaitingStaff: boolean;
  isExpiredCk: boolean;
  isCod: boolean;
  qrExpired: boolean;
  addressLine: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  renewMsg: string;
  cancelMsg: string;
  setCancelMsg: (s: string) => void;
  reportMsg: string;
  setReportMsg: (s: string) => void;
  reload: (silent?: boolean) => Promise<void>;
  setOrder: (order: ShopOrder) => void;
  doRenewPayment: () => Promise<void>;
}) {
  const Icon = hero.Icon;

  return (
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
              {order.method === "Pending"
                ? " · Chưa yêu cầu thanh toán"
                : order.method === "Transfer"
                  ? " · Chuyển khoản"
                  : " · COD"}
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
        {order.kvPushStatus && order.kvPushStatus !== "synced" ? (
          <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Aloha đã lưu yêu cầu. Đơn đang chờ cửa hàng kiểm tra và đồng bộ; bạn không cần đặt lại.
          </p>
        ) : null}
        {order.shippingFeePending ? (
          <p className="mb-3 text-sm text-stone-600">
            Tổng tạm tính chưa bao gồm phí giao hàng. Aloha sẽ xác nhận trước khi yêu cầu thanh toán.
          </p>
        ) : null}
        <BackorderProposal
          key={order.proposal?.version || order.code}
          order={order}
          onAccepted={() => void reload(true)}
        />
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
              {order.discount ? (
                <div className="flex justify-between text-[var(--aloha-price)] font-semibold">
                  <span>Giảm giá ưu đãi</span>
                  <span>-{formatVnd(order.discount)}</span>
                </div>
              ) : null}
              {order.deliveryMethod === "nhan_cua_hang" ? (
                <div className="flex justify-between text-slate-600">
                  <span>Phí ship</span>
                  <span>0đ (Nhận tại cửa hàng)</span>
                </div>
              ) : order.shippingEstimate?.status === "needs_confirmation" ||
                order.shippingEstimate?.status === "unavailable" ||
                (order.shippingFee == null && !order.freeShipApplied) ? (
                <div className="flex justify-between text-slate-600">
                  <span>Phí ship</span>
                  <span className="font-medium text-amber-700">Chờ xác nhận</span>
                </div>
              ) : order.shippingDiscount ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Phí ship tạm tính</span>
                    <span>{formatVnd(order.shippingFeeOriginal ?? (order.shippingFee || 0) + order.shippingDiscount)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--aloha-price)] font-semibold">
                    <span>{order.shippingPromotion?.title || "Hỗ trợ phí ship"}</span>
                    <span>-{formatVnd(order.shippingDiscount)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <span>Phí ship tạm tính</span>
                  <span className={order.freeShipApplied ? "font-semibold text-[var(--aloha-green)]" : ""}>
                    {(order.shippingFee ?? 0) > 0 ? formatVnd(order.shippingFee || 0) : "Miễn phí"}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-0.5 text-sm font-extrabold">
                {order.deliveryMethod === "nhan_cua_hang" ? (
                  <>
                    <span>Tổng tiền thanh toán</span>
                    <span className="text-[#EE6055]">{formatVnd(order.total)}</span>
                  </>
                ) : order.shippingEstimate?.status === "needs_confirmation" ||
                  order.shippingEstimate?.status === "unavailable" ||
                  (order.shippingFee == null && !order.freeShipApplied) ? (
                  <>
                    <span className="text-xs font-semibold text-slate-700">Tiền hàng chưa gồm phí vận chuyển:</span>
                    <span className="text-[#EE6055]">{formatVnd(order.total)}</span>
                  </>
                ) : (
                  <>
                    <span>Tổng tạm tính</span>
                    <span className="text-[#EE6055]">{formatVnd(order.total)}</span>
                  </>
                )}
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
  );
}
