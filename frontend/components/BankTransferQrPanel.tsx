"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ZoomIn, X, QrCode } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { buildVietQrUrl, type ShopBankInfo } from "@/lib/bankTransfer";

type Props = {
  amount: number;
  /** Nội dung CK ưu tiên (mã HĐ KV hoặc ALH…) */
  paymentCode: string;
  transferContent?: string | null;
  qrKind?: "kiotviet" | "vietqr" | string | null;
  kvInvoiceCode?: string | null;
  kovCode?: string | null;
  qrString?: string | null;
  bank?: ShopBankInfo | null;
  qrUrl?: string | null;
  expiresAt?: string | null;
  productCodes?: string[];
  /** Gọn một màn hình (trang đơn chờ CK) */
  compact?: boolean;
};

/** Đọc TLV EMVCo — lấy đúng lời nhắn trong QR (như MoMo). */
function emvGet(payload: string, id: string): string | null {
  let i = 0;
  const s = String(payload || "");
  while (i + 4 <= s.length) {
    const tag = s.slice(i, i + 2);
    const len = Number.parseInt(s.slice(i + 2, i + 4), 10);
    if (!Number.isFinite(len) || len < 0 || i + 4 + len > s.length) return null;
    const val = s.slice(i + 4, i + 4 + len);
    if (tag === id) return val;
    i += 4 + len;
  }
  return null;
}

function extractVietQrAddInfo(qrString?: string | null): string | null {
  const raw = String(qrString || "").trim();
  if (!raw) return null;
  const f62 = emvGet(raw, "62");
  if (!f62) return null;
  const purpose = emvGet(f62, "08") || emvGet(f62, "01");
  const out = String(purpose || "").trim();
  return out || null;
}

function resolveDisplayTransferContent(opts: {
  transferContent?: string | null;
  kovCode?: string | null;
  kvInvoiceCode?: string | null;
  paymentCode?: string | null;
  qrString?: string | null;
}): string {
  const fromQr = extractVietQrAddInfo(opts.qrString);
  if (fromQr) return fromQr;

  const kov = String(opts.kovCode || "").trim();
  const hd = String(opts.kvInvoiceCode || "").trim();
  const stored = String(opts.transferContent || "").trim();
  const built = (() => {
    if (kov && hd) return /\bV$/i.test(kov) ? `${kov} bill ${hd}` : `${kov} V bill ${hd}`;
    if (kov) return /\bV$/i.test(kov) ? `${kov} bill` : `${kov} V bill`;
    return "";
  })();

  if (stored) {
    const isBareInvoice = Boolean(hd && stored === hd);
    const hasKov = /KOVQR/i.test(stored) || (kov && stored.includes(kov));
    const hasBill = /\bbill\b/i.test(stored);
    if (!isBareInvoice && hasKov && hasBill) {
      if (built && stored !== built && !/\bV\s+bill\b/i.test(stored)) return built;
      return stored;
    }
    if (built) return built;
    if (!isBareInvoice && (hasKov || hasBill)) return stored;
    return stored || built || hd;
  }

  if (built) return built;
  return hd || String(opts.paymentCode || "").trim();
}

