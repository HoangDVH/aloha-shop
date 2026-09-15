"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatVnd, type ShopProduct } from "@/lib/api";
import { ProductPrice } from "@/components/ProductPrice";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/Toast";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useShopRouter } from "@/lib/useShopRouter";
import {
  ProductVariantPicker,
  useProductVariants,
} from "@/components/ProductVariantPicker";
import { ProductGallery } from "@/components/pdp/ProductGallery";
import { ProductStickyCta } from "@/components/pdp/ProductStickyCta";
import {
  buildProductShareUrl,
  getAffiliateCtvCode,
  getGuestCtvCode,
  isValidCtvCode,
  normalizeCtvCode,
  reportCtvClick,
  setAffiliateCtvCode,
  setGuestCtvCode,
} from "@/lib/ctv";
import { canPurchaseZeroPrice } from "@/lib/testBuyer";

function plainDescription(raw: string): string {
  return String(raw || "")
    .replace(/&lt;br\s*\/?&gt;/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function ProductDetailView({
  product,
}: {
  product: ShopProduct;
}) {
  const router = useShopRouter();
  const { user } = useShopAuth();
  const add = useCart((s) => s.add);
  const toast = useToast();
  const searchParams = useSearchParams();
  const ctvFromLink = searchParams.get("ctv") || "";
  const {
    selection,
    selected: variantSelected,
    pick: pickVariant,
    axes: variantAxes,
    gallery: variantGallery,
  } = useProductVariants(product);
  const selectedModel = selection.model;

  const activeProduct = useMemo((): ShopProduct => {
    if (!selectedModel) return product;
    const galleryAnh = variantGallery[0] || selectedModel.anh || product.anh;
    return {
      ...product,
      ma: selectedModel.ma,
      ten: selectedModel.ten || product.ten,
      dvt: selectedModel.dvt || product.dvt,
      gia: selectedModel.gia,
      ton: selectedModel.ton,
      anh: galleryAnh,
      images: variantGallery.length
        ? variantGallery
        : selectedModel.images?.length
          ? selectedModel.images
          : product.images,
      videos: selectedModel.videos?.length
        ? selectedModel.videos
        : product.videos,
      videoUrl: selectedModel.videos?.[0] || product.videoUrl,
      path: selectedModel.path || product.path,
      attributes: selectedModel.attributes,
    };
  }, [product, selectedModel, variantGallery]);

  const gallery = useMemo(() => {
    if (variantGallery.length) return variantGallery;
    const imgs = activeProduct.images?.length
      ? activeProduct.images
      : activeProduct.anh
        ? [activeProduct.anh]
        : [];
    return imgs.filter(Boolean);
  }, [variantGallery, activeProduct]);

  const galleryVideos = useMemo(() => {
    if (activeProduct.videos?.length) return activeProduct.videos;
    if (activeProduct.videoUrl) return [activeProduct.videoUrl];
    return [] as string[];
  }, [activeProduct.videos, activeProduct.videoUrl]);

  const [qty, setQty] = useState(1);
  const [affiliateCtv, setAffiliateCtv] = useState(() => getAffiliateCtvCode());
  const reportedKeyRef = useRef<string>("");
  const [liveGia, setLiveGia] = useState(product.gia);
  const [liveGiaGoc, setLiveGiaGoc] = useState(product.giaGoc);
  const [liveDangKm, setLiveDangKm] = useState(Boolean(product.dangKm));
  const [livePhanTram, setLivePhanTram] = useState(product.phanTramGiam);
  const [liveTon, setLiveTon] = useState(product.ton);
  const [ctvRate, setCtvRate] = useState<number | null>(null);
  const variantsLoading = selection.loading;
  const needPick =
    variantAxes.length > 0 && !selection.loading && !selectedModel;
  const soldOut =
    needPick || variantsLoading
      ? false
      : variantAxes.length > 0
        ? !selection.canPurchase
        : liveTon <= 0;
  const zeroPriceBlocked =
    !(Number(liveGia) > 0) && !canPurchaseZeroPrice(user?.email);
  const purchaseDisabled =
    soldOut || needPick || variantsLoading || zeroPriceBlocked;
  const desc = useMemo(
    () => plainDescription(product.description || ""),
    [product.description]
  );

  // Ghi nhớ URL SP để checkout prefetch → Back nhanh hơn
  useEffect(() => {
    try {
      const stay = `${window.location.pathname}${window.location.search || ""}`;
      if (/^\/c\/[^/]+\/p\//.test(window.location.pathname) || /^\/sp\//.test(window.location.pathname)) {
        sessionStorage.setItem("aloha_last_pdp", stay);
      }
    } catch {
      /* ignore */
    }
  }, [product.ma, product.path]);

  useEffect(() => {
    setLiveGia(activeProduct.gia);
    setLiveGiaGoc(activeProduct.giaGoc);
    setLiveDangKm(Boolean(activeProduct.dangKm));
    setLivePhanTram(activeProduct.phanTramGiam);
    setLiveTon(activeProduct.ton);
  }, [
    activeProduct.ma,
    activeProduct.gia,
    activeProduct.giaGoc,
    activeProduct.dangKm,
    activeProduct.phanTramGiam,
    activeProduct.ton,
  ]);

  // Đổi biến thể → cập nhật URL (giữ ?ctv=), không remount trang.
  useEffect(() => {
    if (!selectedModel?.path || typeof window === "undefined") return;
    const nextPath = selectedModel.path;
    if (!nextPath || nextPath === window.location.pathname) return;
    const qs = window.location.search || "";
    window.history.replaceState(window.history.state, "", `${nextPath}${qs}`);
  }, [selectedModel?.ma, selectedModel?.path]);

  // Soft nav / SSE catalog — lấy giá + tồn mới như giỏ hàng.
  useEffect(() => {
    let cancelled = false;
    const ma = activeProduct.ma;

    const load = async () => {
      try {
        const { fetchLivePrices } = await import("@/lib/livePrices");
        const rows = await fetchLivePrices([ma]);
        const hit = rows.find(
          (r) => String(r.ma || "").toUpperCase() === String(ma || "").toUpperCase()
        );
        if (cancelled || !hit) return;
        if (Number(hit.gia) >= 0) setLiveGia(Number(hit.gia) || 0);
        setLiveDangKm(Boolean(hit.dangKm));
        setLiveGiaGoc(
          hit.dangKm ? Number(hit.giaGoc) || undefined : undefined
        );
        setLivePhanTram(
          hit.dangKm ? Number(hit.phanTramGiam) || undefined : undefined
        );
        if (hit.ton != null && Number.isFinite(Number(hit.ton))) {
          const next = Number(hit.ton) || 0;
          // Không ghi đè tồn đã gắn từ /variants (combo tổng nhóm) bằng ton thô = 0.
          setLiveTon((prev) => (next <= 0 && prev > 0 ? prev : next));
        }
      } catch {
        /* giữ giá SSR */
      }
    };

    void load();

    let off: (() => void) | undefined;
    void import("@/lib/catalogSync").then(({ onShopCatalogChanged }) => {
      if (cancelled) return;
      off = onShopCatalogChanged((detail) => {
        const ids = (detail.ids || []).map((x) => String(x).toUpperCase());
        const key = String(ma || "").toUpperCase();
        if (ids.length && !ids.includes(key)) return;
        void load();
      });
    });

    return () => {
      cancelled = true;
      off?.();
    };
  }, [activeProduct.ma]);
  // CTV đã đăng nhập (có mã) → tự điền mã khi copy/chia sẻ link SP
  useEffect(() => {
    const code = normalizeCtvCode(user?.ctvCode || "");
    if (!user?.roles?.includes("ctv") || !isValidCtvCode(code)) return;
    setAffiliateCtvCode(code);
    setAffiliateCtv(code);
  }, [user?.ctvCode, user?.roles]);

  // CTV active → hiện % hoa hồng của SP này
  useEffect(() => {
    let cancelled = false;
    if (user?.ctvStatus !== "active" || !user?.roles?.includes("ctv")) {
      setCtvRate(null);
      return;
    }
    void (async () => {
      try {
        const { shopApiBase } = await import("@/lib/api");
        const res = await fetch(
          `${shopApiBase()}/api/shop/ctv/me/rate?ma=${encodeURIComponent(activeProduct.ma)}`,
          { credentials: "include", cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { rate?: number };
        if (!cancelled && data.rate != null) setCtvRate(Number(data.rate) || 0);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProduct.ma, user?.ctvStatus, user?.roles]);

  // Khi mở link có ?ctv= thì:
  // - Lưu mã CTV khách (guest) để giỏ hàng lấy theo.
  // - Ghi nhận click CTV vào collection riêng.
  useEffect(() => {
    if (!ctvFromLink) return;
    const code = normalizeCtvCode(ctvFromLink);
    if (!isValidCtvCode(code)) return;
    const key = `aloha_ctv_click_${code}_${product.ma}`;
    if (reportedKeyRef.current === key) return;

    reportedKeyRef.current = key;
    try {
      const already = sessionStorage.getItem(key);
      if (already) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }

    setGuestCtvCode(code);
    reportCtvClick({ ctv: code, ma: product.ma, path: product.path });
  }, [ctvFromLink, product.ma, product.path]);

  const loggedInCtvCode = (() => {
    const code = normalizeCtvCode(user?.ctvCode || "");
    return user?.roles?.includes("ctv") && isValidCtvCode(code) ? code : "";
  })();

  const isCtvAccount = Boolean(user?.roles?.includes("ctv"));

  const resolveShareCtvCode = (): string => {
    if (loggedInCtvCode) {
      setAffiliateCtvCode(loggedInCtvCode);
      return loggedInCtvCode;
    }
    return setAffiliateCtvCode(affiliateCtv) || getAffiliateCtvCode();
  };

  const crumbs = [
    { href: "/", label: "Trang chủ" },
    product.nhomPath
      ? {
          href: `/danh-muc/${product.categorySlug}?nhom=${encodeURIComponent(product.nhom)}`,
          label: product.nhomPath,
        }
      : product.nhom
        ? {
            href: `/danh-muc/${product.categorySlug}?nhom=${encodeURIComponent(product.nhom)}`,
            label: product.nhom,
          }
        : null,
    { href: product.path, label: product.ten },
  ].filter(Boolean) as { href: string; label: string }[];

  useEffect(() => {
    if (purchaseDisabled || liveTon <= 0) return;
    const max = Math.max(1, Math.floor(liveTon) || 1);
    setQty((q) => Math.min(Math.max(1, q), max));
  }, [liveTon, purchaseDisabled]);

  const addCart = (buyNow = false) => {
    if (purchaseDisabled) {
      if (needPick) toast.push("Chọn đủ thuộc tính / đơn vị trước khi mua");
      else if (zeroPriceBlocked) toast.push("Sản phẩm này chưa mở bán");
      return;
    }
    const codeFromLink = normalizeCtvCode(ctvFromLink);
    const ctvCode = isValidCtvCode(codeFromLink) ? codeFromLink : getGuestCtvCode();
    const line = {
      ...activeProduct,
      gia: liveGia,
      ton: liveTon,
      giaGoc: liveDangKm ? liveGiaGoc : undefined,
      dangKm: liveDangKm,
      phanTramGiam: liveDangKm ? livePhanTram : undefined,
    };
    const r = add(line, qty, ctvCode);

    if (!r.ok) {
      toast.push(
        r.max === 0
          ? `“${activeProduct.ten}” đã hết hàng`
          : `Chỉ còn ${r.max} ${activeProduct.dvt || "sản phẩm"} — giỏ đã đủ số này`
      );
      return;
    }

    if (buyNow) {
      useCart.setState((s) => ({
        lines: s.lines.map((l) => ({
          ...l,
          selected: l.ma === activeProduct.ma,
        })),
      }));
      // Giữ trang SP trong cache trình duyệt để Back không chờ fetch lại lâu
      try {
        const stay = `${window.location.pathname}${window.location.search || ""}`;
        sessionStorage.setItem("aloha_last_pdp", stay);
        router.prefetch(stay);
      } catch {
        /* ignore */
      }
      if (!user) {
        router.push("/dang-nhap?next=/xac-nhan-don-hang");
        return;
      }
      router.push("/xac-nhan-don-hang");
      return;
    }

    toast.push(
      r.capped
        ? `Đã thêm tối đa ${r.qty} ${activeProduct.dvt || ""} (hết tồn kho)`
        : `Đã thêm “${activeProduct.ten}” vào giỏ`,
      {
        href: "/gio-hang",
        hrefLabel: "Xem giỏ hàng",
      }
    );
  };

  return (
    <div className="shop-pb-sticky mx-auto w-full min-w-0 max-w-6xl space-y-4 overflow-x-clip px-3 py-2 sm:px-4 sm:py-3 lg:px-0">
      {/* Cả breadcrumb + khung chi tiết vừa trong phần còn lại dưới header — không cần kéo */}
      <div className="flex min-w-0 max-w-full flex-col gap-2 lg:h-[calc(100svh-7.5rem)] lg:max-h-[calc(100svh-7.5rem)] lg:overflow-hidden">
        <nav className="flex min-w-0 shrink-0 flex-wrap items-center gap-1 px-1 text-xs text-slate-500">
          {crumbs.map((c, i) => (
            <span key={c.href + i} className="inline-flex max-w-full items-center gap-1">
              {i > 0 ? <span className="text-slate-300">›</span> : null}
              {i < crumbs.length - 1 ? (
                <Link href={c.href} className="line-clamp-1 hover:text-[var(--aloha-green)] hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className="line-clamp-1 text-slate-600">{c.label}</span>
              )}
            </span>
          ))}
        </nav>

        {/* Khung chi tiết — flex-1 lấp phần còn lại, nội dung không tràn */}
        <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
          <div className="grid min-h-0 min-w-0 max-w-full flex-1 gap-0 lg:h-full lg:grid-cols-2">
            {/* Cột ảnh */}
            <div className="min-w-0 max-w-full">
            <ProductGallery
              images={gallery}
              videos={galleryVideos}
              alt={product.ten}
              resetKey={activeProduct.ma}
            />
            </div>

            {/* Cột thông tin — nút mua luôn hiện cuối cột */}
            <div className="flex min-h-0 min-w-0 flex-col border-t border-[#eee] p-3 sm:p-4 lg:h-full lg:border-l lg:border-t-0 lg:p-6">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto lg:pr-1">
                <h1 className="text-xl font-extrabold uppercase leading-tight tracking-tight text-[var(--aloha-ink)] sm:text-2xl">
                  {activeProduct.ten}
                </h1>

                <div className="flex flex-wrap items-center gap-3">
                  <ProductPrice
                    gia={liveGia}
                    giaGoc={liveGiaGoc}
                    dangKm={liveDangKm}
                    phanTramGiam={livePhanTram}
                    layout="inline"
                    priceClassName="text-2xl sm:text-[1.75rem]"
                  />
                  {activeProduct.dvt ? (
                    <span className="text-base font-semibold text-[var(--aloha-muted)] sm:text-lg">
                      / {activeProduct.dvt}
                    </span>
                  ) : null}
                </div>

                {isCtvAccount ? (
                <div className="space-y-1.5 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase text-slate-500">CTV</span>
                  <input
                    type="text"
                    inputMode="text"
                    value={loggedInCtvCode || affiliateCtv}
                    onChange={(e) => {
                      if (loggedInCtvCode) return;
                      setAffiliateCtv(e.target.value);
                    }}
                    readOnly={Boolean(loggedInCtvCode)}
                    placeholder="Mã CTV"
                    title={
                      loggedInCtvCode
                        ? "Mã CTV của tài khoản đang đăng nhập — tự gắn khi chia sẻ"
                        : "Nhập mã CTV rồi bấm Chia sẻ"
                    }
                    className={`h-9 w-[112px] rounded-lg border border-[#ddd] px-2 text-xs font-semibold outline-none placeholder:text-slate-400 ${
                      loggedInCtvCode
                        ? "cursor-default bg-[var(--aloha-green-light)] text-[var(--aloha-green-mid)]"
                        : "bg-white"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const codeSaved = resolveShareCtvCode();
                      if (!loggedInCtvCode && codeSaved !== affiliateCtv) {
                        setAffiliateCtv(codeSaved);
                      }
                      if (!isValidCtvCode(codeSaved)) {
                        toast.push(
                          loggedInCtvCode
                            ? "Tài khoản CTV chưa có mã hợp lệ"
                            : "Nhập mã CTV trước khi chia sẻ"
                        );
                        return;
                      }
                      const url = buildProductShareUrl(
                        activeProduct.path,
                        codeSaved,
                        activeProduct.ma
                      );
                      const shareTitle = `${activeProduct.ten} | ${formatVnd(liveGia)}`;
                      const shareText = `${activeProduct.ten} — ${formatVnd(liveGia)} · ALOHA Thế Giới Chậu Cây`;
                      (async () => {
                        try {
                          if (typeof navigator.share === "function") {
                            await navigator.share({ title: shareTitle, text: shareText, url });
                            toast.push("Đã mở chia sẻ (đã gắn mã CTV)");
                            return;
                          }
                        } catch (e) {
                          // User hủy share → vẫn copy
                          if ((e as { name?: string })?.name === "AbortError") return;
                        }
                        try {
                          await navigator.clipboard.writeText(url);
                        } catch {
                          const ta = document.createElement("textarea");
                          ta.value = url;
                          ta.style.position = "fixed";
                          ta.style.left = "-9999px";
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand("copy");
                          document.body.removeChild(ta);
                        }
                        toast.push(`Đã copy link · CTV ${codeSaved}`);
                      })();
                    }}
                    className="h-9 rounded-lg bg-[var(--aloha-green-light)] px-3 text-xs font-bold text-[var(--aloha-green-mid)] hover:bg-[var(--aloha-green)]/15"
                  >
                    Chia sẻ
                  </button>
                </div>
                {ctvRate != null && user?.ctvStatus === "active" ? (
                  <p className="text-xs font-semibold text-[var(--aloha-green-mid)]">
                    Hoa hồng SP này: {ctvRate}%
                  </p>
                ) : null}
                </div>
                ) : null}

                <p className="text-sm text-slate-500">
                  Mã:{" "}
                  <span className="font-medium text-slate-700">
                    {activeProduct.ma}
                  </span>
                  {variantsLoading ? (
                    <>
                      {" · "}
                      <span className="text-slate-400">Đang tải biến thể…</span>
                    </>
                  ) : null}
                  {needPick ? (
                    <>
                      {" · "}
                      <span className="font-semibold text-amber-700">
                        Chọn thuộc tính / đơn vị
                      </span>
                    </>
                  ) : null}
                  {!needPick && !variantsLoading && soldOut ? (
                    <>
                      {" · "}
                      <span className="font-semibold text-red-600">Hết hàng</span>
                    </>
                  ) : null}
                </p>

                {variantAxes.length > 0 ? (
                  <ProductVariantPicker
                    axes={variantAxes}
                    selected={variantSelected}
                    onPick={pickVariant}
                  />
                ) : null}

                <div>
                  <div className="mb-1.5 text-sm text-slate-500">Số lượng</div>
                  <div className="inline-flex items-center overflow-hidden rounded-lg border border-[#ddd]">
                    <button
                      type="button"
                      className="h-10 w-10 text-lg text-slate-600 hover:bg-[#f5f5f5] disabled:opacity-40"
                      disabled={purchaseDisabled || qty <= 1}
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={purchaseDisabled ? 1 : Math.max(1, liveTon)}
                      value={qty}
                      onChange={(e) => {
                        const n = Math.max(1, Number(e.target.value) || 1);
                        setQty(
                          purchaseDisabled ? 1 : Math.min(n, Math.max(1, liveTon))
                        );
                      }}
                      className="h-10 w-14 border-x border-[#ddd] bg-white text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      className="h-10 w-10 text-lg text-slate-600 hover:bg-[#f5f5f5] disabled:opacity-40"
                      disabled={purchaseDisabled || qty >= liveTon}
                      onClick={() =>
                        setQty((q) => Math.min(Math.max(1, liveTon), q + 1))
                      }
                    >
                      +
                    </button>
                  </div>
                  {!purchaseDisabled && liveTon > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Còn {liveTon} {activeProduct.dvt || ""}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 hidden shrink-0 gap-3 border-t border-[var(--aloha-line)] pt-3 lg:mt-4 lg:flex lg:pt-4">
                <button
                  type="button"
                  disabled={purchaseDisabled}
                  onClick={() => addCart(false)}
                  className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--aloha-green-light)] px-4 py-3 text-sm font-bold text-[var(--aloha-green-mid)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Thêm giỏ hàng
                </button>
                <button
                  type="button"
                  disabled={purchaseDisabled}
                  onClick={() => addCart(true)}
                  className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--aloha-green)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--aloha-green-mid)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Mua ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {desc ? (
        <div className="rounded-2xl bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] whitespace-pre-wrap">
          <h2 className="mb-2 text-sm font-bold text-[var(--aloha-ink)]">Mô tả</h2>
          {desc}
        </div>
      ) : null}

      <ProductStickyCta
        price={liveGia}
        needPick={needPick}
        soldOut={soldOut}
        purchaseDisabled={purchaseDisabled}
        onAddCart={() => addCart(false)}
        onBuyNow={() => addCart(true)}
      />
    </div>
  );
}
