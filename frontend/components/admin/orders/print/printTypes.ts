export type PrintableOrder = {
  code: string;
  kvOrderCode?: string | null;
  kvInvoiceCode?: string | null;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  deliveryMethod?: "giao_tan_noi" | "nhan_cua_hang" | string;
  ward?: string;
  district?: string;
  province?: string;
  shippingAddress?:
    | {
        fullName?: string;
        phone?: string;
        detail?: string;
        ward?: string;
        district?: string;
        province?: string;
      }
    | string;
  kvDeliveryAddress?: {
    state?: string;
    reason?: string;
    original?: { province: string; district?: string; ward: string; streetAddress?: string };
    current?: { province: string; ward: string; district?: string };
  };
  total: number;
  subtotal?: number;
  shippingFee?: number;
  discountAmount?: number;
  voucherDiscount?: number;
  paymentStatus: string;
  priceMode?: string;
  notes?: string;
  orderDetails?: Array<{
    productCode?: string;
    productName?: string;
    quantity?: number;
    price?: number;
    discount?: number;
    variantLabel?: string;
    isGift?: boolean;
  }>;
};

export type PrintItem = {
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
  variantLabel?: string;
  isGift?: boolean;
};

export function resolveOrderAddress(order: PrintableOrder | null): string {
  if (!order) return "";
  if (order.deliveryMethod === "nhan_cua_hang") {
    return "Nhận tại cửa hàng ALOHA";
  }
  if (order.customerAddress && order.customerAddress.trim()) {
    return order.customerAddress.trim();
  }

  let street = "";
  let ward = order.ward || "";
  let district = order.district || "";
  let province = order.province || "";

  if (typeof order.shippingAddress === "string") {
    street = order.shippingAddress.trim();
  } else if (order.shippingAddress && typeof order.shippingAddress === "object") {
    street = order.shippingAddress.detail?.trim() || "";
    ward = ward || order.shippingAddress.ward || "";
    district = district || order.shippingAddress.district || "";
    province = province || order.shippingAddress.province || "";
  }

  const kv = order.kvDeliveryAddress;
  if (!street && kv?.original?.streetAddress) {
    street = kv.original.streetAddress.trim();
  }
  if (!ward && (kv?.original?.ward || kv?.current?.ward)) {
    ward = kv?.original?.ward || kv?.current?.ward || "";
  }
  if (!district && (kv?.original?.district || kv?.current?.district)) {
    district = kv?.original?.district || kv?.current?.district || "";
  }
  if (!province && (kv?.original?.province || kv?.current?.province)) {
    province = kv?.original?.province || kv?.current?.province || "";
  }

  const parts = [street, ward, district, province].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(", ");
  }

  return order.deliveryMethod === "giao_tan_noi" ? "Chưa có địa chỉ giao hàng" : "Nhận tại cửa hàng ALOHA";
}
