"use client";
import { usePriceSession } from "@/lib/priceSession";
import { formatVnd } from "@/lib/api";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useShopRouter } from "@/lib/useShopRouter";
import { SiCartNotice, useCartQuote } from "@/components/si-pricing/SiCartNotice";
import { useCart } from "@/lib/cart";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import { useShopLoadingWhile } from "@/lib/useShopLoadingWhile";
import { refreshCartPricesFromCatalog } from "@/lib/cartPriceRefresh";
import { listAddresses, ensureWholesaleRegistrationAddress, type ShopAddress } from "@/lib/orders";
import type { AddressDraft } from "@/components/GhnAddressFields";
import { shopShowCheckoutShipping } from "@/lib/checkoutFlags";
import {
  checkoutReceiverSchema,
  checkoutShipAddressSchema,
} from "@/lib/checkoutSchemas";
import { CheckoutAddressPickerModal } from "@/components/checkout/CheckoutAddressPickerModal";
import { CheckoutAddressSection } from "@/components/checkout/CheckoutAddressSection";
import { CheckoutLineItems } from "@/components/checkout/CheckoutLineItems";
import { CheckoutStickyBar } from "@/components/checkout/CheckoutStickyBar";
import { CheckoutSummaryAside } from "@/components/checkout/CheckoutSummaryAside";
import type { DeliverySpeed } from "@/components/checkout/DeliverySpeedSelector";
import { PromotionModal } from "@/components/checkout/PromotionModal";
import { useCandidateClaim } from "@/components/checkout/useCandidateClaim";
import { useManualCodeFallback } from "@/components/checkout/useManualCodeFallback";
import { useWallet } from "@/lib/campaign/walletQueries";
import { onShopCampaignChanged } from "@/lib/catalogSync";
import { usePromotionQuote } from "@/lib/usePromotionQuote";
import { useCheckoutError } from "@/lib/useCheckoutError";
import { useCampaignCartNotices, useCampaignRequoteKey } from "@/lib/campaign/campaignQuote";
import { PreOrderCodConfirmModal } from "@/components/checkout/BackorderConfirmModal";
import {
  EMPTY_DRAFT,
  type Delivery,
} from "@/components/checkout/checkoutTypes";
import { usePlaceOrder } from "@/components/checkout/usePlaceOrder";
import { useShippingQuote } from "@/components/checkout/useShippingQuote";
import { accountCheckoutDraft, checkoutDraftKey, restoreCheckoutDraft } from "@/lib/checkoutDraft";

