/**
 * Chống gian CTV — chuẩn vận hành:
 * - Hard: self-buy (SĐT / địa chỉ / tài khoản trùng CTV) → gắn cờ hoa hồng
 * - Soft: trùng SĐT nhiều đơn (không kèm self-buy) → chỉ ghi cảnh báo, không khóa HH
 * - Whitelist SĐT test/nội bộ → bỏ qua rule trùng SĐT
 */
import type { Db } from "mongodb";
import { SHOP_ACCOUNTS, normalizeCtvCode } from "../shopAuth/models.js";
import { SHOP_CTV_FRAUD_EVENTS, type CtvSettings } from "./commissionModels.js";
import { SHOP_ORDERS } from "./models.js";

function normPhone(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("84") && d.length >= 10) return "0" + d.slice(2);
  return d;
}

function normAddr(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 80);
}

function isWhitelistedPhone(phone: string, settings: CtvSettings): boolean {
  const p = normPhone(phone);
  if (!p) return false;
  const list = Array.isArray(settings.phoneWhitelist)
    ? settings.phoneWhitelist
    : [];
  for (const raw of list) {
    const w = normPhone(String(raw || ""));
    if (!w) continue;
    if (p === w || p.endsWith(w) || w.endsWith(p)) return true;
  }
  // Số giả rõ ràng (toàn 0/1/lặp) — bỏ qua soft rule
  if (/^(\d)\1{7,}$/.test(p)) return true;
  if (p === "0123456789" || p === "123456789" || p === "0987654321") return true;
  return false;
}

export type FraudCheckResult = {
  /** Cờ khiến hoa hồng = flagged (self-buy) */
  hardFlags: string[];
  /** Cảnh báo ghi nhận, không tự khóa HH */
  softFlags: string[];
  details: string[];
  severity: "none" | "warn" | "high";
  /** Gộp để lưu commission.fraudFlags (hard ưu tiên) */
  flags: string[];
};

export async function checkOrderFraudFlags(
  shopDb: Db,
  order: Record<string, unknown>,
  settings: CtvSettings
): Promise<FraudCheckResult> {
  const hardFlags: string[] = [];
  const softFlags: string[] = [];
  const details: string[] = [];
  const detailsLines = Array.isArray(order.orderDetails)
    ? (order.orderDetails as any[])
    : [];
  const ctvCodes = [
    ...new Set(
      detailsLines
        .map((d) => normalizeCtvCode(String(d?.ctvCode || "")))
        .filter((c) => c.length >= 3)
    ),
  ];
  if (!ctvCodes.length) {
    return {
      hardFlags,
      softFlags,
      details,
      severity: "none",
      flags: [],
    };
  }

  const recvPhone = normPhone(String(order.customerPhone || ""));
  const phoneWhitelisted = isWhitelistedPhone(recvPhone, settings);
  const recvAddr = normAddr(
    [order.shippingAddress, order.detail, order.ward, order.province]
      .filter(Boolean)
      .join(" ")
  );
  const buyerId = String(order.shopAccountId || "").trim();

  for (const ctv of ctvCodes) {
    const acc = await shopDb.collection(SHOP_ACCOUNTS).findOne({ ctvCode: ctv });
    if (!acc) continue;
    const accPhone = normPhone(String((acc as any).phone || ""));
    const accAddr = normAddr(
      [
        (acc as any).homeAddress,
        ...(
          (Array.isArray((acc as any).addresses)
            ? (acc as any).addresses
            : []) as any[]
        ).map((a) =>
          [a.detail, a.ward, a.province].filter(Boolean).join(" ")
        ),
      ]
        .filter(Boolean)
        .join(" ")
    );

    let selfHit = false;
    const ctvHard: string[] = [];
    const ctvSoft: string[] = [];
    const ctvDetailLines: string[] = [];

    // --- HARD: self-buy ---
    if (recvPhone && accPhone && recvPhone === accPhone) {
      selfHit = true;
      ctvHard.push("self_buy_phone");
      ctvDetailLines.push(`${ctv}: SĐT nhận trùng CTV (tự mua)`);
    }
    if (recvAddr && accAddr && recvAddr.length >= 12 && recvAddr === accAddr) {
      selfHit = true;
      ctvHard.push("self_buy_address");
      ctvDetailLines.push(`${ctv}: địa chỉ nhận trùng CTV (tự mua)`);
    }

    const ctvAccIds = [
      String((acc as any)._id || "").trim(),
      String((acc as any).id || "").trim(),
    ].filter(Boolean);
    if (buyerId && ctvAccIds.includes(buyerId)) {
      selfHit = true;
      ctvHard.push("self_buy_account");
      ctvDetailLines.push(`${ctv}: tài khoản đặt hàng trùng CTV (tự mua)`);
    }

    // --- SOFT: nhiều đơn cùng SĐT (không whitelist, không tự mua) ---
    if (
      recvPhone &&
      !phoneWhitelisted &&
      !selfHit &&
      settings.phoneRepeatSoftWarn !== false
    ) {
      const since = new Date(Date.now() - 90 * 86400_000).toISOString();
      const matchCount = await shopDb.collection(SHOP_ORDERS).countDocuments({
        customerPhone: { $regex: recvPhone.slice(-9) },
        ctvCodes: ctv,
        createdAt: { $gte: since },
        orderStatus: { $nin: ["huy"] },
      });
      const threshold = Math.max(1, Number(settings.addressMatchMaxHits) || 10);
      if (matchCount >= threshold) {
        ctvSoft.push("phone_repeat_soft");
        ctvDetailLines.push(
          `${ctv}: ${matchCount} đơn trùng SĐT trong 90 ngày (ngưỡng ${threshold}) — chỉ cảnh báo`
        );
      }
    }

    hardFlags.push(...ctvHard);
    softFlags.push(...ctvSoft);
    details.push(...ctvDetailLines);

    if (ctvHard.length || ctvSoft.length) {
      await shopDb.collection(SHOP_CTV_FRAUD_EVENTS).insertOne({
        type: selfHit ? "self_buy" : "phone_repeat",
        severity: selfHit ? "high" : "warn",
        ctvCode: ctv,
        orderCode: String(order.code || order.id || ""),
        details: ctvDetailLines,
        hardFlags: ctvHard,
        softFlags: ctvSoft,
        createdAt: new Date().toISOString(),
        reviewStatus: "open",
      });
    }
  }

  const uniqHard = [...new Set(hardFlags)];
  const uniqSoft = [...new Set(softFlags)];
  const severity =
    uniqHard.length > 0 ? "high" : uniqSoft.length > 0 ? "warn" : "none";

  return {
    hardFlags: uniqHard,
    softFlags: uniqSoft,
    details: [...new Set(details)],
    severity,
    // Chỉ hard flags khóa hoa hồng
    flags: uniqHard,
  };
}

export async function recordFraudEvent(
  shopDb: Db,
  ev: {
    type: string;
    ctvCode: string;
    orderCode?: string;
    details?: string[];
    by?: string;
    severity?: string;
    reviewStatus?: string;
  }
) {
  await shopDb.collection(SHOP_CTV_FRAUD_EVENTS).insertOne({
    ...ev,
    ctvCode: normalizeCtvCode(ev.ctvCode),
    severity: ev.severity || "info",
    reviewStatus: ev.reviewStatus || "open",
    createdAt: new Date().toISOString(),
  });
}
