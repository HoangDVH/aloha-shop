"use client";

import { useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { shopUpdateMe } from "@/lib/auth";
import { shopMeQueryKey } from "@/lib/authQueries";
import type { AddressDraft } from "@/components/GhnAddressFields";
import {
  createAddress,
  placeShopOrder,
  type ShopAddress,
} from "@/lib/orders";
import {
  shopShowCheckoutShipping,
  shopShowTransferPayment,
} from "@/lib/checkoutFlags";
import {
  checkoutAgreeSchema,
  checkoutReceiverSchema,
  checkoutShipAddressSchema,
} from "@/lib/checkoutSchemas";
import type { ShippingQuote } from "@/lib/shipping";
import { formatVariantLabel } from "@/lib/cartVariant";
import type { Delivery, PayMethod } from "./checkoutTypes";

type CartLineLike = {
  ma: string;
  ten: string;
  qty: number;
  gia: number;
  anh?: string;
  ctv?: string;
  dvt?: string;
  lineNote?: string;
  attributes?: Array<{ attributeName: string; attributeValue: string }>;
};

type ShopUserLike = {
  fullName?: string | null;
  phone?: string | null;
} | null;

type Args = {
  agree: boolean;
  selected: CartLineLike[];
  delivery: Delivery;
  showNewForm: boolean;
  selectedAddr: ShopAddress | undefined;
  draft: AddressDraft;
  addresses: ShopAddress[];
  setAddresses: Dispatch<SetStateAction<ShopAddress[]>>;
  setSelectedAddrId: Dispatch<SetStateAction<string>>;
  setShowNewForm: Dispatch<SetStateAction<boolean>>;
  shippingQuote: ShippingQuote | null;
  shippingError: string;
  shippingFee: number;
  pay: PayMethod;
  note: string;
  user: ShopUserLike;
  replace: (href: string) => void;
  removeSelected: () => void;
  setError: Dispatch<SetStateAction<string>>;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  /** Ref từ page nếu cần dùng chung với effect redirect; hook tự tạo nếu không truyền. */
  orderPlacedRef?: MutableRefObject<boolean>;
};

function profilePhoneEmpty(phone?: string | null) {
  return !String(phone || "").replace(/\D/g, "").trim();
}

/** Validate + tạo địa chỉ (nếu cần) + placeShopOrder — Zod + React Query mutation. */
export function usePlaceOrder({
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
  shippingFee,
  pay,
  note,
  user,
  replace,
  removeSelected,
  setError,
  setSubmitting,
  orderPlacedRef: orderPlacedRefProp,
}: Args) {
  const internalRef = useRef(false);
  const orderPlacedRef = orderPlacedRefProp ?? internalRef;
  const placingLockRef = useRef(false);
  const qc = useQueryClient();
  const showShip = shopShowCheckoutShipping();
  const showTransfer = shopShowTransferPayment();

  const placeMut = useMutation({
    mutationFn: placeShopOrder,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["shop", "orders"] });
    },
  });

  const placeOrder = async () => {
    if (placingLockRef.current) return;
    setError("");

    const agreeParsed = checkoutAgreeSchema.safeParse({
      agree,
      customerNote: note,
    });
    if (!agreeParsed.success) {
      setError(agreeParsed.error.issues[0]?.message || "Chưa đồng ý điều kiện");
      return;
    }
    if (!selected.length) {
      setError("Chưa chọn sản phẩm");
      return;
    }

    const method: PayMethod =
      showTransfer && pay === "Transfer" ? "Transfer" : "Cash";

    let customerName = "";
    let customerPhone = "";
    let province = "";
    let district = "";
    let ward = "";
    let ghnDistrictId = 0;
    let ghnWardCode = "";
    let shippingAddress = "";
    let addressId: string | undefined;

    if (delivery === "giao_tan_noi") {
      if (showNewForm || !selectedAddr) {
        customerName = draft.fullName.trim();
        customerPhone = draft.phone.trim();
        province = draft.province.trim();
        district = draft.district.trim();
        ward = draft.ward.trim();
        ghnDistrictId = draft.ghnDistrictId;
        ghnWardCode = draft.ghnWardCode;
        shippingAddress = draft.detail.trim();
        const addrParsed = checkoutShipAddressSchema.safeParse({
          customerName,
          customerPhone,
          province,
          ward,
          shippingAddress,
          district: district || undefined,
        });
        if (!addrParsed.success) {
          setError(addrParsed.error.issues[0]?.message || "Địa chỉ chưa đủ");
          return;
        }
        try {
          const res = await createAddress({
            fullName: customerName,
            phone: customerPhone,
            province,
            district: district || undefined,
            ward,
            detail: shippingAddress,
            ghnProvinceId: draft.ghnProvinceId || undefined,
            ghnDistrictId: ghnDistrictId || undefined,
            ghnWardCode: ghnWardCode || undefined,
            isDefault: addresses.length === 0,
          });
          setAddresses(res.addresses);
          const newest = res.addresses[res.addresses.length - 1];
          addressId = newest?.id;
          setSelectedAddrId(addressId || "");
          setShowNewForm(false);
        } catch (e: any) {
          setError(e?.message || "Không lưu được địa chỉ");
          return;
        }
      } else {
        customerName = selectedAddr.fullName;
        customerPhone = selectedAddr.phone;
        province = selectedAddr.province;
        district = selectedAddr.district || "";
        ward = selectedAddr.ward;
        ghnDistrictId = selectedAddr.ghnDistrictId || 0;
        ghnWardCode = selectedAddr.ghnWardCode || "";
        shippingAddress = selectedAddr.detail;
        addressId = selectedAddr.id;
        const addrParsed = checkoutShipAddressSchema.safeParse({
          customerName,
          customerPhone,
          province,
          ward,
          shippingAddress,
          district: district || undefined,
        });
        if (!addrParsed.success) {
          setError(addrParsed.error.issues[0]?.message || "Địa chỉ chưa đủ");
          return;
        }
      }
    } else {
      customerName = (draft.fullName || user?.fullName || "").trim();
      customerPhone = (draft.phone || user?.phone || "").trim();
      const recv = checkoutReceiverSchema.safeParse({ customerName, customerPhone });
      if (!recv.success) {
        setError(recv.error.issues[0]?.message || "Nhập tên và số điện thoại");
        return;
      }
    }

    if (showShip && delivery === "giao_tan_noi") {
      if (!shippingQuote?.quoteToken || !shippingQuote.selected) {
        setError(shippingError || "Chưa có phí ship — kiểm tra địa chỉ nhận hàng");
        return;
      }
    }

    placingLockRef.current = true;
    setSubmitting(true);
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const res = await placeMut.mutateAsync({
        addressId,
        customerName,
        customerPhone,
        deliveryMethod: delivery,
        province,
        district: district || undefined,
        ward,
        ghnDistrictId: ghnDistrictId || undefined,
        ghnWardCode: ghnWardCode || undefined,
        shippingAddress,
        method,
        usingCod: method === "Cash",
        customerNote: note.trim(),
        idempotencyKey,
        quoteToken:
          showShip && delivery === "giao_tan_noi"
            ? shippingQuote?.quoteToken
            : undefined,
        shippingFee: showShip && delivery === "giao_tan_noi" ? shippingFee : 0,
        shippingCarrier:
          showShip && delivery === "giao_tan_noi"
            ? shippingQuote?.selected?.carrier
            : undefined,
        orderDetails: selected.map((l) => {
          const variant = formatVariantLabel(l);
          const lineNote = String(l.lineNote || "").trim();
          return {
            productCode: l.ma,
            productName: l.ten,
            quantity: l.qty,
            price: l.gia,
            imageUrl: l.anh,
            ctvCode: l.ctv,
            variantLabel: variant || undefined,
            note: lineNote || undefined,
          };
        }),
      });
      const orderCode = String(res.data?.code || "").trim();

      // Lần đầu chưa có SĐT trên hồ sơ → lưu từ checkout (không chặn đặt hàng nếu lỗi).
      if (profilePhoneEmpty(user?.phone) && customerPhone) {
        try {
          const updated = await shopUpdateMe({ phone: customerPhone });
          qc.setQueryData(shopMeQueryKey, updated.user);
        } catch {
          /* soft */
        }
      }

      orderPlacedRef.current = true;
      removeSelected();
      if (orderCode) {
        replace(`/don-hang/${encodeURIComponent(orderCode)}`);
      } else {
        setError("Đặt hàng xong nhưng thiếu mã đơn — vào Tài khoản → Đơn mua để xem");
        replace("/tai-khoan?tab=don-mua");
      }
    } catch (e: any) {
      setError(e?.message || "Đặt hàng thất bại");
    } finally {
      placingLockRef.current = false;
      // Nếu đã đặt hàng thành công và đang chuyển trang, giữ submitting=true để màn hình chuyển mượt mà
      if (!orderPlacedRef.current) {
        setSubmitting(false);
      }
    }
  };

  return { placeOrder, orderPlacedRef };
}
