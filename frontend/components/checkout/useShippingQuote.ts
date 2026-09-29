"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AddressDraft } from "@/components/GhnAddressFields";
import type { ShopAddress } from "@/lib/orders";
import {
  fetchShippingQuote,
  type ShippingCarrier,
  type ShippingEstimateStatus,
  type ShippingQuote,
} from "@/lib/shipping";
import type { Delivery } from "./checkoutTypes";

type CartLineLike = {
  ma: string;
  ten: string;
  trongLuong?: number;
  qty: number;
  gia: number;
};

type Args = {
  delivery: Delivery;
  selected: CartLineLike[];
  selectedAddr: ShopAddress | undefined;
  showNewForm: boolean;
  draft: AddressDraft;
  /** false = phase ẩn ship — không gọi API quote (giữ code). */
  enabled?: boolean;
  /** Đổi số tiền giảm → báo giá lại (miễn ship xét sau giảm); server tự tính lại số tiền. */
  discountTotal?: number;
  promotionCode?: string;
  autoPromotion?: boolean;
  customerPhone?: string;
};

/** Báo giá phí ship + chọn hãng — logic giữ nguyên từ trang xác nhận đơn. */
export function useShippingQuote({
  delivery,
  selected,
  selectedAddr,
  showNewForm,
  draft,
  enabled = true,
  discountTotal = 0,
  promotionCode = "",
  autoPromotion = true,
  customerPhone = "",
}: Args) {
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [carrierPick, setCarrierPick] = useState<ShippingCarrier | null>(null);

  const quoteItems = useMemo(
    () =>
      selected.map((l) => ({
        productCode: l.ma,
        productName: l.ten,
        trongLuong: l.trongLuong,
        quantity: l.qty,
        price: l.gia,
      })),
    [selected]
  );

  const quoteItemsKey = useMemo(
    () =>
      quoteItems
        .map((i) => `${i.productCode}:${i.quantity}:${i.trongLuong || 0}:${i.price}`)
        .join("|"),
    [quoteItems]
  );

  const quoteAddress = useMemo(() => {
    if (delivery !== "giao_tan_noi") {
      return { province: "", district: "", ward: "", ghnDistrictId: 0, ghnWardCode: "" };
    }
    if (!showNewForm && selectedAddr) {
      return {
        province: selectedAddr.province,
        district: selectedAddr.district || "",
        ward: selectedAddr.ward,
        ghnDistrictId: selectedAddr.ghnDistrictId || 0,
        ghnWardCode: selectedAddr.ghnWardCode || "",
      };
    }
    return {
      province: draft.province.trim(),
      district: draft.district.trim(),
      ward: draft.ward.trim(),
      ghnDistrictId: draft.ghnDistrictId,
      ghnWardCode: draft.ghnWardCode,
    };
  }, [delivery, showNewForm, selectedAddr, draft]);

  const quoteInputKey = useMemo(
    () =>
      [
        quoteItemsKey,
        quoteAddress.province,
        quoteAddress.district,
        quoteAddress.ward,
        quoteAddress.ghnDistrictId,
        quoteAddress.ghnWardCode,
        discountTotal,
        promotionCode,
        autoPromotion,
      ].join("::"),
    [quoteItemsKey, quoteAddress, discountTotal, promotionCode, autoPromotion]
  );

  const shippingFee: number | null = useMemo(() => {
    if (!enabled) return 0;
    if (delivery === "nhan_cua_hang") return 0;
    if (!shippingQuote) return null;
    if (
      shippingQuote.shippingEstimateStatus === "needs_confirmation" ||
      shippingQuote.shippingEstimateStatus === "unavailable"
    ) {
      return null;
    }
    if (shippingQuote.estimatedShippingFee != null) {
      return shippingQuote.estimatedShippingFee;
    }
    return shippingQuote.selected?.fee ?? null;
  }, [enabled, delivery, shippingQuote]);

  const shippingDiscount =
    shippingFee != null && delivery === "giao_tan_noi"
      ? Math.min(shippingFee, Math.max(0, shippingQuote?.shippingDiscount || 0))
      : 0;

  const shippingEstimateStatus: ShippingEstimateStatus = useMemo(() => {
    if (delivery === "nhan_cua_hang") return "nhan_cua_hang";
    if (!quoteAddress.province || !quoteAddress.ward) return "missing_address";
    if (shippingQuote?.shippingEstimateStatus) return shippingQuote.shippingEstimateStatus;
    if (shippingError) return "unavailable";
    if (shippingQuote?.selected) return "estimated";
    return "missing_address";
  }, [delivery, quoteAddress.province, quoteAddress.ward, shippingQuote, shippingError]);

  const activeCarrier =
    carrierPick || shippingQuote?.selected?.carrier || shippingQuote?.cheapest || null;

  const quoteRequestIdRef = useRef(0);
  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quoteAbortRef = useRef<AbortController | null>(null);
  const manualCarrierRef = useRef<ShippingCarrier | null>(null);
  const quoteItemsRef = useRef(quoteItems);
  const quoteAddressRef = useRef(quoteAddress);
  const deliveryRef = useRef(delivery);
  const promoRef = useRef({ promotionCode, autoPromotion, customerPhone });
  const enabledRef = useRef(enabled);

  quoteItemsRef.current = quoteItems;
  quoteAddressRef.current = quoteAddress;
  deliveryRef.current = delivery;
  enabledRef.current = enabled;
  promoRef.current = { promotionCode, autoPromotion, customerPhone };

  const requestShippingQuote = useCallback((resetCarrier: boolean) => {
    if (quoteTimerRef.current) {
      clearTimeout(quoteTimerRef.current);
      quoteTimerRef.current = null;
    }
    quoteAbortRef.current?.abort();
    quoteAbortRef.current = null;

    if (resetCarrier) {
      manualCarrierRef.current = null;
      setCarrierPick(null);
    }

    if (!enabledRef.current) {
      setShippingQuote(null);
      setShippingError("");
      setShippingLoading(false);
      return;
    }

    const deliveryMethod = deliveryRef.current;
    if (deliveryMethod === "nhan_cua_hang") {
      setShippingQuote(null);
      setShippingError("");
      setShippingLoading(false);
      return;
    }

    const items = quoteItemsRef.current;
    const { province, district, ward, ghnDistrictId, ghnWardCode } = quoteAddressRef.current;
    if (!province || !ward || !items.length) {
      setShippingQuote(null);
      setShippingError("");
      setShippingLoading(false);
      return;
    }

    const requestId = ++quoteRequestIdRef.current;
    const ac = new AbortController();
    quoteAbortRef.current = ac;

    setShippingQuote(null);
    setShippingError("");
    setShippingLoading(true);

    const carrier = manualCarrierRef.current || undefined;

    quoteTimerRef.current = setTimeout(() => {
      quoteTimerRef.current = null;
      void fetchShippingQuote(
        {
          items,
          province,
          district,
          ward,
          ghnDistrictId: ghnDistrictId || undefined,
          ghnWardCode: ghnWardCode || undefined,
          deliveryMethod,
          carrier,
          promotionCode: promoRef.current.promotionCode || undefined,
          autoPromotion: promoRef.current.autoPromotion,
          customerPhone: promoRef.current.customerPhone || undefined,
        },
        ac.signal
      )
        .then((q) => {
          if (requestId !== quoteRequestIdRef.current) return;
          setShippingQuote(q);
          if (!manualCarrierRef.current && q.cheapest) {
            setCarrierPick(q.cheapest);
          }
        })
        .catch((e: Error) => {
          if (requestId !== quoteRequestIdRef.current) return;
          if (e?.name === "AbortError") return;
          setShippingQuote(null);
          setShippingError(e?.message || "Không báo giá phí ship");
        })
        .finally(() => {
          if (requestId !== quoteRequestIdRef.current) return;
          setShippingLoading(false);
        });
    }, 300);
  }, []);

  // Đổi số lượng / SP / địa chỉ → báo giá lại từ đầu (đọc dữ liệu mới qua ref)
  useEffect(() => {
    requestShippingQuote(true);
    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
      quoteAbortRef.current?.abort();
      quoteRequestIdRef.current += 1;
    };
  }, [delivery, quoteInputKey, requestShippingQuote, enabled]);

  // Quay lại từ giỏ hàng (nút back / bfcache) — đọc lại SL mới nhất
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) requestShippingQuote(true);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [requestShippingQuote]);

  const pickCarrier = (carrier: ShippingCarrier) => {
    manualCarrierRef.current = carrier;
    setCarrierPick(carrier);
    requestShippingQuote(false);
  };

  return {
    shippingQuote,
    shippingLoading,
    shippingError,
    carrierPick,
    shippingFee,
    shippingDiscount,
    shippingEstimateStatus,
    activeCarrier,
    quoteAddress,
    pickCarrier,
  };
}
