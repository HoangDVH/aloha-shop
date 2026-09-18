/**
 * CTV hoa hồng — models + settings (shop DB).
 */
import type { Db } from "mongodb";

export const SHOP_COMMISSIONS = "aloha_shop_commissions";
export const SHOP_COMMISSION_BILLS = "aloha_shop_commission_bills";
export const SHOP_CTV_PRODUCT_RATES = "aloha_shop_ctv_product_rates";
export const SHOP_CTV_FRAUD_EVENTS = "aloha_shop_ctv_fraud_events";
export const SHOP_SETTINGS = "aloha_shop_settings";
export const CTV_SETTINGS_ID = "ctv";

export type CommissionStatus =
  | "held"
  | "eligible"
  | "billed"
  | "paid_out"
  | "cancelled"
  | "flagged";

export type CtvSettings = {
  defaultCommissionRate: number;
  returnHoldDays: number;
  attributionWindowDays: number;
  settleDay: number;
  selfBuyMaxHits: number;
  /** Ngưỡng số đơn cùng SĐT+CTV / 90 ngày → cảnh báo mềm (không khóa HH) */
  addressMatchMaxHits: number;
  /** SĐT nội bộ / test — bỏ qua rule trùng SĐT */
  phoneWhitelist: string[];
  /** Bật cảnh báo mềm trùng SĐT (không gắn flagged) */
  phoneRepeatSoftWarn: boolean;
  termsVersion: string;
};

export const DEFAULT_CTV_SETTINGS: CtvSettings = {
  defaultCommissionRate: 5,
  returnHoldDays: 7,
  attributionWindowDays: 7,
  settleDay: 18,
  selfBuyMaxHits: 2,
  addressMatchMaxHits: 10,
  phoneWhitelist: ["123456789", "0123456789", "0987654321"],
  phoneRepeatSoftWarn: true,
  termsVersion: "1",
};

function parsePhoneList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((x) => String(x || "").replace(/\D/g, "")).filter((x) => x.length >= 8))];
  }
  if (typeof raw === "string") {
    return [
      ...new Set(
        raw
          .split(/[\s,;]+/)
          .map((x) => x.replace(/\D/g, ""))
          .filter((x) => x.length >= 8)
      ),
    ];
  }
  return [...DEFAULT_CTV_SETTINGS.phoneWhitelist];
}

export async function getCtvSettings(shopDb: Db): Promise<CtvSettings> {
  const doc = await shopDb.collection(SHOP_SETTINGS).findOne({ _id: CTV_SETTINGS_ID as any });
  if (!doc) return { ...DEFAULT_CTV_SETTINGS, phoneWhitelist: [...DEFAULT_CTV_SETTINGS.phoneWhitelist] };
  const n = (v: unknown, fb: number) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : fb;
  };
  return {
    defaultCommissionRate: Math.max(0, n(doc.defaultCommissionRate, DEFAULT_CTV_SETTINGS.defaultCommissionRate)),
    returnHoldDays: Math.min(14, Math.max(7, Math.floor(n(doc.returnHoldDays, 7)))),
    attributionWindowDays: Math.max(1, Math.floor(n(doc.attributionWindowDays, 7))),
    settleDay: Math.min(28, Math.max(1, Math.floor(n(doc.settleDay, 18)))),
    selfBuyMaxHits: Math.max(1, Math.floor(n(doc.selfBuyMaxHits, 2))),
    addressMatchMaxHits: Math.max(1, Math.floor(n(doc.addressMatchMaxHits, 10))),
    phoneWhitelist: parsePhoneList(
      doc.phoneWhitelist != null ? doc.phoneWhitelist : DEFAULT_CTV_SETTINGS.phoneWhitelist
    ),
    phoneRepeatSoftWarn:
      doc.phoneRepeatSoftWarn == null
        ? true
        : Boolean(doc.phoneRepeatSoftWarn),
    termsVersion: String(doc.termsVersion || "1"),
  };
}

