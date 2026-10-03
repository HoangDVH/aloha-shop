"use client";

import Link from "next/link";
import type { CampaignVoucherUI } from "@/lib/campaign/campaignApi";

export type VoucherKind = "all" | "giam" | "ship";

const isShip = (v: CampaignVoucherUI) => v.benefitType === "shipping";

export function toVoucherKind(raw: string | null): VoucherKind {
  return raw === "ship" || raw === "giam" ? raw : "all";
}

/** Lọc theo loại; loại được chọn không có mã nào thì hiện tất cả. */
export function filterVouchers(list: CampaignVoucherUI[], kind: VoucherKind): CampaignVoucherUI[] {
  if (kind === "all") return list;
  const out = list.filter((v) => (kind === "ship" ? isShip(v) : !isShip(v)));
  return out.length ? out : list;
}

/** Chip "Tất cả / Giảm giá / Hỗ trợ ship" trong tab Voucher; chỉ hiện khi có cả 2 loại. */
export function VoucherKindFilter({
  vouchers,
  active,
  hrefFor,
}: {
  vouchers: CampaignVoucherUI[];
  active: VoucherKind;
  hrefFor: (kind: VoucherKind) => string;
}) {
  const ship = vouchers.filter(isShip).length;
  const giam = vouchers.length - ship;
  if (!ship || !giam) return null;
  const chips: { kind: VoucherKind; label: string; count: number }[] = [
    { kind: "all", label: "Tất cả", count: vouchers.length },
    { kind: "giam", label: "Giảm giá", count: giam },
    { kind: "ship", label: "Hỗ trợ ship", count: ship },
  ];
  return (
    <div role="group" aria-label="Loại voucher" className="mb-3 flex flex-wrap gap-2">
      {chips.map((c) => {
        const on = c.kind === active;
        return (
          <Link
            key={c.kind}
            href={hrefFor(c.kind)}
            replace
            scroll={false}
            aria-pressed={on}
            className={`inline-flex min-h-[36px] items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
              on ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-black/10 hover:bg-slate-50"
            }`}
          >
            {c.label}
            <span className={on ? "text-white/70" : "text-slate-400"}>{c.count}</span>
          </Link>
        );
      })}
    </div>
  );
}
