"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Loader2, Play, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/Toast";
import { formatVnd, type ShopProduct } from "@/lib/api";

function ImagePendingOverlay({ force }: { force: boolean }) {
  const { pending } = useLinkStatus();
  if (!pending && !force) return null;
  return (
    <span className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
      <Loader2 className="h-7 w-7 animate-spin text-[var(--aloha-green)]" aria-hidden />
    </span>
  );
}

export function ProductCard({
  product,
  shopee = false,
  liveGia,
  liveTon,
}: {
  product: ShopProduct;
  shopee?: boolean;
  /** Giá mới từ API prices — nếu có thì hiện thay product.gia */
  liveGia?: number;
  liveTon?: number;
}) {
  const add = useCart((s) => s.add);
  const toast = useToast();
  const pathname = usePathname();
  const displayTon = liveTon != null && Number.isFinite(liveTon) ? liveTon : product.ton;
  const soldOut = displayTon <= 0;
  const lowStock = !soldOut && displayTon > 0 && displayTon <= 8;
  const manualBadge = product.webBadge;
  const [navPending, setNavPending] = useState(false);
  const displayGia = liveGia != null && liveGia >= 0 ? liveGia : product.gia;

  useEffect(() => {
    setNavPending(false);
  }, [pathname]);

  const onAdd = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (soldOut) return;
    const r = add({ ...product, gia: displayGia, ton: displayTon }, 1);
    if (!r.ok) {
      toast.push(
        r.max === 0
          ? `“${product.ten}” đã hết hàng`
          : `Chỉ còn ${r.max} ${product.dvt || "sản phẩm"} — giỏ đã đủ số này`
      );
      return;
    }
    toast.push(
      r.capped
        ? `Đã thêm tối đa ${r.qty} ${product.dvt || ""} (hết tồn kho)`
        : `Đã thêm “${product.ten}” vào giỏ`,
      {
        href: "/gio-hang",
        hrefLabel: "Xem giỏ hàng",
      }
    );
  };

  const markPending = () => setNavPending(true);

  const addBtn = soldOut ? null : (
    <button
      type="button"
      onClick={onAdd}
      className="product-card__add"
      aria-label={`Thêm ${product.ten} vào giỏ`}
    >
      <ShoppingBag size={16} strokeWidth={2.25} className="shrink-0" aria-hidden />
      <span className="product-card__add-label">Thêm vào giỏ</span>
    </button>
  );

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-[var(--aloha-radius)] bg-white shadow-[var(--aloha-shadow)] ring-1 ring-black/[0.04] transition-all duration-300 ease-out md:hover:-translate-y-1 md:hover:shadow-[var(--aloha-shadow-lg)] md:hover:ring-[var(--aloha-green)]/15 animate-fade-up ${
        navPending ? "opacity-85" : ""
      }`}
    >
      <div className="relative">
        <Link
          href={product.path}
          onClick={markPending}
          className={`relative block aspect-square overflow-hidden bg-[var(--aloha-cream)] ${
            navPending ? "cursor-wait" : ""
          }`}
        >
          {product.anh ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.anh}
              alt={product.ten}
              className={`h-full w-full object-cover transition duration-500 ease-out md:group-hover:scale-[1.06] ${
                soldOut ? "opacity-55 saturate-50" : ""
              }`}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-400">
              <ShoppingBag size={28} strokeWidth={1.25} className="opacity-40" />
              <span className="text-xs">Chưa có ảnh</span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-300 md:group-hover:opacity-100" />

          {product.videos?.length || product.videoUrl ? (
            <span
              className="absolute bottom-2 left-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur-[1px]"
              title="Có video"
              aria-hidden
            >
              <Play size={14} className="fill-white" strokeWidth={0} />
            </span>
          ) : null}

          <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
            {soldOut ? (
              <span className="rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
                Hết hàng
              </span>
            ) : null}
            {!soldOut && manualBadge === "ban_chay" ? (
              <span className="rounded-full bg-gradient-to-r from-[var(--aloha-gold)] to-[var(--aloha-gold)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                Bán chạy
              </span>
            ) : null}
            {!soldOut && manualBadge === "moi" ? (
              <span className="rounded-full bg-sky-600/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                Mới
              </span>
            ) : null}
            {!soldOut && manualBadge === "noi_bat" ? (
              <span className="rounded-full bg-[var(--aloha-green)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                Nổi bật
              </span>
            ) : null}
            {lowStock ? (
              <span className="rounded-full bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                Sắp hết
              </span>
            ) : null}
          </div>

          <ImagePendingOverlay force={navPending} />
        </Link>

        {!soldOut ? (
          <div className="product-card__add-wrap absolute inset-x-0 bottom-0 z-20 p-2 sm:p-2.5">
            {addBtn}
          </div>
        ) : null}
      </div>

      <div className={`flex flex-1 flex-col ${shopee ? "gap-1.5 p-2.5 sm:p-3" : "gap-2 p-3 sm:p-3.5"}`}>
        <Link
          href={product.path}
          onClick={markPending}
          className={`line-clamp-2 font-medium leading-snug text-[var(--aloha-ink)] transition-colors group-hover:text-[var(--aloha-green)] ${
            shopee
              ? "min-h-[2.35rem] text-[12px] sm:text-[13px]"
              : "min-h-[2.5rem] text-sm"
          } ${navPending ? "cursor-wait" : ""}`}
        >
          {product.ten}
        </Link>

        <div className="mt-auto pt-0.5">
          <div
            className={`truncate font-extrabold tracking-tight text-[var(--aloha-price)] ${
              shopee ? "text-[15px] sm:text-base" : "text-base sm:text-lg"
            }`}
          >
            {formatVnd(displayGia)}
            {product.dvt ? (
              <span
                className={`ml-1 font-semibold text-[var(--aloha-muted)] ${
                  shopee ? "text-[10px] sm:text-[11px]" : "text-xs"
                }`}
              >
                / {product.dvt}
              </span>
            ) : null}
          </div>
          {soldOut ? (
            <p className="mt-1 text-[11px] font-semibold text-slate-400">Hết hàng</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  shopee = false,
  /** Trang chủ: 6 SP / hàng (desktop), giữ card nhỏ gọn */
  homeRow6 = false,
}: {
  products: ShopProduct[];
  shopee?: boolean;
  homeRow6?: boolean;
}) {
  const [liveMap, setLiveMap] = useState<Record<string, { gia: number; ton: number }>>({});
  const masKey = products.map((p) => p.ma).join("|");

  useEffect(() => {
    let cancelled = false;
    const mas = masKey ? masKey.split("|").filter(Boolean) : [];
    if (!mas.length) {
      setLiveMap({});
      return;
    }

    const load = async () => {
      try {
        const { fetchLivePrices } = await import("@/lib/livePrices");
        const rows = await fetchLivePrices(mas);
        if (cancelled) return;
        const next: Record<string, { gia: number; ton: number }> = {};
        for (const r of rows) {
          const ma = String(r.ma || "").trim().toUpperCase();
          if (!ma) continue;
          next[ma] = {
            gia: Number(r.gia) || 0,
            ton: Number(r.ton) || 0,
          };
        }
        setLiveMap(next);
      } catch {
        /* giữ giá SSR */
      }
    };

    void load();

    let onCatalog: (() => void) | undefined;
    void import("@/lib/catalogSync").then(({ onShopCatalogChanged }) => {
      if (cancelled) return;
      onCatalog = onShopCatalogChanged((detail) => {
        const ids = (detail.ids || []).map((x) => String(x).toUpperCase());
        if (
          ids.length &&
          !mas.some((m) => ids.includes(String(m).toUpperCase()))
        ) {
          return;
        }
        void load();
      });
    });

    return () => {
      cancelled = true;
      onCatalog?.();
    };
  }, [masKey]);

  if (!products.length) {
    return (
      <p className="rounded-2xl bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm ring-1 ring-black/[0.04]">
        Chưa có sản phẩm phù hợp. Thử bỏ bớt bộ lọc hoặc chọn danh mục khác.
      </p>
    );
  }

  const gridClass = homeRow6
    ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-3"
    : shopee
      ? "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5"
      : "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4";

  return (
    <div className={gridClass}>
      {products.map((p) => {
        const key = String(p.ma || "").trim().toUpperCase();
        const live = liveMap[key];
        return (
          <ProductCard
            key={p.ma}
            product={p}
            shopee={shopee || homeRow6}
            liveGia={live != null ? live.gia : undefined}
            liveTon={live != null ? live.ton : undefined}
          />
        );
      })}
    </div>
  );
}
