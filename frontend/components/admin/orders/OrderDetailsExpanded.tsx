"use client";

import { useMemo, useState } from "react";
import { message } from "antd";
import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
} from "lucide-react";
import { type PrintableOrder, resolveOrderAddress } from "./OrderPrintModal";
import { OrderProductsTable, type OrderItemDetail } from "./details/OrderProductsTable";
import { OrderDeliverySection } from "./details/OrderDeliverySection";
import { OrderFinancialsAndActions } from "./details/OrderFinancialsAndActions";

export type OrderDetailsExpandedProps = {
  order: PrintableOrder & {
    kvPaymentVerification?: { state: string; reason: string; attempts: number };
    statusValue?: string;
    isTest?: boolean;
    voidTestBlock: string | null;
    paidAmount?: number;
    totalPayment?: number;
    notes?: string;
    customerNote?: string;
    priceMode?: string;
    province?: string;
    district?: string;
    ward?: string;
    shippingFee?: number;
    shippingCarrier?: string;
    usingCod?: boolean;
    totalWeightGram?: number;
    kvDeliveryAddress?: {
      state?: string;
      reason?: string;
      current?: {
        province?: string;
        district?: string;
        ward?: string;
      };
      original?: {
        province?: string;
        district?: string;
        ward?: string;
        streetAddress?: string;
      };
    };
    orderDetails?: Array<{
      productCode?: string;
      productName?: string;
      quantity?: number;
      price?: number;
      discount?: number;
      variantLabel?: string;
      imageUrl?: string;
      note?: string;
      priceKind?: "web" | "si" | string;
      giaSi?: number;
      giaWeb?: number;
      isGift?: boolean;
    }>;
  };
  onPrintReceipt: () => void;
  onPrintShipping: () => void;
  onCheckWholesale?: () => void;
  onVoidTest?: () => void;
  onCollapse?: () => void;
  onRefresh?: () => void;
};

