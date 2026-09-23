"use client";

import { BackorderNotice } from "../BackorderNotice";
import { useState } from "react";
import Link from "next/link";
import { Minus, Plus, SquarePen, Store } from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { CartLine } from "@/lib/cart";
import { isPreOrderTon, stockMax, useCart } from "@/lib/cart";
import { formatVariantLabel } from "@/lib/cartVariant";

type Props = {
  selected: CartLine[];
  note: string;
  onNoteChange: (v: string) => void;
  shopName?: string;
};

/** Khối SP + ghi chú từng dòng + thành tiền. */
export function CheckoutLineItems({
  selected,
  shopName = "ALOHA THẾ GIỚI CHẬU CÂY",
}: Props) {
  const setQty = useCart((s) => s.setQty);
  const setLineNote = useCart((s) => s.setLineNote);
  const [editingMa, setEditingMa] = useState<string | null>(null);
  const hasPreOrder = selected.some((l) => isPreOrderTon(l.ton, l.qty));

  return (
    <section className="overflow-hidden rounded-[var(--aloha-radius-lg)] bg-white shadow-[var(--aloha-shadow)] ring-1 ring-black/[0.04]">
      <div className="flex items-center gap-3 border-b border-[var(--aloha-line)] px-3.5 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--aloha-green)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <Store size={10} strokeWidth={2.5} />
            Shop
          </span>
          <p className="truncate text-sm font-extrabold text-[var(--aloha-ink)]">
            {shopName}
          </p>
        </div>
      </div>

      {hasPreOrder ? (
        <p className="border-b border-amber-200/80 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900 sm:px-4">
          Đơn có sản phẩm đặt trước — Aloha sẽ kiểm tra và liên hệ xác nhận trước khi hướng dẫn thanh toán hoặc đặt cọc.
        </p>
      ) : null}

      {/* Desktop header — giống bảng ảnh 2 */}
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
          const preOrder = isPreOrderTon(l.ton, l.qty);
          const atMax = l.qty >= 10000 || (l.allowBackorder === false && max != null && l.qty >= max);
          const lineTotal = l.gia * l.qty;
          const editing = editingMa === l.ma;
          const hasLineNote = Boolean(l.lineNote?.trim());

          return (
            <li key={l.ma} className="px-3.5 py-3.5 sm:px-4">
              {preOrder && <div className="mb-3"><BackorderNotice available={l.ton || 0} requested={l.qty} unit={l.dvt} compact /></div>}
              {/* Mobile */}
              <div className="flex gap-3 lg:hidden">
                <Link
                  href={l.path || `/sp/${encodeURIComponent(l.ma)}`}
                  className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-[var(--aloha-cream)] ring-1 ring-black/[0.04]"
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
                    className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--aloha-ink)] hover:underline"
                  >
                    {l.ten}
                  </Link>
                  {preOrder ? (
                    <span className="mt-1 w-fit rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                      Đặt trước
                    </span>
                  ) : null}
                  {variant ? (
                    <p className="mt-0.5 text-xs text-[var(--aloha-muted)]">
                      {variant}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setEditingMa((cur) => (cur === l.ma ? null : l.ma))
                    }
                    className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-semibold text-[var(--aloha-green)]"
                  >
                    <SquarePen size={12} />
                    {hasLineNote ? "Sửa ghi chú" : "Thêm ghi chú"}
                  </button>
                  {hasLineNote && !editing ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                      {l.lineNote}
                    </p>
                  ) : null}
                  {/* Mobile: đơn giá / thành tiền có nhãn rõ */}
                  <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs tabular-nums text-slate-500">
                        <span className="font-medium text-slate-400">Đơn giá </span>
                        {formatVnd(l.gia)}
                        {l.qty > 1 ? (
                          <span className="text-slate-400"> × {l.qty}</span>
                        ) : null}
                      </p>
                      <p className="text-[15px] font-black leading-tight tabular-nums text-[var(--aloha-price)]">
                        <span className="mr-1 text-[11px] font-semibold text-slate-400">
                          Thành tiền
                        </span>
                        {formatVnd(lineTotal)}
                      </p>
                    </div>
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
                      {preOrder ? (
                        <span className="ml-1.5 inline-flex rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                          ĐẶT TRƯỚC
                        </span>
                      ) : null}
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
                <p className="text-right text-sm leading-none text-[var(--aloha-ink)]">
                  {formatVnd(l.gia)}
                </p>
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
                <p className="text-right text-sm font-black leading-none tabular-nums text-[var(--aloha-price)]">
                  {formatVnd(lineTotal)}
                </p>
              </div>

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
    </section>
  );
}
