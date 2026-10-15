"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus, SquarePen, Store } from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { CartLine } from "@/lib/cart";
import { stockMax, useCart } from "@/lib/cart";
import { formatVariantLabel } from "@/lib/cartVariant";
import { flashLineFor, giftLinesOf, type CampaignQuoteUI } from "@/lib/campaign/campaignQuote";
import { CampaignGiftRows, CartUnitPrice, MobileCartPrice } from "./CampaignLineBits";

import { CheckoutOrderNoteSheet } from "./CheckoutOrderNoteSheet";

type Props = {
  selected: CartLine[];
  note: string;
  onNoteChange: (v: string) => void;
  shopName?: string;
  campaign?: CampaignQuoteUI | null;
  pricesPending?: boolean;
};

/** Khối SP + ghi chú từng dòng + thành tiền. */
export function CheckoutLineItems({
  selected,
  note,
  onNoteChange,
  shopName = "ALOHA THẾ GIỚI CHẬU CÂY",
  campaign,
  pricesPending = false,
}: Props) {
  const setQty = useCart((s) => s.setQty);
  const setLineNote = useCart((s) => s.setLineNote);
  const [editingMa, setEditingMa] = useState<string | null>(null);
  const [editingOrderNote, setEditingOrderNote] = useState(false);

  return (
    <section className="w-full bg-white sm:rounded-[var(--aloha-radius-lg)] sm:shadow-[var(--aloha-shadow)] sm:ring-1 sm:ring-black/[0.04] overflow-hidden">
      <div className="flex items-center gap-3 border-b border-stone-100 sm:border-[var(--aloha-line)] px-4 py-2.5 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[var(--aloha-green)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <Store size={10} strokeWidth={2.5} />
            Shop
          </span>
          <p className="truncate text-xs sm:text-sm font-extrabold text-[var(--aloha-ink)]">
            {shopName}
          </p>
        </div>
        <button type="button" aria-expanded={editingOrderNote} aria-haspopup="dialog"
          onClick={() => setEditingOrderNote(current => !current)}
          className="-my-1 ml-auto inline-flex min-h-9 shrink-0 items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-700 lg:hidden cursor-pointer">
          {note.trim() ? "Sửa ghi chú" : "Thêm ghi chú"}<span aria-hidden="true">›</span>
        </button>
      </div>
      {editingOrderNote && <CheckoutOrderNoteSheet note={note} onSave={onNoteChange} onClose={() => setEditingOrderNote(false)} />}
      {note.trim() && <button type="button" onClick={() => setEditingOrderNote(true)} className="block w-full border-b border-stone-100 px-4 py-2 text-left text-xs text-slate-500 lg:hidden">
        <span className="line-clamp-2 break-words">{note}</span>
      </button>}

      {/* Desktop header */}
      <div className="hidden grid-cols-[minmax(0,1fr)_100px_100px_110px] gap-3 border-b border-[var(--aloha-line)] bg-[#f8f7f4] px-4 py-2.5 text-xs font-semibold text-slate-500 lg:grid">
        <span>Sản phẩm</span>
        <span className="text-right">Đơn giá</span>
        <span className="text-center">Số lượng</span>
        <span className="text-right">Thành tiền</span>
      </div>

      <ul className="divide-y divide-[var(--aloha-line)]">
        {selected.map((l) => {
          const variant = formatVariantLabel(l);
          const max = stockMax(l.ton);
          const atMax = l.qty >= 10000 || (l.allowBackorder === false && max != null && l.qty >= max);
          const fl = flashLineFor(campaign, l.ma);
          const serverRows = (campaign?.lines || []).filter(row => row.ma === l.ma && !row.isGift);
          const unitPrice = serverRows[0]?.price ?? l.gia;
          const lineTotal = serverRows.length ? serverRows.reduce((sum, row) => sum + row.price * row.quantity, 0) : l.gia * l.qty;
          const referencePrice = Math.max(unitPrice, ...serverRows.map(row => row.compareAtPrice ?? row.listPrice ?? row.price));
          const referenceTotal = serverRows.length ? serverRows.reduce((sum, row) => sum + Math.max(row.price, row.compareAtPrice ?? row.listPrice ?? row.price) * row.quantity, 0) : lineTotal;
          const savings = Math.max(0, referenceTotal - lineTotal);
          const price = <CartUnitPrice gia={unitPrice} qty={l.qty} flash={fl} referencePrice={referencePrice} />;
          const originalTotal = savings > 0 ? <span className="block text-xs font-normal leading-relaxed text-slate-400 line-through" aria-label="Thành tiền trước ưu đãi">{formatVnd(referenceTotal)}</span> : null;
          const editing = editingMa === l.ma;
          const hasLineNote = Boolean(l.lineNote?.trim());

          return (
            <li key={l.ma} className="px-4 py-3 sm:px-4">
              {/* Mobile */}
              <div className="flex gap-3 lg:hidden">
                <Link
                  href={l.path || `/sp/${encodeURIComponent(l.ma)}`}
                  className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-md bg-[var(--aloha-cream)] ring-1 ring-black/[0.04]"
                >
                  {l.anh ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.anh}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={l.path || `/sp/${encodeURIComponent(l.ma)}`}
                    className="line-clamp-2 text-[13px] font-semibold leading-snug text-stone-900 hover:underline"
                  >
                    {l.ten}
                  </Link>
                  {variant ? (
                    <div className="mt-1">
                      <span className="inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
                        {variant.startsWith("【") ? variant : `【${variant}】`}
                      </span>
                    </div>
                  ) : null}
                  {hasLineNote && <button type="button" onClick={() => setEditingMa(cur => cur === l.ma ? null : l.ma)}
                    className="mt-1 inline-flex min-h-8 w-fit items-center gap-1 text-[11px] text-[var(--aloha-green)]">
                    <SquarePen size={12} />Sửa ghi chú sản phẩm
                  </button>}
                  {hasLineNote && !editing ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                      {l.lineNote}
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
                    <div aria-busy={pricesPending} className={`transition-opacity motion-reduce:transition-none ${pricesPending ? "opacity-60" : "opacity-100"}`}><MobileCartPrice gia={unitPrice} qty={l.qty} flash={fl} referencePrice={referencePrice} /></div>
                    <div className="inline-flex shrink-0 items-center rounded-full bg-[#f3f4f6] p-0.5">
                      <button
                        type="button"
                        aria-label="Giảm số lượng"
                        disabled={l.qty <= 1}
                        onClick={() => setQty(l.ma, l.qty - 1)}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 disabled:opacity-30"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="min-w-[1.75rem] text-center text-sm font-bold tabular-nums">
                        {l.qty}
                      </span>
                      <button
                        type="button"
                        aria-label="Tăng số lượng"
                        disabled={atMax}
                        onClick={() => setQty(l.ma, l.qty + 1)}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 disabled:opacity-30"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop — cột như ảnh 2 */}
              <div className="hidden grid-cols-[minmax(0,1fr)_100px_100px_110px] items-center gap-3 lg:grid">
                <div className="flex min-w-0 gap-3">
                  <Link
                    href={l.path || `/sp/${encodeURIComponent(l.ma)}`}
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--aloha-cream)] ring-1 ring-black/[0.04]"
                  >
                    {l.anh ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.anh}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </Link>
                  <div className="min-w-0">
                    <Link
                      href={l.path || `/sp/${encodeURIComponent(l.ma)}`}
                      className="line-clamp-2 text-sm font-bold uppercase text-[var(--aloha-ink)] hover:underline"
                    >
                      {l.ten}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--aloha-muted)]">
                      {variant || l.dvt || "Cái"}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingMa((cur) => (cur === l.ma ? null : l.ma))
                      }
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--aloha-green)] hover:underline"
                    >
                      <SquarePen size={12} />
                      {hasLineNote ? "Sửa ghi chú" : "Thêm ghi chú"}
                    </button>
                    {hasLineNote && !editing ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                        {l.lineNote}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div aria-busy={pricesPending} className={`text-right text-sm leading-none text-[var(--aloha-ink)] transition-opacity motion-reduce:transition-none ${pricesPending ? "opacity-60" : "opacity-100"}`}>
                  {price}
                </div>
                <div className="flex justify-center">
                  <div className="inline-flex h-8 items-center rounded-md bg-[#f3f4f6] px-0.5">
                    <button
                      type="button"
                      aria-label="Giảm số lượng"
                      disabled={l.qty <= 1}
                      onClick={() => setQty(l.ma, l.qty - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded text-slate-600 disabled:opacity-30"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="min-w-[1.5rem] text-center text-sm font-bold leading-none tabular-nums">
                      {l.qty}
                    </span>
                    <button
                      type="button"
                      aria-label="Tăng số lượng"
                      disabled={atMax}
                      onClick={() => setQty(l.ma, l.qty + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded text-slate-600 disabled:opacity-30"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <p aria-busy={pricesPending} className={`text-right text-sm font-black leading-none tabular-nums text-[var(--aloha-price)] transition-opacity motion-reduce:transition-none ${pricesPending ? "opacity-60" : "opacity-100"}`}>
                  {formatVnd(lineTotal)}
                  {originalTotal}
                </p>
              </div>

              {savings > 0 ? <p className="hidden lg:block mt-2 rounded-lg bg-rose-50 px-3 py-2 text-right text-xs font-semibold text-[var(--aloha-price)]">Tiết kiệm {formatVnd(savings)} <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5">-{Math.round(savings / referenceTotal * 100)}%</span></p> : null}
              {editing ? (
                <div className="mt-2 rounded-lg border border-[var(--aloha-line)] bg-[var(--aloha-cream)]/40 p-2.5 lg:ml-[4.25rem]">
                  <textarea
                    className="auth-field min-h-[64px] resize-y bg-white text-sm"
                    maxLength={200}
                    placeholder="Ghi chú cho sản phẩm này (vd. giao buổi sáng, màu ưu tiên…)"
                    value={l.lineNote || ""}
                    onChange={(e) => setLineNote(l.ma, e.target.value)}
                    autoFocus
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-400">
                      {(l.lineNote || "").length}/200
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditingMa(null)}
                      className="rounded-lg bg-[var(--aloha-green)] px-3 py-1 text-xs font-bold text-white"
                    >
                      Xong
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <CampaignGiftRows gifts={giftLinesOf(campaign)} />
    </section>
  );
}
