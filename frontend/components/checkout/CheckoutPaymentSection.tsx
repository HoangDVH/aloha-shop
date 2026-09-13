"use client";

import { Banknote, Check, QrCode } from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { ShopBankInfo } from "@/lib/bankTransfer";
import { shopShowTransferPayment } from "@/lib/checkoutFlags";
import type { PayMethod } from "./checkoutTypes";

type Props = {
  pay: PayMethod;
  onPayChange: (p: PayMethod) => void;
  bankInfo: ShopBankInfo | null;
  grandTotal: number;
};

/** Phương thức thanh toán + thông tin chuyển khoản (CK ẩn khi flag tắt — không xóa). */
export function CheckoutPaymentSection({
  pay,
  onPayChange,
  bankInfo,
  grandTotal,
}: Props) {
  const showTransfer = shopShowTransferPayment();
  const methods = (
    [
      { id: "Cash" as const, label: "Thanh toán khi nhận hàng", Icon: Banknote },
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
          Hiện chỉ hỗ trợ <strong>thanh toán khi nhận hàng (COD)</strong>. Cửa hàng sẽ liên hệ và
          giao hàng; bạn trả tiền khi nhận.
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
                Số tiền dự kiến:{" "}
                <strong className="text-[var(--aloha-price)]">{formatVnd(grandTotal)}</strong>
              </p>
            </div>
          ) : (
            <p className="rounded-lg bg-[var(--aloha-cream)] px-3 py-2 text-xs text-slate-600">
              Chưa cấu hình TK nhận. Liên hệ shop trước khi đặt chuyển khoản.
            </p>
          )}
          <p className="rounded-lg bg-[var(--aloha-green-light)] px-3 py-2 text-xs text-[var(--aloha-green-mid)]">
            Sau khi đặt, trang Đơn mua hiện <strong>QR hóa đơn KiotViet</strong> (nội dung mã HĐ{" "}
            <strong>HD…</strong>). Quét → chuyển khoản đúng số tiền. Hệ thống tự xác nhận khi
            KiotViet nhận tiền.
          </p>
        </div>
      ) : null}
    </section>
  );
}
