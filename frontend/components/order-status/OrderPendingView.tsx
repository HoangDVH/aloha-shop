"use client";
import { Clock } from "lucide-react";
import { cancelUnpaidOrder, reportPaidOrder, type ShopOrder } from "@/lib/orders";
import { BankTransferQrPanel } from "@/components/BankTransferQrPanel";
import { OrderOverview } from "./OrderOverview";
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
  return <OrderOverview order={order} hero={hero} addressLine={addressLine} paymentAction={isUnpaidCk || isExpiredCk}>
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

  </OrderOverview>;
}
