"use client";
import { useEffect, useMemo, useState } from "react";
import { formatAppliedVoucherTitle, voucherCustomerTitle } from "@/lib/voucherFormat";
import { formatVnd } from "@/lib/api";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { usePromotionQuote } from "@/lib/usePromotionQuote";
import { useWallet } from "@/lib/campaign/walletQueries";
import { useCampaignRequoteKey } from "@/lib/campaign/campaignQuote";

export function useProductPricing({
  ma,
  name,
  qty,
  price,
  enabled = true,
  extraLines = [],
}: {
  ma: string;
  name: string;
  qty: number;
  price: number;
  enabled?: boolean;
  extraLines?: Array<{ ma: string; ten?: string; gia: number; qty: number }>;
}) {
  const { user } = useShopAuth();
  const wallet = useWallet(Boolean(user));
  const campaignKey = useCampaignRequoteKey();

  const [deliverySpeed, setDeliverySpeed] = useState<"standard" | "delayed_3d">(() => {
    if (typeof window !== "undefined") {
      try {
        const s = sessionStorage.getItem("aloha_delivery_speed");
        if (s === "delayed_3d") return "delayed_3d";
      } catch {}
    }
    return "standard";
  });

  useEffect(() => {
    const onSpeedChanged = (e: any) => {
      const speed = e?.detail?.speed || (typeof window !== "undefined" ? sessionStorage.getItem("aloha_delivery_speed") : null);
      if (speed === "delayed_3d" || speed === "standard") {
        setDeliverySpeed(speed);
      }
    };
    window.addEventListener("aloha-delivery-speed-changed", onSpeedChanged);
    return () => window.removeEventListener("aloha-delivery-speed-changed", onSpeedChanged);
  }, []);

  const lines = useMemo(() => {
    if (!enabled) return [];
    return [{ ma, ten: name, gia: price, qty }, ...(extraLines || [])];
  }, [enabled, ma, name, price, qty, extraLines]);

  const linesKey = useMemo(() => {
    return lines.map((l) => `${l.ma}:${l.qty}:${l.gia}`).join(";");
  }, [lines]);

  return usePromotionQuote({
    lines,
    selectedCode: "",
    autoMode: true,
    deliverySpeed,
    phone: user?.phone,
    email: user?.email,
    refreshKey: `${user?.id}:${campaignKey}:${wallet.data?.claimedIds?.join(",")}:${deliverySpeed}:${linesKey}`,
  });
}

export function ProductPricingSummary({
  pricing,
  qty = 1,
  unit = "sản phẩm",
  attachedLines = [],
}: {
  pricing: ReturnType<typeof useProductPricing>;
  qty?: number;
  unit?: string;
  attachedLines?: Array<{ ma: string; ten?: string; gia: number; qty: number }>;
}) {
  const { quote, loading, stale } = pricing;
  const volume = quote?.campaign?.volumeSavings || 0;
  const flash = quote?.campaign?.flashSavings || 0;
  const anchor = quote?.campaign?.anchorSavings || 0;
  const voucher = quote?.discountTotal || 0;
  const wholesale = quote?.wholesaleSavings || 0;
  const savings = volume + flash + anchor + voucher + wholesale;
  const attachedQty = (attachedLines || []).reduce((sum, l) => sum + (l.qty || 1), 0);
  const attachedTotal = (attachedLines || []).reduce((sum, l) => sum + l.gia * (l.qty || 1), 0);
  const totalRaw = quote ? quote.subtotal + savings - voucher : 0;
  const mainProductRaw = Math.max(0, totalRaw - attachedTotal);

  const row = (label: string, amount: number, saving = false, plus = false) => (
    <div className="flex justify-between gap-4">
      <span className="min-w-0 truncate text-slate-500" title={label}>{label}</span>
      <span className={`shrink-0 tabular-nums ${saving ? "font-semibold text-green-800" : plus ? "font-semibold text-slate-700" : "text-slate-700"}`}>
        {saving ? "−" : plus ? "+" : ""}{formatVnd(amount)}
      </span>
    </div>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80 text-sm" aria-live="polite">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <h2 className="font-semibold text-slate-800">Chi tiết tạm tính</h2>
        <span className="text-xs text-slate-500">
          {qty} {unit.toLowerCase()}
          {attachedQty > 0 ? ` + ${attachedQty} mua kèm` : ""}
        </span>
      </div>
      {loading || stale || !quote ? (
        <p className="px-4 py-4 text-slate-500">Đang cập nhật giá và voucher…</p>
      ) : (
        <div className="space-y-2 px-4 py-3">
          {attachedLines && attachedLines.length > 0 ? (
            <>
              {row("Giá gốc sản phẩm", mainProductRaw)}
              {attachedLines.map((l) =>
                row(
                  `Sản phẩm đi kèm: ${l.ten || l.ma}${l.qty > 1 ? ` (x${l.qty})` : ""}`,
                  l.gia * (l.qty || 1),
                  false,
                  true
                )
              )}
            </>
          ) : (
            row("Giá gốc sản phẩm", totalRaw)
          )}
          {wholesale > 0 && row("Ưu đãi giá sỉ so với giá web", wholesale, true)}
          {volume > 0 && row("Giảm theo số lượng", volume, true)}
          {anchor > 0 && row("Giảm giá sản phẩm", anchor, true)}
          {flash > 0 && row("Giảm Flash Sale", flash, true)}
          {voucher > 0 && row(formatAppliedVoucherTitle(quote.applied, quote.applied?.title) || "Voucher tiền hàng", voucher, true)}
          <div className="flex items-start justify-between gap-3 border-t border-slate-200 pt-3">
            <div>
              <p className="font-bold text-slate-800">TẠM TÍNH</p>
              <p className="mt-1 text-[11px] text-slate-500">Chưa bao gồm phí vận chuyển</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-extrabold tabular-nums text-rose-600 sm:text-2xl">
                {formatVnd(quote.finalTotal)}
              </p>
              {savings > 0 && (
                <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                  Tiết kiệm {formatVnd(savings)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
