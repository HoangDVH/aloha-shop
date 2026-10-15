"use client";
import { voucherCustomerTitle } from "@/lib/voucherFormat";
import { formatVnd } from "@/lib/api";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { usePromotionQuote } from "@/lib/usePromotionQuote";
import { useWallet } from "@/lib/campaign/walletQueries";
import { useCampaignRequoteKey } from "@/lib/campaign/campaignQuote";

export function useProductPricing({ ma, name, qty, price, enabled = true }: { ma: string; name: string; qty: number; price: number; enabled?: boolean }) {
  const { user } = useShopAuth();
  const wallet = useWallet(Boolean(user));
  const campaignKey = useCampaignRequoteKey();
  return usePromotionQuote({
    lines: enabled ? [{ ma, ten: name, gia: price, qty }] : [], selectedCode: "", autoMode: true,
    phone: user?.phone, email: user?.email,
    refreshKey: `${user?.id}:${campaignKey}:${wallet.data?.claimedIds?.join(",")}`,
  });
}
export function ProductPricingSummary({ pricing, qty = 1, unit = "sản phẩm" }: { pricing: ReturnType<typeof useProductPricing>; qty?: number; unit?: string }) {
  const { quote, loading, stale } = pricing;
  const volume = quote?.campaign?.volumeSavings || 0;
  const flash = quote?.campaign?.flashSavings || 0;
  const anchor = quote?.campaign?.anchorSavings || 0;
  const voucher = quote?.discountTotal || 0;
  const savings = volume + flash + anchor + voucher;
  const row = (label: string, amount: number, saving = false) => <div className="flex justify-between gap-4"><span className="min-w-0 text-slate-500">{label}</span><span className={`shrink-0 tabular-nums ${saving ? "font-semibold text-green-800" : "text-slate-700"}`}>{saving ? "−" : ""}{formatVnd(amount)}</span></div>;
  return <section className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80 text-sm" aria-live="polite">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5"><h2 className="font-semibold text-slate-800">Chi tiết tạm tính</h2><span className="text-xs text-slate-500">{qty} {unit.toLowerCase()}</span></div>
    {loading || stale || !quote ? <p className="px-4 py-4 text-slate-500">Đang cập nhật giá và voucher…</p> : <div className="space-y-2 px-4 py-3">
      {row("Tiền hàng trước giảm", quote.subtotal + savings - voucher)}
      {volume > 0 && row("Giảm theo số lượng", volume, true)}
      {anchor > 0 && row("Giảm giá sản phẩm", anchor, true)}
      {flash > 0 && row("Giảm Flash Sale", flash, true)}
      {voucher > 0 && row(voucherCustomerTitle(quote.applied?.title) || "Voucher tiền hàng", voucher, true)}
      <div className="flex items-start justify-between gap-3 border-t border-slate-200 pt-3">
        <div><p className="font-bold text-slate-800">TẠM TÍNH</p><p className="mt-1 text-[11px] text-slate-500">Chưa bao gồm phí vận chuyển</p></div>
        <div className="text-right"><p className="text-xl font-extrabold tabular-nums text-[#e65343] sm:text-2xl">{formatVnd(quote.finalTotal)}</p>{savings > 0 && <p className="mt-1 text-[11px] text-green-700">Tiết kiệm {formatVnd(savings)}</p>}</div>
      </div>
    </div>}
  </section>;
}
