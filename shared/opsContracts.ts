/**
 * Shared operational contracts, enums, and notification types used by both
 * backend API routes/services and frontend components.
 */

export const DELIVERY_METHOD = {
  GIAO_TAN_NOI: "giao_tan_noi",
  NHAN_CUA_HANG: "nhan_cua_hang",
} as const;

export type DeliveryMethod = (typeof DELIVERY_METHOD)[keyof typeof DELIVERY_METHOD];

/** Returns true when an order uses store pickup (supports legacy "lay_tai_tiem"). */
export function isPickupDelivery(method: unknown): boolean {
  const normalized = String(method ?? "").trim().toLowerCase();
  return normalized === DELIVERY_METHOD.NHAN_CUA_HANG || normalized === "lay_tai_tiem";
}

export const ORDER_STATUS = {
  CHO_XAC_NHAN: "cho_xac_nhan",
  CHO_THANH_TOAN: "cho_thanh_toan",
  CHO_XU_LY: "cho_xu_ly",
  DANG_GIAO: "dang_giao",
  HOAN_THANH: "hoan_thanh",
  HUY: "huy",
  THIEU_HANG: "thieu_hang",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_NEED_ACTION_STATUSES: readonly string[] = [
  ORDER_STATUS.CHO_XU_LY,
  ORDER_STATUS.CHO_THANH_TOAN,
  ORDER_STATUS.CHO_XAC_NHAN,
  "cho",
];

export const PAYMENT_STATUS = {
  UNPAID: "unpaid",
  PROCESSING: "processing",
  PAID: "paid",
  UNDERPAID: "underpaid",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  FAILED: "failed",
  COD: "cod",
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_NEED_ACTION_STATUSES: readonly string[] = [
  PAYMENT_STATUS.UNPAID,
  PAYMENT_STATUS.PROCESSING,
  "reported",
];

export const ACCOUNT_STATUS = {
  CHO_DUYET: "cho_duyet",
  ACTIVE: "active",
  TU_CHOI: "tu_choi",
  KHOA: "khoa",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
} as const;

export const SI_VERIFICATION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const SI_KV_SYNC_STATUS = {
  AWAITING_VERIFICATION: "awaiting_verification",
  MATCHED: "matched",
  CREATED: "created",
  FAILED: "failed",
} as const;

export type WholesalePendingCheckInput =
  | {
      siStatus?: unknown;
      siVerificationStatus?: unknown;
      siVerification?: { status?: unknown } | null;
      siKvSyncStatus?: unknown;
    }
  | null
  | undefined;

/** Returns true when a wholesale account requires admin approval or verification. */
export function isWholesalePendingReview(account: WholesalePendingCheckInput): boolean {
  if (!account) return false;
  if (
    account.siStatus === ACCOUNT_STATUS.TU_CHOI ||
    account.siStatus === ACCOUNT_STATUS.KHOA ||
    account.siStatus === ACCOUNT_STATUS.REJECTED ||
    account.siStatus === ACCOUNT_STATUS.SUSPENDED
  ) {
    return false;
  }
  return (
    account.siStatus === ACCOUNT_STATUS.CHO_DUYET ||
    account.siVerificationStatus === SI_VERIFICATION_STATUS.PENDING ||
    account.siVerification?.status === SI_VERIFICATION_STATUS.PENDING ||
    account.siKvSyncStatus === SI_KV_SYNC_STATUS.AWAITING_VERIFICATION
  );
}

export const ADMIN_NOTIFICATION_TYPES = {
  ORDER: "order",
  WHOLESALE: "wholesale",
  CTV: "ctv",
  RECRUITMENT: "recruitment",
} as const;

export type AdminNotificationType =
  (typeof ADMIN_NOTIFICATION_TYPES)[keyof typeof ADMIN_NOTIFICATION_TYPES];

export type AdminNotificationItem = {
  id: string;
  type: AdminNotificationType;
  title: string;
  subtitle: string;
  detail?: string;
  /** Canonical ISO-8601 event timestamp for sorting and read-all cutoff comparisons. */
  eventAt?: string;
  /** Maintained for backward UI compatibility (equals eventAt). */
  createdAt: string;
  link: string;
  tag?: string;
  tagColor?: string;
  needsAction?: boolean;
  isRead?: boolean;
};

export type AdminNotificationsResponse = {
  ok: boolean;
  items: AdminNotificationItem[];
  counts: {
    total: number;
    orders: number;
    wholesale: number;
    ctv: number;
    recruitment: number;
  };
  readAllAt?: string | null;
  unreadCount?: number;
  at: number;
};
