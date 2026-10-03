"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShoppingCart, Truck } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { useCart } from "@/lib/cart";
import type { CampaignVoucherUI, CampaignViewerUI } from "@/lib/campaign/campaignApi";
import { shipGoalFor } from "@/lib/campaign/voucherPrice";
import { formatCompactVnd } from "@/lib/voucherFormat";
import { useStickyBarHeight } from "@/lib/floatingStack";

/** Thanh dính đáy (mobile, trên tab bar): tiến độ tới mốc hỗ trợ ship theo tạm tính giỏ + lối vào giỏ. */
export function DealsShipBar({
  vouchers,
  viewer,
  offsetMs,
}: {
  vouchers: CampaignVoucherUI[];
  viewer: CampaignViewerUI | null;
  offsetMs: number;
}) {
  const subtotal = useCart((s) => s.lines.reduce((n, l) => n + Math.max(0, l.gia) * l.qty, 0));
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const [mounted, setMounted] = useState(false);
  const barRef = useStickyBarHeight<HTMLDivElement>();
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const goal = shipGoalFor(subtotal, vouchers, viewer, Date.now() + offsetMs);
  if (!goal) return null;
  const value = formatCompactVnd(goal.value).toUpperCase();

  return (
    <div
      ref={barRef}
      className="fixed inset-x-0 z-40 px-2 pb-1.5 lg:hidden"
      style={{ bottom: "calc(var(--shop-mobile-tab-h, 0px) + 0.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 shadow-[0_-2px_18px_rgba(194,24,91,0.18)] ring-1 ring-[#F8BBD0] backdrop-blur">
        <div className="min-w-0 flex-1" role="status">
          {goal.kind === "short" ? (
            <>
              <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-slate-700">
                <Truck size={15} className="mt-px shrink-0 text-[var(--campaign-primary)]" aria-hidden />
                <span className="line-clamp-2">
                  Mua thêm <strong className="text-[var(--campaign-primary)]">{formatVnd(goal.shortfall)}</strong> để được hỗ trợ ship{" "}
                  <strong>{value}</strong>
                </span>
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#FCE4EC]" aria-hidden>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#F06292] to-[var(--campaign-primary)] transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${goal.pct}%` }}
                />
              </div>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-700">
              <CheckCircle2 size={15} className="shrink-0" aria-hidden />
              <span className="truncate">Giỏ đã đủ điều kiện hỗ trợ ship {value}</span>
            </p>
          )}
        </div>
        <Link
          href="/gio-hang"
          data-cart-target=""
          className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--campaign-primary)] text-white shadow-sm active:scale-95"
          aria-label={`Giỏ hàng${count ? `, ${count} sản phẩm` : ""}`}
        >
          <ShoppingCart size={19} aria-hidden />
          {count > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-black text-[var(--campaign-primary)] ring-2 ring-[var(--campaign-primary)]">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Link>
      </div>
    </div>
  );
}
