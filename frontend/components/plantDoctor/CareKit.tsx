"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { shopApiBase, type ShopProduct } from "@/lib/api";
import { isPreOrderTon } from "@/lib/cart";
import type { DoctorCondition, DoctorPlantGroup } from "@/lib/plantDoctor/api";
import { careKit } from "@/lib/plantDoctor/careKits";
import { ProductCard } from "@/components/ProductCard";

type Picked = { product: ShopProduct; why: string };

async function loadProduct(ma: string): Promise<ShopProduct | null> {
  try {
    const res = await fetch(`${shopApiBase()}/api/shop/products/${encodeURIComponent(ma)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { item?: ShopProduct };
    return data.item || null;
  } catch {
    return null;
  }
}

/** Vật tư hỗ trợ theo bệnh: hiển thị nhẹ nhàng, tinh tế dưới câu trả lời của Bác sĩ AI. */
export function CareKit({ condition, plantGroup }: { condition: DoctorCondition; plantGroup: DoctorPlantGroup }) {
  const [items, setItems] = useState<Picked[] | null>(null);

  useEffect(() => {
    let alive = true;
    const kit = careKit(condition, plantGroup);
    if (!kit.length) {
      setItems([]);
      return;
    }
    Promise.all(kit.map((k) => loadProduct(k.ma))).then((products) => {
      if (!alive) return;
      const picked: Picked[] = [];
      products.forEach((p, i) => {
        if (p && p.gia > 0 && !isPreOrderTon(p.ton)) picked.push({ product: p, why: kit[i].why });
      });
      setItems(picked.slice(0, 4));
    });
    return () => {
      alive = false;
    };
  }, [condition, plantGroup]);

  if (items && !items.length) return null;
  return (
    <div className="mt-3 rounded-2xl border border-stone-200/80 bg-stone-50/40 p-3 sm:p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
          <ShoppingBag size={14} className="text-emerald-700" aria-hidden />
          <span>Vật tư gợi ý phục hồi cây</span>
        </div>
        <span className="text-[10.5px] text-stone-400 font-medium">Có sẵn tại Aloha · Không bắt buộc</span>
      </div>

      {items ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map(({ product, why }) => (
            <div key={product.ma} className="flex flex-col gap-1">
              <ProductCard product={product} variant="default" />
              <p className="px-0.5 text-[10.5px] leading-snug text-stone-500 line-clamp-2">{why}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-stone-200/50" />
          ))}
        </div>
      )}
    </div>
  );
}
