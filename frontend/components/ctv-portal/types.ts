export type CtvStatsBucket = { amount: number; count: number };

export type CtvStats = {
  ok?: boolean;
  ctvCode: string;
  returnHoldDays?: number;
  held: CtvStatsBucket;
  eligible: CtvStatsBucket;
  billed: CtvStatsBucket;
  paidOut: CtvStatsBucket;
  flagged?: CtvStatsBucket;
  cancelled?: CtvStatsBucket;
  pendingOrders?: { count: number; amount: number };
};

export type BillRow = {
  period: string;
  billStatus: string;
  net: number;
  gross?: number;
  orderCount: number;
  paidAt: string | null;
  lockedAt?: string | null;
};

export type OverviewOrder = {
  code: string;
  orderStatus: string;
  orderLabel: string;
  payLabel: string;
  total: number;
  createdAt: string | null;
  items: Array<{
    ma: string;
    ten: string;
    imageUrl?: string;
    giaWeb?: number;
    qty: number;
    price: number;
  }>;
};

export type OverviewCommission = {
  id: string;
  orderCode: string;
  ma: string;
  productName: string;
  imageUrl?: string;
  giaWeb: number;
  qty: number;
  amount: number;
  status: string;
  rate?: number;
};

export type OverviewClick = {
  id: string;
  ma: string;
  productName: string;
  imageUrl?: string;
  giaWeb: number;
  path: string;
  createdAt: string | null;
};

export type OverviewLine = {
  id: string;
  orderCode: string;
  ma: string;
  productName: string;
  imageUrl?: string;
  giaWeb: number;
  qty: number;
  lineTotal: number;
  orderLabel: string;
};

export type CtvOverview = {
  ok?: boolean;
  from: string;
  to: string;
  metrics: {
    clicks: number;
    orders: number;
    qtySold: number;
    gmv: number;
    estimatedCommission: number;
    buyers: number;
  };
  lists?: {
    orders?: OverviewOrder[];
    lines?: OverviewLine[];
    commissions?: OverviewCommission[];
    clicks?: OverviewClick[];
  };
};

export type ConversionRow = {
  orderCode: string;
  shopOrderCode?: string | null;
  kvInvoiceCode?: string | null;
  kvOrderCode?: string | null;
  purchasedAt: string | null;
  clickAt: string | null;
  completedAt: string | null;
  orderStatus: string;
  orderLabel: string;
  payLabel: string;
  paymentStatus: string;
  total: number;
  itemCommission: number;
  totalCommission: number;
  buyerStatus: string;
  products?: Array<{ ma: string; name: string; imageUrl: string }>;
  productSummary: string;
  commissionStatus: string;
  commissionStatusKey?: string;
  commissionStatusHint?: string;
};

export type PayoutBank = {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  updatedAt?: string | null;
};
