/**
 * Shared types, context builder, and status helpers for CTV Me portal.
 */
import type { Response } from "express";
import {
  requireShopAuth,
  type ShopAuthRequest,
  type GetShopDb,
} from "../../shopAuth/routes.js";
import {
  SHOP_ACCOUNTS,
  normalizeCtvCode,
  shopAccountIdQuery,
} from "../../shopAuth/models.js";
import type { GetDb } from "../../auth/middleware.js";

export const CTV_COMMISSION_UX: Record<
  string,
  { label: string; hint: string }
> = {
  held: {
    label: "Đang giữ",
    hint: "Đơn mới giao, chờ hết thời gian đổi/trả",
  },
  eligible: {
    label: "Sắp nhận",
    hint: "Đã đủ điều kiện, chờ shop chi",
  },
  billed: {
    label: "Đang chi",
    hint: "Shop đã chốt vào đợt thanh toán lần này",
  },
  paid_out: {
    label: "Đã nhận",
    hint: "Đã chuyển tiền",
  },
  cancelled: {
    label: "Không được nhận",
    hint: "Đơn hủy / không tính hoa hồng",
  },
  flagged: {
    label: "Đang kiểm tra",
    hint: "Shop đang rà soát, tạm chưa chi",
  },
  none: {
    label: "Chưa phát sinh",
    hint: "Đơn chưa giao xong nên chưa có hoa hồng",
  },
};

export function summarizeCtvCommissionStatus(
  comms: any[],
  opts?: { holdDays?: number }
): {
  key: string;
  label: string;
  hint: string;
} {
  const statuses = comms.map((c) => String(c?.status || "").trim().toLowerCase());
  const set = new Set(statuses.filter(Boolean));
  let key = "none";
  if (set.has("flagged")) key = "flagged";
  else if (set.has("billed")) key = "billed";
  else if (set.has("eligible")) key = "eligible";
  else if (set.has("held")) key = "held";
  else if (set.has("paid_out")) key = "paid_out";
  else if (set.has("cancelled")) key = "cancelled";

  const ux = CTV_COMMISSION_UX[key] || CTV_COMMISSION_UX.none;
  let hint = ux.hint;
  if (key === "held" && opts?.holdDays) {
    hint = `Còn chờ hết ${opts.holdDays} ngày đổi/trả`;
  } else if (key === "billed") {
    const period = String(
      comms.find((c) => String(c?.status) === "billed")?.billingPeriod || ""
    ).trim();
    const m = /^(\d{4})-(\d{2})(?:-(K[12]))?$/.exec(period);
    if (m) {
      const cycleText = m[3] === "K1" ? " · Đợt 1" : m[3] === "K2" ? " · Đợt 2" : "";
      hint = `Thuộc đợt chi tháng ${Number(m[2])}/${m[1]}${cycleText}`;
    }
  } else if (key === "paid_out") {
    const paidAt = comms.find((c) => c?.paidAt)?.paidAt;
    if (paidAt) {
      const d = new Date(paidAt);
      if (Number.isFinite(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        hint = `Đã chuyển ngày ${dd}/${mm}/${d.getFullYear()}`;
      }
    }
  }
  return { key, label: ux.label, hint };
}

export type ActiveCtvContext = {
  shopDb: any;
  doc: any;
  ctvCode: string;
};

export type CtvMeCtx = {
  getShopDb: GetShopDb;
  getDb: GetDb;
  auth: ReturnType<typeof requireShopAuth>;
  requireActiveCtv: (
    req: ShopAuthRequest,
    res: Response
  ) => Promise<ActiveCtvContext | null>;
};

export function buildCtvMeCtx(getShopDb: GetShopDb, getDb: GetDb): CtvMeCtx {
  const auth = requireShopAuth(getShopDb);

  async function requireActiveCtv(
    req: ShopAuthRequest,
    res: Response
  ): Promise<ActiveCtvContext | null> {
    const user = req.shopAuth;
    if (!user) {
      res.status(401).json({ error: "unauthorized" });
      return null;
    }
    const shopDb = await getShopDb();
    const doc = await shopDb
      .collection(SHOP_ACCOUNTS)
      .findOne(shopAccountIdQuery(user.userId));
    if (!doc || !(doc as any).roles?.includes?.("ctv")) {
      res.status(403).json({ error: "not_ctv" });
      return null;
    }
    if ((doc as any).ctvStatus !== "active") {
      res.status(403).json({ error: "ctv_not_active", status: (doc as any).ctvStatus });
      return null;
    }
    const ctvCode = normalizeCtvCode(String((doc as any).ctvCode || ""));
    if (!ctvCode) {
      res.status(403).json({ error: "missing_ctv_code" });
      return null;
    }
    return { shopDb, doc, ctvCode };
  }

  return {
    getShopDb,
    getDb,
    auth,
    requireActiveCtv,
  };
}
