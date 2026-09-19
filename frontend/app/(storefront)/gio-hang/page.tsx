"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useShopRouter } from "@/lib/useShopRouter";
import { ShoppingBag, Trash2, Plus, Ticket, ChevronRight } from "lucide-react";
import { isPreOrderTon, stockMax, useCart } from "@/lib/cart";
import { formatVnd } from "@/lib/api";
import { formatVariantLabel } from "@/lib/cartVariant";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { refreshCartPricesFromCatalog } from "@/lib/cartPriceRefresh";

export default function CartPage() {
  const router = useShopRouter();
  const { user } = useShopAuth();
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const toggleSelected = useCart((s) => s.toggleSelected);
  const setAllSelected = useCart((s) => s.setAllSelected);
  const removeSelected = useCart((s) => s.removeSelected);
  const [priceNote, setPriceNote] = useState("");
  const masKey = useMemo(
    () =>
      [...new Set(lines.map((l) => String(l.ma || "").trim().toUpperCase()).filter(Boolean))]
        .sort()
        .join(","),
    [lines]
  );

  useEffect(() => {
    if (!masKey) return;
    let cancelled = false;
    const beforeQty = useCart
      .getState()
      .lines.map((l) => `${l.ma}:${l.qty}`)
      .join("|");
    void (async () => {
      try {
        const r = await refreshCartPricesFromCatalog();
        if (cancelled) return;
        const afterQty = useCart
          .getState()
          .lines.map((l) => `${l.ma}:${l.qty}`)
          .join("|");
        const qtyChanged = beforeQty !== afterQty;
        if (r.updated > 0 || qtyChanged) {
          setPriceNote(
            qtyChanged
              ? "Đã cập nhật giá/tồn theo cửa hàng — số lượng vượt tồn đã được chỉnh lại."
              : "Đã cập nhật giá mới theo cửa hàng."
          );
        }
      } catch {
        /* giữ giá local nếu mạng lỗi */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [masKey]);

  const selectedLines = useMemo(() => lines.filter((l) => l.selected), [lines]);
  const allSelected = lines.length > 0 && lines.every((l) => l.selected);
  const selectedQty = selectedLines.reduce((n, l) => n + l.qty, 0);
  const tamTinh = selectedLines.reduce((n, l) => n + l.gia * l.qty, 0);

  const handleCheckout = () => {
    if (selectedQty <= 0) return;
    if (!user) {
      router.push("/dang-nhap?next=/xac-nhan-don-hang");
      return;
    }
    router.push("/xac-nhan-don-hang");
  };

  return (
    <div className="shop-pb-sticky mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-[var(--aloha-ink)]">Giỏ hàng</h1>
        {lines.length > 0 ? (
          <Link
            href="/tim"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--aloha-green)] px-3 py-2 text-sm font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
          >
            <Plus size={16} /> Mua thêm
          </Link>
        ) : null}
      </div>
      {priceNote ? (
        <p className="rounded-lg bg-[var(--aloha-green-light)] px-3 py-2 text-sm font-medium text-[var(--aloha-green-mid)]">
          {priceNote}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Cột trái */}
        <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[var(--aloha-line)]">
          {!lines.length ? (
            <div className="flex flex-col items-center px-4 py-16 text-center">
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--aloha-cream)] text-[var(--aloha-green)]/50">
                <ShoppingBag size={48} strokeWidth={1.25} />
              </div>
              <p className="text-base font-bold text-[var(--aloha-ink)]">Giỏ hàng của bạn đang trống</p>
              <p className="mt-1 text-sm text-slate-500">Lướt cửa hàng, mua sắm ngay</p>
              <Link
                href="/tim"
                className="mt-5 rounded-full bg-[var(--aloha-green)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)]"
              >
                Tiếp tục mua sắm
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--aloha-line)] bg-[var(--aloha-cream)] px-3 py-2.5 text-sm font-semibold text-slate-600 md:hidden">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => setAllSelected(e.target.checked)}
                    className="accent-[var(--aloha-green)]"
                  />
                  Chọn tất cả ({lines.length})
                </label>
                <button
                  type="button"
                  disabled={!selectedLines.length}
                  onClick={() => {
                    const n = selectedLines.length;
                    if (n <= 0) return;
                    const ok = window.confirm(
                      n === 1
                        ? "Xóa sản phẩm đã chọn khỏi giỏ?"
                        : `Xóa ${n} sản phẩm đã chọn khỏi giỏ?`
                    );
                    if (!ok) return;
                    removeSelected();
                  }}
                  className={`inline-flex items-center gap-1 text-xs ${
                    selectedLines.length
                      ? "text-red-600"
                      : "cursor-not-allowed text-slate-300"
                  }`}
                >
                  <Trash2 size={14} /> Xóa
                </button>
              </div>
              <div className="hidden items-center gap-3 border-b border-[var(--aloha-line)] bg-[var(--aloha-cream)] px-4 py-3 text-sm font-semibold text-slate-600 md:grid md:grid-cols-[auto_1fr_110px_130px_110px_36px]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setAllSelected(e.target.checked)}
                  className="accent-[var(--aloha-green)]"
                  aria-label="Chọn tất cả"
                />
                <span>Sản phẩm ({lines.length})</span>
                <span className="text-center">Đơn giá</span>
                <span className="text-center">Số lượng</span>
                <span className="text-right">Thành tiền</span>
                <button
                  type="button"
                  title={
                    selectedLines.length
                      ? `Xóa ${selectedLines.length} sản phẩm đã chọn`
                      : "Chọn sản phẩm rồi mới xóa"
                  }
                  disabled={!selectedLines.length}
                  onClick={() => {
                    const n = selectedLines.length;
                    if (n <= 0) return;
                    const ok = window.confirm(
                      n === 1
                        ? "Xóa sản phẩm đã chọn khỏi giỏ?"
                        : `Xóa ${n} sản phẩm đã chọn khỏi giỏ?`
                    );
                    if (!ok) return;
                    removeSelected();
                  }}
                  className={`justify-self-end ${
                    selectedLines.length
                      ? "text-slate-400 hover:text-red-600"
                      : "cursor-not-allowed text-slate-300"
                  }`}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <ul className="divide-y divide-[var(--aloha-line)]">
                {lines.map((l) => (
                  <li
                    key={l.ma}
                    className="grid grid-cols-[auto_1fr] items-start gap-3 px-3 py-4 md:grid-cols-[auto_1fr_110px_130px_110px_36px] md:items-center md:px-4"
                  >
                    <input
                      type="checkbox"
                      checked={!!l.selected}
                      onChange={() => toggleSelected(l.ma)}
                      className="mt-2 accent-[var(--aloha-green)] md:mt-0"
                    />
                    <div className="flex min-w-0 gap-3">
                      <Link
                        href={l.path}
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--aloha-cream)] ring-1 ring-[var(--aloha-line)]"
                      >
                        {l.anh ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.anh} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </Link>
                      <div className="min-w-0">
                        <Link
                          href={l.path}
                          className="line-clamp-2 text-sm font-bold uppercase text-[var(--aloha-ink)] hover:text-[var(--aloha-green)]"
                        >
                          {l.ten}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex rounded border border-[var(--aloha-line)] px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {formatVariantLabel(l) || l.dvt || "Cái"}
                          </span>
                          {isPreOrderTon(l.ton) ? (
                            <span className="inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                              Đặt trước
                            </span>
                          ) : null}
                        </div>
                        {/* Mobile price/qty */}
                        <div className="mt-2 flex flex-wrap items-center gap-3 md:hidden">
                          <span className="text-sm text-slate-700">{formatVnd(l.gia)}</span>
                          <QtyCtrl
                            qty={l.qty}
                            plusDisabled={
                              !isPreOrderTon(l.ton) &&
                              stockMax(l.ton) != null &&
                              l.qty >= (stockMax(l.ton) || 0)
                            }
                            onMinus={() => setQty(l.ma, l.qty - 1)}
                            onPlus={() => setQty(l.ma, l.qty + 1)}
                          />
                          <span className="ml-auto text-sm font-bold text-[var(--aloha-price)]">
                            {formatVnd(l.gia * l.qty)}
                          </span>
                          <button
                            type="button"
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() => remove(l.ma)}
                            aria-label="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="hidden text-center text-sm text-slate-700 md:block">
                      {formatVnd(l.gia)}
                    </div>
                    <div className="hidden flex-col items-center md:flex">
                      <QtyCtrl
                        qty={l.qty}
                        plusDisabled={
                          !isPreOrderTon(l.ton) &&
                          stockMax(l.ton) != null &&
                          l.qty >= (stockMax(l.ton) || 0)
                        }
                        onMinus={() => setQty(l.ma, l.qty - 1)}
                        onPlus={() => setQty(l.ma, l.qty + 1)}
                      />
                      {isPreOrderTon(l.ton) ? (
                        <span className="mt-1 text-[10px] font-semibold text-amber-700">
                          Đặt trước
                        </span>
                      ) : stockMax(l.ton) != null ? (
                        <span className="mt-1 text-[10px] text-slate-400">
                          Còn {stockMax(l.ton)}
                        </span>
                      ) : null}
                    </div>
                    <div className="hidden text-right text-sm font-bold text-[var(--aloha-price)] md:block">
                      {formatVnd(l.gia * l.qty)}
                    </div>
                    <button
                      type="button"
                      className="hidden min-h-11 min-w-11 items-center justify-center justify-self-end rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 md:inline-flex"
                      onClick={() => remove(l.ma)}
                      aria-label="Xóa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Cột phải — tóm tắt */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-[var(--aloha-line)]">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--aloha-ink)]">
              <Ticket size={18} className="text-[var(--aloha-green)]" />
              Ưu đãi
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-slate-500"
              title="Sắp có"
            >
              Nhập ưu đãi
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[var(--aloha-line)]">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Tạm tính</span>
              <span>{formatVnd(tamTinh)}</span>
            </div>
            <div className="my-3 border-t border-[var(--aloha-line)]" />
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--aloha-ink)]">Tổng tiền</span>
              <span className="text-xl font-black text-[var(--aloha-price)]">{formatVnd(tamTinh)}</span>
            </div>
            <button
              type="button"
              disabled={selectedQty <= 0}
              onClick={handleCheckout}
              className={`mt-4 hidden w-full items-center justify-center rounded-lg py-3 text-sm font-bold text-white lg:flex ${
                selectedQty > 0
                  ? "bg-[var(--aloha-green)] hover:bg-[var(--aloha-green-hover)]"
                  : "cursor-not-allowed bg-slate-300"
              }`}
            >
              Mua hàng ({selectedQty})
            </button>
            <p className="mt-2 hidden text-center text-[11px] text-slate-400 lg:block">
              Tiếp theo: xác nhận địa chỉ và đặt hàng trên web.
            </p>
          </div>
        </aside>
      </div>

      {lines.length > 0 ? (
        <div className="shop-sticky-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[var(--aloha-line)] bg-white/95 px-3 pt-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <label className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => setAllSelected(e.target.checked)}
                className="accent-[var(--aloha-green)]"
              />
              Tất cả
            </label>
            <div className="min-w-0 flex-1 text-right">
              <p className="text-[11px] text-slate-500">Tổng ({selectedQty})</p>
              <p className="truncate text-base font-black text-[var(--aloha-price)]">{formatVnd(tamTinh)}</p>
            </div>
            <button
              type="button"
              disabled={selectedQty <= 0}
              onClick={handleCheckout}
              className={`inline-flex min-h-11 min-w-[6.5rem] items-center justify-center rounded-xl px-4 text-sm font-bold text-white ${
                selectedQty > 0
                  ? "bg-[var(--aloha-green)]"
                  : "cursor-not-allowed bg-slate-300"
              }`}
            >
              Mua hàng
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QtyCtrl({
  qty,
  onMinus,
  onPlus,
  plusDisabled,
}: {
  qty: number;
  onMinus: () => void;
  onPlus: () => void;
  plusDisabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-[var(--aloha-line)]">
      <button
        type="button"
        onClick={onMinus}
        className="inline-flex h-11 w-11 items-center justify-center text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
        aria-label="Giảm số lượng"
      >
        −
      </button>
      <span className="flex h-11 min-w-11 items-center justify-center border-x border-[var(--aloha-line)] text-sm font-bold">
        {qty}
      </span>
      <button
        type="button"
        disabled={plusDisabled}
        title={plusDisabled ? "Đã đạt số lượng tồn kho" : "Tăng số lượng"}
        onClick={onPlus}
        aria-label="Tăng số lượng"
        className={`inline-flex h-11 w-11 items-center justify-center text-[var(--aloha-green)] ${
          plusDisabled
            ? "cursor-not-allowed text-slate-300"
            : "hover:bg-[var(--aloha-green-light)]"
        }`}
      >
        +
      </button>
    </div>
  );
}
