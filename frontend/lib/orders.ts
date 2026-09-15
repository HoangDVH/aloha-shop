"use client";

export type ShopAddress = {
  id: string;
  fullName: string;
  phone: string;
  province: string;
  district?: string;
  ward: string;
  detail: string;
  ghnProvinceId?: number;
  ghnDistrictId?: number;
  ghnWardCode?: string;
  label?: string;
  isDefault: boolean;
};

export type ShopOrderDetail = {
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
  discount?: number;
  note?: string;
  variantLabel?: string;
  imageUrl?: string;
  ctvCode?: string;
};

export type ShopBankInfo = {
  bin: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  ttlMin: number;
  configured: boolean;
};

export type ShopOrder = {
  id: string;
  code: string;
  kvOrderId?: number | string | null;
  kvOrderCode?: string | null;
  kvInvoiceId?: number | string;
  kvInvoiceCode?: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: string;
  province?: string;
  ward?: string;
  shippingAddress?: string;
  orderDetails: ShopOrderDetail[];
  ctvCodes?: string[];
  subtotal?: number;
  shippingFee?: number;
  shippingCarrier?: string;
  freeShipApplied?: boolean;
  total: number;
  totalPayment?: number;
  method?: string;
  usingCod?: boolean;
  customerNote?: string;
  status: string;
  statusValue?: string;
  paymentStatus?: string;
  orderStatus?: string;
  paymentCode?: string;
  expiresAt?: string;
  qrUrl?: string | null;
  qrKind?: "kiotviet" | "vietqr" | string | null;
  transferContent?: string | null;
  kovCode?: string | null;
  qrString?: string | null;
  bank?: ShopBankInfo | null;
  /** Khách bấm “Tôi đã chuyển khoản” — chờ nhân viên xác nhận */
  customerReportedPaidAt?: string | null;
  createdAt?: string;
  purchaseDate?: string;
};

/** Mã hiển thị cho khách: HĐ KV (CK) → ĐH KV (COD) → mã shop. */
export function displayShopOrderCode(
  order: {
    code?: string | null;
    kvInvoiceCode?: string | null;
    kvOrderCode?: string | null;
  } | null | undefined
): string {
  if (!order) return "";
  return (
    String(order.kvInvoiceCode || "").trim() ||
    String(order.kvOrderCode || "").trim() ||
    String(order.code || "").trim()
  );
}

/** Mã dùng cho URL /don-hang/… — ưu tiên HD/DH nếu có (API tìm được cả WEB). */
export function shopOrderPathCode(
  order: {
    code?: string | null;
    kvInvoiceCode?: string | null;
    kvOrderCode?: string | null;
  } | null | undefined
): string {
  return displayShopOrderCode(order);
}

async function shopFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    cache: "no-store",
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function listAddresses(): Promise<ShopAddress[]> {
  const data = await shopFetch<{ addresses: ShopAddress[] }>("/api/shop/auth/addresses");
  return data.addresses || [];
}

export async function createAddress(body: Omit<ShopAddress, "id">) {
  return shopFetch<{ addresses: ShopAddress[] }>("/api/shop/auth/addresses", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateAddress(id: string, body: Partial<ShopAddress>) {
  return shopFetch<{ addresses: ShopAddress[] }>(
    `/api/shop/auth/addresses/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

export async function deleteAddress(id: string) {
  return shopFetch<{ addresses: ShopAddress[] }>(
    `/api/shop/auth/addresses/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export type PlaceOrderInput = {
  addressId?: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: "giao_tan_noi" | "nhan_cua_hang";
  province?: string;
  district?: string;
  ward?: string;
  ghnDistrictId?: number;
  ghnWardCode?: string;
  shippingAddress?: string;
  method: "Cash" | "Transfer";
  usingCod?: boolean;
  customerNote?: string;
  orderDetails: ShopOrderDetail[];
  quoteToken?: string;
  shippingFee?: number;
  shippingCarrier?: string;
  /** Chống đặt trùng khi retry / mất response */
  idempotencyKey?: string;
};

export async function placeShopOrder(body: PlaceOrderInput) {
  return shopFetch<{
    ok: boolean;
    data: {
      id: string;
      code: string;
      kvOrderId: number | string | null;
      kvOrderCode: string | null;
      kvInvoiceId?: number | string | null;
      kvInvoiceCode?: string | null;
      total: number;
      status: string;
      statusValue: string;
      paymentStatus?: string;
      orderStatus?: string;
      paymentCode?: string;
      expiresAt?: string;
      method?: string;
      qrUrl?: string | null;
      bank?: ShopBankInfo | null;
    };
  }>("/api/shop/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listMyOrders(): Promise<ShopOrder[]> {
  const data = await shopFetch<{ data: ShopOrder[] }>("/api/shop/orders/me");
  return data.data || [];
}

export async function getMyOrder(code: string): Promise<ShopOrder> {
  const data = await shopFetch<{ ok: boolean; data: ShopOrder }>(
    `/api/shop/orders/me/${encodeURIComponent(code)}`
  );
  if (!data?.data) {
    throw new Error("Không tải được đơn — thử F5 hoặc vào Đơn mua");
  }
  return data.data;
}

export async function cancelUnpaidOrder(code: string) {
  return shopFetch<{ ok: boolean; data: ShopOrder }>(
    `/api/shop/orders/me/${encodeURIComponent(code)}/cancel`,
    { method: "POST", body: "{}" }
  );
}

/** Khách báo đã chuyển khoản — UI chuyển sang chờ shop xác nhận. */
export async function reportPaidOrder(code: string) {
  return shopFetch<{ ok: boolean; data: ShopOrder }>(
    `/api/shop/orders/me/${encodeURIComponent(code)}/reported-paid`,
    { method: "POST", body: "{}" }
  );
}

/** Gia hạn / tạo mã QR CK mới khi hết hạn (hoặc còn hạn). */
export async function renewPaymentOrder(code: string) {
  return shopFetch<{ ok: boolean; data: ShopOrder }>(
    `/api/shop/orders/me/${encodeURIComponent(code)}/renew-payment`,
    { method: "POST", body: "{}" }
  );
}

/** SSE đơn shop — gọi onChange khi có shop_orders. */
export function subscribeShopOrdersStream(onChange: () => void): () => void {
  if (typeof EventSource === "undefined") return () => {};
  let es: EventSource | null = null;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (stopped) return;
    try {
      es = new EventSource("/api/shop/orders/stream", { withCredentials: true });
    } catch {
      schedule();
      return;
    }
    es.addEventListener("change", () => {
      onChange();
    });
    es.onerror = () => {
      try {
        es?.close();
      } catch {
        /* */
      }
      es = null;
      schedule();
    };
  };

  const schedule = () => {
    if (stopped || timer) return;
    timer = setTimeout(() => {
      timer = null;
      connect();
    }, 2500);
  };

  connect();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    try {
      es?.close();
    } catch {
      /* */
    }
  };
}
