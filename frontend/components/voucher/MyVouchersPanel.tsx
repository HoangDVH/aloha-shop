"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw, Ticket, TicketPercent, Truck, Zap } from "lucide-react";
import { useWallet } from "@/lib/campaign/walletQueries";
import type { WalletItemState, WalletItemUI } from "@/lib/campaign/walletApi";
import { cleanVoucherTitle, formatCompactVnd, pctText, voucherUseHref } from "@/lib/voucherFormat";

type WalletTab = WalletItemUI["tab"];

const TABS: { id: WalletTab; label: string }[] = [
  { id: "active", label: "Còn dùng" },
  { id: "used", label: "Đã dùng" },
  { id: "expired", label: "Hết hạn" },
];

const STATE_LABEL: Record<WalletItemState, string> = {
  usable: "Dùng ngay",
  held: "Đang giữ cho đơn",
  upcoming: "Chưa tới ngày dùng",
  paused: "Tạm dừng",
  locked: "Không áp dụng cho tài khoản",
  used: "Đã dùng",
  expired: "Hết hạn",
};

const EMPTY_TEXT: Record<WalletTab, string> = {
  active: "Bạn chưa lưu voucher nào.",
  used: "Chưa có voucher nào đã dùng.",
  expired: "Không có voucher hết hạn.",
};

function vnDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function tikTokDiscountText(v: { benefitType?: "goods" | "shipping"; discountType: string; discountValue: number; mystery?: any }): string {
  if (v.benefitType === "shipping") {
    if (v.discountType === "fixed" && v.discountValue > 0) {
      return `Giảm ${formatCompactVnd(v.discountValue).toUpperCase()}`;
    }
    if (v.discountType === "percentage" && v.discountValue > 0) {
      return `Giảm ${v.discountValue}%`;
    }
    return "Freeship";
  }
  if (v.discountType === "percentage") {
    return `Giảm ${pctText(v)}`;
  }
  return `Giảm ${formatCompactVnd(v.discountValue).toUpperCase()}`;
}

function tikTokMinOrderText(v: { minOrderThreshold?: number }): string {
  if (v.minOrderThreshold && v.minOrderThreshold > 0) {
    return `Đơn từ ${formatCompactVnd(v.minOrderThreshold).toUpperCase()}`;
  }
  return "Mọi đơn hàng";
}

function tikTokCapText(v: { discountType: string; maxDiscountVnd?: number }): string {
  if (v.discountType === "percentage" && v.maxDiscountVnd && v.maxDiscountVnd > 0) {
    return `Tối đa ${formatCompactVnd(v.maxDiscountVnd).toUpperCase()}`;
  }
  return "";
}

