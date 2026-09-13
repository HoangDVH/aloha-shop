/**
 * Chống gian CTV — self-buy / trùng SĐT / địa chỉ.
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

export async function checkOrderFraudFlags(
  shopDb: Db,
  order: Record<string, unknown>,
  settings: CtvSettings
): Promise<{ flags: string[]; details: string[] }> {
  const flags: string[] = [];
  const details: string[] = [];
  const detailsLines = Array.isArray(order.orderDetails) ? (order.orderDetails as any[]) : [];
  const ctvCodes = [
    ...new Set(
      detailsLines
        .map((d) => normalizeCtvCode(String(d?.ctvCode || "")))
        .filter((c) => c.length >= 3)
    ),
  ];
  if (!ctvCodes.length) return { flags, details };

  const recvPhone = normPhone(String(order.customerPhone || ""));
  const recvAddr = normAddr(
    [order.shippingAddress, order.detail, order.ward, order.province].filter(Boolean).join(" ")
  );

  for (const ctv of ctvCodes) {
    const acc = await shopDb.collection(SHOP_ACCOUNTS).findOne({ ctvCode: ctv });
    if (!acc) continue;
    const accPhone = normPhone(String((acc as any).phone || ""));
    const accAddr = normAddr(
      [
        (acc as any).homeAddress,
        ...((Array.isArray((acc as any).addresses) ? (acc as any).addresses : []) as any[]).map(
          (a) => [a.detail, a.ward, a.province].filter(Boolean).join(" ")
        ),
      ]
        .filter(Boolean)
        .join(" ")
    );

    let selfHit = false;
    if (recvPhone && accPhone && recvPhone === accPhone) {
      selfHit = true;
      flags.push("self_buy_phone");
      details.push(`${ctv}: SĐT nhận trùng CTV`);
    }
    if (recvAddr && accAddr && recvAddr.length >= 12 && recvAddr === accAddr) {
      selfHit = true;
      flags.push("self_buy_address");
      details.push(`${ctv}: địa chỉ nhận trùng CTV`);
    }

    // Buyer account = CTV account (self-buy qua tài khoản)
    const buyerId = String(order.shopAccountId || "").trim();
    const ctvAccId = String((acc as any)._id || "").trim();
    if (buyerId && ctvAccId && buyerId === ctvAccId) {
      selfHit = true;
      flags.push("self_buy_account");
      details.push(`${ctv}: tài khoản đặt hàng trùng CTV`);
    }

    // Đếm đơn trùng SĐT trong 90 ngày
    if (recvPhone) {
      const since = new Date(Date.now() - 90 * 86400_000).toISOString();
      const matchCount = await shopDb.collection(SHOP_ORDERS).countDocuments({
        customerPhone: { $regex: recvPhone.slice(-9) },
        ctvCodes: ctv,
        createdAt: { $gte: since },
        orderStatus: { $nin: ["huy"] },
      });
      if (matchCount >= settings.addressMatchMaxHits) {
        flags.push("address_match_threshold");
        details.push(`${ctv}: ${matchCount} đơn trùng SĐT/ngưỡng`);
      }
    }

    if (selfHit || flags.includes("address_match_threshold")) {
      await shopDb.collection(SHOP_CTV_FRAUD_EVENTS).insertOne({
        type: selfHit ? "self_buy" : "address_match",
        ctvCode: ctv,
        orderCode: String(order.code || order.id || ""),
        details: details.filter((d) => d.startsWith(ctv)),
        createdAt: new Date().toISOString(),
      });
    }
  }

  return { flags: [...new Set(flags)], details };
}

export async function recordFraudEvent(
  shopDb: Db,
  ev: {
    type: string;
    ctvCode: string;
    orderCode?: string;
    details?: string[];
    by?: string;
  }
) {
  await shopDb.collection(SHOP_CTV_FRAUD_EVENTS).insertOne({
    ...ev,
    ctvCode: normalizeCtvCode(ev.ctvCode),
    createdAt: new Date().toISOString(),
  });
}
