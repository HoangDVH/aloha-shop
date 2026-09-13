import type { Db } from "mongodb";
import { ObjectId } from "mongodb";

export const SHOP_ACCOUNTS = "aloha_shop_accounts";
export const SHOP_REFRESH = "aloha_shop_refresh_tokens";
export const SHOP_LOGIN_IP = "aloha_shop_login_ip";
export const SHOP_OAUTH_STATE = "aloha_shop_oauth_state";

export type ShopRole = "customer" | "ctv";
export type CtvStatus = "cho_duyet" | "active" | "khoa";

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
  active: boolean;
  authProviders: string[];
  createdAt: string | null;
  lastLoginAt: string | null;
  adminNote?: string | null;
  commissionRate?: number | null;
  addresses?: ShopAddressPublic[];
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
    ? (doc.roles.map(String).filter((r) => r === "customer" || r === "ctv") as ShopRole[])
    : (["customer"] as ShopRole[]);
  const providers: string[] = [];
  if (doc.passwordHash) providers.push("email");
  if (doc.googleId) providers.push("google");
  const ctvStatus =
    doc.ctvStatus === "cho_duyet" || doc.ctvStatus === "active" || doc.ctvStatus === "khoa"
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
      db.collection(SHOP_OAUTH_STATE).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true }),
    ]);
  } catch (e) {
    console.warn("[shopAuth] ensureShopAuthIndexes:", e);
  }
}
