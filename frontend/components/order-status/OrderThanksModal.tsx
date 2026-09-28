"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { displayShopOrderCode, type ShopOrder } from "@/lib/orders";

export function OrderThanksModal({
  order,
  onClose,
}: {
  order: ShopOrder;
  onClose: () => void;
}) {
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
          onClick={onClose}
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
