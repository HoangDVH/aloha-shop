"use client";
import { SiCartNotice } from "@/components/si-pricing/SiCartNotice";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useShopRouter } from "@/lib/useShopRouter";
import { ShoppingBag, Trash2, Plus, Ticket, ChevronRight } from "lucide-react";
import { isPreOrderTon, stockMax, useCart } from "@/lib/cart";
import { formatVnd } from "@/lib/api";
import { formatAppliedVoucherTitle } from "@/lib/voucherFormat";
import { formatVariantLabel } from "@/lib/cartVariant";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { refreshCartPricesFromCatalog } from "@/lib/cartPriceRefresh";
import { PromotionModal } from "@/components/checkout/PromotionModal";
import { useCandidateClaim } from "@/components/checkout/useCandidateClaim";
import { useWallet } from "@/lib/campaign/walletQueries";
import { CartVoucherProgress } from "@/components/checkout/CartVoucherProgress";
import { DeliverySpeedSelector, type DeliverySpeed } from "@/components/checkout/DeliverySpeedSelector";
import { SmartFreeshipBar, useMoreShoppingHref } from "@/components/cart/SmartFreeshipBar";

import { useManualCodeFallback } from "@/components/checkout/useManualCodeFallback";
import { onShopCampaignChanged } from "@/lib/catalogSync";
import { usePromotionQuote } from "@/lib/usePromotionQuote";
import {
  flashLineFor,
  giftLinesOf,
  useCampaignCartNotices,
  useCampaignRequoteKey,
} from "@/lib/campaign/campaignQuote";
import { CampaignGiftRows, MobileCartPrice } from "@/components/checkout/CampaignLineBits";
import { usePendingValue } from "@/lib/usePendingValue";
import { PriceUpdateIndicator } from "@/components/checkout/PriceUpdateIndicator";
import { OrderPaymentSummary } from "@/components/checkout/OrderPaymentSummary";
import { useStickyBarHeight } from "@/lib/floatingStack";

