"use client";

import { Gift, Zap } from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { CampaignQuoteLineUI, FlashLineView } from "@/lib/campaign/campaignQuote";

/** Đơn giá dòng giỏ: có giá sale thì hiện giá sale + giá gốc gạch, ghi rõ khi chỉ một phần được giá sale. */
export function CartUnitPrice({ gia, qty, flash }: { gia: number; qty: number; flash: FlashLineView | null }) {
  if (!flash) return <span>{formatVnd(gia)}</span>;
  return (
    <span className="inline-flex flex-col items-center leading-tight md:items-center">
      <span className="inline-flex items-center gap-0.5 font-bold text-[#C8102E]">
        <Zap size={12} aria-hidden className="fill-[#C8102E]" />
        {formatVnd(flash.salePrice)}
      </span>
      <span className="text-[11px] text-slate-400 line-through">{formatVnd(flash.listPrice)}</span>
      {flash.saleQty < qty ? (
        <span className="text-[10px] font-semibold text-amber-700">
          {flash.saleQty} sp giá sale, {qty - flash.saleQty} sp giá thường
        </span>
      ) : null}
    </span>
  );
}

/** Dòng quà 0đ (server tạo) ở giỏ / checkout. */
export function CampaignGiftRows({ gifts }: { gifts: CampaignQuoteLineUI[] }) {
  if (!gifts.length) return null;
  return (
    <ul className="divide-y divide-[var(--aloha-line)] border-t border-[var(--aloha-line)] bg-[#FFF7F0]">
      {gifts.map((g) => (
        <li key={`${g.ma}:${g.giftFor}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#C8102E] ring-1 ring-[var(--aloha-line)]">
            <Gift size={18} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-[var(--aloha-ink)]">Quà tặng: {g.ten}</span>
            <span className="block text-[11px] text-slate-500">
              Kèm {g.giftFor} · x{g.quantity}
            </span>
          </span>
          <span className="font-bold text-[var(--aloha-green)]">0đ</span>
        </li>
      ))}
    </ul>
  );
}

type VoucherPromo = { discountType?: string; discountValue?: number } | null | undefined;

/** Voucher tính trên giá sau giảm, không phải giá gốc ở dòng "Tổng tiền hàng". */
export function voucherBasisNote(promo: VoucherPromo, basis = "Flash Sale"): string {
  return promo?.discountType === "percentage" && promo.discountValue
    ? `Giảm ${promo.discountValue}% trên giá sau ${basis}`
    : `Tính trên giá sau ${basis}`;
}

export function VoucherBasisNote({ promo, className = "", basis }: { promo: VoucherPromo; className?: string; basis?: string }) {
  return <p className={`text-[11px] font-normal leading-snug text-slate-400 ${className}`}>{voucherBasisNote(promo, basis)}</p>;
}

/** Nền tính voucher theo dòng giảm đang có (flash ưu tiên vì giá flash thấp hơn). */
export function voucherBasisLabel(flash: number, anchor: number): string | null {
  if (flash > 0) return "Flash Sale";
  return anchor > 0 ? "giảm giá sản phẩm" : null;
}

type SavingsProps = { flash: number; voucher: number; ship?: number; anchor?: number; voucherPromo?: VoucherPromo };

/** "Giảm giá sản phẩm / Giảm Flash Sale / Voucher shop / Hỗ trợ phí ship" + tổng "Bạn đã tiết kiệm". */
export function SavingsRows({ flash, voucher, ship = 0, anchor = 0, voucherPromo }: SavingsProps) {
  const total = anchor + flash + voucher + ship;
  const basis = voucherBasisLabel(flash, anchor);
  if (total <= 0) return null;
  const row = (label: string, v: number) =>
    v > 0 ? (
      <div className="mt-1.5 flex items-center justify-between text-sm font-semibold text-[var(--aloha-price)]">
        <span>{label}</span>
        <span>-{formatVnd(v)}</span>
      </div>
    ) : null;
  return (
    <>
      {row("Giảm giá sản phẩm", anchor)}
      {row("Giảm Flash Sale", flash)}
      {row("Voucher shop", voucher)}
      {basis && voucher > 0 ? <VoucherBasisNote promo={voucherPromo} basis={basis} /> : null}
      {row("Hỗ trợ phí ship", ship)}
      <p className="mt-2 rounded-lg bg-[var(--aloha-green-light)] px-3 py-1.5 text-center text-xs font-bold text-[var(--aloha-green-mid)]">
        Bạn đã tiết kiệm {formatVnd(total)}
      </p>
    </>
  );
}
