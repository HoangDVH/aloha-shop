"use client";

import Link from "next/link";
import { Plus, Check, Layers } from "lucide-react";
import { formatVnd, type ShopProduct } from "@/lib/api";
import { useCart, formatTonDisplay, isPreOrderTon } from "@/lib/cart";
import { useToast } from "@/components/Toast";
import { getGuestCtvCode, isValidCtvCode, normalizeCtvCode } from "@/lib/ctv";
import { useSearchParams } from "next/navigation";

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
    toast.push(`Đã thêm “${item.ten}” vào đơn mua kèm`, {
      href: "/gio-hang",
      hrefLabel: "Xem giỏ hàng",
    });
  };

  return (
    <section
      aria-label="Sản phẩm đính kèm & phụ kiện"
      className="relative overflow-hidden rounded-[var(--aloha-radius,1rem)] border border-[#e8e2d8] bg-white p-4 shadow-[var(--aloha-shadow,0_2px_8px_rgba(0,0,0,0.04))] transition sm:p-5"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#f0ece4] pb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--aloha-green-light,#e8f5e9)] text-[var(--aloha-green,#2e7d32)]">
          <Layers className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-bold text-slate-800 sm:text-lg">
            Gợi ý mua kèm phù hợp
          </h2>
          <p className="text-xs text-slate-500">
            Bấm &ldquo;Mua kèm&rdquo; để mua cùng sản phẩm chính trong một đơn hàng
          </p>
        </div>
      </div>

      {/* Grid 2 sản phẩm mỗi dòng */}
      <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
        {items.map((item) => {
          const inCart = cartLines.find((l) => l.ma.toUpperCase() === item.ma.toUpperCase());
          const inCartQty = inCart?.qty || 0;
          const isPreOrder = isPreOrderTon(item.ton);
          const price = Number(item.gia) || 0;
          const originalPrice = item.webPrice && item.webPrice > price ? item.webPrice : null;

          return (
            <div
              key={item.ma}
              className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 transition sm:p-3 ${
                inCartQty > 0
                  ? "border-emerald-300 bg-emerald-50/40 shadow-2xs"
                  : "border-[#ede7de] bg-[#fdfcf9] hover:border-[var(--aloha-green,#2e7d32)]/40 hover:bg-white"
              }`}
            >
              {/* Thumbnail */}
              <Link
                href={item.path || `/sp/${item.ma}`}
                className="relative h-15 w-15 shrink-0 overflow-hidden rounded-lg border border-[#e8e2d8] bg-white sm:h-16 sm:w-16"
              >
                {item.anh ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.anh}
                    alt={item.ten}
                    className="h-full w-full object-cover transition duration-300 hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                    Ảnh
                  </div>
                )}
              </Link>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <Link
                  href={item.path || `/sp/${item.ma}`}
                  className="line-clamp-1 text-xs font-semibold text-slate-800 hover:text-[var(--aloha-green,#2e7d32)] sm:text-sm"
                  title={item.ten}
                >
                  {item.ten}
                </Link>

                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs">
                  <span className="font-bold text-[var(--aloha-price,#b72a2a)] sm:text-sm">
                    {formatVnd(price)}
                  </span>
                  {item.dvt ? (
                    <span className="text-[11px] text-slate-400">/ {item.dvt}</span>
                  ) : null}
                  {originalPrice ? (
                    <span className="text-[11px] text-slate-400 line-through">
                      {formatVnd(originalPrice)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
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
                <button
                  type="button"
                  onClick={() => handleAddSingle(item)}
                  className={`flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold transition active:scale-95 sm:px-2.5 ${
                    inCartQty > 0
                      ? "border border-emerald-400 bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                      : "border border-[var(--aloha-green,#2e7d32)]/30 bg-[var(--aloha-green-light,#e8f5e9)] text-[var(--aloha-green-mid,#236327)] hover:bg-[var(--aloha-green,#2e7d32)] hover:text-white"
                  }`}
                  title={inCartQty > 0 ? `Bấm để thêm tiếp ${item.ten}` : `Mua kèm ${item.ten}`}
                >
                  {inCartQty > 0 ? (
                    <>
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Đã thêm ({inCartQty})</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Mua kèm</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
