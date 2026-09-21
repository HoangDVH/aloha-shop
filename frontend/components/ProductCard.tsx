"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Loader2, Play, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isPreOrderTon, useCart } from "@/lib/cart";
import { useToast } from "@/components/Toast";
import { formatVnd, type ShopProduct } from "@/lib/api";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { canPurchaseZeroPrice } from "@/lib/testBuyer";

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
  const { user } = useShopAuth();
  const displayTon = liveTon != null && Number.isFinite(liveTon) ? liveTon : product.ton;
  const preOrder = isPreOrderTon(displayTon);
  const lowStock = !preOrder && displayTon > 0 && displayTon <= 8;
  const manualBadge = product.webBadge;
  const [navPending, setNavPending] = useState(false);
  const displayGia = liveGia != null && liveGia >= 0 ? liveGia : product.gia;
  const zeroPriceBlocked = !(displayGia > 0) && !canPurchaseZeroPrice(user?.email);
  const purchaseBlocked = zeroPriceBlocked;

  useEffect(() => {
    setNavPending(false);
  }, [pathname]);

  const onAdd = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (zeroPriceBlocked) {
      toast.push("Sản phẩm này chưa mở bán");
      return;
    }
    const r = add({ ...product, gia: displayGia, ton: displayTon }, 1);
    if (!r.ok) {
      toast.push(
        r.max === 0 && !r.preOrder
          ? `“${product.ten}” đã hết hàng`
          : `Chỉ còn ${r.max} ${product.dvt || "sản phẩm"} — giỏ đã đủ số này`
      );
      return;
    }
    toast.push(
      r.preOrder
        ? "Đã thêm đặt trước — giao khi shop có hàng"
        : r.capped
          ? `Đã thêm tối đa ${r.qty} ${product.dvt || ""} (hết tồn kho)`
          : `Đã thêm “${product.ten}” vào giỏ`,
      {
        href: "/gio-hang",
        hrefLabel: "Xem giỏ hàng",
      }
    );
  };

  const markPending = () => setNavPending(true);
  const hasVideo =
    (Array.isArray(product.videos) && product.videos.length > 0) ||
    Boolean(String(product.videoUrl || "").trim());

  const addBtn = purchaseBlocked ? null : (
    <button
      type="button"
      onClick={onAdd}
      className="product-card__add"
      aria-label={
        preOrder
          ? `Đặt trước ${product.ten}`
          : `Thêm ${product.ten} vào giỏ`
      }
    >
      <ShoppingBag size={16} strokeWidth={2.25} className="shrink-0" aria-hidden />
      <span className="product-card__add-label">
        {preOrder ? "Đặt trước" : "Thêm vào giỏ"}
      </span>
    </button>
  );

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-[var(--aloha-radius)] bg-[var(--aloha-card,#ffffff)] shadow-[var(--aloha-shadow)] ring-1 ring-[var(--aloha-line)] transition-all duration-300 ease-out md:hover:-translate-y-1 md:hover:shadow-[var(--aloha-shadow-lg)] md:hover:ring-[var(--aloha-green)]/20 animate-fade-up ${
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
              className={`h-full w-full object-cover transition duration-500 ease-out md:group-hover:scale-[1.06]`}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-[var(--aloha-muted)]">
              <ShoppingBag size={28} strokeWidth={1.25} className="opacity-40" />
              <span className="text-xs">Chưa có ảnh</span>
            </div>
          )}

          {hasVideo ? (
            <span
              className="product-card__video-badge pointer-events-none absolute bottom-2 right-2 z-[15] inline-flex h-[1.65rem] w-[1.65rem] items-center justify-center rounded-full bg-black/55 text-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] sm:h-7 sm:w-7"
              title="Có video"
              aria-label="Sản phẩm có video"
            >
              <Play
                size={12}
                className="ml-[1px] fill-white sm:h-[13px] sm:w-[13px]"
                strokeWidth={0}
                aria-hidden
              />
            </span>
          ) : null}

          <ImagePendingOverlay force={navPending} />
        </Link>

        <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
          {preOrder || manualBadge === "dat_truoc" ? (
            <span className="product-card__badge inline-flex h-5 w-max max-w-none shrink-0 items-center justify-center rounded-full bg-[var(--aloha-sale)] px-2.5 text-[10px] font-bold leading-none tracking-normal text-white shadow-sm whitespace-nowrap [word-break:keep-all] [overflow-wrap:normal]">
              {"ĐẶT\u00A0TRƯỚC"}
            </span>
          ) : null}
          {!preOrder && manualBadge === "giam_gia" ? (
            <span className="product-card__badge inline-flex h-5 w-max max-w-none shrink-0 items-center justify-center rounded-full bg-[var(--aloha-sale)] px-2.5 text-[10px] font-bold leading-none tracking-normal text-white shadow-sm whitespace-nowrap">
              SALE
            </span>
          ) : null}
          {!preOrder &&
          (lowStock ||
            manualBadge === "ban_chay_sap_het" ||
            manualBadge === "ban_chay") ? (
            <span className="product-card__badge inline-flex h-5 w-max max-w-none shrink-0 items-center justify-center rounded-full bg-[var(--aloha-warning,#f59e0b)] px-2.5 text-[10px] font-bold leading-none tracking-normal text-white shadow-sm whitespace-nowrap [word-break:keep-all] [overflow-wrap:normal]">
              {"SẮP\u00A0HẾT"}
            </span>
          ) : null}
        </div>
      </div>

      <div className={`flex flex-1 flex-col ${shopee ? "gap-1.5 p-2.5 sm:p-3" : "gap-2 p-3 sm:p-3.5"}`}>
        <Link
          href={product.path}
          onClick={markPending}
          className={`line-clamp-2 font-semibold leading-snug text-[var(--aloha-ink)] transition-colors group-hover:text-[var(--aloha-green)] ${
            shopee
              ? "min-h-[2.35rem] text-[12px] sm:text-[13px]"
              : "min-h-[2.5rem] text-sm"
          } ${navPending ? "cursor-wait" : ""}`}
        >
          {product.ten}
        </Link>

        <div className="mt-auto flex items-end justify-between gap-2 pt-0.5">
          <div
            className={`min-w-0 truncate font-extrabold tracking-tight text-[var(--aloha-price)] ${
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
          {!purchaseBlocked ? (
            <div className="product-card__add-wrap shrink-0">{addBtn}</div>
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
    ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-3"
    : shopee
      ? "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-3"
      : "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-3";

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
