"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useShopRouter } from "@/lib/useShopRouter";
import { useCart } from "@/lib/cart";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import { useShopLoadingWhile } from "@/lib/useShopLoadingWhile";
import { refreshCartPricesFromCatalog } from "@/lib/cartPriceRefresh";
import { listAddresses, type ShopAddress } from "@/lib/orders";
import type { AddressDraft } from "@/components/GhnAddressFields";
import { fetchShopBank, type ShopBankInfo } from "@/lib/bankTransfer";
import {
  shopShowCheckoutShipping,
  shopShowTransferPayment,
} from "@/lib/checkoutFlags";
import {
  checkoutReceiverSchema,
  checkoutShipAddressSchema,
} from "@/lib/checkoutSchemas";
import { CheckoutAddressPickerModal } from "@/components/checkout/CheckoutAddressPickerModal";
import { CheckoutAddressSection } from "@/components/checkout/CheckoutAddressSection";
import { CheckoutLineItems } from "@/components/checkout/CheckoutLineItems";
import { CheckoutPaymentSection } from "@/components/checkout/CheckoutPaymentSection";
import { CheckoutShippingSection } from "@/components/checkout/CheckoutShippingSection";
import { CheckoutStickyBar } from "@/components/checkout/CheckoutStickyBar";
import { CheckoutSummaryAside } from "@/components/checkout/CheckoutSummaryAside";
import {
  EMPTY_DRAFT,
  type Delivery,
  type PayMethod,
} from "@/components/checkout/checkoutTypes";
import { usePlaceOrder } from "@/components/checkout/usePlaceOrder";
import { useShippingQuote } from "@/components/checkout/useShippingQuote";

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
  return <CheckoutConfirm />;
}

