import type { Db } from "mongodb";
import { ObjectId } from "mongodb";

export const SHOP_ACCOUNTS = "aloha_shop_accounts";
export const SHOP_REFRESH = "aloha_shop_refresh_tokens";
/** @deprecated Ephemeral đã chuyển Redis — giữ tên để tham chiếu migrate. */
export const SHOP_LOGIN_IP = "aloha_shop_login_ip";
/** @deprecated Ephemeral đã chuyển Redis — giữ tên để tham chiếu migrate. */
export const SHOP_OAUTH_STATE = "aloha_shop_oauth_state";

export type ShopRole = "customer" | "ctv" | "si";
export type CtvStatus = "cho_duyet" | "active" | "khoa" | "tu_choi";

export type ShopAddressPublic = {
  id: string;
  fullName: string;
  phone: string;
  province: string;
  ward: string;
  detail: string;
  label?: string;
  isDefault: boolean;
};

export type PublicShopAccount = {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  roles: ShopRole[];
  ctvCode: string | null;
  ctvStatus: CtvStatus | null;
  siStatus?: CtvStatus | null;
  siRegion?: "HCM" | "TINH" | null;
  siProfile?: Record<string, unknown> | null;
  zaloVerified?: boolean;
  active: boolean;
  authProviders: string[];
  createdAt: string | null;
  lastLoginAt: string | null;
  adminNote?: string | null;
  commissionRate?: number | null;
  addresses?: ShopAddressPublic[];
  /** STK nhận hoa hồng (mức 1) — admin có thể mask phía UI */
  payoutBank?: {
    bankBin: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    updatedAt?: string;
  } | null;
  ctvBalanceDebt?: number | null;
  /** Hồ sơ đăng ký CTV P0 */
  zalo?: string | null;
  addressText?: string | null;
  referralChannel?: string | null;
  channelUrl?: string | null;
  referralSource?: string | null;
  hasBusinessExp?: boolean | null;
  businessExpNote?: string | null;
  businessExpYears?: number | null;
  ctvRejectReason?: string | null;
};

export function shopAccountIdQuery(id: string): Record<string, unknown> {
  const sid = String(id || "").trim();
  if (ObjectId.isValid(sid) && String(new ObjectId(sid)) === sid) {
    return { $or: [{ _id: sid }, { _id: new ObjectId(sid) }] };
  }
  return { _id: sid };
}

export function normalizeEmail(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

export function normalizeCtvCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 20);
}

export function isValidCtvCode(code: string): boolean {
  const c = normalizeCtvCode(code);
  return c.length >= 3 && c.length <= 20;
}

