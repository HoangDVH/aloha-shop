"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Package, Receipt } from "lucide-react";
import { formatVnd } from "@/lib/api";
import {
  cancelUnpaidOrder,
  displayShopOrderCode,
  listMyOrders,
  renewPaymentOrder,
  subscribeShopOrdersStream,
  type ShopOrder,
} from "@/lib/orders";
import { useShopLoadingWhile } from "@/lib/useShopLoadingWhile";
import { BankTransferQrPanel } from "@/components/BankTransferQrPanel";

function paymentLabel(o: ShopOrder): string {
  switch (o.paymentStatus) {
    case "unpaid":
      return "Chờ chuyển khoản";
    case "processing":
      return "Đang xác nhận CK";
    case "paid":
      return "Đã thanh toán";
    case "underpaid":
      return "Thiếu tiền — đang kiểm tra";
    case "expired":
      return "Hết hạn CK";
    case "cancelled":
      return "Đã hủy";
    case "failed":
      return "Lỗi xác nhận";
    case "cod":
      return "COD — chờ xử lý";
    default:
      return o.statusValue || o.status || "";
  }
}

export function OrdersPanel({ highlightCode }: { highlightCode?: string }) {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCode, setBusyCode] = useState("");

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await listMyOrders();
      setOrders(data);
      setError("");
    } catch (e: any) {
      if (!silent) setError(e?.message || "Không tải được đơn");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const hasLive = orders.some(
    (o) =>
      o.paymentStatus === "unpaid" ||
      o.paymentStatus === "processing" ||
      o.paymentStatus === "cod"
  );

  useEffect(() => {
    if (!hasLive) return;
    return subscribeShopOrdersStream(() => {
      void reload(true);
    });
  }, [hasLive, reload]);

  useShopLoadingWhile(loading);

  if (loading) {
    return null;
  }

  if (error) {
    return <p className="p-6 text-center text-sm text-red-600">{error}</p>;
  }

  if (!orders.length) {
    return (
      <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-[var(--aloha-line)]">
        <Receipt className="mx-auto text-[var(--aloha-green)]" size={36} />
        <h2 className="mt-3 text-lg font-extrabold text-[var(--aloha-ink)]">Đơn mua</h2>
        <p className="mt-1 text-sm text-slate-500">Chưa có đơn trên web.</p>
        <Link
          href="/tim"
          className="mt-4 inline-flex rounded-lg bg-[var(--aloha-green)] px-4 py-2 text-sm font-bold text-white"
        >
          Mua sắm ngay
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {highlightCode ? (
        (() => {
          const matched = orders.find(
            (o) =>
              o.code === highlightCode ||
              o.kvInvoiceCode === highlightCode ||
              o.kvOrderCode === highlightCode ||
              o.id === highlightCode
          );
          const shown = matched
            ? displayShopOrderCode(matched)
            : highlightCode;
          const pathCode = matched ? displayShopOrderCode(matched) : highlightCode;
          return (
            <p className="rounded-xl bg-[var(--aloha-green-light)] px-4 py-3 text-sm font-semibold text-[var(--aloha-green-mid)]">
              Đơn {shown} đã ghi nhận.{" "}
              <Link
                href={`/don-hang/${encodeURIComponent(pathCode)}`}
                className="underline underline-offset-2"
              >
                Xem trạng thái
              </Link>
            </p>
          );
        })()
      ) : null}
      {orders.map((o) => (
        <article
          key={o.id || o.code}
          className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[var(--aloha-line)] sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link
                href={`/don-hang/${encodeURIComponent(displayShopOrderCode(o) || o.code)}`}
                className="group inline-flex items-center gap-1 text-sm font-extrabold text-[var(--aloha-ink)] hover:text-[var(--aloha-green)]"
              >
                {displayShopOrderCode(o)}
                <ChevronRight
                  size={16}
                  className="opacity-40 transition group-hover:opacity-100"
                />
              </Link>
              <p className="mt-0.5 text-xs text-slate-500">
                {(o.createdAt || o.purchaseDate || "").slice(0, 16).replace("T", " ")}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rounded-full bg-[var(--aloha-green-light)] px-2.5 py-1 text-xs font-bold text-[var(--aloha-green)]">
                {paymentLabel(o)}
              </span>
              {o.orderStatus && o.orderStatus !== o.paymentStatus ? (
                <span className="text-[11px] font-semibold text-slate-500">
                  Đơn: {o.statusValue || o.orderStatus}
                </span>
              ) : null}
            </div>
          </div>
          <ul className="mt-3 space-y-2.5 border-t border-[var(--aloha-line)] pt-3">
            {(o.orderDetails || []).slice(0, 4).map((d, i) => (
              <li key={`${d.productCode}-${i}`} className="flex items-center gap-2.5 text-sm">
                {d.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.imageUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-[#E8E2D6]"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--aloha-cream)]">
                    <Package size={16} className="text-[var(--aloha-green)]" />
                  </div>
                )}
                <span className="min-w-0 flex-1 line-clamp-2 text-slate-700">
                  {d.productName} × {d.quantity}
                </span>
                <span className="shrink-0 font-semibold text-[var(--aloha-ink)]">
                  {formatVnd(d.price * d.quantity)}
                </span>
              </li>
            ))}
            {(o.orderDetails || []).length > 4 ? (
              <li className="text-xs text-slate-500">
                +{(o.orderDetails || []).length - 4} sản phẩm khác
              </li>
            ) : null}
          </ul>
          <div className="mt-3 space-y-1 border-t border-[var(--aloha-line)] pt-3 text-sm">
            {o.subtotal != null && (o.shippingFee ?? 0) > 0 ? (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Tiền hàng</span>
                  <span>{formatVnd(o.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    Phí ship
                    {o.shippingCarrier === "ghn"
                      ? " (GHN)"
                      : o.shippingCarrier === "ghtk"
                        ? " (GHTK)"
                        : ""}
                  </span>
                  <span>{formatVnd(o.shippingFee || 0)}</span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between font-bold">
              <span>Tổng thanh toán</span>
              <span className="text-[#EE6055]">{formatVnd(o.totalPayment ?? o.total)}</span>
            </div>
          </div>

          <Link
            href={`/don-hang/${encodeURIComponent(displayShopOrderCode(o) || o.code)}`}
            className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[#C5D5C0] py-2 text-sm font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
          >
            Xem trạng thái đơn
            <ChevronRight size={16} />
          </Link>

          {o.paymentStatus === "expired" && o.method !== "Cash" ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-600">
                Mã QR đã hết hạn — tạo mã mới để thanh toán tiếp đơn này.
              </p>
              <button
                type="button"
                disabled={busyCode === o.code}
                className="w-full rounded-lg bg-[var(--aloha-green)] py-2 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)] disabled:opacity-50"
                onClick={async () => {
                  setBusyCode(o.code);
                  setError("");
                  try {
                    await renewPaymentOrder(o.code);
                    await reload(true);
                  } catch (e: any) {
                    setError(e?.message || "Không tạo được mã mới");
                  } finally {
                    setBusyCode("");
                  }
                }}
              >
                {busyCode === o.code ? "Đang tạo…" : "Tạo mã QR mới"}
              </button>
              <Link
                href={`/don-hang/${encodeURIComponent(displayShopOrderCode(o) || o.code)}`}
                className="inline-flex w-full items-center justify-center rounded-lg border border-[#C5D5C0] py-2 text-sm font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
              >
                Mở trang thanh toán
              </Link>
            </div>
          ) : null}

          {o.paymentStatus === "unpaid" && (o.paymentCode || o.kvInvoiceCode) ? (
            <div className="mt-4 space-y-3">
              <BankTransferQrPanel
                amount={Number(o.totalPayment ?? o.total) || 0}
                paymentCode={o.transferContent || o.kvInvoiceCode || o.paymentCode || ""}
                transferContent={o.transferContent}
                qrKind={o.qrKind}
                kvInvoiceCode={o.kvInvoiceCode}
                kovCode={o.kovCode}
                qrString={o.qrString}
                bank={o.bank}
                qrUrl={o.qrUrl}
                expiresAt={o.expiresAt}
                productCodes={(o.orderDetails || []).map((d) => d.productCode)}
              />
              {o.expiresAt && new Date(o.expiresAt).getTime() <= Date.now() ? (
                <button
                  type="button"
                  disabled={busyCode === o.code}
                  className="w-full rounded-lg bg-[var(--aloha-green)] py-2 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)] disabled:opacity-50"
                  onClick={async () => {
                    setBusyCode(o.code);
                    setError("");
                    try {
                      await renewPaymentOrder(o.code);
                      await reload(true);
                    } catch (e: any) {
                      setError(e?.message || "Không tạo được mã mới");
                    } finally {
                      setBusyCode("");
                    }
                  }}
                >
                  {busyCode === o.code ? "Đang tạo…" : "Tạo mã QR mới"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busyCode === o.code}
                className="w-full rounded-lg border border-slate-300 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                onClick={async () => {
                  setBusyCode(o.code);
                  try {
                    await cancelUnpaidOrder(o.code);
                    await reload(true);
                  } catch (e: any) {
                    setError(e?.message || "Không hủy được");
                  } finally {
                    setBusyCode("");
                  }
                }}
              >
                Hủy đơn chờ thanh toán
              </button>
            </div>
          ) : null}

          {o.paymentStatus === "cod" &&
          (o.orderStatus === "cho_xu_ly" || o.status === "cho") ? (
            <button
              type="button"
              disabled={busyCode === o.code}
              className="mt-3 w-full rounded-lg border border-slate-300 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              onClick={async () => {
                if (!window.confirm("Hủy đơn COD này?")) return;
                setBusyCode(o.code);
                setError("");
                try {
                  await cancelUnpaidOrder(o.code);
                  await reload(true);
                } catch (e: any) {
                  setError(e?.message || "Không hủy được");
                } finally {
                  setBusyCode("");
                }
              }}
            >
              Hủy đơn
            </button>
          ) : null}
        </article>
      ))}
    </section>
  );
}
