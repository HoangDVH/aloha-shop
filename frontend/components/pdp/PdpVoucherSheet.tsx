"use client";
import { voucherCustomerTitle } from "@/lib/voucherFormat";
import { useEffect, useRef, useId } from "react";
import { X, Ticket, Truck } from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { AvailablePromotionUI } from "@/lib/promotions";
export function PdpVoucherSheet({
  items,
  unavailable = {},
  claimed,
  pendingId,
  activePromoId,
  onClaim,
  onSelectVoucher,
  onDetails,
  onClose,
}: {
  items: AvailablePromotionUI[];
  claimed: Set<string>;
  pendingId: string | null;
  unavailable?: Record<string, string>;
  activePromoId?: string | null;
  onClaim: (p: AvailablePromotionUI) => void;
  onSelectVoucher?: (p: AvailablePromotionUI) => void;
  onDetails: (p: AvailablePromotionUI) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = old; };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-3xl border-0 bg-white p-0 text-slate-800 backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:max-w-lg sm:rounded-2xl">
    <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2"><h2 id={titleId} className="text-base font-bold">Voucher &amp; khuyến mãi</h2><button type="button" aria-label="Đóng voucher" onClick={onClose} className="flex h-11 w-11 items-center justify-center"><X size={20}/></button></header>
    <div className="max-h-[calc(85dvh-60px)] space-y-5 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <p className="text-xs leading-relaxed text-slate-500">Voucher đã chọn sẽ được hiển thị ngay tại mục Chi tiết tạm tính và đồng bộ khi thanh toán.</p>
      {["shipping", "goods"].map(kind => {
        const promos = items.filter(p => (p.benefitType === "shipping" ? "shipping" : "goods") === kind);
        if (!promos.length) return null;
        const shipping = kind === "shipping";
        return <section key={kind} className="space-y-2"><h3 className="text-sm font-semibold">{shipping ? "Voucher vận chuyển" : "Voucher tiền hàng"}</h3>
          {promos.map(p => <article key={p.id} className={`flex gap-3 rounded-xl border p-3 ${unavailable[p.id] ? "border-stone-200 bg-stone-50 text-stone-500" : p.id === activePromoId ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/70" : shipping ? "border-teal-200 bg-teal-50/60 text-slate-800" : "border-rose-200 bg-rose-50/60 text-slate-800"}`}>
            <div className={`flex w-12 shrink-0 flex-col items-center justify-center gap-1 text-center text-[9px] ${shipping ? "text-teal-700" : "text-rose-600"}`}>{shipping ? <Truck size={22}/> : <Ticket size={22}/>}<span>{shipping ? "Vận chuyển" : "Sản phẩm"}</span></div>
            <div className="min-w-0 flex-1 space-y-1"><p className="text-sm font-bold">{voucherCustomerTitle(p.title, p)}</p>{shipping && <p className="text-xs">{p.minOrderThreshold ? `Đơn từ ${formatVnd(p.minOrderThreshold)}` : "Không có mức tối thiểu"}</p>}
              {p.minLeadDays && p.minLeadDays >= 3 ? <p className="text-xs text-[#047857] font-semibold">Áp dụng khi chọn Chờ giao sau {p.minLeadDays} ngày</p> : null}
              {p.endDate && <p className="text-[11px] text-slate-500">HSD: {new Date(p.endDate).toLocaleDateString("vi-VN")}</p>}
              {unavailable[p.id] && <p className="text-xs text-stone-500">{unavailable[p.id]}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button type="button" onClick={() => onDetails(p)} className="min-h-9 text-xs text-slate-600 underline cursor-pointer">Điều kiện &amp; chi tiết</button>
                {unavailable[p.id] ? (
                  <button type="button" disabled className="min-h-9 rounded-full px-4 text-xs font-semibold bg-stone-100 text-stone-500">
                    Không áp dụng
                  </button>
                ) : p.id === activePromoId ? (
                  <span className="min-h-9 inline-flex items-center rounded-full bg-emerald-50 border border-emerald-300 px-4 text-xs font-bold text-emerald-700">
                    ✓ Đang áp dụng
                  </span>
                ) : shipping ? (
                  <button
                    type="button"
                    disabled={Boolean(pendingId) || claimed.has(p.id)}
                    onClick={() => (p.claimRequired ? onClaim(p) : onDetails(p))}
                    className={`min-h-9 rounded-full px-4 text-xs font-semibold transition cursor-pointer ${
                      claimed.has(p.id)
                        ? "bg-stone-100 text-stone-600"
                        : "bg-teal-600 hover:bg-teal-700 text-white"
                    }`}
                  >
                    {pendingId === p.id ? "Đang lưu…" : claimed.has(p.id) ? "Đã lưu" : p.claimRequired ? "Nhận" : "Xem ưu đãi"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(pendingId)}
                    onClick={() => (onSelectVoucher ? onSelectVoucher(p) : p.claimRequired ? onClaim(p) : onDetails(p))}
                    className="min-h-9 rounded-full px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer active:scale-95 shadow-xs"
                  >
                    {pendingId === p.id
                      ? "Đang lưu…"
                      : (p.minLeadDays || 0) >= 3
                      ? "Chọn Chờ 3 ngày"
                      : "Áp dụng (Giao ngay)"}
                  </button>
                )}
              </div>
            </div>
          </article>)}
        </section>;
      })}
    </div>
  </dialog>;
}
