"use client";

import React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CreditCard,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { formatVnd } from "@/lib/api";
import { displayShopOrderCode, type ShopOrder } from "@/lib/orders";
import { BackorderProposal } from "@/components/BackorderProposal";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { CopyOrderCode } from "./CopyOrderCode";
import type { heroFor } from "./orderHero";

export function OrderSuccessView({
  order,
  hero,
  isPaid,
  addressLine,
  payLabel,
  itemCount,
  justConfirmed,
  reload,
}: {
  order: ShopOrder;
  hero: ReturnType<typeof heroFor>;
  isPaid: boolean;
  addressLine: string;
  payLabel: string;
  itemCount: number;
  justConfirmed: boolean;
  reload: (silent?: boolean) => Promise<void>;
}) {
  return (
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
                {formatVnd(order.total)}
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
                  {formatVnd(order.total)}
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
  );
}