function CopyRow({
  label,
  value,
  compact,
  highlight = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
  highlight?: boolean;
}) {
  const [ok, setOk] = useState(false);
  return (
    <div
      className={`flex items-center justify-between gap-2 border-b border-[var(--aloha-line)] last:border-0 ${
        compact ? "py-1.5" : "py-2"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`font-semibold uppercase tracking-wide text-slate-500 ${
            compact ? "text-[10px]" : "text-[11px]"
          }`}
        >
          {label}
        </p>
        <p
          className={`break-all font-bold ${
            highlight
              ? "text-[var(--aloha-green)]"
              : "text-[var(--aloha-ink)]"
          } ${compact ? "text-[13px]" : "text-sm"}`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--aloha-cream)] px-2.5 py-1 text-xs font-bold text-[var(--aloha-green)] transition-colors hover:bg-[var(--aloha-green-light)] active:scale-95"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setOk(true);
            setTimeout(() => setOk(false), 1500);
          } catch {
            /* ignore */
          }
        }}
        title={`Sao chép ${label}`}
      >
        {ok ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
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
  kovCode,
  qrString,
  bank,
  qrUrl,
  expiresAt,
  productCodes,
  compact = false,
}: Props) {
  const { left, label } = useCountdown(expiresAt);
  const [zoomModalOpen, setZoomModalOpen] = useState(false);
  const content = resolveDisplayTransferContent({
    transferContent,
    kovCode,
    kvInvoiceCode,
    paymentCode,
    qrString,
  });
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
    <>
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-[#E8E2D6] shadow-sm">
        {/* Header */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-b border-[var(--aloha-line)] bg-[var(--aloha-green-light)] ${
            compact ? "px-3 py-2" : "px-4 py-3"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <QrCode size={16} className="text-[var(--aloha-green)]" />
            <p className={`font-extrabold text-[var(--aloha-ink)] ${compact ? "text-[13px]" : "text-sm"}`}>
              {isKiot ? "Quét QR thanh toán hóa đơn KiotViet" : "Chuyển khoản qua QR"}
            </p>
          </div>
          {left > 0 ? (
            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-[#EE6055] ring-1 ring-red-200">
              Còn {label}
            </span>
          ) : expiresAt ? (
            <span className="text-xs font-bold text-[#EE6055]">Đã hết hạn</span>
          ) : null}
        </div>

        {/* Content Body */}
        <div
          className={`grid ${
            compact
              ? "gap-3 p-3 sm:grid-cols-[140px_1fr]"
              : "gap-6 p-5 sm:grid-cols-[250px_1fr]"
          }`}
        >
          {/* QR Code Container */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => resolvedQr && setZoomModalOpen(true)}
              className={`group relative mx-auto flex items-center justify-center rounded-2xl bg-white p-2 ring-1 ring-[var(--aloha-line)] transition-all hover:ring-2 hover:ring-[var(--aloha-green)] hover:shadow-md cursor-pointer ${
                compact ? "h-[140px] w-[140px]" : "h-[240px] w-[240px] sm:h-[250px] sm:w-[250px]"
              }`}
              title="Nhấn để phóng to mã QR"
            >
              {resolvedQr ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolvedQr}
                    alt={isKiot ? "QR hóa đơn KiotViet" : "QR chuyển khoản"}
                    className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-[var(--aloha-ink)] shadow">
                      <ZoomIn size={14} /> Phóng to QR
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-xs text-slate-400">QR</span>
              )}
            </div>

            {resolvedQr && !compact ? (
              <button
                type="button"
                onClick={() => setZoomModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[var(--aloha-green)]"
              >
                <ZoomIn size={12} /> Nhấn để phóng to mã QR
              </button>
            ) : null}
          </div>

          {/* Details Column */}
          <div className="flex flex-col justify-between">
            {isKiot && (
              <div className="mb-2.5 inline-flex items-center gap-1.5 self-start rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                KiotViet POS Auto-Match (Tự động gạch nợ)
              </div>
            )}

            <div>
              <CopyRow compact={compact} label="Ngân hàng" value={bank?.bankName || "Vietcombank"} />
              <CopyRow compact={compact} label="Chủ tài khoản" value={bank?.accountName || "NGUYEN VAN XUAN"} />
              <CopyRow compact={compact} label="Số tài khoản" value={bank?.accountNumber || "—"} />
              <CopyRow compact={compact} label="Số tiền" value={String(Math.round(amount))} />
              <CopyRow
                compact={compact}
                label={isKiot ? "Nội dung CK (có mã KOV)" : "Nội dung CK"}
                value={content || "—"}
                highlight={true}
              />
            </div>

            <div className="mt-3">
              {!compact && productCodes?.length ? (
                <p className="text-xs text-slate-500">
                  Sản phẩm: {productCodes.slice(0, 6).join(", ")}
                  {productCodes.length > 6 ? "…" : ""}
                </p>
              ) : null}

              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Vui lòng giữ nguyên nội dung <strong className="text-[var(--aloha-green)]">{content || "—"}</strong>.{" "}
                {isKiot
                  ? "Sau khi chuyển khoản, KiotViet sẽ tự động khớp và gạch nợ hóa đơn ngay lập tức."
                  : "Có thể bấm «Tôi đã chuyển khoản» nếu cần."}
              </p>

              <div className="mt-2 flex items-center justify-between border-t border-[var(--aloha-line)] pt-2">
                <span className="text-xs font-semibold text-slate-500">Tổng thanh toán:</span>
                <span className="text-base font-extrabold text-[#EE6055]">
                  {formatVnd(amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal phóng to QR Full Screen */}
      {zoomModalOpen && resolvedQr ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setZoomModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomModalOpen(false)}
              className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              title="Đóng"
            >
              <X size={20} />
            </button>

            <div className="flex items-center justify-center gap-2 mb-1">
              <QrCode size={20} className="text-[var(--aloha-green)]" />
              <h3 className="text-lg font-extrabold text-[var(--aloha-ink)]">
                Mã QR Thanh Toán
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Mở app Sacombank, Vietcombank hoặc ngân hàng bất kỳ để quét mã
            </p>

            <div className="mx-auto flex w-fit items-center justify-center rounded-2xl bg-white p-3 shadow-inner ring-1 ring-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedQr}
                alt="QR thanh toán phóng to"
                className="h-[280px] w-[280px] sm:h-[340px] sm:w-[340px] object-contain"
              />
            </div>

            <div className="mt-4 rounded-xl bg-[var(--aloha-cream)] p-3 text-left text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-[var(--aloha-line)]">
                <span className="text-slate-500 font-medium">Ngân hàng:</span>
                <span className="font-bold">{bank?.bankName || "Vietcombank"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--aloha-line)]">
                <span className="text-slate-500 font-medium">STK:</span>
                <span className="font-bold">{bank?.accountNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--aloha-line)]">
                <span className="text-slate-500 font-medium">Số tiền:</span>
                <span className="font-bold text-[#EE6055]">{formatVnd(amount)}</span>
              </div>
              <div className="flex justify-between py-1 pt-1.5">
                <span className="text-slate-500 font-medium">Nội dung CK:</span>
                <span className="font-extrabold text-[var(--aloha-green)] break-all">{content}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setZoomModalOpen(false)}
              className="mt-4 w-full rounded-xl bg-[var(--aloha-green)] py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-95 active:scale-[0.99]"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