function CheckoutConfirm() {
  const router = useShopRouter();
  const { user, loading: authLoading } = useShopAuth();
  const lines = useCart((s) => s.lines);
  const removeSelected = useCart((s) => s.removeSelected);
  const showShip = shopShowCheckoutShipping();
  const showTransfer = shopShowTransferPayment();

  const selected = useMemo(() => lines.filter((l) => l.selected), [lines]);
  const total = selected.reduce((n, l) => n + l.gia * l.qty, 0);

  const [addresses, setAddresses] = useState<ShopAddress[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  const [delivery, setDelivery] = useState<Delivery>("giao_tan_noi");
  const [pay, setPay] = useState<PayMethod>("Cash");
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useShopLoadingWhile(submitting);

  const [draft, setDraft] = useState<AddressDraft>(EMPTY_DRAFT);

  const selectedAddr = addresses.find((a) => a.id === selectedAddrId);

  const [bankInfo, setBankInfo] = useState<ShopBankInfo | null>(null);

  useEffect(() => {
    if (!showTransfer) {
      setPay("Cash");
      return;
    }
    void fetchShopBank().then((b) => setBankInfo(b));
  }, [showTransfer]);

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

  const {
    shippingQuote,
    shippingLoading,
    shippingError,
    shippingFee,
    activeCarrier,
    quoteAddress,
    pickCarrier,
  } = useShippingQuote({
    delivery,
    selected,
    selectedAddr,
    showNewForm,
    draft,
    enabled: showShip,
  });

  const effectiveShippingFee = showShip ? shippingFee : 0;
  const grandTotal = total + effectiveShippingFee;

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
    setDraft((d) => ({
      ...d,
      fullName: d.fullName || user.fullName || "",
      phone: d.phone || user.phone || "",
    }));
    void listAddresses()
      .then((list) => {
        setAddresses(list);
        const def = list.find((a) => a.isDefault) || list[0];
        if (def) {
          setSelectedAddrId(def.id);
          setShowNewForm(false);
        } else {
          setShowNewForm(true);
        }
      })
      .catch(() => setShowNewForm(true));
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
    agree,
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
    pay: showTransfer ? pay : "Cash",
    note,
    user,
    replace: (href) => router.replace(href),
    removeSelected,
    setError,
    setSubmitting,
    orderPlacedRef,
  });

  if (authLoading) {
    return <ShopPageLoader fullscreen={false} />;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-bold text-[#1a2e1a]">Cần đăng nhập để đặt hàng</p>
        <p className="mt-2 text-sm text-slate-600">
          Tài khoản giúp lưu địa chỉ và theo dõi đơn. Đăng nhập rồi quay lại trang này.
        </p>
        <Link
          href={`/dang-nhap?next=${encodeURIComponent("/xac-nhan-don-hang")}`}
          className="mt-6 inline-flex rounded-xl bg-[var(--aloha-green)] px-5 py-3 text-sm font-bold text-white hover:bg-[var(--aloha-green-mid)]"
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

  const orderBlockedReason =
    selected.length === 0
      ? "Chưa chọn sản phẩm trong giỏ — quay lại giỏ hàng và tick sản phẩm."
      : receiverBlock
        ? receiverBlock
        : showShip && delivery === "giao_tan_noi" && shippingLoading
          ? "Đang tính phí vận chuyển…"
          : showShip && delivery === "giao_tan_noi" && !shippingQuote?.quoteToken
            ? shippingError ||
              "Chưa có phí ship. Kiểm tra địa chỉ nhận hàng (tỉnh/phường) hoặc thử lại."
            : !agree
              ? "Tick đồng ý Điều kiện giao dịch chung trước khi đặt hàng."
              : "";

  const canSubmit = !submitting && !orderBlockedReason;

  const patchDraft = (p: Partial<AddressDraft>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <>
      <div className="shop-pb-sticky mx-auto max-w-7xl animate-fade-up space-y-5 px-4 py-6 lg:pb-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-2xl font-extrabold text-[#1a2e1a]">Xác nhận đơn hàng</h1>
          <Link href="/gio-hang" className="text-sm font-semibold text-[var(--aloha-green)] hover:underline">
            ← Giỏ hàng
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <CheckoutLineItems
              selected={selected}
              note={note}
              onNoteChange={setNote}
            />

            <CheckoutAddressSection
              delivery={delivery}
              onDeliveryChange={setDelivery}
              draft={draft}
              onDraftChange={patchDraft}
              addresses={addresses}
              selectedAddr={selectedAddr}
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

            {showShip ? (
              <CheckoutShippingSection
                delivery={delivery}
                quoteAddress={quoteAddress}
                shippingLoading={shippingLoading}
                shippingError={shippingError}
                shippingQuote={shippingQuote}
                activeCarrier={activeCarrier}
                onPickCarrier={pickCarrier}
              />
            ) : null}

            <CheckoutPaymentSection
              pay={showTransfer ? pay : "Cash"}
              onPayChange={setPay}
              bankInfo={bankInfo}
              grandTotal={grandTotal}
            />
          </div>

          <CheckoutSummaryAside
            delivery={delivery}
            total={total}
            shippingFee={effectiveShippingFee}
            shippingLoading={shippingLoading}
            grandTotal={grandTotal}
            error={error}
            orderBlockedReason={orderBlockedReason}
            canSubmit={canSubmit}
            submitting={submitting}
            agree={agree}
            onAgreeChange={setAgree}
            onPlaceOrder={() => void placeOrder()}
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

      {/* Ngoài khối animate — portal body để fixed không bị kéo theo cuộn */}
      <CheckoutStickyBar
        total={total}
        grandTotal={grandTotal}
        shippingFee={effectiveShippingFee}
        showShipping={showShip && delivery === "giao_tan_noi"}
        canSubmit={canSubmit}
        submitting={submitting}
        orderBlockedReason={orderBlockedReason}
        agree={agree}
        onAgreeChange={setAgree}
        onPlaceOrder={() => void placeOrder()}
      />
    </>
  );
}