export default function CartPage() {
  const router = useShopRouter();
  const { user } = useShopAuth();
  const moreHref = useMoreShoppingHref();
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const toggleSelected = useCart((s) => s.toggleSelected);
  const setAllSelected = useCart((s) => s.setAllSelected);
  const removeSelected = useCart((s) => s.removeSelected);
  const stickyRef = useStickyBarHeight<HTMLDivElement>();
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
  const localTamTinh = selectedLines.reduce((n, l) => n + l.gia * l.qty, 0);

  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoAutoMode, setPromoAutoMode] = useState(true);
  const [promoNonce, setPromoNonce] = useState(0);
  const [deliverySpeed, setDeliverySpeed] = useState<DeliverySpeed>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("aloha_delivery_speed");
        if (saved === "delayed_3d" || saved === "standard") return saved;
      } catch {
        /* ignore */
      }
    }
    return "standard";
  });

  const handleDeliverySpeedChange = (speed: DeliverySpeed) => {
    setDeliverySpeed(speed);
    try {
      sessionStorage.setItem("aloha_delivery_speed", speed);
      sessionStorage.setItem("aloha_delivery_speed_user_explicit", "true");
    } catch {
      /* ignore */
    }
  };

  const wallet = useWallet(Boolean(user));
  useEffect(() => {
    const hasClaimedDelayed = wallet.data?.items?.some(
      (it) => it.tab === "active" && (it.voucher?.minLeadDays ?? 0) >= 3
    );
    if (hasClaimedDelayed && typeof window !== "undefined") {
      const explicitChoice = sessionStorage.getItem("aloha_delivery_speed_user_explicit");
      if (!explicitChoice) {
        setDeliverySpeed("delayed_3d");
        try {
          sessionStorage.setItem("aloha_delivery_speed", "delayed_3d");
        } catch {}
      }
    }
  }, [wallet.data]);

  const candidateClaim = useCandidateClaim(() => setPromoNonce((n) => n + 1));
  useEffect(
    () => onShopCampaignChanged((kind) => kind === "campaign" && setPromoNonce((n) => n + 1)),
    []
  );
  const requoteKey = useCampaignRequoteKey();

  const { quote: promoQuote, loading: promoLoading, stale: promoStale } = usePromotionQuote({
    lines: selectedLines,
    selectedCode: promoCode,
    autoMode: promoAutoMode,
    deliverySpeed,
    phone: user?.phone,
    email: user?.email,
    refreshKey: `${promoNonce}:${requoteKey}`,
  });

  useManualCodeFallback({
    quote: promoQuote,
    code: promoCode,
    autoMode: promoAutoMode,
    fallback: () => {
      setPromoCode("");
      setPromoAutoMode(true);
    },
  });

  const campaign = promoQuote?.campaign;
  useCampaignCartNotices(campaign);
  const flashSavings = campaign?.flashSavings || 0;
  const anchorSavings = campaign?.anchorSavings || 0;
  const volumeSavings = campaign?.volumeSavings || 0;
  const discountAmount = promoQuote?.discountTotal || 0;
  // Có báo giá server thì dùng giá server (giá trong giỏ máy có thể cũ / bị sửa).
  const tamTinh = promoQuote ? promoQuote.subtotal + flashSavings : localTamTinh;
  const tongSauGiam = Math.max(0, tamTinh - flashSavings - discountAmount);

  const totalPending = selectedLines.length > 0 && (promoLoading || promoStale || !promoQuote);
  const priceScopeKey = user?.id || "guest";
  const confirmedPrice = usePendingValue({ amount: tongSauGiam, subtotal: promoQuote?.subtotal ?? tamTinh,
    saved: discountAmount + flashSavings + anchorSavings + volumeSavings + (promoQuote?.wholesaleSavings || 0),
    discount: discountAmount, title: promoQuote?.applied?.title, quote: promoQuote, applied: promoQuote?.applied }, totalPending, priceScopeKey);
  const displayAmount = confirmedPrice ? formatVnd(confirmedPrice.amount) : "—";
  const displayDiscount = confirmedPrice?.discount ?? 0;
  const handleCheckout = () => {
    if (selectedQty <= 0 || totalPending) return;
    const dest = deliverySpeed === "delayed_3d" ? "/xac-nhan-don-hang?deliverySpeed=delayed_3d" : "/xac-nhan-don-hang";
    if (!user) {
      router.push(`/dang-nhap?next=${encodeURIComponent(dest)}`);
      return;
    }
    router.push(dest);
  };

  return (
    <div className="shop-pb-sticky mx-auto max-w-7xl px-0 sm:px-4 py-0 sm:py-6 space-y-2 sm:space-y-4">
      <div className="hidden md:flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-[var(--aloha-ink)]">Giỏ hàng</h1>
        <SiCartNotice />
        {lines.length > 0 ? (
          <Link
            href={moreHref}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--aloha-green)] px-3 py-2 text-sm font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
          >
            <Plus size={16} /> Mua thêm
          </Link>
        ) : null}
      </div>
      <div className="contents md:hidden">
        <SiCartNotice />
      </div>
      {priceNote ? (
        <p className="rounded-lg bg-[var(--aloha-green-light)] px-3 py-2 text-sm font-medium text-[var(--aloha-green-mid)]">
          {priceNote}
        </p>
      ) : null}

      {/* THANH TIẾN TRÌNH FREESHIP THÔNG MINH (CHO CẢ DESKTOP LẪN MOBILE) */}
      {lines.length > 0 ? (
        <div aria-busy={totalPending} className={`transition-opacity motion-reduce:transition-none ${totalPending ? "opacity-60" : "opacity-100"}`}>
          {confirmedPrice ? <SmartFreeshipBar currentAmount={confirmedPrice.subtotal} showMoreShopping={false} className="rounded-none sm:rounded-2xl border-x-0 sm:border-x" /> : <div className="h-12 rounded-none sm:rounded-xl bg-slate-50" />}
        </div>
      ) : null}

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-[1fr_320px]">
        {/* Cột trái */}
        <section className="w-full bg-white rounded-none sm:rounded-xl shadow-none sm:shadow-sm ring-0 sm:ring-1 sm:ring-[var(--aloha-line)] overflow-hidden">
          {!lines.length ? (
            <div className="flex flex-col items-center px-4 py-16 text-center">
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--aloha-cream)] text-[var(--aloha-green)]/50">
                <ShoppingBag size={48} strokeWidth={1.25} />
              </div>
              <p className="text-base font-bold text-[var(--aloha-ink)]">Giỏ hàng của bạn đang trống</p>
              <p className="mt-1 text-sm text-slate-500">Lướt cửa hàng, mua sắm ngay</p>
              <Link
                href={moreHref}
                className="mt-5 rounded-full bg-[var(--aloha-green)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)]"
              >
                Tiếp tục mua sắm
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-stone-100 sm:border-[var(--aloha-line)] bg-[var(--aloha-cream)] px-4 py-2.5 text-sm font-semibold text-slate-600 lg:hidden">
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
              <div className="hidden items-center gap-2 border-b border-[var(--aloha-line)] bg-[var(--aloha-cream)] px-4 py-3 text-sm font-semibold text-slate-600 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_90px_104px_96px_44px]">
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
                {lines.map((l) => {
                  const fl = l.selected ? flashLineFor(campaign, l.ma) : null;
                  const serverRows = (l.selected ? campaign?.lines || [] : []).filter(row => row.ma === l.ma && !row.isGift);
                  const unitPrice = serverRows[0]?.price ?? l.gia;
                  const lineTotal = serverRows.length ? serverRows.reduce((sum, row) => sum + row.price * row.quantity, 0) : l.gia * l.qty;
                  const referencePrice = Math.max(unitPrice, ...serverRows.map(row => row.compareAtPrice ?? row.listPrice ?? row.price));
                  const referenceTotal = serverRows.length ? serverRows.reduce((sum, row) => sum + Math.max(row.price, row.compareAtPrice ?? row.listPrice ?? row.price) * row.quantity, 0) : lineTotal;
                  return (
                  <li
                    key={l.ma}
                    className="relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5 px-4 py-3 sm:py-4 lg:grid-cols-[auto_minmax(0,1fr)_90px_104px_96px_44px] lg:items-center lg:px-4"
                  >
                    <input
                      type="checkbox"
                      checked={!!l.selected}
                      onChange={() => toggleSelected(l.ma)}
                      className="mt-2 accent-[var(--aloha-green)] lg:mt-0"
                    />
                    <div className="flex min-w-0 gap-3">
                      <Link
                        href={l.path}
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-[var(--aloha-cream)] ring-1 ring-black/[0.04]"
                      >
                        {l.anh ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.anh} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </Link>
                      <div className="min-w-0 flex-1 pr-8 lg:pr-0">
                        <Link
                          href={l.path}
                          className="line-clamp-2 text-sm font-bold uppercase text-[var(--aloha-ink)] hover:text-[var(--aloha-green)]"
                        >
                          {l.ten}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
                            {formatVariantLabel(l) ? `【${formatVariantLabel(l)}】` : (l.dvt ? `【${l.dvt}】` : "【Cái】")}
                          </span>
                          {isPreOrderTon(l.ton, l.qty) ? (
                            <span className="inline-flex rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              Đặt trước
                            </span>
                          ) : null}
                        </div>
                        {/* Mobile price/qty */}
                        <div className="mt-2 -mr-8 flex flex-wrap items-end justify-between gap-2 lg:hidden">
                          <div aria-busy={l.selected && totalPending} className={l.selected && totalPending ? "opacity-60" : ""}><MobileCartPrice gia={unitPrice} qty={l.qty} flash={fl} referencePrice={referencePrice} /></div>
                          <QtyCtrl
                            qty={l.qty}
                            plusDisabled={
                              l.allowBackorder === false &&
                              stockMax(l.ton) != null &&
                              l.qty >= (stockMax(l.ton) || 0)
                            }
                            onMinus={() => setQty(l.ma, l.qty - 1)}
                            onPlus={() => setQty(l.ma, l.qty + 1)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="hidden min-w-0 text-sm text-slate-700 lg:block">
                      <div aria-busy={l.selected && totalPending} className={l.selected && totalPending ? "opacity-60" : ""}><MobileCartPrice gia={unitPrice} qty={l.qty} flash={fl} referencePrice={referencePrice} /></div>
                    </div>
                    <div className="hidden flex-col items-center lg:flex">
                      <QtyCtrl
                        qty={l.qty}
                        plusDisabled={
                          l.allowBackorder === false &&
                          stockMax(l.ton) != null &&
                          l.qty >= (stockMax(l.ton) || 0)
                        }
                        onMinus={() => setQty(l.ma, l.qty - 1)}
                        onPlus={() => setQty(l.ma, l.qty + 1)}
                      />
                      {isPreOrderTon(l.ton, l.qty) ? (
                        <span className="mt-1 text-[10px] font-semibold text-amber-700">
                          Đặt trước
                        </span>
                      ) : null}
                    </div>
                    <div className="hidden text-right text-sm font-bold text-[var(--aloha-price)] lg:block">
                      <span className="whitespace-nowrap">{formatVnd(lineTotal)}</span>
                      {referenceTotal > lineTotal && <span className="mt-1 block whitespace-nowrap text-[11px] font-normal text-slate-400 line-through">{formatVnd(referenceTotal)}</span>}
                    </div>
                    <button
                      type="button"
                      className="absolute right-1 top-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 lg:static lg:justify-self-end"
                      onClick={() => remove(l.ma)}
                      aria-label="Xóa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                  );
                })}
              </ul>
              <CampaignGiftRows gifts={giftLinesOf(campaign)} />
            </>
          )}
        </section>

        {/* Cột phải — tóm tắt */}
        <aside className="space-y-2 sm:space-y-3">
          {selectedLines.length ? <CartVoucherProgress quote={confirmedPrice?.quote ?? null} onClaim={candidateClaim.claim} /> : null}
          {selectedLines.length ? (
            <DeliverySpeedSelector
              value={deliverySpeed}
              onChange={handleDeliverySpeedChange}
              quote={confirmedPrice?.quote ?? promoQuote}
              loading={totalPending}
            />
          ) : null}
          <div
            onClick={() => setPromoModalOpen(true)}
            aria-busy={totalPending}
            className={`flex min-h-[52px] sm:min-h-[64px] items-center justify-between bg-white px-4 py-3 rounded-none sm:rounded-xl shadow-none sm:shadow-sm ring-0 sm:ring-1 sm:ring-[var(--aloha-line)] cursor-pointer hover:bg-slate-50 transition ${totalPending ? "opacity-60" : "opacity-100"}`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-[var(--aloha-price)] shrink-0 sm:h-8 sm:w-8 sm:rounded-full sm:bg-[var(--aloha-green-light)] sm:text-[var(--aloha-green)]">
                <Ticket size={16} />
              </div>
              <div>
                <span className="text-[13px] sm:text-sm font-bold text-stone-900">
                  Voucher của Shop
                </span>
                {displayDiscount > 0 && confirmedPrice?.title ? (
                  <span
                    className="block text-[11px] text-[var(--aloha-green)] font-semibold truncate max-w-[180px] sm:max-w-[260px]"
                    title={formatAppliedVoucherTitle(confirmedPrice?.applied, confirmedPrice.title)}
                  >
                    {formatAppliedVoucherTitle(confirmedPrice?.applied, confirmedPrice.title)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {displayDiscount > 0 ? (
                <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-bold text-[var(--aloha-price)]">
                  -{formatVnd(displayDiscount)}
                </span>
              ) : (
                <span className="text-xs sm:text-sm font-medium text-[var(--aloha-green)]">
                  Chọn hoặc nhập mã
                </span>
              )}
              <ChevronRight size={16} className="text-stone-400" />
            </div>
          </div>

          <OrderPaymentSummary total={tamTinh} totalPending={totalPending} priceScopeKey={priceScopeKey} discount={discountAmount}
            voucherTitle={confirmedPrice?.title} voucherPromo={confirmedPrice?.applied}
            flashDiscount={flashSavings} volumeDiscount={volumeSavings} anchorDiscount={anchorSavings} wholesaleDiscount={promoQuote?.wholesaleSavings}
            grandTotal={tongSauGiam} cart showFreeshipProgress={false}>
            <button
              type="button"
              disabled={selectedQty <= 0 || totalPending}
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
              Phí vận chuyển sẽ được tính tại bước xác nhận đơn.
            </p>
          </OrderPaymentSummary>
        </aside>
      </div>

      {lines.length > 0 ? (
        <div ref={stickyRef} className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--aloha-line)] bg-white/95 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
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
            <div aria-busy={totalPending} className={`min-w-0 flex-1 text-right transition-opacity motion-reduce:transition-none ${totalPending ? "opacity-60" : "opacity-100"}`}>
              <p className="min-h-4 truncate text-[11px] text-slate-500">
                {(confirmedPrice?.saved ?? 0) > 0 ? `Tiết kiệm ${formatVnd(confirmedPrice!.saved)}` : `Tổng (${selectedQty})`}
              </p>
              <div className="flex min-h-6 items-center justify-end gap-1"><PriceUpdateIndicator pending={totalPending} compact />
                <p className="truncate text-base font-black tabular-nums text-[var(--aloha-price)]">{displayAmount}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={selectedQty <= 0 || totalPending}
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

      <PromotionModal
        open={promoModalOpen}
        onClose={() => setPromoModalOpen(false)}
        quote={promoQuote}
        loading={promoLoading}
        selectedCode={promoCode}
        autoMode={promoAutoMode}
        onApplyCode={(c) => {
          setPromoCode(c);
          setPromoAutoMode(false);
        }}
        onSelectAutoMode={() => {
          setPromoCode("");
          setPromoAutoMode(true);
        }}
        onRemoveDiscount={() => {
          setPromoCode("");
          setPromoAutoMode(false);
        }}
        ineligibleAction={candidateClaim.ineligibleAction}
      />
      {candidateClaim.loginSheet}
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
    <div className="inline-flex shrink-0 items-center overflow-hidden rounded-lg border border-[var(--aloha-line)]">
      <button
        type="button"
        onClick={onMinus}
        className="inline-flex h-9 w-8 items-center justify-center text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
        aria-label="Giảm số lượng"
      >
        −
      </button>
      <span className="flex h-9 min-w-8 items-center justify-center border-x border-[var(--aloha-line)] text-sm font-bold">
        {qty}
      </span>
      <button
        type="button"
        disabled={plusDisabled}
        title={plusDisabled ? "Đã đạt số lượng tồn kho" : "Tăng số lượng"}
        onClick={onPlus}
        aria-label="Tăng số lượng"
        className={`inline-flex h-9 w-8 items-center justify-center text-[var(--aloha-green)] ${
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