export function OrderDetailsExpanded({
  order,
  onPrintReceipt,
  onPrintShipping,
  onCheckWholesale,
  onVoidTest,
  onCollapse,
  onRefresh,
}: OrderDetailsExpandedProps) {
  const fullAddress = useMemo(() => resolveOrderAddress(order), [order]);
  const isPickup = order.deliveryMethod === "nhan_cua_hang";
  const [copiedCode, setCopiedCode] = useState(false);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedCode(true);
    message.success("Đã sao chép mã đơn!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const streetDetail = useMemo(() => {
    if (typeof order.shippingAddress === "string" && order.shippingAddress.trim()) {
      return order.shippingAddress.trim();
    }
    if (order.shippingAddress && typeof order.shippingAddress === "object" && order.shippingAddress.detail) {
      return order.shippingAddress.detail.trim();
    }
    if (order.kvDeliveryAddress?.original?.streetAddress) {
      return order.kvDeliveryAddress.original.streetAddress.trim();
    }
    return "";
  }, [order]);

  const districtProvince = useMemo(() => {
    if (isPickup) return "Tại cửa hàng";
    const district =
      (typeof order.shippingAddress === "object" ? order.shippingAddress?.district : null) ||
      order.district ||
      order.kvDeliveryAddress?.original?.district ||
      order.kvDeliveryAddress?.current?.district ||
      "";
    const province =
      (typeof order.shippingAddress === "object" ? order.shippingAddress?.province : null) ||
      order.province ||
      order.kvDeliveryAddress?.original?.province ||
      order.kvDeliveryAddress?.current?.province ||
      "";
    if (district && province) return `${district} - ${province}`;
    return district || province || "—";
  }, [order, isPickup]);

  const wardName = useMemo(() => {
    if (isPickup) return "—";
    return (
      (typeof order.shippingAddress === "object" ? order.shippingAddress?.ward : null) ||
      order.ward ||
      order.kvDeliveryAddress?.original?.ward ||
      order.kvDeliveryAddress?.current?.ward ||
      "—"
    );
  }, [order, isPickup]);

  const items = useMemo<OrderItemDetail[]>(() => {
    if (order.orderDetails && order.orderDetails.length > 0) {
      return order.orderDetails.map((it: any) => {
        const quantity = Number(it.quantity) || 1;
        const price = Number(it.price) || 0;
        const discount = Number(it.discount) || 0;
        const sellPrice = Math.max(0, price - discount);
        const lineTotal = sellPrice * quantity;
        const isWholesale =
          it.priceKind === "si" ||
          order.priceMode === "si" ||
          (Number(it.giaSi) > 0 && price === Number(it.giaSi));

        return {
          productCode: it.productCode || it.ma || "SP",
          productName: it.productName || it.ten || "Sản phẩm",
          quantity,
          price,
          discount,
          sellPrice,
          lineTotal,
          variantLabel: it.variantLabel || "",
          imageUrl: it.imageUrl || it.anh || "",
          note: it.note || it.ghiChu || "",
          isWholesale,
          isGift: Boolean(it.isGift),
        };
      });
    }
    return [
      {
        productCode: order.code,
        productName: "Đơn hàng web tổng hợp",
        quantity: 1,
        price: order.total,
        discount: 0,
        sellPrice: order.total,
        lineTotal: order.total,
        variantLabel: "",
        imageUrl: "",
        note: "",
        isWholesale: order.priceMode === "si",
        isGift: false,
      },
    ];
  }, [order]);

  const subtotal = useMemo(() => {
    if (order.subtotal) return order.subtotal;
    return items.reduce((sum, it) => sum + it.lineTotal, 0);
  }, [order, items]);

  const totalQuantity = useMemo(() => {
    return items.reduce((sum, it) => sum + it.quantity, 0);
  }, [items]);

  const isOrderWholesale = order.priceMode === "si";
  const bangGiaLabel = isOrderWholesale ? "Bảng giá sỉ" : "Bảng giá Web";

  const statusLabel =
    order.paymentStatus === "paid"
      ? "Hoàn thành"
      : order.paymentStatus === "cancelled"
      ? "Đã huỷ"
      : order.paymentStatus === "cod"
      ? "Thu hộ COD"
      : "Phiếu tạm";

  const customerCode =
    order.customerPhone ? `KH${order.customerPhone.slice(-8)}` : `KH-${order.code.slice(-6)}`;

  return (
    <div className="bg-white border-y-2 border-[#2D5A27] p-5 -mx-4 -my-2.5 space-y-4 shadow-sm text-slate-900 text-[13px]">
      {/* 1. Header Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-6 -mt-1 mb-2">
        <button
          type="button"
          className="pb-2 font-bold text-sm text-[#2D5A27] border-b-2 border-[#2D5A27] flex items-center gap-1.5 cursor-pointer outline-none"
        >
          Thông tin
        </button>
      </div>

      {/* 2. Customer Header & Order Code */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-bold text-base text-slate-900 hover:text-[#2D5A27] cursor-pointer flex items-center gap-1.5">
            <span>{customerCode} - {order.customerName || "Khách lẻ"}</span>
            <ExternalLink size={16} className="text-[#0070ba] shrink-0" />
          </span>

          <span className="font-semibold text-base text-slate-900 font-mono flex items-center gap-1">
            <span>{order.kvOrderCode || order.code}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(order.kvOrderCode || order.code)}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
              title="Sao chép mã đơn"
            >
              {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
          </span>

          {order.kvOrderCode && order.kvOrderCode !== order.code ? (
            <span className="text-xs text-slate-500 font-mono font-medium">(Web: {order.code})</span>
          ) : null}

          {order.isTest ? (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-pink-50 text-pink-700 border border-pink-200">
              TEST
            </span>
          ) : null}
        </div>

        <div className="font-semibold text-slate-700 text-sm flex items-center gap-1.5">
          <span>Chi nhánh trung tâm</span>
        </div>
      </div>

      {/* 3. Order Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 py-1">
        <div className="flex items-center gap-2">
          <span className="w-28 text-slate-800 font-semibold text-[13px] shrink-0">Người tạo:</span>
          <span className="font-semibold text-slate-900 text-[13px]">
            {order.customerName ? "Khách đặt web" : "BH TẠI QUẦY"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-28 text-slate-800 font-semibold text-[13px] shrink-0">Người nhận đặt:</span>
          <div className="flex-1 h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] flex items-center justify-between shadow-2xs">
            <span>BH TẠI QUẦY</span>
            <ChevronDown size={14} className="text-slate-500" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-24 text-slate-800 font-semibold text-[13px] shrink-0">Ngày đặt:</span>
          <div className="flex-1 h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] flex items-center justify-between shadow-2xs">
            <span>{new Date(order.createdAt).toLocaleString("vi-VN")}</span>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Calendar size={14} />
              <Clock size={14} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-28 text-slate-800 font-semibold text-[13px] shrink-0">Kênh bán:</span>
          <div className="flex-1 h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] flex items-center justify-between shadow-2xs">
            <span>Website ALOHA</span>
            <ChevronDown size={14} className="text-slate-500" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-28 text-slate-800 font-semibold text-[13px] shrink-0">Bảng giá:</span>
          <span className={`text-[13px] font-bold ${isOrderWholesale ? "text-purple-800" : "text-slate-900"}`}>
            {bangGiaLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-24 text-slate-800 font-semibold text-[13px] shrink-0">Trạng thái:</span>
          <div className="flex-1 h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] flex items-center justify-between shadow-2xs">
            <span
              className={
                order.paymentStatus === "paid"
                  ? "text-emerald-700 font-bold"
                  : order.paymentStatus === "cancelled"
                  ? "text-slate-600 font-bold"
                  : "text-amber-700 font-bold"
              }
            >
              {statusLabel}
            </span>
            <ChevronDown size={14} className="text-slate-500" />
          </div>
        </div>
      </div>

      {/* 4. Shipping & Delivery Section */}
      <OrderDeliverySection
        order={order}
        fullAddress={fullAddress}
        streetDetail={streetDetail}
        districtProvince={districtProvince}
        wardName={wardName}
        isPickup={isPickup}
      />

      {/* 5. Products Table */}
      <OrderProductsTable items={items} />

      {/* 6. Financial Summary & Actions Toolbar */}
      <OrderFinancialsAndActions
        order={order}
        items={items}
        totalQuantity={totalQuantity}
        subtotal={subtotal}
        fullAddress={fullAddress}
        onPrintReceipt={onPrintReceipt}
        onPrintShipping={onPrintShipping}
        onCheckWholesale={onCheckWholesale}
        onVoidTest={onVoidTest}
        onCollapse={onCollapse}
        onRefresh={onRefresh}
      />
    </div>
  );
}