export async function saveCtvSettings(
  shopDb: Db,
  patch: Partial<CtvSettings> & { phoneWhitelistText?: string }
): Promise<CtvSettings> {
  const cur = await getCtvSettings(shopDb);
  const next: CtvSettings = {
    defaultCommissionRate:
      patch.defaultCommissionRate != null
        ? Math.max(0, Number(patch.defaultCommissionRate) || 0)
        : cur.defaultCommissionRate,
    returnHoldDays:
      patch.returnHoldDays != null
        ? Math.min(14, Math.max(7, Math.floor(Number(patch.returnHoldDays) || 7)))
        : cur.returnHoldDays,
    attributionWindowDays:
      patch.attributionWindowDays != null
        ? Math.max(1, Math.floor(Number(patch.attributionWindowDays) || 7))
        : cur.attributionWindowDays,
    settleDay:
      patch.settleDay != null
        ? Math.min(28, Math.max(1, Math.floor(Number(patch.settleDay) || 18)))
        : cur.settleDay,
    selfBuyMaxHits:
      patch.selfBuyMaxHits != null
        ? Math.max(1, Math.floor(Number(patch.selfBuyMaxHits) || 2))
        : cur.selfBuyMaxHits,
    addressMatchMaxHits:
      patch.addressMatchMaxHits != null
        ? Math.max(1, Math.floor(Number(patch.addressMatchMaxHits) || 10))
        : cur.addressMatchMaxHits,
    phoneWhitelist:
      patch.phoneWhitelist != null || (patch as any).phoneWhitelistText != null
        ? parsePhoneList(
            patch.phoneWhitelist != null
              ? patch.phoneWhitelist
              : (patch as any).phoneWhitelistText
          )
        : cur.phoneWhitelist,
    phoneRepeatSoftWarn:
      patch.phoneRepeatSoftWarn != null
        ? Boolean(patch.phoneRepeatSoftWarn)
        : cur.phoneRepeatSoftWarn,
    termsVersion: patch.termsVersion != null ? String(patch.termsVersion) : cur.termsVersion,
  };
  await shopDb.collection(SHOP_SETTINGS).updateOne(
    { _id: CTV_SETTINGS_ID as any },
    { $set: { ...next, updatedAt: new Date().toISOString() } },
    { upsert: true }
  );
  return next;
}

export async function ensureCommissionIndexes(shopDb: Db) {
  try {
    await Promise.all([
      shopDb.collection(SHOP_COMMISSIONS).createIndex(
        { orderCode: 1, ma: 1, ctvCode: 1 },
        { unique: true, background: true }
      ),
      shopDb
        .collection(SHOP_COMMISSIONS)
        .createIndex({ ctvCode: 1, status: 1, eligibleAt: -1 }, { background: true }),
      shopDb
        .collection(SHOP_COMMISSIONS)
        .createIndex({ status: 1, eligibleAt: 1 }, { background: true }),
      shopDb
        .collection(SHOP_COMMISSIONS)
        .createIndex({ billingPeriod: 1, status: 1 }, { sparse: true, background: true }),
      shopDb
        .collection(SHOP_COMMISSION_BILLS)
        .createIndex({ period: 1 }, { unique: true, background: true }),
      shopDb
        .collection(SHOP_CTV_PRODUCT_RATES)
        .createIndex({ ctvCode: 1, ma: 1 }, { unique: true, background: true }),
      shopDb
        .collection(SHOP_CTV_FRAUD_EVENTS)
        .createIndex({ createdAt: -1 }, { background: true }),
      shopDb
        .collection(SHOP_CTV_FRAUD_EVENTS)
        .createIndex({ ctvCode: 1, createdAt: -1 }, { background: true }),
    ]);
  } catch (e) {
    console.warn("[commission] ensureIndexes:", e);
  }
}