export function toPublicShopAccount(doc: Record<string, unknown>): PublicShopAccount {
  const roles = Array.isArray(doc.roles)
    ? (doc.roles.map(String).filter((r) => r === "customer" || r === "ctv" || r === "si") as ShopRole[])
    : (["customer"] as ShopRole[]);
  const providers: string[] = [];
  if (doc.passwordHash) providers.push("email");
  if (doc.googleId) providers.push("google");
  const ctvStatus =
    doc.ctvStatus === "cho_duyet" ||
    doc.ctvStatus === "active" ||
    doc.ctvStatus === "khoa" ||
    doc.ctvStatus === "tu_choi"
      ? doc.ctvStatus
      : roles.includes("ctv")
        ? "cho_duyet"
        : null;
  const addresses: ShopAddressPublic[] = Array.isArray(doc.addresses)
    ? (doc.addresses as any[])
        .map((a) => ({
          id: String(a?.id || "").trim(),
          fullName: String(a?.fullName || "").trim(),
          phone: String(a?.phone || "").trim(),
          province: String(a?.province || "").trim(),
          ward: String(a?.ward || "").trim(),
          detail: String(a?.detail || "").trim(),
          label: a?.label ? String(a.label).trim() : undefined,
          isDefault: Boolean(a?.isDefault),
        }))
        .filter((a) => a.id && a.fullName && a.phone)
    : [];

  return {
    id: String(doc._id),
    email: String(doc.email || ""),
    phone: doc.phone ? String(doc.phone) : null,
    fullName: String(doc.fullName || doc.email || ""),
    avatarUrl: doc.avatarUrl ? String(doc.avatarUrl) : null,
    roles,
    ctvCode: doc.ctvCode ? String(doc.ctvCode) : null,
    ctvStatus,
    siStatus: (["cho_duyet", "active", "khoa", "tu_choi"].includes(String(doc.siStatus)) ? doc.siStatus : null) as CtvStatus | null,
    siRegion: doc.siRegion === "HCM" || doc.siRegion === "TINH" ? doc.siRegion : null,
    siProfile: (doc.siProfile as Record<string, unknown>) || null,
    zaloVerified: Boolean(doc.zaloId && doc.zaloVerifiedAt),
    active: doc.active !== false,
    authProviders: providers,
    createdAt: doc.createdAt ? new Date(doc.createdAt as string | Date).toISOString() : null,
    lastLoginAt: doc.lastLoginAt
      ? new Date(doc.lastLoginAt as string | Date).toISOString()
      : null,
    adminNote: doc.adminNote != null ? String(doc.adminNote) : null,
    commissionRate:
      doc.commissionRate != null && Number.isFinite(Number(doc.commissionRate))
        ? Number(doc.commissionRate)
        : null,
    addresses,
    payoutBank: (() => {
      const pb = doc.payoutBank as Record<string, unknown> | null | undefined;
      if (!pb || typeof pb !== "object") return null;
      const accountNumber = String(pb.accountNumber || "").trim();
      if (!accountNumber) return null;
      return {
        bankBin: String(pb.bankBin || "").trim(),
        bankName: String(pb.bankName || "").trim(),
        accountNumber,
        accountName: String(pb.accountName || "").trim(),
        updatedAt: pb.updatedAt ? String(pb.updatedAt) : undefined,
      };
    })(),
    ctvBalanceDebt:
      doc.ctvBalanceDebt != null && Number.isFinite(Number(doc.ctvBalanceDebt))
        ? Number(doc.ctvBalanceDebt)
        : null,
    zalo: doc.zalo != null ? String(doc.zalo).trim() || null : null,
    addressText: doc.addressText != null ? String(doc.addressText).trim() || null : null,
    referralChannel:
      doc.referralChannel != null ? String(doc.referralChannel).trim() || null : null,
    channelUrl: doc.channelUrl != null ? String(doc.channelUrl).trim() || null : null,
    referralSource:
      doc.referralSource != null ? String(doc.referralSource).trim() || null : null,
    hasBusinessExp:
      typeof doc.hasBusinessExp === "boolean" ? doc.hasBusinessExp : null,
    businessExpNote:
      doc.businessExpNote != null ? String(doc.businessExpNote).trim() || null : null,
    businessExpYears:
      doc.businessExpYears != null && Number.isFinite(Number(doc.businessExpYears))
        ? Number(doc.businessExpYears)
        : null,
    ctvRejectReason:
      doc.ctvRejectReason != null ? String(doc.ctvRejectReason).trim() || null : null,
  };
}

export async function ensureShopAuthIndexes(db: Db) {
  try {
    await Promise.all([
      db.collection(SHOP_ACCOUNTS).createIndex({ email: 1 }, { unique: true, background: true }),
      db
        .collection(SHOP_ACCOUNTS)
        .createIndex({ googleId: 1 }, { unique: true, sparse: true, background: true }),
      db
        .collection(SHOP_ACCOUNTS)
        .createIndex({ ctvCode: 1 }, { unique: true, sparse: true, background: true }),
      db.collection(SHOP_ACCOUNTS).createIndex({ phone: 1 }, { sparse: true, background: true }),
      db.collection(SHOP_ACCOUNTS).createIndex({ createdAt: -1 }, { background: true }),
      db.collection(SHOP_ACCOUNTS).createIndex({ ctvStatus: 1 }, { background: true }),
      db.collection(SHOP_REFRESH).createIndex({ jti: 1 }, { unique: true, background: true }),
      db.collection(SHOP_REFRESH).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true }),
    ]);
  } catch (e) {
    console.warn("[shopAuth] ensureShopAuthIndexes:", e);
  }
}
