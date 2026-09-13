"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { buildVietQrUrl, type ShopBankInfo } from "@/lib/bankTransfer";

type Props = {
  amount: number;
  /** Nội dung CK ưu tiên (mã HĐ KV hoặc ALH…) */
  paymentCode: string;
  transferContent?: string | null;
  qrKind?: "kiotviet" | "vietqr" | string | null;
  kvInvoiceCode?: string | null;
  bank?: ShopBankInfo | null;
  qrUrl?: string | null;
  expiresAt?: string | null;
  productCodes?: string[];
  /** Gọn một màn hình (trang đơn chờ CK) */
  compact?: boolean;
};

function CopyRow({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  const [ok, setOk] = useState(false);
  return (
    <div
      className={`flex items-center justify-between gap-2 border-b border-[#E5DFD2] last:border-0 ${
        compact ? "py-1.5" : "py-2"
      }`}
    >
      <div className="min-w-0">
        <p
          className={`font-semibold uppercase tracking-wide text-slate-500 ${
            compact ? "text-[10px]" : "text-[11px]"
          }`}
        >
          {label}
        </p>
        <p
          className={`truncate font-bold text-[#1a2e1a] ${
            compact ? "text-[13px]" : "text-sm"
          }`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#F7F3EA] px-2 py-1 text-xs font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setOk(true);
            setTimeout(() => setOk(false), 1500);
          } catch {
            /* ignore */
          }
        }}
      >
        {ok ? <Check size={12} /> : <Copy size={12} />}
        {ok ? "Đã chép" : "Copy"}
      </button>
    </div>
  );
}

function useCountdown(expiresAt?: string | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) {
      setLeft(0);
      return;
    }
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return { left, label: `${mm}:${ss}` };
}

export function BankTransferQrPanel({
  amount,
  paymentCode,
  transferContent,
  qrKind,
  kvInvoiceCode,
  bank,
  qrUrl,
  expiresAt,
  productCodes,
  compact = false,
}: Props) {
  const { left, label } = useCountdown(expiresAt);
  const content = String(transferContent || kvInvoiceCode || paymentCode || "").trim();
  const isKiot = qrKind === "kiotviet" || Boolean(kvInvoiceCode);
  const resolvedQr =
    qrUrl ||
    (bank?.configured && content
      ? buildVietQrUrl({
          bin: bank.bin,
          accountNumber: bank.accountNumber,
          accountName: bank.accountName,
          amount,
          addInfo: content,
        })
      : null);

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-[#E8E2D6]">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b border-[#E5DFD2] bg-[var(--aloha-green-light)] ${
          compact ? "px-3 py-2" : "px-4 py-3"
        }`}
      >
        <p className={`font-extrabold text-[#1a2e1a] ${compact ? "text-[13px]" : "text-sm"}`}>
          {isKiot ? "Quét QR thanh toán hóa đơn KiotViet" : "Chuyển khoản qua QR"}
        </p>
        {left > 0 ? (
          <span className="text-xs font-bold text-[#EE6055]">Còn {label}</span>
        ) : expiresAt ? (
          <span className="text-xs font-bold text-[#EE6055]">Đã hết hạn</span>
        ) : null}
      </div>
      <div
        className={`grid ${
          compact
            ? "gap-3 p-3 sm:grid-cols-[120px_1fr]"
            : "gap-4 p-4 sm:grid-cols-[160px_1fr]"
        }`}
      >
        <div
          className={`mx-auto flex items-center justify-center rounded-xl bg-white ring-1 ring-[#E5DFD2] ${
            compact ? "h-[120px] w-[120px]" : "h-40 w-40"
          }`}
        >
          {resolvedQr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedQr}
              alt={isKiot ? "QR hóa đơn KiotViet" : "QR chuyển khoản"}
              className={`object-contain ${compact ? "h-[108px] w-[108px]" : "h-36 w-36"}`}
            />
          ) : (
            <span className="text-xs text-slate-400">QR</span>
          )}
        </div>
        <div>
          <CopyRow compact={compact} label="Ngân hàng" value={bank?.bankName || "—"} />
          <CopyRow compact={compact} label="Chủ tài khoản" value={bank?.accountName || "—"} />
          <CopyRow compact={compact} label="Số tài khoản" value={bank?.accountNumber || "—"} />
          <CopyRow compact={compact} label="Số tiền" value={String(Math.round(amount))} />
          <CopyRow
            compact={compact}
            label={isKiot ? "Nội dung CK (mã HĐ)" : "Nội dung CK"}
            value={content || "—"}
          />
          {!compact && productCodes?.length ? (
            <p className="mt-2 text-xs text-slate-500">
              Sản phẩm: {productCodes.slice(0, 6).join(", ")}
              {productCodes.length > 6 ? "…" : ""}
            </p>
          ) : null}
          {!compact ? (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Giữ nguyên nội dung <strong>{content || "—"}</strong>.{" "}
              {isKiot
                ? "CK xong KiotViet cập nhật HĐ và shop tự xác nhận."
                : "Có thể bấm «Tôi đã chuyển khoản» nếu cần."}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Giữ nguyên nội dung <strong>{content || "—"}</strong>
            </p>
          )}
          <p
            className={`font-extrabold text-[#EE6055] ${
              compact ? "mt-1 text-sm" : "mt-1 text-sm"
            }`}
          >
            {formatVnd(amount)}
          </p>
        </div>
      </div>
    </div>
  );
}