/** Thiếu thông tin nhận hàng → chặn nút Đặt hàng (khớp validate lúc placeOrder). */
function checkoutReceiverBlockReason(args: {
  delivery: Delivery;
  showNewForm: boolean;
  selectedAddr: ShopAddress | undefined;
  draft: AddressDraft;
  userFullName?: string | null;
  userPhone?: string | null;
}): string {
  const { delivery, showNewForm, selectedAddr, draft, userFullName, userPhone } = args;

  if (delivery === "giao_tan_noi") {
    if (showNewForm || !selectedAddr) {
      const parsed = checkoutShipAddressSchema.safeParse({
        customerName: draft.fullName.trim(),
        customerPhone: draft.phone.trim(),
        province: draft.province.trim(),
        ward: draft.ward.trim(),
        shippingAddress: draft.detail.trim(),
        district: draft.district.trim() || undefined,
      });
      if (!parsed.success) {
        return parsed.error.issues[0]?.message || "Nhập đủ thông tin địa chỉ nhận hàng";
      }
      return "";
    }
    const parsed = checkoutShipAddressSchema.safeParse({
      customerName: selectedAddr.fullName,
      customerPhone: selectedAddr.phone,
      province: selectedAddr.province,
      ward: selectedAddr.ward,
      shippingAddress: selectedAddr.detail,
      district: selectedAddr.district || undefined,
    });
    if (!parsed.success) {
      return parsed.error.issues[0]?.message || "Địa chỉ đã lưu chưa đủ — chọn lại hoặc thêm mới";
    }
    return "";
  }

  const parsed = checkoutReceiverSchema.safeParse({
    customerName: (draft.fullName || userFullName || "").trim(),
    customerPhone: (draft.phone || userPhone || "").trim(),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message || "Nhập tên và số điện thoại người nhận";
  }
  return "";
}

export default function CheckoutConfirmPage() {
  const { user, loading } = useShopAuth();
  if (loading) return <ShopPageLoader fullscreen={false} />;
  return <CheckoutConfirm key={user?.id || "guest"} />;
}

function CheckoutConfirm() {
  const router = useShopRouter();
  const { user, loading: authLoading } = useShopAuth();
  const lines = useCart((s) => s.lines);
  const removeSelected = useCart((s) => s.removeSelected);
  const showShip = shopShowCheckoutShipping();

  const selected = useMemo(() => lines.filter((l) => l.selected), [lines]);
  const localTotal = selected.reduce((n, l) => n + l.gia * l.qty, 0);

  const [addresses, setAddresses] = useState<ShopAddress[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  const [delivery, setDelivery] = useState<Delivery>("giao_tan_noi");
  const [note, setNote] = useState("");
  const catalogState = usePriceSession();
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const checkoutCartKey = selected.map(l => `${l.ma}:${l.qty}:${l.gia}`).join("|");

  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoAutoMode, setPromoAutoMode] = useState(true);
  const [promoNonce, setPromoNonce] = useState(0);
  const candidateClaim = useCandidateClaim(() => setPromoNonce((n) => n + 1));
  useEffect(
    () => onShopCampaignChanged((kind) => kind === "campaign" && setPromoNonce((n) => n + 1)),
    []
  );
  const requoteKey = useCampaignRequoteKey();

  useShopLoadingWhile(submitting);

  const [draft, setDraft] = useState<AddressDraft>(EMPTY_DRAFT);
  const [draftReady, setDraftReady] = useState(false);
  const [error, setError] = useCheckoutError(JSON.stringify({ cart: checkoutCartKey, delivery, selectedAddrId, showNewForm,
    draft, promoCode, promoAutoMode, userId: user?.id }));

  // Khôi phục form địa chỉ từ sessionStorage nếu khách bấm Mua thêm rồi quay lại
  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    try { setDraft(restoreCheckoutDraft(sessionStorage, user)); }
    catch { setDraft(accountCheckoutDraft(user)); }
    setDraftReady(true);
    // The page is remounted when account ID changes; profile refreshes must not overwrite edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Tự động lưu form địa chỉ vào sessionStorage khi người dùng nhập liệu
  useEffect(() => {
    if (typeof window === "undefined" || !user || !draftReady) return;
    if (draft.fullName || draft.phone || draft.detail || draft.province) {
      try {
        sessionStorage.setItem(checkoutDraftKey(user.id), JSON.stringify(draft));
      } catch {
        /* ignore */
      }
    }
  }, [draft, draftReady, user?.id]);

  const selectedAddr = addresses.find((a) => a.id === selectedAddrId);
  const { isSi, quote: siQuote } = useCartQuote({ deliveryMethod: delivery,
    province: !showNewForm && selectedAddr ? selectedAddr.province : draft.province || "",
    district: !showNewForm && selectedAddr ? selectedAddr.district : draft.district || "",
    ward: !showNewForm && selectedAddr ? selectedAddr.ward : draft.ward || "" });
  // Cùng SĐT với đơn gửi lên: giới hạn suất sale mỗi khách tính theo SĐT người nhận.
  const receiverPhone =
    delivery === "giao_tan_noi" && !showNewForm && selectedAddr
      ? selectedAddr.phone
      : draft.phone || user?.phone || "";

  const cartMasKey = useMemo(
    () =>
      [...new Set(lines.map((l) => String(l.ma || "").trim().toUpperCase()).filter(Boolean))]
        .sort()
        .join(","),
    [lines]
  );

  useEffect(() => {
    if (!cartMasKey) return;
    void refreshCartPricesFromCatalog().catch(() => {
      /* giữ giá local */
    });
  }, [cartMasKey]);

  const [deliverySpeed, setDeliverySpeed] = useState<DeliverySpeed>(() => {
    if (typeof window !== "undefined") {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlSpeed = urlParams.get("deliverySpeed");
        if (urlSpeed === "delayed_3d" || urlSpeed === "standard") return urlSpeed;
        const explicit = sessionStorage.getItem("aloha_delivery_speed_user_explicit");
        if (explicit) {
          const saved = sessionStorage.getItem("aloha_delivery_speed");
          if (saved === "delayed_3d" || saved === "standard") return saved;
        }
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

  const {
    quote: promoQuote,
    loading: promoLoading,
    stale: promoStale,
  } = usePromotionQuote({
    lines: selected,
    selectedCode: promoCode,
    autoMode: promoAutoMode,
    deliverySpeed,
    phone: receiverPhone,
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

  const discountAmount = promoQuote?.discountTotal || 0;
  const campaign = promoQuote?.campaign;
  useCampaignCartNotices(campaign);
  const flashSavings = campaign?.flashSavings || 0;
  const volumeSavings = campaign?.volumeSavings || 0;
  const anchorSavings = campaign?.anchorSavings || 0;
  // Có báo giá server thì dùng giá server (giá trong giỏ máy có thể cũ / bị sửa).
  const total = promoQuote ? promoQuote.subtotal + flashSavings : localTotal;

  const {
    shippingQuote,
    shippingLoading,
    shippingError,
    shippingFee,
    shippingDiscount,
    activeCarrier,
    quoteAddress,
    pickCarrier,
  } = useShippingQuote({
    refreshKey: `${promoNonce}:${requoteKey}`,
    delivery,
    selected,
    selectedAddr,
    showNewForm,
    draft,
    enabled: showShip,
    discountTotal: discountAmount + flashSavings,
    promotionCode: promoQuote?.applied?.code,
    autoPromotion: promoAutoMode,
    customerPhone: draft.phone || user?.phone || undefined,
  });

  const effectiveShippingFee = showShip ? shippingFee : null;
  const effectiveShippingDiscount = showShip ? shippingDiscount : 0;
  const grandTotal =
    Math.max(0, total - flashSavings - discountAmount) +
    Math.max(0, (effectiveShippingFee ?? 0) - effectiveShippingDiscount);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/dang-nhap?next=/xac-nhan-don-hang");
      return;
    }
    // Warm trang SP vừa rời → Back không phải chờ fetch lại lâu
    // (document.referrer thường trống khi chuyển trang trong App Router)
    try {
      const fromStorage =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem("aloha_last_pdp") || ""
          : "";
      const ref = typeof document !== "undefined" ? document.referrer : "";
      const candidates = [fromStorage];
      if (ref) {
        try {
          const u = new URL(ref);
          if (u.origin === window.location.origin) {
            candidates.push(`${u.pathname}${u.search}`);
          }
        } catch {
          /* ignore */
        }
      }
      for (const path of candidates) {
        if (
          path &&
          (/^\/c\/[^/]+\/p\//.test(path.split("?")[0] || "") ||
            /^\/sp\//.test(path.split("?")[0] || ""))
        ) {
          router.prefetch(path);
        }
      }
    } catch {
      /* ignore */
    }
    let cancelled = false;
    void (user.roles.includes("si") && user.siStatus === "active" ? ensureWholesaleRegistrationAddress() : listAddresses())
      .then((list) => {
        if (cancelled) return;
        setAddresses(list);
        const def = list.find((a) => a.isDefault) || list[0];
        if (def) {
          setSelectedAddrId(def.id);
          setShowNewForm(false);
        } else {
          setShowNewForm(true);
        }
      })
      .catch(() => { if (!cancelled) setShowNewForm(true); });
    return () => { cancelled = true; };
  }, [user, authLoading, router]);

  /** Đã đặt xong → không đá về giỏ khi removeSelected() làm selected = 0 */
  const orderPlacedRef = useRef(false);

  useEffect(() => {
    if (submitting || orderPlacedRef.current) return;
    if (!authLoading && user && selected.length === 0) {
      router.replace("/gio-hang");
    }
  }, [authLoading, user, selected.length, router, submitting]);

  const { placeOrder } = usePlaceOrder({
    selected,
    delivery,
    showNewForm,
    selectedAddr,
    draft,
    addresses,
    setAddresses,
    setSelectedAddrId,
    setShowNewForm,
    shippingQuote,
    shippingError,
    shippingFee: effectiveShippingFee,
    promotionCode: promoQuote?.applied?.code,
    promotionId: promoQuote?.applied?.promotionId,
    autoPromotion: promoAutoMode,
    deliverySpeed,
    expectedSubtotal: promoQuote?.subtotal,
    onCampaignPriceChanged: () => setPromoNonce((n) => n + 1),
    note,
    user,
    replace: (href) => router.replace(href),
    removeSelected,
    setError,
    setSubmitting,
    orderPlacedRef,
  });

  const requestPlaceOrder = () => {
    if (minimumNoticeShown) {
      document.getElementById("wholesale-cart-notice")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (orderBlockedReason) {
      setError(orderBlockedReason);
      if (typeof document !== "undefined") {
        const target = document.getElementById("checkout-address-section");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.classList.add("ring-2", "!ring-rose-500", "!border-rose-500");
          setTimeout(() => {
            target.classList.remove("ring-2", "!ring-rose-500", "!border-rose-500");
          }, 3000);
        }
      }
      return;
    }
    setError("");
    setPolicyModalOpen(true);
  };

  const confirmPolicyAndPlace = () => {
    if (promoLoading || promoStale || !promoQuote || (showShip && delivery === "giao_tan_noi" && shippingLoading)) return;
    void placeOrder({ policyAccepted: true });
  };

  if (authLoading || (orderPlacedRef.current && submitting)) {
    return <ShopPageLoader fullscreen={false} />;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-bold text-[var(--aloha-ink)]">Cần đăng nhập để đặt hàng</p>
        <p className="mt-2 text-sm text-slate-600">
          Tài khoản giúp lưu địa chỉ và theo dõi đơn. Đăng nhập rồi quay lại trang này.
        </p>
        <Link
          href={`/dang-nhap?next=${encodeURIComponent("/xac-nhan-don-hang")}`}
          className="mt-6 inline-flex rounded-xl bg-[var(--aloha-green)] px-5 py-3 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)]"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  const receiverBlock = checkoutReceiverBlockReason({
    delivery,
    showNewForm,
    selectedAddr,
    draft,
    userFullName: user.fullName,
    userPhone: user.phone,
  });

  const orderBlockedReason = isSi && (!siQuote.data?.canCheckout || siQuote.isPending || siQuote.isError)
    ? siQuote.error?.message || siQuote.data?.issues?.map(i => i.message).join(" ") || "Đang kiểm tra giá và điều kiện mua sỉ. Sản phẩm thiếu giá cần được Aloha báo giá trước."
    : !catalogState.ready ? (catalogState.error || "Đang cập nhật giá giỏ hàng…") : selected.some(l => l.priceKind === "si_missing" || !(l.gia > 0)) ? "Có sản phẩm chưa có giá. Vui lòng liên hệ báo giá hoặc bỏ sản phẩm đó khỏi đơn." :
    selected.length === 0
      ? "Chưa chọn sản phẩm trong giỏ — quay lại giỏ hàng và tick sản phẩm."
      : promoLoading || promoStale || !promoQuote
        ? "Đang cập nhật ưu đãi và quà tặng, vui lòng chờ vài giây…"
      : receiverBlock
        ? receiverBlock
        : showShip && delivery === "giao_tan_noi" && shippingLoading
          ? "Đang tính phí vận chuyển…"
          : showShip && delivery === "giao_tan_noi" && !shippingQuote?.quoteToken
            ? shippingError ||
              "Chưa có phí ship. Kiểm tra địa chỉ nhận hàng (tỉnh/phường) hoặc thử lại."
            : "";

  const canSubmit = !submitting && !orderBlockedReason;
  const minimumNoticeShown = Boolean(isSi && !siQuote.isPending && !siQuote.isError && !siQuote.data?.canCheckout &&
    siQuote.data?.issues?.length && siQuote.data.issues.every(issue => issue.code === "minimum"));

  const patchDraft = (p: Partial<AddressDraft>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <>
      <div className="shop-pb-sticky mx-auto max-w-7xl animate-fade-up px-0 sm:px-4 py-0 sm:py-6 space-y-2 sm:space-y-5 lg:pb-8">
        <div className="hidden md:flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-2xl font-extrabold text-[var(--aloha-ink)]">Xác nhận đơn hàng</h1>
          <Link href="/gio-hang" className="text-sm font-semibold text-[var(--aloha-green)] hover:underline">
            ← Giỏ hàng
          </Link>
        </div>

        <div className="grid gap-2 sm:gap-5 lg:grid-cols-[1fr_360px]">
          <div className="flex min-w-0 flex-col gap-2 sm:gap-4">
            <div className="order-1 lg:order-2">
              <CheckoutAddressSection
              delivery={delivery}
              onDeliveryChange={setDelivery}
              draft={draft}
              onDraftChange={patchDraft}
              addresses={addresses}
              selectedAddr={selectedAddr}
              onSelectAddress={(id) => { setSelectedAddrId(id); setShowNewForm(false); }}
              onAddressSaved={(list, id) => { setAddresses(list); setSelectedAddrId(id); setShowNewForm(false); }}
              showNewForm={showNewForm}
              onShowNewForm={() => setShowNewForm(true)}
              onOpenPicker={() => setPickerOpen(true)}
              onChooseSaved={() => {
                setShowNewForm(false);
                setPickerOpen(true);
              }}
              userFullName={user.fullName}
              userPhone={user.phone}
            />
            </div>
            <div className="order-2 lg:order-1">
              <CheckoutLineItems
              selected={selected}
              note={note}
              onNoteChange={setNote}
              campaign={campaign}
              pricesPending={promoLoading || promoStale || !promoQuote}
            />
            </div>


            <div className="contents lg:block lg:order-3"><SiCartNotice /></div>
          </div>

          <CheckoutSummaryAside
            totalPending={promoLoading || promoStale || !promoQuote}
            priceScopeKey={user.id}
            delivery={delivery}
            total={total}
            discount={discountAmount}
            flashDiscount={flashSavings}
            volumeDiscount={volumeSavings}
            anchorDiscount={anchorSavings}
            wholesaleDiscount={promoQuote?.wholesaleSavings}
            appliedTitle={promoQuote?.applied?.title}
            voucherPromo={promoQuote?.applied}
            deliverySpeed={deliverySpeed}
            onDeliverySpeedChange={handleDeliverySpeedChange}
            quote={promoQuote}
            onOpenPromotion={() => setPromoModalOpen(true)}
            shippingFee={effectiveShippingFee}
            shippingDiscount={effectiveShippingDiscount}
            shippingPromotionTitle={shippingQuote?.shippingPromotion?.title}
            shippingPromotionHint={showShip ? shippingQuote?.shippingPromotionHint || undefined : undefined}
            freeShipApplied={Boolean(shippingQuote?.freeShipApplied)}
            shippingLoading={shippingLoading}
            grandTotal={grandTotal}
            error={error}
            orderBlockedReason={orderBlockedReason}
            minimumNoticeShown={minimumNoticeShown}
            canSubmit={canSubmit}
            submitting={submitting}
            onPlaceOrder={requestPlaceOrder}
          />
        </div>

        <CheckoutAddressPickerModal
          open={pickerOpen}
          addresses={addresses}
          selectedAddrId={selectedAddrId}
          onSelect={(id) => {
            setSelectedAddrId(id);
            setShowNewForm(false);
            setPickerOpen(false);
          }}
          onAddNew={() => {
            setShowNewForm(true);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      </div>

      <PreOrderCodConfirmModal
        totalPending={promoLoading || promoStale || !promoQuote || (showShip && delivery === "giao_tan_noi" && shippingLoading)}
        lines={selected.map((l) => ({
          ma: l.ma,
          ten: l.ten,
          qty: l.qty,
          dvt: l.dvt,
          anh: l.anh,
        }))}
        open={policyModalOpen}
        total={grandTotal}
        submitting={submitting}
        error={error}
        onClose={() => {
          if (!submitting) setPolicyModalOpen(false);
        }}
        onAgree={confirmPolicyAndPlace}
      />

      {/* Ngoài khối animate — portal body để fixed không bị kéo theo cuộn */}
      <CheckoutStickyBar
        totalPending={promoLoading || promoStale || !promoQuote || (showShip && delivery === "giao_tan_noi" && shippingLoading)}
        goodsPending={promoLoading || promoStale || !promoQuote}
        priceScopeKey={user.id}
        total={total + anchorSavings + volumeSavings}
        discount={discountAmount + flashSavings + anchorSavings + volumeSavings}
        volumeDiscount={volumeSavings}
        flashDiscount={flashSavings}
        productDiscount={anchorSavings}
        wholesaleDiscount={promoQuote?.wholesaleSavings}
        grandTotal={grandTotal}
        shippingFee={effectiveShippingFee}
        shippingDiscount={effectiveShippingDiscount}
        deliveryMethod={delivery}
        showShipping={showShip}
        canSubmit={canSubmit}
        submitting={submitting}
        orderBlockedReason={orderBlockedReason}
        minimumNoticeShown={minimumNoticeShown}
        onPlaceOrder={requestPlaceOrder}
      />

      <PromotionModal
        open={promoModalOpen}
        onClose={() => setPromoModalOpen(false)}
        quote={promoQuote}
        loading={promoLoading}
        selectedCode={promoCode}
        autoMode={promoAutoMode}
        deliverySpeed={deliverySpeed}
        onDeliverySpeedChange={handleDeliverySpeedChange}
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
        shippingDiscount={effectiveShippingDiscount}
        shippingPromotionTitle={shippingQuote?.shippingPromotion?.title}
        shippingPromotionId={shippingQuote?.shippingPromotion?.promotionId}
        shippingFee={effectiveShippingFee}
      />
      {candidateClaim.loginSheet}
    </>
  );
}
