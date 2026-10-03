"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Receipt, Ticket } from "lucide-react";
import { useWallet } from "@/lib/campaign/walletQueries";
import type { WalletItemState, WalletItemUI } from "@/lib/campaign/walletApi";
import { formatVoucherBadge, voucherConditionText, voucherHeadline, voucherUseHref } from "@/lib/voucherFormat";
import { TicketLine, VoucherTicket, type TicketTone } from "./VoucherTicket";
import { ReturnedBadge } from "./ReturnedBadge";

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

function toneOf(item: WalletItemUI): TicketTone {
  if (item.tab !== "active") return "gray";
  return item.voucher?.benefitType === "shipping" ? "green" : "red";
}

function WalletRow({ item }: { item: WalletItemUI }) {
  const v = item.voucher;
  if (!v) return null;
  const dim = item.tab !== "active" || item.state === "locked" || item.state === "paused";
  return (
    <VoucherTicket
      stubValue={voucherHeadline(v)}
      stubTopLabel={v.targetCustomer === "new_web" ? "Khách mới" : undefined}
      tone={toneOf(item)}
      title={v.title || formatVoucherBadge(v).label}
      disabled={dim}
      notchBg="#ffffff"
      action={
        item.state === "usable" ? (
          <Link href={voucherUseHref(v.id)} className="inline-flex min-h-[36px] items-center rounded-full bg-[#C8102E] px-3 text-xs font-bold text-white">
            Dùng ngay
          </Link>
        ) : (
          <span className="text-[11px] font-semibold text-slate-500">{STATE_LABEL[item.state]}</span>
        )
      }
    >
      <p className="text-[11px] text-slate-500">{voucherConditionText(v)}</p>
      {item.state === "upcoming" && v.startDate ? (
        <TicketLine icon={<CalendarClock size={12} aria-hidden />}>Dùng từ {vnDate(v.startDate)}</TicketLine>
      ) : v.endDate && item.tab === "active" ? (
        <TicketLine icon={<CalendarClock size={12} aria-hidden />}>HSD {vnDate(v.endDate)}</TicketLine>
      ) : null}
      {item.orderCode && (item.state === "used" || item.state === "held") ? (
        <TicketLine icon={<Receipt size={12} aria-hidden />}>
          Đơn{" "}
          <Link href={`/tai-khoan?tab=don-mua&dat=${encodeURIComponent(item.orderCode)}`} className="font-semibold underline">
            {item.orderCode}
          </Link>
          {item.usedAt ? ` · ${vnDate(item.usedAt)}` : ""}
        </TicketLine>
      ) : null}
      {item.returnedFrom ? <ReturnedBadge info={item.returnedFrom} /> : null}
    </VoucherTicket>
  );
}

export function MyVouchersPanel() {
  const q = useWallet(true);
  const [tab, setTab] = useState<WalletTab>("active");
  const data = q.data;
  const items = (data?.items || []).filter((i) => i.tab === tab && i.voucher);

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
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((i) => (
              <li key={i.promotionId}>
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
