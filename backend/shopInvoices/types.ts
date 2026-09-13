/** Types HĐ KV / enrich đơn shop */

export type KvInvoiceListParams = {
  pageSize?: number;
  currentItem?: number;
  fromPurchaseDate?: string;
  toPurchaseDate?: string;
  status?: number | string;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  includePayment?: boolean;
  /** Tìm theo mã HĐ nếu API hỗ trợ */
  code?: string;
};

export type ShopOrderInvoiceEnrich = {
  shopOrderCode?: string | null;
  shopPaymentStatus?: string | null;
  shopSource?: string | null;
};