function WalletRow({ item }: { item: WalletItemUI }) {
  const v = item.voucher;
  if (!v) return null;
  const isShip = v.benefitType === "shipping";
  const isMystery = Boolean(v.mystery);
  const dim = item.tab !== "active" || item.state === "locked" || item.state === "paused";
  const title = cleanVoucherTitle(v);
  const discountText = tikTokDiscountText(v);
  const minOrderText = tikTokMinOrderText(v);
  const capText = tikTokCapText(v);

  return (
    <div
      className={`relative flex min-h-[76px] sm:min-h-[82px] h-full w-full overflow-hidden rounded-xl sm:rounded-2xl border border-stone-200/90 bg-white shadow-2xs select-none transition-all duration-200 hover:shadow-xs ${
        dim ? "opacity-60 bg-stone-50/50" : ""
      }`}
    >
      {/* Cuống vé bên trái - Chuẩn TikTok Shop / Ưu đãi (62px mobile / 68px desktop) */}
      <div
        className={`flex w-[62px] sm:w-[68px] shrink-0 flex-col items-center justify-center p-1 sm:p-1.5 border-r border-dashed ${
          dim
            ? "bg-slate-100 text-slate-400 border-slate-200"
            : isShip
            ? "bg-[#E6F8F6] text-[#00B5A5] border-[#B2EBE6]"
            : isMystery
            ? "bg-[#FFF0F2] text-[#FE2C55] border-[#FDD3D9]"
            : "bg-[#FFF0F2] text-[#FE2C55] border-[#FDD3D9]"
        }`}
      >
        {isShip ? (
          <Truck size={20} strokeWidth={2.2} />
        ) : isMystery ? (
          <Zap size={20} className="fill-current" strokeWidth={0} />
        ) : (
          <TicketPercent size={20} strokeWidth={2.2} />
        )}
        <span className="mt-1 text-[9.5px] sm:text-[10px] font-bold leading-none text-center">
          {isShip ? "Vận chuyển" : isMystery ? "Túi mù" : "Sản phẩm"}
        </span>
      </div>

      {/* Vết khuyết bán nguyệt (Notches) */}
      <span
        className="pointer-events-none absolute -top-1.5 left-[62px] sm:left-[68px] z-10 h-3 w-3 -translate-x-1/2 rounded-full border border-stone-200/90 bg-white"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -bottom-1.5 left-[62px] sm:left-[68px] z-10 h-3 w-3 -translate-x-1/2 rounded-full border border-stone-200/90 bg-white"
        aria-hidden="true"
      />

      {/* Thân vé bên phải */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-1.5 pl-2.5 pr-2 sm:py-2 sm:pl-3 sm:pr-3 relative">
        {/* HÀNG 1: TIÊU ĐỀ VOUCHER (Trải rộng 100% thân vé) + HUY HIỆU HOÀN LẠI NẾU CÓ */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <h4
            className="text-[12px] sm:text-[13px] font-bold text-slate-900 leading-tight truncate flex-1"
            title={v.title || title}
          >
            {title}
          </h4>
          {item.returnedFrom ? (
            <span
              className="shrink-0 inline-flex items-center gap-0.5 rounded bg-sky-50 px-1.5 py-0.5 text-[8.5px] sm:text-[9px] font-bold text-sky-700 ring-1 ring-sky-200"
              title={`Đã hoàn lại từ đơn ${item.returnedFrom.orderCode}`}
            >
              <RotateCcw size={8.5} className="shrink-0" aria-hidden />
              <span>Đã hoàn lại</span>
            </span>
          ) : null}
        </div>

        {/* HÀNG 2: MỨC GIẢM + ĐIỀU KIỆN (BÊN TRÁI) & NÚT HÀNH ĐỘNG (BÊN PHẢI) */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1 flex-wrap">
              <span
                className={`text-[13.5px] sm:text-[15px] font-black leading-tight shrink-0 ${
                  dim
                    ? "text-slate-500"
                    : isShip
                    ? "text-[#008A7E]"
                    : "text-[#FE2C55]"
                }`}
              >
                {discountText}
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate leading-tight">
                · {minOrderText}
              </span>
              {capText ? (
                <span className="text-[9.5px] sm:text-[10px] text-slate-400 truncate leading-tight">
                  ({capText})
                </span>
              ) : null}
            </div>

            {/* Dòng metadata phụ: HSD / Bóc túi mù / Đơn hoàn / Đơn đã dùng */}
            <div className="flex items-center gap-1.5 mt-0.5 text-[9px] sm:text-[10px] text-slate-400 leading-none truncate">
              {item.state === "upcoming" && v.startDate ? (
                <span>Dùng từ {vnDate(v.startDate)}</span>
              ) : v.endDate ? (
                <span>HSD: {vnDate(v.endDate)}</span>
              ) : null}

              {v.mystery?.drawnPercent ? (
                <span className="font-semibold text-amber-600">
                  · Đã bóc {v.mystery.drawnPercent}%
                </span>
              ) : null}

              {item.returnedFrom ? (
                <span className="font-medium text-sky-700">
                  · Đơn {item.returnedFrom.orderCode} huỷ
                </span>
              ) : null}

              {item.orderCode && (item.state === "used" || item.state === "held") ? (
                <span>
                  · Đơn{" "}
                  <Link
                    href={`/tai-khoan?tab=don-mua&dat=${encodeURIComponent(item.orderCode)}`}
                    className="font-semibold text-[#FE2C55] underline hover:text-[#C8102E]"
                  >
                    {item.orderCode}
                  </Link>
                  {item.usedAt ? ` (${vnDate(item.usedAt)})` : ""}
                </span>
              ) : null}
            </div>
          </div>

          <div className="shrink-0">
            {item.state === "usable" ? (
              <Link
                href={voucherUseHref(v.id)}
                className={`inline-flex items-center justify-center rounded-full px-3 sm:px-3.5 py-1 text-[11px] font-bold border transition ${
                  isShip
                    ? "border-[#00B5A5] text-[#00B5A5] bg-cyan-50/40 hover:bg-[#00B5A5] hover:text-white"
                    : "border-[#FE2C55] text-[#FE2C55] bg-rose-50/40 hover:bg-[#FE2C55] hover:text-white"
                }`}
              >
                Dùng ngay
              </Link>
            ) : (
              <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10.5px] sm:text-[11px] font-semibold text-slate-500">
                {STATE_LABEL[item.state]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MyVouchersPanel() {
  const q = useWallet(true);
  const [tab, setTab] = useState<WalletTab>("active");
  const data = q.data;
  const rawItems = (data?.items || []).filter((i) => i.tab === tab && i.voucher);
  const items = [...rawItems].sort((a, b) => {
    const isShipA = a.voucher?.benefitType === "shipping" ? 1 : 0;
    const isShipB = b.voucher?.benefitType === "shipping" ? 1 : 0;
    if (isShipA !== isShipB) return isShipA - isShipB;
    const minA = Number(a.voucher?.minOrderThreshold) || 0;
    const minB = Number(b.voucher?.minOrderThreshold) || 0;
    if (minA !== minB) return minA - minB;
    const valA = Number(a.voucher?.discountValue) || 0;
    const valB = Number(b.voucher?.discountValue) || 0;
    return valA - valB;
  });

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[var(--aloha-line)] sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-[var(--aloha-ink)]">Voucher của tôi</h2>
        <Link href="/uu-dai" className="text-sm font-semibold text-[#C8102E] hover:underline">
          Săn thêm voucher
        </Link>
      </div>
      <div role="tablist" aria-label="Trạng thái voucher" className="mt-3 flex gap-1 border-b border-[var(--aloha-line)]">
        {TABS.map((t) => {
          const n = data?.counts?.[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px min-h-[44px] border-b-2 px-3 text-sm font-semibold ${
                tab === t.id ? "border-[#C8102E] text-[#C8102E]" : "border-transparent text-slate-500"
              }`}
            >
              {t.label}
              {n ? ` (${n})` : ""}
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        {q.isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />
        ) : data && !data.enabled ? (
          <p className="py-8 text-center text-sm text-slate-500">Ví voucher chưa mở.</p>
        ) : items.length ? (
          <ul className="grid gap-2 sm:gap-2.5 md:grid-cols-2">
            {items.map((i) => (
              <li key={i.promotionId} className="h-full flex flex-col">
                <WalletRow item={i} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">
            <Ticket className="mx-auto mb-2 text-slate-300" size={32} aria-hidden />
            {EMPTY_TEXT[tab]}
          </div>
        )}
      </div>
    </section>
  );
}
