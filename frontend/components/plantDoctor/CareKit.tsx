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

/** Vật tư hỗ trợ theo bệnh: lấy đúng mã trong bộ soạn sẵn, bỏ hàng hết/đặt trước/chưa có giá. */
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
    <div className="mt-3.5 rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-[#F7FAF6] to-white p-3.5 sm:p-4 shadow-2xs">
      <div className="mb-2.5 flex items-center gap-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-[#1C4C40]">
          <ShoppingBag size={13} strokeWidth={2.5} aria-hidden />
        </div>
        <div>
          <p className="text-xs font-bold text-[#1C4C40]">Đồ dùng có thể giúp cây của bạn</p>
          <p className="text-[10.5px] text-stone-500">Hàng còn sẵn tại Aloha · không bắt buộc mua</p>
        </div>
      </div>

      {items ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map(({ product, why }) => (
            <div key={product.ma} className="flex flex-col gap-1">
              <ProductCard product={product} variant="default" />
              <p className="px-0.5 text-[10.5px] leading-snug text-stone-600">{why}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-stone-200/60" />
          ))}
        </div>
      )}
    </div>
  );
}
