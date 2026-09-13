/**
 * Đẩy đơn web bán lên KiotViet Đặt hàng (POST /orders) / Hóa đơn (POST /invoices).
 */
import type { Db } from "mongodb";
import {
  fetchKvAccessToken,
  kvApiBase,
  loadKvCreds,
  type KvCreds,
} from "../services/kvApiClient.js";
import type { ShopOrderDetail } from "./models.js";

async function fetchJson(
  url: string,
  init?: RequestInit & { timeout?: number }
): Promise<any> {
  const timeout = init?.timeout ?? 120_000;
  const { timeout: _t, ...rest } = init || {};
  const res = await fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeout),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg =
      json?.responseStatus?.message ||
      json?.message ||
      text.slice(0, 400) ||
      `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return json;
}

function normName(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function resolveShopKvBranchId(
  creds: KvCreds,
  token: string
): Promise<number> {
  const fromEnv = Number(process.env.SHOP_KV_BRANCH_ID || 0);
  if (fromEnv > 0) return fromEnv;

  const api = kvApiBase();
  const json = await fetchJson(`${api}/branches`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Retailer: creds.retailer,
    },
    timeout: 60_000,
  });
  /** Chỉ các CN token KV được phép tạo HĐ — không tự gắn id kho ngoài danh sách (KV báo "Chi nhánh không tồn tại"). */
  const branches = (
    Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : []
  )
    .filter((b: any) => b && b.isActive !== false)
    .map((b: any) => ({
      id: Number(b?.id || b?.branchId || 0),
      name: String(b?.branchName || b?.name || ""),
    }))
    .filter((b: { id: number }) => b.id > 0);

  const preferRaw = String(process.env.SHOP_KV_BRANCH_NAME || "").trim();
  const prefer = preferRaw ? normName(preferRaw) : "";
  const byName = prefer
    ? branches.find((b) => normName(b.name) === prefer) ||
      branches.find((b) => normName(b.name).includes(prefer))
    : undefined;

  const pick = byName || branches[0];
  const id = Number(pick?.id || 0);
  if (!id) throw new Error("Không lấy được chi nhánh KiotViet");
  return id;
}

/** Người bán HĐ web = BH ONLINE (không lấy NV KHO đầu danh sách). */
export async function resolveShopKvSoldById(
  creds: KvCreds,
  token: string
): Promise<number> {
  const fromEnv = Number(process.env.SHOP_KV_SOLD_BY_ID || 0);
  if (fromEnv > 0) return fromEnv;

  const prefer = normName(process.env.SHOP_KV_SOLD_BY_NAME || "BH ONLINE");
  const api = kvApiBase();
  const json = await fetchJson(`${api}/users?pageSize=100&currentItem=0`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Retailer: creds.retailer,
    },
    timeout: 60_000,
  });
  const users = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  const match = users.find((u: any) => {
    const given = normName(u?.givenName || "");
    const uname = normName(u?.userName || "");
    return given === prefer || given.includes(prefer) || uname.includes(prefer.replace(/\s+/g, ""));
  });
  const id = Number(match?.id || 0);
  if (!id) {
    throw new Error(
      `Không tìm thấy người bán KiotViet "${process.env.SHOP_KV_SOLD_BY_NAME || "BH ONLINE"}" (soldById)`
    );
  }
  return id;
}

/** Kênh bán web = Website. */
export async function resolveShopKvSaleChannelId(
  creds: KvCreds,
  token: string
): Promise<number> {
  const fromEnv = Number(process.env.SHOP_KV_SALE_CHANNEL_ID || 0);
  if (fromEnv > 0) return fromEnv;

  const prefer = normName(process.env.SHOP_KV_SALE_CHANNEL_NAME || "Website");
  const api = kvApiBase();
  const json = await fetchJson(`${api}/salechannel`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Retailer: creds.retailer,
    },
    timeout: 60_000,
  });
  const channels = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  const match =
    channels.find((c: any) => normName(c?.name || "") === prefer) ||
    channels.find((c: any) => normName(c?.name || "").includes(prefer));
  const id = Number(match?.id);
  if (!Number.isFinite(id) || id < 0) {
    throw new Error(
      `Không tìm thấy kênh bán KiotViet "${process.env.SHOP_KV_SALE_CHANNEL_NAME || "Website"}"`
    );
  }
  return id;
}

/**
 * Mã SP phí ship trên KV (dòng hàng dịch vụ).
 * Ưu tiên env; nếu trống thử tìm theo tên chứa "phí ship|vận chuyển".
 */
export async function resolveShopKvShipProductCode(
  creds: KvCreds,
  token: string
): Promise<string | null> {
  const fromEnv = String(process.env.SHOP_KV_SHIP_PRODUCT_CODE || "").trim();
  if (fromEnv) return fromEnv.toUpperCase();

  const api = kvApiBase();
  // Quét vài trang gần đây — phí ship thường ít đổi
  for (let page = 0; page < 5; page++) {
    const json = await fetchJson(
      `${api}/products?pageSize=100&currentItem=${page * 100}&includeInventory=false`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Retailer: creds.retailer,
        },
        timeout: 60_000,
      }
    );
    const products = Array.isArray(json?.data) ? json.data : [];
    if (!products.length) break;
    const hit = products.find((p: any) => {
      const name = normName(p?.name || p?.fullName || "");
      const code = normName(p?.code || "");
      return (
        /phi ship|phi van chuyen|phi giao hang|cuoc ship|shipping/.test(name) ||
        /^(ship|phiship|phi_ship|pvc)$/.test(code)
      );
    });
    if (hit?.code) return String(hit.code).trim().toUpperCase();
  }
  return null;
}

export type PushShopOrderKvInput = {
  customerName: string;
  customerPhone: string;
  address?: string;
  orderDetails: ShopOrderDetail[];
  usingCod: boolean;
  method: string;
  description: string;
  totalPayment: number;
  /** Phí ship (đồng) — cộng vào HĐ KV. */
  shippingFee?: number;
  /**
   * HĐ chờ CK (KiotQR): totalPayment=0 để KV chưa ghi nhận đã thu;
   * khi tiền vào, KiotQR/webhook cập nhật thanh toán.
   */
  awaitingBankTransfer?: boolean;
  /** Gắn HĐ với Đặt hàng KV (COD giao xong → hóa đơn từ đơn). */
  orderId?: number | string;
};

export type PushShopOrderKvResult = {
  kvOrderId: number | string;
  kvOrderCode: string;
  raw: any;
};

export async function pushShopOrderToKiotViet(
  db: Db,
  input: PushShopOrderKvInput
): Promise<PushShopOrderKvResult> {
  const creds = await loadKvCreds(db);
  if (!creds) {
    throw new Error("Chưa cấu hình KiotViet (clientId / secret / retailer)");
  }
  const token = await fetchKvAccessToken(creds);
  const branchId = await resolveShopKvBranchId(creds, token);
  const soldById = await resolveShopKvSoldById(creds, token);
  const saleChannelId = await resolveShopKvSaleChannelId(creds, token);

  const orderDetails = input.orderDetails.map((it) => ({
    productCode: it.productCode,
    productName: it.productName,
    quantity: it.quantity,
    price: it.price,
    discount: it.discount || 0,
    note: it.note || "",
  }));

  const shipFee = Math.max(0, Math.round(Number(input.shippingFee) || 0));
  if (shipFee > 0) {
    const shipCode = await resolveShopKvShipProductCode(creds, token);
    if (shipCode) {
      orderDetails.push({
        productCode: shipCode,
        productName: "Phí vận chuyển",
        quantity: 1,
        price: shipFee,
        discount: 0,
        note: "Ship web",
      });
    }
  }

  const receiver = input.customerName || "Khách web";
  const phone = input.customerPhone || "";
  const shipAddr = input.address || "Nhận tại cửa hàng ALOHA";

  const payload: Record<string, unknown> = {
    branchId,
    soldById,
    saleChannelId,
    customerName: receiver,
    contactNumber: phone || undefined,
    address: shipAddr,
    orderDetails,
    usingCod: input.usingCod,
    method: input.method || (input.usingCod ? "Cash" : "Transfer"),
    description: input.description.slice(0, 500),
    status: 1,
    totalPayment: input.totalPayment,
    // KV bật giao hàng → bắt buộc orderDelivery
    orderDelivery: {
      receiver,
      contactNumber: phone || "0000000000",
      address: shipAddr,
      price: shipFee > 0 ? shipFee : undefined,
    },
  };

  const api = kvApiBase();
  const json = await fetchJson(`${api}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Retailer: creds.retailer,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    timeout: 120_000,
  });

  const data = json?.data ?? json;
  const kvOrderId = data?.id ?? data?.orderId ?? json?.id;
  const kvOrderCode = String(data?.code || data?.orderCode || kvOrderId || "").trim();
  if (kvOrderId == null || kvOrderId === "") {
    throw new Error("KiotViet không trả mã đơn");
  }
  return {
    kvOrderId,
    kvOrderCode: kvOrderCode || String(kvOrderId),
    raw: data,
  };
}

