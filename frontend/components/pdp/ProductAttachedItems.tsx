"use client";

import Link from "next/link";
import { Plus, Check, Minus, Layers } from "lucide-react";
import { formatVnd, type ShopProduct } from "@/lib/api";
import { useCart, formatTonDisplay, isPreOrderTon } from "@/lib/cart";
import { useToast } from "@/components/Toast";
import { getGuestCtvCode, isValidCtvCode, normalizeCtvCode } from "@/lib/ctv";
import { useSearchParams } from "next/navigation";
import { AttachedProductImage } from "./AttachedProductImage";

/** Mua ngay: chỉ chọn SP chính + các SP đi kèm của nó trong giỏ. */
export function selectBuyNowLines(mainMa: string, attachedItems?: string[]) {
  const keep = new Set([mainMa, ...(attachedItems || [])].map((c) => String(c).toUpperCase()));
  useCart.setState((s) => ({
    lines: s.lines.map((l) => ({ ...l, selected: keep.has(l.ma.toUpperCase()) })),
  }));
}

export function ProductAttachedItems({
  mainProduct,
  attachedProducts,
}: {
  mainProduct: ShopProduct;
  attachedProducts?: ShopProduct[];
  mainQty?: number;
  mainLivePrice?: number;
  mainLiveTon?: number;
}) {
  const toast = useToast();
  const searchParams = useSearchParams();
  const ctvFromLink = searchParams.get("ctv") || "";
  const add = useCart((s) => s.add);
  const remove = useCart((s) => s.remove);
  const setQty = useCart((s) => s.setQty);
  const cartLines = useCart((s) => s.lines);

  const items = attachedProducts || mainProduct.attachedProducts || [];
  if (!items.length) return null;

  const getEffectiveCtvCode = () => {
    const codeFromLink = normalizeCtvCode(ctvFromLink);
    return isValidCtvCode(codeFromLink) ? codeFromLink : getGuestCtvCode();
  };

  const handleAddSingle = (item: ShopProduct) => {
    const ctvCode = getEffectiveCtvCode();
    const r = add(item, 1, ctvCode);
    if (!r.ok) {
      toast.push(
        r.max === 0 && !r.preOrder
          ? `“${item.ten}” đã hết hàng`
          : `Chỉ còn ${r.max} ${item.dvt || "sản phẩm"} — giỏ đã đủ số này`
      );
      return;
    }
    toast.push(`Đã thêm “${item.ten}” vào đơn mua kèm`);
  };

  const handleDecrease = (item: ShopProduct, inCartQty: number) => {
    if (inCartQty <= 1) {
      remove(item.ma);
      toast.push(`Đã bỏ “${item.ten}” khỏi mua kèm`);
    } else {
      setQty(item.ma, inCartQty - 1);
    }
  };

  const handleIncrease = (item: ShopProduct) => {
    handleAddSingle(item);
  };

  return (
    <section
      aria-label="Gợi ý mua kèm phù hợp"
      className="-mx-4 border-t-8 border-stone-100 bg-stone-50/50 px-4 py-3 sm:mx-0 sm:my-3 sm:rounded-2xl sm:border sm:border-stone-200/90 sm:p-3 space-y-2 sm:shadow-2xs"
    >
      {/* Header gọn gàng */}
      <div className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--aloha-green-light,#e8f5e9)] text-[var(--aloha-green,#2e7d32)]">
          <Layers className="h-3 w-3" />
        </span>
        <h3 className="text-xs font-bold text-slate-800 sm:text-sm">
          Gợi ý mua kèm phù hợp
        </h3>
      </div>

      {/* Grid 2 sản phẩm hoặc 1 cột gọn gàng */}
      <div className={items.length > 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "space-y-2"}>
        {items.map((item) => {
          const inCart = cartLines.find((l) => l.ma.toUpperCase() === item.ma.toUpperCase());
          const inCartQty = inCart?.qty || 0;
          const isPreOrder = isPreOrderTon(item.ton);
          const price = Number(item.gia) || 0;
          const originalPrice = item.webPrice && item.webPrice > price ? item.webPrice : null;

          return (
            <div
              key={item.ma}
              className={`flex items-center justify-between gap-2.5 rounded-xl border p-2 transition ${
                inCartQty > 0
                  ? "border-emerald-300 bg-emerald-50/60 shadow-2xs"
                  : "border-stone-200/90 bg-white hover:border-[var(--aloha-green,#2e7d32)]/50"
              }`}
            >
              {/* Thumbnail 44x44px */}
              <AttachedProductImage item={item} compact />

              {/* Info */}
              <div className="min-w-0 flex-1">
                <Link
                  href={item.path || `/sp/${item.ma}`}
                  className="line-clamp-2 text-xs font-bold text-slate-800 hover:text-[var(--aloha-green,#2e7d32)] leading-tight"
                  title={item.ten}
                >
                  {item.ten}
                </Link>

                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs">
                  <span className="font-extrabold text-[var(--aloha-price,#b72a2a)]">
                    {formatVnd(price)}
                  </span>
                  {item.dvt ? (
                    <span className="text-[10px] text-slate-400">/ {item.dvt.toLowerCase()}</span>
                  ) : null}
                  {originalPrice ? (
                    <span className="text-[10px] text-slate-400 line-through">
                      {formatVnd(originalPrice)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      isPreOrder ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                  <span className={isPreOrder ? "text-amber-700" : "text-emerald-700 font-medium"}>
                    {isPreOrder
                      ? "Đặt trước"
                      : `Còn ${formatTonDisplay(item.ton)}`}
                  </span>
                </div>
              </div>

              {/* Button Mua kèm */}
              <div className="shrink-0">
                {inCartQty > 0 ? (
                  <div className="flex items-center rounded-lg border border-emerald-400 bg-emerald-50 overflow-hidden shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleDecrease(item, inCartQty)}
                      className="flex h-7.5 w-7 items-center justify-center text-emerald-800 hover:bg-emerald-100 transition active:scale-90 cursor-pointer"
                      title={inCartQty === 1 ? `Bỏ mua kèm ${item.ten}` : `Giảm số lượng ${item.ten}`}
                    >
                      <Minus className="h-3 w-3 stroke-[2.5]" />
                    </button>
                    <span className="min-w-6 px-1 text-center text-xs font-bold text-emerald-900 select-none">
                      {inCartQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleIncrease(item)}
                      className="flex h-7.5 w-7 items-center justify-center text-emerald-800 hover:bg-emerald-100 transition active:scale-90 cursor-pointer"
                      title={`Thêm 1 ${item.ten}`}
                    >
                      <Plus className="h-3 w-3 stroke-[2.5]" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAddSingle(item)}
                    className="flex h-7.5 items-center gap-1 rounded-lg border border-[var(--aloha-green,#2e7d32)]/30 bg-[var(--aloha-green-light,#e8f5e9)] px-2 text-[11px] font-bold text-[var(--aloha-green-mid,#236327)] hover:bg-[var(--aloha-green,#2e7d32)] hover:text-white transition active:scale-95 cursor-pointer sm:px-2.5"
                    title={`Mua kèm ${item.ten}`}
                  >
                    <Plus className="h-3 w-3 stroke-[2.5]" />
                    <span>Mua kèm</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
