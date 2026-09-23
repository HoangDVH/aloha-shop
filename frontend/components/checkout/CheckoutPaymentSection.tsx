"use client";

import { Banknote, Check, QrCode } from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { ShopBankInfo } from "@/lib/bankTransfer";
import {
  shopPreOrderCodMaxVnd,
  shopShowTransferPayment,
} from "@/lib/checkoutFlags";
import type { PayMethod } from "./checkoutTypes";

type Props = {
  pay: PayMethod;
  onPayChange: (p: PayMethod) => void;
  bankInfo: ShopBankInfo | null;
  grandTotal: number;
  /** Có SP đặt trước */
  hasPreOrder?: boolean;
  /** Vượt ngưỡng → chỉ CK */
  requireTransfer?: boolean;
};

/** Phương thức thanh toán + thông tin chuyển khoản (CK ẩn khi flag tắt — không xóa). */
export function CheckoutPaymentSection({
  pay,
  onPayChange,
  bankInfo,
  grandTotal,
  hasPreOrder = false,
  requireTransfer = false,
}: Props) {
  const showTransfer = shopShowTransferPayment();
  const codMax = shopPreOrderCodMaxVnd();
  if (hasPreOrder) return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950"><h2 className="mb-2 font-bold">Thanh toán sau khi Aloha xác nhận</h2><p>Aloha sẽ kiểm tra tình trạng hàng và liên hệ xác nhận với bạn. Sau khi đơn hàng được xác nhận, Aloha sẽ hướng dẫn bạn thanh toán trước hoặc đặt cọc để hoàn tất đặt hàng và sắp xếp vận chuyển.</p></section>;
  const methods = (
    [
      ...(requireTransfer
        ? []
        : [
            {
              id: "Cash" as const,
              label: "Thanh toán khi nhận hàng",
              Icon: Banknote,
            },
          ]),
      ...(showTransfer
        ? [
            {
              id: "Transfer" as const,
              label: "Chuyển khoản ngân hàng qua QR",
              Icon: QrCode,
            },
          ]
        : []),
    ] as const
  );

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[var(--aloha-line)]">
      <h2 className="mb-4 text-base font-extrabold text-[var(--aloha-ink)]">Phương thức thanh toán</h2>
      {hasPreOrder ? (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-amber-200/80">
          Đơn có sản phẩm <strong>đặt trước</strong> — giao khi shop có hàng
          {requireTransfer && codMax > 0
            ? `. Tổng trên ${formatVnd(codMax)} nên vui lòng chuyển khoản.`
            : ". Có thể COD hoặc chuyển khoản. Bấm Đặt hàng sẽ hiện xác nhận nếu chọn COD."}
        </p>
      ) : null}
      <div className="space-y-2">
        {methods.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPayChange(id)}
            className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
              pay === id
                ? "border-[var(--aloha-green)] bg-[var(--aloha-green-light)]"
                : "border-[var(--aloha-line)] hover:border-[#C5D5C0]"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                pay === id ? "border-[var(--aloha-green)] bg-[var(--aloha-green)]" : "border-slate-300"
              }`}
            >
              {pay === id ? <Check size={12} className="text-white" /> : null}
            </span>
            <Icon size={20} className="text-[var(--aloha-green)]" />
            <span className="text-sm font-bold text-[var(--aloha-ink)]">{label}</span>
          </button>
        ))}
      </div>
      {!showTransfer ? (
        <p className="mt-3 rounded-lg bg-[var(--aloha-green-light)] px-3 py-2 text-xs text-[var(--aloha-green-mid)]">
          {requireTransfer ? (
            <>
              Đơn đặt trước cần <strong>chuyển khoản</strong> nhưng shop chưa bật CK.
              Vui lòng liên hệ cửa hàng.
            </>
          ) : (
            <>
              Hiện chỉ hỗ trợ <strong>thanh toán khi nhận hàng (COD)</strong>. Cửa hàng sẽ liên hệ và
              giao hàng; bạn trả tiền khi nhận.
            </>
          )}
        </p>
      ) : null}
      {showTransfer && pay === "Transfer" ? (
        <div className="mt-3 space-y-2">
          {bankInfo?.configured ? (
            <div className="rounded-xl bg-[var(--aloha-cream)] px-4 py-3 text-sm text-[var(--aloha-ink)]">
              <p className="font-extrabold">{bankInfo.bankName}</p>
              <p className="mt-1 text-xs text-slate-600">
                STK <strong>{bankInfo.accountNumber}</strong> — {bankInfo.accountName}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Số tiền: <strong>{formatVnd(grandTotal)}</strong>
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Sau khi đặt hàng, hệ thống hiện QR và mã chuyển khoản trên trang đơn.
              </p>
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Đang tải thông tin ngân hàng…
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