export type PushShopInvoiceKvResult = {
  kvInvoiceId: number | string;
  kvInvoiceCode: string;
  raw: any;
};

/** Hóa đơn KV khi đã nhận CK (trừ onHand thật). */
export async function pushShopInvoiceToKiotViet(
  db: Db,
  input: PushShopOrderKvInput
): Promise<PushShopInvoiceKvResult> {
  const creds = await loadKvCreds(db);
  if (!creds) {
    throw new Error("Chưa cấu hình KiotViet (clientId / secret / retailer)");
  }
  const token = await fetchKvAccessToken(creds);
  const branchId = await resolveShopKvBranchId(creds, token);
  const soldById = await resolveShopKvSoldById(creds, token);
  const saleChannelId = await resolveShopKvSaleChannelId(creds, token);

  const invoiceDetails: Array<Record<string, unknown>> = input.orderDetails.map(
    (it) => ({
      productCode: it.productCode,
      productName: it.productName,
      quantity: it.quantity,
      price: it.price,
      discount: it.discount || 0,
    })
  );

  const shipFee = Math.max(0, Math.round(Number(input.shippingFee) || 0));
  let shipNote = "";
  if (shipFee > 0) {
    const shipCode = await resolveShopKvShipProductCode(creds, token);
    const surchargeId = Number(process.env.SHOP_KV_SURCHARGE_ID || 0);
    if (shipCode) {
      invoiceDetails.push({
        productCode: shipCode,
        productName: "Phí vận chuyển",
        quantity: 1,
        price: shipFee,
        discount: 0,
      });
    } else if (surchargeId > 0) {
      // Phụ phí KV (nếu gian hàng đã cấu hình)
    } else {
      shipNote = ` | Ship ${shipFee.toLocaleString("vi-VN")}đ (chưa có mã SP phí ship trên KV — đặt SHOP_KV_SHIP_PRODUCT_CODE)`;
    }
  }

  const receiver = input.customerName || "Khách web";
  const phone = input.customerPhone || "";

  const hasShipLine = invoiceDetails.some(
    (d) => String(d.productName || "") === "Phí vận chuyển"
  );
  const surchargeId = Number(process.env.SHOP_KV_SURCHARGE_ID || 0);

  const payload: Record<string, unknown> = {
    branchId,
    soldById,
    saleChannelId,
    customerName: receiver,
    contactNumber: phone || undefined,
    address: input.address || "Nhận tại cửa hàng ALOHA",
    invoiceDetails,
    usingCod: !!input.usingCod,
    method: input.method || (input.usingCod ? "Cash" : "Transfer"),
    description: `${input.description}${shipNote}`.slice(0, 500),
    // Chờ CK (KiotQR): chưa thu tiền trên HĐ; đã paid: ghi đủ totalPayment
    totalPayment: input.awaitingBankTransfer ? 0 : input.totalPayment,
    isDraft: false,
  };

  const linkOrderId = input.orderId;
  if (linkOrderId != null && linkOrderId !== "") {
    const n = Number(linkOrderId);
    payload.orderId = Number.isFinite(n) && n > 0 ? n : linkOrderId;
  }

  // Gắn TK NH trên KV → QR / thông báo CK khớp đúng HĐ
  const accountId = Number(process.env.SHOP_KV_ACCOUNT_ID || 0);
  if (accountId > 0 && (input.method || "Transfer") === "Transfer") {
    payload.accountId = accountId;
    // HĐ chờ CK: gắn sẵn phương thức CK + TK — giúp KiotQR khớp biến động số dư
    if (input.awaitingBankTransfer) {
      payload.payments = [
        {
          method: "Transfer",
          amount: 0,
          accountId,
        },
      ];
    }
  }

  if (shipFee > 0 && surchargeId > 0 && !hasShipLine) {
    payload.invoiceOrderSurcharges = [
      {
        surchargeId,
        price: shipFee,
        surValue: shipFee,
      },
    ];
  } else if (shipFee > 0 && !hasShipLine) {
    // Không có SP phí ship → ghi phí giao trên phiếu giao hàng KV
    payload.invoiceDelivery = {
      receiver,
      contactNumber: phone || "0000000000",
      address: input.address || "Nhận tại cửa hàng ALOHA",
      price: shipFee,
    };
  }

  const api = kvApiBase();
  const json = await fetchJson(`${api}/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Retailer: creds.retailer,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    timeout: 120_000,
  });

  const data = json?.data ?? json;
  const kvInvoiceId = data?.id ?? data?.invoiceId ?? json?.id;
  const kvInvoiceCode = String(data?.code || data?.invoiceCode || kvInvoiceId || "").trim();
  if (kvInvoiceId == null || kvInvoiceId === "") {
    throw new Error("KiotViet không trả mã hóa đơn");
  }
  return {
    kvInvoiceId,
    kvInvoiceCode: kvInvoiceCode || String(kvInvoiceId),
    raw: data,
  };
}

/** Hủy HĐ KV (đơn web hết hạn / khách hủy) — hoàn tồn trên KV nếu HĐ còn hiệu lực. */
export async function cancelShopInvoiceOnKiotViet(
  db: Db,
  kvInvoiceId: number | string
): Promise<boolean> {
  try {
    await cancelShopInvoiceOnKiotVietStrict(db, kvInvoiceId);
    return true;
  } catch (e: any) {
    console.warn("[kv-invoice-cancel]", kvInvoiceId, e?.message || e);
    return false;
  }
}

/**
 * Hủy HĐ trên KV — API bắt buộc body `{ id, isVoidPayment }`.
 * Ném lỗi kèm message KV (để UI hiện đúng lý do).
 */
export async function cancelShopInvoiceOnKiotVietStrict(
  db: Db,
  kvInvoiceId: number | string
): Promise<void> {
  const raw = String(kvInvoiceId || "").trim();
  if (!raw) throw new Error("Thiếu mã hóa đơn để hủy");

  const creds = await loadKvCreds(db);
  if (!creds) throw new Error("Chưa cấu hình KiotViet");

  const token = await fetchKvAccessToken(creds);
  const api = kvApiBase();
  const headers = {
    Authorization: `Bearer ${token}`,
    Retailer: creds.retailer,
    "Content-Type": "application/json",
  };

  let numericId: number | null = /^\d+$/.test(raw) ? Number(raw) : null;

  // Truyền mã HD… → lấy id số (DELETE chỉ nhận id)
  if (numericId == null || !Number.isFinite(numericId)) {
    const byCode = await fetchJson(
      `${api}/invoices/code/${encodeURIComponent(raw)}?includePayment=true`,
      { method: "GET", headers, timeout: 60_000 }
    );
    const data = byCode?.data ?? byCode;
    const found = Number(data?.id ?? data?.Id);
    if (!Number.isFinite(found) || found <= 0) {
      throw new Error(`Không tìm thấy hóa đơn ${raw} trên KiotViet`);
    }
    numericId = found;
  }

  // Đã hủy rồi → coi như xong
  try {
    const cur = await fetchJson(
      `${api}/invoices/${numericId}?includePayment=true`,
      { method: "GET", headers, timeout: 60_000 }
    );
    const inv = cur?.data ?? cur;
    if (Number(inv?.status) === 2) return;
  } catch {
    /* tiếp tục hủy */
  }

  // KV Public API: DELETE /invoices (không gắn id trên URL) + body { id, isVoidPayment }
  await fetchJson(`${api}/invoices`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({
      id: numericId,
      isVoidPayment: true,
    }),
    timeout: 60_000,
  });
}
