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
  embedded = false,
}: {
  mainProduct: ShopProduct;
  attachedProducts?: ShopProduct[];
  mainQty?: number;
  mainLivePrice?: number;
  mainLiveTon?: number;
  embedded?: boolean;
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
    <div
      aria-label="Gợi ý mua kèm phù hợp"
      className={
        embedded
          ? "space-y-2 pt-2.5 border-t border-stone-200/80"
          : "-mx-4 border-t-8 border-stone-100 bg-stone-50/50 px-4 py-3 sm:mx-0 sm:my-3 sm:rounded-2xl sm:border sm:border-stone-200/90 sm:p-3 space-y-2 sm:shadow-2xs"
      }
    >
      {/* Header gọn gàng, đồng bộ cỡ chữ */}
      <div className="flex items-center gap-1.5">
        <h4 className="text-sm font-bold text-slate-900">
          {embedded ? "Mua kèm trợ giá" : "Gợi ý mua kèm phù hợp"}
        </h4>
      </div>

      {/* Hiển thị 2 sản phẩm nằm cùng 1 hàng trên desktop, tối ưu chiều cao nhỏ gọn và thấy hết chữ */}
      <div className={items.length > 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "space-y-2"}>
        {items.map((item) => {
          const inCart = cartLines.find((l) => l.ma.toUpperCase() === item.ma.toUpperCase());
          const inCartQty = inCart?.qty || 0;
          const price = Number(item.gia) || 0;
          const originalPrice = item.webPrice && item.webPrice > price ? item.webPrice : null;

          return (
            <div
              key={item.ma}
              className={`flex gap-2 rounded-xl border p-2 transition ${
                inCartQty > 0
                  ? "border-emerald-400 bg-emerald-50/50 shadow-2xs"
                  : "border-stone-200 bg-white hover:border-emerald-500 shadow-2xs"
              }`}
            >
              {/* Thumbnail 44x44px cố định góc trên trái */}
              <div className="shrink-0 self-start">
                <AttachedProductImage item={item} compact />
              </div>

              {/* Info bên phải chiếm toàn bộ chiều ngang còn lại */}
              <div className="min-w-0 flex-1 flex flex-col justify-between">
                {/* 1. Tên sản phẩm: Chiếm trọn bề ngang, xuống dòng tự nhiên, KHÔNG bị cắt chữ */}
                <Link
                  href={item.path || `/sp/${item.ma}`}
                  className="text-xs font-bold text-slate-800 hover:text-[var(--aloha-green,#2e7d32)] leading-snug break-words"
                  title={item.ten}
                >
                  {item.ten}
                </Link>

                {/* 2. Dòng chân: Giá ở bên trái + Nút Mua kèm ở bên phải (tiết kiệm chiều cao tối đa) */}
                <div className="mt-1.5 flex items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-1 min-w-0">
                    <span className="font-extrabold text-[var(--aloha-price,#b72a2a)] text-xs">
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

                  <div className="shrink-0">
                    {inCartQty > 0 ? (
                      <div className="flex h-6 items-center rounded-md border border-emerald-400 bg-white overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleDecrease(item, inCartQty)}
                          className="flex h-6 w-5.5 items-center justify-center text-emerald-800 hover:bg-emerald-100 transition active:scale-90 cursor-pointer"
                          title={inCartQty === 1 ? `Bỏ mua kèm ${item.ten}` : `Giảm số lượng ${item.ten}`}
                        >
                          <Minus className="h-3 w-3 stroke-[2.5]" />
                        </button>
                        <span className="min-w-5 px-0.5 text-center text-xs font-bold text-emerald-900 select-none">
                          {inCartQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIncrease(item)}
                          className="flex h-6 w-5.5 items-center justify-center text-emerald-800 hover:bg-emerald-100 transition active:scale-90 cursor-pointer"
                          title={`Thêm 1 ${item.ten}`}
                        >
                          <Plus className="h-3 w-3 stroke-[2.5]" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddSingle(item)}
                        className="flex h-6 items-center gap-0.5 rounded-md border border-[var(--aloha-green,#2e7d32)]/30 bg-[var(--aloha-green-light,#e8f5e9)] px-2 text-[11px] font-bold text-[var(--aloha-green-mid,#236327)] hover:bg-[var(--aloha-green,#2e7d32)] hover:text-white transition active:scale-95 cursor-pointer shadow-2xs"
                        title={`Mua kèm ${item.ten}`}
                      >
                        <Plus className="h-3 w-3 stroke-[2.5]" />
                        <span>Mua kèm</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
