"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { fetchProducts, formatVnd, type ShopProduct } from "@/lib/api";
import { fetchLivePrices } from "@/lib/livePrices";
import { stockMax, useCart, type CartLine } from "@/lib/cart";
import { useToast } from "@/components/Toast";

const COUNT = 2;

function isBuyable(p: Pick<ShopProduct, "gia" | "ton" | "priceKind" | "isActive">) {
  return p.isActive !== false && p.priceKind !== "si_missing" && p.gia > 0 && (stockMax(p.ton) ?? 0) > 0;
}

/** Nhóm của các dòng đang chọn (lấy từ server, giỏ không lưu nhóm). */
async function cartCategoryIds(mas: string[]): Promise<number[]> {
  const rows = await fetchLivePrices(mas);
  return [...new Set(rows.map((r) => Number(r.categoryId) || 0).filter((n) => n > 0))].slice(0, 5);
}

/** 2 sản phẩm rẻ, còn hàng, cùng nhóm, chưa có trong giỏ. Không có thì ẩn khối. */
export function CartSuggestions({ lines }: { lines: CartLine[] }) {
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const toast = useToast();
  const [items, setItems] = useState<ShopProduct[]>([]);
  const masKey = [...new Set(lines.map((l) => l.ma.toUpperCase()))].sort().join(",");

  useEffect(() => {
    if (!masKey) return setItems([]);
    const inCart = new Set(masKey.split(","));
    const ctrl = new AbortController();
    (async () => {
      const categoryId = await cartCategoryIds([...inCart]);
      if (!categoryId.length) return setItems([]);
      const res = await fetchProducts({ categoryId, inStock: true, sort: "price_asc", limit: 12, signal: ctrl.signal });
      const list = (res.items || []).filter((p) => !inCart.has(p.ma.toUpperCase()) && isBuyable(p));
      setItems(list.slice(0, COUNT));
    })().catch(() => {
      if (!ctrl.signal.aborted) setItems([]);
    });
    return () => ctrl.abort();
  }, [masKey]);

  const quickAdd = async (p: ShopProduct) => {
    const before = useCart.getState().lines.find((l) => l.ma === p.ma)?.qty || 0;
    const r = add(p, 1);
    if (!r.ok) return toast.push("Sản phẩm này tạm hết hàng.");
    const [row] = await fetchLivePrices([p.ma]).catch(() => []);
    const soldOut = !row || row.isActive === false || ((stockMax(row.ton) ?? 0) <= 0 && row.allowBackorder === false);
    if (!soldOut) return;
    setQty(p.ma, before);
    toast.push(`${p.ten} vừa hết hàng, đã bỏ khỏi giỏ.`);
  };

  if (!items.length) return null;
  return (
    <section className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-[var(--aloha-line)]" aria-label="Gợi ý mua thêm">
      <h2 className="mb-2 text-sm font-bold text-[var(--aloha-ink)]">Mua kèm giá tốt</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((p) => (
          <li key={p.ma} className="flex items-center gap-2.5 rounded-lg bg-[var(--aloha-cream)] p-2">
            <Link href={p.path || "#"} className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.anh} alt="" className="h-14 w-14 rounded-md bg-white object-cover" loading="lazy" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={p.path || "#"} className="line-clamp-2 text-xs font-semibold text-slate-700">
                {p.ten}
              </Link>
              <p className="mt-0.5 text-sm font-bold text-[var(--aloha-price)]">{formatVnd(p.gia)}</p>
            </div>
            <button
              type="button"
              onClick={() => void quickAdd(p)}
              aria-label={`Thêm ${p.ten} vào giỏ`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--aloha-green)] text-white hover:bg-[var(--aloha-green-hover)]"
            >
              <Plus size={18} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
